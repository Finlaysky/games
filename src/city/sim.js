// SUNSET CITY simulation: on-foot movement, driving, traffic, pedestrians,
// police heat, bullets, jobs and pickups. Pure JS so it can be unit tested in node.

import { CITY, createCity, makeCollider, collideCircle, isSolid } from './world.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);

const PED_SKIN = ['#e0b48c', '#c99463', '#8d5a34', '#f0c9a4', '#6d452a'];
const PED_SHIRT = ['#4b7bec', '#eb3b5a', '#f7b731', '#20bf6b', '#8854d0', '#d1d8e0', '#fa8231', '#2d98da'];
const CAR_COLORS = ['#c0392b', '#2d6cdf', '#e0b32b', '#3fa96b', '#b9bec7', '#7a4bd0', '#e07b28', '#26303d', '#1f8a8a', '#a8334a'];
const CAR_NAMES = ['Sabre', 'Bravado', 'Kuruma', 'Penumbra', 'Fugitive', 'Ruiner', 'Sultan', 'Baller'];

export const JOBS = [
  {
    id: 'repo',
    title: 'Repo Run',
    brief: 'Boost any car and drop it at the impound lot.',
    pay: 800,
    steps: [
      { kind: 'steal', label: 'Steal any car' },
      { kind: 'goto', label: 'Deliver it to the impound lot', at: [8, 1], needCar: true, r: 70, next: 'Now deliver the car' },
    ],
  },
  {
    id: 'cargo',
    title: 'Hot Cargo',
    brief: 'Grab the crate downtown and run it across town.',
    pay: 1400,
    steps: [
      { kind: 'goto', label: 'Pick up the crate', at: [2, 8], r: 62, next: 'Crate secured — get it to the garage' },
      { kind: 'goto', label: 'Deliver it to the garage', at: [9, 2], r: 66, needCar: true },
    ],
  },
  {
    id: 'heat',
    title: 'Heat',
    brief: 'Cause chaos until you hit 3 stars, hold it, then shake the cops.',
    pay: 2600,
    steps: [
      { kind: 'stars', label: 'Reach 3 stars of heat', value: 3, next: 'Stay wanted for 15s' },
      { kind: 'hold', label: 'Stay wanted', seconds: 15, next: 'Now lose the cops' },
      { kind: 'evade', label: 'Lose the cops' },
    ],
  },
];

function makeCar(kind, x, y, angle = 0) {
  const sporty = Math.random() < 0.32;
  return {
    kind,
    x,
    y,
    angle,
    speed: 0,
    r: kind === 'police' ? 20 : 19,
    w: kind === 'police' ? 48 : 44,
    h: 25,
    color: kind === 'police' ? '#1b2a4a' : CAR_COLORS[(Math.random() * CAR_COLORS.length) | 0],
    accel: sporty ? 540 : 430,
    maxSpeed: sporty ? 570 : 470,
    hp: 100,
    name: kind === 'police' ? 'Police Cruiser' : CAR_NAMES[(Math.random() * CAR_NAMES.length) | 0],
    lightT: 0,
    axis: 'h',
    dir: 1,
    target: { x, y },
    stolen: false,
  };
}

function makePed(x, y) {
  return {
    x,
    y,
    angle: rand(0, TAU),
    speed: rand(38, 62),
    hp: 40,
    state: 'walk',
    color: PED_SHIRT[(Math.random() * PED_SHIRT.length) | 0],
    skin: PED_SKIN[(Math.random() * PED_SKIN.length) | 0],
    t: 0,
    tx: x,
    ty: y,
    panic: 0,
    walk: rand(0, TAU),
  };
}

function gridSize() {
  return Math.round(CITY.w / CITY.block);
}

function randomIntersection() {
  const n = gridSize();
  const i = 1 + ((Math.random() * (n - 1)) | 0);
  const j = 1 + ((Math.random() * (n - 1)) | 0);
  return { x: i * CITY.block, y: j * CITY.block, i, j };
}

