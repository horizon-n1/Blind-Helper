const express = require('express');
const router = express.Router();
require('dotenv').config();

const { GoogleGenerativeAI } = require('@google/generative-ai');
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ── General voice navigation ──────────────────────────
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

// ── Initial directions to a room ──────────────────────
router.post('/to-room', async (req, res) => {
  try {
    const { destination, rooms, summary, waypoints } = req.body;

    const findPath = (waypoints, destination) => {
      if (!waypoints?.length) return null;
      const start = waypoints[0];
      const queue = [[start, [start]]];
      const visited = new Set([start.id]);

      while (queue.length) {
        const [current, path] = queue.shift();
        if (current.name.toLowerCase().includes(destination.toLowerCase())) {
          return path;
        }
        for (const conn of current.connections) {
          const next = waypoints.find(wp => wp.id === conn.to);
          if (next && !visited.has(next.id)) {
            visited.add(next.id);
            queue.push([next, [...path, { ...next, fromDirection: conn.direction, fromSteps: conn.steps }]]);
          }
        }
      }
      return null;
    };

    const path = findPath(waypoints, destination);

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const result = await model.generateContent(`
      You are a navigation assistant for a completely blind person.

      STRICT RULES:
      - Use ONLY physical movement words: forward, left, right, back, steps, turn
      - NEVER mention colors, signs, labels, or visual landmarks
      - Give exact step counts from the path below
      - If the destination is not listed, say: "I could not find that room in the scanned area."
      - Maximum 3 sentences. Speak directly to the user.

      ${path ? `Planned path: ${JSON.stringify(path)}` : `Known layout: ${summary}`}
      Known rooms: ${rooms.join(', ')}
      Destination: ${destination}

      Give opening movement instructions using exact step counts from the path.
    `);

    const directions = result.response.text();
    res.json({ directions, path });

  } catch (err) {
    console.error('Room navigation error:', err);
    res.status(500).json({ error: 'Room navigation failed' });
  }
});

// ── Real-time step-by-step guidance ──────────────────
router.post('/guide', async (req, res) => {
  try {
    const { image, destination, rooms, summary, lastInstruction } = req.body;

    if (!image) return res.status(400).json({ error: 'No image provided' });

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    // Run obstacle detection and navigation in parallel
    const [obstacleResult, navResult] = await Promise.all([
      model.generateContent([
        {
          text: `You are an obstacle detection system for a blind person.

          Scan this camera frame ONLY for physical obstacles within 6 feet:
          - Furniture, people, pets, floor objects, steps, walls, closed doors

          If obstacle found respond EXACTLY in this format:
          "OBSTACLE:[location: left/right/center]:[action: step left/step right/wait]"
          Example: "OBSTACLE:right:step left"

          If NO obstacle respond EXACTLY: "CLEAR"

          Nothing else. No explanation.`
        },
        { inlineData: { mimeType: 'image/jpeg', data: image } }
      ]),
      model.generateContent([
        {
          text: `You are a navigation assistant for a completely blind person.

          Using the known layout below, give ONE physical movement instruction toward ${destination}.

          STRICT RULES:
          - Use ONLY: forward, left, right, back — no visual references
          - Count steps when turning or moving (e.g. "Turn left, walk 3 steps")
          - NEVER repeat the last instruction: "${lastInstruction || 'none'}"
          - NEVER invent paths not in the layout
          - MAX 10 words
          - ONE instruction only

          Known layout: ${summary}
          Known rooms: ${rooms.join(', ')}
          Destination: ${destination}

          If destination is clearly reachable say EXACTLY:
          "You have arrived at your destination"`
        },
        { inlineData: { mimeType: 'image/jpeg', data: image } }
      ])
    ]);

    const obstacleText = obstacleResult.response.text().trim();
    const navText = navResult.response.text().trim();

    const hasObstacle = obstacleText.startsWith('OBSTACLE');
    const arrived = navText.toLowerCase().includes('arrived');

    let instruction;
    if (hasObstacle) {
      const parts = obstacleText.split(':');
      instruction = `Stop. ${parts[1]}. ${parts[2]}`;
    } else {
      instruction = navText;
    }

    res.json({ instruction, arrived, obstacle: hasObstacle });

  } catch (err) {
    console.error('Guide error:', err);
    res.status(500).json({ error: 'Guidance failed' });
  }
});

// ── Check navigation progress / rerouting ────────────
router.post('/check-progress', async (req, res) => {
  try {
    const { image, destination, path, stepIndex, summary } = req.body;

    if (!image) return res.status(400).json({ error: 'No image provided' });

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const currentStep = path?.[stepIndex];

    const result = await model.generateContent([
      {
        text: `You are checking if a blind person is still on the correct path.

        They should currently be: ${currentStep ? JSON.stringify(currentStep) : 'approaching ' + destination}
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
    const correction = offTrack ? text.split(':')[1] : null;

    res.json({ offTrack, correction });

  } catch (err) {
    console.error('Progress check error:', err);
    res.status(500).json({ error: 'Progress check failed' });
  }
});

module.exports = router;