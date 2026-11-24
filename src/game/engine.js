// IRON FRONT battle engine — pure functions, deterministic seeded RNG.
// Every mutating helper clones the incoming state and returns a new one,
// so React can treat battle state as immutable snapshots.

import { UNIT_TYPES, TERRAIN, effectiveness } from './units.js';
import { MISSIONS, getMission, parseMap } from './missions.js';

export const PLAYER = 'player';
export const ENEMY = 'enemy';
const OTHER = { player: 'enemy', enemy: 'player' };
const NEIGHBOURS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

export { getMission };

/* ------------------------------------------------------------------ basics */

function nextRandom(s) {
  let t = (s.seed = (s.seed + 0x6d2b79f5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function clone(s) {
  return {
    ...s,
    supply: { ...s.supply },
    hq: { player: [...s.hq.player], enemy: [...s.hq.enemy] },
    units: s.units.map((u) => ({ ...u })),
    log: s.log.slice(),
    stats: { ...s.stats },
  };
}

export const idx = (s, x, y) => y * s.w + x;
export const inBounds = (s, x, y) => x >= 0 && y >= 0 && x < s.w && y < s.h;
export const manhattan = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
export const unitAt = (s, x, y) => s.units.find((u) => u.x === x && u.y === y) ?? null;
export const terrainAt = (s, x, y) => TERRAIN[s.tiles[idx(s, x, y)]];
export const unitsOf = (s, side) => s.units.filter((u) => u.side === side);
export const alive = (s, side) => unitsOf(s, side).length;

function pushLog(s, entry) {
  s.log.push({ id: s.logSeq++, turn: s.turn, ...entry });
  if (s.log.length > 240) s.log.splice(0, s.log.length - 240);
}

/* --------------------------------------------------------------- creation */

export function createBattle(missionId, seed = 20240607) {
  const mission = getMission(missionId);
  const w = mission.rows[0].length;
  const h = mission.rows.length;
  const tiles = parseMap(mission.rows);
  const units = [];
  let n = 0;

  const add = (side, type, x, y) => {
    const t = UNIT_TYPES[type];
    units.push({
      id: `${side[0]}${++n}`,
      side,
      type,
      name: t.name,
      x,
      y,
      hp: t.hp,
      maxHp: t.hp,
      atk: t.atk,
      def: t.def,
      move: t.move,
      minRange: t.minRange,
      maxRange: t.maxRange,
      moved: false,
      attacked: false,
    });
  };

  mission.player.forEach((u) => add(PLAYER, u.type, u.x, u.y));
  mission.enemy.forEach((u) => add(ENEMY, u.type, u.x, u.y));

  const state = {
    missionId: mission.id,
    missionName: mission.name,
    missionCode: mission.code,
    missionIndex: MISSIONS.findIndex((m) => m.id === mission.id),
    w,
    h,
    tiles,
    hq: { player: [...mission.playerHQ], enemy: [...mission.enemyHQ] },
    units,
    side: PLAYER,
    turn: 1,
    seed: seed >>> 0,
    seq: n,
    supply: { ...mission.supply },
    logSeq: 1,
    log: [],
    status: 'playing',
    maxUnits: 10,
    maxEnemy: mission.maxEnemy ?? 8,
    stats: { shots: 0, kills: 0, losses: 0, recruited: 0 },
  };

  pushLog(state, {
    side: PLAYER,
    kind: 'info',
    text: `${mission.name} — ${mission.brief}`,
  });
  return state;
}

/* ---------------------------------------------------------------- movement */

export function reachableTiles(state, unit) {
  const { w, h } = state;
  const blocked = new Set(
    state.units.filter((u) => u.id !== unit.id).map((u) => idx(state, u.x, u.y))
  );
  const cost = new Map();
  const start = idx(state, unit.x, unit.y);
  cost.set(start, 0);
  const frontier = [[unit.x, unit.y, 0]];

  while (frontier.length) {
    frontier.sort((a, b) => a[2] - b[2]);
    const [x, y, c] = frontier.shift();
    if (c > (cost.get(idx(state, x, y)) ?? Infinity)) continue;
    for (const [dx, dy] of NEIGHBOURS) {
      const nx = x + dx;
      const ny = y + dy;
      if (!inBounds(state, nx, ny)) continue;
      const key = idx(state, nx, ny);
      if (blocked.has(key)) continue;
      const t = TERRAIN[state.tiles[key]];
      const raw = t.cost[unit.type];
      const step = raw === undefined ? t.cost.default : raw;
      if (!Number.isFinite(step)) continue;
      const nc = c + step;
      if (nc > unit.move) continue;
      if (nc < (cost.get(key) ?? Infinity)) {
        cost.set(key, nc);
        frontier.push([nx, ny, nc]);
      }
    }
  }
  cost.delete(start);
  return cost;
}

export function inRangeFrom(unit, x, y, target) {
  const d = Math.abs(x - target.x) + Math.abs(y - target.y);
  return d >= unit.minRange && d <= unit.maxRange;
}

export function attackTargets(state, unit) {
  if (unit.attacked) return [];
  return state.units.filter(
    (u) => u.side !== unit.side && inRangeFrom(unit, unit.x, unit.y, u)
  );
}

export function moveUnit(state, unitId, x, y) {
  const s = clone(state);
  if (s.status !== 'playing') return { state: s };
  const u = s.units.find((v) => v.id === unitId);
  if (!u || u.moved) return { state: s };
  const reach = reachableTiles(s, u);
  if (!reach.has(idx(s, x, y))) return { state: s };

  u.x = x;
  u.y = y;
  u.moved = true;
  if (!attackTargets(s, u).length) u.attacked = true;
  pushLog(s, {
    side: u.side,
    kind: 'move',
    text: `${u.name} advances to ${coordName(x, y)}`,
  });
  evaluateStatus(s);
  return { state: s };
}

const LETTERS = 'ABCDEFGHIJ';
export const coordName = (x, y) => `${LETTERS[x] ?? x}${y + 1}`;

/* ------------------------------------------------------------------ combat */

function expectedDamage(attacker, defender, terrain) {
  const eff = effectiveness(attacker.type, defender.type);
  const hpFactor = 0.45 + 0.55 * (attacker.hp / attacker.maxHp);
  const defFactor = 1 + defender.def * 0.012 + (terrain?.def ?? 0) * 0.13;
  return (attacker.atk * eff * hpFactor) / defFactor;
}

function rollDamage(s, attacker, defender) {
  const terr = TERRAIN[s.tiles[idx(s, defender.x, defender.y)]];
  const variance = 0.88 + nextRandom(s) * 0.24;
  return Math.max(1, Math.round(expectedDamage(attacker, defender, terr) * variance));
}

export function performAttack(state, attackerId, targetId) {
  const s = clone(state);
  const a = s.units.find((u) => u.id === attackerId);
  const d = s.units.find((u) => u.id === targetId);
  if (!a || !d || a.attacked || a.side === d.side) return { state: s, error: 'invalid' };
  const dist = manhattan(a, d);
  if (dist < a.minRange || dist > a.maxRange) return { state: s, error: 'range' };

  const dmg = rollDamage(s, a, d);
  d.hp = Math.max(0, d.hp - dmg);
  s.stats.shots++;
  pushLog(s, {
    side: a.side,
    kind: 'attack',
    amount: dmg,
    targetId: d.id,
    at: [d.x, d.y],
    text: `${a.name} fires on ${d.name} — ${dmg} damage`,
  });

  let retaliation = 0;
  if (d.hp > 0 && inRangeFrom(d, d.x, d.y, a)) {
    retaliation = Math.max(1, Math.round(rollDamage(s, d, a) * 0.55));
    a.hp = Math.max(0, a.hp - retaliation);
    pushLog(s, {
      side: d.side,
      kind: 'attack',
      amount: retaliation,
      targetId: a.id,
      at: [a.x, a.y],
      text: `${d.name} returns fire on ${a.name} — ${retaliation} damage`,
    });
  }

  a.moved = true;
  a.attacked = true;

  for (const victim of [d, a]) {
    if (victim.hp <= 0) {
      s.units = s.units.filter((v) => v.id !== victim.id);
      pushLog(s, {
        side: OTHER[victim.side],
        kind: 'destroy',
        targetId: victim.id,
        at: [victim.x, victim.y],
        text: `${victim.name} destroyed`,
      });
      if (victim.side === ENEMY) s.stats.kills++;
      else s.stats.losses++;
    }
  }

  evaluateStatus(s);
  return { state: s, dmg, retaliation };
}

/* --------------------------------------------------------------- recruiting */

export function incomeFor(state, side) {
  const cities = unitsOf(state, side).filter(
    (u) => state.tiles[idx(state, u.x, u.y)] === 'city'
  ).length;
  return 240 + 45 * cities;
}

export function spawnTile(state, side) {
  const [hx, hy] = state.hq[side];
  const free = (x, y) => {
    if (!inBounds(state, x, y)) return false;
    if (unitAt(state, x, y)) return false;
    const t = TERRAIN[state.tiles[idx(state, x, y)]];
    return Number.isFinite(t.cost.default);
  };
  if (free(hx, hy)) return [hx, hy];
  for (const [dx, dy] of [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0],
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ]) {
    if (free(hx + dx, hy + dy)) return [hx + dx, hy + dy];
  }
  return null;
}

export function recruit(state, side, typeId) {
  const s = clone(state);
  const t = UNIT_TYPES[typeId];
  if (!t || s.status !== 'playing' || s.side !== side) return { state: s, error: 'turn' };
  const cap = side === PLAYER ? s.maxUnits : s.maxEnemy;
  if (unitsOf(s, side).length >= cap) return { state: s, error: 'cap' };
  if (s.supply[side] < t.cost) return { state: s, error: 'supply' };
  const spot = spawnTile(s, side);
  if (!spot) return { state: s, error: 'space' };

  s.supply[side] -= t.cost;
  s.seq += 1;
  s.units.push({
    id: `${side[0]}${s.seq}`,
    side,
    type: t.id,
    name: t.name,
    x: spot[0],
    y: spot[1],
    hp: t.hp,
    maxHp: t.hp,
    moved: false,
    attacked: false,
  });
  if (side === PLAYER) s.stats.recruited++;
  pushLog(s, {
    side,
    kind: 'recruit',
    text: `${t.name} deployed at ${coordName(spot[0], spot[1])} (-${t.cost} supply)`,
  });
  return { state: s };
}

/* ------------------------------------------------------------ turn / status */

export function evaluateStatus(s) {
  if (s.status !== 'playing') return s.status;
  const playerUnits = unitsOf(s, PLAYER).length;
  const enemyUnits = unitsOf(s, ENEMY).length;
  const onEnemyHQ = s.units.some(
    (u) => u.side === PLAYER && u.x === s.hq.enemy[0] && u.y === s.hq.enemy[1]
  );
  const onPlayerHQ = s.units.some(
    (u) => u.side === ENEMY && u.x === s.hq.player[0] && u.y === s.hq.player[1]
  );

  if (onEnemyHQ || enemyUnits === 0) {
    s.status = 'won';
    pushLog(s, {
      side: PLAYER,
      kind: 'victory',
      text: onEnemyHQ
        ? 'Enemy command post captured — the line is broken.'
        : 'All enemy units destroyed — the field is yours.',
    });
    return s.status;
  }
  if (onPlayerHQ || playerUnits === 0) {
    s.status = 'lost';
    pushLog(s, {
      side: ENEMY,
      kind: 'defeat',
      text: onPlayerHQ
        ? 'Your command post has fallen.'
        : 'Your force has been wiped out.',
    });
  }
  return s.status;
}

function beginTurn(s, side) {
  s.side = side;
  unitsOf(s, side).forEach((u) => {
    u.moved = false;
    u.attacked = false;
  });
  const inc = incomeFor(s, side);
  s.supply[side] += inc;
  pushLog(s, {
    side,
    kind: 'income',
    text: `${side === PLAYER ? 'Allied' : 'Axis'} command receives ${inc} supply`,
  });
  evaluateStatus(s);
}

export function endTurn(state) {
  const s = clone(state);
  if (s.status !== 'playing') return s;
  const next = OTHER[s.side];
  if (next === PLAYER) s.turn += 1;
  beginTurn(s, next);
  return s;
}

/* ---------------------------------------------------------------------- AI */

function nearestPlayerTarget(s, unit) {
  const foes = unitsOf(s, PLAYER);
  let best = null;
  let bestD = Infinity;
  for (const f of foes) {
    const d = manhattan(unit, f);
    if (d < bestD) {
      bestD = d;
      best = f;
    }
  }
  if (best) return best;
  return { x: s.hq.player[0], y: s.hq.player[1] };
}

function pickTarget(s, unit, targets) {
  let best = null;
  let bestScore = -Infinity;
  for (const t of targets) {
    const terr = TERRAIN[s.tiles[idx(s, t.x, t.y)]];
    const dmg = expectedDamage(unit, t, terr);
    let score = dmg;
    if (dmg >= t.hp) score += 420;
    score += (t.maxHp - t.hp) * 0.6;
    if (t.type === 'arty' || t.type === 'at') score += 45;
    if (score > bestScore) {
      bestScore = score;
      best = t;
    }
  }
  return best;
}

function aiRecruit(s) {
  if (unitsOf(s, ENEMY).length >= s.maxEnemy) return s;
  const playerTanks = unitsOf(s, PLAYER).filter((u) => u.type === 'tank').length;
  const wants = [];
  if (playerTanks > 0) wants.push('at');
  wants.push('infantry', 'mg', 'tank', 'arty', 'recon');
  for (const typeId of wants) {
    const t = UNIT_TYPES[typeId];
    if (s.supply[ENEMY] >= t.cost && spawnTile(s, ENEMY)) {
      return recruit(s, ENEMY, typeId).state;
    }
  }
  return s;
}

/**
 * Performs a single AI action. Call repeatedly while state.side === 'enemy'.
 * Always makes progress: either a unit acts, or the turn is handed back.
 */
export function aiStep(state) {
  let s = clone(state);
  if (s.status !== 'playing' || s.side !== ENEMY) return { state: s, done: true };

  const ready = s.units.filter((u) => u.side === ENEMY && !(u.moved && u.attacked));
  if (!ready.length) {
    s = aiRecruit(s);
    return { state: endTurn(s), done: true };
  }

  const unit = ready[0];

  // 1. Shoot something already in range.
  const currentTargets = attackTargets(s, unit);
  if (currentTargets.length) {
    const target = pickTarget(s, unit, currentTargets);
    return { state: performAttack(s, unit.id, target.id).state, done: false };
  }

  // 2. Move to a tile from which it can shoot.
  const reach = reachableTiles(s, unit);
  let bestShot = null;
  for (const [key, cost] of reach) {
    const x = key % s.w;
    const y = Math.floor(key / s.w);
    const options = unitsOf(s, PLAYER).filter((u) => inRangeFrom(unit, x, y, u));
    if (!options.length) continue;
    const target = pickTarget(s, unit, options);
    const terr = TERRAIN[s.tiles[key]];
    const dmg = expectedDamage(unit, target, terr);
    const score = dmg * (dmg >= target.hp ? 2.4 : 1) + (terr?.def ?? 0) * 3 - cost * 0.4;
    if (!bestShot || score > bestShot.score) {
      bestShot = { x, y, score, targetId: target.id };
    }
  }

  if (bestShot) {
    const moved = moveUnit(s, unit.id, bestShot.x, bestShot.y).state;
    const u2 = moved.units.find((u) => u.id === unit.id);
    if (u2 && !u2.attacked) {
      const options = attackTargets(moved, u2);
      if (options.length) {
        const target = options.find((o) => o.id === bestShot.targetId) ?? pickTarget(moved, u2, options);
        return { state: performAttack(moved, u2.id, target.id).state, done: false };
      }
    }
    return { state: moved, done: false };
  }

  // 3. Advance on the nearest objective, preferring cover.
  const goal = nearestPlayerTarget(s, unit);
  let bestTile = null;
  for (const [key, cost] of reach) {
    const x = key % s.w;
    const y = Math.floor(key / s.w);
    const d = Math.abs(x - goal.x) + Math.abs(y - goal.y);
    const terr = TERRAIN[s.tiles[key]];
    const score = -d * 10 + (terr?.def ?? 0) * 2 - cost * 0.3;
    if (!bestTile || score > bestTile.score) bestTile = { x, y, score };
  }

  if (bestTile) {
    return { state: moveUnit(s, unit.id, bestTile.x, bestTile.y).state, done: false };
  }

  unit.moved = true;
  unit.attacked = true;
  return { state: s, done: false };
}
