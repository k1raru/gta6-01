// Missions and side jobs. Story: Jace Marlowe, a driver for hire in Solmar City,
// takes jobs from Vera Cruz at Club Lumen. All names and places are original.
import { Car, Ped, dist } from './entities.js';
import { wasPressed } from './input.js';

export const MISSIONS = [
  {
    id: 'pickup',
    title: 'The Pickup',
    giver: 'Vera Cruz',
    briefing: 'A package is waiting at the Solmar Docks. Bring it to Club Lumen. No questions.',
    reward: 400,
    timeLimit: 200,
    steps: [
      { type: 'goto', x: 110, y: 1200, r: 70, label: 'Drive to the Solmar Docks' },
      { type: 'pickup', x: 110, y: 1200, r: 80, label: 'Pick up the package  (E)' },
      { type: 'deliver', x: 1600, y: 1200, r: 90, label: 'Deliver the package to Club Lumen' },
    ],
  },
  {
    id: 'hotwheels',
    title: 'Hot Wheels',
    giver: 'Vera Cruz',
    briefing: 'A Comet GT is parked up in Palm Heights. Borrow it. Bring it to Spray & Go.',
    reward: 600,
    timeLimit: 220,
    steps: [
      { type: 'goto', x: 2700, y: 400, r: 130, label: 'Find a Comet GT in Palm Heights' },
      { type: 'steal', kind: 'sport', label: 'Steal the Comet GT  (E)' },
      { type: 'deliver', x: 800, y: 2000, r: 90, label: 'Bring it to Spray & Go' },
    ],
  },
  {
    id: 'fares',
    title: 'Fare Game',
    giver: 'Vera Cruz',
    briefing: 'Three fares, three drop-offs, one clock. The city pays drivers who are fast.',
    reward: 750,
    timeLimit: 260,
    steps: [
      { type: 'farePickup', label: 'Pick up the fare' },
      { type: 'fareDeliver', label: 'Drop the fare off' },
      { type: 'farePickup', label: 'Pick up the next fare' },
      { type: 'fareDeliver', label: 'Drop the fare off' },
      { type: 'farePickup', label: 'Pick up the last fare' },
      { type: 'fareDeliver', label: 'Drop the fare off' },
    ],
  },
  {
    id: 'bigscore',
    title: 'The Big Score',
    giver: 'Vera Cruz',
    briefing: 'An armored van leaves the National Bank at noon. Take it to the warehouse. Expect company.',
    reward: 1500,
    timeLimit: 300,
    steps: [
      { type: 'goto', x: 400, y: 400, r: 100, label: 'Reach Solmar National Bank' },
      { type: 'steal', kind: 'armored', label: 'Take the armored van  (E)' },
      { type: 'deliver', x: 400, y: 1600, r: 100, label: 'Deliver the van to the Dockside Warehouse' },
    ],
  },
];

const FARE_DESTS = [
  { x: 1600, y: 1200, label: 'Club Lumen' },
  { x: 2800, y: 200, label: 'Palm Heights' },
  { x: 400, y: 400, label: 'Solmar National Bank' },
  { x: 2800, y: 400, label: 'Palm Heights' },
  { x: 800, y: 2000, label: 'Spray & Go' },
  { x: 2000, y: 1200, label: 'Marina Bay' },
  { x: 1200, y: 200, label: 'Neon Mile' },
  { x: 400, y: 1600, label: 'Dockside Warehouse' },
];

export class MissionManager {
  constructor(world) {
    this.world = world;
    this.index = 0;
    this.step = 0;
    this.active = false;
    this.timer = 0;
    this.farePed = null;
    this.fareDest = null;
    this.fareActive = false;
    this.freeRoamTimer = 0;
    this.done = false;
  }

  get current() {
    return MISSIONS[this.index] || null;
  }

  get currentStep() {
    const m = this.current;
    return m ? m.steps[this.step] : null;
  }

  start(index) {
    const m = MISSIONS[index];
    if (!m) return;
    this.index = index;
    this.step = 0;
    this.active = true;
    this.timer = m.timeLimit;
    this.farePed = null;
    this.fareDest = null;
    this.fareActive = false;
    const world = this.world;
    // The Big Score parks its armored van at the bank (once).
    if (m.id === 'bigscore' && !world.cars.some((c) => c.kind === 'armored')) {
      const van = new Car(430, 470, Math.PI / 2, 'armored', null);
      world.cars.push(van);
    }
    // Hot Wheels parks a Comet GT in Palm Heights (once).
    if (m.id === 'hotwheels' && !world.cars.some((c) => c.kind === 'sport' && c.driver !== 'player')) {
      const gt = new Car(2700, 400, 0, 'sport', null);
      world.cars.push(gt);
    }
    world.showBanner(m.title, `${m.giver}: ${m.briefing}`);
    world.audio.blip(660);
  }

  startNext() {
    if (this.index + 1 < MISSIONS.length) this.start(this.index + 1);
    else {
      this.active = false;
      this.done = true;
      this.world.showBanner('City Legend', 'Every job done. Solmar is yours now — grab fares and stay fast.');
    }
  }

  // Where the HUD arrow and minimap marker should point.
  marker() {
    const s = this.currentStep;
    if (!s) {
      if (this.farePed) return { x: this.farePed.x, y: this.farePed.y };
      return null;
    }
    if (s.type === 'farePickup' && this.farePed) return { x: this.farePed.x, y: this.farePed.y };
    if (s.type === 'fareDeliver' && this.fareDest) return { x: this.fareDest.x, y: this.fareDest.y };
    if (s.type === 'steal') return null;
    return { x: s.x, y: s.y };
  }

