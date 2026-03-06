const FONTS = [
  { label: 'Helvetica Bold', css: 'Helvetica, Arial, sans-serif' },
  { label: 'Monospace',  css: 'ui-monospace, Menlo, "Courier New", monospace' },
  { label: 'Serif',      css: 'ui-serif, Georgia, "Times New Roman", serif' },
  { label: 'Rounded',    css: 'ui-rounded, "Hiragino Maru Gothic ProN", sans-serif' },
  { label: 'Arial',      css: 'Arial, Helvetica, sans-serif' },
  { label: 'Georgia',    css: 'Georgia, "Times New Roman", serif' },
  { label: 'Courier',    css: '"Courier New", Courier, monospace' },
  { label: 'Impact',     css: 'Impact, "Arial Narrow", sans-serif' },
  { label: 'Trebuchet',  css: '"Trebuchet MS", Helvetica, sans-serif' },
  { label: 'Palatino',   css: '"Palatino Linotype", Palatino, serif' },
];

const GRADIENTS = [
  { label: 'White',  css: '#ffffff' },
  { label: 'Gold',   css: 'linear-gradient(135deg,#f7d26a,#e8a000)' },
  { label: 'Neon',   css: 'linear-gradient(135deg,#00ffcc,#00b3ff)' },
  { label: 'Flame',  css: 'linear-gradient(135deg,#ff4e00,#ec9f05)' },
  { label: 'Rose',   css: 'linear-gradient(135deg,#f953c6,#b91d73)' },
  { label: 'Arctic', css: 'linear-gradient(135deg,#4facfe,#00f2fe)' },
  { label: 'Lime',   css: 'linear-gradient(135deg,#b8f400,#56e000)' },
  { label: 'Galaxy', css: 'linear-gradient(135deg,#c471ed,#f64f59,#12c2e9)' },
];

const BACKGROUNDS = [
  { label: 'Black',     css: '#000000' },
  { label: 'Deep Navy', css: '#050b1a' },
  { label: 'Slate',     css: '#0d1117' },
  { label: 'Charcoal',  css: '#1a1a1a' },
  { label: 'Night',     css: 'radial-gradient(ellipse at 20% 50%,#1a0533,#000)' },
  { label: 'Deep Sea',  css: 'radial-gradient(ellipse at 80% 20%,#001a2e,#000)' },
  { label: 'Forest',    css: 'linear-gradient(135deg,#0a1f0a,#001a00)' },
  { label: 'Ember',     css: 'radial-gradient(ellipse at 50% 80%,#2b0a00,#000)' },
  { label: 'Dusk',      css: 'linear-gradient(180deg,#0f0c29,#302b63,#24243e)' },
  { label: 'Ivory',     css: '#f5f0e8' },
  { label: 'Cloud',     css: 'linear-gradient(135deg,#e0eafc,#cfdef3)' },
  { label: 'Warm Gray', css: '#d6d0c4' },
];

/* ══ STATE ══ */
const state = {
  font:        FONTS[0].css,
  size:        18,
  gradient:    GRADIENTS[0].css,
  bg:          BACKGROUNDS[0].css,
  panelHeightVh: 50,
  format24:    true,
  showSeconds: true,
  screensaver: false,
  orientationMode: 'auto', // auto | portrait | landscape
  customFonts: [], // [{name, family, dataUrl}]
};

/* ══ STORAGE ══ */
const STORAGE_KEY = 'clock-prefs-v2';

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      font:        state.font,
      size:        state.size,
      gradient:    state.gradient,
      bg:          state.bg,
      panelHeightVh: state.panelHeightVh,
      format24:    state.format24,
      showSeconds: state.showSeconds,
      screensaver: state.screensaver,
      orientationMode: state.orientationMode,
      customFonts: state.customFonts, // saved as base64 dataUrls — persist across sessions!
    }));
  } catch(e) { console.warn('save failed', e); }
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    Object.keys(state).forEach(k => {
      if (saved[k] !== undefined) state[k] = saved[k];
    });
  } catch(e) { console.warn('load failed', e); }
}

loadState();