export function createGame() {
  const city = createCity(20261);
  const collider = makeCollider(city.buildings);
  const spawn = { x: CITY.block * 5, y: CITY.block * 5 + CITY.road * 0.25 };

  const g = {
    city,
    collider,
    time: 0,
    paused: true,
    status: 'play',
    statusT: 0,
    player: {
      x: spawn.x,
      y: spawn.y,
      vx: 0,
      vy: 0,
      angle: -Math.PI / 2,
      hp: 100,
      maxHp: 100,
      ammo: 72,
      car: null,
      walk: 0,
      fireCd: 0,
    },
    cars: [],
    peds: [],
    bullets: [],
    parts: [],
    texts: [],
    pickups: [],
    camera: { x: spawn.x, y: spawn.y, zoom: 1.05 },
    aim: { x: spawn.x + 120, y: spawn.y },
    wanted: 0,
    heat: 0,
    crimeT: 0,
    money: 300,
    job: null,
    jobIndex: 0,
    jobDone: 0,
    marker: null,
    message: 'Sunset City — press E next to a car',
    messageT: 4,
    shake: 0,
    input: {},
    enterLatch: false,
    pickupT: 0,
    stats: { peds: 0, cars: 0, busted: 0, wasted: 0 },
  };

  spawnParked(g, 30);
  spawnTraffic(g, 24);
  spawnPeds(g, 90);
  spawnPickups(g, 12);
  startJob(g, 0);
  return g;
}

function spawnParked(g, n) {
  for (let k = 0; k < n; k++) {
    const it = randomIntersection();
    const side = (Math.random() * 4) | 0;
    const off = CITY.road * 0.36;
    const along = rand(-CITY.block * 0.32, CITY.block * 0.32);
    let x = it.x;
    let y = it.y;
    let angle = 0;
    if (side === 0) { x += along; y -= off; angle = 0; }
    else if (side === 1) { x += along; y += off; angle = Math.PI; }
    else if (side === 2) { x -= off; y += along; angle = Math.PI / 2; }
    else { x += off; y += along; angle = -Math.PI / 2; }
    if (x < 70 || y < 70 || x > CITY.w - 70 || y > CITY.h - 70) continue;
    g.cars.push(makeCar('parked', x, y, angle));
  }
}

function pickTarget(g, car, i, j, axis, dir) {
  const n = gridSize();
  const lane = CITY.road * 0.25;
  const choices = [];
  const tryDir = (a, d) => {
    const ni = i + (a === 'h' ? d : 0);
    const nj = j + (a === 'v' ? d : 0);
    if (ni < 0 || nj < 0 || ni > n || nj > n) return;
    choices.push({ a, d, ni, nj });
  };
  tryDir(axis, dir);
  tryDir(axis === 'h' ? 'v' : 'h', 1);
  tryDir(axis === 'h' ? 'v' : 'h', -1);
  const pick = choices.length ? choices[(Math.random() * choices.length) | 0] : { a: axis, d: -dir, ni: i, nj: j };
  car.target = {
    x: pick.ni * CITY.block + (pick.a === 'v' ? (pick.d > 0 ? -lane : lane) : 0),
    y: pick.nj * CITY.block + (pick.a === 'h' ? (pick.d > 0 ? lane : -lane) : 0),
  };
  car.axis = pick.a;
  car.dir = pick.d;
}

function spawnTraffic(g, n) {
  const lane = CITY.road * 0.25;
  for (let k = 0; k < n; k++) {
    const it = randomIntersection();
    const axis = Math.random() < 0.5 ? 'h' : 'v';
    const dir = Math.random() < 0.5 ? 1 : -1;
    const x = axis === 'h' ? it.x : it.x + (dir > 0 ? -lane : lane);
    const y = axis === 'h' ? it.y + (dir > 0 ? lane : -lane) : it.y;
    const angle = axis === 'h' ? (dir > 0 ? 0 : Math.PI) : dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    const car = makeCar('traffic', x, y, angle);
    car.speed = 150;
    pickTarget(g, car, it.i, it.j, axis, dir);
    g.cars.push(car);
  }
}