  objectiveText() {
    const s = this.currentStep;
    if (!s) return this.done ? 'Free roam — grab a fare ($)' : 'Talk to Vera to start work';
    let text = s.label;
    if (s.type === 'fareDeliver' && this.fareDest) text = `Drop the fare at ${this.fareDest.label}`;
    if (s.type === 'farePickup') text = 'Pick up the fare ($)';
    if (this.timer > 0 && this.active) text += `  ·  ${Math.ceil(this.timer)}s`;
    return text;
  }

  spawnFare(world) {
    const player = world.player;
    const rng = world.rng;
    const spot = world.city.randomStreetPoint(rng);
    let tries = 0;
    while (dist(spot.x, spot.y, player.x, player.y) < 350 && tries < 10) {
      const s2 = world.city.randomStreetPoint(rng);
      spot.x = s2.x; spot.y = s2.y;
      tries += 1;
    }
    const ped = new Ped(spot.x, spot.y, rng);
    ped.fare = true;
    ped.speed = 0;
    world.peds.push(ped);
    this.farePed = ped;
    // Destination far from the pickup.
    let dest = FARE_DESTS[Math.floor(rng() * FARE_DESTS.length)];
    tries = 0;
    while (dist(dest.x, dest.y, spot.x, spot.y) < 500 && tries < 10) {
      dest = FARE_DESTS[Math.floor(rng() * FARE_DESTS.length)];
      tries += 1;
    }
    this.fareDest = dest;
  }

  advance(world) {
    const completed = this.currentStep;
    this.step += 1;
    const m = this.current;
    if (completed && completed.type === 'steal' && m.id === 'bigscore') {
      // Taking the van trips the alarm.
      world.police.addHeat(3, 'heist');
      world.showBanner('Alarm!', 'The bank alarm is screaming. Outrun it.');
    }
    if (this.step >= m.steps.length) {
      const reward = m.reward;
      world.player.cash += reward;
      world.stats.totalEarned += reward;
      world.stats.missionsDone += 1;
      world.showBanner('Job Done', `+$${reward}  ·  ${m.title} complete`);
      world.audio.blip(990);
      world.audio.blip(1320);
      this.active = false;
      this.startNext();
      return;
    }
    const s = this.currentStep;
    if (s.type === 'farePickup') this.spawnFare(world);
    world.audio.blip(760);
  }

  fail(world, reason) {
    world.showBanner('Job Failed', reason);
    this.active = false;
    // Restart the same job after a beat.
    this.retryTimer = 2.5;
    this.retryIndex = this.index;
  }

  update(dt, world) {
    if (this.retryTimer !== undefined && this.retryTimer > 0) {
      this.retryTimer -= dt;
      if (this.retryTimer <= 0) {
        this.retryTimer = undefined;
        this.start(this.retryIndex);
      }
      return;
    }
    if (!this.active) {
      // Free-roam side jobs after the story is done.
      if (this.done && !this.farePed) {
        this.freeRoamTimer += dt;
        if (this.freeRoamTimer > 6) {
          this.freeRoamTimer = 0;
          this.spawnFare(world);
        }
      }
      if (this.farePed && !this.fareActive) {
        // Walking up to a fare in free roam starts it (needs a car).
        const p = world.player;
        if (!p.onFoot && p.car && dist(p.x, p.y, this.farePed.x, this.farePed.y) < 52) {
          this.fareActive = true;
          this.farePed.fare = false;
          world.peds = world.peds.filter((x) => x !== this.farePed);
          this.farePed = null;
          world.audio.blip(760);
          world.showBanner('Fare On Board', `Drop them at ${this.fareDest.label}  ·  $40`);
        }
      } else if (this.fareActive && this.fareDest) {
        const p = world.player;
        if (dist(p.x, p.y, this.fareDest.x, this.fareDest.y) < 90) {
          this.fareActive = false;
          p.cash += 40;
          world.stats.totalEarned += 40;
          world.stats.faresDone += 1;
          world.showBanner('Fare Paid', '+$40  ·  Nice driving');
          world.audio.blip(990);
        }
      }
      return;
    }

    const m = this.current;
    const s = this.currentStep;
    const p = world.player;
    if (!s) return;

    if (this.timer > 0) {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.fail(world, 'Out of time — Vera is not happy.');
        return;
      }
    }

    if (s.type === 'goto' || s.type === 'deliver') {
      if (dist(p.x, p.y, s.x, s.y) < s.r) this.advance(world);
    } else if (s.type === 'pickup') {
      if (dist(p.x, p.y, s.x, s.y) < s.r && wasPressed('KeyE')) {
        world.showBanner('Package Secured', 'Now get it to Club Lumen.');
        this.advance(world);
      }
    } else if (s.type === 'steal') {
      if (!p.onFoot && p.car && p.car.kind === s.kind) this.advance(world);
    } else if (s.type === 'farePickup') {
      if (!this.farePed) this.spawnFare(world);
      else if (!p.onFoot && p.car && dist(p.x, p.y, this.farePed.x, this.farePed.y) < 52) {
        this.fareActive = true;
        this.farePed.fare = false;
        world.peds = world.peds.filter((x) => x !== this.farePed);
        this.farePed = null;
        world.showBanner('Fare On Board', `Drop them at ${this.fareDest.label}`);
        this.advance(world);
      }
    } else if (s.type === 'fareDeliver') {
      if (this.fareActive && this.fareDest && dist(p.x, p.y, this.fareDest.x, this.fareDest.y) < 90) {
        this.fareActive = false;
        world.audio.blip(990);
        this.advance(world);
      }
    }
  }
}
