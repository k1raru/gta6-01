// The wanted system: crimes raise stars, police cars spawn and hunt the player,
// the heat cools off when the player stays clean and out of sight.
import { Car, dist } from './entities.js';
import { TUNING } from './config.js';

export class WantedSystem {
  constructor() {
    this.level = 0;
    this.heatTimer = 0;
    this.bustTimer = 0;
    this.spawnTimer = 0;
    this.cops = [];
  }

  addHeat(n, reason) {
    if (n <= 0) return;
    const before = this.level;
    this.level = Math.min(5, this.level + n);
    this.heatTimer = 0;
    if (this.level > before && this.level >= 3) {
      // Escalation is felt immediately: one more unit joins the chase soon.
      this.spawnTimer = Math.min(this.spawnTimer, 0.4);
    }
  }

  clearAll() {
    this.level = 0;
    this.heatTimer = 0;
    this.bustTimer = 0;
    for (const cop of this.cops) cop.dead = true;
    this.cops = [];
  }

  update(dt, player, city, world) {
    // Heat cools when the player stays clean and no cop is close.
    if (this.level > 0) {
      this.heatTimer += dt;
      let nearest = Infinity;
      for (const cop of this.cops) {
        if (cop.dead) continue;
        nearest = Math.min(nearest, dist(cop.x, cop.y, player.x, player.y));
      }
      if (this.heatTimer > TUNING.wantedDecaySeconds && nearest > 500) {
        this.level -= 1;
        this.heatTimer = 0;
      }
    }

    // Spawn cops up to the wanted level (one extra at 5 stars).
    const want = this.level === 5 ? 5 : this.level;
    const alive = this.cops.filter((c) => !c.dead).length;
    this.spawnTimer -= dt;
    if (alive < want && this.spawnTimer <= 0) {
      this.spawnTimer = 1.4;
      const spot = city.randomStreetPoint(world.rng);
      // Spawn on a road 550-750px away from the player.
      let tries = 0;
      let p = spot;
      while (dist(p.x, p.y, player.x, player.y) < 550 && tries < 8) {
        p = city.randomStreetPoint(world.rng);
        tries += 1;
      }
      const cop = new Car(p.x, p.y, 0, 'police', 'police');
      cop.speed = 200;
      this.cops.push(cop);
      world.cars.push(cop);
    }

    // Update cops, ramming and the bust rule.
    for (const cop of this.cops) {
      if (cop.dead) continue;
      cop.updatePolice(dt, player, city, world);
      const d = dist(cop.x, cop.y, player.x, player.y);
      if (player.onFoot) {
        if (d < 46 && cop.ramCooldown <= 0) {
          cop.ramCooldown = TUNING.copRamCooldown;
          player.damage(TUNING.copRamDamage, world);
          world.audio.thud();
          world.shake(4);
        }
        if (d < TUNING.bustDistance && player.speed < 40) {
          this.bustTimer += dt;
          if (this.bustTimer > TUNING.bustSeconds) {
            this.bustTimer = 0;
            world.onBusted();
          }
        } else {
          this.bustTimer = Math.max(0, this.bustTimer - dt * 2);
        }
      } else if (player.car) {
        if (d < 56 && cop.ramCooldown <= 0) {
          cop.ramCooldown = TUNING.copRamCooldown;
          player.car.speed *= 0.62;
          player.damage(3, world);
          world.fx.addSparks((cop.x + player.x) / 2, (cop.y + player.y) / 2);
          world.audio.thud();
          world.shake(5);
        }
      }
    }
    this.cops = this.cops.filter((c) => !c.dead);
  }
}
