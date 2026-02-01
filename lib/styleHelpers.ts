// api/utils/styleHelpers.ts
// Shared style helpers used by multiple API functions (generate, edit, style).
// Ported exactly from services/geminiService.ts getStyleInstruction().

export interface CarDetailsForStyle {
  artStyle: string;
  color?: string;
  backgroundColor?: string;
  view?: string;
  cyanotypeInverted?: boolean;
}

export const STYLE_DESCRIPTIONS: Record<string, string> = {
  'Vector (Monochromatic)': 'Clean, minimalist 2D illustration using shades of a single color.',
  'Watercolor': 'Expressive painting with soft edges, bleeds, and artistic splatters.',
  'Neon Sign': 'Electric glowing tubes and vibrant light trails on a dark canvas.',
  'Anime': '90s automotive manga style with thick outlines and cell shading.',
  'Vintage Poster': 'Mid-century travel aesthetic with graphic shapes and elegant palettes.',
  'Distressed': 'Aged retro look with worn textures and faded edges.',
  'Pop Art': '1960s comic book style with bold halftone dots and high contrast.',
  'Sketch': 'Hand-drawn pencil and charcoal aesthetic with visible graphite strokes.',
  'Chalk': 'Dusty, hand-drawn look on a chalkboard background with soft highlights.',
  'Cyanotype': 'Classic Prussian Blue blueprint look with precise technical lines.',
  'Vector': 'Clean, flat professional minimalist 2D illustration.',
  'Blueprint': 'Technical drafting schematic with precise white or blue lines.',
  'Blueprint Style': 'Technical drafting blueprint with white lines on dark blue, schematic engineering feel.',
  'Synthwave': '80s retro-futurism with chrome reflections and neon glows.',
  'Synthwave 80s': '80s synthwave neon grid with sunset gradient, retrowave chrome reflections.',
  'Comic Book': 'Bold comic book style with thick outlines, halftone dots, explosive energy and POW feel.',
  'Pencil Sketch': 'Detailed graphite pencil drawing with realistic shading and cross-hatching.',
  'Lowrider Airbrush': 'Chicano lowrider airbrush art style with metallic flake, custom paint swirls, and street culture aesthetic.',
  'JDM Japanese': 'Japanese car culture style with drift aesthetic, kanji typography, and neon-lit Tokyo street vibes.',
  'Cyberpunk': 'Futuristic rainy tech aesthetic with intense pink and cyan lights.',
  'Vaporwave': 'Lo-fi 90s aesthetic with pastel gradients and glitch elements.',
  'Line-Art': 'Minimalist ink drawing using only single-weight clean lines.',
  'Oil Painting': 'Richly textured masterpiece with visible impasto brush strokes.',
  'Low Poly': '3D geometric art constructed from sharp angular facets.',
  'Ukiyo-e': 'Traditional Japanese woodblock print with delicate organic textures.',
  'Carbon Tech': 'High-tech industrial look featuring intricate carbon fiber weaves.',
  'Lego': 'Constructed entirely from vibrant interlocking plastic building bricks.',
  'Exploded View': 'Technical diagram showing components pulled apart along axes.',
};