/* ══ CLOCK ELEMENTS ══ */
const clockEl    = document.getElementById('clock-display');
const clockStage = document.getElementById('clock-stage');
const ampmLandscape = document.getElementById('ampm-landscape');
const portraitHr  = document.getElementById('portrait-hr');
const portraitHrStage = document.getElementById('portrait-hr-stage');
const ampmPortrait = document.getElementById('ampm-portrait');
const portraitMin = document.getElementById('portrait-min');
const portraitSec = document.getElementById('portrait-sec');
const portraitWrap = document.getElementById('portrait-wrap');
const portraitMinLabel = document.getElementById('portrait-min-label');
const portraitSecRow = document.getElementById('portrait-sec-row');
const landscapeLabels = document.getElementById('landscape-labels');
const lsSec       = document.getElementById('ls-sec');
const clockTargets = [clockEl, portraitHr, portraitMin, portraitSec];
const flipMap = new WeakMap();
let fitTextRafId = null;
let fitTextRafId2 = null;

function clamp(val, min, max) {
  return Math.min(max, Math.max(min, val));
}

function toPct(value, total) {
  if (!total) return 0;
  return clamp((value / total) * 100, 0, 100);
}

function updateLandscapeLabelAnchors() {
  const line = flipMap.get(clockEl);
  if (!line || !line.slots || line.slots.length < 5) return;

  const parent = landscapeLabels.parentElement;
  const lineRect = clockEl.getBoundingClientRect();
  const maxTrackW = parent ? parent.clientWidth : lineRect.width;
  const trackW = clamp(lineRect.width, 120, Math.max(120, maxTrackW));
  landscapeLabels.style.width = `${trackW}px`;

  const labelRect = landscapeLabels.getBoundingClientRect();
  if (!labelRect.width) return;

  const slots = line.slots.map(s => s.node);
  const centerPct = (startIdx, endIdx) => {
    const start = slots[startIdx];
    const end = slots[endIdx];
    if (!start || !end) return null;
    const sRect = start.getBoundingClientRect();
    const eRect = end.getBoundingClientRect();
    const centerX = (sRect.left + eRect.right) / 2;
    return toPct(centerX - labelRect.left, labelRect.width);
  };

  const hrX = centerPct(0, 1);
  const minX = centerPct(3, 4);
  const secX = state.showSeconds ? centerPct(6, 7) : null;

  if (hrX !== null) landscapeLabels.style.setProperty('--ls-hr-x', `${hrX}%`);
  if (minX !== null) landscapeLabels.style.setProperty('--ls-min-x', `${minX}%`);
  if (secX !== null) landscapeLabels.style.setProperty('--ls-sec-x', `${secX}%`);
}

function updateAmPmSlots(suffix) {
  const hasSuffix = !!suffix;
  const text = hasSuffix ? suffix : '';
  ampmLandscape.textContent = text;
  ampmPortrait.textContent = text;
  ampmLandscape.style.display = hasSuffix ? '' : 'none';
  ampmPortrait.style.display = hasSuffix ? '' : 'none';
  clockStage.classList.toggle('no-ampm', !hasSuffix);
  portraitHrStage.classList.toggle('no-ampm', !hasSuffix);
}

function updatePortraitMinLabelPosition() {
  const placeBelow = !state.showSeconds;
  portraitMinLabel.classList.toggle('below', placeBelow);

  if (placeBelow) {
    if (portraitMin.nextElementSibling !== portraitMinLabel) {
      portraitWrap.insertBefore(portraitMinLabel, portraitSecRow);
    }
    return;
  }

  if (portraitMin.previousElementSibling !== portraitMinLabel) {
    portraitWrap.insertBefore(portraitMinLabel, portraitMin);
  }
}

function createMark(char) {
  const mark = document.createElement('span');
  mark.className = 'flip-mark clock-glyph';
  mark.textContent = char;
  return { type: 'mark', value: char, node: mark };
}

function createDigit(char) {
  const slot = document.createElement('span');
  slot.className = 'flip-slot digit';

  const staticFace = document.createElement('span');
  staticFace.className = 'flip-static clock-glyph';
  staticFace.textContent = char;

  const card = document.createElement('span');
  card.className = 'flip-card';

  const front = document.createElement('span');
  front.className = 'flip-face flip-front clock-glyph';
  front.textContent = char;

  const back = document.createElement('span');
  back.className = 'flip-face flip-back clock-glyph';
  back.textContent = char;

  card.append(front, back);
  slot.append(staticFace, card);
  return { type: 'digit', value: char, node: slot, staticFace, card, front, back };
}