function spawnPeds(g, n) {
  const band = CITY.road / 2 + 17;
  const cols = gridSize();
  for (let k = 0; k < n; k++) {
    const i = (Math.random() * cols) | 0;
    const j = (Math.random() * cols) | 0;
    const side = (Math.random() * 4) | 0;
    const along = rand(band, CITY.block - band);
    let x;
    let y;
    if (side === 0) { x = i * CITY.block + along; y = j * CITY.block + band; }
    else if (side === 1) { x = i * CITY.block + along; y = (j + 1) * CITY.block - band; }
    else if (side === 2) { x = i * CITY.block + band; y = j * CITY.block + along; }
    else { x = (i + 1) * CITY.block - band; y = j * CITY.block + along; }
    g.peds.push(makePed(x, y));
  }
}

function spawnPickups(g, n) {
  const kinds = ['ammo', 'health'];
  for (let k = 0; k < n; k++) {
    const it = randomIntersection();
    const ang = rand(0, TAU);
    const x = it.x + Math.cos(ang) * CITY.road * 0.36;
    const y = it.y + Math.sin(ang) * CITY.road * 0.36;
    g.pickups.push({ x, y, kind: kinds[(Math.random() * 2) | 0], t: rand(0, TAU) });
  }
}

export function startJob(g, index) {
  const def = JOBS[index % JOBS.length];
  g.job = { def, step: 0, timer: 0 };
  g.jobIndex = index;
  g.marker = markerForStep(g);
  g.message = `JOB — ${def.title}: ${def.brief}`;
  g.messageT = 4.5;
}

function markerForStep(g) {
  const job = g.job;
  if (!job) return null;
  const step = job.def.steps[job.step];
  if (!step) return null;
  if (step.kind === 'steal') {
    if (g.player.car) return null;
    let best = null;
    let bd = Infinity;
    for (const car of g.cars) {
      if (car.kind === 'police') continue;
      const d = Math.hypot(car.x - g.player.x, car.y - g.player.y);
      if (d < bd) { bd = d; best = car; }
    }
    return best ? { x: best.x, y: best.y } : null;
  }
  if (step.kind === 'goto') return { x: step.at[0] * CITY.block, y: step.at[1] * CITY.block };
  return null;
}

export function addWanted(g, n) {
  g.wanted = clamp(g.wanted + n, 0, 5);
  g.crimeT = 0;
}

function spawnPart(g, x, y, vx, vy, color, size, life) {
  g.parts.push({ x, y, vx, vy, color, size, life, max: life });
}

function burst(g, x, y, color, n, speed) {
  for (let i = 0; i < n; i++) {
    const a = rand(0, TAU);
    const s = rand(speed * 0.3, speed);
    spawnPart(g, x, y, Math.cos(a) * s, Math.sin(a) * s, color, rand(2, 4.6), rand(0.3, 0.75));
  }
}

function hurtPed(g, ped, dmg, byBullet) {
  if (ped.state === 'down') return;
  ped.hp -= dmg;
  ped.panic = 3;
  ped.state = 'flee';
  if (ped.hp <= 0) {
    ped.state = 'down';
    g.stats.peds += 1;
    addWanted(g, byBullet ? 2 : 1);
    burst(g, ped.x, ped.y, '#b3202b', 12, 120);
    g.shake = Math.max(g.shake, 4);
  } else {
    burst(g, ped.x, ped.y, '#b3202b', 4, 80);
  }
}

function explodeCar(g, car) {
  burst(g, car.x, car.y, '#ffb347', 26, 260);
  burst(g, car.x, car.y, '#ff5a3c', 18, 180);
  g.shake = Math.max(g.shake, 14);
  if (g.player.car === car) {
    g.player.car = null;
    g.player.hp -= 55;
    g.player.x = car.x + 26;
    g.player.y = car.y + 26;
    collideCircle(g.collider, g.player, 11);
    if (g.player.hp <= 0) die(g, 'wasted');
  }
  if (car.kind === 'police') addWanted(g, 1);
  g.cars = g.cars.filter((c) => c !== car);
}

