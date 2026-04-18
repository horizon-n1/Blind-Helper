const express = require('express');
const router = express.Router();
require('dotenv').config();

const { GoogleGenerativeAI } = require('@google/generative-ai');
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ─────────────────────────────────────────────────────────────────
// BFS  →  ordered waypoint path
// ─────────────────────────────────────────────────────────────────
function findPath(waypoints, destination) {
  if (!waypoints?.length) return null;

  const start = waypoints[0];
  const queue = [[start, [start]]];
  const visited = new Set([start.id]);

  while (queue.length) {
    const [current, path] = queue.shift();

    if (current.name.toLowerCase().includes(destination.toLowerCase())) {
      return path;
    }

    for (const conn of (current.connections ?? [])) {
      const next = waypoints.find(wp => wp.id === conn.to);
      if (next && !visited.has(next.id)) {
        visited.add(next.id);
        queue.push([
          next,
          [...path, { ...next, _via: { direction: conn.direction, steps: conn.steps } }],
        ]);
      }
    }
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────
// Serialize BFS path into numbered natural-language steps
// ─────────────────────────────────────────────────────────────────
function serializePath(path) {
  if (!path?.length) return null;

  const total = path.length;
  const lines = [];

  path.forEach((wp, i) => {
    const label = i === total - 1 ? `DESTINATION: "${wp.name}"` : `"${wp.name}"`;

    if (i === 0) {
      lines.push(`Step 1 of ${total} — Starting position: ${label}`);
    } else {
      const { direction, steps } = wp._via ?? {};
      const move = steps != null ? `${steps} step${steps !== 1 ? 's' : ''}` : 'some steps';
      const turn = direction ? `${direction}, walk ` : 'Walk ';
      lines.push(`Step ${i + 1} of ${total} — ${turn}${move} → reach ${label}`);
    }
  });

  return lines.join('\n');
}

// ─────────────────────────────────────────────────────────────────
// POST /api/navigate/
// General voice navigation
// ─────────────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { message } = req.body;

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const result = await model.generateContent(`
      You are a helpful indoor navigation assistant.
      User said: "${message}"
      Respond conversationally and helpfully in 1-2 sentences.
    `);

    const reply = result.response.text();
    res.json({ reply });

  } catch (err) {
    console.error('Navigate error:', err);
    res.status(500).json({ error: 'Navigation failed' });
  }
});

// ─────────────────────────────────────────────────────────────────
// POST /api/navigate/to-room
// BFS path → serialized steps → LLM speaks first instruction only
// ─────────────────────────────────────────────────────────────────
router.post('/to-room', async (req, res) => {
  try {
    const { destination, rooms, summary, waypoints } = req.body;

    const path = findPath(waypoints, destination);
    const serializedPath = path ? serializePath(path) : null;

    const prompt = serializedPath
      ? `
You are a navigation assistant for a completely blind person.

You have been given an EXACT, pre-computed route. Your only job is to read
out the opening instructions in a clear, natural spoken sentence.

RULES:
- Use ONLY the steps listed below. Do NOT add, skip, or invent any steps.
- Use ONLY physical movement words: forward, left, right, back, steps, turn.
- NEVER mention colors, signs, labels, or visual landmarks.
- Speak directly to the user ("Walk forward 5 steps…").
- Give only the FIRST movement instruction — not the full route.
- Maximum 2 sentences.

PRE-COMPUTED ROUTE (ground truth — do not deviate):
${serializedPath}

Speak the first movement instruction now.
`.trim()
      : `
You are a navigation assistant for a completely blind person.

The destination "${destination}" could not be found in the scanned area.

Known rooms: ${rooms?.join(', ') ?? 'none'}

Say exactly: "I could not find ${destination} in the scanned area."
Then name the available rooms in one sentence.
`.trim();

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const result = await model.generateContent(prompt);
    const directions = result.response.text().trim();

    res.json({
      directions,
      path: path ?? [],
      totalSteps: path?.length ?? 0,
      currentStepIndex: 0,
      serializedPath,
    });

  } catch (err) {
    console.error('Room navigation error:', err);
    res.status(500).json({ error: 'Room navigation failed' });
  }
});

// ─────────────────────────────────────────────────────────────────
// POST /api/navigate/guide
// Real-time step-by-step guidance with waypoint context
//
// Now receives: currentWaypoint, nextWaypoint, stepIndex from App.jsx
// Returns:      instruction, arrived, arrivedAtWaypoint, obstacle
// ─────────────────────────────────────────────────────────────────
// Replaces router.post('/guide', ...) in navigate.js
// Everything else in navigate.js stays the same.
//
// KEY CHANGE: waypoint arrival is now a two-signal AND gate.
//   Signal 1 — model vision: did the camera frame look like the target waypoint?
//   Signal 2 — step plausibility: has the user walked enough steps to be there?
//
// Both must be true before arrivedAtWaypoint fires.
// This prevents the index jumping when the model hallucinates an arrival.