function makeSlot(char) {
  return /\d/.test(char) ? createDigit(char) : createMark(char);
}

function buildFlipLine(el, text) {
  const chars = Array.from(text);
  const slots = chars.map(makeSlot);
  el.replaceChildren(...slots.map(s => s.node));
  flipMap.set(el, { slots });
}

function animateDigit(slot, nextChar) {
  if (slot.value === nextChar && !slot.node.classList.contains('flipping')) return;
  const fromChar = slot.staticFace.textContent;
  if (fromChar === nextChar) {
    slot.value = nextChar;
    return;
  }
  slot.value = nextChar;
  slot.front.textContent = fromChar;
  slot.back.textContent = nextChar;
  slot.animId = (slot.animId || 0) + 1;
  const thisAnim = slot.animId;
  slot.card.onanimationend = () => {
    if (slot.animId !== thisAnim) return;
    slot.staticFace.textContent = nextChar;
    slot.front.textContent = nextChar;
    slot.back.textContent = nextChar;
    slot.node.classList.remove('flipping');
  };
  slot.node.classList.remove('flipping');
  void slot.node.offsetWidth;
  slot.node.classList.add('flipping');
}

function renderFlipLine(el, text) {
  const chars = Array.from(text);
  const line = flipMap.get(el);
  if (!line || line.slots.length !== chars.length) {
    buildFlipLine(el, text);
    return;
  }

  for (let i = 0; i < chars.length; i++) {
    const nextChar = chars[i];
    const slot = line.slots[i];
    const isDigit = /\d/.test(nextChar);
    if ((slot.type === 'digit') !== isDigit) {
      buildFlipLine(el, text);
      return;
    }
    if (slot.type === 'digit') animateDigit(slot, nextChar);
    else if (slot.value !== nextChar) {
      slot.value = nextChar;
      slot.node.textContent = nextChar;
    }
  }
}

function settleAllFlips() {
  clockTargets.forEach(el => {
    const line = flipMap.get(el);
    if (!line) return;
    line.slots.forEach(slot => {
      if (slot.type !== 'digit') return;
      const value = slot.value ?? slot.staticFace.textContent;
      slot.staticFace.textContent = value;
      slot.front.textContent = value;
      slot.back.textContent = value;
      slot.node.classList.remove('flipping');
    });
  });
}

function tick() {
  const now = new Date();
  let h = now.getHours();
  const m = String(now.getMinutes()).padStart(2,'0');
  const s = String(now.getSeconds()).padStart(2,'0');

  let hStr, suffix = '';
  if (state.format24) {
    hStr = String(h).padStart(2,'0');
  } else {
    suffix = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    hStr = String(h).padStart(2,'0');
  }

  // Landscape: always one line — HH:MM[:SS]
  const secPart = state.showSeconds ? ':' + s : '';
  renderFlipLine(clockEl, hStr + ':' + m + secPart);

  // Portrait: split into blocks (AM/PM is rendered as outlined background text)
  renderFlipLine(portraitHr, hStr);
  renderFlipLine(portraitMin, m);
  renderFlipLine(portraitSec, s);
  updateAmPmSlots(suffix);

  // Show/hide sec row in portrait
  portraitSecRow.style.display = state.showSeconds ? 'flex' : 'none';
  updatePortraitMinLabelPosition();
  // Show/hide sec label in landscape
  lsSec.style.display = state.showSeconds ? '' : 'none';

  applyColor();
  fitText();
}

/* ══ SMART FIT TEXT ══
   Only shrinks if the element actually overflows its container.
   Uses the user's chosen size as the max — never goes above it.
   Only kicks in when needed, so small sizes are unaffected. */
