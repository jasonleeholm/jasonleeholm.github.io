// ============================================================
//  index.html — reads LAYER_NAMES, DUMMY_PALETTE, DEFAULT_PALETTE
//  from layers.js. Never edit this file for config changes.
// ============================================================

// ── Runtime state ────────────────────────────────────────────
// maxSlot[name]   = highest slot found (0 = no SVGs for this layer)
// curSlot[name]   = currently displayed slot number (0 = transparent)
// svgCache[name][slot] = raw SVG text (slot 0 = null = transparent)

const maxSlot  = {};
const curSlot  = {};
const svgCache = {};

let palette = { ...DEFAULT_PALETTE };
let pastedBuffer = "";

// ── Accessory layer detection ────────────────────────────────
// Any layer whose name starts with "accessories_" is part of the
// synced accessory pair.
const ACCESSORY_PREFIX = "accessories_";
const accessoryLayers = LAYER_NAMES.filter(n => n.startsWith(ACCESSORY_PREFIX));

function isAccessory(name) { return name.startsWith(ACCESSORY_PREFIX); }

// ── Slot formatting ──────────────────────────────────────────
function fmt(n) { return String(n).padStart(3, "0"); }
function svgPath(name, slot) { return `svg/${name}_${fmt(slot)}.svg`; }

// ── Fetch helpers ─────────────────────────────────────────────
async function tryFetch(url) {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    return await r.text();
  } catch { return null; }
}

// ── File discovery ────────────────────────────────────────────
// For each layer, probe svg/{name}_001.svg, _002.svg, ... until 404.
// Returns highest slot found (0 if none).
async function discoverMax(name) {
  let n = 1;
  while (true) {
    const text = await tryFetch(svgPath(name, n));
    if (text === null) break;
    // Cache as we go — saves re-fetching later
    if (!svgCache[name]) svgCache[name] = {};
    svgCache[name][n] = text;
    n++;
  }
  return n - 1; // last successfully found slot
}

async function discoverAllLayers() {
  setLoadMsg("Discovering SVG files…");
  for (const name of LAYER_NAMES) {
    svgCache[name] = {};
    setLoadMsg(`Scanning: ${name}…`);
    maxSlot[name] = await discoverMax(name);
    curSlot[name] = maxSlot[name] > 0 ? 1 : 0;
  }
}

// ── Validation after discovery ───────────────────────────────
function validateAfterDiscovery() {
  const errors = [];

  // Every layer with max > 0 must have slot 1 cached (it will — discovery
  // probes from 1 upward — but double-check for belt-and-suspenders).
  for (const name of LAYER_NAMES) {
    if (maxSlot[name] > 0 && !svgCache[name][1]) {
      errors.push(`Layer "${name}": max=${maxSlot[name]} but slot 1 is missing.`);
    }
  }

  // Accessory layers must always have matching maxSlot values.
  if (accessoryLayers.length === 2) {
    const [a, b] = accessoryLayers;
    if (maxSlot[a] !== maxSlot[b]) {
      errors.push(
        `Accessory mismatch: "${a}" has ${maxSlot[a]} option(s) but "${b}" has ${maxSlot[b]}. ` +
        `They must match exactly.`
      );
    }
  }

  return errors;
}

// ── Fetch a single SVG (with cache) ──────────────────────────
async function getSvg(name, slot) {
  if (slot === 0) return null;
  if (svgCache[name][slot] !== undefined) return svgCache[name][slot];
  const text = await tryFetch(svgPath(name, slot));
  svgCache[name][slot] = text; // null if 404
  return text;
}

// ── Color swapping ────────────────────────────────────────────
function swapColors(svgText) {
  let out = svgText;
  const pairs = [
    [DUMMY_PALETTE.base,  palette.base],
    [DUMMY_PALETTE.shade, palette.shade],
    [DUMMY_PALETTE.tint,  palette.tint],
  ];
  for (const [from, to] of pairs) {
    const terminators = [';', '"', "'", ' ', '>', '\n', '\r', '\t'];
    for (const term of terminators) {
      const target = from + term;
      const replacement = to + term;
      // case-insensitive split/join
      const upper = target.toUpperCase();
      const lower = target.toLowerCase();
      out = out.split(upper).join(replacement);
      out = out.split(lower).join(replacement);
      // mixed case (e.g. #9Cc)
      out = out.split(target).join(replacement);
    }
  }
  return out;
}