function die(g, kind) {
  if (g.status !== 'play') return;
  g.status = kind;
  g.statusT = 2.8;
  g.shake = 12;
  const loss = kind === 'busted' ? Math.floor(g.money * 0.15) : Math.min(g.money, 250);
  g.money -= loss;
  if (kind === 'busted') g.stats.busted += 1;
  else g.stats.wasted += 1;
  g.texts.push({ x: g.player.x, y: g.player.y - 30, text: `-$${loss}`, color: '#ff8d8d', life: 2 });
  burst(g, g.player.x, g.player.y, '#ff5a5a', 16, 170);
}

function respawn(g) {
  const p = g.player;
  p.x = CITY.block * 5;
  p.y = CITY.block * 5 + CITY.road * 0.25;
  p.vx = 0;
  p.vy = 0;
  p.hp = 100;
  p.car = null;
  p.ammo = Math.max(p.ammo, 24);
  g.wanted = 0;
  g.heat = 0;
  g.bullets.length = 0;
  g.cars = g.cars.filter((c) => c.kind !== 'police');
  g.camera.x = p.x;
  g.camera.y = p.y;
  g.message = 'Patched up at the clinic';
  g.messageT = 2.6;
}

function toggleVehicle(g) {
  const p = g.player;
  if (p.car) {
    const car = p.car;
    car.speed *= 0.15;
    p.car = null;
    p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 30;
    p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 30;
    collideCircle(g.collider, p, 11);
    g.message = `Bailed out of the ${car.name}`;
    g.messageT = 1.6;
    return;
  }
  let best = null;
  let bestD = 62;
  for (const car of g.cars) {
    if (car.kind === 'police' && g.wanted === 0) continue;
    const d = Math.hypot(car.x - p.x, car.y - p.y);
    if (d < bestD) { bestD = d; best = car; }
  }
  if (!best) {
    g.message = 'No car close enough — walk up to one';
    g.messageT = 1.6;
    return;
  }
  if (best.kind === 'police') addWanted(g, 1);
  if (!best.stolen) { best.stolen = true; g.stats.cars += 1; }
  p.car = best;
  p.x = best.x;
  p.y = best.y;
  g.message = best.kind === 'police' ? 'Stole a police cruiser!' : `Boosted a ${best.name}`;
  g.messageT = 1.8;
  burst(g, best.x, best.y, '#cfd6e4', 6, 70);
}

function fire(g) {
  const p = g.player;
  if (p.ammo <= 0) {
    if (g.messageT <= 0) { g.message = 'Out of ammo — find an ammo box'; g.messageT = 2; }
    return;
  }
  p.ammo -= 1;
  p.fireCd = 0.14;
  const ox = p.car ? p.car.x : p.x;
  const oy = p.car ? p.car.y : p.y;
  const ang = p.car ? p.car.angle : p.angle;
  const mx = ox + Math.cos(ang) * 22;
  const my = oy + Math.sin(ang) * 22;
  g.bullets.push({ x: mx, y: my, px: mx, py: my, vx: Math.cos(ang) * 1250, vy: Math.sin(ang) * 1250, life: 1.1 });
  burst(g, mx, my, '#ffd166', 3, 130);
  g.shake = Math.max(g.shake, 2.2);
}