function fitTextNow() {
  // Landscape: fit clock-display inside clock-wrap width + height budget
  const wrap = document.getElementById('clock-wrap');
  const labels = document.getElementById('landscape-labels');
  const wrapStyles = getComputedStyle(wrap);
  const padX = (parseFloat(wrapStyles.paddingLeft) || 0) + (parseFloat(wrapStyles.paddingRight) || 0);
  const padY = (parseFloat(wrapStyles.paddingTop) || 0) + (parseFloat(wrapStyles.paddingBottom) || 0);
  const gapY = parseFloat(wrapStyles.rowGap || wrapStyles.gap) || 0;
  const wrapW = Math.max(40, wrap.clientWidth - padX);
  const wrapH = Math.max(40, wrap.clientHeight - padY);
  const labelsH = labels ? labels.getBoundingClientRect().height : 0;
  const availableClockH = Math.max(24, wrapH - labelsH - gapY);
  const maxSize = state.size; // vmin — convert to px
  const vminPx = Math.min(window.innerWidth, window.innerHeight) / 100;
  const sizePx = maxSize * vminPx;

  let lLo = 4, lHi = Math.max(4, sizePx);
  for (let i = 0; i < 12; i++) {
    const mid = (lLo + lHi) / 2;
    clockEl.style.fontSize = mid + 'px';
    const fitsWidth = clockEl.scrollWidth <= wrapW;
    const fitsHeight = clockEl.getBoundingClientRect().height <= availableClockH;
    if (fitsWidth && fitsHeight) lLo = mid;
    else lHi = mid;
  }
  clockEl.style.fontSize = lLo + 'px';
  ampmLandscape.style.fontSize = Math.max(12, lLo * 0.36) + 'px';
  updateLandscapeLabelAnchors();

  // Portrait: one shared size, constrained by width and a row-height budget.
  // Using scrollHeight here can under-size due to 3D flip layers, so we
  // constrain height by target font size relative to available row height.
  const portraitAvailW = Math.max(120, portraitWrap.clientWidth - 8);
  const screenH = window.innerHeight - 16;
  const rowCount = state.showSeconds ? 3 : 2;
  const rowMaxH = screenH / rowCount;
  const vwPx = window.innerWidth / 100;
  const pMaxPx = maxSize * vwPx;
  const portraitNums = state.showSeconds ? [portraitHr, portraitMin, portraitSec] : [portraitHr, portraitMin];
  const rowFontBudget = rowMaxH * 0.78;

  let lo = 4, hi = pMaxPx;
  for (let i = 0; i < 12; i++) {
    const mid = (lo + hi) / 2;
    portraitNums.forEach(el => { el.style.fontSize = mid + 'px'; });
    const fits = portraitNums.every(el =>
      el.scrollWidth <= portraitAvailW
    );
    const fitsHeight = mid <= rowFontBudget;
    if (fits && fitsHeight) lo = mid;
    else hi = mid;
  }
  portraitNums.forEach(el => { el.style.fontSize = lo + 'px'; });
  ampmPortrait.style.fontSize = Math.max(11, lo * 0.34) + 'px';
}

function fitText() {
  if (fitTextRafId !== null) cancelAnimationFrame(fitTextRafId);
  if (fitTextRafId2 !== null) cancelAnimationFrame(fitTextRafId2);
  fitTextRafId = requestAnimationFrame(() => {
    fitTextRafId = null;
    fitTextRafId2 = requestAnimationFrame(() => {
      fitTextRafId2 = null;
      fitTextNow();
    });
  });
}

/* ══ APPLY STYLES ══ */
function applyFont() {
  clockTargets.forEach(el => {
    el.style.fontFamily = state.font;
    el.style.fontWeight = state.font === FONTS[0].css ? '700' : '400';
  });
  [ampmLandscape, ampmPortrait].forEach(el => {
    el.style.fontFamily = state.font;
    el.style.fontWeight = state.font === FONTS[0].css ? '700' : '500';
  });
}

function applySize() {
  // Size is applied via fitText() dynamically
  fitText();
}

function applyBg() {
  document.body.style.background = state.bg;
}

function applyPanelPortraitHeight() {
  const raw = Number(state.panelHeightVh);
  const clamped = Number.isFinite(raw) ? Math.max(35, Math.min(88, raw)) : 50;
  state.panelHeightVh = clamped;
  document.documentElement.style.setProperty('--panel-portrait-h', `${clamped}vh`);
}