function swapColorsOld(svgText) {
  console.log("DUMMY base:", DUMMY_PALETTE.base, "→ live:", palette.base);
  console.log("SVG contains dummy?", svgText.includes(DUMMY_PALETTE.base));
  let out = svgText;
  const pairs = [
    [DUMMY_PALETTE.base,  palette.base],
    [DUMMY_PALETTE.shade, palette.shade],
    [DUMMY_PALETTE.tint,  palette.tint],
  ];
  for (const [from, to] of pairs) {
    // Replace all case variants with a simple split/join
    // Use semicolon and quote terminators to avoid partial matches
    // e.g. #999; or #999" but not #9990
    const terminators = [';', '"', "'", ' ', '>', '\n', '\r'];
    for (const term of terminators) {
      const target = from + term;
      const replacement = to + term;
      out = out.split(target.toUpperCase()).join(replacement);
      out = out.split(target.toLowerCase()).join(replacement);
      out = out.split(target).join(replacement);
    }
  }
  return out;
}

// ── Canvas rendering ──────────────────────────────────────────
async function renderCanvas() {
  const wrap = document.getElementById("canvas-wrap");

  // Ensure one div per layer in DOM, bottom-to-top = LAYER_NAMES order
  for (const name of LAYER_NAMES) {
    let div = wrap.querySelector(`[data-layer="${name}"]`);
    if (!div) {
      div = document.createElement("div");
      div.className = "svg-layer";
      div.dataset.layer = name;
      wrap.appendChild(div);
    }

    const slot = curSlot[name];
    if (slot === 0) { div.innerHTML = ""; continue; }

    const raw = await getSvg(name, slot);
    if (!raw) { div.innerHTML = ""; continue; }

    const swapped = swapColors(raw);
    div.innerHTML = swapped;
    const svg = div.querySelector("svg");
    if (svg) {
      svg.style.width = "100%";
      svg.style.height = "100%";
      svg.removeAttribute("width");
      svg.removeAttribute("height");
    }
  }
}

// ── Controls rendering ────────────────────────────────────────
function renderControls() {
  const col = document.getElementById("controls-col");
  col.innerHTML = "";

  for (const name of LAYER_NAMES) {
    const block = document.createElement("div");
    block.className = "layer-block";
    block.id = "block-" + name;

    // Header
    const head = document.createElement("div");
    head.className = "layer-header";
    head.innerHTML = `
      <span class="layer-label">${name}</span>
      <span class="layer-slot-display" id="slot-display-${name}">${fmt(curSlot[name])}</span>
      <span style="color:var(--muted);font-size:10px;font-family:var(--mono)">/ ${fmt(maxSlot[name])}</span>
    `;
    block.appendChild(head);

    // Body: prev button + strip + next button
    const body = document.createElement("div");
    body.className = "layer-body";

    const prevBtn = document.createElement("button");
    prevBtn.className = "cycle-btn";
    prevBtn.textContent = "◀";
    prevBtn.title = "Previous option";
    prevBtn.addEventListener("click", () => cycleLayer(name, -1));

    const strip = document.createElement("div");
    strip.className = "strip";
    strip.id = "strip-" + name;

    const nextBtn = document.createElement("button");
    nextBtn.className = "cycle-btn";
    nextBtn.textContent = "▶";
    nextBtn.title = "Next option";
    nextBtn.addEventListener("click", () => cycleLayer(name, +1));

    body.appendChild(prevBtn);
    body.appendChild(strip);
    body.appendChild(nextBtn);
    block.appendChild(body);
    col.appendChild(block);

    buildStrip(name);
  }
}

