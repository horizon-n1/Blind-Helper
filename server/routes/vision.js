const express = require('express');
const router = require('express').Router();
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

// ── Stage 1: Scan video, build real layout ───────────
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
                text: `You are a navigation assistant for a blind person analyzing a walkthrough video of an indoor space.

        YOUR STRICT RULES:
        - Only describe what you can ACTUALLY see in this video. 
        - NEVER invent rooms, distances, or directions you cannot confirm from the video.
        - If you cannot clearly see a room or path, say "unclear" for that part.
        - Distances should be estimated in steps (1 step = about 2.5 feet).
        - All directions must be relative to where the user is currently standing. 
        - NEVER use visual descriptions like colors, signs, or labels.
        - Only describe physical layout: what is connected to what, and how many steps.

        Analyze the video and respond ONLY with this exact JSON format, no extra text:
        {
          "rooms": ["only rooms clearly visible in the video"],
          "summary": "From the starting point: [exact physical directions to each room using steps and turns only. Example: Walking straight 8 steps reaches the living room. Turning left from the start and walking 5 steps reaches the hallway. The bathroom is at the end of that hallway, 6 more steps forward.] Only include paths you can clearly see in the video."
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

// ── Stage 2: Initial directions ──────────────────────
router.post('/navigate', async (req, res) => {
    try {
        const { destination, rooms, summary } = req.body;

        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        const result = await model.generateContent(`
      You are a navigation assistant for a completely blind person.

      YOUR STRICT RULES:
      - NEVER describe anything visual. The user is blind.
      - NEVER mention colors, signs, labels, numbers, or appearances.
      - ONLY use physical movement commands.
      - ONLY use information from the layout below. Do NOT invent paths or distances.
      - If the destination is not in the layout, say: "I could not find that room in the scanned area. Please try another room."
      - Maximum 3 sentences.

      Known layout of this space:
      ${summary}

      Known rooms: ${rooms.join(', ')}
      User wants to go to: ${destination}

      If "${destination}" is in the known rooms, give step-by-step physical directions using only the layout above.
      If it is not found, tell the user clearly.
    `);

        const directions = result.response.text();
        res.json({ directions });

    } catch (err) {
        console.error('Navigation error:', err);
        res.status(500).json({ error: 'Navigation failed' });
    }
});

// ── Stage 3: Real-time obstacle detection + guidance ─
router.post('/guide', async (req, res) => {
    try {
        const { image, destination, rooms, summary, lastInstruction } = req.body;

        if (!image) return res.status(400).json({ error: 'No image provided' });

        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        const result = await model.generateContent([
            {
                text: `You are a real-time navigation and obstacle detection assistant for a completely blind person.

        YOU HAVE TWO JOBS — check in this order:

        JOB 1 — OBSTACLE DETECTION (always check this first):
        Look at the camera frame RIGHT NOW. Are any of these present within 6 feet of the camera?
        - Furniture (chairs, tables, couches, shelves)
        - People or pets
        - Objects on the floor (bags, shoes, cables, rugs edges)
        - Steps or stairs
        - Walls or closed doors directly ahead
        - Any object that could cause a trip or collision

        If YES — immediately say:
        "Stop. [what the obstacle is and where: left, right, or center]. [one action: step left, step right, or wait]"
        Example: "Stop. Chair on the right. Step left."
        Example: "Stop. Step down ahead. Slow down."

        JOB 2 — NAVIGATION (only if no immediate obstacle):
        Use the known layout to give the next physical movement toward the destination.
        
        STRICT RULES FOR BOTH JOBS:
        - NEVER describe visual things (colors, signs, labels, appearances).
        - NEVER invent obstacles that are not clearly visible in the frame.
        - NEVER repeat the last instruction if the scene looks the same.
        - Maximum 10 words total.
        - ONE instruction only.
        - Only use what you can actually see in this camera frame.

        Known layout: ${summary}
        Destination: ${destination}
        Last instruction given: "${lastInstruction || 'none yet'}"
        The user has completed the last instruction. Give only the next one.

        If the user has reached ${destination}, say exactly:
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