// api/generate.ts — Generate car image
// POST { details } → returns { imageUrl, prompt }
// NOTE: Large base64 reference images may exceed Vercel's 4.5MB body limit

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';
import { getStyleInstruction } from '../lib/styleHelpers.js';
import { trackImageGenCall } from '../lib/apiTracker.js';

const extractImageFromResponse = (response: any): string => {
  const parts = response.candidates?.[0]?.content?.parts || [];
  const imagePart = parts.find((p: any) => p.inlineData);
  if (imagePart && imagePart.inlineData) {
    return `data:image/png;base64,${imagePart.inlineData.data}`;
  }
  // Log what we actually got back for debugging
  console.error('No image in response. Parts:', JSON.stringify(parts?.map((p: any) => ({ hasText: !!p.text, hasInlineData: !!p.inlineData, textPreview: p.text?.slice(0, 200) })), null, 2));
  console.error('Candidates:', JSON.stringify(response.candidates?.map((c: any) => ({ finishReason: c.finishReason, safetyRatings: c.safetyRatings })), null, 2));
  throw new Error('The design studio failed to render the image. Please try again.');
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { details } = req.body;
    if (!details) return res.status(400).json({ error: 'details object is required' });

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });

    const ai = new GoogleGenAI({ apiKey });
    const startTime = Date.now();
    const quality = details.quality || 'high';
    // Vercel Hobby plan caps functions at 60s — use Flash for speed
    // Flash typically generates in 15-30s vs Pro's 45-90s
    const FLASH_MODEL = 'gemini-2.0-flash-exp-image-generation';
    const model = FLASH_MODEL;
    const carIdentity = `${details.year || ''} ${details.make || ''} ${details.model || ''} ${details.trim || ''}`.trim();

    let typographyInstruction = '';
    if (details.title?.trim() || details.subtitle?.trim()) {
      typographyInstruction = `TYPOGRAPHY: ${details.title?.trim() ? `Add bold art title "${details.title}".` : ''} ${details.subtitle?.trim() ? `Add subtitle "${details.subtitle}".` : ''}`;
    } else {
      typographyInstruction = 'DO NOT add any text or labels.';
    }

    const styleBase = getStyleInstruction(details);
    const subjectDescription = details.referenceImage
      ? 'the vehicle shown in the reference image'
      : `a high-resolution, professional-grade studio photograph illustration of a ${carIdentity}`;

    const metadataTags = `
    [TAGS]
    IDENTITY: ${details.year}, ${details.make}, ${details.model}, ${details.trim || 'Standard'}
    AESTHETICS: ${details.artStyle}, Primary Color: ${details.color}
    COMPOSITION: ${details.view} view, Canvas: ${details.backgroundColor}
    [/TAGS]
  `;

    const promptText = `${subjectDescription}. 
    ${styleBase}
    GROUNDING: Search for and use the authentic visual details of a ${details.year} ${details.make} ${details.model}. Centered square composition. ${details.view} view.
    ${typographyInstruction}
    ${metadataTags}
    CUSTOM: ${details.customization || 'None'}.`;

    const contents: any = { parts: [{ text: promptText }] };

    if (details.referenceImage) {
      const base64Data = details.referenceImage.replace(/^data:image\/\w+;base64,/, '');
      contents.parts.unshift({ inlineData: { mimeType: 'image/png', data: base64Data } });
      contents.parts[1].text = `Using the reference image AS THE ONLY SOURCE for features, create: ${promptText}`;
    }

    const config: any = {
      responseModalities: ['TEXT', 'IMAGE'],
    };
    // Flash model doesn't support aspectRatio or grounding — keep config minimal

    const response = await ai.models.generateContent({
      model,
      contents: contents,
      config,
    });

    const imageUrl = extractImageFromResponse(response);
    trackImageGenCall('MyRestoModStudio', 'generate_design', model, 1, {
      durationMs: Date.now() - startTime,
      metadata: { style: details.artStyle, car: `${details.year} ${details.make} ${details.model}`, quality },
    });

    return res.status(200).json({ imageUrl, prompt: promptText });
  } catch (err: any) {
    console.error('generate error:', err);
    return res.status(500).json({ error: err.message || 'Generation failed' });
  }
}
