const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json({ limit: '10mb' })); // Need higher limit for base64 images

// Routes
app.use('/api/navigate', require('./routes/navigate'));
app.use('/api/speech', require('./routes/speech'));
app.use('/api/vision', require('./routes/vision'));  // NEW

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));