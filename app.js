// ==============================================
// Dynamic Chart Visualization with Canvas API
// - Multiple series (FIFO)
// - Chart types: line / bar / area / scatter
// - Smoothing option (moving average)
// - Controls: pause, interval, min/max, grid, reset
// - Tooltips on hover
// - Statistics panel (current/min/max/avg/trend)
// - Export PNG
// - Themes
// ==============================================

const canvas = document.getElementById("chartCanvas");
const ctx = canvas.getContext("2d");

const tooltip = document.getElementById("tooltip");

// Controls
const toggleBtn = document.getElementById("toggleBtn");
const resetBtn = document.getElementById("resetBtn");
const exportBtn = document.getElementById("exportBtn");

const intervalSlider = document.getElementById("intervalSlider");
const intervalLabel = document.getElementById("intervalLabel");

const minInput = document.getElementById("minInput");
const maxInput = document.getElementById("maxInput");

const gridToggle = document.getElementById("gridToggle");
const smoothToggle = document.getElementById("smoothToggle");
const themeSelect = document.getElementById("themeSelect");

const statsPanel = document.getElementById("statsPanel");
const typeButtons = Array.from(document.querySelectorAll(".seg"));

const WIDTH = canvas.width;   // 900
const HEIGHT = canvas.height; // 600

// Grid config (as in the lab description)
const GRID_X = 150;
const GRID_Y = 100;
const STEP_X = 20;

// How many points fit in canvas with spacing STEP_X:
const MAX_POINTS = Math.floor(WIDTH / STEP_X) + 1;

// Themes
const THEMES = {
  dark: {
    bg: "rgba(0,0,0,0.20)",
    grid: "rgba(255,255,255,0.14)",
    axis: "rgba(255,255,255,0.35)",
    text: "rgba(255,255,255,0.75)",
    series: ["#22c55e", "#60a5fa", "#f59e0b"]
  },
  light: {
    bg: "rgba(255,255,255,0.85)",
    grid: "rgba(0,0,0,0.10)",
    axis: "rgba(0,0,0,0.30)",
    text: "rgba(0,0,0,0.70)",
    series: ["#16a34a", "#2563eb", "#d97706"]
  },
  contrast: {
    bg: "rgba(0,0,0,0.95)",
    grid: "rgba(255,255,255,0.22)",
    axis: "rgba(255,255,255,0.70)",
    text: "rgba(255,255,255,0.90)",
    series: ["#00ff6a", "#00b7ff", "#ffd000"]
  }
};

let theme = THEMES.dark;

// Chart mode
let chartType = "line"; // line | bar | area | scatter

// Running state (setInterval)
let isRunning = true;
let intervalMs = Number(intervalSlider.value);
let timerId = null;

// Data range (user-controlled)
let minVal = Number(minInput.value);
let maxVal = Number(maxInput.value);

// Three series with independent patterns
const seriesList = [
  { name: "Series A", data: [], color: theme.series[0], last: 300, trend: 0 },
  { name: "Series B", data: [], color: theme.series[1], last: 300, trend: 0 },
  { name: "Series C", data: [], color: theme.series[2], last: 300, trend: 0 }
];

// -------- Utilities --------

function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

function randBetween(a, b) {
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  return lo + Math.random() * (hi - lo);
}

function normalizeToCanvas(value) {
  // value in [minVal, maxVal] -> y in [HEIGHT..0]
  const v = clamp(value, minVal, maxVal);
  const t = (v - minVal) / (maxVal - minVal || 1);
  return HEIGHT - t * HEIGHT;
}

function canvasToValue(y) {
  // y in [0..HEIGHT] -> value in [minVal..maxVal]
  const t = 1 - (y / HEIGHT);
  return minVal + t * (maxVal - minVal);
}

function movingAverage(arr, windowSize = 3) {
  if (windowSize <= 1) return arr.slice();
  const out = [];
  for (let i = 0; i < arr.length; i++) {
    let sum = 0;
    let count = 0;
    for (let j = i - Math.floor(windowSize / 2); j <= i + Math.floor(windowSize / 2); j++) {
      if (j >= 0 && j < arr.length) { sum += arr[j]; count++; }
    }
    out.push(sum / (count || 1));
  }
  return out;
}

