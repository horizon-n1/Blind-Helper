const express = require('express');
const router = express.Router();
const multer = require('multer');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { GoogleAIFileManager } = require('@google/generative-ai/server');
const fs = require('fs');

const upload = multer({ dest: 'uploads/' });
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const fileManager = new GoogleAIFileManager(process.env.GEMINI_API_KEY);

const waitForFile = async (fileName) => {
    let file = await fileManager.getFile(fileName);
    while (file.state === 'PROCESSING') {
        await new Promise(r => setTimeout(r, 3000));
        file = await fileManager.getFile(fileName);
    }
    if (file.state === 'FAILED') throw new Error('File processing failed');
    return file;
};

// ── Scan video, build room map + waypoint graph ───────
router.post('/scan', upload.single('video'), async (req, res) => {
    const videoPath = req.file?.path;

    try {
        const mimeType = req.file.mimetype;

        const uploadResult = await fileManager.uploadFile(videoPath, {
            mimeType,
            displayName: req.file.originalname
        });

        const file = await waitForFile(uploadResult.file.name);
        if (videoPath && fs.existsSync(videoPath)) fs.unlinkSync(videoPath);

        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        const result = await model.generateContent([
            {
                fileData: {
                    mimeType: file.mimeType,
                    fileUri: file.uri
                }
            },
            {
                text: `You are a navigation assistant for a blind person analyzing a walkthrough video.

        STRICT RULES:
        - Only describe what you can ACTUALLY see in this video
        - NEVER invent rooms, distances, or connections not visible
        - Distances in steps only (1 step = about 2.5 feet)
        - NEVER use visual descriptions like colors, signs, or labels
        - If something is unclear mark it as "unclear"
        - Every room must appear as both a waypoint and in the rooms array
        - Every connection must have a reverse connection

        Respond ONLY with this exact JSON, no extra text:
        {
          "rooms": ["only rooms clearly visible in the video"],
          "waypoints": [
            {
              "id": "wp1",
              "name": "starting point",
              "connections": [
                { "to": "wp2", "steps": 5, "direction": "forward" }
              ]
            },
            {
              "id": "wp2",
              "name": "hallway junction",
              "connections": [
                { "to": "wp1", "steps": 5, "direction": "back" },
                { "to": "wp3", "steps": 3, "direction": "left" }
              ]
            }
          ],
          "summary": "From the starting point: [exact physical directions to each room using steps and turns only. Only include paths clearly visible in the video.]"
        }`
            }
        ]);

        const text = result.response.text();
        const clean = text.replace(/```json|```/g, '').trim();
        const data = JSON.parse(clean);

        res.json(data);

    } catch (err) {
        if (videoPath && fs.existsSync(videoPath)) fs.unlinkSync(videoPath);
        console.error('Vision scan error:', err);
        res.status(500).json({ error: 'Room scan failed' });
    }
});

module.exports = router;