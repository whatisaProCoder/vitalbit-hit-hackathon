const express = require('express');
const axios = require('axios');
const pool = require('../db/pool');
const { optionalAuth } = require('../middleware/auth');

const router = express.Router();
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

router.post('/analyze', optionalAuth, async (req, res, next) => {
  try {
    const { userId = null, symptoms, symptomDays = null } = req.body;
    const resolvedUserId = req.user?.id || userId;

    if (!symptoms || typeof symptoms !== 'string') {
      return res.status(400).json({ error: 'symptoms is required and must be a string' });
    }

    let parsedSymptomDays = null;
    if (symptomDays !== null && symptomDays !== undefined && String(symptomDays).trim() !== '') {
      parsedSymptomDays = Number(symptomDays);
      if (!Number.isInteger(parsedSymptomDays) || parsedSymptomDays < 1 || parsedSymptomDays > 180) {
        return res.status(400).json({ error: 'symptomDays must be an integer between 1 and 180' });
      }
    }

    let storedAge = null;
    if (resolvedUserId) {
      const ageResult = await pool.query('SELECT age FROM users WHERE id = $1', [resolvedUserId]);
      storedAge = ageResult.rows[0]?.age ?? null;
    }

    const { data } = await axios.post(`${AI_SERVICE_URL}/predict/symptoms`, {
      symptoms,
      age: storedAge,
      symptomDays: parsedSymptomDays
    });

    try {
      await pool.query(
        `INSERT INTO symptom_queries (user_id, symptoms_text, prediction_json)
         VALUES ($1, $2, $3)`,
        [resolvedUserId, symptoms, data]
      );
    } catch (dbError) {
      console.warn('[SYMPTOMS DB LOG FAILED]', dbError.message);
    }

    res.json(data);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
