const express = require('express');
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
const { GoogleGenAI } = require('@google/genai');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

const llmProvider = (process.env.LLM_PROVIDER || 'openai').toLowerCase();
const llmApiUrl = process.env.LLM_API_URL || 'https://api.openai.com/v1/chat/completions';
const llmModel = process.env.LLM_MODEL || 'gpt-4o-mini';
const llmApiKey = process.env.LLM_API_KEY;
const geminiApiKey = process.env.GEMINI_API_KEY || process.env.LLM_API_KEY;
const geminiClient = geminiApiKey ? new GoogleGenAI({ apiKey: geminiApiKey }) : null;
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

const knownSymptoms = [
  'fever',
  'dry cough',
  'fatigue',
  'shortness of breath',
  'headache',
  'sore throat',
  'chills',
  'chest pain',
  'wheezing',
  'nausea',
  'joint pain',
  'loss of smell',
  'persistent cough',
  'dizziness',
  'sweating',
  'runny nose',
  'stuffy nose',
  'body ache',
  'muscle pain',
  'abdominal pain',
  'diarrhea',
  'vomiting',
  'loss of appetite',
  'rash',
  'itching',
  'night sweats',
  'weight loss',
  'rapid heartbeat',
  'palpitations',
  'blurred vision',
  'frequent urination',
  'burning urination',
  'dehydration',
  'ear pain',
  'sinus pressure',
  'confusion',
  'fainting',
  'swollen glands',
  'back pain',
  'constipation',
  'chest tightness',
  'phlegm',
  'hoarseness'
];

function extractSymptoms(text) {
  const msg = String(text || '').toLowerCase();
  return knownSymptoms.filter((symptom) => msg.includes(symptom));
}

function normalizeSymptoms(symptoms) {
  return Array.from(
    new Set(
      (symptoms || [])
        .map((item) => String(item || '').trim().toLowerCase())
        .filter(Boolean)
    )
  );
}

function parseJsonArray(text) {
  const raw = String(text || '').trim();
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) return [];
    try {
      const parsed = JSON.parse(match[0]);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
}

async function transcribeAudioWithGemini(file) {
  if (!geminiClient || !file?.buffer?.length) {
    return '';
  }

  const candidateModels = Array.from(
    new Set([
      process.env.GEMINI_STT_MODEL,
      'gemini-2.5-flash',
      'gemini-2.0-flash',
      'gemini-1.5-flash',
      llmModel
    ].filter(Boolean))
  );

  const audioPart = {
    inlineData: {
      mimeType: file.mimetype || 'audio/webm',
      data: file.buffer.toString('base64')
    }
  };

  const promptPart = {
    text: [
      'Transcribe this audio to plain text.',
      'Return only the transcript.',
      'Do not add labels, notes, or punctuation not present in speech.'
    ].join(' ')
  };

  for (const modelName of candidateModels) {
    try {
      const response = await geminiClient.models.generateContent({
        model: modelName,
        contents: [
          {
            role: 'user',
            parts: [promptPart, audioPart]
          }
        ],
        config: {
          temperature: 0
        }
      });

      const transcript = String(response?.text || '').trim();
      if (transcript) {
        return transcript;
      }
    } catch (error) {
      const status = error?.status || error?.response?.status;
      const message = String(error?.message || '').toLowerCase();
      const isNotFound =
        status === 404 ||
        message.includes('404') ||
        message.includes('not_found') ||
        message.includes('not found') ||
        message.includes('is not found');

      if (isNotFound) {
        continue;
      }

      console.warn('[GEMINI STT FALLBACK]', modelName, error.message);
    }
  }

  return '';
}

async function extractSymptomsWithLlm(text) {
  const baseSymptoms = extractSymptoms(text);

  if (!geminiClient || !(llmProvider === 'google' || llmProvider === 'gemini')) {
    return normalizeSymptoms(baseSymptoms);
  }

  const prompt = [
    'Extract symptom keywords from the user text.',
    'Return ONLY a JSON array of lowercase symptom strings.',
    `Prefer matching these known symptoms when possible: ${knownSymptoms.join(', ')}`,
    `User text: ${text}`
  ].join('\n');

  try {
    const candidateModels = Array.from(
      new Set([
        llmModel,
        'gemini-2.5-flash-preview',
        'gemini-2.5-flash',
        'gemini-2.0-flash',
        'gemini-1.5-flash'
      ])
    );

    for (const modelName of candidateModels) {
      try {
        const response = await geminiClient.models.generateContent({
          model: modelName,
          contents: prompt,
          config: {
            temperature: 0
          }
        });

        const modelText = String(response?.text || '').trim();
        const parsed = parseJsonArray(modelText);
        const merged = normalizeSymptoms([...baseSymptoms, ...parsed]);
        if (merged.length) return merged;
      } catch (error) {
        const status = error?.status || error?.response?.status;
        if (status === 404) continue;
        throw error;
      }
    }
  } catch (error) {
    console.warn('[SYMPTOM KEYWORD FALLBACK]', error.message);
  }

  return normalizeSymptoms(baseSymptoms);
}

