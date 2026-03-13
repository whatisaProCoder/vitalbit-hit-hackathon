const express = require('express');
const axios = require('axios');
const multer = require('multer');
const FormData = require('form-data');
const pool = require('../db/pool');
const { optionalAuth } = require('../middleware/auth');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

router.post('/analyze', optionalAuth, upload.single('audio'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'audio file is required' });
    }

    const form = new FormData();
    form.append('file', req.file.buffer, {
      filename: req.file.originalname || 'voice.webm',
      contentType: req.file.mimetype || 'audio/webm'
    });

    const aiResponse = await axios.post(`${AI_SERVICE_URL}/predict/voice`, form, {
      headers: form.getHeaders()
    });

    const userId = req.user?.id || req.body.userId || null;
    try {
      await pool.query(
        `INSERT INTO voice_analysis_results (user_id, audio_path, prediction_json)
         VALUES ($1, $2, $3)`,
        [userId, `memory://${req.file.originalname || 'voice.webm'}`, aiResponse.data]
      );
    } catch (dbError) {
      console.warn('[VOICE DB LOG FAILED]', dbError.message);
    }

    res.json(aiResponse.data);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
