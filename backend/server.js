require('dotenv').config();

const express = require('express');
const cors = require('cors');

const symptomRoutes = require('./routes/symptoms');
const voiceRoutes = require('./routes/voice');
const hospitalsRoutes = require('./routes/hospitals');
const usersRoutes = require('./routes/users');
const authRoutes = require('./routes/auth');
const bmiRoutes = require('./routes/bmi');
const dashboardRoutes = require('./routes/dashboard');
const chatRoutes = require('./routes/chat');
const vitalsRoutes = require('./routes/vitals');
const errorHandler = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(
  cors({
    origin: process.env.ALLOWED_ORIGIN || 'http://localhost:5173'
  })
);
app.use(express.json({ limit: '10mb' }));

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'vitalbit-backend',
    timestamp: new Date().toISOString()
  });
});

app.use('/api/symptoms', symptomRoutes);
app.use('/api/voice', voiceRoutes);
app.use('/api/hospitals', hospitalsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/bmi', bmiRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/vitals', vitalsRoutes);

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`VitalBit backend running on http://localhost:${PORT}`);
});