function updatePlayer(g, dt, input) {
  const p = g.player;
  p.fireCd = Math.max(0, p.fireCd - dt);

  if (input.enter && !g.enterLatch) toggleVehicle(g);
  g.enterLatch = !!input.enter;

  if (p.car) {
    updateDriving(g, dt, input);
  } else {
    let ax = 0;
    let ay = 0;
    if (input.left) ax -= 1;
    if (input.right) ax += 1;
    if (input.up) ay -= 1;
    if (input.down) ay += 1;
    const moving = ax !== 0 || ay !== 0;
    const len = Math.hypot(ax, ay) || 1;
    const speed = input.sprint ? 252 : 152;
    const tvx = moving ? (ax / len) * speed : 0;
    const tvy = moving ? (ay / len) * speed : 0;
    const k = 1 - Math.exp(-14 * dt);
    p.vx += (tvx - p.vx) * k;
    p.vy += (tvy - p.vy) * k;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (moving) p.walk += dt * (input.sprint ? 15 : 10);
    collideCircle(g.collider, p, 11);
    p.x = clamp(p.x, 30, CITY.w - 30);
    p.y = clamp(p.y, 30, CITY.h - 30);
    // face the mouse when aiming, otherwise the walk direction
    if (g.aim && Number.isFinite(g.aim.x)) {
      p.angle = Math.atan2(g.aim.y - p.y, g.aim.x - p.x);
    } else if (moving) {
      p.angle = Math.atan2(p.vy, p.vx);
    }
    // cars can hit you
    for (const car of g.cars) {
      if (car === p.car) continue;
      if (Math.abs(car.speed) > 220 && Math.hypot(car.x - p.x, car.y - p.y) < 26) {
        p.hp -= 34 * dt * 6;
        if (p.hp <= 0) die(g, 'wasted');
        break;
      }
    }
  }

  if (input.fire && p.fireCd <= 0) fire(g);

  // pickups
  const px = p.car ? p.car.x : p.x;
  const py = p.car ? p.car.y : p.y;
  for (let i = g.pickups.length - 1; i >= 0; i--) {
    const it = g.pickups[i];
    if (Math.hypot(it.x - px, it.y - py) > 30) continue;
    if (it.kind === 'ammo') {
      p.ammo = Math.min(200, p.ammo + 24);
      g.texts.push({ x: px, y: py - 18, text: '+24 AMMO', color: '#ffd166', life: 1.4 });
    } else {
      p.hp = Math.min(p.maxHp, p.hp + 35);
      g.texts.push({ x: px, y: py - 18, text: '+35 HEALTH', color: '#8dffb0', life: 1.4 });
    }
    g.pickups.splice(i, 1);
  }
}

function updateDriving(g, dt, input) {
  const p = g.player;
  const car = p.car;
  const throttle = input.up ? 1 : 0;
  const brake = input.down ? 1 : 0;
  const steer = (input.right ? 1 : 0) - (input.left ? 1 : 0);

  car.speed += (throttle * car.accel - brake * car.accel * 1.25) * dt;
  car.speed -= car.speed * 0.9 * dt;
  if (input.sprint) car.speed *= 1 - 2.6 * dt;
  car.speed = clamp(car.speed, -car.maxSpeed * 0.4, car.maxSpeed);

  const sp = Math.abs(car.speed);
  const grip = Math.min(1, sp / 110);
  car.angle += steer * dt * 2.7 * grip * (car.speed >= 0 ? 1 : -1);

  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;

  if (collideCircle(g.collider, car, car.r)) {
    if (sp > 200) {
      g.shake = Math.max(g.shake, Math.min(12, sp / 55));
      burst(g, car.x, car.y, '#ffd166', 7, 130);
    }
    car.speed *= -0.22;
  }

  // car-to-car contact
  for (const other of g.cars) {
    if (other === car) continue;
    const dx = other.x - car.x;
    const dy = other.y - car.y;
    const d = Math.hypot(dx, dy);
    const minD = car.r + other.r;
    if (d >= minD || d < 0.001) continue;
    const ux = dx / d;
    const uy = dy / d;
    const push = (minD - d) / 2;
    car.x -= ux * push;
    car.y -= uy * push;
    other.x += ux * push;
    other.y += uy * push;
    const impact = Math.abs(car.speed) + Math.abs(other.speed);
    if (impact > 280) {
      car.speed *= 0.55;
      other.speed *= 0.4;
      g.shake = Math.max(g.shake, Math.min(10, impact / 95));
      burst(g, (car.x + other.x) / 2, (car.y + other.y) / 2, '#ffcf7a', 6, 140);
      if (other.kind === 'police' && Math.abs(car.speed) > 300) addWanted(g, 1);
    }
  }

  // run down pedestrians
  if (sp > 95) {
    for (const ped of g.peds) {
      if (ped.state === 'down') continue;
      if (Math.hypot(ped.x - car.x, ped.y - car.y) < car.r + 10) {
        hurtPed(g, ped, 100, false);
        car.speed *= 0.9;
      }
    }
  }

  // police contact
  for (const c of g.cars) {
    if (c.kind !== 'police') continue;
    if (Math.hypot(c.x - car.x, c.y - car.y) < 46) {
      p.hp -= 10 * dt;
      if (p.hp <= 0) die(g, 'wasted');
    }
  }

  car.x = clamp(car.x, 40, CITY.w - 40);
  car.y = clamp(car.y, 40, CITY.h - 40);
  p.x = car.x;
  p.y = car.y;
  p.angle = car.angle;
  p.vx = Math.cos(car.angle) * car.speed;
  p.vy = Math.sin(car.angle) * car.speed;
}

