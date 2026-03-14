const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const crypto = require('crypto');
const pool = require('../db/pool');
const { requireAuth, JWT_SECRET } = require('../middleware/auth');

const router = express.Router();
const GOOGLE_AUTH_CLIENT_ID = process.env.GOOGLE_AUTH_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || '';
const googleClient = GOOGLE_AUTH_CLIENT_ID ? new OAuth2Client(GOOGLE_AUTH_CLIENT_ID) : null;
const GOOGLE_ALLOWED_ISSUERS = new Set(['accounts.google.com', 'https://accounts.google.com']);
const GOOGLE_NONCE_TTL_MS = 10 * 60 * 1000;
const googleNonceStore = new Map();

function createGoogleNonce() {
  return crypto.randomBytes(24).toString('hex');
}

function cleanupExpiredGoogleNonces() {
  const now = Date.now();
  for (const [nonce, expiresAt] of googleNonceStore.entries()) {
    if (expiresAt <= now) {
      googleNonceStore.delete(nonce);
    }
  }
}

function issueGoogleNonce() {
  cleanupExpiredGoogleNonces();
  const nonce = createGoogleNonce();
  googleNonceStore.set(nonce, Date.now() + GOOGLE_NONCE_TTL_MS);
  return nonce;
}

function consumeGoogleNonce(nonce) {
  cleanupExpiredGoogleNonces();
  if (!nonce || typeof nonce !== 'string') return false;
  const expiresAt = googleNonceStore.get(nonce);
  if (!expiresAt || expiresAt <= Date.now()) {
    googleNonceStore.delete(nonce);
    return false;
  }
  googleNonceStore.delete(nonce);
  return true;
}

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
  email: user.email,
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
      `SELECT id, name, age, gender, address, postal_code, phone, email, language, password_hash, created_at
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

router.post('/google', async (req, res, next) => {
  try {
    const { credential, nonce } = req.body;
    if (!credential) {
      return res.status(400).json({ error: 'Google credential is required' });
    }

    if (!nonce || !consumeGoogleNonce(nonce)) {
      return res.status(401).json({ error: 'Invalid or expired Google authorization nonce' });
    }

    if (!googleClient || !GOOGLE_AUTH_CLIENT_ID) {
      return res.status(500).json({ error: 'Google authorization is not configured on server' });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: GOOGLE_AUTH_CLIENT_ID
    });
    const payload = ticket.getPayload();
    const tokenIssuer = String(payload?.iss || '').trim();
    const tokenNonce = String(payload?.nonce || '').trim();

    const googleId = String(payload?.sub || '').trim();
    const email = payload?.email ? String(payload.email).trim().toLowerCase() : null;
    const name = String(payload?.name || '').trim() || 'Google User';
    const emailVerified = payload?.email_verified === true;

    if (!googleId || !email || !emailVerified) {
      return res.status(401).json({ error: 'Google account email must be verified' });
    }

    if (!GOOGLE_ALLOWED_ISSUERS.has(tokenIssuer)) {
      return res.status(401).json({ error: 'Untrusted Google token issuer' });
    }

    if (!tokenNonce || tokenNonce !== nonce) {
      return res.status(401).json({ error: 'Google token nonce mismatch' });
    }

    if (email.length > 255 || name.length > 120) {
      return res.status(401).json({ error: 'Invalid Google token payload' });
    }

    const byGoogleId = await pool.query(
      `SELECT id, name, age, gender, address, postal_code, phone, email, language, created_at
       FROM users
       WHERE google_id = $1
       LIMIT 1`,
      [googleId]
    );

    const byEmail = await pool.query(
      `SELECT id, name, age, gender, address, postal_code, phone, email, google_id, language, created_at
       FROM users
       WHERE email = $1
       LIMIT 1`,
      [email]
    );

    let user;
    if (byGoogleId.rowCount > 0) {
      const { rows } = await pool.query(
        `UPDATE users
         SET name = COALESCE(NULLIF($2, ''), name),
             email = COALESCE($3, email),
             google_id = COALESCE($4, google_id),
             language = COALESCE(language, 'en')
         WHERE id = $1
         RETURNING id, name, age, gender, address, postal_code, phone, email, language, created_at`,
        [byGoogleId.rows[0].id, name, email, googleId]
      );
      user = rows[0];
    } else if (byEmail.rowCount > 0) {
      const emailUser = byEmail.rows[0];
      if (emailUser.google_id && emailUser.google_id !== googleId) {
        return res.status(409).json({ error: 'Email already linked with another Google account' });
      }

      const { rows } = await pool.query(
        `UPDATE users
         SET name = COALESCE(NULLIF($2, ''), name),
             google_id = COALESCE($3, google_id),
             language = COALESCE(language, 'en')
         WHERE id = $1
         RETURNING id, name, age, gender, address, postal_code, phone, email, language, created_at`,
        [emailUser.id, name, googleId]
      );
      user = rows[0];
    } else {
      const { rows } = await pool.query(
        `INSERT INTO users (name, email, google_id, language)
         VALUES ($1, $2, $3, 'en')
         RETURNING id, name, age, gender, address, postal_code, phone, email, language, created_at`,
        [name, email, googleId]
      );
      user = rows[0];
    }

    const token = createAuthToken(user);
    res.json({ token, user: mapUser(user) });
  } catch (error) {
    next(error);
  }
});

router.get('/google-config', (_req, res) => {
  if (!GOOGLE_AUTH_CLIENT_ID) {
    return res.json({ enabled: false, clientId: '', nonce: '' });
  }

  return res.json({
    enabled: true,
    clientId: GOOGLE_AUTH_CLIENT_ID,
    nonce: issueGoogleNonce()
  });
});

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, age, gender, address, postal_code, phone, email, language, created_at
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
      RETURNING id, name, age, gender, address, postal_code, phone, email, language, created_at`,
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
