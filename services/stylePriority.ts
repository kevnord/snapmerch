// services/stylePriority.ts
// Smart style prioritization based on vehicle identity

import type { CarIdentity, SnapMerchStyle, StyleConfig } from '../types';
import { STYLE_CONFIGS } from '../types';

const JDM_MAKES = ['honda', 'toyota', 'nissan', 'subaru', 'mazda', 'mitsubishi', 'lexus', 'acura', 'infiniti', 'datsun'];

const LOWRIDER_MODELS = ['impala', 'monte carlo', 'regal', 'cutlass', 'el camino', 'caprice', 'fleetwood', 'lacrosse', 'riviera', 'skylark', 'lesabre', 'deville', 'town car', 'crown victoria', 'grand prix'];

const TRUCK_KEYWORDS = ['truck', 'pickup', 'f-150', 'f-250', 'f-350', 'silverado', 'sierra', 'ram', 'tundra', 'titan', 'tacoma', 'frontier', 'ranger', 'colorado', 'canyon', 'ridgeline', 'gladiator', 'maverick', 'raptor'];

const SPORTS_EXOTIC_MAKES = ['ferrari', 'lamborghini', 'porsche', 'mclaren', 'bugatti', 'koenigsegg', 'pagani', 'aston martin', 'lotus', 'maserati'];

const SPORTS_MODELS = ['corvette', 'camaro', 'mustang', 'supra', 'gtr', 'gt-r', 'nsx', 'rx-7', 'rx7', 'brz', 'gr86', '86', 'miata', 'mx-5', 'wrx', 'sti', 'evo', 'lancer evolution', 'challenger', 'charger', 'viper', 'z06', 'zr1', 'shelby', 'gt350', 'gt500', 'amg', 'm3', 'm4', 'm5', 'rs3', 'rs5', 'rs6', 'rs7', '911', 'cayman', 'boxster', 'panamera', 'type r', 'civic si', 's2000'];

type VehicleCategory = 'pre1980-classic' | '80s-90s' | 'truck' | 'jdm' | 'lowrider' | 'modern-sports' | 'default';

function categorizeVehicle(identity: CarIdentity): VehicleCategory {
  const year = parseInt(identity.year, 10) || 0;
  const make = (identity.make || '').toLowerCase().trim();
  const model = (identity.model || '').toLowerCase().trim();
  const fullName = `${make} ${model}`;

  // Check lowrider first (specific 60s-70s models)
  if (year >= 1958 && year <= 1985) {
    const isLowriderModel = LOWRIDER_MODELS.some(m => model.includes(m));
    if (isLowriderModel && ['chevrolet', 'chevy', 'buick', 'oldsmobile', 'cadillac', 'lincoln', 'pontiac', 'ford'].includes(make)) {
      return 'lowrider';
    }
  }

  // JDM
  if (JDM_MAKES.includes(make)) {
    return 'jdm';
  }

  // Trucks
  const isTruck = TRUCK_KEYWORDS.some(k => fullName.includes(k));
  if (isTruck) {
    return 'truck';
  }

  // Modern sports/exotic (2010+)
  if (year >= 2010) {
    const isExoticMake = SPORTS_EXOTIC_MAKES.some(m => make.includes(m));
    const isSportsModel = SPORTS_MODELS.some(m => model.includes(m));
    if (isExoticMake || isSportsModel) {
      return 'modern-sports';
    }
  }

  // Pre-1980 classics/muscle cars
  if (year > 0 && year < 1980) {
    return 'pre1980-classic';
  }

  // 80s-90s cars
  if (year >= 1980 && year <= 1999) {
    return '80s-90s';
  }

  return 'default';
}

const PRIORITY_MAP: Record<VehicleCategory, SnapMerchStyle[]> = {
  'pre1980-classic': ['retro', 'pencil', 'watercolor', 'vector', 'pop-art', 'blueprint', 'calligram', 'neon', 'comic', 'lowrider', 'neon-80s', 'japanese'],
  '80s-90s': ['neon-80s', 'retro', 'neon', 'comic', 'vector', 'pop-art', 'calligram', 'watercolor', 'pencil', 'blueprint', 'lowrider', 'japanese'],
  'truck': ['vector', 'blueprint', 'retro', 'watercolor', 'pencil', 'calligram', 'neon', 'comic', 'pop-art', 'neon-80s', 'lowrider', 'japanese'],
  'jdm': ['japanese', 'neon', 'comic', 'neon-80s', 'vector', 'pop-art', 'retro', 'calligram', 'watercolor', 'pencil', 'blueprint', 'lowrider'],
  'lowrider': ['lowrider', 'pop-art', 'retro', 'neon', 'calligram', 'watercolor', 'vector', 'pencil', 'comic', 'blueprint', 'neon-80s', 'japanese'],
  'modern-sports': ['neon', 'vector', 'comic', 'neon-80s', 'pop-art', 'calligram', 'retro', 'blueprint', 'watercolor', 'pencil', 'lowrider', 'japanese'],
  'default': ['vector', 'retro', 'neon', 'comic', 'calligram', 'watercolor', 'pop-art', 'pencil', 'blueprint', 'neon-80s', 'lowrider', 'japanese'],
};

/**
 * Returns all style configs sorted by likely appeal for the given vehicle.
 */
export function getPrioritizedStyles(identity: CarIdentity): StyleConfig[] {
  const category = categorizeVehicle(identity);
  const order = PRIORITY_MAP[category];

  // Map ordered style IDs to their configs
  const configMap = new Map(STYLE_CONFIGS.map(c => [c.id, c]));
  const ordered: StyleConfig[] = [];
  for (const id of order) {
    const cfg = configMap.get(id);
    if (cfg) ordered.push(cfg);
  }
  // Append any remaining configs not in the priority list (safety net)
  for (const cfg of STYLE_CONFIGS) {
    if (!ordered.find(o => o.id === cfg.id)) {
      ordered.push(cfg);
    }
  }
  return ordered;
}


