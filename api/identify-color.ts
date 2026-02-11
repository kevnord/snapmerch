// api/identify-color.ts — Identify paint color given corrected vehicle info + photo (AUTHENTICATED)
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI, Type } from '@google/genai';
import { requireAuth } from './_lib/auth.js';
import { sanitizeError, logError } from './_lib/validation.js';
import { rateLimit } from './_lib/ratelimit.js';

async function identifyColorHandler(req: VercelRequest, res: VercelResponse, user: any) {
  if (!(await rateLimit(req, res, 'ai', user.sub))) return;
  
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { imageBase64, year, make, model } = req.body;
    if (!imageBase64) return res.status(400).json({ error: 'imageBase64 is required' });

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });

    const ai = new GoogleGenAI({ apiKey });
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');

    const vehicleHint = year && make && model ? `This is a ${year} ${make} ${model}.` : '';

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: base64Data } },
          {
            text: `${vehicleHint} Identify the exact exterior paint color of this vehicle. If you know the factory paint code or name for this year/make/model, use it. Return ONLY a JSON object: {"name": "Color Name", "hex": "#HEX"}`,
          },
        ],
      },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            hex: { type: Type.STRING },
          },
          required: ['name', 'hex'],
        },
      },
    });

    const result = JSON.parse(response.text as string);
    return res.status(200).json(result);
  } catch (err: any) {
    logError('identify-color', err, { userId: user.sub });
    return res.status(500).json({ error: sanitizeError(err) });
  }
}

export default requireAuth(identifyColorHandler);