function updateTraffic(g, dt) {
  for (const car of g.cars) {
    if (car === g.player.car) continue;
    if (car.kind !== 'traffic') continue;
    const t = car.target;
    const dx = t.x - car.x;
    const dy = t.y - car.y;
    const d = Math.hypot(dx, dy);
    if (d < 30) {
      pickTarget(g, car, Math.round(t.x / CITY.block), Math.round(t.y / CITY.block), car.axis, car.dir);
      continue;
    }
    const desired = Math.atan2(dy, dx);
    const diff = ((desired - car.angle + Math.PI * 3) % TAU) - Math.PI;
    car.angle += clamp(diff, -1, 1) * dt * 3.2;

    const aheadX = car.x + Math.cos(car.angle) * 62;
    const aheadY = car.y + Math.sin(car.angle) * 62;
    let slow = 1;
    for (const other of g.cars) {
      if (other === car) continue;
      if (Math.hypot(other.x - aheadX, other.y - aheadY) < 36) { slow = 0; break; }
    }
    if (slow > 0) {
      const pd = Math.hypot(g.player.x - aheadX, g.player.y - aheadY);
      if (pd < 32) slow = 0;
    }
    const targetSpeed = 155 * slow;
    car.speed += clamp(targetSpeed - car.speed, -460 * dt, 280 * dt);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    collideCircle(g.collider, car, car.r * 0.8);
  }
}

function updatePolice(g, dt) {
  const p = g.player;
  const wanted = g.wanted;
  let police = g.cars.filter((c) => c.kind === 'police' && c !== p.car);
  const targetCount = wanted > 0 ? Math.min(wanted + 1, 5) : 0;

  if (police.length < targetCount) {
    for (let tries = 0; tries < 26; tries++) {
      const it = randomIntersection();
      const d = Math.hypot(it.x - p.x, it.y - p.y);
      if (d < 460 || d > 1400) continue;
      const car = makeCar('police', it.x, it.y, Math.atan2(p.y - it.y, p.x - it.x));
      car.speed = 200;
      g.cars.push(car);
      break;
    }
  } else if (police.length > targetCount) {
    const far = police.find((c) => Math.hypot(c.x - p.x, c.y - p.y) > 1500);
    if (far) g.cars = g.cars.filter((c) => c !== far);
  }

  for (const c of g.cars) {
    if (c.kind !== 'police') continue;
    c.lightT = (c.lightT + dt * 7) % 2;
    if (c === p.car) continue;
    const d = Math.hypot(p.x - c.x, p.y - c.y);
    const desired = Math.atan2(p.y - c.y, p.x - c.x);
    const diff = ((desired - c.angle + Math.PI * 3) % TAU) - Math.PI;
    c.angle += clamp(diff, -1, 1) * dt * 2.5;
    const targetSpeed = d > 120 ? 430 : 210;
    c.speed += clamp(targetSpeed - c.speed, -520 * dt, 420 * dt);
    c.x += Math.cos(c.angle) * c.speed * dt;
    c.y += Math.sin(c.angle) * c.speed * dt;
    collideCircle(g.collider, c, c.r);
    c.x = clamp(c.x, 40, CITY.w - 40);
    c.y = clamp(c.y, 40, CITY.h - 40);

    if (wanted > 0 && d < 44) {
      const slowPlayer = !p.car || Math.abs(p.car.speed) < 90;
      if (slowPlayer) die(g, 'busted');
      else p.hp -= 12 * dt;
    }
  }
}

