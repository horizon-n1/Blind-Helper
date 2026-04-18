const express = require('express');
const router = express.Router();
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

router.post('/', async (req, res) => {
    try {
        const { image } = req.body;

        if (!image) {
            return res.status(400).json({ error: 'No image provided' });
        }

        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-lite' });

        const prompt = `You are a navigation assistant for a blind person. 
    Look at this image and describe the immediate area in 2-3 short sentences.
    Focus on: obstacles, furniture, doorways, stairs, or hazards.
    Be direct and specific with distances if possible.
    Example: "There is a chair about 3 feet ahead on the left. A doorway is straight ahead approximately 8 feet away."`;

        const result = await model.generateContent([
            prompt,
            {
                inlineData: {
                    mimeType: 'image/jpeg',
                    data: image
                }
            }
        ]);

        const description = result.response.text();
        res.json({ description });

    } catch (err) {
        console.error('Vision error:', err);
        res.status(500).json({ error: 'Vision analysis failed' });
    }
});

module.exports = router;
