// HUD, menus and banners, drawn on the canvas in screen space.
import { CONTROLS_TEXT } from './config.js';
import { drawMinimap } from './minimap.js';

function pill(ctx, x, y, w, h, fill) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 8);
  ctx.fill();
}

export function drawHUD(ctx, g) {
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;
  const p = g.player;
  const police = g.police;

  // Cash + health, top-left.
  pill(ctx, 14, 14, 210, 58, 'rgba(10,12,20,0.72)');
  ctx.fillStyle = '#7be382';
  ctx.font = 'bold 24px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`$${p.cash.toLocaleString('en-US')}`, 26, 40);
  ctx.fillStyle = '#c9c9c9';
  ctx.font = '12px sans-serif';
  ctx.fillText('CASH', 150, 26);
  ctx.fillStyle = '#222';
  ctx.fillRect(26, 50, 150, 10);
  ctx.fillStyle = p.hp > 30 ? '#7be382' : '#ff5040';
  ctx.fillRect(26, 50, 150 * Math.max(0, p.hp / 100), 10);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 10px sans-serif';
  ctx.fillText('HP', 182, 59);

  // Wanted stars, top-right above the minimap.
  const starY = 34;
  const starX0 = W - 250;
  ctx.font = '26px sans-serif';
  ctx.textAlign = 'left';
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < police.level ? '#ffd23e' : 'rgba(255,255,255,0.28)';
    ctx.fillText('★', starX0 + i * 30, starY);
  }
  if (police.level > 0) {
    ctx.fillStyle = '#ff5040';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('WANTED', starX0 + 156, 30);
  }

  // Minimap.
  drawMinimap(ctx, W - 250, 46, 220, 150, g.city, p, police.cops, g.missions.marker(), g.missions.farePed);

  // Clock + district, top-center.
  pill(ctx, W / 2 - 110, 14, 220, 30, 'rgba(10,12,20,0.72)');
  ctx.fillStyle = '#ffe9a8';
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${g.clockText()}  ·  ${g.city.districtAt(p.x, p.y)}`, W / 2, 34);

  // Objective, bottom-center.
  const obj = g.missions.objectiveText();
  ctx.font = 'bold 15px sans-serif';
  const ow = ctx.measureText(obj).width + 28;
  pill(ctx, W / 2 - ow / 2, H - 52, ow, 32, 'rgba(10,12,20,0.78)');
  ctx.fillStyle = '#ffd23e';
  ctx.textAlign = 'center';
  ctx.fillText(obj, W / 2, H - 31);

  // Speed + hint, bottom-right / bottom-left.
  if (!p.onFoot && p.car) {
    const mph = Math.round(Math.abs(p.car.speed) * 0.18);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 26px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`${mph}`, W - 26, H - 66);
    ctx.fillStyle = '#c9c9c9';
    ctx.font = '12px sans-serif';
    ctx.fillText('MPH', W - 26, H - 50);
  }
  if (g.hint) {
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(g.hint, 16, H - 66);
  }

  // Off-screen marker arrow.
  const marker = g.missions.marker();
  if (marker) {
    const s = g.worldToScreen(marker.x, marker.y);
    if (s.x < 40 || s.x > W - 40 || s.y < 40 || s.y > H - 40) {
      const cx = W / 2;
      const cy = H / 2;
      const ang = Math.atan2(s.y - cy, s.x - cx);
      const ax = cx + Math.cos(ang) * 300;
      const ay = cy + Math.sin(ang) * 200;
      ctx.save();
      ctx.translate(ax, ay);
      ctx.rotate(ang);
      ctx.fillStyle = '#ffd23e';
      ctx.beginPath();
      ctx.moveTo(16, 0);
      ctx.lineTo(-10, -10);
      ctx.lineTo(-4, 0);
      ctx.lineTo(-10, 10);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  // Banner.
  if (g.banner && g.banner.t > 0) {
    const a = Math.min(1, g.banner.t);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.textAlign = 'center';
    ctx.font = 'bold 26px sans-serif';
    const titleW = ctx.measureText(g.banner.title).width;
    ctx.font = '15px sans-serif';
    const subW = g.banner.sub ? ctx.measureText(g.banner.sub).width : 0;
    const bw = Math.min(1160, Math.max(560, Math.max(titleW, subW) + 48));
    pill(ctx, W / 2 - bw / 2, 84, bw, g.banner.sub ? 74 : 52, 'rgba(10,12,20,0.88)');
    ctx.fillStyle = '#ffd23e';
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText(g.banner.title, W / 2, 118);
    if (g.banner.sub) {
      ctx.fillStyle = '#fff';
      ctx.font = '15px sans-serif';
      ctx.fillText(g.banner.sub, W / 2, 144);
    }
    ctx.restore();
  }

  // Damage flash.
  if (p.hurtFlash > 0) {
    const a = Math.min(0.45, p.hurtFlash * 0.7);
    const grad = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.75);
    grad.addColorStop(0, 'rgba(255,0,0,0)');
    grad.addColorStop(1, `rgba(255,0,0,${a})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }
  // Low HP pulse.
  if (p.hp > 0 && p.hp <= 25) {
    const a = 0.12 + Math.sin(performance.now() / 240) * 0.08;
    ctx.fillStyle = `rgba(255,0,0,${a})`;
    ctx.fillRect(0, 0, W, H);
  }
}