// Build thumbnail strip for one layer
function buildStrip(name) {
  const strip = document.getElementById("strip-" + name);
  if (!strip) return;
  strip.innerHTML = "";

  // Slot 0 thumb (transparent)
  const t0 = makeThumbnail(name, 0, null);
  strip.appendChild(t0);

  // Slots 1..max
  for (let s = 1; s <= maxSlot[name]; s++) {
    const cached = svgCache[name][s];
    // May be null if there's a gap — skip missing slots in thumbnail strip
    if (cached === undefined || cached === null) continue;
    strip.appendChild(makeThumbnail(name, s, cached));
  }
}

function makeThumbnail(name, slot, svgText) {
  const div = document.createElement("div");
  div.className = "strip-thumb" + (curSlot[name] === slot ? " active" : "");
  div.dataset.slot = slot;
  div.id = `thumb-${name}-${slot}`;
  div.title = slot === 0 ? "transparent" : `${name}_${fmt(slot)}`;

  if (slot === 0) {
    div.classList.add("is-zero");
    div.innerHTML = "◻";
  } else if (svgText) {
    div.innerHTML = svgText;
    const svg = div.querySelector("svg");
    if (svg) {
      svg.style.width = "100%";
      svg.style.height = "100%";
      svg.removeAttribute("width");
      svg.removeAttribute("height");
      svg.style.pointerEvents = "none";
    }
  } else {
    const lbl = document.createElement("span");
    lbl.className = "thumb-label";
    lbl.textContent = fmt(slot);
    div.appendChild(lbl);
  }

  div.addEventListener("click", () => setSlot(name, slot));
  return div;
}

// Update active highlight in strip
function updateStripActive(name) {
  const strip = document.getElementById("strip-" + name);
  if (!strip) return;
  strip.querySelectorAll(".strip-thumb").forEach(el => {
    el.classList.toggle("active", Number(el.dataset.slot) === curSlot[name]);
  });
  const el = document.getElementById(`thumb-${name}-${curSlot[name]}`);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });

  const disp = document.getElementById(`slot-display-${name}`);
  if (disp) disp.textContent = fmt(curSlot[name]);
}

// ── Cycling logic ─────────────────────────────────────────────
async function cycleLayer(name, dir) {
  if (dir > 0) {
    await cycleNext(name);
  } else {
    await cyclePrev(name);
  }
  // Accessory sync
  if (isAccessory(name)) {
    await syncAccessories(name);
  }
  updateStripActive(name);
  await renderCanvas();
  renderStatus();
}

async function cycleNext(name) {
  const max = maxSlot[name];
  if (max === 0) { curSlot[name] = 0; return; }

  if (curSlot[name] === max) { curSlot[name] = 0; return; }

  // Try incrementing, skip gaps, wrap to 0 if exhausted
  let next = curSlot[name] + 1;
  while (next <= max) {
    const text = await getSvg(name, next);
    if (text !== null) { curSlot[name] = next; return; }
    next++;
  }
  curSlot[name] = 0; // wrapped past max with no file found
}

async function cyclePrev(name) {
  const max = maxSlot[name];
  if (max === 0) { curSlot[name] = 0; return; }

  if (curSlot[name] === 0) { curSlot[name] = max; return; }

  let prev = curSlot[name] - 1;
  if (prev === 0) { curSlot[name] = 0; return; }

  // Try decrementing, skip gaps
  while (prev >= 1) {
    const text = await getSvg(name, prev);
    if (text !== null) { curSlot[name] = prev; return; }
    prev--;
  }
  curSlot[name] = 0;
}

// ── Accessory sync ─────────────────────────────────────────────
async function syncAccessories(changedName) {
  if (accessoryLayers.length !== 2) return;
  const [a, b] = accessoryLayers;
  const other = changedName === a ? b : a;
  const targetSlot = curSlot[changedName];

  // Check the matching file exists on the other side
  if (targetSlot > 0) {
    const text = await getSvg(other, targetSlot);
    if (text === null) {
      showAlert(
        `Accessory mismatch: "${changedName}_${fmt(targetSlot)}.svg" exists ` +
        `but "${other}_${fmt(targetSlot)}.svg" is missing. Please fix before uploading.`
      );
    }
  }

  curSlot[other] = targetSlot;
  updateStripActive(other);
}