async function getSymptomPrediction(symptoms, originalText, age = null) {
  const symptomText = symptoms.length ? symptoms.join(' ') : String(originalText || '');
  if (!symptomText.trim()) return null;

  try {
    const { data } = await axios.post(`${AI_SERVICE_URL}/predict/symptoms`, {
      symptoms: symptomText,
      age
    });
    return data;
  } catch (error) {
    console.warn('[SYMPTOM MODEL FALLBACK]', error.message);
    return null;
  }
}

async function getUserAge(userId) {
  if (!userId) return null;
  try {
    const { rows } = await pool.query('SELECT age FROM users WHERE id = $1', [userId]);
    return rows[0]?.age ?? null;
  } catch (error) {
    console.warn('[USER AGE LOOKUP FALLBACK]', error.message);
    return null;
  }
}

async function getVoicePrediction(file) {
  if (!file) return null;

  const form = new FormData();
  form.append('file', file.buffer, {
    filename: file.originalname || 'voice.webm',
    contentType: file.mimetype || 'audio/webm'
  });

  try {
    const { data } = await axios.post(`${AI_SERVICE_URL}/predict/voice`, form, {
      headers: form.getHeaders(),
      timeout: 30000
    });
    return data;
  } catch (error) {
    console.warn('[VOICE MODEL FALLBACK]', error.message);
    return null;
  }
}

function buildAssistantReply(symptoms) {
  if (!symptoms.length) {
    return 'I noted your message. You can share specific symptoms like fever, cough, chest pain, or fatigue for better analysis.';
  }

  const symptomText = symptoms.slice(0, 6).join(', ');
  return `I detected these symptoms from your message: ${symptomText}. You can run Symptom Analysis for a ranked prediction and view nearby hospitals if risk is high.`;
}

