const express = require('express');
const pool = require('../db/pool');

const router = express.Router();

router.post('/', async (req, res, next) => {
  try {
    const { name, language = 'en' } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'name is required' });
    }

    const { rows } = await pool.query(
      `INSERT INTO users (name, language)
       VALUES ($1, $2)
       RETURNING id, name, language, created_at`,
      [name, language]
    );

    res.status(201).json(rows[0]);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
