import test from 'node:test';
import assert from 'node:assert/strict';
import { CITY, createCity, makeCollider, collideCircle, isSolid } from './world.js';
import { JOBS, createGame, startJob, addWanted, update } from './sim.js';

const step = (g, input = {}, frames = 1, dt = 1 / 60) => {
  for (let i = 0; i < frames; i++) update(g, dt, input);
};

test('city generation is deterministic and fills the map', () => {
  const a = createCity(1337);
  const b = createCity(1337);
  assert.ok(a.buildings.length > 25, 'expected a dense city');
  assert.ok(a.parks.length >= 1, 'expected at least one park');
  assert.equal(a.buildings.length, b.buildings.length);
  for (const bl of a.buildings) {
    assert.ok(bl.x > 0 && bl.y > 0);
    assert.ok(bl.x + bl.w < CITY.w && bl.y + bl.h < CITY.h);
    assert.ok(bl.w > 40 && bl.h > 40);
  }
});

test('collision pushes a circle out of a building', () => {
  const city = createCity(4242);
  const collider = makeCollider(city.buildings);
  const bl = city.buildings[0];
  const p = { x: bl.x + bl.w / 2, y: bl.y + bl.h / 2 };
  assert.equal(isSolid(collider, p.x, p.y), true);
  collideCircle(collider, p, 12);
  assert.equal(isSolid(collider, p.x, p.y), false);
});

test('a new game has a player, traffic, pedestrians and a first job', () => {
  const g = createGame();
  assert.equal(g.status, 'play');
  assert.equal(g.player.hp, g.player.maxHp);
  assert.ok(g.player.ammo > 0);
  assert.ok(g.cars.length >= 20, 'traffic + parked cars');
  assert.ok(g.peds.length >= 60, 'pedestrians');
  assert.ok(g.pickups.length > 0);
  assert.equal(g.job.def.id, 'repo');
  assert.ok(g.marker, 'a marker guides the first objective');
  assert.ok(Number.isFinite(g.camera.x) && Number.isFinite(g.camera.y));
});

test('walking moves the player and cannot cross a building', () => {
  const g = createGame();
  const x0 = g.player.x;
  step(g, { right: true }, 40);
  assert.ok(g.player.x > x0, 'player should have walked right');

  const bl = g.city.buildings[0];
  g.player.x = bl.x - 30;
  g.player.y = bl.y + bl.h / 2;
  g.player.vx = 0;
  g.player.vy = 0;
  step(g, { right: true }, 90);
  assert.equal(isSolid(g.collider, g.player.x, g.player.y), false, 'player never inside a wall');
  assert.ok(g.player.x < bl.x + bl.w / 2, 'wall blocked the walk');
});

test('E steals a nearby car and driving accelerates it', () => {
  const g = createGame();
  const car = g.cars.find((c) => c.kind !== 'police');
  car.x = g.player.x + 24;
  car.y = g.player.y;
  car.angle = 0;
  step(g, { enter: true });
  assert.equal(g.player.car, car, 'player is now driving');

  car.x = CITY.block * 5;
  car.y = CITY.block * 5;
  car.angle = 0;
  car.speed = 0;
  step(g, { up: true }, 90);
  assert.ok(car.speed > 40, `expected the car to accelerate, got ${car.speed}`);
  assert.ok(car.x > CITY.block * 5 + 20, 'car should have travelled forward');

  step(g, { enter: true }, 2);
  assert.equal(g.player.car, null, 'E again exits the car');
});

test('shooting spends ammo and spawns bullets', () => {
  const g = createGame();
  const before = g.player.ammo;
  step(g, { fire: true });
  assert.ok(g.bullets.length >= 1);
  assert.equal(g.player.ammo, before - 1);
});

test('wanted level is clamped to five stars', () => {
  const g = createGame();
  addWanted(g, 3);
  assert.equal(g.wanted, 3);
  addWanted(g, 9);
  assert.equal(g.wanted, 5);
});

test('the repo job pays out and chains to the next job', () => {
  const g = createGame();
  startJob(g, 0);
  assert.equal(g.job.def.id, 'repo');

  const car = g.cars.find((c) => c.kind !== 'police');
  g.player.car = car;
  car.x = g.player.x;
  car.y = g.player.y;
  step(g, {});
  assert.equal(g.job.step, 1, 'steal step completed');

  const impound = JOBS[0].steps[1].at;
  const tx = impound[0] * CITY.block;
  const ty = impound[1] * CITY.block;
  g.player.x = tx;
  g.player.y = ty;
  car.x = tx;
  car.y = ty;
  car.speed = 0;
  const money = g.money;
  step(g, {});
  assert.equal(g.jobDone, 1);
  assert.equal(g.money, money + JOBS[0].pay);
  assert.equal(g.job.def.id, 'cargo', 'next job starts automatically');
});

test('wasted state respawns the player healthy at the clinic', () => {
  const g = createGame();
  g.wanted = 3;
  g.status = 'wasted';
  g.statusT = 0.1;
  step(g, {}, 3, 0.1);
  assert.equal(g.status, 'play');
  assert.equal(g.player.hp, g.player.maxHp);
  assert.equal(g.wanted, 0);
});

test('a long free-roam run stays finite and inside the city', () => {
  const g = createGame();
  for (let i = 0; i < 240; i++) {
    update(g, 1 / 60, { up: i % 7 < 4, right: i % 5 === 0, fire: i % 11 === 0 });
  }
  assert.ok(Number.isFinite(g.player.x) && Number.isFinite(g.player.y));
  for (const car of g.cars) {
    assert.ok(car.x > 0 && car.x < CITY.w, 'car inside city bounds');
    assert.ok(car.y > 0 && car.y < CITY.h, 'car inside city bounds');
    assert.ok(Number.isFinite(car.angle));
  }
  for (const ped of g.peds) {
    assert.ok(Number.isFinite(ped.x) && Number.isFinite(ped.y));
  }
});