function applyColor() {
  const css = state.gradient;
  const isGrad = css.startsWith('linear') || css.startsWith('radial');
  clockTargets.forEach(el => {
    if (isGrad) {
      [el, ...el.querySelectorAll('.clock-glyph')].forEach(g => {
        g.style.background = css;
        g.style.webkitBackgroundClip = 'text';
        g.style.backgroundClip = 'text';
        g.style.webkitTextFillColor = 'transparent';
        g.style.color = '';
      });
    } else {
      [el, ...el.querySelectorAll('.clock-glyph')].forEach(g => {
        g.style.background = 'none';
        g.style.webkitBackgroundClip = '';
        g.style.backgroundClip = '';
        g.style.webkitTextFillColor = '';
        g.style.color = css;
      });
    }
  });
}

function applyAll() { applyFont(); applyColor(); applyBg(); applyPanelPortraitHeight(); applySize(); }

/* ══ RESTORE SAVED CUSTOM FONTS ══ */
function restoreSavedFonts() {
  state.customFonts.forEach(f => {
    injectFont(f.family, f.dataUrl, f.name, false);
  });
}

/* ══ RESTORE UI ══ */
function restoreUI() {
  document.querySelectorAll('[data-format]').forEach(b =>
    b.classList.toggle('active', (b.dataset.format === '24') === state.format24));
  document.querySelectorAll('[data-seconds]').forEach(b =>
    b.classList.toggle('active', (b.dataset.seconds === 'show') === state.showSeconds));
  document.querySelectorAll('[data-screensaver]').forEach(b =>
    b.classList.toggle('active', (b.dataset.screensaver === 'on') === state.screensaver));
  document.querySelectorAll('[data-orientation]').forEach(b =>
    b.classList.toggle('active', b.dataset.orientation === state.orientationMode));
  document.getElementById('screensaver-hint').style.display = state.screensaver ? 'block' : 'none';
  // Mark active font btn
  let anyFontActive = false;
  document.querySelectorAll('.font-btn').forEach(b => {
    const active = b.dataset.css === state.font;
    b.classList.toggle('active', active);
    if (active) anyFontActive = true;
  });
  const sizeSlider = document.getElementById('size-slider');
  sizeSlider.value = state.size;
  document.getElementById('size-val').textContent = state.size;
  document.querySelectorAll('#gradient-grid .swatch').forEach(s =>
    s.classList.toggle('active', s.dataset.css === state.gradient));
  document.querySelectorAll('#bg-grid .swatch').forEach(s =>
    s.classList.toggle('active', s.dataset.css === state.bg));
}

/* ══ FONT HELPERS ══ */
function allSelectables() { return document.querySelectorAll('.font-btn, .cfont-chip'); }
function selectFontBtn(btn) { allSelectables().forEach(b => b.classList.remove('active')); btn.classList.add('active'); }

function injectFont(family, dataUrl, rawName, addToState = true) {
  // Inject @font-face
  const style = document.createElement('style');
  style.textContent = `@font-face { font-family: "${family}"; src: url("${dataUrl}"); }`;
  document.head.appendChild(style);

  // Add chip to UI
  const customFontsList = document.getElementById('custom-fonts-list');
  const chip = document.createElement('div');
  chip.className = 'cfont-chip';
  chip.dataset.family = family;

  const preview = document.createElement('span');
  preview.className = 'chip-preview';
  preview.style.fontFamily = family;
  preview.textContent = 'Aa';

  const nameSpan = document.createElement('span');
  nameSpan.className = 'chip-name';
  nameSpan.textContent = rawName;

  const delBtn = document.createElement('button');
  delBtn.className = 'chip-del';
  delBtn.textContent = '✕';
  delBtn.title = 'Remove font';
  delBtn.addEventListener('click', ev => {
    ev.stopPropagation();
    if (state.font === family) {
      state.font = FONTS[0].css; applyFont();
      allSelectables().forEach(b => b.classList.remove('active'));
      document.querySelector('.font-btn').classList.add('active');
    }
    // Remove from saved state
    state.customFonts = state.customFonts.filter(f => f.family !== family);
    saveState();
    chip.remove();
  });

  chip.append(preview, nameSpan, delBtn);
  chip.addEventListener('click', () => {
    selectFontBtn(chip); state.font = family; applyFont(); saveState();
  });
  customFontsList.appendChild(chip);

  // Mark active if this is the saved font
  if (state.font === family) selectFontBtn(chip);

  if (addToState) {
    state.customFonts.push({ name: rawName, family, dataUrl });
    saveState();
  }
}

