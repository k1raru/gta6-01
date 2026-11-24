// Solmar — Streets of Solmar: game loop, states, camera, spawning and save wiring.
// An original open-world crime game: explore on foot or by car, steal cars, run
// missions for Vera Cruz, dodge the Solmar PD, and keep the heat off.
import { WORLD, TUNING, CAR_KINDS } from './config.js';
import { mulberry32, range, pick } from './random.js';
import { createCity } from './city.js';
import { initInput, isDown, wasPressed, endFrame } from './input.js';
import { AudioEngine } from './audio.js';
import { loadSave, saveGame } from './save.js';
import { Car, Ped, Player, dist } from './entities.js';
import { WantedSystem } from './police.js';
import { MissionManager } from './missions.js';
import { FX, drawWorld } from './render.js';
import { drawHUD, drawMenu, drawPaused, drawEnd } from './ui.js';

const TRAFFIC_KINDS = ['sedan', 'sedan', 'sedan', 'sport', 'taxi', 'taxi', 'van', 'pickup'];

export class Game {
  constructor(canvas, params) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.params = params || {};
    this.seed = Number(params.seed) || 7;
    this.rng = mulberry32(this.seed);
    this.audio = new AudioEngine();
    this.fx = new FX();
    this.time = 0;
    this.clockMin = 17 * 60 + 35;
    this.state = 'menu';
    this.cam = { x: 1600, y: 1200, zoom: 0.7 };
    this.banner = null;
    this.hint = '';
    this.muted = false;
    this.save = loadSave();
    if (this.save && this.save.muted) this.muted = true;
    this.stats = {
      totalEarned: 0, missionsDone: 0, carsStolen: 0, faresDone: 0, bestWanted: 0,
    };
    this.saveTimer = 0;
    this.inGarage = false;
    this.cashLost = 0;

    initInput(canvas);
    this.initWorld(false);
    this.missions = new MissionManager(this);

    window.addEventListener('keydown', () => this.audio.ensure(), { once: false });
    window.addEventListener('pointerdown', () => this.audio.ensure(), { once: false });