async function generateLlmReply({ message, extractedSymptoms, recentMessages, symptomPrediction }) {
  if (!llmApiKey) {
    return null;
  }

  const systemPrompt = [
    'You are VitalBit, a healthcare assistant for early guidance.',
    'Keep responses concise, calm, and practical.',
    'Do not provide a final diagnosis; suggest when to seek urgent care.',
    'Use plain language and short bullet points when useful.',
    'If symptoms imply emergency risk (severe chest pain, trouble breathing, confusion, fainting), clearly advise emergency care immediately.'
  ].join(' ');

  const historyForLlm = recentMessages.map((item) => ({
    role: item.role === 'assistant' ? 'assistant' : 'user',
    content: item.message
  }));

  const userPayload = [
    `User message: ${message}`,
    `Extracted symptoms: ${extractedSymptoms.length ? extractedSymptoms.join(', ') : 'none'}`,
    symptomPrediction
      ? `Symptom model top predictions: ${JSON.stringify((symptomPrediction.predictions || []).slice(0, 3))}`
      : 'Symptom model top predictions: unavailable',
    'Respond with: (1) what you understood, (2) immediate self-care, (3) red flags, (4) suggested next step inside VitalBit.'
  ].join('\n');

  if (llmProvider === 'google' || llmProvider === 'gemini') {
    if (!geminiClient) {
      return null;
    }

    const historyText = recentMessages
      .map((item) => `${item.role === 'assistant' ? 'Assistant' : 'User'}: ${item.message}`)
      .join('\n');

    const fullPrompt = [
      systemPrompt,
      historyText ? `Conversation so far:\n${historyText}` : '',
      userPayload
    ]
      .filter(Boolean)
      .join('\n\n');

    const candidateModels = Array.from(
      new Set([
        llmModel,
        'gemini-2.5-flash-preview',
        'gemini-2.5-flash-preview-05-20',
        'gemini-2.5-flash',
        'gemini-2.0-flash',
        'gemini-1.5-flash',
        'gemini-1.5-flash-latest'
      ])
    );

    let lastError = null;

    for (const modelName of candidateModels) {
      try {
        const response = await geminiClient.models.generateContent({
          model: modelName,
          contents: fullPrompt,
          config: {
            temperature: 0.3
          }
        });

        const text = String(response?.text || '').trim();
        if (text) {
          return { text, model: modelName };
        }
      } catch (error) {
        lastError = error;
        const status = error?.status || error?.response?.status;
        const message = String(error?.message || '').toLowerCase();
        const isNotFound =
          status === 404 ||
          message.includes('404') ||
          message.includes('not_found') ||
          message.includes('not found') ||
          message.includes('is not found');

        if (isNotFound) {
          continue;
        }
        throw error;
      }
    }

    if (lastError) {
      throw lastError;
    }

    return null;
  }

  const response = await axios.post(
    llmApiUrl,
    {
      model: llmModel,
      temperature: 0.3,
      messages: [
        { role: 'system', content: systemPrompt },
        ...historyForLlm,
        { role: 'user', content: userPayload }
      ]
    },
    {
      headers: {
        Authorization: `Bearer ${llmApiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    }
  );

  const text = response.data?.choices?.[0]?.message?.content?.trim() || null;
  return text ? { text, model: llmModel } : null;
}

router.post('/message', requireAuth, async (req, res, next) => {
  try {
    const { message } = req.body;
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'message is required and must be a string' });
    }

    const storedAge = await getUserAge(req.user.id);

    const extractedSymptoms = await extractSymptomsWithLlm(message);
    const symptomPrediction = await getSymptomPrediction(extractedSymptoms, message, storedAge);

    const recentResult = await pool.query(
      `SELECT role, message
       FROM chat_messages
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 8`,
      [req.user.id]
    );
    const recentMessages = recentResult.rows.reverse();

    let assistantMessage = null;
    let usedModel = null;
    let replySource = 'llm';
    try {
      const llmResult = await generateLlmReply({
        message,
        extractedSymptoms,
        recentMessages,
        symptomPrediction
      });
      assistantMessage = llmResult?.text || null;
      usedModel = llmResult?.model || null;
    } catch (llmError) {
      console.warn('[LLM FALLBACK]', llmProvider, llmError.message);
    }

    if (!assistantMessage) {
      assistantMessage = buildAssistantReply(extractedSymptoms);
      replySource = 'rules';
    }

    await pool.query(
      `INSERT INTO chat_messages (user_id, role, message, extracted_symptoms, metadata)
       VALUES ($1, 'user', $2, $3, $4)`,
      [req.user.id, message, JSON.stringify(extractedSymptoms), JSON.stringify({ source: 'chat-user' })]
    );

    const { rows } = await pool.query(
      `INSERT INTO chat_messages (user_id, role, message, extracted_symptoms, metadata)
       VALUES ($1, 'assistant', $2, $3, $4)
       RETURNING id, role, message, extracted_symptoms, metadata, created_at`,
      [
        req.user.id,
        assistantMessage,
        JSON.stringify(extractedSymptoms),
        JSON.stringify({
          source: replySource,
          model: replySource === 'llm' ? usedModel : null
        })
      ]
    );

    res.status(201).json({
      reply: rows[0],
      extractedSymptoms,
      source: replySource,
      symptomAnalysis: symptomPrediction
    });
  } catch (error) {
    next(error);
  }
});

router.get('/history', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, role, message, extracted_symptoms, metadata, created_at
       FROM chat_messages
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 40`,
      [req.user.id]
    );

    res.json({ messages: rows.reverse() });
  } catch (error) {
    next(error);
  }
});

router.post('/voice-to-text', requireAuth, upload.single('audio'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'audio file is required' });
    }

    const sttApiUrl = process.env.STT_API_URL;
    const sttApiKey = process.env.STT_API_KEY;
    const transcriptHint = String(req.body?.transcriptHint || '').trim();
    let transcript = '';

    if (sttApiUrl && sttApiKey) {
      try {
        const form = new FormData();
        form.append('file', req.file.buffer, {
          filename: req.file.originalname || 'voice.webm',
          contentType: req.file.mimetype || 'audio/webm'
        });

        const response = await axios.post(sttApiUrl, form, {
          headers: {
            ...form.getHeaders(),
            Authorization: `Bearer ${sttApiKey}`
          },
          timeout: 30000
        });

        transcript = response.data?.text || response.data?.transcript || '';
      } catch (error) {
        console.warn('[STT API FALLBACK]', error.message);
      }
    }

    if (!transcript) {
      transcript = await transcribeAudioWithGemini(req.file);
    }

    if (!transcript) {
      transcript = transcriptHint;
    }

    const voiceAnalysis = await getVoicePrediction(req.file);

    let extractedSymptoms = [];
    let symptomAnalysis = null;
    if (transcript) {
      const storedAge = await getUserAge(req.user.id);
      extractedSymptoms = await extractSymptomsWithLlm(transcript);
      symptomAnalysis = await getSymptomPrediction(extractedSymptoms, transcript, storedAge);
    }

    res.json({
      transcript,
      extractedSymptoms,
      voiceAnalysis,
      symptomAnalysis,
      transcriptionAvailable: Boolean(transcript),
      warning: transcript
        ? null
        : 'Transcription is unavailable right now. Voice risk analysis is still available. Enable browser speech recognition or configure STT/Gemini for transcripts.'
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
