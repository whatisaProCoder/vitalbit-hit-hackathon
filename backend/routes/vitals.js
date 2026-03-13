const express = require('express');

const router = express.Router();

// Mock telemetry samples (illustrative only until hardware integration is ready).
const mockSamples = [
  { minuteOffset: -55, temperatureC: 98.6, pulseBpm: 76 },
  { minuteOffset: -50, temperatureC: 98.7, pulseBpm: 78 },
  { minuteOffset: -45, temperatureC: 98.8, pulseBpm: 80 },
  { minuteOffset: -40, temperatureC: 99.0, pulseBpm: 82 },
  { minuteOffset: -35, temperatureC: 99.1, pulseBpm: 84 },
  { minuteOffset: -30, temperatureC: 99.3, pulseBpm: 88 },
  { minuteOffset: -25, temperatureC: 99.0, pulseBpm: 86 },
  { minuteOffset: -20, temperatureC: 98.9, pulseBpm: 83 },
  { minuteOffset: -15, temperatureC: 99.2, pulseBpm: 90 },
  { minuteOffset: -10, temperatureC: 99.4, pulseBpm: 92 },
  { minuteOffset: -5, temperatureC: 99.2, pulseBpm: 88 },
  { minuteOffset: 0, temperatureC: 99.0, pulseBpm: 85 }
];

router.get('/mock', (req, res) => {
  const now = Date.now();
  const samples = mockSamples.map((sample, index) => ({
    id: index + 1,
    timestamp: new Date(now + sample.minuteOffset * 60 * 1000).toISOString(),
    temperatureC: sample.temperatureC,
    pulseBpm: sample.pulseBpm
  }));

  res.json({
    source: 'mock-device',
    unit: {
      temperature: 'F',
      pulse: 'bpm'
    },
    samples
  });
});

module.exports = router;
