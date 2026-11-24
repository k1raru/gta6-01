// Solmar — Streets of Solmar: tuning, palette and world constants.
// Everything here is original: the city, districts, cars and people are ours.
export const WORLD = { W: 3200, H: 2400 };

export const ROADS_V = [200, 600, 1000, 1400, 1800, 2200, 2600, 3000];
export const ROADS_H = [200, 600, 1000, 1400, 1800, 2200];
export const ROAD_W = 96;

export const BEACH = { sandY: 2260, waterY: 2340 };

export const PALETTE = {
  grass: '#8fb573',
  grassDark: '#7da763',
  sidewalk: '#d9c9a3',
  asphalt: '#3d414d',
  asphaltDark: '#343845',
  lane: '#e8c95a',
  sand: '#ecd9a4',
  water: '#2e7f9e',
  waterDeep: '#256b87',
  parkPath: '#cbb98a',
};

export const BUILDING_COLORS = [
  '#e8a87c', '#d9826f', '#7fb3a8', '#e5c07b', '#c9a2c8',
  '#8fb8d8', '#f2d5a0', '#a8c686', '#e07856', '#6fa8a0',
];
export const ROOF_COLORS = ['#b96a4e', '#8f5a44', '#5d7f78', '#a8843f', '#7a5a7d'];

export const DISTRICTS = [
  { name: 'Old Town', x0: 0, y0: 0, x1: 1000, y1: 1000 },
  { name: 'Neon Mile', x0: 1000, y0: 0, x1: 2200, y1: 1200 },
  { name: 'Palm Heights', x0: 2200, y0: 0, x1: 3200, y1: 1200 },
  { name: 'Dockside', x0: 0, y0: 1200, x1: 1400, y1: 2260 },
  { name: 'Marina Bay', x0: 1400, y0: 1200, x1: 3200, y1: 2260 },
  { name: 'Ocean Drive', x0: 0, y0: 2260, x1: 3200, y1: 2400 },
];

export const CAR_KINDS = {
  sedan:   { len: 52, wid: 26, maxSpeed: 330, accel: 260, color: '#c94f43' },
  sport:   { len: 54, wid: 25, maxSpeed: 430, accel: 340, color: '#e8b13c' },
  taxi:    { len: 52, wid: 26, maxSpeed: 350, accel: 280, color: '#f2c230' },
  van:     { len: 62, wid: 28, maxSpeed: 280, accel: 210, color: '#7fa8c9' },
  armored: { len: 66, wid: 30, maxSpeed: 300, accel: 230, color: '#5a6b7a' },
  police:  { len: 54, wid: 26, maxSpeed: 400, accel: 330, color: '#e8e8e8' },
  pickup:  { len: 56, wid: 27, maxSpeed: 320, accel: 250, color: '#6a9e5f' },
};

export const TUNING = {
  playerWalk: 185,
  playerRun: 265,
  playerRadius: 13,
  playerHp: 100,
  punchRange: 34,
  punchDamage: 34,
  punchCooldown: 0.45,
  enterCarRange: 70,
  trafficCount: 26,
  parkedCount: 10,
  pedCount: 46,
  copRamDamage: 7,
  copRamCooldown: 0.9,
  resprayCost: 200,
  wantedDecaySeconds: 26,
  bustDistance: 56,
  bustSeconds: 1.6,
  respawnCost: 100,
  startCash: 500,
};

export const CONTROLS_TEXT = [
  'WASD / Arrows — move / drive',
  'Shift — run',
  'E — enter / exit car · pick up · talk',
  'F or Click — punch',
  'Space — handbrake',
  'M — sound on / off',
  'P / Esc — pause',
];
