// Canvas renderer for SUNSET CITY.
import { CITY } from './world.js';

const TAU = Math.PI * 2;

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function inView(view, x, y, pad = 70) {
  return x > view.x - pad && x < view.x + view.w + pad && y > view.y - pad && y < view.y + view.h + pad;
}

export function draw(ctx, g, w, h, dpr = 1) {
  const zoom = g.camera.zoom || 1;
  const shake = g.shake || 0;
  const sx = shake ? (Math.random() - 0.5) * shake : 0;
  const sy = shake ? (Math.random() - 0.5) * shake : 0;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#0b0e14';
  ctx.fillRect(0, 0, w, h);

  ctx.save();
  ctx.translate(w / 2 + sx, h / 2 + sy);
  ctx.scale(zoom, zoom);
  ctx.translate(-g.camera.x, -g.camera.y);

  const view = {
    x: g.camera.x - w / 2 / zoom - 40,
    y: g.camera.y - h / 2 / zoom - 40,
    w: w / zoom + 80,
    h: h / zoom + 80,
  };

  drawGround(ctx, view);
  drawParks(ctx, g, view);
  drawBuildings(ctx, g, view);
  drawMarkers(ctx, g);
  drawPickups(ctx, g, view);
  drawPeds(ctx, g, view);
  drawCars(ctx, g, view);
  if (!g.player.car) drawPlayerOnFoot(ctx, g);
  drawBullets(ctx, g);
  drawParticles(ctx, g);
  drawTexts(ctx, g);
  drawReticle(ctx, g);

  ctx.restore();
}

function drawGround(ctx, view) {
  const x0 = Math.max(0, view.x);
  const y0 = Math.max(0, view.y);
  const x1 = Math.min(CITY.w, view.x + view.w);
  const y1 = Math.min(CITY.h, view.y + view.h);
  if (x1 <= x0 || y1 <= y0) return;

  ctx.fillStyle = '#23262e';
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);

  const { block, road } = CITY;
  const n = Math.round(CITY.w / block);

  // sidewalk blocks
  const i0 = Math.max(0, Math.floor(view.x / block));
  const i1 = Math.min(n - 1, Math.floor((view.x + view.w) / block));
  const j0 = Math.max(0, Math.floor(view.y / block));
  const j1 = Math.min(n - 1, Math.floor((view.y + view.h) / block));
  for (let j = j0; j <= j1; j++) {
    for (let i = i0; i <= i1; i++) {
      const x = i * block + road / 2;
      const y = j * block + road / 2;
      const s = block - road;
      ctx.fillStyle = '#3a3f49';
      ctx.fillRect(x, y, s, s);
      ctx.fillStyle = '#454b56';
      ctx.fillRect(x + 9, y + 9, s - 18, s - 18);
    }
  }

  // lane dashes
  ctx.fillStyle = 'rgba(226,232,240,0.35)';
  for (let i = Math.max(0, i0); i <= Math.min(n, i1 + 1); i++) {
    const x = i * block;
    const startY = Math.max(0, Math.floor(view.y / 92) * 92);
    const endY = Math.min(CITY.h, view.y + view.h);
    for (let y = startY; y < endY; y += 92) ctx.fillRect(x - 2, y, 4, 48);
  }
  for (let j = Math.max(0, j0); j <= Math.min(n, j1 + 1); j++) {
    const y = j * block;
    const startX = Math.max(0, Math.floor(view.x / 92) * 92);
    const endX = Math.min(CITY.w, view.x + view.w);
    for (let x = startX; x < endX; x += 92) ctx.fillRect(x, y - 2, 48, 4);
  }
}

function drawParks(ctx, g, view) {
  for (const p of g.city.parks) {
    if (p.x + p.w < view.x || p.x > view.x + view.w || p.y + p.h < view.y || p.y > view.y + view.h) continue;
    ctx.fillStyle = '#2e4a34';
    ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.fillStyle = '#35563b';
    ctx.fillRect(p.x + 8, p.y + 8, p.w - 16, p.h - 16);
    for (const t of p.trees) {
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.beginPath();
      ctx.arc(t.x + 3, t.y + 4, t.r, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#1f3b25';
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.r, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#2d5c36';
      ctx.beginPath();
      ctx.arc(t.x - t.r * 0.2, t.y - t.r * 0.2, t.r * 0.66, 0, TAU);
      ctx.fill();
    }
  }
}

function drawBuildings(ctx, g, view) {
  for (const b of g.city.buildings) {
    if (b.x + b.w < view.x || b.x > view.x + view.w || b.y + b.h < view.y || b.y > view.y + view.h) continue;

    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(b.x + 7, b.y + 9, b.w, b.h);

    ctx.fillStyle = b.wall;
    ctx.fillRect(b.x, b.y, b.w, b.h);

    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x + 5, b.y + 5, b.w - 10, b.h - 10);

    const cols = Math.min(8, Math.max(1, Math.floor((b.w - 20) / 26)));
    const rows = Math.min(8, Math.max(1, Math.floor((b.h - 20) / 26)));
    const cw = (b.w - 20) / cols;
    const ch = (b.h - 20) / rows;
    let s = b.seed || 1;
    ctx.fillStyle = b.window;
    ctx.globalAlpha = 0.55;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        s = (s * 1103515245 + 12345) & 0x7fffffff;
        if (((s >> 16) & 3) === 0) continue;
        ctx.fillRect(b.x + 10 + c * cw + 3, b.y + 10 + r * ch + 3, cw - 8, ch - 8);
      }
    }
    ctx.globalAlpha = 1;

    ctx.strokeStyle = 'rgba(9,11,16,0.6)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1);
  }
}

