import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createBattle,
  moveUnit,
  performAttack,
  recruit,
  endTurn,
  aiStep,
  reachableTiles,
  attackTargets,
  incomeFor,
  unitAt,
  idx,
} from './engine.js';
import { UNIT_TYPES, TERRAIN } from './units.js';

const mkUnit = (type, x, y, side = 'player', id) => ({
  id: id ?? `${side[0]}-${type}-${x}-${y}`,
  side,
  type,
  name: UNIT_TYPES[type].name,
  x,
  y,
  hp: UNIT_TYPES[type].hp,
  maxHp: UNIT_TYPES[type].hp,
  move: UNIT_TYPES[type].move,
  atk: UNIT_TYPES[type].atk,
  def: UNIT_TYPES[type].def,
  minRange: UNIT_TYPES[type].minRange,
  maxRange: UNIT_TYPES[type].maxRange,
  moved: false,
  attacked: false,
});

const withUnits = (missionId, units) => ({ ...createBattle(missionId, 7), units });

test('createBattle builds a playable opening position', () => {
  const s = createBattle('m1', 7);
  assert.equal(s.side, 'player');
  assert.equal(s.status, 'playing');
  assert.equal(s.turn, 1);
  assert.equal(s.units.filter((u) => u.side === 'player').length, 3);
  assert.equal(s.units.filter((u) => u.side === 'enemy').length, 3);
  assert.equal(s.tiles.length, s.w * s.h);
  assert.equal(s.tiles[idx(s, s.hq.enemy[0], s.hq.enemy[1])], 'city');
});

test('movement range respects movement points', () => {
  const s = createBattle('m1', 7);
  const inf = s.units.find((u) => u.side === 'player' && u.type === 'infantry');
  const reach = reachableTiles(s, inf);
  assert.ok(reach.size > 0, 'infantry should have somewhere to go');
  for (const cost of reach.values()) assert.ok(cost <= inf.move);
});

test('rivers stop armour but not infantry', () => {
  const s = withUnits('m2', [mkUnit('tank', 4, 1, 'player', 't1'), mkUnit('infantry', 4, 1, 'player', 'i1')]);
  const tankReach = reachableTiles(s, s.units[0]);
  const infReach = reachableTiles(s, s.units[1]);
  assert.equal(TERRAIN.river.cost.tank, Infinity);
  assert.ok(!tankReach.has(idx(s, 5, 1)), 'tank must not enter the river');
  assert.ok(infReach.has(idx(s, 5, 1)), 'infantry may wade the river');
});

test('moveUnit places the unit and spends its move', () => {
  const s = createBattle('m1', 7);
  const recon = s.units.find((u) => u.side === 'player' && u.type === 'recon');
  const reach = reachableTiles(s, recon);
  const key = [...reach.keys()].find((k) => !s.units.some((u) => idx(s, u.x, u.y) === k));
  const x = key % s.w;
  const y = Math.floor(key / s.w);

  const res = moveUnit(s, recon.id, x, y);
  const moved = res.state.units.find((u) => u.id === recon.id);
  assert.equal(moved.x, x);
  assert.equal(moved.y, y);
  assert.equal(moved.moved, true);
  assert.ok(res.state.log.length > s.log.length);

  const again = moveUnit(res.state, recon.id, recon.x, recon.y);
  assert.equal(again.state.units.find((u) => u.id === recon.id).x, x, 'cannot move twice');
});

test('adjacent attack damages the target and draws return fire', () => {
  const s = withUnits('m1', [
    mkUnit('infantry', 3, 3, 'player', 'p1'),
    mkUnit('infantry', 4, 3, 'enemy', 'e1'),
  ]);
  const res = performAttack(s, 'p1', 'e1');
  const defender = res.state.units.find((u) => u.id === 'e1');
  const attacker = res.state.units.find((u) => u.id === 'p1');

  assert.ok(res.dmg > 0);
  assert.ok(defender.hp < defender.maxHp, 'defender takes damage');
  assert.ok(attacker.hp < attacker.maxHp, 'adjacent defender returns fire');
  assert.equal(attacker.attacked, true);
  assert.ok(res.state.log.some((e) => e.kind === 'attack' && e.amount > 0));
});

test('artillery out of retaliation range takes no return fire', () => {
  const s = withUnits('m1', [
    mkUnit('arty', 1, 3, 'player', 'p1'),
    mkUnit('infantry', 4, 3, 'enemy', 'e1'),
  ]);
  const res = performAttack(s, 'p1', 'e1');
  const attacker = res.state.units.find((u) => u.id === 'p1');
  assert.ok(res.dmg > 0);
  assert.equal(attacker.hp, attacker.maxHp, 'artillery is never shot back at range 3');
});

test('artillery cannot fire at point-blank range', () => {
  const s = withUnits('m1', [
    mkUnit('arty', 3, 3, 'player', 'p1'),
    mkUnit('infantry', 4, 3, 'enemy', 'e1'),
  ]);
  assert.equal(attackTargets(s, s.units[0]).length, 0);
  assert.equal(performAttack(s, 'p1', 'e1').error, 'range');
});

test('anti-tank guns shred armour, infantry barely scratch it', () => {
  const atBattle = withUnits('m1', [
    mkUnit('at', 3, 3, 'player', 'p1'),
    mkUnit('tank', 4, 3, 'enemy', 'e1'),
  ]);
  const infBattle = withUnits('m1', [
    mkUnit('infantry', 3, 3, 'player', 'p2'),
    mkUnit('tank', 4, 3, 'enemy', 'e2'),
  ]);
  const atDmg = performAttack(atBattle, 'p1', 'e1').dmg;
  const infDmg = performAttack(infBattle, 'p2', 'e2').dmg;
  assert.ok(atDmg > infDmg * 2, `AT (${atDmg}) should far out-damage infantry (${infDmg}) vs tanks`);
});

