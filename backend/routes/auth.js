const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db/pool');
const { requireAuth, JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

const createAuthToken = (user) =>
  jwt.sign(
    { id: user.id, name: user.name, age: user.age, phone: user.phone },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

const mapUser = (user) => ({
  id: user.id,
  name: user.name,
  age: user.age,
  gender: user.gender,
  address: user.address,
  postalCode: user.postal_code,
  phone: user.phone,
  language: user.language,
  created_at: user.created_at
});

router.post('/register', async (req, res, next) => {
  try {
    const {
      name,
      password,
      age,
      gender = null,
      address = null,
      postalCode = null,
      phone = null,
      language = 'en'
    } = req.body;
    if (!name || !password || !phone || !gender || !address || !postalCode || age === undefined || age === null || String(age).trim() === '') {
      return res.status(400).json({ error: 'name, age, gender, address, postalCode, phone and password are required' });
    }

    const parsedAge = Number(age);
    if (!Number.isInteger(parsedAge) || parsedAge < 0 || parsedAge > 120) {
      return res.status(400).json({ error: 'age must be an integer between 0 and 120' });
    }

    const normalizedPhone = String(phone).trim();
    const existing = await pool.query('SELECT id FROM users WHERE phone = $1', [normalizedPhone]);
    if (existing.rowCount > 0) {
      return res.status(409).json({ error: 'Phone already in use' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      `INSERT INTO users (name, password_hash, age, gender, address, postal_code, phone, language)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, name, age, gender, address, postal_code, phone, language, created_at`,
      [
        name,
        passwordHash,
        parsedAge,
        gender,
        address,
        postalCode,
        normalizedPhone,
        language
      ]
    );

    const user = rows[0];
    const token = createAuthToken(user);

    res.status(201).json({
      token,
      user: mapUser(user)
    });
  } catch (error) {
    next(error);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const { phone, password } = req.body;
    if (!phone || !password) {
      return res.status(400).json({ error: 'phone and password are required' });
    }

    const normalizedPhone = String(phone).trim();
    const { rows } = await pool.query(
      `SELECT id, name, age, gender, address, postal_code, phone, language, password_hash, created_at
       FROM users WHERE phone = $1`,
      [normalizedPhone]
    );

    if (!rows.length) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password_hash || '');
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = createAuthToken(user);
    const safeUser = mapUser(user);

    res.json({ token, user: safeUser });
  } catch (error) {
    next(error);
  }
});

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, age, gender, address, postal_code, phone, language, created_at
       FROM users WHERE id = $1`,
      [req.user.id]
    );

    if (!rows.length) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = rows[0];
    res.json(mapUser(user));
  } catch (error) {
    next(error);
  }
});

router.put('/me', requireAuth, async (req, res, next) => {
  try {
    const {
      name,
      age,
      gender,
      address,
      postalCode,
      phone,
      language
    } = req.body;

    if (!name || !String(name).trim() || !phone || !String(phone).trim() || !gender || !address || !postalCode) {
      return res.status(400).json({ error: 'name, age, gender, address, postalCode and phone are required' });
    }

    const parsedAge = Number(age);
    if (!Number.isInteger(parsedAge) || parsedAge < 0 || parsedAge > 120) {
      return res.status(400).json({ error: 'age must be an integer between 0 and 120' });
    }

    const normalizedPhone = String(phone).trim();
    const phoneExists = await pool.query(
      'SELECT id FROM users WHERE phone = $1 AND id <> $2',
      [normalizedPhone, req.user.id]
    );
    if (phoneExists.rowCount > 0) {
      return res.status(409).json({ error: 'Phone already in use' });
    }

    const { rows } = await pool.query(
      `UPDATE users
       SET name = $2,
           age = $3,
           gender = $4,
           address = $5,
           postal_code = $6,
           phone = $7,
           language = $8
       WHERE id = $1
      RETURNING id, name, age, gender, address, postal_code, phone, language, created_at`,
      [
        req.user.id,
        String(name).trim(),
        parsedAge,
        gender,
        address,
        postalCode,
        normalizedPhone,
        language || 'en'
      ]
    );

    if (!rows.length) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = rows[0];
    const token = createAuthToken(user);

    res.json({
      token,
      user: mapUser(user)
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
