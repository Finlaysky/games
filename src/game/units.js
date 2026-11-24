// Unit roster and terrain table for IRON FRONT.
// Pure data + tiny helpers so both the browser client and Node tests can use it.

export const UNIT_TYPES = {
  infantry: {
    id: 'infantry',
    name: 'Riflemen',
    abbr: 'INF',
    cost: 100,
    hp: 100,
    atk: 32,
    def: 8,
    move: 3,
    minRange: 1,
    maxRange: 1,
    desc: 'Cheap and stubborn. Holds towns and woods better than anything else.',
  },
  mg: {
    id: 'mg',
    name: 'MG Team',
    abbr: 'MG',
    cost: 140,
    hp: 90,
    atk: 28,
    def: 14,
    move: 2,
    minRange: 1,
    maxRange: 2,
    desc: 'Long reach, heavy defence, deadly against infantry. Helpless vs armour.',
  },
  recon: {
    id: 'recon',
    name: 'Recon Patrol',
    abbr: 'RCN',
    cost: 130,
    hp: 80,
    atk: 24,
    def: 6,
    move: 7,
    minRange: 1,
    maxRange: 1,
    desc: 'Extreme mobility. Flanks, grabs towns and finishes wounded units.',
  },
  at: {
    id: 'at',
    name: 'Anti-Tank Gun',
    abbr: 'AT',
    cost: 190,
    hp: 90,
    atk: 36,
    def: 8,
    move: 2,
    minRange: 1,
    maxRange: 2,
    desc: 'The hard counter to tanks. Almost useless against infantry.',
  },
  arty: {
    id: 'arty',
    name: 'Field Artillery',
    abbr: 'ART',
    cost: 250,
    hp: 80,
    atk: 46,
    def: 4,
    move: 2,
    minRange: 2,
    maxRange: 4,
    desc: 'Indirect fire from 4 tiles away, and no return fire. Cannot hit adjacent tiles.',
  },
  tank: {
    id: 'tank',
    name: 'Medium Tank',
    abbr: 'TNK',
    cost: 280,
    hp: 160,
    atk: 52,
    def: 16,
    move: 5,
    minRange: 1,
    maxRange: 1,
    desc: 'Fast and brutal against infantry and guns. Fear anti-tank weapons.',
  },
};

export const UNIT_ORDER = ['infantry', 'mg', 'recon', 'at', 'arty', 'tank'];

export const TERRAIN = {
  plains: { id: 'plains', name: 'Plains', def: 0, cost: { default: 1 } },
  road: { id: 'road', name: 'Road', def: 0, cost: { default: 1 } },
  forest: { id: 'forest', name: 'Forest', def: 2, cost: { default: 2, tank: Infinity, arty: Infinity } },
  hills: { id: 'hills', name: 'Hills', def: 2, cost: { default: 2 } },
  city: { id: 'city', name: 'Town', def: 3, cost: { default: 1 } },
  river: { id: 'river', name: 'River', def: 1, cost: { default: 3, tank: Infinity, arty: Infinity } },
  ruins: { id: 'ruins', name: 'Ruins', def: 3, cost: { default: 2 } },
};

// attacker type -> defender type -> damage multiplier
export const EFFECTIVENESS = {
  infantry: { infantry: 1.0, mg: 1.0, tank: 0.55, at: 1.1, arty: 1.35, recon: 1.2 },
  mg: { infantry: 1.35, mg: 1.0, tank: 0.4, at: 0.9, arty: 1.25, recon: 1.3 },
  recon: { infantry: 0.95, mg: 0.9, tank: 0.45, at: 1.2, arty: 1.45, recon: 1.0 },
  at: { infantry: 0.6, mg: 0.7, tank: 2.0, at: 0.8, arty: 1.0, recon: 0.9 },
  arty: { infantry: 1.2, mg: 1.15, tank: 0.7, at: 1.1, arty: 1.0, recon: 1.2 },
  tank: { infantry: 1.45, mg: 1.3, tank: 1.0, at: 0.75, arty: 1.6, recon: 1.5 },
};

export const effectiveness = (attackerType, defenderType) =>
  EFFECTIVENESS[attackerType]?.[defenderType] ?? 1;

export const terrainCost = (terrainId, unitType) => {
  const t = TERRAIN[terrainId];
  if (!t) return Infinity;
  const c = t.cost[unitType];
  return c === undefined ? t.cost.default : c;
};