    if (this.params.shot) this.setupShot(this.params.shot);
    // In shot mode the mission banner stays up for the screenshot.
    if (this.params.shot && this.banner) this.banner.t = 30;
    this.last = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  }

  initWorld(fromSave) {
    this.city = createCity(this.seed);
    this.police = new WantedSystem();
    this.player = new Player(1600, 1470);
    this.cars = [];
    this.peds = [];
    if (fromSave && this.save) {
      this.player.cash = this.save.cash || TUNING.startCash;
      this.stats.totalEarned = this.save.totalEarned || 0;
      this.stats.missionsDone = this.save.missionsDone || 0;
      this.stats.carsStolen = this.save.carsStolen || 0;
      this.stats.faresDone = this.save.faresDone || 0;
      this.stats.bestWanted = this.save.bestWanted || 0;
    }
    this.spawnTraffic();
    this.spawnParked();
    this.spawnPeds();
  }

  spawnTraffic() {
    for (let i = 0; i < TUNING.trafficCount; i++) {
      const spot = this.city.randomStreetPoint(this.rng);
      const kind = pick(this.rng, TRAFFIC_KINDS);
      const car = new Car(spot.x, spot.y, 0, kind, 'traffic');
      car.axis = spot.axis;
      car.dir = spot.dir;
      car.angle = spot.axis === 'v' ? (spot.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (spot.dir > 0 ? 0 : Math.PI);
      car.speed = range(this.rng, 90, 140);
      this.cars.push(car);
    }
  }

  spawnParked() {
    for (let i = 0; i < TUNING.parkedCount; i++) {
      const spot = this.city.randomStreetPoint(this.rng);
      const kind = pick(this.rng, ['sedan', 'sedan', 'sport', 'van', 'pickup']);
      // Parked in the lane itself (the spot already carries the ±24 lane
      // offset): a car parked half on the sidewalk would clip buildings.
      const x = spot.x;
      const y = spot.y;
      if (this.city.pointInBuilding(x, y, 4)) continue;
      const angle = spot.axis === 'v' ? Math.PI / 2 : 0;
      this.cars.push(new Car(x, y, angle, kind, null));
    }
  }

  spawnPeds() {
    for (let i = 0; i < TUNING.pedCount; i++) {
      const spot = this.city.randomStreetPoint(this.rng);
      const off = 72;
      const x = spot.axis === 'v' ? spot.x + (this.rng() < 0.5 ? -off : off) : spot.x;
      const y = spot.axis === 'h' ? spot.y + (this.rng() < 0.5 ? -off : off) : spot.y;
      const ped = new Ped(x, y, this.rng);
      ped.setTarget(x + range(this.rng, -200, 200), y + range(this.rng, -200, 200));
      this.peds.push(ped);
    }
  }

  // ---- plumbing for the entity / mission / police modules ------------------
  showBanner(title, sub) {
    this.banner = { title, sub: sub || '', t: 4 };
  }

  shake(mag) {
    this.fx.shake(mag);
  }

  wreckCop(cop) {
    cop.dead = true;
    this.fx.addExplosion(cop.x, cop.y);
    this.audio.boom();
    this.shake(9);
    this.police.addHeat(1, 'cop down');
  }

  onWasted() {
    if (this.state !== 'playing') return;
    this.cashLost = Math.min(this.player.cash, TUNING.respawnCost);
    this.player.cash -= this.cashLost;
    this.state = 'wasted';
    this.police.clearAll();
    this.saveProgress();
    this.audio.boom();
  }

  onBusted() {
    if (this.state !== 'playing') return;
    this.cashLost = Math.min(this.player.cash, 150);
    this.player.cash -= this.cashLost;
    this.state = 'busted';
    this.police.clearAll();
    this.saveProgress();
  }

  saveProgress() {
    saveGame({
      cash: this.player.cash,
      missionsDone: this.stats.missionsDone,
      totalEarned: this.stats.totalEarned,
      carsStolen: this.stats.carsStolen,
      faresDone: this.stats.faresDone,
      bestWanted: this.stats.bestWanted,
      muted: this.muted,
    });
  }

  clockText() {
    const h = Math.floor(this.clockMin / 60) % 24;
    const m = Math.floor(this.clockMin % 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  worldToScreen(x, y) {
    const W = this.canvas.width;
    const H = this.canvas.height;
    return { x: (x - this.cam.x) * this.cam.zoom + W / 2, y: (y - this.cam.y) * this.cam.zoom + H / 2 };
  }

  startGame(fromSave) {
    this.initWorld(fromSave);
    this.missions = new MissionManager(this);
    this.state = 'playing';
    this.audio.ensure();
    if (fromSave && this.save) {
      const idx = Math.min(this.stats.missionsDone, 3);
      this.missions.start(idx);
      this.showBanner('Welcome Back', `Cash $${this.player.cash}  ·  ${this.stats.missionsDone} jobs done`);
    } else {
      this.missions.start(0);
    }
    this.cam.x = this.player.x;
    this.cam.y = this.player.y;
    this.cam.zoom = 1.05;
  }

  respawn() {
    const h = this.city.hospital;
    this.player.x = h.x + h.w / 2;
    this.player.y = h.y + h.h + 34;
    this.player.hp = TUNING.playerHp;
    this.player.onFoot = true;
    this.player.car = null;
    this.player.angle = -Math.PI / 2;
    this.state = 'playing';
    this.cam.x = this.player.x;
    this.cam.y = this.player.y;
  }

  // ---- screenshot scenes (?shot=...) ---------------------------------------
  setupShot(name) {
    this.startGame(false);
    const p = this.player;
    if (name === 'start') {
      this.state = 'menu';
      return;
    }
    if (name === 'play') {
      // Clear the road ahead so the drive reads at speed.
      this.cars = this.cars.filter((c) => !(c.y > 1250 && c.y < 1550 && c.x > 1200));
      const car = new Car(1560, 1400, 0, 'sport', 'player');
      car.speed = 300;
      this.cars.push(car);
      p.car = car;
      p.onFoot = false;
      p.x = car.x; p.y = car.y;
      this.missions.start(0);
      this.cam.zoom = 0.9;
      return;
    }
    if (name === 'chase') {
      // Clear the whole east run corridor (traffic AND parked cars) so the chase reads at speed.
      this.cars = this.cars.filter((c) => !(c.y > 800 && c.y < 1200 && c.x > 1000));
      const car = new Car(1400, 1000, 0, 'sport', 'player');
      car.speed = 360;
      this.cars.push(car);
      p.car = car;
      p.onFoot = false;
      p.x = car.x; p.y = car.y;
      this.police.level = 3;
      for (let i = 0; i < 2; i++) {
        const cop = new Car(850 - i * 90, 1000 + (i % 2) * 48, 0, 'police', 'police');
        cop.speed = 300;
        this.police.cops.push(cop);
        this.cars.push(cop);
      }
      this.missions.start(1);
      this.cam.zoom = 0.88;
      return;
    }
    if (name === 'foot') {
      p.x = 1600;
      p.y = 1470;
      p.angle = -Math.PI / 2;
      for (let i = 0; i < 6; i++) {
        const ped = new Ped(1560 + i * 26, 1420 + (i % 3) * 40, this.rng);
        this.peds.push(ped);
      }
      const near = new Car(1660, 1400, 0, 'sedan', 'traffic');
      this.cars.push(near);
      this.missions.start(0);
      this.cam.zoom = 1.05;
      return;
    }
  }

  // ---- main loop ------------------------------------------------------------
  loop(t) {
    const dt = Math.min(0.05, (t - this.last) / 1000 || 0.016);
    this.last = t;
    this.time += dt;
    this.update(dt);
    this.render();
    endFrame();
    requestAnimationFrame((tt) => this.loop(tt));
  }

  update(dt) {
    // Global keys.
    if (wasPressed('KeyM')) {
      this.muted = !this.muted;
      this.audio.setMuted(this.muted);
      this.showBanner(this.muted ? 'Sound Off' : 'Sound On', '');
    }
    if (this.banner) {
      this.banner.t -= dt;
      if (this.banner.t <= 0) this.banner = null;
    }

    if (this.state === 'menu') {
      // Ambient city behind the title.
      this.cam.x = 1600 + Math.cos(this.time * 0.06) * 420;
      this.cam.y = 1200 + Math.sin(this.time * 0.045) * 320;
      this.cam.zoom = 0.72;
      this.updateAmbient(dt);
      if (wasPressed('Enter')) this.startGame(!!this.save);
      return;
    }

    if (this.state === 'paused') {
      if (wasPressed('KeyP') || wasPressed('Escape')) this.state = 'playing';
      if (wasPressed('KeyR')) {
        this.initWorld(false);
        this.missions = new MissionManager(this);
        this.state = 'playing';
        this.missions.start(0);
      }
      return;
    }

    if (this.state === 'wasted' || this.state === 'busted') {
      if (wasPressed('Enter')) this.respawn();
      return;
    }

    // Playing.
    if (wasPressed('KeyP') || wasPressed('Escape')) {
      this.state = 'paused';
      return;
    }

    this.clockMin += dt / 5;
    this.stats.bestWanted = Math.max(this.stats.bestWanted, this.police.level);

    // Enter / exit car.
    if (wasPressed('KeyE')) {
      if (this.player.onFoot) this.player.tryEnterCar(this);
      else this.player.exitCar(this);
    }

    this.player.update(dt, this.city, this);
    for (const car of this.cars) {
      if (car.dead || car.driver === 'player') continue;
      if (car.driver === 'traffic') car.updateTraffic(dt, this.city, this);
    }
    this.cars = this.cars.filter((c) => !c.dead);
    this.police.update(dt, this.player, this.city, this);
    for (const ped of this.peds) ped.update(dt, this.city, this);
    this.missions.update(dt, this);
    this.fx.update(dt);

    // Spray & Go: drive in with heat and $200 to clear it.
    const gz = this.city.garageZone;
    const inZone = gz && this.player.x > gz.x && this.player.x < gz.x + gz.w
      && this.player.y > gz.y && this.player.y < gz.y + gz.h;
    if (inZone && this.police.level > 0 && this.player.cash >= TUNING.resprayCost && !this.inGarage) {
      this.inGarage = true;
      this.player.cash -= TUNING.resprayCost;
      this.police.clearAll();
      this.showBanner('Clean Ride', 'New paint, new plates. The heat is off.  −$200');
      this.audio.blip(990);
    }
    if (!inZone) this.inGarage = false;

    // Context hint.
    this.hint = this.computeHint();

    // Audio.
    const driving = !this.player.onFoot && this.player.car;
    this.audio.setEngine(driving ? Math.abs(this.player.car.speed) / this.player.car.maxSpeed : 0, driving);
    this.audio.setSiren(this.police.level > 0 && this.police.cops.length > 0, dt);
    this.audio.updateMusic(dt, true);

    // Camera.
    const zoomTarget = this.player.onFoot ? 1.05 : 0.88;
    this.cam.zoom += (zoomTarget - this.cam.zoom) * Math.min(1, dt * 2);
    this.cam.x += (this.player.x - this.cam.x) * Math.min(1, dt * 5);
    this.cam.y += (this.player.y - this.cam.y) * Math.min(1, dt * 5);

    // Autosave.
    this.saveTimer += dt;
    if (this.saveTimer > 20) {
      this.saveTimer = 0;
      this.saveProgress();
    }
  }

  updateAmbient(dt) {
    for (const car of this.cars) {
      if (car.dead || car.driver !== 'traffic') continue;
      car.updateTraffic(dt, this.city, this);
    }
    for (const ped of this.peds) ped.update(dt, this.city, this);
    this.fx.update(dt);
  }

  computeHint() {
    const p = this.player;
    if (this.time < 14) return 'WASD — move / drive  ·  E — enter a car  ·  F — punch';
    if (p.onFoot) {
      for (const car of this.cars) {
        if (!car.dead && car.kind !== 'police' && dist(p.x, p.y, car.x, car.y) < TUNING.enterCarRange) {
          return car.driver === 'traffic' ? 'E — Jack the car' : 'E — Get in the car';
        }
      }
      const s = this.missions.currentStep;
      if (s && s.type === 'pickup' && dist(p.x, p.y, s.x, s.y) < s.r) return 'E — Pick up';
      if (this.missions.farePed) return 'Grab a car to pick up the fare ($)';
      return '';
    }
    if (this.police.level > 0 && this.player.cash >= TUNING.resprayCost) {
      return 'Spray & Go (south-west) clears the heat — $200';
    }
    return 'Space — handbrake  ·  E — get out';
  }

  render() {
    const ctx = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0b0e1a';
    ctx.fillRect(0, 0, W, H);

    const shx = (Math.random() - 0.5) * this.fx.shakeMag;
    const shy = (Math.random() - 0.5) * this.fx.shakeMag;
    ctx.setTransform(
      this.cam.zoom, 0, 0, this.cam.zoom,
      W / 2 - this.cam.x * this.cam.zoom + shx,
      H / 2 - this.cam.y * this.cam.zoom + shy,
    );
    drawWorld(ctx, this.cam, this.city, this, this.time);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (this.state === 'menu') drawMenu(ctx, this, !!this.save, this.save);
    else if (this.state === 'paused') drawPaused(ctx);
    else if (this.state === 'wasted') drawEnd(ctx, 'wasted', this.cashLost);
    else if (this.state === 'busted') drawEnd(ctx, 'busted', this.cashLost);
    else drawHUD(ctx, this);
  }
}

// Boot.
const canvas = document.getElementById('game');
const params = new URLSearchParams(window.location.search);
const game = new Game(canvas, {
  shot: params.get('shot'),
  seed: params.get('seed'),
});
window.__game = game;
setTimeout(() => { window.__shotReady = true; }, 1200);
