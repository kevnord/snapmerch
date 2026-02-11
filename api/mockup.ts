// api/mockup.ts — Generate product mockup (T-shirt, Hoodie, Mug, Poster) (AUTHENTICATED)
// POST { designImageBase64, productType?, shirtColor, shirtColorName, shirtBrand, gender, ageRange, carDescription, modelPhotoBase64?, background? }
// → returns { imageUrl }

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';
import { trackImageGenCall } from '../lib/apiTracker.js';
import { requireAuth } from './_lib/auth.js';
import { sanitizeError, logError } from './_lib/validation.js';
import { checkRateLimit } from './_lib/rateLimit.js';

const MODEL = 'gemini-2.5-flash-image';

const extractImageFromResponse = (response: any): string => {
  const parts = response.candidates?.[0]?.content?.parts || [];
  const imagePart = parts.find((p: any) => p.inlineData);
  if (imagePart && imagePart.inlineData) {
    return `data:image/png;base64,${imagePart.inlineData.data}`;
  }
  throw new Error('The design studio failed to render the mockup. Please try again.');
};

function buildPrompt(opts: {
  productType: string;
  modelDescription: string;
  colorName: string;
  colorHex: string;
  brand: string;
  backgroundDescription: string;
  carDescription: string;
  hasModelPhoto: boolean;
}): string {
  const { productType, modelDescription, colorName, colorHex, brand, backgroundDescription, carDescription, hasModelPhoto } = opts;

  const modelNote = hasModelPhoto
    ? 'IMPORTANT: Use the person from the second reference photo as the model. Preserve their appearance, face, and body type accurately.'
    : '';

  if (productType === 'mug') {
    return `Create a professional e-commerce product mockup photo of a ${colorName} ceramic coffee mug.

The mug has the provided artwork design (first image) printed on its side. The design should wrap naturally around the curved surface of the mug.

SCENE: The mug is sitting on a clean wooden desk or table. Slightly angled to show the design. Steam rising from hot coffee inside. Soft, warm morning light. Clean background with shallow depth of field. A few tasteful props nearby (notebook, plant) but mug is the hero.

MUG DETAILS: The mug color is ${colorHex} (${colorName}). Standard 11oz ceramic mug shape. The printed design should be clearly visible and properly sized.

IMPORTANT: This is ${carDescription || 'automotive art'}. The design on the mug must faithfully reproduce the first reference image.`;
  }

  if (productType === 'canvas' || productType === 'poster') {
    return `Create a professional interior mockup showing the provided artwork (first image) as a framed canvas print / poster hanging on a wall.

SCENE: The canvas print is mounted on a clean, modern wall (white or light gray). Well-lit room with natural light from a window. The print is the focal point. Minimalist interior styling — perhaps a mid-century modern chair or small plant nearby. The artwork is displayed in a thin black or floating frame.

PRINT DETAILS: The artwork should look like a high-quality gallery-wrapped canvas or poster print. Colors vibrant and true to the original design. Properly sized as a statement piece on the wall.

IMPORTANT: This is ${carDescription || 'automotive art'}. The artwork in the print must faithfully reproduce the first reference image.`;
  }

  // T-shirt or Hoodie
  const garmentType = productType === 'hoodie'
    ? `${colorName} pullover hoodie (${brand || 'Gildan 18500'} style, relaxed fit)`
    : `${colorName} crew-neck t-shirt (${brand || 'Bella Canvas 3001'} style, relaxed fit)`;

  return `Create a professional e-commerce product mockup photo. Show ${modelDescription} wearing a ${garmentType}.

The ${productType === 'hoodie' ? 'hoodie' : 't-shirt'} has the provided car artwork design (first image) printed on the front center. The design should look naturally printed on the fabric, following the contours and folds.

PHOTOGRAPHY STYLE: ${backgroundDescription} Model shown from waist up, slightly angled. Natural pose, looking at or near camera.

GARMENT DETAILS: The color must be EXACTLY ${colorHex} (${colorName}). The printed design should be clearly visible and properly sized on the chest area.

${modelNote}

IMPORTANT: This is for ${carDescription || 'automotive art'}. The design must faithfully reproduce the first reference image.`;
}

async function mockupHandler(req: VercelRequest, res: VercelResponse, user: any) {
  if (!(await checkRateLimit(req, res, 'ai'))) return;
  
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const {
      designImageBase64,
      productType = 'tshirt',
      shirtColor,
      shirtColorName,
      shirtBrand,
      gender,
      ageRange,
      carDescription,
      modelPhotoBase64,
      background = 'studio',
    } = req.body;

    if (!designImageBase64) return res.status(400).json({ error: 'designImageBase64 is required' });

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });

    const ai = new GoogleGenAI({ apiKey });
    const startTime = Date.now();
    const base64Data = designImageBase64.replace(/^data:image\/\w+;base64,/, '');

    const ageDescriptions: Record<string, string> = {
      '18-25': 'young adult in their early twenties',
      '25-40': 'adult in their late twenties to thirties',
      '40-55': 'middle-aged person in their forties',
      '55+': 'mature adult in their fifties or sixties',
    };

    const modelDescription = modelPhotoBase64
      ? 'the person shown in the second reference photo'
      : `a ${gender === 'male' ? 'man' : 'woman'}, ${ageDescriptions[ageRange] || 'adult'}`;

    const backgroundDescription = background === 'studio'
      ? 'Clean, professional studio lighting. Plain white or very light gray background. High-end Etsy product listing quality.'
      : `Lifestyle automotive scene background — the model is standing in a setting related to ${carDescription || 'a classic car'}. Cinematic, warm lighting. Shallow depth of field.`;

    const prompt = buildPrompt({
      productType,
      modelDescription,
      colorName: shirtColorName || 'White',
      colorHex: shirtColor || '#FFFFFF',
      brand: shirtBrand || 'Bella Canvas 3001',
      backgroundDescription,
      carDescription: carDescription || 'automotive art',
      hasModelPhoto: !!modelPhotoBase64,
    });

    const parts: any[] = [
      { inlineData: { mimeType: 'image/png', data: base64Data } },
    ];
    if (modelPhotoBase64) {
      const modelData = modelPhotoBase64.replace(/^data:image\/\w+;base64,/, '');
      parts.push({ inlineData: { mimeType: 'image/jpeg', data: modelData } });
    }
    parts.push({ text: prompt });

    const response = await ai.models.generateContent({
      model: MODEL,
      contents: { parts },
      config: {
        responseModalities: ['TEXT', 'IMAGE'] as any,
      },
    });

    const imageUrl = extractImageFromResponse(response);
    trackImageGenCall('SnapMerch', 'generate_mockup', MODEL, 1, {
      durationMs: Date.now() - startTime,
      metadata: { productType, color: shirtColorName || 'White' },
    });

    return res.status(200).json({ imageUrl });
  } catch (err: any) {
    logError('mockup', err, { userId: user.sub });
    return res.status(500).json({ error: sanitizeError(err) });
  }
}

export default requireAuth(mockupHandler);