export function drawMenu(ctx, g, hasSave, save) {
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;
  ctx.fillStyle = 'rgba(8,10,22,0.55)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd23e';
  ctx.font = 'bold 92px sans-serif';
  ctx.fillText('SOLMAR', W / 2, 170);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 26px sans-serif';
  ctx.fillText('S T R E E T S   O F   S O L M A R', W / 2, 208);
  ctx.fillStyle = '#ffe9a8';
  ctx.font = '16px sans-serif';
  ctx.fillText('One driver. One city. Every job pays — if you live to collect.', W / 2, 244);

  ctx.fillStyle = '#fff';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText(hasSave ? 'ENTER — Continue' : 'ENTER — New Game', W / 2, 330);
  if (hasSave && save) {
    ctx.fillStyle = '#c9c9c9';
    ctx.font = '14px sans-serif';
    ctx.fillText(`Saved: $${save.cash}  ·  ${save.missionsDone || 0} jobs done  ·  $${save.totalEarned || 0} earned`, W / 2, 360);
  }

  ctx.fillStyle = '#e8e8e8';
  ctx.font = '15px sans-serif';
  let y = 420;
  for (const line of CONTROLS_TEXT) {
    ctx.fillText(line, W / 2, y);
    y += 24;
  }
  ctx.fillStyle = '#9a9a9a';
  ctx.font = '12px sans-serif';
  ctx.fillText('An original game. Not affiliated with any existing franchise. Sound starts on first key press — M mutes.', W / 2, H - 24);
}

export function drawPaused(ctx) {
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;
  ctx.fillStyle = 'rgba(8,10,22,0.7)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 48px sans-serif';
  ctx.fillText('PAUSED', W / 2, H / 2 - 20);
  ctx.font = '16px sans-serif';
  ctx.fillStyle = '#c9c9c9';
  ctx.fillText('P / Esc — resume      R — restart the day', W / 2, H / 2 + 24);
  let y = H / 2 + 70;
  for (const line of CONTROLS_TEXT) {
    ctx.fillText(line, W / 2, y);
    y += 22;
  }
}

export function drawEnd(ctx, kind, cashLost) {
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;
  ctx.fillStyle = kind === 'wasted' ? 'rgba(60,0,0,0.72)' : 'rgba(0,20,60,0.72)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = kind === 'wasted' ? '#ff5040' : '#5fa8ff';
  ctx.font = 'bold 72px sans-serif';
  ctx.fillText(kind === 'wasted' ? 'WASTED' : 'BUSTED', W / 2, H / 2 - 20);
  ctx.fillStyle = '#fff';
  ctx.font = '18px sans-serif';
  ctx.fillText(
    kind === 'wasted'
      ? `You flatlined on the streets of Solmar.  −$${cashLost}`
      : `The Solmar PD took you in. Bail set at $${cashLost}.`,
    W / 2, H / 2 + 24,
  );
  const blink = Math.floor(performance.now() / 500) % 2 === 0;
  if (blink) {
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('ENTER — respawn at St. Marina Hospital', W / 2, H / 2 + 70);
  }
}
