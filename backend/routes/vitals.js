const express = require('express');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const VITALS_METRIC_TYPE = 'watch_vitals';
const WATCH_CONNECTION_METRIC_TYPE = 'watch_connection';

function createDemoSamples() {
  const samples = [];
  const now = Date.now();
  for (let i = 0; i < 24; i += 1) {
    const minuteOffset = (23 - i) * 15;
    const wave = Math.sin(i / 3);
    const temperatureC = Number((36.7 + wave * 0.35 + (i % 3 === 0 ? 0.08 : 0)).toFixed(2));
    const pulseBpm = Math.round(74 + wave * 8 + (i % 4 === 0 ? 3 : -1));

    samples.push({
      timestamp: new Date(now - minuteOffset * 60 * 1000).toISOString(),
      temperatureC,
      pulseBpm
    });
  }
  return samples;
}

async function ensureSeedDataIfEmpty(userId) {
  const countResult = await pool.query(
    `SELECT COUNT(*)::int AS count
     FROM user_metrics
     WHERE user_id = $1 AND metric_type = $2`,
    [userId, VITALS_METRIC_TYPE]
  );

  if ((countResult.rows[0]?.count || 0) > 0) {
    return;
  }

  const demoSamples = createDemoSamples();
  for (const sample of demoSamples) {
    await pool.query(
      `INSERT INTO user_metrics (user_id, metric_type, metric_value, metric_payload, created_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        userId,
        VITALS_METRIC_TYPE,
        sample.pulseBpm,
        {
          source: 'smartwatch-demo',
          temperatureC: sample.temperatureC,
          pulseBpm: sample.pulseBpm
        },
        sample.timestamp
      ]
    );
  }
}

router.post('/connect', requireAuth, async (req, res, next) => {
  try {
    const { deviceName = 'VitalBit SmartWatch', deviceCode = '', serialNumber = '' } = req.body || {};
    const cleanedCode = String(deviceCode || '').trim();
    const cleanedSerial = String(serialNumber || '').trim();

    if (!cleanedCode && !cleanedSerial) {
      return res.status(400).json({ error: 'deviceCode or serialNumber is required to connect watch' });
    }

    const payload = {
      deviceName: String(deviceName || 'VitalBit SmartWatch').trim(),
      deviceCode: cleanedCode,
      serialNumber: cleanedSerial,
      status: 'connected',
      connectedAt: new Date().toISOString()
    };

    await pool.query(
      `INSERT INTO user_metrics (user_id, metric_type, metric_value, metric_payload)
       VALUES ($1, $2, $3, $4)`,
      [req.user.id, WATCH_CONNECTION_METRIC_TYPE, 1, payload]
    );

    await ensureSeedDataIfEmpty(req.user.id);

    res.status(201).json({
      message: 'Smart watch connected successfully',
      watch: payload
    });
  } catch (error) {
    next(error);
  }
});

router.get('/status', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT metric_payload, created_at
       FROM user_metrics
       WHERE user_id = $1 AND metric_type = $2
       ORDER BY created_at DESC
       LIMIT 1`,
      [req.user.id, WATCH_CONNECTION_METRIC_TYPE]
    );

    if (!rows.length) {
      return res.json({ connected: false, watch: null });
    }

    const watchPayload = rows[0].metric_payload || {};
    return res.json({
      connected: true,
      watch: {
        ...watchPayload,
        lastConnectionRecordAt: rows[0].created_at
      }
    });
  } catch (error) {
    next(error);
  }
});

router.post('/ingest', requireAuth, async (req, res, next) => {
  try {
    const { temperatureC, pulseBpm, timestamp } = req.body || {};
    const parsedTemperature = Number(temperatureC);
    const parsedPulse = Number(pulseBpm);

    if (!Number.isFinite(parsedTemperature) || !Number.isFinite(parsedPulse)) {
      return res.status(400).json({ error: 'temperatureC and pulseBpm are required numeric values' });
    }

    if (parsedTemperature < 30 || parsedTemperature > 45) {
      return res.status(400).json({ error: 'temperatureC out of expected range (30-45)' });
    }

    if (parsedPulse < 30 || parsedPulse > 220) {
      return res.status(400).json({ error: 'pulseBpm out of expected range (30-220)' });
    }

    const createdAt = timestamp ? new Date(timestamp) : new Date();
    if (Number.isNaN(createdAt.getTime())) {
      return res.status(400).json({ error: 'timestamp must be a valid date-time string' });
    }

    await pool.query(
      `INSERT INTO user_metrics (user_id, metric_type, metric_value, metric_payload, created_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        req.user.id,
        VITALS_METRIC_TYPE,
        parsedPulse,
        {
          source: 'smartwatch',
          temperatureC: parsedTemperature,
          pulseBpm: parsedPulse
        },
        createdAt.toISOString()
      ]
    );

    res.status(201).json({ message: 'Vital sample recorded' });
  } catch (error) {
    next(error);
  }
});

router.get('/trends', requireAuth, async (req, res, next) => {
  try {
    const parsedLimit = Number(req.query.limit || 48);
    const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 6), 500) : 48;

    const { rows } = await pool.query(
      `SELECT id, created_at, metric_payload
       FROM user_metrics
       WHERE user_id = $1 AND metric_type = $2
       ORDER BY created_at DESC
       LIMIT $3`,
      [req.user.id, VITALS_METRIC_TYPE, limit]
    );

    const samples = rows
      .slice()
      .reverse()
      .map((row) => {
        const payload = row.metric_payload || {};
        return {
          id: row.id,
          timestamp: row.created_at,
          temperatureC: Number(payload.temperatureC),
          pulseBpm: Number(payload.pulseBpm)
        };
      })
      .filter((sample) => Number.isFinite(sample.temperatureC) && Number.isFinite(sample.pulseBpm));

    res.json({
      source: 'connected-smartwatch',
      connected: true,
      unit: {
        temperature: 'C',
        pulse: 'bpm'
      },
      samples
    });
  } catch (error) {
    next(error);
  }
});

router.get('/mock', (req, res) => {
  const now = Date.now();
  const samples = createDemoSamples().map((sample, index) => ({
    id: index + 1,
    timestamp: sample.timestamp,
    temperatureC: sample.temperatureC,
    pulseBpm: sample.pulseBpm
  }));

  res.json({
    source: 'mock-device',
    unit: {
      temperature: 'C',
      pulse: 'bpm'
    },
    samples
  });
});

module.exports = router;
