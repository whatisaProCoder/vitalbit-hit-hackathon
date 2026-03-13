const express = require('express');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { heightCm, weightKg } = req.body;
    const h = Number(heightCm);
    const w = Number(weightKg);
    if (!h || !w || h <= 0 || w <= 0) {
      return res.status(400).json({ error: 'Valid heightCm and weightKg are required' });
    }

    const bmi = w / ((h / 100) * (h / 100));
    let category = 'Normal';
    if (bmi < 18.5) category = 'Underweight';
    else if (bmi >= 25 && bmi < 30) category = 'Overweight';
    else if (bmi >= 30) category = 'Obese';

    const { rows } = await pool.query(
      `INSERT INTO user_metrics (user_id, metric_type, metric_value, metric_payload)
       VALUES ($1, 'bmi', $2, $3)
       RETURNING id, metric_value, metric_payload, created_at`,
      [req.user.id, bmi, { heightCm: h, weightKg: w, category }]
    );

    res.status(201).json({
      bmi: Number(bmi.toFixed(2)),
      category,
      record: rows[0]
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
