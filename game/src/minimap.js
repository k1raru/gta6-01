// The minimap: roads, water, the player, police, the mission marker and the garage.
import { PALETTE, ROADS_V, ROADS_H } from './config.js';

export function drawMinimap(ctx, x, y, w, h, city, player, cops, marker, farePed) {
  const sx = w / city.W;
  const sy = h / city.H;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();

  // Base.
  ctx.fillStyle = '#5d7a4a';
  ctx.fillRect(x, y, w, h);
  // Water.
  ctx.fillStyle = '#2e7f9e';
  ctx.fillRect(x, y + (2340 / city.H) * h, w, h - (2340 / city.H) * h);
  // Blocks.
  ctx.fillStyle = '#cbb98a';
  for (const b of city.blocks) {
    ctx.fillRect(x + b.x * sx, y + b.y * sy, Math.max(1, b.w * sx), Math.max(1, b.h * sy));
  }
  // Roads.
  ctx.strokeStyle = '#3d414d';
  ctx.lineWidth = 2;
  for (const rv of ROADS_V) {
    ctx.beginPath();
    ctx.moveTo(x + rv * sx, y);
    ctx.lineTo(x + rv * sx, y + h);
    ctx.stroke();
  }
  for (const rh of ROADS_H) {
    ctx.beginPath();
    ctx.moveTo(x, y + rh * sy);
    ctx.lineTo(x + w, y + rh * sy);
    ctx.stroke();
  }
  // Garage.
  if (city.garage) {
    ctx.fillStyle = '#2e7bff';
    ctx.beginPath();
    ctx.arc(x + (city.garage.x + city.garage.w / 2) * sx, y + (city.garage.y + city.garage.h / 2) * sy, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  // Fare ped.
  if (farePed) {
    ctx.fillStyle = '#37d67a';
    ctx.beginPath();
    ctx.arc(x + farePed.x * sx, y + farePed.y * sy, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  // Mission marker (pulsing).
  if (marker) {
    const r = 5 + Math.sin(performance.now() / 200) * 1.5;
    ctx.fillStyle = '#ffd23e';
    ctx.beginPath();
    ctx.arc(x + marker.x * sx, y + marker.y * sy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,210,62,0.6)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x + marker.x * sx, y + marker.y * sy, r + 4, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Police.
  ctx.fillStyle = '#ff2e2e';
  for (const cop of cops) {
    if (cop.dead) continue;
    ctx.beginPath();
    ctx.arc(x + cop.x * sx, y + cop.y * sy, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Player arrow.
  const px = x + player.x * sx;
  const py = y + player.y * sy;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(player.angle);
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(8, 0);
  ctx.lineTo(-6, -5);
  ctx.lineTo(-3, 0);
  ctx.lineTo(-6, 5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  ctx.restore();
  // Frame.
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);
}
