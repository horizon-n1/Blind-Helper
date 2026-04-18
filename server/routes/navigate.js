const express = require('express');
const router = express.Router();
require('dotenv').config();

const { GoogleGenerativeAI } = require('@google/generative-ai');
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ── General voice navigation (existing) ──────────────
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

// ── Initial directions to a room ─────────────────────
router.post('/to-room', async (req, res) => {
  try {
    const { destination, rooms, summary } = req.body;

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const result = await model.generateContent(`
      You are a navigation assistant for a completely blind person.

      STRICT RULES:
      - Use ONLY physical movement words: forward, left, right, back, steps, turn
      - NEVER mention colors, signs, labels, or visual landmarks
      - ONLY use paths described in the layout below — do NOT invent routes
      - Give step counts where the layout provides them
      - If the destination is not listed, say: "I could not find that room in the scanned area."
      - Maximum 3 sentences. Speak directly to the user.

      Known layout:
      ${summary}

      Known rooms: ${rooms.join(', ')}
      Destination: ${destination}

      Give opening movement instructions toward ${destination} using only the layout above.
    `);

    const directions = result.response.text();
    res.json({ directions });

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
    const result = await model.generateContent([
      {
        text: `You are a real-time navigation assistant for a completely blind person.

        PRIORITY 1 — OBSTACLE DETECTION (always check first):
        Scan the camera frame right now. Is any object within 6 feet of the camera?
        - Furniture, people, pets, floor objects, steps, walls, closed doors

        If YES → respond EXACTLY: "Stop. [left/right/center]. [step left / step right / wait]"
        Example: "Stop. Chair on the right. Step left."

        PRIORITY 2 — NAVIGATION (only when no obstacle):
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

        If the destination is clearly visible and reachable say EXACTLY:
        "You have arrived at your destination"`
      },
      {
        inlineData: {
          mimeType: 'image/jpeg',
          data: image
        }
      }
    ]);

    const instruction = result.response.text().trim();
    const arrived = instruction.toLowerCase().includes('arrived');
    const obstacle = instruction.toLowerCase().startsWith('stop');

    res.json({ instruction, arrived, obstacle });

  } catch (err) {
    console.error('Guide error:', err);
    res.status(500).json({ error: 'Guidance failed' });
  }
});

module.exports = router;