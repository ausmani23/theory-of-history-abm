// UI for the theory-of-history ABM web demo.
// Color scheme matches the slide deck:
//   HG  = green   (#32CD32)
//   Ag  = orange  (#FF7E00)
//   Cap = yellow  (#FFFF00)
// Two sliders, matched to the slide notation:
//   a   ->  advantage in P(higher wins | contact) = 1/2 + a
//   p   ->  noise probability in P(m -> m ± 1) = p

"use strict";

const COLORS = {
  HG:  [50, 205, 50],    // #32CD32
  Ag:  [255, 126, 0],    // #FF7E00
  Cap: [255, 255, 0],    // #FFFF00
};

const CELL_PX = 14;

let sim = null;
let isPlaying = false;
let ticksPerFrame = 5;

const params = Object.assign({}, window.SIM_DEFAULTS);

const els = {};
function $(id) { return document.getElementById(id); }
function rgbStr([r, g, b], a = 1) { return `rgba(${r},${g},${b},${a})`; }

function formatValue(v) {
  if (v === 0) return "0";
  const av = Math.abs(v);
  if (av >= 0.01) return v.toFixed(2);
  const s = v.toExponential(1);
  return s.replace(/\.0e/, "e");
}

function buildSim() {
  sim = new window.Simulation(params);
  drawAll();
  updateStats();
}

function colorForCell(i) {
  const m = sim.mode[i];
  const c = m === window.HG ? COLORS.HG : m === window.AG ? COLORS.Ag : COLORS.Cap;
  return rgbStr(c);
}

function drawGrid() {
  const N = sim.N;
  const ctx = els.gridCtx;
  const W = N * CELL_PX;
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, W, W);
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      const i = r * N + c;
      ctx.fillStyle = colorForCell(i);
      ctx.fillRect(c * CELL_PX, r * CELL_PX, CELL_PX, CELL_PX);
    }
  }
}

function drawChart() {
  const ctx = els.chartCtx;
  const W = els.chart.width;
  const H = els.chart.height;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, W, H);
  const h = sim.history;
  if (h.length < 2) return;
  const last_t = h[h.length - 1].tick;
  const niceSteps = [5000, 10000, 25000, 50000, 100000, 250000, 500000, 1000000];
  let T_max_x = niceSteps[niceSteps.length - 1];
  for (const s of niceSteps) {
    if (s >= last_t) { T_max_x = s; break; }
  }
  const xOf = (t) => (t / T_max_x) * (W - 40) + 30;
  const yOf = (v) => H - 20 - v * (H - 40);

  ctx.strokeStyle = "#222222";
  ctx.lineWidth = 1;
  for (let frac = 0; frac <= 1; frac += 0.25) {
    const y = yOf(frac);
    ctx.beginPath();
    ctx.moveTo(30, y);
    ctx.lineTo(W - 10, y);
    ctx.stroke();
  }

  ctx.fillStyle = "#cccccc";
  ctx.font = "11px system-ui";
  ctx.fillText("0", 4, H - 14);
  ctx.fillText("1", 12, 14);
  ctx.fillText("share", 0, H / 2);
  ctx.fillText(`tick ${last_t} / ${T_max_x}`, 30, H - 4);

  const maxPoints = 800;
  const stride = Math.max(1, Math.floor(h.length / maxPoints));

  function drawLine(key, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    let first = true;
    for (let i = 0; i < h.length; i += stride) {
      const x = xOf(h[i].tick);
      const y = yOf(h[i][key]);
      if (first) { ctx.moveTo(x, y); first = false; }
      else ctx.lineTo(x, y);
    }
    const lastRow = h[h.length - 1];
    ctx.lineTo(xOf(lastRow.tick), yOf(lastRow[key]));
    ctx.stroke();
  }
  drawLine("share_HG", rgbStr(COLORS.HG));
  drawLine("share_Ag", rgbStr(COLORS.Ag));
  drawLine("share_Cap", rgbStr(COLORS.Cap));
}

function updateStats() {
  const last = sim.history[sim.history.length - 1];
  const a = sim.p.advantage;
  const pWin = 0.5 + 0.5 * a;
  els.stats.innerHTML = `
    tick <b>${last.tick}</b> &middot;
    <span style="color:${rgbStr(COLORS.HG)}">HG ${(last.share_HG * 100).toFixed(0)}%</span> &middot;
    <span style="color:${rgbStr(COLORS.Ag)}">Ag ${(last.share_Ag * 100).toFixed(0)}%</span> &middot;
    <span style="color:${rgbStr(COLORS.Cap)}">Cap ${(last.share_Cap * 100).toFixed(0)}%</span>
    <br>
    <span style="color:#888;font-size:0.85em;">
      P(higher wins) = ${pWin.toFixed(2)} &nbsp;·&nbsp;
      p = ${formatValue(sim.p.p_noise)}
    </span>
  `;
}

