const express = require('express');
const cors = require('cors');
const fs = require('fs');
require('dotenv').config();
const path = require('path');

if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');

const app = express();
app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json({ limit: '100mb' }));

app.use('/api/navigate', require('./routes/navigate'));
app.use('/api/speech', require('./routes/speech'));
app.use('/api/vision', require('./routes/vision'));

const PORT = process.env.PORT || 3001;
const server = app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// Increase timeout for large video uploads
server.timeout = 120000; // 2 minutes

// Clean up any leftover files from previous crashed sessions
const uploadFiles = fs.readdirSync('uploads');
uploadFiles.forEach(file => {
  fs.unlinkSync(path.join('uploads', file));
});