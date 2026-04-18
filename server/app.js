const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');

fs.readdirSync('uploads').forEach(file => {
  fs.unlinkSync(path.join('uploads', file));
});

const app = express();
app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json({ limit: '100mb' }));

app.use('/api/navigate', require('./routes/navigate'));
app.use('/api/vision', require('./routes/vision'));
app.use('/api/speech', require('./routes/speech'));   // ← this was missing

const PORT = process.env.PORT || 3001;
const server = app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
server.timeout = 120000;