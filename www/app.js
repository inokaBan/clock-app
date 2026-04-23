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
  orientationMode: 'auto', // auto | portrait | landscape
  customFonts: [], // [{name, family, dataUrl}]
  alarms: [], // [{id, time: "HH:MM", enabled, ringtoneId}]
  customRingtones: [], // [{id, name, dataUrl}]
  alarmFlashMode: 'auto', // auto | rear | front | off
  dimmingEnabled: true, // enable screen dimming on idle
  dimLevel: 70, // dimming level (0-100, higher = darker)
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
      orientationMode: state.orientationMode,
      customFonts: state.customFonts, // saved as base64 dataUrls — persist across sessions!
      alarms: state.alarms,
      customRingtones: state.customRingtones,
      alarmFlashMode: state.alarmFlashMode,
      dimmingEnabled: state.dimmingEnabled,
      dimLevel: state.dimLevel,
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

/* ══ CLOCK ELEMENTS ══ */
const clockEl    = document.getElementById('clock-display');
const portraitHr  = document.getElementById('portrait-hr');
const portraitMin = document.getElementById('portrait-min');
const portraitSec = document.getElementById('portrait-sec');
const portraitWrap = document.getElementById('portrait-wrap');
const portraitMinLabel = document.getElementById('portrait-min-label');
const portraitSecRow = document.getElementById('portrait-sec-row');
const landscapeLabels = document.getElementById('landscape-labels');
const lsSec       = document.getElementById('ls-sec');
const alarmTimeInput = document.getElementById('alarm-time-input');
const alarmAddBtn = document.getElementById('alarm-add-btn');
const alarmListEl = document.getElementById('alarm-list');
const alarmRingtoneSelect = document.getElementById('alarm-ringtone-select');
const ringtoneUploadInput = document.getElementById('ringtone-upload');
const alarmDefaultBtns = document.querySelectorAll('.alarm-default-btn');
const clockTargets = [clockEl, portraitHr, portraitMin, portraitSec];
const flipMap = new WeakMap();
let fitTextRafId = null;
let fitTextRafId2 = null;
const ALARM_FLASH_MODES = ['auto', 'rear', 'front', 'off'];
const BUILTIN_RINGTONES = [
  { id: 'builtin-classic', name: 'Classic Beep', pattern: [{ freq: 880, duration: 0.2, gap: 0.26 }] },
  { id: 'builtin-low', name: 'Low Beep', pattern: [{ freq: 640, duration: 0.26, gap: 0.32 }] },
  {
    id: 'builtin-triple',
    name: 'Triple Ping',
    pattern: [
      { freq: 900, duration: 0.12, gap: 0.06 },
      { freq: 1080, duration: 0.12, gap: 0.06 },
      { freq: 1260, duration: 0.14, gap: 0.42 },
    ],
  },
  {
    id: 'builtin-sweep',
    name: 'Up Sweep',
    pattern: [
      { freq: 620, duration: 0.11, gap: 0.05 },
      { freq: 760, duration: 0.11, gap: 0.05 },
      { freq: 900, duration: 0.11, gap: 0.05 },
      { freq: 1040, duration: 0.13, gap: 0.45 },
    ],
  },
  {
    id: 'builtin-urgent',
    name: 'Urgent Pulse',
    pattern: [
      { freq: 1250, duration: 0.09, gap: 0.05 },
      { freq: 1250, duration: 0.09, gap: 0.05 },
      { freq: 1250, duration: 0.09, gap: 0.25 },
      { freq: 1250, duration: 0.09, gap: 0.05 },
      { freq: 1250, duration: 0.09, gap: 0.05 },
      { freq: 1250, duration: 0.09, gap: 0.55 },
    ],
  },
  {
    id: 'builtin-chime',
    name: 'Soft Chime',
    pattern: [
      { freq: 720, duration: 0.2, gap: 0.05 },
      { freq: 960, duration: 0.2, gap: 0.6 },
    ],
  },
];
const DEFAULT_RINGTONE_ID = BUILTIN_RINGTONES[0].id;
loadState();
sanitizeAlarmState();
let activeAlarmId = null;
let activeAudio = null;
let beepIntervalId = null;
let vibrationIntervalId = null;
let beepTimeoutIds = [];
let lastCheckedMinuteStamp = '';
const minuteTriggersByAlarm = Object.create(null);
let audioContext = null;
let localNotifReady = false;
let pendingAlarmId = null;
let alarmFlashIntervalId = null;
let alarmFlashOffTimeoutId = null;
let torchAvailablePromise = null;
let alarmFlashRunToken = 0;
let torchFlashState = false;

