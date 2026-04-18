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
      - NEVER describe anything visual. The user is blind.
      - NEVER mention colors, signs, labels, numbers, or appearances.
      - ONLY use physical movement commands.
      - ONLY use information from the layout below. Do NOT invent paths.
      - If the destination is not in the layout say: "I could not find that room in the scanned area. Please try another room."
      - Maximum 3 sentences.
      - Speak directly to the user.

      Known layout:
      ${summary}

      Known rooms: ${rooms.join(', ')}
      Destination: ${destination}

      Give opening physical directions to start moving toward the ${destination}.
      Only use the known layout above. Do not invent anything.
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
        text: `You are a real-time navigation and obstacle detection assistant for a completely blind person.

        YOU HAVE TWO JOBS — check in this order:

        JOB 1 — OBSTACLE DETECTION (check this first, every time):
        Look at the camera frame RIGHT NOW. Is anything within 6 feet?
        - Furniture: chairs, tables, couches, shelves
        - People or pets
        - Objects on floor: bags, shoes, cables, rugs
        - Steps or stairs
        - Walls or closed doors directly ahead

        If YES: "Stop. [obstacle location: left, right, or center]. [one action: step left, step right, or wait]"
        Example: "Stop. Chair on the right. Step left."

        JOB 2 — NAVIGATION (only if no obstacle):
        Give the next single physical movement toward the destination.

        STRICT RULES:
        - NEVER describe visual things (colors, signs, labels).
        - NEVER invent obstacles not clearly in the frame.
        - NEVER repeat the last instruction.
        - Maximum 10 words.
        - ONE instruction only.
        - Only describe what you actually see.

        Known layout: ${summary}
        Rooms: ${rooms.join(', ')}
        Destination: ${destination}
        Last instruction: "${lastInstruction || 'none yet'}"
        User has completed the last instruction. Give only the next one.

        If user has reached ${destination} say exactly:
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