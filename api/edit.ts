// api/edit.ts — Edit/tweak a generated car design (AUTHENTICATED)
// POST { imageBase64, editPrompt, resolution, details } → returns { imageUrl, prompt }

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';
import { getStyleInstruction } from '../lib/styleHelpers.js';
import { trackImageGenCall } from '../lib/apiTracker.js';
import { requireAuth } from './_lib/auth.js';
import { sanitizeError, logError } from './_lib/validation.js';
import { checkRateLimit } from './_lib/rateLimit.js';

const extractImageFromResponse = (response: any): string => {
  const parts = response.candidates?.[0]?.content?.parts || [];
  const imagePart = parts.find((p: any) => p.inlineData);
  if (imagePart && imagePart.inlineData) {
    return `data:image/png;base64,${imagePart.inlineData.data}`;
  }
  throw new Error('The design studio failed to render the image. Please try again.');
};

async function editHandler(req: VercelRequest, res: VercelResponse, user: any) {
  if (!(await checkRateLimit(req, res, 'ai'))) return;
  
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { imageBase64, editPrompt, resolution, details } = req.body;
    if (!imageBase64 || !editPrompt) return res.status(400).json({ error: 'imageBase64 and editPrompt are required' });

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });

    const ai = new GoogleGenAI({ apiKey });
    const startTime = Date.now();
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const styleInstruction = getStyleInstruction(details || {});

    const prompt = `Modify this car art: "${editPrompt}". 
  MAINTAIN STYLE: ${styleInstruction}
  Current orientation: ${details?.view || '3/4 Front'}.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/png', data: base64Data } },
          { text: prompt },
        ],
      },
      config: { imageConfig: { aspectRatio: '1:1', imageSize: resolution || '1K' } },
    });

    const imageUrl = extractImageFromResponse(response);
    trackImageGenCall('SnapMerch', 'tweak_design', 'gemini-3-pro-image-preview', 1, { durationMs: Date.now() - startTime });

    return res.status(200).json({ imageUrl, prompt });
  } catch (err: any) {
    logError('edit', err, { userId: user.sub });
    return res.status(500).json({ error: sanitizeError(err) });
  }
}

export default requireAuth(editHandler);
