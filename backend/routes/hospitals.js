const express = require('express');
const axios = require('axios');

const router = express.Router();

const fallbackHospitals = [
  {
    id: 'h1',
    name: 'Rural Community Health Center',
    lat: 22.5726,
    lon: 88.3639,
    contact: '+91-9876543210'
  },
  {
    id: 'h2',
    name: 'District Government Hospital',
    lat: 22.5826,
    lon: 88.3739,
    contact: '+91-9988776655'
  },
  {
    id: 'h3',
    name: 'Primary Care Clinic',
    lat: 22.5626,
    lon: 88.3539,
    contact: '+91-9123456789'
  }
];

router.get('/', async (req, res) => {
  const { lat, lon, address, radius = 5000 } = req.query;

  let searchLat = lat ? Number(lat) : null;
  let searchLon = lon ? Number(lon) : null;

  if ((searchLat === null || searchLon === null) && address) {
    try {
      const { data } = await axios.get('https://nominatim.openstreetmap.org/search', {
        params: {
          q: String(address),
          format: 'jsonv2',
          limit: 1
        },
        headers: {
          'User-Agent': 'vitalbit-hospital-locator/1.0'
        },
        timeout: 15000
      });

      if (Array.isArray(data) && data.length > 0) {
        searchLat = Number(data[0].lat);
        searchLon = Number(data[0].lon);
      }
    } catch {
      // Ignore geocode failure and allow fallback below.
    }
  }

  if (searchLat === null || searchLon === null || Number.isNaN(searchLat) || Number.isNaN(searchLon)) {
    return res.json({ hospitals: fallbackHospitals, source: 'fallback' });
  }

  const overpassQuery = `
    [out:json][timeout:25];
    (
      node["amenity"="hospital"](around:${Number(radius)},${searchLat},${searchLon});
      node["amenity"="clinic"](around:${Number(radius)},${searchLat},${searchLon});
    );
    out body;
  `;

  try {
    const { data } = await axios.post('https://overpass-api.de/api/interpreter', overpassQuery, {
      headers: { 'Content-Type': 'text/plain' }
    });

    const hospitals = (data.elements || []).map((item) => ({
      id: String(item.id),
      name: item.tags?.name || 'Healthcare Facility',
      lat: item.lat,
      lon: item.lon,
      contact: item.tags?.phone || 'Contact unavailable'
    }));

    res.json({
      hospitals: hospitals.length ? hospitals : fallbackHospitals,
      source: address ? 'overpass-address' : 'overpass',
      center: { lat: searchLat, lon: searchLon }
    });
  } catch (error) {
    res.json({
      hospitals: fallbackHospitals,
      source: 'fallback',
      center: { lat: searchLat, lon: searchLon }
    });
  }
});

module.exports = router;
