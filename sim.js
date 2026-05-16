// ABM v4 -- JS port of simulation_v4.py
//
// Cells carry a mode in {HG=0, Ag=1, Cap=2}. Per tick:
//   1. transition : each cell rolls next mode from row M[current].
//   2. conflict   : with prob p_contact, picks a random neighbor.
//                   Loser cell flips to winner's mode.
// No T, no f_spec, no autonomous PF development. The "force of production"
// lives entirely in the conflict matrix W, parameterized by 'advantage'.

"use strict";

// ---------- PRNG ----------
function mulberry32(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const HG = 0, AG = 1, CAP = 2;

// ---------- defaults ----------
const DEFAULT_PARAMS = {
  N: 30,
  torus: true,
  // Production-side noise: symmetric up/down transitions on adjacent
  // edges (HG<->Ag, Ag<->Cap). No built-in direction.
  p_noise: 5e-5,
  // Conflict (selection): only place direction enters via advantage.
  p_contact: 3e-3,
  advantage: 0.6,
  // Init
  initial_mode: "HG", // "HG" | "uniform" | "random"
  seed: 0,
};

function transitionMatrix(p) {
  // Symmetric noise on adjacent edges only. Rows sum to 1.
  const n = p.p_noise;
  return [
    [1 - n,    n,        0    ],
    [n,        1 - 2*n,  n    ],
    [0,        n,        1 - n],
  ];
}

function conflictMatrix(p) {
  const a = p.advantage;
  // W[i][j] = P(i beats j).
  const hi = 0.5 + 0.5 * a;
  const lo = 0.5 - 0.5 * a;
  return [
    [0.5, lo,  lo],   // HG vs {HG, Ag, Cap}
    [hi,  0.5, lo],   // Ag vs {HG, Ag, Cap}
    [hi,  hi,  0.5],  // Cap vs {HG, Ag, Cap}
  ];
}

// ---------- Simulation ----------
class Simulation {
  constructor(params) {
    this.p = Object.assign({}, DEFAULT_PARAMS, params || {});
    this.rng = mulberry32(this.p.seed);
    const N = this.p.N;
    this.N = N;
    this.size = N * N;

    this.mode = new Int8Array(this.size); // all HG = 0 by default
    if (this.p.initial_mode === "uniform") {
      for (let i = 0; i < this.size; i++) {
        this.mode[i] = Math.floor(this.rng() * 3);
      }
    } else if (this.p.initial_mode === "random") {
      for (let i = 0; i < this.size; i++) {
        if (this.rng() < 0.1) this.mode[i] = AG;
      }
    }
    // else: leave all HG.

    this.M = transitionMatrix(this.p);
    this.W = conflictMatrix(this.p);
    // Precompute cumulative rows of M.
    this._cumM = this.M.map((row) => {
      const c = [row[0], row[0] + row[1], 1.0];
      return c;
    });

    this.tick = 0;
    this.lastChangeTick = new Int32Array(this.size);
    this.lastChangeTick.fill(-9999);
    // -2 conflict-down, -1 trans-down, 0 none, 1 trans-up, 2 conflict-up, 3 conflict-lateral
    this.lastChangeKind = new Int8Array(this.size);

    this.history = [];
    this._log();
  }

  applyParamsChange() {
    this.M = transitionMatrix(this.p);
    this.W = conflictMatrix(this.p);
    this._cumM = this.M.map((row) => [row[0], row[0] + row[1], 1.0]);
  }

  idx(r, c) {
    const N = this.N;
    if (this.p.torus) {
      r = ((r % N) + N) % N;
      c = ((c % N) + N) % N;
    }
    return r * N + c;
  }

  // ---- per-tick rules ----
  transition() {
    const cum = this._cumM;
    for (let i = 0; i < this.size; i++) {
      const old = this.mode[i];
      const u = this.rng();
      let next;
      if (u < cum[old][0]) next = 0;
      else if (u < cum[old][1]) next = 1;
      else next = 2;
      if (next !== old) {
        this.mode[i] = next;
        this.lastChangeTick[i] = this.tick;
        this.lastChangeKind[i] = next > old ? 1 : -1;
      }
    }
  }

  conflict() {
    const p = this.p;
    if (p.p_contact <= 0) return;
    const N = this.N;
    // Iterate over cells; each with prob p_contact picks a random neighbor.
    // To avoid double-resolving a pair in one tick, dedupe by canonical key.
    const seen = new Set();
    const order = [];
    for (let i = 0; i < this.size; i++) order.push(i);
    // Shuffle.
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      const tmp = order[i]; order[i] = order[j]; order[j] = tmp;
    }
    for (const i of order) {
      if (this.rng() >= p.p_contact) continue;
      const r = Math.floor(i / N);
      const c = i % N;
      const dir = Math.floor(this.rng() * 4);
      let r2 = r, c2 = c;
      if (dir === 0) r2 = r - 1;
      else if (dir === 1) r2 = r + 1;
      else if (dir === 2) c2 = c - 1;
      else c2 = c + 1;
      if (!p.torus && (r2 < 0 || r2 >= N || c2 < 0 || c2 >= N)) continue;
      const j = this.idx(r2, c2);
      const a = Math.min(i, j);
      const b = Math.max(i, j);
      const key = a * this.size + b;
      if (seen.has(key)) continue;
      seen.add(key);
      const mi = this.mode[i];
      const mj = this.mode[j];
      const pi = this.W[mi][mj];
      const winnerSide = this.rng() < pi ? i : j;
      const loserSide = winnerSide === i ? j : i;
      const wm = this.mode[winnerSide];
      const lm = this.mode[loserSide];
      if (wm !== lm) {
        this.mode[loserSide] = wm;
        this.lastChangeTick[loserSide] = this.tick;
        this.lastChangeKind[loserSide] = wm > lm ? 2 : -2;
      }
    }
  }

  step() {
    this.transition();
    this.conflict();
    this.tick++;
    this._log();
  }

  _log() {
    const counts = [0, 0, 0];
    for (let i = 0; i < this.size; i++) counts[this.mode[i]]++;
    this.history.push({
      tick: this.tick,
      share_HG: counts[0] / this.size,
      share_Ag: counts[1] / this.size,
      share_Cap: counts[2] / this.size,
    });
  }
}

window.Simulation = Simulation;
window.SIM_DEFAULTS = DEFAULT_PARAMS;
window.HG = HG;
window.AG = AG;
window.CAP = CAP;