function pickPedTarget(g, ped) {
  for (let tries = 0; tries < 6; tries++) {
    const a = rand(0, TAU);
    const r = rand(40, 150);
    const x = ped.x + Math.cos(a) * r;
    const y = ped.y + Math.sin(a) * r;
    if (x < 40 || y < 40 || x > CITY.w - 40 || y > CITY.h - 40) continue;
    if (isSolid(g.collider, x, y)) continue;
    ped.tx = x;
    ped.ty = y;
    ped.t = rand(2.5, 7);
    return;
  }
  ped.tx = ped.x;
  ped.ty = ped.y;
  ped.t = 1.5;
}

function updatePeds(g, dt) {
  const p = g.player;
  for (const ped of g.peds) {
    if (ped.state === 'down') continue;
    const dp = Math.hypot(ped.x - p.x, ped.y - p.y);
    const scared = g.wanted > 0 || ped.panic > 0;
    ped.panic = Math.max(0, ped.panic - dt);
    ped.walk += dt * 8;

    if (dp < 240 && scared) {
      ped.state = 'flee';
      ped.panic = Math.max(ped.panic, 2.2);
      ped.angle = Math.atan2(ped.y - p.y, ped.x - p.x);
      ped.speed = 135;
    } else if (ped.panic > 0) {
      ped.state = 'flee';
      ped.speed = 120;
    } else {
      ped.state = 'walk';
      ped.speed = 55;
    }

    if (ped.state === 'walk') {
      ped.t -= dt;
      if (ped.t <= 0 || Math.hypot(ped.tx - ped.x, ped.ty - ped.y) < 14) pickPedTarget(g, ped);
      ped.angle = Math.atan2(ped.ty - ped.y, ped.tx - ped.x);
    }
    ped.x += Math.cos(ped.angle) * ped.speed * dt;
    ped.y += Math.sin(ped.angle) * ped.speed * dt;
    collideCircle(g.collider, ped, 8);
    ped.x = clamp(ped.x, 40, CITY.w - 40);
    ped.y = clamp(ped.y, 40, CITY.h - 40);
  }
}

function updateBullets(g, dt) {
  for (let i = g.bullets.length - 1; i >= 0; i--) {
    const b = g.bullets[i];
    b.px = b.x;
    b.py = b.y;
    let dead = false;
    for (let s = 0; s < 3 && !dead; s++) {
      b.x += (b.vx * dt) / 3;
      b.y += (b.vy * dt) / 3;
      if (isSolid(g.collider, b.x, b.y)) {
        burst(g, b.x, b.y, '#cfd6e4', 4, 90);
        dead = true;
        break;
      }
      for (const ped of g.peds) {
        if (ped.state === 'down') continue;
        if (Math.hypot(ped.x - b.x, ped.y - b.y) < 12) {
          hurtPed(g, ped, 34, true);
          dead = true;
          break;
        }
      }
      if (dead) break;
      for (const car of g.cars) {
        if (car === g.player.car) continue;
        if (Math.hypot(car.x - b.x, car.y - b.y) < car.r + 4) {
          car.hp -= 24;
          burst(g, b.x, b.y, '#ffd166', 4, 100);
          if (car.kind === 'police') addWanted(g, 1);
          if (car.hp <= 0) explodeCar(g, car);
          dead = true;
          break;
        }
      }
    }
    b.life -= dt;
    if (dead || b.life <= 0) g.bullets.splice(i, 1);
  }
}

function updateEffects(g, dt) {
  for (let i = g.parts.length - 1; i >= 0; i--) {
    const pt = g.parts[i];
    pt.life -= dt;
    if (pt.life <= 0) { g.parts.splice(i, 1); continue; }
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.vx *= 1 - 2.6 * dt;
    pt.vy *= 1 - 2.6 * dt;
  }
  for (let i = g.texts.length - 1; i >= 0; i--) {
    const t = g.texts[i];
    t.life -= dt;
    t.y -= 30 * dt;
    if (t.life <= 0) g.texts.splice(i, 1);
  }
  if (g.messageT > 0) g.messageT -= dt;
}