// ── Direct slot setter (from thumbnail click or paste) ────────
async function setSlot(name, slot) {
  const clamped = Math.max(0, Math.min(maxSlot[name], slot));
  const effective = (clamped > 0 && svgCache[name][clamped] === null) ? 0 : clamped;
  curSlot[name] = effective;

  if (isAccessory(name)) {
    await syncAccessories(name);
  }

  updateStripActive(name);
  await renderCanvas();
  renderStatus();
}

// ── Palette ───────────────────────────────────────────────────
function initPaletteUI() {
  ["base", "shade", "tint"].forEach(k => {
    const inp = document.getElementById("col-" + k);
    inp.value = palette[k];
    inp.addEventListener("input", () => {
      palette[k] = inp.value;
      updatePaletteUI();
      renderCanvas();
      renderStatus();
    });
  });
  updatePaletteUI();
}

function updatePaletteUI() {
  ["base", "shade", "tint"].forEach(k => {
    document.getElementById("sw-" + k).style.background = palette[k];
    document.getElementById("hex-" + k).textContent = palette[k];
    document.getElementById("col-" + k).value = palette[k];
  });
}

function autoTintShade() {
  const [h, s, l] = hexToHsl(palette.base);
  palette.tint  = hslToHex(h, Math.max(0, s - 10), Math.min(97, l + 28));
  palette.shade = hslToHex(h, Math.min(100, s + 8),  Math.max(5,  l - 28));
  updatePaletteUI();
  renderCanvas();
  renderStatus();
}

function randomBase() {
  palette.base = hslToHex(Math.random() * 360, 40 + Math.random() * 40, 40 + Math.random() * 25);
  autoTintShade();
}

// ── Status bar ────────────────────────────────────────────────
function buildStatusString() {
  const parts = [];

  for (const name of LAYER_NAMES) {
    // Accessories: show only one combined entry
    if (name === accessoryLayers[0]) {
      parts.push(`accessories: ${fmt(curSlot[name])}`);
    } else if (accessoryLayers.includes(name)) {
      continue; // skip the second accessory layer
    } else {
      parts.push(`${name}: ${fmt(curSlot[name])}`);
    }
  }

  parts.push(`base: ${palette.base}`);
  parts.push(`shade: ${palette.shade}`);
  parts.push(`tint: ${palette.tint}`);

  return "[" + parts.join(" | ") + "]";
}

function renderStatus() {
  document.getElementById("status-text").textContent = buildStatusString();
}

async function copyStatus() {
  const text = buildStatusString();
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    prompt("Copy this status string:", text);
  }
}

async function pasteStatus() {
  try {
    pastedBuffer = await navigator.clipboard.readText();
  } catch {
    pastedBuffer = prompt("Paste a status string here:") || "";
  }
  document.getElementById("status-text").textContent = "⏎ Pasted — hit Apply to load: " + pastedBuffer;
}

async function applyPasted() {
  if (!pastedBuffer) { pasteStatus(); return; }
  await parseAndApplyStatus(pastedBuffer);
  pastedBuffer = "";
}

