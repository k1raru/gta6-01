// Entities: the player (on foot or driving), traffic and police cars, pedestrians.
// All physics is arcade-style and original to this game.
import { CAR_KINDS, TUNING, ROADS_V, ROADS_H, ROAD_W } from './config.js';
import { range, pick } from './random.js';
import { axis as inputAxis, isDown, wasPressed, consumeMousePress } from './input.js';

export function angleLerp(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

export function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export class Car {
  constructor(x, y, angle, kind, driver) {
    const def = CAR_KINDS[kind];
    this.x = x; this.y = y; this.angle = angle;
    this.kind = kind; this.driver = driver; // 'player' | 'traffic' | 'police' | null
    this.len = def.len; this.wid = def.wid;
    this.maxSpeed = def.maxSpeed; this.accel = def.accel;
    this.color = def.color;
    this.speed = 0;
    this.hp = kind === 'police' ? 3 : (kind === 'armored' ? 5 : 999);
    this.axis = 'h'; this.dir = 1; this.lane = 24;
    this.stuckTimer = 0; this.reverseTimer = 0;
    this.ramCooldown = 0;
    this.dead = false;
    this.skidTimer = 0;
    this.lastTurnKey = '';
    this.honkTimer = 0;
  }

  radius() {
    return this.len * 0.42;
  }

  // ---- player driving -----------------------------------------------------
  updatePlayer(dt, city, world) {
    const throttle = (isDown('KeyW') || isDown('ArrowUp')) ? 1 : 0;
    const brake = (isDown('KeyS') || isDown('ArrowDown')) ? 1 : 0;
    const steerL = isDown('KeyA') || isDown('ArrowLeft');
    const steerR = isDown('KeyD') || isDown('ArrowRight');
    const handbrake = isDown('Space');

    if (throttle) this.speed += this.accel * dt;
    if (brake) {
      if (this.speed > 20) this.speed -= this.accel * 1.4 * dt;
      else this.speed -= this.accel * 0.7 * dt;
    }
    if (!throttle && !brake) this.speed -= this.speed * 0.55 * dt;
    if (handbrake) {
      this.speed -= this.speed * 1.8 * dt;
      if (Math.abs(this.speed) > 120) {
        this.skidTimer -= dt;
        if (this.skidTimer <= 0) {
          this.skidTimer = 0.05;
          world.fx.addSkid(this.x, this.y, this.angle);
          world.fx.addSmoke(this.x - Math.cos(this.angle) * 20, this.y - Math.sin(this.angle) * 20);
        }
      }
    }
    this.speed = Math.max(-130, Math.min(this.maxSpeed, this.speed));
    if (Math.abs(this.speed) < 4 && !throttle) this.speed = 0;

    const steer = (steerL ? -1 : 0) + (steerR ? 1 : 0);
    const grip = Math.min(1, Math.abs(this.speed) / 140);
    const turnRate = (handbrake ? 3.4 : 2.5) * grip * (this.speed < 0 ? -1 : 1);
    this.angle += steer * turnRate * dt;

    this.move(dt, city, world, true);
    this.ramCooldown = Math.max(0, this.ramCooldown - dt);
  }

  // ---- traffic AI: follow the road grid, turn at intersections ------------
  updateTraffic(dt, city, world) {
    const targetSpeed = 130;
    // Car ahead? Brake.
    let blocked = false;
    for (const other of world.cars) {
      if (other === this || other.dead) continue;
      const dx = other.x - this.x;
      const dy = other.y - this.y;
      const fx = Math.cos(this.angle);
      const fy = Math.sin(this.angle);
      const ahead = dx * fx + dy * fy;
      const side = Math.abs(-dx * fy + dy * fx);
      if (ahead > 0 && ahead < 85 && side < 30) { blocked = true; break; }
    }
    if (blocked) this.speed = Math.max(0, this.speed - 300 * dt);
    else this.speed += (targetSpeed - this.speed) * Math.min(1, dt * 1.2);

    // Maybe turn at an intersection.
    const cross = this.axis === 'v' ? ROADS_H : ROADS_V;
    const along = this.axis === 'v' ? this.y : this.x;
    for (const c of cross) {
      const key = `${this.axis}:${c}`;
      if (Math.abs(along - c) < 26 && this.lastTurnKey !== key) {
        this.lastTurnKey = key;
        if (world.rng() < 0.28) {
          const newDir = world.rng() < 0.5 ? 1 : -1;
          if (this.axis === 'v') {
            this.axis = 'h'; this.dir = newDir;
            this.y = c + (newDir > 0 ? 24 : -24);
            this.angle = newDir > 0 ? 0 : Math.PI;
          } else {
            this.axis = 'v'; this.dir = newDir;
            this.x = c + (newDir > 0 ? 24 : -24);
            this.angle = newDir > 0 ? Math.PI / 2 : -Math.PI / 2;
          }
        }
        break;
      }
    }

    this.move(dt, city, world, false);

    // Off the map: respawn on a random street far from the player.
    const p = world.player;
    if (this.x < 60 || this.x > 3140 || this.y < 60 || this.y > 2320) {
      const spot = city.randomStreetPoint(world.rng);
      if (dist(spot.x, spot.y, p.x, p.y) > 500) {
        this.x = spot.x; this.y = spot.y; this.axis = spot.axis; this.dir = spot.dir;
        this.angle = spot.axis === 'v' ? (spot.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (spot.dir > 0 ? 0 : Math.PI);
        this.speed = 100;
      }
    }
  }

  // ---- police pursuit ------------------------------------------------------
  updatePolice(dt, target, city, world) {
    const dx = target.x - this.x;
    const dy = target.y - this.y;
    const d = Math.hypot(dx, dy) || 1;
    const want = Math.atan2(dy, dx);
    this.angle = angleLerp(this.angle, want, Math.min(1, dt * 3.4));
    const level = world.police.level;
    const top = 300 + level * 26;
    this.speed += (top - this.speed) * Math.min(1, dt * 0.9);
    if (this.stuckTimer > 1.4 && this.reverseTimer <= 0) {
      this.reverseTimer = 0.7;
      this.stuckTimer = 0;
    }
    if (this.reverseTimer > 0) {
      this.reverseTimer -= dt;
      this.speed = -120;
    }
    this.move(dt, city, world, true);
    if (Math.abs(this.speed) < 25) this.stuckTimer += dt;
    else this.stuckTimer = 0;
    this.ramCooldown = Math.max(0, this.ramCooldown - dt);
    this.honkTimer = Math.max(0, this.honkTimer - dt);
  }

  move(dt, city, world, solid) {
    const nx = this.x + Math.cos(this.angle) * this.speed * dt;
    const ny = this.y + Math.sin(this.angle) * this.speed * dt;
    const before = { x: this.x, y: this.y };
    const fixed = city.resolveCircle(nx, ny, this.radius());
    const hitWall = Math.abs(fixed.x - nx) > 0.5 || Math.abs(fixed.y - ny) > 0.5;
    this.x = fixed.x;
    this.y = fixed.y;
    if (hitWall && solid) {
      if (Math.abs(this.speed) > 160) {
        world.fx.addSmoke(this.x, this.y, 6);
        world.audio.thud();
        if (this.driver === 'player') world.shake(5);
      }
      this.speed *= 0.35;
      // Slide along the wall instead of stopping dead.
      const moved = dist(before.x, before.y, this.x, this.y);
      if (moved < 1 && Math.abs(this.speed) > 30) this.angle += 0.6 * dt * 10;
    }
    // Car-car collisions.
    for (const other of world.cars) {
      if (other === this || other.dead) continue;
      const rr = this.radius() + other.radius();
      const dx = other.x - this.x;
      const dy = other.y - this.y;
      const d = Math.hypot(dx, dy);
      if (d > 0.01 && d < rr) {
        const push = (rr - d) / 2;
        const nx2 = dx / d;
        const ny2 = dy / d;
        this.x -= nx2 * push;
        this.y -= ny2 * push;
        other.x += nx2 * push;
        other.y += ny2 * push;
        const rel = Math.abs(this.speed - other.speed);
        if (rel > 170 && this.ramCooldown <= 0) {
          this.ramCooldown = 0.5;
          other.ramCooldown = 0.5;
          world.fx.addSparks((this.x + other.x) / 2, (this.y + other.y) / 2);
          world.audio.thud();
          if (this.driver === 'player' || other.driver === 'player') world.shake(4);
          // Ramming a police car hard wrecks it.
          const cop = this.kind === 'police' ? this : (other.kind === 'police' ? other : null);
          const rammer = cop === this ? other : this;
          if (cop && rammer.driver === 'player' && rel > 210) {
            cop.hp -= 1;
            if (cop.hp <= 0) world.wreckCop(cop);
          }
        }
        this.speed *= 0.82;
        other.speed *= 0.82;
      }
    }
  }

  draw(ctx, time) {
    ctx.save();
    ctx.translate(this.x, this.y);
    // Halo under the player's own car so it reads as the hero car.
    if (this.driver === 'player') {
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      ctx.beginPath();
      ctx.ellipse(0, 0, this.len / 2 + 10, this.wid / 2 + 10, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // Shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    roundRect(ctx, -this.len / 2 + 3, -this.wid / 2 + 4, this.len, this.wid, 7);
    ctx.fill();
    ctx.rotate(this.angle);
    // Wheels.
    ctx.fillStyle = '#16181d';
    const wl = this.len * 0.32;
    const ww = 7;
    ctx.fillRect(-wl, -this.wid / 2 - 2, 14, ww);
    ctx.fillRect(wl - 8, -this.wid / 2 - 2, 14, ww);
    ctx.fillRect(-wl, this.wid / 2 - 5, 14, ww);
    ctx.fillRect(wl - 8, this.wid / 2 - 5, 14, ww);
    // Body.
    ctx.fillStyle = this.color;
    roundRect(ctx, -this.len / 2, -this.wid / 2, this.len, this.wid, 8);
    ctx.fill();
    // Hood / trunk shading.
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    roundRect(ctx, this.len / 2 - 14, -this.wid / 2 + 3, 11, this.wid - 6, 4);
    ctx.fill();
    // Windshield + roof.
    ctx.fillStyle = '#20262e';
    roundRect(ctx, this.len * 0.08, -this.wid / 2 + 4, 12, this.wid - 8, 3);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    roundRect(ctx, -this.len * 0.22, -this.wid / 2 + 4, 16, this.wid - 8, 3);
    ctx.fill();
    if (this.kind === 'taxi') {
      ctx.fillStyle = '#16181d';
      for (let i = 0; i < 4; i++) ctx.fillRect(-this.len / 2 + 6 + i * 9, -2, 5, 4);
    }
    if (this.kind === 'police') {
      ctx.fillStyle = '#16181d';
      ctx.fillRect(-6, -this.wid / 2 + 2, 10, 4);
      ctx.fillRect(-6, this.wid / 2 - 6, 10, 4);
      // Flashing light bar.
      const flash = Math.floor(time * 6) % 2 === 0;
      ctx.fillStyle = flash ? '#ff2e2e' : '#2e7bff';
      roundRect(ctx, -8, -this.wid / 2 - 1, 10, 5, 2);
      ctx.fill();
      ctx.fillStyle = flash ? '#2e7bff' : '#ff2e2e';
      roundRect(ctx, -8, this.wid / 2 - 4, 10, 5, 2);
      ctx.fill();
    }
    // Headlights / taillights.
    ctx.fillStyle = '#ffe9a8';
    ctx.beginPath(); ctx.arc(this.len / 2 - 2, -this.wid / 2 + 5, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(this.len / 2 - 2, this.wid / 2 - 5, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ff3b30';
    ctx.beginPath(); ctx.arc(-this.len / 2 + 2, -this.wid / 2 + 5, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(-this.len / 2 + 2, this.wid / 2 - 5, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}

const PED_SHIRTS = ['#d94f3d', '#3d7dd9', '#e8b13c', '#5fae6a', '#8e44ad', '#e87ea1', '#3db8a6', '#f2f2f2'];

export class Ped {
  constructor(x, y, rng) {
    this.x = x; this.y = y;
    this.angle = rng() * Math.PI * 2;
    this.speed = range(rng, 42, 72);
    this.color = pick(rng, PED_SHIRTS);
    this.skin = pick(rng, ['#f2c79b', '#c98d5f', '#8a5a3b', '#e8b88a']);
    this.state = 'walk';
    this.tx = x; this.ty = y;
    this.downTimer = 0; this.fleeTimer = 0;
    this.fare = false;
    this.dead = false;
    this.fx = 0; this.fy = 0; // knock velocity when hit
  }

  setTarget(x, y) { this.tx = x; this.ty = y; }

  update(dt, city, world) {
    if (this.state === 'down') {
      this.downTimer -= dt;
      this.x += this.fx * dt;
      this.y += this.fy * dt;
      this.fx *= 0.9; this.fy *= 0.9;
      const fixed = city.resolveCircle(this.x, this.y, 10);
      this.x = fixed.x; this.y = fixed.y;
      if (this.downTimer <= 0) {
        this.state = 'flee';
        this.fleeTimer = 2;
      }
      return;
    }
    let tx = this.tx;
    let ty = this.ty;
    let speed = this.speed;
    if (this.state === 'flee') {
      this.fleeTimer -= dt;
      const p = world.player;
      const d = Math.hypot(this.x - p.x, this.y - p.y) || 1;
      tx = this.x + ((this.x - p.x) / d) * 200;
      ty = this.y + ((this.y - p.y) / d) * 200;
      speed = 210;
      if (this.fleeTimer <= 0) this.state = 'walk';
    }
    const dx = tx - this.x;
    const dy = ty - this.y;
    const d = Math.hypot(dx, dy);
    if (d < 12) {
      // New sidewalk waypoint.
      const spot = city.randomStreetPoint(world.rng);
      const off = ROAD_W / 2 + 22;
      if (spot.axis === 'v') {
        this.tx = spot.x + (world.rng() < 0.5 ? -off : off);
        this.ty = spot.y;
      } else {
        this.tx = spot.x;
        this.ty = spot.y + (world.rng() < 0.5 ? -off : off);
      }
      return;
    }
    this.angle = Math.atan2(dy, dx);
    this.x += (dx / d) * speed * dt;
    this.y += (dy / d) * speed * dt;
    const fixed = city.resolveCircle(this.x, this.y, 9);
    this.x = fixed.x; this.y = fixed.y;
  }

  knockDown(fromX, fromY, world) {
    this.state = 'down';
    this.downTimer = 3;
    const d = Math.hypot(this.x - fromX, this.y - fromY) || 1;
    this.fx = ((this.x - fromX) / d) * 260;
    this.fy = ((this.y - fromY) / d) * 260;
    world.fx.addSparks(this.x, this.y);
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(1, 2, 9, 6, 0, 0, Math.PI * 2); ctx.fill();
    if (this.state === 'down') {
      ctx.rotate(this.angle + Math.PI / 2);
      ctx.fillStyle = this.color;
      roundRect(ctx, -9, -5, 18, 10, 5);
      ctx.fill();
      ctx.fillStyle = this.skin;
      ctx.beginPath(); ctx.arc(12, 0, 5, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.rotate(this.angle);
      ctx.fillStyle = this.color;
      ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = this.skin;
      ctx.beginPath(); ctx.arc(6, 0, 5, 0, Math.PI * 2); ctx.fill();
      // Walking bob.
      const bob = Math.sin(performance.now() / 90 + this.x) * 1.5;
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath(); ctx.arc(-6, -3 + bob * 0.4, 2.4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(-6, 3 - bob * 0.4, 2.4, 0, Math.PI * 2); ctx.fill();
    }
    if (this.fare) {
      ctx.restore();
      ctx.save();
      ctx.translate(this.x, this.y - 22);
      ctx.fillStyle = '#ffd23e';
      ctx.font = 'bold 15px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('$', 0, 0);
      ctx.restore();
      return;
    }
    ctx.restore();
  }
}

export class Player {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.angle = -Math.PI / 2;
    this.speed = 0;
    this.hp = TUNING.playerHp;
    this.cash = TUNING.startCash;
    this.onFoot = true;
    this.car = null;
    this.punchCooldown = 0;
    this.punchAnim = 0;
    this.walkPhase = 0;
    this.hurtFlash = 0;
  }

  get moving() {
    return this.onFoot ? this.speed > 10 : (this.car ? Math.abs(this.car.speed) > 10 : false);
  }

  update(dt, city, world) {
    this.punchCooldown = Math.max(0, this.punchCooldown - dt);
    this.punchAnim = Math.max(0, this.punchAnim - dt);
    this.hurtFlash = Math.max(0, this.hurtFlash - dt);

    if (!this.onFoot && this.car) {
      this.car.updatePlayer(dt, city, world);
      this.x = this.car.x;
      this.y = this.car.y;
      this.angle = this.car.angle;
      this.speed = Math.abs(this.car.speed);
      // Car vs ped collisions.
      for (const ped of world.peds) {
        if (ped.state === 'down' || ped.dead) continue;
        const d = dist(this.x, this.y, ped.x, ped.y);
        if (d < this.car.radius() + 8 && Math.abs(this.car.speed) > 60) {
          ped.knockDown(this.x, this.y, world);
          world.police.addHeat(1, 'pedestrian');
          world.audio.thud();
          world.shake(3);
        }
      }
      return;
    }

    // On foot.
    const a = inputAxis();
    const len = Math.hypot(a.x, a.y);
    const running = isDown('ShiftLeft') || isDown('ShiftRight');
    const top = running ? TUNING.playerRun : TUNING.playerWalk;
    if (len > 0) {
      const nx = a.x / len;
      const ny = a.y / len;
      this.angle = Math.atan2(ny, nx);
      this.speed = top;
      this.walkPhase += dt * (running ? 13 : 9);
      const px = this.x + nx * top * dt;
      const py = this.y + ny * top * dt;
      const fixed = city.resolveCircle(px, py, TUNING.playerRadius);
      this.x = fixed.x;
      this.y = fixed.y;
    } else {
      this.speed = 0;
    }

    // Punch.
    if ((wasPressed('KeyF') || consumeMousePress()) && this.punchCooldown <= 0) {
      this.punchCooldown = TUNING.punchCooldown;
      this.punchAnim = 0.22;
      const px = this.x + Math.cos(this.angle) * 26;
      const py = this.y + Math.sin(this.angle) * 26;
      for (const ped of world.peds) {
        if (ped.state === 'down' || ped.dead) continue;
        if (dist(px, py, ped.x, ped.y) < TUNING.punchRange) {
          ped.knockDown(this.x, this.y, world);
          world.police.addHeat(1, 'assault');
          world.audio.thud();
          break;
        }
      }
    }
  }

  tryEnterCar(world) {
    let best = null;
    let bd = TUNING.enterCarRange;
    for (const car of world.cars) {
      if (car.dead || car.kind === 'police') continue;
      const d = dist(this.x, this.y, car.x, car.y);
      if (d < bd) { bd = d; best = car; }
    }
    if (!best) return null;
    // Jacking a moving traffic car: its driver bails and flees.
    if (best.driver === 'traffic') {
      const ped = new Ped(best.x, best.y, world.rng);
      ped.state = 'flee';
      ped.fleeTimer = 3;
      world.peds.push(ped);
      world.police.addHeat(1, 'carjacking');
      world.stats.carsStolen += 1;
    }
    best.driver = 'player';
    best.speed = 0;
    this.car = best;
    this.onFoot = false;
    world.audio.blip(520);
    return best;
  }

  exitCar(world) {
    if (!this.car) return;
    const car = this.car;
    car.driver = null;
    car.speed = 0;
    const side = this.angle + Math.PI / 2;
    const px = car.x + Math.cos(side) * 34;
    const py = car.y + Math.sin(side) * 34;
    const fixed = world.city.resolveCircle(px, py, TUNING.playerRadius);
    this.x = fixed.x;
    this.y = fixed.y;
    this.car = null;
    this.onFoot = true;
  }

  damage(amount, world) {
    this.hp -= amount;
    this.hurtFlash = 0.5;
    if (this.hp <= 0) {
      this.hp = 0;
      world.onWasted();
    }
  }

  draw(ctx) {
    if (!this.onFoot) return;
    ctx.save();
    ctx.translate(this.x, this.y);
    // White ring so the player reads clearly among pedestrians.
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(0, 0, 16, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(1, 3, 11, 7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.rotate(this.angle);
    // Jacket.
    ctx.fillStyle = '#2e6db4';
    ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e8e8e8';
    ctx.beginPath(); ctx.arc(3, 0, 6, 0, Math.PI * 2); ctx.fill();
    // Head.
    ctx.fillStyle = '#f2c79b';
    ctx.beginPath(); ctx.arc(8, 0, 6.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2b2b2b';
    ctx.beginPath(); ctx.arc(9, -2, 4, Math.PI * 0.6, Math.PI * 1.7); ctx.fill();
    // Punch swing.
    if (this.punchAnim > 0) {
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(14, 0, 12, -0.9, 0.9);
      ctx.stroke();
    }
    // Feet.
    const bob = Math.sin(this.walkPhase) * 2;
    ctx.fillStyle = '#222';
    ctx.beginPath(); ctx.arc(-8, -4 + bob * 0.5, 2.6, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(-8, 4 - bob * 0.5, 2.6, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}
