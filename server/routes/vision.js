const express = require('express');
const router = express.Router();
const multer = require('multer');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { GoogleAIFileManager } = require('@google/generative-ai/server');
const fs = require('fs');

const upload = multer({ dest: 'uploads/' });
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const fileManager = new GoogleAIFileManager(process.env.GEMINI_API_KEY);

// ── Helper: wait for file to finish processing ────────
const waitForFile = async (fileName) => {
    let file = await fileManager.getFile(fileName);
    while (file.state === 'PROCESSING') {
        await new Promise(r => setTimeout(r, 3000));
        file = await fileManager.getFile(fileName);
    }
    if (file.state === 'FAILED') throw new Error('File processing failed');
    return file;
};

// ── Stage 1: Upload video, detect rooms ──────────────
// ── Stage 1: Upload video, detect rooms ──────────────
router.post('/scan', upload.single('video'), async (req, res) => {
    const videoPath = req.file?.path;

    try {
        const mimeType = req.file.mimetype;

        const uploadResult = await fileManager.uploadFile(videoPath, {
            mimeType,
            displayName: req.file.originalname
        });

        const file = await waitForFile(uploadResult.file.name);

        // Delete local file immediately after Gemini has it
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
                text: `You are a navigation assistant for a blind person.
        Watch this video carefully and map out the physical layout of this space.
        Identify all rooms and how they physically connect.
        
        Respond ONLY with a JSON object in this exact format, no extra text:
        {
          "rooms": ["Kitchen", "Living Room", "Bathroom"],
          "summary": "Describe the layout using only physical directions and steps. Example: From the entrance, walking straight 10 steps leads to the living room. Turning left from the entrance leads to a hallway. The bathroom is at the end of that hallway, about 8 steps."
        }`
            }
        ]);

        const text = result.response.text();
        const clean = text.replace(/```json|```/g, '').trim();
        const data = JSON.parse(clean);

        res.json(data);

    } catch (err) {
        // Always clean up local file even if something crashed
        if (videoPath && fs.existsSync(videoPath)) fs.unlinkSync(videoPath);
        console.error('Vision scan error:', err);
        res.status(500).json({ error: 'Room scan failed' });
    }
});


router.post('/navigate', async (req, res) => {
    try {
        const { destination, rooms, summary } = req.body;

        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        const result = await model.generateContent(`
      You are a navigation assistant for a completely blind person.
      
      STRICT RULES:
      - NEVER describe anything visually. The user cannot see.
      - NEVER mention colors, signs, labels, or appearances.
      - ONLY use physical movement commands: steps forward, turn left, turn right, stop.
      - Keep it under 3 sentences.
      - Speak directly to the user.

      Space layout: ${summary}
      Rooms: ${rooms.join(', ')}
      Destination: ${destination}

      Give opening physical directions to start moving toward the ${destination}.
    `);

        const directions = result.response.text();
        res.json({ directions });

    } catch (err) {
        console.error('Navigation error:', err);
        res.status(500).json({ error: 'Navigation failed' });
    }
});

router.post('/guide', async (req, res) => {
    try {
        const { image, destination, rooms, summary, lastInstruction } = req.body;

        if (!image) return res.status(400).json({ error: 'No image provided' });

        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        const result = await model.generateContent([
            {
                text: `You are a navigation assistant guiding a completely blind person using only physical movement commands.

        STRICT RULES:
        - NEVER describe what you see visually. The user is blind and cannot see anything.
        - NEVER mention colors, signs, labels, doors by appearance, or anything visual.
        - ONLY give physical body movement instructions.
        - Use ONLY these types of commands:
          * "Take X steps forward"
          * "Turn left"
          * "Turn right"  
          * "Turn around"
          * "Stop"
          * "Slow down, obstacle ahead"
          * "You have arrived at your destination"
        - Maximum 8 words per instruction.
        - Give only ONE instruction at a time.
        - Base your instruction on the physical space you see in the camera, translated into body movements.

        Space layout from initial scan: ${summary}
        Destination: ${destination}
        Last instruction given: "${lastInstruction || 'none yet'}"
        The user has already completed the last instruction. Give the NEXT physical movement only.`
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

        res.json({ instruction, arrived });

    } catch (err) {
        console.error('Guide error:', err);
        res.status(500).json({ error: 'Guidance failed' });
    }
});

module.exports = router;