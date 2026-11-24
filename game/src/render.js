// Rendering: the city, the sun-soaked look, particles, skid marks and screen shake.
import { PALETTE, BEACH, ROADS_V, ROADS_H, ROAD_W } from './config.js';

export class FX {
  constructor() {
    this.particles = [];
    this.skids = [];
    this.shakeMag = 0;
  }

  addSmoke(x, y, n = 1) {
    for (let i = 0; i < n; i++) {
      this.particles.push({
        kind: 'smoke', x: x + (Math.random() - 0.5) * 14, y: y + (Math.random() - 0.5) * 14,
        vx: (Math.random() - 0.5) * 20, vy: -20 - Math.random() * 20,
        r: 6 + Math.random() * 8, life: 0.9, max: 0.9,
      });
    }
  }

  addSparks(x, y) {
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 120 + Math.random() * 180;
      this.particles.push({
        kind: 'spark', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        r: 2, life: 0.35, max: 0.35,
      });
    }
  }

  addExplosion(x, y) {
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 40 + Math.random() * 220;
      this.particles.push({
        kind: 'fire', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        r: 5 + Math.random() * 10, life: 0.7, max: 0.7,
      });
    }
    for (let i = 0; i < 12; i++) {
      this.particles.push({
        kind: 'smoke', x: x + (Math.random() - 0.5) * 30, y: y + (Math.random() - 0.5) * 30,
        vx: (Math.random() - 0.5) * 30, vy: -30 - Math.random() * 30,
        r: 10 + Math.random() * 12, life: 1.4, max: 1.4,
      });
    }
    this.shakeMag = Math.max(this.shakeMag, 10);
  }

  addSkid(x, y, angle) {
    this.skids.push({ x, y, angle, life: 4 });
    if (this.skids.length > 400) this.skids.splice(0, this.skids.length - 400);
  }

  shake(mag) {
    this.shakeMag = Math.max(this.shakeMag, mag);
  }

  update(dt) {
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.96;
      p.vy *= 0.96;
      p.life -= dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const s of this.skids) s.life -= dt;
    this.skids = this.skids.filter((s) => s.life > 0);
    this.shakeMag = Math.max(0, this.shakeMag - dt * 22);
  }

  drawSkids(ctx) {
    ctx.save();
    ctx.lineCap = 'round';
    for (const s of this.skids) {
      ctx.strokeStyle = `rgba(20,20,24,${Math.min(0.5, s.life * 0.14)})`;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(s.x - Math.cos(s.angle) * 12, s.y - Math.sin(s.angle) * 12);
      ctx.lineTo(s.x + Math.cos(s.angle) * 12, s.y + Math.sin(s.angle) * 12);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawParticles(ctx) {
    for (const p of this.particles) {
      const t = Math.max(0, p.life / p.max);
      if (p.kind === 'smoke') {
        ctx.fillStyle = `rgba(120,120,120,${0.35 * t})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (1.6 - t * 0.6), 0, Math.PI * 2); ctx.fill();
      } else if (p.kind === 'spark') {
        ctx.fillStyle = `rgba(255,210,80,${t})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * t + 0.5, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.fillStyle = `rgba(255,${Math.floor(120 + 100 * t)},40,${t})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * t + 1, 0, Math.PI * 2); ctx.fill();
      }
    }
  }
}

function visible(ctx, cam, pad = 120) {
  const w = ctx.canvas.width / cam.zoom;
  const h = ctx.canvas.height / cam.zoom;
  return { x0: cam.x - w / 2 - pad, y0: cam.y - h / 2 - pad, x1: cam.x + w / 2 + pad, y1: cam.y + h / 2 + pad };
}

export function drawWorld(ctx, cam, city, world, time) {
  const vis = visible(ctx, cam);
  const W = city.W;
  const H = city.H;

  // Ground.
  ctx.fillStyle = PALETTE.grass;
  ctx.fillRect(vis.x0, vis.y0, vis.x1 - vis.x0, vis.y1 - vis.y0);

  // Beach sand and water.
  if (vis.y1 > BEACH.sandY) {
    ctx.fillStyle = PALETTE.sand;
    ctx.fillRect(Math.max(vis.x0, 0), BEACH.sandY, Math.min(vis.x1, W) - Math.max(vis.x0, 0), BEACH.waterY - BEACH.sandY);
    ctx.fillStyle = PALETTE.water;
    ctx.fillRect(Math.max(vis.x0, 0), BEACH.waterY, Math.min(vis.x1, W) - Math.max(vis.x0, 0), H - BEACH.waterY);
    // Animated wave lines.
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      const wy = BEACH.waterY + 8 + i * 14 + Math.sin(time * 1.4 + i * 2) * 3;
      ctx.beginPath();
      for (let x = Math.max(vis.x0, 0); x <= Math.min(vis.x1, W); x += 40) {
        const yy = wy + Math.sin(x / 90 + time * 1.2 + i) * 2.5;
        if (x === Math.max(vis.x0, 0)) ctx.moveTo(x, yy);
        else ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }
    ctx.fillStyle = PALETTE.waterDeep;
    ctx.fillRect(Math.max(vis.x0, 0), BEACH.waterY + 60, Math.min(vis.x1, W) - Math.max(vis.x0, 0), H - BEACH.waterY - 60);
  }

  // Sidewalk blocks (the pale ground under buildings).
  ctx.fillStyle = PALETTE.sidewalk;
  for (const b of city.blocks) {
    if (b.x > vis.x1 || b.x + b.w < vis.x0 || b.y > vis.y1 || b.y + b.h < vis.y0) continue;
    ctx.fillRect(b.x, b.y, b.w, b.h);
  }

  // Roads.
  ctx.fillStyle = PALETTE.asphalt;
  for (const rv of ROADS_V) ctx.fillRect(rv - ROAD_W / 2, 0, ROAD_W, Math.min(H, vis.y1));
  for (const rh of ROADS_H) ctx.fillRect(0, rh - ROAD_W / 2, Math.min(W, vis.x1), ROAD_W);

  // Lane dashes.
  ctx.strokeStyle = PALETTE.lane;
  ctx.lineWidth = 3;
  ctx.setLineDash([22, 26]);
  for (const rv of ROADS_V) {
    if (rv < vis.x0 || rv > vis.x1) continue;
    ctx.beginPath();
    ctx.moveTo(rv, Math.max(0, vis.y0));
    ctx.lineTo(rv, Math.min(BEACH.sandY, vis.y1));
    ctx.stroke();
  }
  for (const rh of ROADS_H) {
    if (rh < vis.y0 || rh > vis.y1) continue;
    ctx.beginPath();
    ctx.moveTo(Math.max(0, vis.x0), rh);
    ctx.lineTo(Math.min(W, vis.x1), rh);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // Crosswalks at intersections.
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  for (const rv of ROADS_V) {
    for (const rh of ROADS_H) {
      if (rv < vis.x0 - 60 || rv > vis.x1 + 60 || rh < vis.y0 - 60 || rh > vis.y1 + 60) continue;
      for (let i = -3; i <= 3; i++) {
        ctx.fillRect(rv + i * 12 - 3, rh - ROAD_W / 2 + 6, 6, 12);
        ctx.fillRect(rv + i * 12 - 3, rh + ROAD_W / 2 - 18, 6, 12);
      }
    }
  }

  // Parks.
  for (const park of city.parks) {
    if (park.x > vis.x1 || park.x + park.w < vis.x0 || park.y > vis.y1 || park.y + park.h < vis.y0) continue;
    ctx.fillStyle = '#6da85e';
    ctx.fillRect(park.x, park.y, park.w, park.h);
    ctx.fillStyle = PALETTE.parkPath;
    ctx.fillRect(park.x + park.w / 2 - 8, park.y, 16, park.h);
    ctx.fillRect(park.x, park.y + park.h / 2 - 8, park.w, 16);
  }

  // Docks lot.
  if (city.docks) {
    ctx.fillStyle = '#9a8f7a';
    ctx.fillRect(city.docks.x, city.docks.y, city.docks.w, city.docks.h);
    ctx.strokeStyle = '#6a5f4a';
    ctx.lineWidth = 3;
    ctx.strokeRect(city.docks.x, city.docks.y, city.docks.w, city.docks.h);
  }

  // Garage forecourt.
  if (city.garageZone) {
    const g = city.garageZone;
    ctx.fillStyle = '#7a8894';
    ctx.fillRect(g.x, g.y, g.w, g.h);
    ctx.fillStyle = '#ffd23e';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SPRAY & GO — $200', g.x + g.w / 2, g.y + 24);
  }

  // Pier.
  const pier = city.pier;
  ctx.fillStyle = '#8a6a45';
  ctx.fillRect(pier.x, pier.y, pier.w, pier.h);
  ctx.strokeStyle = '#6a4f30';
  ctx.lineWidth = 2;
  for (let y = pier.y + 10; y < pier.y + pier.h; y += 12) {
    ctx.beginPath(); ctx.moveTo(pier.x, y); ctx.lineTo(pier.x + pier.w, y); ctx.stroke();
  }

  // Buildings with shadows, roofs and windows.
  for (const b of city.buildings) {
    if (b.x > vis.x1 || b.x + b.w < vis.x0 || b.y > vis.y1 || b.y + b.h < vis.y0) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(b.x + 6, b.y + 8, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x + 6, b.y + 6, b.w - 12, b.h - 12);
    // Windows.
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    const cols = Math.floor(b.w / 26);
    const rows = Math.floor(b.h / 26);
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        ctx.fillRect(b.x + 12 + i * 26, b.y + 12 + j * 26, 9, 9);
      }
    }
    if (b.name) {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      const tw = ctx.measureText(b.name).width + 16;
      ctx.fillRect(b.x + b.w / 2 - tw / 2, b.y + b.h / 2 - 12, tw, 22);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(b.name, b.x + b.w / 2, b.y + b.h / 2 + 3);
    }
  }

  // Trees.
  for (const t of city.trees) {
    if (t.x < vis.x0 || t.x > vis.x1 || t.y < vis.y0 || t.y > vis.y1) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath(); ctx.ellipse(t.x + 3, t.y + 4, t.r, t.r * 0.7, 0, 0, Math.PI * 2); ctx.fill();
    if (t.palm) {
      ctx.strokeStyle = '#7a5a34';
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(t.x, t.y); ctx.lineTo(t.x + 4, t.y - t.r - 4); ctx.stroke();
      ctx.fillStyle = '#4f9e4a';
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + 0.4;
        ctx.beginPath();
        ctx.ellipse(t.x + 4 + Math.cos(a) * (t.r + 4), t.y - t.r - 4 + Math.sin(a) * (t.r + 4) * 0.5, t.r * 0.7, 4, a, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      ctx.fillStyle = '#3f7d3a';
      ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#57a34e';
      ctx.beginPath(); ctx.arc(t.x - 3, t.y - 3, t.r * 0.6, 0, Math.PI * 2); ctx.fill();
    }
  }

  // Mission marker: pulsing beacon.
  const marker = world.missions ? world.missions.marker() : null;
  if (marker) {
    const pulse = 1 + Math.sin(time * 4) * 0.18;
    ctx.save();
    ctx.translate(marker.x, marker.y);
    ctx.fillStyle = 'rgba(255,210,62,0.25)';
    ctx.beginPath(); ctx.arc(0, 0, 46 * pulse, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ffd23e';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, 30 * pulse, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#ffd23e';
    ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill();
    // Beacon column.
    const grad = ctx.createLinearGradient(0, 0, 0, -160);
    grad.addColorStop(0, 'rgba(255,210,62,0.35)');
    grad.addColorStop(1, 'rgba(255,210,62,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(-8, -160, 16, 160);
    ctx.restore();
  }

  // Skid marks under the cars.
  world.fx.drawSkids(ctx);

  // Entities.
  for (const ped of world.peds) ped.draw(ctx);
  for (const car of world.cars) {
    if (!car.dead) car.draw(ctx, time);
  }
  world.player.draw(ctx);

  // Particles above everything.
  world.fx.drawParticles(ctx);

  // Warm late-afternoon light + vignette.
  const w = ctx.canvas.width / cam.zoom;
  const h = ctx.canvas.height / cam.zoom;
  const warm = ctx.createLinearGradient(cam.x - w / 2, cam.y - h / 2, cam.x + w / 2, cam.y + h / 2);
  warm.addColorStop(0, 'rgba(255,190,90,0.05)');
  warm.addColorStop(1, 'rgba(255,140,60,0.10)');
  ctx.fillStyle = warm;
  ctx.fillRect(cam.x - w / 2, cam.y - h / 2, w, h);
}
