const express = require('express');
const router = express.Router();
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

const DEMO_MAP = `
- Entrance: (0,0)
- Master Bedroom: 10 steps forward, 5 steps left
- Kitchen: 15 steps forward, 2 steps right
- Bathroom: 5 steps forward from Entrance, then immediate right
`;

router.post('/', async (req, res) => {
  const { userText } = req.body;

  try {
    const prompt = `
      You are a navigation assistant for the blind. 
      Use this map data: ${DEMO_MAP}.
      
      The user just said: "${userText}"
      
      Provide a short, clear, 1-2 sentence direction to help them reach their destination.
      Only give the next immediate step or a high-level summary.
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    res.json({ instruction: text });
  } catch (error) {
    console.error("Gemini Error:", error);
    res.status(500).json({ error: "Failed to generate navigation" });
  }
});

module.exports = router;