/* ══ TOGGLES ══ */
document.querySelectorAll('[data-format]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-format]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.format24 = btn.dataset.format === '24';
    tick(); saveState();
  });
});

document.querySelectorAll('[data-seconds]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-seconds]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.showSeconds = btn.dataset.seconds === 'show';
    tick(); saveState();
  });
});

document.querySelectorAll('[data-screensaver]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-screensaver]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.screensaver = btn.dataset.screensaver === 'on';
    document.getElementById('screensaver-hint').style.display = state.screensaver ? 'block' : 'none';
    saveState(); setupBattery();
  });
});

document.querySelectorAll('[data-orientation]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-orientation]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.orientationMode = btn.dataset.orientation;
    applyOrientationMode();
    saveState();
  });
});

/* ══ FONT GRID ══ */
const fontGrid = document.getElementById('font-grid');
FONTS.forEach((f, i) => {
  const btn = document.createElement('button');
  btn.className = 'font-btn' + (i === 0 ? ' active' : '');
  btn.textContent = f.label;
  btn.style.fontFamily = f.css;
  btn.dataset.css = f.css;
  btn.title = f.label;
  btn.addEventListener('click', () => { selectFontBtn(btn); state.font = f.css; applyFont(); saveState(); });
  fontGrid.appendChild(btn);
});

/* ══ CUSTOM FONT UPLOAD ══
   Fonts are saved as base64 dataUrls so they survive app close */
document.getElementById('font-upload').addEventListener('change', (e) => {
  Array.from(e.target.files).forEach(file => {
    const rawName = file.name.replace(/\.[^.]+$/, '');
    const family  = 'CF_' + rawName.replace(/[^a-zA-Z0-9]/g, '_') + '_' + Date.now();
    const reader  = new FileReader();
    reader.onload = ev => {
      const dataUrl = ev.target.result; // base64 data URL — can be saved to localStorage!
      injectFont(family, dataUrl, rawName, true);
    };
    reader.readAsDataURL(file);
  });
  e.target.value = '';
});

/* ══ SIZE SLIDER ══ */
const sizeSlider = document.getElementById('size-slider');
const sizeValEl  = document.getElementById('size-val');
sizeSlider.addEventListener('input', () => {
  state.size = Number(sizeSlider.value);
  sizeValEl.textContent = state.size;
  applySize(); saveState();
});

/* ══ GRADIENT SWATCHES ══ */
const gradGrid = document.getElementById('gradient-grid');
GRADIENTS.forEach((g, i) => {
  const sw = document.createElement('div');
  sw.className = 'swatch' + (i === 0 ? ' active' : '');
  sw.style.background = g.css; sw.dataset.css = g.css; sw.title = g.label;
  sw.addEventListener('click', () => {
    gradGrid.querySelectorAll('.swatch').forEach(s => s.classList.remove('active'));
    sw.classList.add('active'); state.gradient = g.css; applyColor(); saveState();
  });
  gradGrid.appendChild(sw);
});
document.getElementById('custom-color').addEventListener('input', e => {
  gradGrid.querySelectorAll('.swatch').forEach(s => s.classList.remove('active'));
  state.gradient = e.target.value; applyColor(); saveState();
});

/* ══ BACKGROUND SWATCHES ══ */
const bgGrid = document.getElementById('bg-grid');
BACKGROUNDS.forEach((b, i) => {
  const sw = document.createElement('div');
  sw.className = 'swatch' + (i === 0 ? ' active' : '');
  sw.style.background = b.css; sw.dataset.css = b.css; sw.title = b.label;
  sw.addEventListener('click', () => {
    bgGrid.querySelectorAll('.swatch').forEach(s => s.classList.remove('active'));
    sw.classList.add('active'); state.bg = b.css; applyBg(); saveState();
  });
  bgGrid.appendChild(sw);
});
document.getElementById('custom-bg').addEventListener('input', e => {
  bgGrid.querySelectorAll('.swatch').forEach(s => s.classList.remove('active'));
  state.bg = e.target.value; applyBg(); saveState();
});

