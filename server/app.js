const express = require('express');
const cors = require('cors');
require('dotenv').config();

const navigateRouter = require('./routes/navigate');
const speechRouter = require('./routes/speech');

const app = express();
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/navigate', navigateRouter);
app.use('/api/speech', speechRouter);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