function drawAll() {
  drawGrid();
  drawChart();
  updateStats();
}

function loop() {
  if (!isPlaying) return;
  for (let i = 0; i < ticksPerFrame; i++) {
    sim.step();
  }
  drawAll();
  requestAnimationFrame(loop);
}

function hookSliders() {
  // Slider for advantage parameter `a` directly. Slide notation:
  //   P(higher wins | contact) = 1/2 + a
  // In the underlying simulation, `advantage` is parameterized so that
  // P(higher wins) = 0.5 + 0.5 * advantage. We expose `a` such that
  // P(higher wins) = 0.5 + a directly, by setting advantage = 2 * a.
  // Range: a in [0, 0.5] -> P(higher wins) in [0.5, 1.0].
  const sliderDefs = [
    { id: "a", min: 0, max: 0.5, step: 0.025,
      init: 0.5 * params.advantage,
      label: "a",
      liveHint: (v) => `P(higher wins | contact) = &frac12; + a = <b>${(0.5 + v).toFixed(3)}</b>`,
      onChange: (v) => {
        params.advantage = 2 * v;
        if (sim) sim.p.advantage = 2 * v;
      } },
    { id: "p", min: 0, max: 5e-4, step: 5e-6,
      init: params.p_noise,
      label: "p",
      liveHint: (v) => `P(m &rarr; m &plusmn; 1) = p = <b>${formatValue(v)}</b>`,
      onChange: (v) => {
        params.p_noise = v;
        if (sim) sim.p.p_noise = v;
      } },
  ];
  const host = els.sliders;
  for (const s of sliderDefs) {
    const wrap = document.createElement("label");
    wrap.className = "slider";
    const hintHtml = s.liveHint ? s.liveHint(s.init) : s.hint;
    wrap.innerHTML = `
      <div class="slider-row">
        <span class="slider-name">${s.label}</span>
        <b id="val_${s.id}">${formatValue(s.init)}</b>
      </div>
      <input type="range" id="sl_${s.id}" min="${s.min}" max="${s.max}" step="${s.step}" value="${s.init}">
      <span class="slider-hint" id="hint_${s.id}">${hintHtml}</span>
    `;
    host.appendChild(wrap);
    const input = wrap.querySelector("input");
    const valLabel = wrap.querySelector(`#val_${s.id}`);
    const hintEl = wrap.querySelector(`#hint_${s.id}`);
    input.addEventListener("input", () => {
      const v = parseFloat(input.value);
      valLabel.textContent = formatValue(v);
      if (s.liveHint) hintEl.innerHTML = s.liveHint(v);
      if (s.onChange) {
        s.onChange(v);
        if (sim) sim.applyParamsChange();
      }
    });
  }
}

function setupCanvases() {
  els.grid = $("grid");
  els.gridCtx = els.grid.getContext("2d");
  els.grid.width = 30 * CELL_PX;
  els.grid.height = 30 * CELL_PX;

  els.chart = $("chart");
  els.chartCtx = els.chart.getContext("2d");
  els.chart.width = 480;
  els.chart.height = 220;
}

const SPEED_LEVELS = [5, 50, 500];

function updateRunButtons() {
  els.play.disabled = isPlaying;
  els.stop.disabled = !isPlaying;
}

function hookButtons() {
  els.play = $("play");
  els.stop = $("stop");
  els.play.addEventListener("click", () => {
    if (isPlaying) return;
    isPlaying = true;
    updateRunButtons();
    requestAnimationFrame(loop);
  });
  els.stop.addEventListener("click", () => {
    isPlaying = false;
    updateRunButtons();
  });
  $("step").addEventListener("click", () => {
    sim.step();
    drawAll();
  });
  $("reset").addEventListener("click", () => {
    isPlaying = false;
    params.seed = Math.floor(Math.random() * 2 ** 31);
    buildSim();
    updateRunButtons();
  });
  els.fast = $("fast");
  els.fast.addEventListener("click", () => {
    const idx = SPEED_LEVELS.indexOf(ticksPerFrame);
    ticksPerFrame = SPEED_LEVELS[(idx + 1) % SPEED_LEVELS.length];
    els.fast.textContent = `Speed: ${ticksPerFrame}/frame`;
  });
  els.fast.textContent = `Speed: ${ticksPerFrame}/frame`;
}

window.addEventListener("DOMContentLoaded", () => {
  els.stats = $("stats");
  els.sliders = $("sliders");
  setupCanvases();
  hookSliders();
  hookButtons();
  buildSim();
  updateRunButtons();
});