/* ══ PANEL + IDLE ══ */
const panel     = document.getElementById('panel');
const toggleBtn = document.getElementById('settings-toggle');
const closeBtn  = document.getElementById('panel-close');
const panelResizeGrip = document.getElementById('panel-resize-grip');
const IDLE_MS   = 3000;
let idleTimer   = null;
let isPanelResizing = false;
let panelResizePointerId = null;
let panelResizeStartY = 0;
let panelResizeStartVh = 50;

function isPortraitViewport() {
  return window.matchMedia('(orientation: portrait)').matches;
}

function scheduleHide() {
  clearTimeout(idleTimer);
  if (panel.classList.contains('open')) return;
  idleTimer = setTimeout(() => {
    if (!panel.classList.contains('open')) toggleBtn.classList.add('idle-hidden');
  }, IDLE_MS);
}
function onActivity() {
  if (ssActive) exitScreensaver();
  toggleBtn.classList.remove('idle-hidden'); scheduleHide();
}
['pointermove','pointerdown','keydown','touchstart'].forEach(evt =>
  document.addEventListener(evt, onActivity, { passive: true }));

const openPanel = () => {
  clearTimeout(idleTimer);
  toggleBtn.classList.remove('idle-hidden');
  panel.classList.add('open');
  toggleBtn.classList.add('panel-open');
};
const closePanelFn = () => {
  panel.classList.remove('open');
  toggleBtn.classList.remove('panel-open');
  scheduleHide();
};