test('destroyed units leave the battlefield and count as kills', () => {
  const s = withUnits('m1', [
    mkUnit('tank', 3, 3, 'player', 'p1'),
    { ...mkUnit('infantry', 4, 3, 'enemy', 'e1'), hp: 5 },
  ]);
  const res = performAttack(s, 'p1', 'e1');
  assert.equal(res.state.units.some((u) => u.id === 'e1'), false);
  assert.equal(res.state.stats.kills, 1);
  assert.ok(res.state.log.some((e) => e.kind === 'destroy'));
});

test('clearing every enemy unit wins the battle', () => {
  const s = withUnits('m1', [
    mkUnit('tank', 3, 3, 'player', 'p1'),
    { ...mkUnit('infantry', 4, 3, 'enemy', 'e1'), hp: 4 },
  ]);
  const res = performAttack(s, 'p1', 'e1');
  assert.equal(res.state.status, 'won');
});

test('standing on the enemy command post wins the battle', () => {
  const base = createBattle('m1', 7);
  const s = { ...base, units: [mkUnit('recon', base.hq.enemy[0], base.hq.enemy[1], 'player', 'p1')] };
  const res = moveUnit({ ...s, units: [mkUnit('recon', 8, 3, 'player', 'p1')] }, 'p1', 9, 3);
  assert.equal(res.state.status, 'won');
});

test('recruiting spends supply and deploys a new unit at the HQ', () => {
  const s = createBattle('m1', 7);
  const before = s.units.filter((u) => u.side === 'player').length;
  const res = recruit(s, 'player', 'infantry');
  assert.equal(res.error, undefined);
  assert.equal(res.state.units.filter((u) => u.side === 'player').length, before + 1);
  assert.equal(res.state.supply.player, s.supply.player - UNIT_TYPES.infantry.cost);
  const fresh = res.state.units.find((u) => !s.units.some((o) => o.id === u.id));
  assert.ok(fresh);
  assert.ok(unitAt(res.state, fresh.x, fresh.y));
});

test('recruiting is refused without enough supply', () => {
  const s = { ...createBattle('m1', 7), supply: { player: 10, enemy: 10 } };
  const res = recruit(s, 'player', 'tank');
  assert.equal(res.error, 'supply');
  assert.equal(res.state.units.length, s.units.length);
});

test('ending a turn pays income and hands over to the other side', () => {
  const s = createBattle('m1', 7);
  const next = endTurn(s);
  assert.equal(next.side, 'enemy');
  assert.equal(next.turn, 1);
  assert.equal(next.supply.enemy, s.supply.enemy + incomeFor(s, 'enemy'));

  const back = endTurn(next);
  assert.equal(back.side, 'player');
  assert.equal(back.turn, 2);
  assert.ok(back.supply.player > s.supply.player);
  assert.ok(back.units.filter((u) => u.side === 'player').every((u) => !u.moved && !u.attacked));
});

test('the AI acts and eventually hands the turn back', () => {
  let s = endTurn(createBattle('m2', 11));
  assert.equal(s.side, 'enemy');
  let steps = 0;
  while (s.side === 'enemy' && s.status === 'playing' && steps < 200) {
    s = aiStep(s).state;
    steps += 1;
  }
  assert.ok(steps < 200, 'AI must not loop forever');
  assert.ok(s.side === 'player' || s.status !== 'playing');
  assert.ok(s.log.some((e) => e.kind === 'income'));
});

test('the AI closes distance instead of standing still', () => {
  let s = endTurn(createBattle('m1', 5));
  const start = s.units.filter((u) => u.side === 'enemy').map((u) => [u.x, u.y]);
  let steps = 0;
  while (s.side === 'enemy' && s.status === 'playing' && steps < 200) {
    s = aiStep(s).state;
    steps += 1;
  }
  const moved = s.units
    .filter((u) => u.side === 'enemy')
    .some((u, i) => !start[i] || start[i][0] !== u.x || start[i][1] !== u.y);
  assert.ok(moved, 'at least one enemy unit should reposition');
});

test('a full battle can be fought to a conclusion', () => {
  let s = createBattle('m1', 99);
  let guard = 0;
  while (s.status === 'playing' && guard < 60) {
    if (s.side === 'player') {
      // crude player bot: every ready unit attacks if it can, else advances
      const ready = s.units.filter((u) => u.side === 'player' && !(u.moved && u.attacked));
      if (!ready.length) {
        s = endTurn(s);
        guard += 1;
        continue;
      }
      const unit = ready[0];
      const targets = attackTargets(s, unit);
      if (targets.length) {
        s = performAttack(s, unit.id, targets[0].id).state;
        continue;
      }
      const reach = reachableTiles(s, unit);
      let best = null;
      for (const key of reach.keys()) {
        const x = key % s.w;
        const y = Math.floor(key / s.w);
        const d = Math.abs(x - s.hq.enemy[0]) + Math.abs(y - s.hq.enemy[1]);
        if (!best || d < best.d) best = { x, y, d };
      }
      s = best ? moveUnit(s, unit.id, best.x, best.y).state : s;
      const u = s.units.find((v) => v.id === unit.id);
      if (u && !u.moved) {
        u.moved = true;
        u.attacked = true;
      }
    } else {
      s = aiStep(s).state;
    }
    guard += 1;
  }
  assert.ok(guard < 60, 'battle loop terminates');
  assert.ok(['playing', 'won', 'lost'].includes(s.status));
  assert.ok(s.units.length <= createBattle('m1').units.length + 12);
});