// -------- Data generation --------

function nextValueForSeries(s, idx) {
  // Different patterns so lines aren't identical:
  // A: random walk
  // B: sine-ish + noise
  // C: jumpy random
  const range = (maxVal - minVal) || 1;

  if (idx === 0) {
    const step = randBetween(-0.08 * range, 0.08 * range);
    return clamp(s.last + step, minVal, maxVal);
  }

  if (idx === 1) {
    const t = Date.now() / 1000;
    const base = (Math.sin(t * 1.2) * 0.35 + 0.5) * range + minVal;
    const noise = randBetween(-0.06 * range, 0.06 * range);
    return clamp(base + noise, minVal, maxVal);
  }

  // idx === 2
  const val = randBetween(minVal, maxVal);
  return val;
}

function pushNewDataPoint() {
  seriesList.forEach((s, idx) => {
    const val = nextValueForSeries(s, idx);
    s.trend = val - s.last;
    s.last = val;

    s.data.push(val);
    if (s.data.length > MAX_POINTS) s.data.shift();
  });
}

function seedInitialData() {
  seriesList.forEach(s => { s.data = []; s.last = (minVal + maxVal) / 2; s.trend = 0; });
  for (let i = 0; i < MAX_POINTS; i++) pushNewDataPoint();
}

// -------- Drawing (Canvas) --------

function clearCanvas() {
  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  // background fill (theme)
  ctx.fillStyle = theme.bg;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
}

function drawGridAndLabels() {
  if (!gridToggle.checked) return;

  ctx.lineWidth = 1;
  ctx.strokeStyle = theme.grid;

  // Vertical grid lines + x labels
  for (let x = 0; x <= WIDTH; x += GRID_X) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, HEIGHT);
    ctx.stroke();

    // x label
    ctx.fillStyle = theme.text;
    ctx.font = "12px system-ui, Arial";
    ctx.fillText(String(x), x + 4, HEIGHT - 8);
  }

  // Horizontal grid lines + y labels (values)
  for (let y = 0; y <= HEIGHT; y += GRID_Y) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(WIDTH, y);
    ctx.stroke();

    // label = value for that y
    const val = canvasToValue(y);
    ctx.fillStyle = theme.text;
    ctx.font = "12px system-ui, Arial";
    ctx.fillText(val.toFixed(0), 6, y - 6);
  }

  // Axis lines
  ctx.strokeStyle = theme.axis;
  ctx.lineWidth = 2;

  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, HEIGHT);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(0, HEIGHT);
  ctx.lineTo(WIDTH, HEIGHT);
  ctx.stroke();
}

function getSeriesDrawPoints(values) {
  // Convert values -> canvas points
  const ys = smoothToggle.checked ? movingAverage(values, 5) : values;
  const pts = ys.map((v, i) => ({
    x: i * STEP_X,
    y: normalizeToCanvas(v),
    value: values[i]
  }));
  return pts;
}

function drawLineSeries(points, color) {
  if (points.length < 2) return;

  ctx.strokeStyle = color;
  ctx.lineWidth = 5;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
  ctx.stroke();
}