function drawMarkers(ctx, g) {
  const m = g.marker;
  if (!m) return;
  const pulse = 1 + Math.sin(g.time * 3.4) * 0.09;
  ctx.save();
  ctx.translate(m.x, m.y);
  ctx.fillStyle = 'rgba(255,209,102,0.14)';
  ctx.beginPath();
  ctx.arc(0, 0, 48 * pulse, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,209,102,0.92)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, 40 * pulse, 0, TAU);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,209,102,0.9)';
  ctx.beginPath();
  ctx.moveTo(0, -13);
  ctx.lineTo(13, 0);
  ctx.lineTo(0, 13);
  ctx.lineTo(-13, 0);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawPickups(ctx, g, view) {
  for (const it of g.pickups) {
    if (!inView(view, it.x, it.y, 20)) continue;
    const bob = Math.sin(g.time * 2 + it.t) * 3;
    const color = it.kind === 'ammo' ? '#ffd166' : '#6ee7a0';
    ctx.save();
    ctx.translate(it.x, it.y + bob);
    ctx.rotate(Math.sin(g.time * 1.6 + it.t) * 0.25);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(-9, -7, 20, 20);
    ctx.fillStyle = color;
    roundRect(ctx, -10, -10, 20, 20, 5);
    ctx.fill();
    ctx.fillStyle = '#11151c';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(it.kind === 'ammo' ? 'A' : '+', 0, 1);
    ctx.restore();
  }
}

