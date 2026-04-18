const express = require('express');
const router = express.Router();
const axios = require('axios');

router.post('/', async (req, res) => {
  const { text } = req.body;

  if (!text) {
    return res.status(400).json({ error: "Text is required for speech synthesis." });
  }

  try {
    const response = await axios({
      method: 'post',
      url: `https://api.elevenlabs.io/v1/text-to-speech/${process.env.ELEVENLABS_VOICE_ID}/stream`,
      data: {
        text: text,
        model_id: "eleven_flash_v2_5",
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.8,
        }
      },
      headers: {
        'xi-api-key': process.env.ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
        'accept': 'audio/mpeg'
      },
      responseType: 'stream' // Crucial for low latency
    });

    // Pipe the ElevenLabs stream directly to the client response
    res.set('Content-Type', 'audio/mpeg');
    response.data.pipe(res);

  } catch (error) {
    console.error("ElevenLabs Error:", error.response ? error.response.data : error.message);
    res.status(500).json({ error: "Failed to generate speech." });
  }
});

module.exports = router;
