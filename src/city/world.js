// Deterministic city generation + collision helpers for SUNSET CITY.
// Coordinates are world pixels. Roads run along multiples of CITY.block.

export const CITY = { w: 4400, h: 4400, block: 440, road: 104 };

const EMPTY = [];

function rngFrom(seed) {
  let s = (seed >>> 0) || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

const WALLS = ['hsl(214 12% 27%)', 'hsl(220 10% 24%)', 'hsl(205 14% 29%)', 'hsl(228 9% 25%)'];
const ROOFS = ['hsl(214 10% 34%)', 'hsl(220 8% 30%)', 'hsl(205 12% 36%)', 'hsl(232 8% 31%)'];
const WINDOWS = ['hsl(45 62% 64%)', 'hsl(200 48% 64%)', 'hsl(190 32% 58%)'];

export function createCity(seed = 1337) {
  const rnd = rngFrom(seed);
  const { w, h, block, road } = CITY;
  const cols = Math.round(w / block);
  const rows = Math.round(h / block);
  const inner = road / 2 + 34; // sidewalk band between curb and buildings
  const buildings = [];
  const parks = [];

  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const bx = i * block + inner;
      const by = j * block + inner;
      const bw = block - inner * 2;
      const bh = block - inner * 2;

      if (rnd() < 0.1) {
        const trees = [];
        const n = 3 + ((rnd() * 5) | 0);
        for (let k = 0; k < n; k++) {
          trees.push({
            x: bx + 24 + rnd() * (bw - 48),
            y: by + 24 + rnd() * (bh - 48),
            r: 13 + rnd() * 11,
          });
        }
        parks.push({ x: bx, y: by, w: bw, h: bh, trees });
        continue;
      }

      const lots = [];
      const mode = rnd();
      if (mode < 0.46) {
        const cut = 0.34 + rnd() * 0.32;
        lots.push({ x: bx, y: by, w: bw * cut - 7, h: bh });
        lots.push({ x: bx + bw * cut + 7, y: by, w: bw * (1 - cut) - 7, h: bh });
      } else if (mode < 0.84) {
        const cut = 0.34 + rnd() * 0.32;
        lots.push({ x: bx, y: by, w: bw, h: bh * cut - 7 });
        lots.push({ x: bx, y: by + bh * cut + 7, w: bw, h: bh * (1 - cut) - 7 });
      } else {
        const pad = 2 + rnd() * 14;
        lots.push({ x: bx + pad, y: by + pad, w: bw - pad * 2, h: bh - pad * 2 });
      }

      for (const lot of lots) {
        if (lot.w < 46 || lot.h < 46) continue;
        buildings.push({
          x: Math.round(lot.x),
          y: Math.round(lot.y),
          w: Math.round(lot.w),
          h: Math.round(lot.h),
          wall: WALLS[(rnd() * WALLS.length) | 0],
          roof: ROOFS[(rnd() * ROOFS.length) | 0],
          window: WINDOWS[(rnd() * WINDOWS.length) | 0],
          seed: (rnd() * 1e6) | 0,
          floors: 2 + ((rnd() * 9) | 0),
        });
      }
    }
  }

  return { buildings, parks, cols, rows, seed };
}

// Bucketed spatial index so collision only looks at nearby buildings.
export function makeCollider(buildings) {
  const B = 240;
  const buckets = new Map();
  const add = (key, index) => {
    let arr = buckets.get(key);
    if (!arr) buckets.set(key, (arr = []));
    arr.push(index);
  };

  buildings.forEach((b, index) => {
    const x0 = Math.floor((b.x - 48) / B);
    const x1 = Math.floor((b.x + b.w + 48) / B);
    const y0 = Math.floor((b.y - 48) / B);
    const y1 = Math.floor((b.y + b.h + 48) / B);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) add(`${x},${y}`, index);
    }
  });

  return { buildings, buckets, B };
}

function nearBuildings(collider, x, y) {
  return collider.buckets.get(`${Math.floor(x / collider.B)},${Math.floor(y / collider.B)}`) || EMPTY;
}

export function isSolid(collider, x, y) {
  const list = nearBuildings(collider, x, y);
  for (let i = 0; i < list.length; i++) {
    const b = collider.buildings[list[i]];
    if (x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h) return true;
  }
  return false;
}

// Pushes a circle out of any overlapping building. Returns true when it hit something.
export function collideCircle(collider, p, r) {
  const list = nearBuildings(collider, p.x, p.y);
  let hit = false;
  for (let i = 0; i < list.length; i++) {
    const b = collider.buildings[list[i]];
    const cx = p.x < b.x ? b.x : p.x > b.x + b.w ? b.x + b.w : p.x;
    const cy = p.y < b.y ? b.y : p.y > b.y + b.h ? b.y + b.h : p.y;
    const dx = p.x - cx;
    const dy = p.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 > r * r) continue;
    hit = true;
    if (d2 > 0.0001) {
      const d = Math.sqrt(d2);
      p.x = cx + (dx / d) * r;
      p.y = cy + (dy / d) * r;
    } else {
      const left = p.x - b.x;
      const right = b.x + b.w - p.x;
      const top = p.y - b.y;
      const bottom = b.y + b.h - p.y;
      const m = Math.min(left, right, top, bottom);
      if (m === left) p.x = b.x - r;
      else if (m === right) p.x = b.x + b.w + r;
      else if (m === top) p.y = b.y - r;
      else p.y = b.y + b.h + r;
    }
  }
  return hit;
}

export function intersection(i, j) {
  return { x: i * CITY.block, y: j * CITY.block };
}
