const express = require('express');
const router = express.Router();
const OpenAI = require('openai');

// Initialize OpenAI using the key loaded from .env
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY 
});

const DEMO_MAP = `
- Entrance: (0,0)
- Master Bedroom: 10 steps forward, 5 steps left
- Kitchen: 15 steps forward, 2 steps right
- Bathroom: 5 steps forward from Entrance, then immediate right
`;

router.post('/', async (req, res) => {
  const { message } = req.body;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a navigation assistant for the blind. 
          Use this map data: ${DEMO_MAP}.
          Provide a short, clear, 1-2 sentence direction to help them reach their destination.
          Only give the next immediate step or a high-level summary.`
        },
        {
          role: "user",
          content: message
        }
      ]
    });

    const text = response.choices[0].message.content;
    res.json({ reply: text });
    
  } catch (error) {
    console.error("OpenAI Error:", error);
    res.status(500).json({ error: "Failed to generate navigation" });
  }
});

module.exports = router;