export const getStyleInstruction = (details: CarDetailsForStyle): string => {
  const { artStyle, color, backgroundColor, view, cyanotypeInverted } = details;
  const bodyColor = color || '#003366';
  const canvasColor = backgroundColor || '#FFFFFF';

  const organicEdgePrompt = `
    BOUNDARY: The image must have soft, undefined boundaries. 
    EDGE: The image should have an organic, non-rectilinear edge (no hard rectangular frame). 
    COMPOSITION: The car should appear to float gracefully on the page.`;

  const canvasBackgroundPrompt = `
    BACKGROUND: The output image MUST be rendered on a solid, clean, and perfectly flat background of EXACT COLOR: ${canvasColor}. 
    STRICT BACKGROUND RULE: No gradients, no textures, no patterns, and no background shadows are permitted. The background must be one single uniform hex color: ${canvasColor}.
    ISOLATION: The car must be perfectly isolated with no other background elements, landscapes, or distracting details. 
    FLOATING: The car should appear perfectly isolated on this ${canvasColor} canvas.`;

  let viewPrompt = "";
  switch (view) {
    case 'Front':
      viewPrompt = "ORIENTATION: Strictly head-on, direct front view. Perfectly level and centered. Front grille and lights dominant. WHEELS: Straight ahead.";
      break;
    case 'Rear':
      viewPrompt = "ORIENTATION: Strictly direct rear view. Centered. Tail lights and exhaust dominant.";
      break;
    case '3/4 Front':
      viewPrompt = "ORIENTATION: Classic 3/4 Front perspective view.";
      break;
    case '3/4 Rear':
      viewPrompt = "ORIENTATION: Classic 3/4 Rear perspective view.";
      break;
    case 'Side':
      viewPrompt = "ORIENTATION: Perfect side profile view. 90-degree lateral angle.";
      break;
    case 'Top':
      viewPrompt = "ORIENTATION: Direct top-down view (bird's eye). Wheels HIDDEN.";
      break;
    default:
      viewPrompt = `ORIENTATION: ${view} view.`;
  }

  const detailingPrompt = `
    SOLIDITY: The vehicle body panels MUST be 100% SOLID and OPAQUE.
    WINDOWS: Subtly translucent glass.
    WHEELS: Render with high precision and realistic depth.`;

  switch (artStyle) {
    case 'Vector':
      return `STYLE: Professional 2D flat minimalist illustration. COLOR: ${bodyColor}. Pure flat aesthetic. ${viewPrompt} ${detailingPrompt} ${canvasBackgroundPrompt}`;
    case 'Vector (Monochromatic)':
      return `STYLE: 2D flat minimalist illustration. MONOCHROME: Use ONLY shades/tints of ${bodyColor}. ${viewPrompt} ${detailingPrompt} ${canvasBackgroundPrompt}`;
    case 'Blueprint':
      return `STYLE: Technical drafting blueprint. BACKGROUND: ${canvasColor}. LINES: ${bodyColor}. ${viewPrompt} ${detailingPrompt} ${canvasBackgroundPrompt}`;
    case 'Cyanotype':
      if (cyanotypeInverted) {
        return `STYLE: Inverted Cyanotype. Dark Prussian Blue technical lines and blueprint strokes on a textured off-white or light cream vintage paper background. ${viewPrompt} ${detailingPrompt} BACKGROUND: #FDFCF8.`;
      }
      return `STYLE: Classic Prussian Blue Cyanotype. White technical lines on a rich, dark Prussian Blue vintage paper texture background. ${viewPrompt} ${detailingPrompt} BACKGROUND: #003366.`;
    case 'Synthwave':
      return `STYLE: 80s retro synthwave. Chrome reflections. Intense neon glow. Vibrant colors. ${viewPrompt} ${detailingPrompt} ${organicEdgePrompt} ${canvasBackgroundPrompt}`;
    case 'Cyberpunk':
      return `STYLE: Cyberpunk aesthetic. Rain-slicked metallic surfaces. Intense pink and cyan neon highlights. Gritty futuristic tech. ${viewPrompt} ${detailingPrompt} ${canvasBackgroundPrompt}`;
    case 'Vaporwave':
      return `STYLE: 90s Vaporwave. Pastel pink and teal gradients. GLitch art elements. Lo-fi aesthetic. ${viewPrompt} ${detailingPrompt} ${organicEdgePrompt} ${canvasBackgroundPrompt}`;
    case 'Distressed':
      return `STYLE: Aged retro poster. Worn textures. Faded edges. COLOR: ${bodyColor}. ${viewPrompt} ${detailingPrompt}`;
    case 'Line-Art':
      return `STYLE: Minimalist single-weight ink line drawing. No shading. ${viewPrompt} ${detailingPrompt} ${organicEdgePrompt} ${canvasBackgroundPrompt}`;
    case 'Sketch':
      return `STYLE: Hand-drawn pencil and charcoal sketch. Visible graphite strokes. Artistic cross-hatching. ${viewPrompt} ${detailingPrompt} ${canvasBackgroundPrompt}`;
    case 'Watercolor':
      return `STYLE: Expressive watercolor painting. Bleeding edges and splatters. COLOR: ${bodyColor}. ${viewPrompt} ${detailingPrompt} ${organicEdgePrompt} BACKGROUND: #FFFFFF.`;
    case 'Pop Art':
      return `STYLE: 1960s Pop Art. Bold halftone dots. High contrast. Saturated colors. ${viewPrompt} ${detailingPrompt} ${organicEdgePrompt} ${canvasBackgroundPrompt}`;
    case 'Oil Painting':
      return `STYLE: Classic oil painting. Visible impasto brush strokes. Rich texture. COLOR: ${bodyColor}. ${viewPrompt} ${detailingPrompt} ${organicEdgePrompt} BACKGROUND: #FFFFFF.`;
    case 'Neon Sign':
      return `STYLE: Glowing neon tube sign. Electric energy highlights. COLOR: ${bodyColor}. ${viewPrompt} ${detailingPrompt} ${organicEdgePrompt} ${canvasBackgroundPrompt}`;
    case 'Low Poly':
      return `STYLE: Low Poly 3D geometric art. Faceted surfaces. Sharp angular geometry. ${viewPrompt} ${detailingPrompt} ${canvasBackgroundPrompt}`;
    case 'Anime':
      return `STYLE: 90s Automotive Anime/Manga style. Cell-shading. Thick ink outlines. Dynamic speed lines. ${viewPrompt} ${detailingPrompt} ${canvasBackgroundPrompt}`;
    case 'Vintage Poster':
      return `STYLE: Mid-century travel poster. Limited palette. Flat graphic shapes. Elegant composition. ${viewPrompt} ${detailingPrompt} ${canvasBackgroundPrompt}`;
    case 'Ukiyo-e':
      return `STYLE: Traditional Japanese woodblock print. Delicate lines. Flat perspective. Organic textures. ${viewPrompt} ${detailingPrompt} ${canvasBackgroundPrompt}`;
    case 'Carbon Tech':
      return `STYLE: High-tech modern look. COLOR: Strictly Dark Gray and Deep Black. TEXTURE: Visible intricate carbon fiber weave patterns across all surfaces. SURFACE: Precision machined feel. Tech-industrial aesthetic. ${viewPrompt} ${detailingPrompt} ${canvasBackgroundPrompt}`;
    case 'Lego':
      return `STYLE: Entirely constructed from interlocking plastic building bricks. PRIMARY BRICK COLOR: ${bodyColor}. TIRES: Must be solid black rubber-look bricks. LOOK: Visible studs on top surfaces. High-detail brick-built assembly representing a ${bodyColor} vehicle. ${viewPrompt} ${detailingPrompt} ${canvasBackgroundPrompt}`;
    case 'Exploded View':
      return `STYLE: Technical exploded view diagram. COMPONENTS: Car body panels, wheels, and major mechanical parts are pulled apart and floating along their assembly axes. LOOK: Professional technical schematic. COLOR: Use realistic automotive component colors (Silver/Metallic for engine, Rubber Black for tires, Painted Body Panels, Clear Glass). DO NOT use a monochromatic scheme. ${viewPrompt} ${detailingPrompt} ${canvasBackgroundPrompt}`;
    case 'Chalk':
      return `STYLE: Hand-drawn chalk illustration on a chalkboard. TEXTURE: Dusty, powdery texture with soft blended highlights. COLOR: ${bodyColor}. ${viewPrompt} ${organicEdgePrompt} BACKGROUND: #000000.`;
    case 'Comic Book':
      return `STYLE: Bold comic book illustration. Thick black outlines. Halftone dot shading. Bright saturated primary colors. Explosive POW/BOOM energy feel. Speed lines and action. COLOR: ${bodyColor}. ${viewPrompt} ${detailingPrompt} ${organicEdgePrompt} ${canvasBackgroundPrompt}`;
    case 'Blueprint Style':
      return `STYLE: Technical engineering blueprint drawing. White/light cyan lines on dark navy blue background. Grid lines visible. Dimension annotations and technical callouts. Schematic precision. COLOR: white lines. ${viewPrompt} ${detailingPrompt} BACKGROUND: #003366.`;
    case 'Pencil Sketch':
      return `STYLE: Detailed realistic pencil sketch. Graphite on white paper. Visible pencil strokes. Cross-hatching for shadows. Light construction lines. Artistic hand-drawn feel. COLOR: graphite gray tones. ${viewPrompt} ${detailingPrompt} ${canvasBackgroundPrompt}`;
    case 'Synthwave 80s':
      return `STYLE: 80s Synthwave retrowave. Neon pink and cyan grid receding to horizon. Sunset gradient (purple to orange). Chrome-reflective car body. VHS scan lines. Retro-futuristic. COLOR: ${bodyColor} with neon reflections. ${viewPrompt} ${detailingPrompt} ${organicEdgePrompt} BACKGROUND: #1a0033.`;
    case 'Lowrider Airbrush':
      return `STYLE: Chicano lowrider airbrush art. Smooth gradient airbrush technique. Metallic candy paint effect with flake sparkle. Custom pinstripe accents. Mural-quality artwork. Street culture aesthetic. Aztec or sacred geometry subtle background elements. COLOR: ${bodyColor} with custom candy paint sheen. ${viewPrompt} ${detailingPrompt} ${organicEdgePrompt} ${canvasBackgroundPrompt}`;
    case 'JDM Japanese':
      return `STYLE: Japanese JDM car culture art. Drift aesthetic with tire smoke. Kanji/katakana typography integrated. Neon-lit Tokyo street backdrop hints. Rising sun motif. Sticker-bomb texture accents. Import tuner magazine cover feel. COLOR: ${bodyColor}. ${viewPrompt} ${detailingPrompt} ${organicEdgePrompt} BACKGROUND: #000000.`;
    default:
      return '';
  }
};
