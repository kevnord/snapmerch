// api/analyze.ts — Vehicle analysis (AUTHENTICATED)
// POST { imageBase64 } → returns VehicleAnalysis JSON
// NOTE: Large base64 images may exceed Vercel's 4.5MB body limit

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI, Type } from '@google/genai';
import { trackGeminiCall } from '../lib/apiTracker.js';
import { requireAuth } from './_lib/auth.js';
import { sanitizeError, logError } from './_lib/validation.js';
import { checkRateLimit } from './_lib/rateLimit.js';

async function analyzeHandler(req: VercelRequest, res: VercelResponse, user: any) {
  if (!(await checkRateLimit(req, res, 'ai'))) return;
  
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { imageBase64 } = req.body;
    if (!imageBase64) return res.status(400).json({ error: 'imageBase64 is required' });

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });

    const ai = new GoogleGenAI({ apiKey });
    const startTime = Date.now();
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/png', data: base64Data } },
          { text: 'Identify the vehicle in this image. Provide the factory Year, Make, Model, and Trim level. Also identify the primary exterior paint color (descriptive name and closest hex code). Return ONLY a JSON object: {"year": "YYYY", "make": "Make", "model": "Model", "trim": "Trim", "color": {"name": "Color Name", "hex": "#HEX"}}.' },
        ],
      },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            year: { type: Type.STRING },
            make: { type: Type.STRING },
            model: { type: Type.STRING },
            trim: { type: Type.STRING },
            color: {
              type: Type.OBJECT,
              properties: { name: { type: Type.STRING }, hex: { type: Type.STRING } },
              required: ['name', 'hex'],
            },
          },
          required: ['year', 'make', 'model', 'trim', 'color'],
        },
      },
    });

    trackGeminiCall('MyRestoModStudio', 'analyze_vehicle', 'gemini-2.5-flash', 1500, 200, { durationMs: Date.now() - startTime });

    const result = JSON.parse(response.text as string);
    return res.status(200).json(result);
  } catch (err: any) {
    logError('analyze', err, { userId: user.sub });
    return res.status(500).json({ error: sanitizeError(err) });
  }
}

export default requireAuth(analyzeHandler);