function drawPeds(ctx, g, view) {
  for (const ped of g.peds) {
    if (!inView(view, ped.x, ped.y, 20)) continue;
    if (ped.state === 'down') {
      ctx.fillStyle = 'rgba(120,20,26,0.5)';
      ctx.beginPath();
      ctx.ellipse(ped.x, ped.y, 15, 9, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = ped.color;
      ctx.beginPath();
      ctx.ellipse(ped.x, ped.y, 9, 5, 0.4, 0, TAU);
      ctx.fill();
      continue;
    }
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(ped.x + 1, ped.y + 4, 7, 4.5, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = ped.color;
    ctx.beginPath();
    ctx.arc(ped.x, ped.y, 7, 0, TAU);
    ctx.fill();
    ctx.fillStyle = ped.skin;
    ctx.beginPath();
    ctx.arc(ped.x + Math.cos(ped.angle) * 2.4, ped.y + Math.sin(ped.angle) * 2.4, 4, 0, TAU);
    ctx.fill();
  }
}

function drawCar(ctx, car, g) {
  const w = car.w;
  const h = car.h;
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);

  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  roundRect(ctx, -w / 2 + 2, -h / 2 + 4, w, h, 7);
  ctx.fill();

  ctx.fillStyle = car.kind === 'police' ? '#20304f' : car.color;
  roundRect(ctx, -w / 2, -h / 2, w, h, 7);
  ctx.fill();

  ctx.fillStyle = 'rgba(10,14,22,0.5)';
  roundRect(ctx, -w * 0.16, -h / 2 + 4, w * 0.4, h - 8, 4);
  ctx.fill();

  ctx.fillStyle = 'rgba(160,205,255,0.4)';
  roundRect(ctx, w * 0.26, -h / 2 + 5, w * 0.12, h - 10, 3);
  ctx.fill();

  ctx.fillStyle = '#ffe9a8';
  ctx.fillRect(w / 2 - 3, -h / 2 + 4, 3, 5);
  ctx.fillRect(w / 2 - 3, h / 2 - 9, 3, 5);
  ctx.fillStyle = '#ff5a5a';
  ctx.fillRect(-w / 2 + 1, -h / 2 + 4, 2.5, 5);
  ctx.fillRect(-w / 2 + 1, h / 2 - 9, 2.5, 5);

  if (car.kind === 'police') {
    const on = Math.sin(g.time * 15 + car.lightT) > 0;
    ctx.fillStyle = on ? '#4ea8ff' : '#ff4d4d';
    ctx.fillRect(-4, -h / 2 + 2, 8, 4);
    ctx.fillStyle = on ? '#ff4d4d' : '#4ea8ff';
    ctx.fillRect(-4, h / 2 - 6, 8, 4);
  }
  ctx.restore();
}

function drawCars(ctx, g, view) {
  for (const car of g.cars) {
    if (car === g.player.car) continue;
    if (!inView(view, car.x, car.y, 60)) continue;
    drawCar(ctx, car, g);
  }
  if (g.player.car && inView(view, g.player.car.x, g.player.car.y, 60)) {
    drawCar(ctx, g.player.car, g);
  }
}

function drawPlayerOnFoot(ctx, g) {
  const p = g.player;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath();
  ctx.ellipse(0, 6, 12, 7, 0, 0, TAU);
  ctx.fill();

  ctx.rotate(p.angle);
  const bob = Math.sin(p.walk) * 3;
  ctx.fillStyle = '#26313f';
  ctx.fillRect(-7, -8 + bob, 11, 5);
  ctx.fillRect(-7, 3 - bob, 11, 5);

  ctx.fillStyle = '#e8eef7';
  roundRect(ctx, -8, -8, 16, 16, 6);
  ctx.fill();
  ctx.fillStyle = '#3f6fd8';
  roundRect(ctx, -7, -7, 14, 14, 5);
  ctx.fill();

  ctx.fillStyle = '#dbe4f2';
  ctx.fillRect(4, -2.5, 11, 5);
  ctx.fillStyle = '#151a22';
  ctx.fillRect(13, -2, 8, 4);

  ctx.fillStyle = '#f0c9a4';
  ctx.beginPath();
  ctx.arc(1, 0, 5.2, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#2b3340';
  ctx.beginPath();
  ctx.arc(-1, 0, 4.4, Math.PI * 0.45, Math.PI * 1.55);
  ctx.fill();
  ctx.restore();
}

function drawBullets(ctx, g) {
  ctx.lineCap = 'round';
  for (const b of g.bullets) {
    ctx.strokeStyle = 'rgba(255,224,130,0.9)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(b.px, b.py);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(b.px, b.py);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
}

function drawParticles(ctx, g) {
  for (const pt of g.parts) {
    const a = Math.max(0, pt.life / pt.max);
    ctx.globalAlpha = a;
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.size * (0.5 + a * 0.7), 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawTexts(ctx, g) {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 16px system-ui, -apple-system, sans-serif';
  for (const t of g.texts) {
    ctx.globalAlpha = Math.min(1, t.life);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillText(t.text, t.x + 1.5, t.y + 1.5);
    ctx.fillStyle = t.color;
    ctx.fillText(t.text, t.x, t.y);
  }
  ctx.globalAlpha = 1;
}

function drawReticle(ctx, g) {
  const a = g.aim;
  if (!a) return;
  ctx.save();
  ctx.translate(a.x, a.y);
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(0, 0, 9, 0, TAU);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-15, 0);
  ctx.lineTo(-5, 0);
  ctx.moveTo(5, 0);
  ctx.lineTo(15, 0);
  ctx.moveTo(0, -15);
  ctx.lineTo(0, -5);
  ctx.moveTo(0, 5);
  ctx.lineTo(0, 15);
  ctx.stroke();
  ctx.restore();
}

export function drawMinimap(ctx, g, size) {
  const s = size;
  const span = 1800;
  const k = s / span;
  const cx = clamp(g.player.x, span / 2, CITY.w - span / 2);
  const cy = clamp(g.player.y, span / 2, CITY.h - span / 2);
  const left = cx - span / 2;
  const top = cy - span / 2;
  const tx = (x) => (x - left) * k;
  const ty = (y) => (y - top) * k;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, s, s);
  ctx.fillStyle = 'rgba(12,16,23,0.94)';
  ctx.fillRect(0, 0, s, s);

  // blocks
  const { block, road } = CITY;
  const n = Math.round(CITY.w / block);
  ctx.fillStyle = 'rgba(58,63,73,0.85)';
  const i0 = Math.max(0, Math.floor(left / block));
  const i1 = Math.min(n - 1, Math.floor((left + span) / block));
  const j0 = Math.max(0, Math.floor(top / block));
  const j1 = Math.min(n - 1, Math.floor((top + span) / block));
  for (let j = j0; j <= j1; j++) {
    for (let i = i0; i <= i1; i++) {
      const x = i * block + road / 2;
      const y = j * block + road / 2;
      const w = block - road;
      ctx.fillRect(tx(x), ty(y), w * k, w * k);
    }
  }

  if (g.marker) {
    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.arc(tx(g.marker.x), ty(g.marker.y), 4.5, 0, TAU);
    ctx.fill();
  }

  for (const car of g.cars) {
    if (car.kind !== 'police') continue;
    ctx.fillStyle = '#ff5a5a';
    ctx.fillRect(tx(car.x) - 2.5, ty(car.y) - 2.5, 5, 5);
  }

  ctx.save();
  ctx.translate(tx(g.player.x), ty(g.player.y));
  ctx.rotate(g.player.angle);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(7, 0);
  ctx.lineTo(-4.5, 4.5);
  ctx.lineTo(-4.5, -4.5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = 'rgba(255,209,102,0.35)';
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, s - 1, s - 1);
}