async function parseAndApplyStatus(str) {
  // Strip outer brackets
  const inner = str.trim().replace(/^\[/, "").replace(/\]$/, "");
  const entries = inner.split("|").map(s => s.trim());

  const parsed = {};
  for (const entry of entries) {
    const idx = entry.indexOf(":");
    if (idx < 0) continue;
    const key = entry.slice(0, idx).trim();
    const val = entry.slice(idx + 1).trim();
    parsed[key] = val;
  }

  // Apply palette colors
  if (parsed.base  && /^#[0-9a-f]{6}$/i.test(parsed.base))  { palette.base  = parsed.base; }
  if (parsed.shade && /^#[0-9a-f]{6}$/i.test(parsed.shade)) { palette.shade = parsed.shade; }
  if (parsed.tint  && /^#[0-9a-f]{6}$/i.test(parsed.tint))  { palette.tint  = parsed.tint; }
  updatePaletteUI();

  // Apply layer slots
  for (const name of LAYER_NAMES) {
    let key = name;
    if (isAccessory(name)) key = "accessories";
    if (!(key in parsed)) continue;

    const n = parseInt(parsed[key], 10);
    const slot = isNaN(n) ? 0 : Math.max(0, Math.min(maxSlot[name], n));
    curSlot[name] = (slot > 0 && svgCache[name][slot] === null) ? 0 : slot;
  }

  // Rebuild UI
  for (const name of LAYER_NAMES) {
    updateStripActive(name);
  }
  await renderCanvas();
  renderStatus();
}

// ── Alert banner ──────────────────────────────────────────────
function showAlert(msg) {
  const area = document.getElementById("alert-area");
  const div = document.createElement("div");
  div.className = "alert-banner";
  div.style.margin = "6px 12px";
  div.innerHTML = `⚠ ${msg} <button class="btn-sm" style="margin-left:8px;background:#e6ac00;border:none" onclick="this.parentElement.remove()">dismiss</button>`;
  area.appendChild(div);
}

// ── Save SVG ──────────────────────────────────────────────────
function saveImage() {
  const groups = [];
  for (const name of LAYER_NAMES) {
    const slot = curSlot[name];
    if (slot === 0) continue;
    const raw = svgCache[name][slot];
    if (!raw) continue;
    const swapped = swapColors(raw);
    const tmp = document.createElement("div");
    tmp.innerHTML = swapped;
    const svg = tmp.querySelector("svg");
    if (svg) groups.push(`<g id="${name}">${svg.innerHTML}</g>`);
  }
  const out = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="512" height="512">\n${groups.join("\n")}\n</svg>`;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([out], { type: "image/svg+xml" }));
  a.download = "character.svg";
  a.click();
  URL.revokeObjectURL(a.href);
}

// ── HSL ↔ HEX ─────────────────────────────────────────────────
function hexToHsl(hex) {
  let r = parseInt(hex.slice(1,3),16)/255,
      g = parseInt(hex.slice(3,5),16)/255,
      b = parseInt(hex.slice(5,7),16)/255;
  const max = Math.max(r,g,b), min = Math.min(r,g,b);
  let h, s, l = (max+min)/2;
  if (max === min) { h = s = 0; }
  else {
    const d = max - min;
    s = l > 0.5 ? d/(2-max-min) : d/(max+min);
    switch(max) {
      case r: h = (g-b)/d + (g<b?6:0); break;
      case g: h = (b-r)/d + 2; break;
      case b: h = (r-g)/d + 4; break;
    }
    h /= 6;
  }
  return [h*360, s*100, l*100];
}
function hslToHex(h, s, l) {
  h/=360; s/=100; l/=100;
  let r, g, b;
  if (s === 0) { r = g = b = l; }
  else {
    const hue2rgb = (p,q,t) => {
      if(t<0) t+=1; if(t>1) t-=1;
      if(t<1/6) return p+(q-p)*6*t;
      if(t<1/2) return q;
      if(t<2/3) return p+(q-p)*(2/3-t)*6;
      return p;
    };
    const q = l<0.5 ? l*(1+s) : l+s-l*s, p = 2*l-q;
    r = hue2rgb(p,q,h+1/3);
    g = hue2rgb(p,q,h);
    b = hue2rgb(p,q,h-1/3);
  }
  return "#" + [r,g,b].map(x => Math.round(x*255).toString(16).padStart(2,"0")).join("");
}

// ── Loading overlay ───────────────────────────────────────────
function setLoadMsg(msg) {
  document.getElementById("loading-msg").textContent = msg;
}

// ── Boot ──────────────────────────────────────────────────────
async function boot() {
  await discoverAllLayers();

  const errors = validateAfterDiscovery();
  document.getElementById("loading-overlay").classList.add("hidden");

  if (errors.length) {
    errors.forEach(showAlert);
  }

  initPaletteUI();
  renderControls();
  await renderCanvas();
  renderStatus();
}