router.post('/guide', async (req, res) => {
  try {
    const {
      image,
      destination,
      rooms,
      summary,
      lastInstruction,
      currentWaypoint,       // { id, name, _via: { direction, steps } }
      nextWaypoint,          // { id, name, _via: { direction, steps } }
      stepIndex,             // number — position in the path array
      stepsSinceLastWaypoint // number — client counts steps spoken since last advance
    } = req.body;

    if (!image) return res.status(400).json({ error: 'No image provided' });

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    // ── Build enriched waypoint context ─────────────────────────────────────────────
    const buildCueText = (cues) => {
      if (!cues) return "none recorded";
      const parts = [];
      if (cues.floor) parts.push(`${cues.floor} floor`);
      if (cues.sound) parts.push(cues.sound);
      if (cues.touch) parts.push(`tactile cue: ${cues.touch}`);
      return parts.join(', ');
    };

    const waypointContext = currentWaypoint
      ? `
Current position: "${currentWaypoint.name}"
Description: ${currentWaypoint.description || 'Arrived at waypoint'}
Next target: "${nextWaypoint?.name ?? destination}" ${nextWaypoint?._via ? `— ${nextWaypoint._via.direction}, ${nextWaypoint._via.steps} steps` : ''}

SENSORY CUES to confirm arrival at "${nextWaypoint?.name ?? destination}":
- Expect: ${buildCueText(nextWaypoint?.entryCues)}
- Landmarks: ${nextWaypoint?.landmarks?.map(l => `${l.name} on the ${l.side}`).join(', ') ?? 'none'}
`
      : `Known layout: ${summary}`;



    // ── Step plausibility threshold ────────────────────────────────────────
    // The expected steps to reach the next waypoint comes from the BFS path.
    // We fire arrivedAtWaypoint only when the spoken step count is at least
    // 70% of the expected distance. This prevents early false positives.
    const expectedSteps = nextWaypoint?._via?.steps ?? 0;
    const ARRIVAL_THRESHOLD = 0.7; // 70% of expected steps walked
    const stepCountPlausible =
      expectedSteps === 0 || // no step data → don't gate on count
      (stepsSinceLastWaypoint ?? 0) >= Math.floor(expectedSteps * ARRIVAL_THRESHOLD);

    // ── Run obstacle + navigation in parallel ──────────────────────────────
    const [obstacleResult, navResult] = await Promise.all([

      // Obstacle detection — unchanged
      model.generateContent([
        {
          text: `You are an obstacle detection system for a blind person.
Scan this camera frame ONLY for physical obstacles within 6 feet:
- Furniture, people, pets, floor objects, steps, walls, closed doors

If obstacle found respond EXACTLY:
"OBSTACLE:[location: left/right/center]:[action: step left/step right/wait]"
Example: "OBSTACLE:right:step left"

If NO obstacle respond EXACTLY: "CLEAR"
Nothing else.`
        },
        { inlineData: { mimeType: 'image/jpeg', data: image } }
      ]),

      // Navigation — now returns a structured JSON signal
      model.generateContent([
        {
          text: `You are a navigation assistant for a completely blind person.
You must respond with ONLY a JSON object — no explanation, no markdown.

CONTEXT:
${waypointContext}
Known rooms: ${rooms?.join(', ')}
Destination: ${destination}
Last instruction given: "${lastInstruction || 'none'}"

TASK: Look at the camera frame and decide the next action.

Respond with exactly this JSON shape:
{
  "action": "move" | "waypoint_reached" | "destination_reached",
  "instruction": "<one physical movement instruction, max 10 words>",
  "confidence": 0.0–1.0
}

action rules:
- "move"               → user has NOT yet reached the next target; give the next step
- "waypoint_reached"   → camera shows the user has reached "${nextWaypoint?.name ?? 'next waypoint'}"
- "destination_reached"→ camera shows the user has reached the final destination "${destination}"

instruction rules:
- Use ONLY: forward, left, right, back — no visual references
- Include exact step counts where available
- NEVER repeat: "${lastInstruction || 'none'}"
- For waypoint_reached: state the NEXT movement toward "${destination}"
- For destination_reached: say "You have arrived at ${destination}"
- confidence: how certain you are of the action (0.0 = guessing, 1.0 = certain)`
        },
        { inlineData: { mimeType: 'image/jpeg', data: image } }
      ])
    ]);

    const obstacleText = obstacleResult.response.text().trim();
    const navRaw = navResult.response.text().trim();

    // ── Parse nav JSON safely ──────────────────────────────────────────────
    let navData = { action: 'move', instruction: '', confidence: 0 };
    try {
      const cleaned = navRaw.replace(/```json|```/g, '').trim();
      navData = JSON.parse(cleaned);
    } catch {
      // Model returned plain text instead of JSON — treat as a move instruction
      console.warn('[guide] JSON parse failed, raw:', navRaw);
      navData = { action: 'move', instruction: navRaw.slice(0, 80), confidence: 0.3 };
    }

    const hasObstacle = obstacleText.startsWith('OBSTACLE');
    const modelSaysArrived =
      navData.action === 'waypoint_reached' ||
      navData.action === 'destination_reached';
    const highConfidence = (navData.confidence ?? 0) >= 0.6;

    // ── TWO-SIGNAL AND GATE ────────────────────────────────────────────────
    //   arrivedAtWaypoint fires only when:
    //     1. Model says waypoint_reached (vision signal)
    //     2. Step count is plausible (odometry signal)
    //     3. Confidence is >= 0.6 (model isn't guessing)
    //     4. No obstacle is blocking the path right now
    const arrivedAtWaypoint =
      !hasObstacle &&
      navData.action === 'waypoint_reached' &&
      stepCountPlausible &&
      highConfidence;

    const arrived =
      !hasObstacle &&
      navData.action === 'destination_reached' &&
      stepCountPlausible &&
      highConfidence;

    // ── Build the spoken instruction ───────────────────────────────────────
    let instruction;
    if (hasObstacle) {
      const parts = obstacleText.split(':');
      instruction = `Stop. ${parts[1] ?? 'obstacle ahead'}. ${parts[2] ?? 'wait'}`;
    } else if (arrived) {
      instruction = `You have arrived at ${destination}.`;
    } else if (arrivedAtWaypoint) {
      // Model confirmed waypoint — speak the next leg of the journey
      instruction = navData.instruction ||
        (nextWaypoint?._via
          ? `Good. Now ${nextWaypoint._via.direction}, walk ${nextWaypoint._via.steps} steps.`
          : `Good. Continue toward ${destination}.`);
    } else if (modelSaysArrived && !stepCountPlausible) {
      // Model thinks arrived but step count disagrees — stay the course
      // Log for debugging but keep the user moving
      console.log(`[guide] arrival suppressed — model confident but only ${stepsSinceLastWaypoint}/${expectedSteps} steps walked`);
      instruction = navData.instruction || lastInstruction || `Continue toward ${nextWaypoint?.name ?? destination}.`;
    } else {
      instruction = navData.instruction;
    }

    res.json({
      instruction,
      arrived,                // final destination reached
      arrivedAtWaypoint,      // intermediate waypoint confirmed — App advances index
      obstacle: hasObstacle,
      // ── Debug fields (strip in production if desired) ──
      _debug: {
        action: navData.action,
        confidence: navData.confidence,
        stepCountPlausible,
        stepsSinceLastWaypoint: stepsSinceLastWaypoint ?? 0,
        expectedSteps,
        gatePassed: arrivedAtWaypoint || arrived,
      }
    });

  } catch (err) {
    console.error('Guide error:', err);
    res.status(500).json({ error: 'Guidance failed' });
  }
});
// ─────────────────────────────────────────────────────────────────
// POST /api/navigate/check-progress
// Periodic off-track detection (every 15s)
// ─────────────────────────────────────────────────────────────────
router.post('/check-progress', async (req, res) => {
  try {
    const { image, destination, path, stepIndex, summary } = req.body;

    if (!image) return res.status(400).json({ error: 'No image provided' });

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const currentStep = path?.[stepIndex];

    const result = await model.generateContent([
      {
        text: `You are checking if a blind person is still on the correct path.

They should currently be at: ${currentStep ? `"${currentStep.name}"` : `approaching ${destination}`}
Their destination is: ${destination}
Known layout: ${summary}

Look at the camera frame. Are they on track or have they drifted?

Respond EXACTLY in one of these formats:
"ON_TRACK"
"OFF_TRACK:[one instruction to get back, max 8 words]"

Nothing else.`
      },
      { inlineData: { mimeType: 'image/jpeg', data: image } }
    ]);

    const text = result.response.text().trim();
    const offTrack = text.startsWith('OFF_TRACK');
    const correction = offTrack ? text.split(':')[1]?.trim() : null;

    res.json({ offTrack, correction });

  } catch (err) {
    console.error('Progress check error:', err);
    res.status(500).json({ error: 'Progress check failed' });
  }
});

// ─────────────────────────────────────────────────────────────────
// Single export — must be at the very end after all routes
// ─────────────────────────────────────────────────────────────────
module.exports = router;