function updateWanted(g, dt) {
  g.crimeT += dt;
  if (g.wanted <= 0) { g.heat = 0; return; }
  const copNear = g.cars.some(
    (c) => c.kind === 'police' && Math.hypot(c.x - g.player.x, c.y - g.player.y) < 640,
  );
  if (copNear) { g.heat = 0; return; }
  if (g.crimeT < 5) return;
  g.heat += dt;
  if (g.heat > 3.2) {
    g.heat = 0;
    g.wanted = clamp(g.wanted - 1, 0, 5);
    g.message = g.wanted > 0 ? 'Heat dropping…' : 'You lost the cops';
    g.messageT = 2.4;
  }
}

function updateJob(g, dt) {
  const job = g.job;
  if (!job) { g.marker = null; return; }
  const step = job.def.steps[job.step];
  if (!step) return;
  g.marker = markerForStep(g);

  let done = false;
  if (step.kind === 'steal') {
    done = !!g.player.car;
  } else if (step.kind === 'goto') {
    const tx = step.at[0] * CITY.block;
    const ty = step.at[1] * CITY.block;
    const carOk = !step.needCar || !!g.player.car;
    done = carOk && Math.hypot(g.player.x - tx, g.player.y - ty) < (step.r || 62);
  } else if (step.kind === 'stars') {
    done = g.wanted >= step.value;
  } else if (step.kind === 'hold') {
    if (g.wanted >= 2) job.timer += dt;
    else job.timer = Math.max(0, job.timer - dt * 0.6);
    done = job.timer >= step.seconds;
  } else if (step.kind === 'evade') {
    done = g.wanted === 0;
  }

  if (!done) return;
  job.step += 1;
  job.timer = 0;
  if (job.step < job.def.steps.length) {
    g.message = step.next || 'Objective updated';
    g.messageT = 3;
    return;
  }
  g.money += job.def.pay;
  g.jobDone += 1;
  g.texts.push({ x: g.player.x, y: g.player.y - 24, text: `+$${job.def.pay}`, color: '#8dffb0', life: 1.8 });
  g.message = `JOB COMPLETE — ${job.def.title} (+$${job.def.pay})`;
  g.messageT = 4;
  const next = g.jobIndex + 1;
  if (next < JOBS.length) startJob(g, next);
  else {
    g.job = null;
    g.marker = null;
    g.message = 'All jobs done. Free roam — try five stars.';
    g.messageT = 5;
  }
}

function updateCamera(g, dt) {
  const p = g.player;
  const speed = p.car ? Math.abs(p.car.speed) : 0;
  const lookX = p.car ? Math.cos(p.car.angle) * Math.min(130, speed * 0.32) : p.vx * 0.25;
  const lookY = p.car ? Math.sin(p.car.angle) * Math.min(130, speed * 0.32) : p.vy * 0.25;
  const tx = clamp(p.x + lookX, 0, CITY.w);
  const ty = clamp(p.y + lookY, 0, CITY.h);
  const k = 1 - Math.exp(-6 * dt);
  g.camera.x += (tx - g.camera.x) * k;
  g.camera.y += (ty - g.camera.y) * k;
  const targetZoom = p.car ? 1.05 - Math.min(1, speed / 570) * 0.26 : 1.05;
  g.camera.zoom += (targetZoom - g.camera.zoom) * (1 - Math.exp(-3 * dt));
  g.shake *= Math.exp(-6 * dt);
  if (g.shake < 0.05) g.shake = 0;
}

export function update(g, dt, input) {
  g.input = input || {};
  g.time += dt;

  if (g.status !== 'play') {
    g.statusT -= dt;
    updateEffects(g, dt);
    updateCamera(g, dt);
    if (g.statusT <= 0) {
      g.status = 'play';
      respawn(g);
    }
    return;
  }

  updatePlayer(g, dt, g.input);
  if (g.status !== 'play') return;
  updateTraffic(g, dt);
  updatePolice(g, dt);
  if (g.status !== 'play') return;
  updatePeds(g, dt);
  updateBullets(g, dt);
  updateWanted(g, dt);
  updateJob(g, dt);
  updateEffects(g, dt);
  updateCamera(g, dt);

  g.pickupT += dt;
  if (g.pickupT > 20) {
    g.pickupT = 0;
    if (g.pickups.length < 14) spawnPickups(g, 3);
  }
}