function drawScatterSeries(points, color) {
  ctx.fillStyle = color;
  for (const p of points) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawAreaSeries(points, color) {
  if (points.length < 2) return;

  // Fill under line
  ctx.fillStyle = color + "33"; // alpha-ish (works for hex in many browsers)
  ctx.beginPath();
  ctx.moveTo(points[0].x, HEIGHT);
  ctx.lineTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
  ctx.lineTo(points[points.length - 1].x, HEIGHT);
  ctx.closePath();
  ctx.fill();

  // Outline
  drawLineSeries(points, color);
}

function drawBarSeries(points, color, seriesIndex) {
  // Bars: use a smaller width so multiple series can be seen
  const barGroupWidth = STEP_X * 0.9;
  const barWidth = barGroupWidth / seriesList.length;
  const offset = (seriesIndex * barWidth) - (barGroupWidth / 2) + (barWidth / 2);

  ctx.fillStyle = color + "CC";

  for (const p of points) {
    const x = p.x + offset;
    const y = p.y;
    const h = HEIGHT - y;
    ctx.fillRect(x - barWidth / 2, y, barWidth, h);
  }
}

function drawChart() {
  clearCanvas();
  drawGridAndLabels();

  seriesList.forEach((s, idx) => {
    s.color = theme.series[idx];
    const pts = getSeriesDrawPoints(s.data);

    if (chartType === "line") drawLineSeries(pts, s.color);
    if (chartType === "scatter") drawScatterSeries(pts, s.color);
    if (chartType === "area") drawAreaSeries(pts, s.color);
    if (chartType === "bar") drawBarSeries(pts, s.color, idx);
  });
}

// -------- Tooltips (hover) --------

function getNearestPoint(mouseX, mouseY) {
  // Find nearest point among all series (based on x proximity + distance)
  let best = null;

  seriesList.forEach((s, idx) => {
    const pts = getSeriesDrawPoints(s.data);
    // since x is evenly spaced, estimate index from mouseX:
    const approx = Math.round(mouseX / STEP_X);
    const candidates = [approx - 1, approx, approx + 1];

    candidates.forEach(i => {
      if (i < 0 || i >= pts.length) return;
      const p = pts[i];
      const dx = p.x - mouseX;
      const dy = p.y - mouseY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (!best || dist < best.dist) {
        best = {
          dist,
          seriesName: s.name,
          seriesIndex: idx,
          x: p.x,
          y: p.y,
          value: s.data[i],
          pointIndex: i
        };
      }
    });
  });

  return best;
}

function showTooltip(info, clientX, clientY) {
  const color = theme.series[info.seriesIndex];
  tooltip.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;">
      <span style="width:10px;height:10px;border-radius:999px;background:${color};display:inline-block;"></span>
      <b>${info.seriesName}</b>
    </div>
    <div>Index: <b>${info.pointIndex}</b></div>
    <div>X: <b>${info.x}</b> px • Y: <b>${info.y.toFixed(0)}</b> px</div>
    <div>Value: <b>${info.value.toFixed(2)}</b></div>
  `;

  tooltip.style.left = `${clientX}px`;
  tooltip.style.top = `${clientY}px`;
  tooltip.classList.remove("hidden");
}

function hideTooltip() {
  tooltip.classList.add("hidden");
}

// -------- Statistics --------

function calcStats(values) {
  if (values.length === 0) return null;
  let min = Infinity, max = -Infinity, sum = 0;
  for (const v of values) {
    min = Math.min(min, v);
    max = Math.max(max, v);
    sum += v;
  }
  const avg = sum / values.length;
  const current = values[values.length - 1];
  return { min, max, avg, current };
}

function trendArrow(delta) {
  if (Math.abs(delta) < 0.0001) return "→";
  return delta > 0 ? "↗" : "↘";
}

function renderStats() {
  statsPanel.innerHTML = "";

  seriesList.forEach((s, idx) => {
    const st = calcStats(s.data);
    if (!st) return;

    const card = document.createElement("div");
    card.className = "stat-card";

    const title = document.createElement("div");
    title.className = "stat-title";

    const dot = document.createElement("span");
    dot.style.width = "10px";
    dot.style.height = "10px";
    dot.style.borderRadius = "999px";
    dot.style.background = theme.series[idx];

    const txt = document.createElement("span");
    txt.textContent = `${s.name} ${trendArrow(s.trend)}`;

    title.appendChild(dot);
    title.appendChild(txt);

    const kv = document.createElement("div");
    kv.className = "kv";
    kv.innerHTML = `
      <div>Current: <b>${st.current.toFixed(2)}</b></div>
      <div>Avg: <b>${st.avg.toFixed(2)}</b></div>
      <div>Min: <b>${st.min.toFixed(2)}</b></div>
      <div>Max: <b>${st.max.toFixed(2)}</b></div>
    `;

    card.appendChild(title);
    card.appendChild(kv);
    statsPanel.appendChild(card);
  });
}

// -------- Interval control --------

function startTimer() {
  stopTimer();
  timerId = setInterval(() => {
    pushNewDataPoint();
    drawChart();
    renderStats();
  }, intervalMs);
}

function stopTimer() {
  if (timerId) {
    clearInterval(timerId);
    timerId = null;
  }
}

// -------- Theme application --------

function applyTheme(themeKey) {
  theme = THEMES[themeKey] || THEMES.dark;

  // Update CSS variables to match legend dots/colors (optional polish)
  document.documentElement.style.setProperty("--s1", theme.series[0]);
  document.documentElement.style.setProperty("--s2", theme.series[1]);
  document.documentElement.style.setProperty("--s3", theme.series[2]);

  // Light theme should also invert overall background panel vibe a bit
  if (themeKey === "light") {
    document.documentElement.style.setProperty("--bg", "#e5e7eb");
    document.documentElement.style.setProperty("--text", "#0b1220");
    document.documentElement.style.setProperty("--muted", "rgba(11,18,32,.65)");
    document.documentElement.style.setProperty("--panel", "rgba(255,255,255,.70)");
    document.documentElement.style.setProperty("--border", "rgba(0,0,0,.12)");
    document.documentElement.style.setProperty("--btn", "rgba(0,0,0,.06)");
    document.documentElement.style.setProperty("--btn-hover", "rgba(0,0,0,.10)");
  } else {
    document.documentElement.style.setProperty("--bg", "#0b1220");
    document.documentElement.style.setProperty("--text", "#e5e7eb");
    document.documentElement.style.setProperty("--muted", "rgba(229,231,235,.65)");
    document.documentElement.style.setProperty("--panel", "rgba(255,255,255,.06)");
    document.documentElement.style.setProperty("--border", "rgba(255,255,255,.12)");
    document.documentElement.style.setProperty("--btn", "rgba(255,255,255,.08)");
    document.documentElement.style.setProperty("--btn-hover", "rgba(255,255,255,.12)");
  }

  // Redraw
  drawChart();
  renderStats();
}

// -------- Events --------

toggleBtn.addEventListener("click", () => {
  isRunning = !isRunning;
  if (isRunning) {
    toggleBtn.textContent = "Pause";
    startTimer();
  } else {
    toggleBtn.textContent = "Start";
    stopTimer();
  }
});

resetBtn.addEventListener("click", () => {
  // read range first
  minVal = Number(minInput.value);
  maxVal = Number(maxInput.value);

  if (!Number.isFinite(minVal) || !Number.isFinite(maxVal) || minVal === maxVal) {
    alert("Please set valid Min/Max values (and they must be different).");
    return;
  }

  seedInitialData();
  drawChart();
  renderStats();
});

exportBtn.addEventListener("click", () => {
  const url = canvas.toDataURL("image/png");
  const a = document.createElement("a");
  a.href = url;
  a.download = "chart.png";
  a.click();
});

intervalSlider.addEventListener("input", () => {
  intervalMs = Number(intervalSlider.value);
  intervalLabel.textContent = String(intervalMs);

  if (isRunning) startTimer();
});

minInput.addEventListener("change", () => {
  minVal = Number(minInput.value);
});
maxInput.addEventListener("change", () => {
  maxVal = Number(maxInput.value);
});

gridToggle.addEventListener("change", () => {
  drawChart();
});

smoothToggle.addEventListener("change", () => {
  drawChart();
});

themeSelect.addEventListener("change", () => {
  applyTheme(themeSelect.value);
});

typeButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    typeButtons.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    chartType = btn.dataset.type;
    drawChart();
  });
});

// Tooltip mouse handling
canvas.addEventListener("mousemove", (e) => {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  const nearest = getNearestPoint(x, y);
  if (!nearest) return;

  // show tooltip only if close enough (hover radius)
  if (nearest.dist < 18) {
    showTooltip(nearest, e.clientX - rect.left, e.clientY - rect.top);
  } else {
    hideTooltip();
  }
});

canvas.addEventListener("mouseleave", () => hideTooltip());

// -------- Init --------

(function init(){
  intervalLabel.textContent = String(intervalMs);
  minVal = Number(minInput.value);
  maxVal = Number(maxInput.value);

  applyTheme("dark");
  seedInitialData();
  drawChart();
  renderStats();
  startTimer();
})();
