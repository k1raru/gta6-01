// Solmar City: a seeded road grid, blocks, buildings, parks, beach and landmarks.
// All names are original. The map is generated from a seed so every run matches.
import { WORLD, ROADS_V, ROADS_H, ROAD_W, BEACH, BUILDING_COLORS, ROOF_COLORS, DISTRICTS } from './config.js';
import { mulberry32, range, int, pick, chance } from './random.js';

export function createCity(seed) {
  const rng = mulberry32(seed);
  const city = {
    W: WORLD.W, H: WORLD.H, roadsV: ROADS_V, roadsH: ROADS_H, roadW: ROAD_W,
    blocks: [], buildings: [], trees: [], parks: [],
    garage: null, hospital: null, club: null, docks: null, bank: null, warehouse: null,
    pier: { x: 1500, y: 2280, w: 64, h: 110 },
  };

  const half = ROAD_W / 2;

  // Blocks between the roads. The strip below the last road is the beach.
  for (let vi = 0; vi < ROADS_V.length - 1; vi++) {
    for (let hi = 0; hi < ROADS_H.length - 1; hi++) {
      const bx = ROADS_V[vi] + half;
      const by = ROADS_H[hi] + half;
      const bw = ROADS_V[vi + 1] - ROADS_V[vi] - ROAD_W;
      const bh = ROADS_H[hi + 1] - ROADS_H[hi] - ROAD_W;
      const block = { x: bx, y: by, w: bw, h: bh, kind: 'buildings' };
      city.blocks.push(block);

      // Landmark blocks get one named building in the middle.
      const landmark = landmarkFor(vi, hi);
      if (landmark) {
        const bw2 = bw * 0.62;
        const bh2 = bh * 0.6;
        const b = {
          x: bx + (bw - bw2) / 2, y: by + (bh - bh2) / 2, w: bw2, h: bh2,
          color: landmark.color, roof: landmark.roof, name: landmark.name, landmark: landmark.key,
        };
        city.buildings.push(b);
        city[landmark.key] = { x: b.x, y: b.y, w: b.w, h: b.h, label: landmark.name };
        if (landmark.key === 'garage') city.garageZone = { x: bx, y: by + bh - 90, w: bw, h: 90 };
        continue;
      }

      const roll = rng();
      if (roll < 0.18) {
        block.kind = 'park';
        city.parks.push(block);
        const n = int(rng, 6, 11);
        for (let i = 0; i < n; i++) {
          city.trees.push({
            x: range(rng, bx + 24, bx + bw - 24),
            y: range(rng, by + 24, by + bh - 24),
            r: range(rng, 12, 20),
          });
        }
        continue;
      }
      if (roll < 0.3) {
        block.kind = 'plaza';
        continue;
      }

      // Buildings block: a 2x2 grid with jittered sizes.
      const cols = chance(rng, 0.5) ? 2 : 1;
      const rows = chance(rng, 0.6) ? 2 : 1;
      const gap = 16;
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          const cw = (bw - gap * (cols + 1)) / cols;
          const ch = (bh - gap * (rows + 1)) / rows;
          const jx = chance(rng, 0.5) ? range(rng, -8, 8) : 0;
          const jy = chance(rng, 0.5) ? range(rng, -8, 8) : 0;
          city.buildings.push({
            x: bx + gap + c * (cw + gap) + jx,
            y: by + gap + r * (ch + gap) + jy,
            w: Math.max(60, cw + (chance(rng, 0.5) ? range(rng, -20, 10) : 0)),
            h: Math.max(50, ch + (chance(rng, 0.5) ? range(rng, -16, 10) : 0)),
            color: pick(rng, BUILDING_COLORS),
            roof: pick(rng, ROOF_COLORS),
            name: null, landmark: null,
          });
        }
      }
    }
  }

  // The docks: a container lot on the west edge, reached from the 200 road.
  city.docks = { x: 36, y: 1010, w: 120, h: 380, label: 'Solmar Docks' };
  for (let i = 0; i < 5; i++) {
    city.buildings.push({
      x: 44 + (i % 2) * 56, y: 1024 + Math.floor(i / 2) * 120, w: 48, h: 100,
      color: ['#b0503c', '#3f6d8e', '#7a8a4a', '#c98f3d', '#6d5a7a'][i],
      roof: '#4a4a4a', name: null, landmark: 'container',
    });
  }

  // Palm trees along the beach and the beachfront drive.
  for (let x = 120; x < WORLD.W - 80; x += 130) {
    city.trees.push({ x: x + range(rng, -20, 20), y: range(rng, 2290, 2320), r: range(rng, 12, 17), palm: true });
    if (chance(rng, 0.5)) city.trees.push({ x: x + 60, y: 2240, r: range(rng, 11, 15), palm: true });
  }

  // ---- queries ------------------------------------------------------------
  city.isRoad = function isRoad(x, y) {
    if (x < 0 || y < 0 || x > WORLD.W || y > WORLD.H) return false;
    for (const rv of ROADS_V) if (Math.abs(x - rv) <= half) return true;
    for (const rh of ROADS_H) if (Math.abs(y - rh) <= half) return true;
    return false;
  };

  city.isWater = function isWater(x, y) {
    return y >= BEACH.waterY;
  };

  city.districtAt = function districtAt(x, y) {
    for (const d of DISTRICTS) {
      if (x >= d.x0 && x < d.x1 && y >= d.y0 && y < d.y1) return d.name;
    }
    return 'Solmar City';
  };

  city.pointInBuilding = function pointInBuilding(x, y, pad = 0) {
    for (const b of city.buildings) {
      if (x > b.x - pad && x < b.x + b.w + pad && y > b.y - pad && y < b.y + b.h + pad) return b;
    }
    return null;
  };

  // Push a circle out of buildings, water and the world edge. Returns corrected {x, y}.
  city.resolveCircle = function resolveCircle(x, y, r) {
    for (const b of city.buildings) {
      const cx = Math.max(b.x, Math.min(x, b.x + b.w));
      const cy = Math.max(b.y, Math.min(y, b.y + b.h));
      const dx = x - cx;
      const dy = y - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 < r * r) {
        if (d2 > 0.01) {
          const d = Math.sqrt(d2);
          x = cx + (dx / d) * r;
          y = cy + (dy / d) * r;
        } else {
          // Center inside the rect: push out along the smallest penetration.
          const pl = x - b.x + r;
          const pr = b.x + b.w - x + r;
          const pt = y - b.y + r;
          const pb = b.y + b.h - y + r;
          const m = Math.min(pl, pr, pt, pb);
          if (m === pl) x = b.x - r;
          else if (m === pr) x = b.x + b.w + r;
          else if (m === pt) y = b.y - r;
          else y = b.y + b.h + r;
        }
      }
    }
    const onPier = x > city.pier.x - 6 && x < city.pier.x + city.pier.w + 6 && y > city.pier.y;
    if (!onPier && y + r > BEACH.waterY) y = BEACH.waterY - r;
    x = Math.max(r, Math.min(WORLD.W - r, x));
    y = Math.max(r, Math.min(WORLD.H - r, y));
    return { x, y };
  };

  city.randomStreetPoint = function randomStreetPoint(rng2) {
    if (rng2() < 0.5) {
      const rv = pick(rng2, ROADS_V);
      return { x: rv + (rng2() < 0.5 ? -24 : 24), y: range(rng2, 120, 2240), axis: 'v', dir: rng2() < 0.5 ? 1 : -1 };
    }
    const rh = pick(rng2, ROADS_H);
    return { x: range(rng2, 120, 3080), y: rh + (rng2() < 0.5 ? -24 : 24), axis: 'h', dir: rng2() < 0.5 ? 1 : -1 };
  };

  city.nearestRoadPoint = function nearestRoadPoint(x, y) {
    let best = null;
    let bd = Infinity;
    for (const rv of ROADS_V) {
      const d = Math.abs(x - rv);
      if (d < bd) { bd = d; best = { x: rv, y: Math.max(60, Math.min(WORLD.H - 60, y)), axis: 'v' }; }
    }
    for (const rh of ROADS_H) {
      const d = Math.abs(y - rh);
      if (d < bd) { bd = d; best = { x: Math.max(60, Math.min(WORLD.W - 60, x)), y: rh, axis: 'h' }; }
    }
    return best;
  };

  return city;
}

function landmarkFor(vi, hi) {
  if (vi === 3 && hi === 2) return { key: 'club', name: 'Club Lumen', color: '#8e44ad', roof: '#5e2a72' };
  if (vi === 6 && hi === 0) return { key: 'hospital', name: 'St. Marina Hospital', color: '#e8e8e8', roof: '#b03030' };
  if (vi === 1 && hi === 4) return { key: 'garage', name: 'Spray & Go', color: '#3f6d8e', roof: '#2c4d66' };
  if (vi === 0 && hi === 0) return { key: 'bank', name: 'Solmar National Bank', color: '#d8c98a', roof: '#8a7a3a' };
  if (vi === 0 && hi === 3) return { key: 'warehouse', name: 'Dockside Warehouse', color: '#8a7a6a', roof: '#5a4a3a' };
  return null;
}