function clamp(val, min, max) {
  return Math.min(max, Math.max(min, val));
}

function normalizeAlarmTime(value) {
  return /^\d{2}:\d{2}$/.test(value) ? value : null;
}

function minuteStamp(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d} ${h}:${min}`;
}

function getRingtoneById(id) {
  const custom = state.customRingtones.find(r => r.id === id);
  if (custom) return { ...custom, kind: 'custom' };
  const builtin = BUILTIN_RINGTONES.find(r => r.id === id);
  if (builtin) return { ...builtin, kind: 'builtin' };
  return { ...BUILTIN_RINGTONES[0], kind: 'builtin' };
}

function formatAlarmTime(time) {
  const normalized = normalizeAlarmTime(time);
  if (!normalized) return '--:--';
  const [hhStr, mm] = normalized.split(':');
  let hh = Number(hhStr);
  if (state.format24) return `${String(hh).padStart(2, '0')}:${mm}`;
  const suffix = hh >= 12 ? 'PM' : 'AM';
  hh = hh % 12 || 12;
  return `${String(hh).padStart(2, '0')}:${mm} ${suffix}`;
}

function sanitizeAlarmState() {
  if (!Array.isArray(state.customRingtones)) state.customRingtones = [];
  if (!Array.isArray(state.alarms)) state.alarms = [];
  if (!ALARM_FLASH_MODES.includes(state.alarmFlashMode)) state.alarmFlashMode = 'auto';
  state.customRingtones = state.customRingtones.filter(r =>
    r && typeof r.id === 'string' && typeof r.name === 'string' && typeof r.dataUrl === 'string'
  );
  state.alarms = state.alarms
    .filter(a => a && typeof a.id === 'string' && normalizeAlarmTime(a.time))
    .map(a => ({
      id: a.id,
      time: a.time,
      enabled: a.enabled !== false,
      ringtoneId: (a.ringtoneId && getRingtoneById(a.ringtoneId).id) || DEFAULT_RINGTONE_ID,
    }));
}

function renderRingtoneOptions() {
  const options = [
    ...BUILTIN_RINGTONES.map(r => ({ id: r.id, name: r.name })),
    ...state.customRingtones.map(r => ({ id: r.id, name: `${r.name} (Custom)` })),
  ];
  alarmRingtoneSelect.replaceChildren();
  options.forEach(opt => {
    const node = document.createElement('option');
    node.value = opt.id;
    node.textContent = opt.name;
    alarmRingtoneSelect.appendChild(node);
  });
  const selected = alarmRingtoneSelect.value;
  alarmRingtoneSelect.value = options.some(o => o.id === selected) ? selected : DEFAULT_RINGTONE_ID;
}

function renderAlarmList() {
  alarmListEl.replaceChildren();
  if (!state.alarms.length) {
    const empty = document.createElement('div');
    empty.className = 'alarm-ringtone';
    empty.textContent = 'No alarms yet.';
    alarmListEl.appendChild(empty);
    return;
  }

  state.alarms
    .sort((a, b) => a.time.localeCompare(b.time))
    .forEach(alarm => {
      const item = document.createElement('div');
      item.className = 'alarm-item';

      const timeEl = document.createElement('div');
      timeEl.className = 'alarm-time';
      timeEl.textContent = formatAlarmTime(alarm.time);

      const ringtoneEl = document.createElement('div');
      ringtoneEl.className = 'alarm-ringtone';
      ringtoneEl.textContent = getRingtoneById(alarm.ringtoneId).name;

      const toggleEl = document.createElement('button');
      toggleEl.className = alarm.enabled ? 'active' : '';
      toggleEl.textContent = alarm.enabled ? 'ON' : 'OFF';
      toggleEl.addEventListener('click', () => {
        alarm.enabled = !alarm.enabled;
        saveState();
        renderAlarmList();
        syncScheduledAlarms();
      });

      const delEl = document.createElement('button');
      delEl.className = 'alarm-del';
      delEl.textContent = 'DEL';
      delEl.addEventListener('click', () => {
        if (activeAlarmId === alarm.id) stopActiveAlarm();
        state.alarms = state.alarms.filter(a => a.id !== alarm.id);
        delete minuteTriggersByAlarm[alarm.id];
        saveState();
        renderAlarmList();
        syncScheduledAlarms();
      });

      item.append(timeEl, ringtoneEl, toggleEl, delEl);
      alarmListEl.appendChild(item);
    });
}

function getAudioContext() {
  if (!window.AudioContext && !window.webkitAudioContext) return null;
  if (!audioContext) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    audioContext = new Ctx();
  }
  if (audioContext.state === 'suspended') audioContext.resume().catch(() => {});
  return audioContext;
}

function playBeep(freq, durationSec) {
  const ctx = getAudioContext();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.16, ctx.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + durationSec);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + durationSec + 0.02);
}

function clearBeepTimers() {
  clearInterval(beepIntervalId);
  beepIntervalId = null;
  beepTimeoutIds.forEach(id => clearTimeout(id));
  beepTimeoutIds = [];
}

function getRingtonePattern(ringtone) {
  if (Array.isArray(ringtone.pattern) && ringtone.pattern.length) return ringtone.pattern;
  if (Number.isFinite(ringtone.freq) && Number.isFinite(ringtone.duration)) {
    return [{ freq: ringtone.freq, duration: ringtone.duration, gap: Number(ringtone.gap) || 0.2 }];
  }
  return BUILTIN_RINGTONES[0].pattern;
}

function playPatternCycle(pattern) {
  let offsetMs = 0;
  pattern.forEach(note => {
    const startId = setTimeout(() => {
      playBeep(note.freq, note.duration);
    }, offsetMs);
    beepTimeoutIds.push(startId);
    offsetMs += Math.round((note.duration + (Number(note.gap) || 0)) * 1000);
  });
  return Math.max(offsetMs, 180);
}

function startBuiltinPattern(ringtone) {
  const pattern = getRingtonePattern(ringtone);
  clearBeepTimers();
  const cycleMs = playPatternCycle(pattern);
  beepIntervalId = setInterval(() => {
    playPatternCycle(pattern);
  }, cycleMs);
}

function startVibrationLoop() {
  if (!('vibrate' in navigator)) return;
  navigator.vibrate([500, 250, 500]);
  clearInterval(vibrationIntervalId);
  vibrationIntervalId = setInterval(() => {
    navigator.vibrate([500, 250, 500]);
  }, 1250);
}

function stopVibrationLoop() {
  clearInterval(vibrationIntervalId);
  vibrationIntervalId = null;
  if ('vibrate' in navigator) navigator.vibrate(0);
}

function getFlashlightPlugin() {
  return (window.plugins && window.plugins.flashlight) || null;
}

function isCordovaRuntime() {
  return !!window.cordova;
}

function getAlarmFlashMode() {
  return ALARM_FLASH_MODES.includes(state.alarmFlashMode) ? state.alarmFlashMode : 'auto';
}

function setTorchEnabled(enabled) {
  return new Promise(resolve => {
    const plugin = getFlashlightPlugin();
    if (!plugin) {
      resolve(false);
      return;
    }
    const finish = () => resolve(true);
    const fail = () => resolve(false);
    try {
      if (enabled) plugin.switchOn(finish, fail);
      else plugin.switchOff(finish, fail);
    } catch (e) {
      resolve(false);
    }
  });
}

function checkTorchAvailable() {
  if (torchAvailablePromise) return torchAvailablePromise;
  torchAvailablePromise = new Promise(resolve => {
    const plugin = getFlashlightPlugin();
    if (!plugin || typeof plugin.available !== 'function') {
      resolve(false);
      return;
    }
    try {
      plugin.available(isAvailable => resolve(!!isAvailable));
    } catch (e) {
      resolve(false);
    }
  }).catch(() => false);
  return torchAvailablePromise;
}

function startScreenFlashLoop() {
  document.body.classList.add('alarm-screen-flashing');
}

function stopScreenFlashLoop() {
  document.body.classList.remove('alarm-screen-flashing');
}

function pulseTorchLoop() {
  // Toggle the torch state for a clear ON/OFF pattern
  torchFlashState = !torchFlashState;
  setTorchEnabled(torchFlashState);
}

async function startAlarmFlash() {
  stopAlarmFlash(false);
  const runToken = ++alarmFlashRunToken;
  const mode = getAlarmFlashMode();
  if (mode === 'off') return;
  if (mode === 'front') {
    if (runToken !== alarmFlashRunToken || !activeAlarmId) return;
    startScreenFlashLoop();
    return;
  }
  const canUseTorch = isCordovaRuntime() && await checkTorchAvailable();
  if (runToken !== alarmFlashRunToken || !activeAlarmId) return;
  if (canUseTorch) {
    // Start with torch ON
    torchFlashState = true;
    setTorchEnabled(true);
    // Flash every 200ms for a clear 2.5Hz strobe effect (ON 200ms, OFF 200ms)
    alarmFlashIntervalId = setInterval(pulseTorchLoop, 200);
    return;
  }
  if (mode === 'auto') startScreenFlashLoop();
}

function stopAlarmFlash(shouldInvalidate = true) {
  if (shouldInvalidate) alarmFlashRunToken += 1;
  clearInterval(alarmFlashIntervalId);
  alarmFlashIntervalId = null;
  clearTimeout(alarmFlashOffTimeoutId);
  alarmFlashOffTimeoutId = null;
  torchFlashState = false;
  stopScreenFlashLoop();
  setTorchEnabled(false);
}

function stopActiveAlarm() {
  if (!activeAlarmId) return;
  activeAlarmId = null;
  pendingAlarmId = null;
  document.body.classList.remove('alarm-ringing');
  if (activeAudio) {
    activeAudio.pause();
    activeAudio = null;
  }
  clearBeepTimers();
  stopVibrationLoop();
  stopAlarmFlash();
}

function startAlarm(alarm) {
  if (!alarm || activeAlarmId) return;
  pendingAlarmId = null;
  activeAlarmId = alarm.id;
  document.body.classList.add('alarm-ringing');
  startVibrationLoop();
  startAlarmFlash();

  const ringtone = getRingtoneById(alarm.ringtoneId);
  if (ringtone.kind === 'custom') {
    const audio = new Audio(ringtone.dataUrl);
    audio.loop = true;
    audio.play().then(() => {
      activeAudio = audio;
    }).catch(() => {
      const fallback = BUILTIN_RINGTONES[0];
      startBuiltinPattern(fallback);
    });
    return;
  }

  startBuiltinPattern(ringtone);
}

function getLocalNotification() {
  return (
    window.cordova &&
    window.cordova.plugins &&
    window.cordova.plugins.notification &&
    window.cordova.plugins.notification.local
  ) || null;
}

function hashAlarmId(id) {
  let hash = 2166136261;
  for (let i = 0; i < id.length; i++) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
}

function getNextAlarmDate(time) {
  const [hh, mm] = time.split(':').map(n => Number(n));
  const now = new Date();
  const next = new Date(now);
  next.setSeconds(0, 0);
  next.setHours(hh, mm, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  return next;
}

function queueOrStartAlarm(alarm) {
  if (!alarm || alarm.enabled === false) return;
  if (document.visibilityState === 'visible') {
    startAlarm(alarm);
    return;
  }
  pendingAlarmId = alarm.id;
}

function flushPendingAlarm() {
  if (!pendingAlarmId || activeAlarmId) return;
  const alarm = state.alarms.find(a => a.id === pendingAlarmId && a.enabled);
  if (!alarm) {
    pendingAlarmId = null;
    return;
  }
  startAlarm(alarm);
}

function syncScheduledAlarms() {
  const local = getLocalNotification();
  if (!local || !localNotifReady) return;
  const enabled = state.alarms.filter(a => a.enabled && normalizeAlarmTime(a.time));
  local.cancelAll(() => {
    enabled.forEach(alarm => {
      const time = normalizeAlarmTime(alarm.time);
      if (!time) return;
      const [hour, minute] = time.split(':').map(n => Number(n));
      const nextDate = getNextAlarmDate(time);
      local.schedule({
        id: hashAlarmId(alarm.id),
        title: 'Alarm',
        text: `Alarm ${formatAlarmTime(time)}`,
        trigger: { firstAt: nextDate, every: { hour, minute } },
        foreground: true,
        wakeup: true,
        priority: 2,
        visibility: 1,
        smallIcon: 'res://icon',
        vibrate: true,
        data: { alarmId: alarm.id },
        allowWhileIdle: true,
      });
    });
  });
}

function initLocalNotifications() {
  const local = getLocalNotification();
  if (!local) return;
  local.requestPermission(granted => {
    localNotifReady = !!granted;
    if (!localNotifReady) return;
    if (typeof local.on === 'function') {
      local.on('trigger', notification => {
        const alarmId = notification && notification.data && notification.data.alarmId;
        const alarm = state.alarms.find(a => a.id === alarmId);
        queueOrStartAlarm(alarm);
      });
      local.on('click', notification => {
        const alarmId = notification && notification.data && notification.data.alarmId;
        const alarm = state.alarms.find(a => a.id === alarmId);
        queueOrStartAlarm(alarm);
        flushPendingAlarm();
      });
    }
    syncScheduledAlarms();
  });
}

function checkAlarms(now) {
  const currentMinuteStamp = minuteStamp(now);
  if (currentMinuteStamp === lastCheckedMinuteStamp) return;
  lastCheckedMinuteStamp = currentMinuteStamp;

  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const nowTime = `${hh}:${mm}`;
  const dueAlarm = state.alarms.find(a => a.enabled && a.time === nowTime && minuteTriggersByAlarm[a.id] !== currentMinuteStamp);
  if (!dueAlarm) return;

  minuteTriggersByAlarm[dueAlarm.id] = currentMinuteStamp;
  startAlarm(dueAlarm);
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
  if (slot.value === nextChar) return;
  const fromChar = slot.staticFace.textContent;
  if (fromChar === nextChar) {
    slot.value = nextChar;
    slot.staticFace.textContent = nextChar;
    slot.front.textContent = nextChar;
    slot.back.textContent = nextChar;
    slot.node.classList.remove('flipping');
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

  let hStr;
  if (state.format24) {
    hStr = String(h).padStart(2,'0');
  } else {
    h = h % 12 || 12;
    hStr = String(h).padStart(2,'0');
  }

  // Landscape: always one line — HH:MM[:SS]
  const secPart = state.showSeconds ? ':' + s : '';
  renderFlipLine(clockEl, hStr + ':' + m + secPart);

  // Portrait: split into blocks
  renderFlipLine(portraitHr, hStr);
  renderFlipLine(portraitMin, m);
  renderFlipLine(portraitSec, s);

  // Show/hide sec row in portrait
  portraitSecRow.style.display = state.showSeconds ? 'flex' : 'none';
  updatePortraitMinLabelPosition();
  // Show/hide sec label in landscape
  lsSec.style.display = state.showSeconds ? '' : 'none';

  checkAlarms(now);
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
  document.querySelectorAll('[data-orientation]').forEach(b =>
    b.classList.toggle('active', b.dataset.orientation === state.orientationMode));
  document.querySelectorAll('[data-alarm-flash]').forEach(b =>
    b.classList.toggle('active', b.dataset.alarmFlash === state.alarmFlashMode));
  document.querySelectorAll('[data-dimming]').forEach(b =>
    b.classList.toggle('active', (b.dataset.dimming === 'on') === state.dimmingEnabled));
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
  const dimLevelSlider = document.getElementById('dim-level-slider');
  if (dimLevelSlider) {
    dimLevelSlider.value = state.dimLevel;
    document.getElementById('dim-level-val').textContent = state.dimLevel + '%';
  }
  document.querySelectorAll('#gradient-grid .swatch').forEach(s =>
    s.classList.toggle('active', s.dataset.css === state.gradient));
  document.querySelectorAll('#bg-grid .swatch').forEach(s =>
    s.classList.toggle('active', s.dataset.css === state.bg));
  renderRingtoneOptions();
  renderAlarmList();
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
    renderAlarmList();
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

document.querySelectorAll('[data-orientation]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-orientation]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.orientationMode = btn.dataset.orientation;
    applyOrientationMode();
    saveState();
  });
});

document.querySelectorAll('[data-alarm-flash]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-alarm-flash]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.alarmFlashMode = ALARM_FLASH_MODES.includes(btn.dataset.alarmFlash) ? btn.dataset.alarmFlash : 'auto';
    if (activeAlarmId) startAlarmFlash();
    saveState();
  });
});

document.querySelectorAll('[data-dimming]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-dimming]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.dimmingEnabled = btn.dataset.dimming === 'on';
    if (!state.dimmingEnabled) exitDimming();
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

/* ══ DIM LEVEL SLIDER ══ */
const dimLevelSlider = document.getElementById('dim-level-slider');
const dimLevelValEl  = document.getElementById('dim-level-val');
dimLevelSlider.addEventListener('input', () => {
  state.dimLevel = Number(dimLevelSlider.value);
  dimLevelValEl.textContent = state.dimLevel + '%';
  if (isDimmed) {
    const dimOpacity = state.dimLevel / 100;
    document.body.style.setProperty('--dim-opacity', dimOpacity);
  }
  saveState();
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

/* ══ ALARMS ══ */
function setDefaultAlarmInput() {
  setAlarmInputOffset(1);
}

function setAlarmInputOffset(offsetMinutes) {
  const now = new Date();
  now.setMinutes(now.getMinutes() + offsetMinutes);
  alarmTimeInput.value = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

alarmAddBtn.addEventListener('click', () => {
  const time = normalizeAlarmTime(alarmTimeInput.value);
  if (!time) return;
  const id = `alarm_${Date.now()}_${Math.floor(Math.random() * 9999)}`;
  const ringtoneId = getRingtoneById(alarmRingtoneSelect.value).id;
  state.alarms.push({ id, time, enabled: true, ringtoneId });
  saveState();
  renderAlarmList();
  syncScheduledAlarms();
  setAlarmInputOffset(1);
});

alarmDefaultBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const offset = Number(btn.dataset.alarmOffset);
    if (!Number.isFinite(offset) || offset < 1) return;
    setAlarmInputOffset(offset);
  });
});

ringtoneUploadInput.addEventListener('change', (e) => {
  Array.from(e.target.files).forEach(file => {
    const name = file.name.replace(/\.[^.]+$/, '') || 'Custom ringtone';
    const reader = new FileReader();
    reader.onload = ev => {
      state.customRingtones.push({
        id: `ringtone_${Date.now()}_${Math.floor(Math.random() * 9999)}`,
        name,
        dataUrl: ev.target.result,
      });
      saveState();
      renderRingtoneOptions();
      alarmRingtoneSelect.value = state.customRingtones[state.customRingtones.length - 1].id;
      renderAlarmList();
    };
    reader.readAsDataURL(file);
  });
  e.target.value = '';
});

/* ══ SCREEN DIMMING ══ */
let isDimmed = false;
function enterDimming() {
  if (isDimmed || !state.dimmingEnabled) return;
  isDimmed = true;
  document.body.classList.add('dimmed');
  const dimOpacity = Math.max(0, Math.min(100, state.dimLevel)) / 100;
  document.body.style.setProperty('--dim-opacity', dimOpacity);
}
function exitDimming() {
  if (!isDimmed) return;
  isDimmed = false;
  document.body.classList.remove('dimmed');
}

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
    if (!panel.classList.contains('open')) {
      toggleBtn.classList.add('idle-hidden');
      enterDimming();
    }
  }, IDLE_MS);
}
function onActivity() {
  exitDimming();
  toggleBtn.classList.remove('idle-hidden'); scheduleHide();
}
['pointermove','pointerdown','keydown','touchstart'].forEach(evt =>
  document.addEventListener(evt, onActivity, { passive: true }));
document.addEventListener('pointerdown', () => {
  if (activeAlarmId) stopActiveAlarm();
}, { passive: true });

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

/* ══ WAKE LOCK ══ */
let wakeLock = null;
let useInsomnia = false;
function requestInsomnia() {
  const insomnia = window.plugins && window.plugins.insomnia;
  if (!insomnia || typeof insomnia.keepAwake !== 'function') return false;
  try {
    insomnia.keepAwake();
    return true;
  } catch (e) {
    return false;
  }
}
function releaseInsomnia() {
  const insomnia = window.plugins && window.plugins.insomnia;
  if (!insomnia || typeof insomnia.allowSleepAgain !== 'function') return;
  try { insomnia.allowSleepAgain(); } catch (e) {}
}
async function requestWakeLock() {
  if (wakeLock || useInsomnia) return;
  if (isCordovaRuntime() && requestInsomnia()) {
    useInsomnia = true;
    return;
  }
  if ('wakeLock' in navigator) {
    try {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => {
        wakeLock = null;
        if (document.visibilityState === 'visible') requestWakeLock();
      });
      return;
    } catch (e) {}
  }
  if (requestInsomnia()) useInsomnia = true;
}
function clearWakeLock() {
  if (wakeLock) {
    try { wakeLock.release(); } catch (e) {}
    wakeLock = null;
  }
  if (useInsomnia) {
    releaseInsomnia();
    useInsomnia = false;
  }
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    requestWakeLock();
    flushPendingAlarm();
    if (activeAlarmId) startAlarmFlash();
  }
  else {
    clearWakeLock();
    if (activeAlarmId) stopAlarmFlash();
  }
});
window.addEventListener('focus', requestWakeLock, { passive: true });
document.addEventListener('pause', clearWakeLock, false);
document.addEventListener('pause', stopAlarmFlash, false);
document.addEventListener('resume', requestWakeLock, false);
document.addEventListener('resume', () => {
  flushPendingAlarm();
  if (activeAlarmId) startAlarmFlash();
}, false);
window.addEventListener('beforeunload', stopAlarmFlash, { passive: true });
requestWakeLock();

// Re-assert wake lock periodically in case the OS or WebView releases it.
setInterval(() => {
  if (document.visibilityState === 'visible') requestWakeLock();
}, 30000);

/* ══ FULLSCREEN ══ */
async function requestFullscreen() {
  const el = document.documentElement;
  try {
    if      (el.requestFullscreen)       await el.requestFullscreen({ navigationUI: 'hide' });
    else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
  } catch(e) {}
}
document.getElementById('clock-wrap').addEventListener('click', e => {
  if (activeAlarmId) return;
  if (!panel.classList.contains('open') && e.target !== toggleBtn)
    if (!document.fullscreenElement && !document.webkitFullscreenElement) requestFullscreen();
});
document.getElementById('portrait-wrap').addEventListener('click', e => {
  if (activeAlarmId) return;
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
  requestWakeLock();
  initLocalNotifications();
  setTimeout(fitText, 80);
  setTimeout(fitText, 260);
}, false);

/* ══ INIT ══ */
restoreSavedFonts(); // restore custom fonts from localStorage first
applyAll();
applyOrientationMode();
restoreUI();
setDefaultAlarmInput();
tick();
setInterval(tick, 1000);