toggleBtn.addEventListener('click', openPanel);
closeBtn.addEventListener('click', closePanelFn);
document.addEventListener('pointerdown', e => {
  if (panel.classList.contains('open') && !panel.contains(e.target) && e.target !== toggleBtn) closePanelFn();
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') closePanelFn(); });
scheduleHide();

function beginPanelResize(e) {
  if (!panel.classList.contains('open') || !isPortraitViewport()) return;
  isPanelResizing = true;
  panelResizePointerId = e.pointerId;
  panelResizeStartY = e.clientY;
  panelResizeStartVh = Number(state.panelHeightVh) || 50;
  panel.classList.add('resizing');
  if (panelResizeGrip.setPointerCapture) panelResizeGrip.setPointerCapture(e.pointerId);
  e.preventDefault();
}

function movePanelResize(e) {
  if (!isPanelResizing || e.pointerId !== panelResizePointerId) return;
  const deltaPx = panelResizeStartY - e.clientY;
  const deltaVh = (deltaPx / window.innerHeight) * 100;
  state.panelHeightVh = Number((panelResizeStartVh + deltaVh).toFixed(1));
  applyPanelPortraitHeight();
  fitText();
  e.preventDefault();
}

function endPanelResize(e) {
  if (!isPanelResizing) return;
  if (e && e.pointerId !== undefined && e.pointerId !== panelResizePointerId) return;
  isPanelResizing = false;
  panelResizePointerId = null;
  panel.classList.remove('resizing');
  saveState();
}

if (panelResizeGrip) {
  panelResizeGrip.addEventListener('pointerdown', beginPanelResize);
  panelResizeGrip.addEventListener('pointermove', movePanelResize);
  panelResizeGrip.addEventListener('pointerup', endPanelResize);
  panelResizeGrip.addEventListener('pointercancel', endPanelResize);
  panelResizeGrip.addEventListener('lostpointercapture', endPanelResize);
}

window.addEventListener('resize', () => {
  applyPanelPortraitHeight();
  settleAllFlips();
  fitText();
}, { passive: true });

function onOrientationChange() {
  applyOrientationMode();
  settleAllFlips();
  tick();
}
window.addEventListener('orientationchange', onOrientationChange, { passive: true });
if (screen.orientation && screen.orientation.addEventListener) {
  screen.orientation.addEventListener('change', onOrientationChange);
}
window.addEventListener('fullscreenchange', fitText, { passive: true });
window.addEventListener('webkitfullscreenchange', fitText, { passive: true });

function tryLockOrientation(target) {
  const o = screen && screen.orientation ? screen.orientation : null;
  try {
    if (o && typeof o.lock === 'function') {
      const maybe = o.lock(target);
      if (maybe && typeof maybe.catch === 'function') maybe.catch(() => {});
      return true;
    }
  } catch(e) {}
  try {
    if (screen && typeof screen.lockOrientation === 'function') return !!screen.lockOrientation(target);
    if (screen && typeof screen.mozLockOrientation === 'function') return !!screen.mozLockOrientation(target);
    if (screen && typeof screen.msLockOrientation === 'function') return !!screen.msLockOrientation(target);
  } catch(e) {}
  return false;
}

function tryUnlockOrientation() {
  const o = screen && screen.orientation ? screen.orientation : null;
  try {
    if (o && typeof o.unlock === 'function') {
      o.unlock();
      return true;
    }
  } catch(e) {}
  try {
    if (screen && typeof screen.unlockOrientation === 'function') {
      screen.unlockOrientation();
      return true;
    }
  } catch(e) {}
  return false;
}

function applyOrientationMode() {
  const mode = state.orientationMode || 'auto';
  if (mode === 'auto') {
    tryUnlockOrientation();
    return;
  }
  const target = mode === 'portrait' ? 'portrait' : 'landscape';
  tryLockOrientation(target);
}

/* ══ SCREENSAVER ══ */
let ssActive = false;
function enterScreensaver() {
  if (ssActive) return;
  ssActive = true;
  document.body.classList.add('ss-active');
  applyBg();
  toggleBtn.classList.add('idle-hidden');
}
function exitScreensaver() {
  if (!ssActive) return;
  ssActive = false;
  document.body.classList.remove('ss-active');
  applyBg();
}

let batteryRef = null;
function onChargingChange() {
  if (!batteryRef) return;
  if (state.screensaver && batteryRef.charging) enterScreensaver();
  else exitScreensaver();
}
function setupBattery() {
  if (!('getBattery' in navigator)) return;
  navigator.getBattery().then(battery => {
    batteryRef = battery;
    battery.removeEventListener('chargingchange', onChargingChange);
    battery.addEventListener('chargingchange', onChargingChange);
    onChargingChange();
  }).catch(() => {});
}

/* ══ WAKE LOCK ══ */
let wakeLock = null;
async function requestWakeLock() {
  if (!('wakeLock' in navigator)) return;
  try { wakeLock = await navigator.wakeLock.request('screen'); } catch(e) {}
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') requestWakeLock();
});
requestWakeLock();

/* ══ FULLSCREEN ══ */
async function requestFullscreen() {
  const el = document.documentElement;
  try {
    if      (el.requestFullscreen)       await el.requestFullscreen({ navigationUI: 'hide' });
    else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
  } catch(e) {}
}
document.getElementById('clock-wrap').addEventListener('click', e => {
  if (!panel.classList.contains('open') && e.target !== toggleBtn)
    if (!document.fullscreenElement && !document.webkitFullscreenElement) requestFullscreen();
});
document.getElementById('portrait-wrap').addEventListener('click', e => {
  if (!panel.classList.contains('open') && e.target !== toggleBtn)
    if (!document.fullscreenElement && !document.webkitFullscreenElement) requestFullscreen();
});
// Fullscreen must be initiated from a user gesture (tap/click), not on load.
window.addEventListener('load', () => { setTimeout(fitText, 80); });
window.addEventListener('load', () => { setTimeout(fitText, 260); });

if (document.fonts) {
  document.fonts.ready.then(() => fitText());
  if (document.fonts.addEventListener) {
    document.fonts.addEventListener('loadingdone', fitText);
  }
}

/* ══ SERVICE WORKER ══ */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}

document.addEventListener('deviceready', () => {
  applyOrientationMode();
  setTimeout(fitText, 80);
  setTimeout(fitText, 260);
}, false);

/* ══ INIT ══ */
restoreSavedFonts(); // restore custom fonts from localStorage first
applyAll();
applyOrientationMode();
restoreUI();
setupBattery();
tick();
setInterval(tick, 1000);
