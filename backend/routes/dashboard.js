const express = require('express');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/summary', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user.id;

    const [symptomCount, voiceCount, chatCount, latestBmi, recentSymptom, recentVoice] = await Promise.all([
      pool.query('SELECT COUNT(*)::int AS total FROM symptom_queries WHERE user_id = $1', [userId]),
      pool.query('SELECT COUNT(*)::int AS total FROM voice_analysis_results WHERE user_id = $1', [userId]),
      pool.query('SELECT COUNT(*)::int AS total FROM chat_messages WHERE user_id = $1', [userId]),
      pool.query(
        `SELECT metric_value, metric_payload, created_at
         FROM user_metrics WHERE user_id = $1 AND metric_type = 'bmi'
         ORDER BY created_at DESC LIMIT 1`,
        [userId]
      ),
      pool.query(
        `SELECT symptoms_text, prediction_json, created_at
         FROM symptom_queries WHERE user_id = $1
         ORDER BY created_at DESC LIMIT 5`,
        [userId]
      ),
      pool.query(
        `SELECT prediction_json, created_at
         FROM voice_analysis_results WHERE user_id = $1
         ORDER BY created_at DESC LIMIT 5`,
        [userId]
      )
    ]);

    res.json({
      counts: {
        symptomAnalyses: symptomCount.rows[0].total,
        voiceAnalyses: voiceCount.rows[0].total,
        chatMessages: chatCount.rows[0].total
      },
      latestBmi: latestBmi.rows[0] || null,
      recentSymptomAnalyses: recentSymptom.rows,
      recentVoiceAnalyses: recentVoice.rows
    });
  } catch (error) {
    next(error);
  }
});

router.get('/history', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user.id;

    const [symptoms, voice, bmi, chat] = await Promise.all([
      pool.query(
        `SELECT id, symptoms_text, prediction_json, created_at
         FROM symptom_queries WHERE user_id = $1 ORDER BY created_at DESC`,
        [userId]
      ),
      pool.query(
        `SELECT id, audio_path, prediction_json, created_at
         FROM voice_analysis_results WHERE user_id = $1 ORDER BY created_at DESC`,
        [userId]
      ),
      pool.query(
        `SELECT id, metric_value, metric_payload, created_at
         FROM user_metrics WHERE user_id = $1 AND metric_type = 'bmi'
         ORDER BY created_at DESC`,
        [userId]
      ),
      pool.query(
        `SELECT id, role, message, extracted_symptoms, metadata, created_at
         FROM chat_messages WHERE user_id = $1 ORDER BY created_at DESC`,
        [userId]
      )
    ]);

    res.json({
      symptoms: symptoms.rows,
      voice: voice.rows,
      bmi: bmi.rows,
      chat: chat.rows.reverse()
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
