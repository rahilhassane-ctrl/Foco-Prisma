const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");

const scoreEl = document.querySelector("#score");
const streakEl = document.querySelector("#streak");
const timeEl = document.querySelector("#time");
const bestEl = document.querySelector("#best");
const accuracyEl = document.querySelector("#accuracy");
const qualityEl = document.querySelector("#quality");
const levelEl = document.querySelector("#level");
const tempoEl = document.querySelector("#tempo");
const todayEl = document.querySelector("#today");
const goalEl = document.querySelector("#goal");
const stateEl = document.querySelector("#state");
const targetTextEl = document.querySelector("#targetText");
const targetSymbolEl = document.querySelector("#targetSymbol");
const timebarFill = document.querySelector("#timebarFill");
const feedbackEl = document.querySelector("#feedback");
const overlay = document.querySelector("#overlay");
const startBtn = document.querySelector("#startBtn");
const pauseBtn = document.querySelector("#pauseBtn");
const breathBtn = document.querySelector("#breathBtn");
const soundBtn = document.querySelector("#soundBtn");
const resetBtn = document.querySelector("#resetBtn");
const overlayStart = document.querySelector("#overlayStart");
const modeDescriptionEl = document.querySelector("#modeDescription");
const modeButtons = document.querySelectorAll(".mode-btn");
const durationButtons = document.querySelectorAll("[data-duration]");
const intensityButtons = document.querySelectorAll("[data-intensity]");
const goalButtons = document.querySelectorAll("[data-goal]");
const prepToggle = document.querySelector("#prepToggle");
const calmToggle = document.querySelector("#calmToggle");
const hapticToggle = document.querySelector("#hapticToggle");

const colors = [
  { name: "azul", label: "Azul", value: "#3267d6" },
  { name: "vermelho", label: "Vermelho", value: "#d94f45" },
  { name: "verde", label: "Verde", value: "#287f55" },
  { name: "dourado", label: "Dourado", value: "#d99a2b" },
  { name: "turquesa", label: "Turquesa", value: "#087f8c" },
];

const shapes = [
  { name: "circular", label: "circular" },
  { name: "quadrado", label: "quadrado" },
  { name: "triangular", label: "triangular" },
  { name: "diamante", label: "diamante" },
];

const defaultDuration = 60;
const bestKeyPrefix = "focoPrismaBestScore";
const sessionsKeyPrefix = "focoPrismaSessions";
const settingsKeyPrefix = "focoPrismaSetting";
const intensityConfig = {
  gentle: { name: "Leve", speed: 0.84, spawn: 0.16, penalty: 0.72, bonus: 0, target: 0.06 },
  normal: { name: "Foco", speed: 1, spawn: 0, penalty: 1, bonus: 0, target: 0 },
  pro: { name: "Pro", speed: 1.18, spawn: -0.08, penalty: 1.22, bonus: 5, target: -0.04 },
};
const modes = {
  selective: {
    name: "Alvo único",
    description: "Alvo único: toque apenas nas peças que combinam com o alvo. Treina atenção seletiva e resistência contra distrações.",
    ready: "Respire. Observe. Toque apenas no alvo.",
  },
  sequence: {
    name: "Sequência",
    description: "Sequência: siga uma ordem de 3 alvos. Treina memória de trabalho, atenção e troca rápida de foco.",
    ready: "Memorize a ordem. Toque o alvo pedido da sequência.",
  },
  pulse: {
    name: "Pulso",
    description: "Pulso: toque no alvo apenas quando o anel central estiver aceso. Treina autocontrolo e precisão sob pressão.",
    ready: "Espere o pulso acender. Depois toque no alvo.",
  },
};
let state = freshState();
let lastFrame = 0;
let spawnClock = 0;
let target = { color: colors[0], shape: shapes[0] };
let sequence = [];
let sequenceIndex = 0;
let selectedMode = "selective";
let sessionDuration = defaultDuration;
let selectedIntensity = "normal";
let dailyGoal = readSetting("dailyGoal", 3);
let prepEnabled = readSetting("prepEnabled", true);
let calmEffects = readSetting("calmEffects", false);
let hapticEnabled = readSetting("hapticEnabled", true);
let audioCtx = null;
let soundEnabled = true;
let bestScore = readBestScore();
let todaySessions = readTodaySessions();

function freshState() {
  return {
    running: false,
    paused: false,
    over: false,
    score: 0,
    streak: 0,
    bestStreak: 0,
    hits: 0,
    misses: 0,
    clicks: 0,
    time: sessionDuration,
    level: 1,
    pieces: [],
    particles: [],
    ripples: [],
    targetShift: 0,
    messageClock: 0,
    pulse: 0,
    prep: prepEnabled ? 3 : 0,
    started: !prepEnabled,
    breath: 0,
    wasPausedBeforeBreath: false,
  };
}

function resizeCanvas() {
  const box = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.max(320, Math.floor(box.width * ratio));
  canvas.height = Math.max(320, Math.floor(box.height * ratio));
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
}

function ensureAudio() {
  if (!soundEnabled) return;
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === "suspended") audioCtx.resume();
}

function playTone(type) {
  if (!soundEnabled) return;
  ensureAudio();
  if (!audioCtx) return;

  const now = audioCtx.currentTime;
  const gain = audioCtx.createGain();
  gain.connect(audioCtx.destination);
  gain.gain.setValueAtTime(0.0001, now);

  const osc = audioCtx.createOscillator();
  osc.connect(gain);
  osc.type = type === "miss" ? "sawtooth" : "sine";

  if (type === "hit") {
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(760, now + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.16, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
    osc.start(now);
    osc.stop(now + 0.18);
  } else if (type === "combo") {
    osc.frequency.setValueAtTime(660, now);
    osc.frequency.exponentialRampToValueAtTime(990, now + 0.11);
    gain.gain.exponentialRampToValueAtTime(0.2, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
    osc.start(now);
    osc.stop(now + 0.24);
  } else if (type === "shift") {
    osc.frequency.setValueAtTime(350, now);
    osc.frequency.exponentialRampToValueAtTime(610, now + 0.14);
    gain.gain.exponentialRampToValueAtTime(0.12, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);
    osc.start(now);
    osc.stop(now + 0.26);
  } else {
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(90, now + 0.12);
    gain.gain.exponentialRampToValueAtTime(0.14, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
    osc.start(now);
    osc.stop(now + 0.2);
  }
}

function bestKey() {
  return `${bestKeyPrefix}:${selectedMode}:${sessionDuration}:${selectedIntensity}`;
}

function settingKey(name) {
  return `${settingsKeyPrefix}:${name}`;
}

function readSetting(name, fallback) {
  try {
    const saved = localStorage.getItem(settingKey(name));
    return saved === null ? fallback : JSON.parse(saved);
  } catch {
    return fallback;
  }
}

function saveSetting(name, value) {
  try {
    localStorage.setItem(settingKey(name), JSON.stringify(value));
  } catch {
    // Local storage may be blocked for local files on some phones.
  }
}

function todayKey() {
  const now = new Date();
  const date = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
  return `${sessionsKeyPrefix}:${date}`;
}

function readBestScore() {
  try {
    return Number(localStorage.getItem(bestKey()) || 0);
  } catch {
    return 0;
  }
}

function readTodaySessions() {
  try {
    return Number(localStorage.getItem(todayKey()) || 0);
  } catch {
    return 0;
  }
}

function saveTodaySessions(value) {
  try {
    localStorage.setItem(todayKey(), String(value));
  } catch {
    // Local storage may be blocked for local files on some phones.
  }
}

function saveBestScore(value) {
  try {
    localStorage.setItem(bestKey(), String(value));
  } catch {
    // Some mobile browsers can block local storage for local files.
  }
}

function haptic(pattern) {
  if (!hapticEnabled || !navigator.vibrate) return;
  navigator.vibrate(pattern);
}

function modeInfo() {
  return modes[selectedMode];
}

function intensityInfo() {
  return intensityConfig[selectedIntensity];
}

function randomTarget() {
  return {
    color: colors[Math.floor(Math.random() * colors.length)],
    shape: shapes[Math.floor(Math.random() * shapes.length)],
  };
}

function setupSequence() {
  sequence = [];
  for (let i = 0; i < 3; i += 1) sequence.push(randomTarget());
  sequenceIndex = 0;
  target = sequence[sequenceIndex];
}

function refreshModeUi() {
  modeButtons.forEach((button) => {
    const active = button.dataset.mode === selectedMode;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  modeDescriptionEl.textContent = modeInfo().description;
  bestScore = readBestScore();
  bestEl.textContent = bestScore;
}

function refreshSettingsUi() {
  durationButtons.forEach((button) => {
    const active = Number(button.dataset.duration) === sessionDuration;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  intensityButtons.forEach((button) => {
    const active = button.dataset.intensity === selectedIntensity;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  goalButtons.forEach((button) => {
    const active = Number(button.dataset.goal) === dailyGoal;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  prepToggle.checked = prepEnabled;
  calmToggle.checked = calmEffects;
  hapticToggle.checked = hapticEnabled;
  document.body.classList.toggle("calm-effects", calmEffects);
  bestScore = readBestScore();
  bestEl.textContent = bestScore;
  timeEl.textContent = sessionDuration;
  todaySessions = readTodaySessions();
  todayEl.textContent = todaySessions;
  goalEl.textContent = `${Math.min(100, Math.round((todaySessions / dailyGoal) * 100))}%`;
}

function chooseTarget(forceDifferent = false) {
  if (selectedMode === "sequence") {
    target = sequence[sequenceIndex] || target;
    updateTargetDisplay();
    return;
  }

  let next = target;
  let guard = 0;
  while (!next || !forceDifferent || (next.color.name === target.color.name && next.shape.name === target.shape.name)) {
    next = randomTarget();
    if (!forceDifferent || ++guard > 40) break;
  }

  target = next;
  updateTargetDisplay();
}

function updateTargetDisplay() {
  const prefix = selectedMode === "sequence" ? `${sequenceIndex + 1}/3 ` : selectedMode === "pulse" ? "Pulso: " : "";
  targetTextEl.textContent = `${prefix}${target.color.label} ${target.shape.label}`;
  targetSymbolEl.style.background = target.color.value;
  targetSymbolEl.style.borderRadius = target.shape.name === "circular" ? "50%" : target.shape.name === "quadrado" ? "9px" : "5px";
  targetSymbolEl.style.clipPath = clipFor(target.shape.name);
  targetSymbolEl.classList.remove("pulse");
  void targetSymbolEl.offsetWidth;
  targetSymbolEl.classList.add("pulse");
}

function clipFor(shape) {
  if (shape === "triangular") return "polygon(50% 4%, 96% 92%, 4% 92%)";
  if (shape === "diamante") return "polygon(50% 2%, 98% 50%, 50% 98%, 2% 50%)";
  return "none";
}

function startGame() {
  ensureAudio();
  state = freshState();
  state.running = true;
  spawnClock = 0;
  overlay.classList.remove("show");
  pauseBtn.textContent = "Pausar";
  pauseBtn.setAttribute("aria-pressed", "false");
  if (selectedMode === "sequence") setupSequence();
  chooseTarget(true);
  setFeedback(prepEnabled ? "Prepare a atenção. Começa em 3..." : modeInfo().ready);
  playTone("shift");
  updateHud();
}

function pauseGame() {
  if (!state.running || state.over) return;
  state.paused = !state.paused;
  pauseBtn.textContent = state.paused ? "Continuar" : "Pausar";
  pauseBtn.setAttribute("aria-pressed", String(state.paused));
  stateEl.textContent = state.paused ? "Pausado" : "Em jogo";
  setFeedback(state.paused ? "Pausa feita. Volte com calma." : "Voltou. Olhos no alvo.");
}

function finishGame() {
  state.running = false;
  state.over = true;
  state.time = 0;
  todaySessions += 1;
  saveTodaySessions(todaySessions);
  if (state.score > bestScore) {
    bestScore = state.score;
    saveBestScore(bestScore);
  }

  overlay.classList.add("show");
  overlay.querySelector("h2").textContent = finalTitle();
  overlay.querySelector("p").textContent = `${modeInfo().name} - ${sessionDuration}s - ${intensityInfo().name}. Foco: ${state.score}. Qualidade: ${focusQuality()}/100. Precisão: ${accuracy()}%. Melhor combo: ${state.bestStreak}. Treinos hoje: ${todaySessions}.`;
  overlayStart.textContent = "Jogar de novo";
  stateEl.textContent = "Finalizado";
  setFeedback("Sessão concluída. Tente melhorar a precisão antes da velocidade.");
  playTone("combo");
  haptic([45, 40, 45]);
  updateHud();
}

function finalTitle() {
  if (focusQuality() >= 88) return "Foco profissional";
  if (focusQuality() >= 72) return "Ótimo treino";
  if (accuracy() >= 75) return "Boa precisão";
  return "Continue treinando";
}

function spawnPiece(width, height) {
  const config = intensityInfo();
  const isTargetSeed = Math.random() < Math.min(0.48, 0.3 + state.level * 0.025 + config.target);
  let color = isTargetSeed ? target.color : colors[Math.floor(Math.random() * colors.length)];
  let shape = isTargetSeed ? target.shape : shapes[Math.floor(Math.random() * shapes.length)];

  if (!isTargetSeed && Math.random() < 0.48) {
    if (Math.random() < 0.5) color = target.color;
    else shape = target.shape;
  }

  const size = 28 + Math.random() * Math.max(10, 19 - state.level);
  const piece = {
    x: size + Math.random() * Math.max(1, width - size * 2),
    y: -size,
    size,
    color,
    shape,
    speed: (78 + state.level * 22 + Math.random() * 54) * config.speed,
    wobble: Math.random() * Math.PI * 2,
    rotation: Math.random() * Math.PI,
    spin: (Math.random() > 0.5 ? 1 : -1) * (0.55 + Math.random() * 0.8),
    glow: 0,
    isTarget: color.name === target.color.name && shape.name === target.shape.name,
  };
  state.pieces.push(piece);
}

function loop(now) {
  const dt = Math.min(0.04, (now - lastFrame) / 1000 || 0);
  lastFrame = now;
  updateBreath(dt);
  if (state.running && !state.paused) update(dt);
  draw();
  requestAnimationFrame(loop);
}

function updateBreath(dt) {
  if (state.breath <= 0) return;
  state.breath = Math.max(0, state.breath - dt);
  stateEl.textContent = "Respirar";
  const phase = breathPhase();
  setFeedback(phase);
  if (state.breath === 0) {
    state.paused = state.wasPausedBeforeBreath;
    pauseBtn.textContent = state.paused ? "Continuar" : "Pausar";
    pauseBtn.setAttribute("aria-pressed", String(state.paused));
    setFeedback(state.paused ? "Respiração feita. Continue quando quiser." : "Respiração feita. Volte ao alvo com calma.");
    haptic(35);
  }
}

function breathPhase() {
  const step = Math.ceil(state.breath);
  if (state.breath > 8) return `Inspire pelo nariz... ${step}`;
  if (state.breath > 4) return `Segure suave... ${step}`;
  return `Solte devagar... ${step}`;
}

function update(dt) {
  const box = canvasBox;
  if (state.prep > 0) {
    state.prep = Math.max(0, state.prep - dt);
    if (state.prep > 0) {
      stateEl.textContent = "Preparar";
      setFeedback(`Respire. Começa em ${Math.ceil(state.prep)}...`);
      updateHud();
      return;
    }
    state.started = true;
    setFeedback(modeInfo().ready);
    playTone("shift");
  }

  state.time -= dt;
  state.level = Math.min(9, 1 + Math.floor((sessionDuration - state.time) / Math.max(5, sessionDuration / 7)));
  state.targetShift += dt;
  state.messageClock -= dt;
  state.pulse = (state.pulse + dt) % Math.max(1.05, 1.65 - state.level * 0.05);

  spawnClock -= dt;
  if (spawnClock <= 0) {
    spawnPiece(box.width, box.height);
    spawnClock = Math.max(0.16, 0.74 - state.level * 0.055 + intensityInfo().spawn);
  }

  for (const piece of state.pieces) {
    piece.y += piece.speed * dt;
    piece.x += Math.sin(performance.now() / 430 + piece.wobble) * (0.2 + state.level * 0.035);
    piece.rotation += dt * piece.spin;
    piece.glow = Math.max(0, piece.glow - dt * 2.6);
  }

  let escapedTargets = 0;
  state.pieces = state.pieces.filter((piece) => {
    const visible = piece.y < box.height + piece.size;
    if (!visible && matchesTarget(piece)) escapedTargets += 1;
    return visible;
  });
  if (escapedTargets > 0) {
    state.misses += escapedTargets;
    state.streak = 0;
    state.score = Math.max(0, state.score - Math.round(escapedTargets * 9 * intensityInfo().penalty));
    setFeedback("Um alvo passou. Respira e volta ao ritmo.");
    playTone("miss");
    haptic([20, 20, 20]);
  }

  state.ripples = state.ripples.filter((ripple) => {
    ripple.life -= dt;
    ripple.radius += 240 * dt;
    return ripple.life > 0;
  });

  state.particles = state.particles.filter((particle) => {
    particle.life -= dt;
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.vy += 90 * dt;
    return particle.life > 0;
  });

  if (selectedMode !== "sequence" && state.targetShift >= Math.max(8, 15 - state.level)) {
    state.targetShift = 0;
    chooseTarget(true);
    setFeedback("Novo alvo. Atualize a mente antes de tocar.");
    playTone("shift");
  }

  if (state.time <= 0) finishGame();
  updateHud();
}

function draw() {
  const box = canvasBox;
  ctx.clearRect(0, 0, box.width, box.height);
  drawBackground(box.width, box.height);
  for (const piece of state.pieces) drawPiece(piece);
  for (const particle of state.particles) drawParticle(particle);
  for (const ripple of state.ripples) drawRipple(ripple);
  if (state.running && state.prep > 0) drawPrep(box.width, box.height);
  if (state.breath > 0) drawBreath(box.width, box.height);
}

function drawPrep(width, height) {
  ctx.save();
  ctx.fillStyle = "rgba(23, 33, 37, 0.48)";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#fffaf0";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "800 82px system-ui, sans-serif";
  ctx.fillText(String(Math.ceil(state.prep)), width / 2, height / 2);
  ctx.font = "800 18px system-ui, sans-serif";
  ctx.fillText("respire e prepare o foco", width / 2, height / 2 + 70);
  ctx.restore();
}

function drawBreath(width, height) {
  const phase = breathPhase();
  const cycle = (12 - state.breath) / 12;
  const wave = 0.5 + Math.sin(cycle * Math.PI * 2) * 0.5;
  const radius = 58 + wave * 72;
  ctx.save();
  ctx.fillStyle = "rgba(23, 33, 37, 0.68)";
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = "#7ee6c8";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(width / 2, height / 2 - 20, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "#fffaf0";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "800 24px system-ui, sans-serif";
  ctx.fillText(phase, width / 2, height / 2 + 88);
  ctx.restore();
}

function drawBackground(width, height) {
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(width, height) * 0.31;
  ctx.save();
  const open = pulseOpen();
  ctx.globalAlpha = selectedMode === "pulse" ? (open ? 0.8 : 0.24) : 0.38;
  ctx.strokeStyle = selectedMode === "pulse" && open ? "#7ee6c8" : "#fff4d6";
  ctx.lineWidth = selectedMode === "pulse" && open ? 5 : 2;
  ctx.setLineDash([8, 18]);
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.stroke();

  ctx.globalAlpha = 0.1;
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(centerX, 0);
  ctx.lineTo(centerX, height);
  ctx.moveTo(0, centerY);
  ctx.lineTo(width, centerY);
  ctx.stroke();
  ctx.restore();
}

function drawPiece(piece) {
  const validNow = matchesTarget(piece);
  ctx.save();
  ctx.translate(piece.x, piece.y);
  ctx.rotate(piece.rotation);
  ctx.fillStyle = piece.color.value;
  ctx.shadowColor = validNow ? "rgba(126, 230, 200, 0.55)" : "rgba(0, 0, 0, 0.28)";
  ctx.shadowBlur = validNow ? 18 : 12;
  ctx.shadowOffsetY = 5;
  ctx.beginPath();
  pathShape(piece.shape.name, piece.size);
  ctx.fill();
  ctx.lineWidth = validNow ? 4 : 3;
  ctx.strokeStyle = validNow ? "rgba(255, 255, 255, 0.86)" : "rgba(255, 255, 255, 0.62)";
  ctx.stroke();
  ctx.restore();
}

function matchesTarget(piece) {
  return piece.color.name === target.color.name && piece.shape.name === target.shape.name;
}

function pulseOpen() {
  if (selectedMode !== "pulse") return true;
  const period = Math.max(1.05, 1.65 - state.level * 0.05);
  return state.pulse < period * 0.45;
}

function pathShape(shape, size) {
  if (shape === "circular") {
    ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
  } else if (shape === "quadrado") {
    roundedRect(-size / 2, -size / 2, size, size, 7);
  } else if (shape === "triangular") {
    ctx.moveTo(0, -size / 2);
    ctx.lineTo(size / 2, size / 2);
    ctx.lineTo(-size / 2, size / 2);
    ctx.closePath();
  } else {
    ctx.moveTo(0, -size / 2);
    ctx.lineTo(size / 2, 0);
    ctx.lineTo(0, size / 2);
    ctx.lineTo(-size / 2, 0);
    ctx.closePath();
  }
}

function roundedRect(x, y, width, height, radius) {
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

function drawRipple(ripple) {
  ctx.save();
  ctx.globalAlpha = Math.max(0, ripple.life / 0.45);
  ctx.strokeStyle = ripple.good ? "#9df1c8" : "#ffb1a8";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(ripple.x, ripple.y, ripple.radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawParticle(particle) {
  ctx.save();
  ctx.globalAlpha = Math.max(0, particle.life / particle.maxLife);
  ctx.fillStyle = particle.color;
  ctx.beginPath();
  ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function burst(x, y, color, good) {
  if (calmEffects) return;
  if (state.particles.length > 180) return;
  const count = good ? 14 : 8;
  for (let i = 0; i < count; i += 1) {
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.35;
    const speed = (good ? 110 : 70) + Math.random() * 90;
    const life = 0.34 + Math.random() * 0.28;
    state.particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: good ? 3 + Math.random() * 3 : 2 + Math.random() * 2,
      color,
      life,
      maxLife: life,
    });
  }
}

function hitTest(x, y) {
  for (let i = state.pieces.length - 1; i >= 0; i -= 1) {
    const piece = state.pieces[i];
    const distance = Math.hypot(piece.x - x, piece.y - y);
    if (distance <= piece.size * 0.78) return { piece, index: i };
  }
  return null;
}

function handlePointer(event) {
  if (!state.running || state.paused || state.prep > 0) return;
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  const hit = hitTest(x, y);
  if (!hit) return;

  state.clicks += 1;
  state.pieces.splice(hit.index, 1);
  const validTarget = matchesTarget(hit.piece);
  const validPulse = pulseOpen();
  if (validTarget && validPulse) {
    state.hits += 1;
    state.streak += 1;
    state.bestStreak = Math.max(state.bestStreak, state.streak);
    state.score += scoreForHit();
    state.ripples.push({ x, y, radius: 5, life: 0.45, good: true });
    burst(x, y, hit.piece.color.value, true);
    afterGoodHit();
    playTone(state.streak > 0 && state.streak % 6 === 0 ? "combo" : "hit");
    haptic(18);
    pulse(streakEl);
  } else {
    state.misses += 1;
    state.streak = 0;
    state.score = Math.max(0, state.score - Math.round(20 * intensityInfo().penalty));
    state.ripples.push({ x, y, radius: 5, life: 0.45, good: false });
    burst(x, y, "#ffb1a8", false);
    setFeedback(validTarget && !validPulse ? "Boa mira, mas tocou antes do pulso. Espere o anel acender." : "Distração tocada. Repare no alvo e tente de novo.");
    playTone("miss");
    haptic([25, 25, 25]);
  }
  updateHud();
}

function scoreForHit() {
  const modeBonus = selectedMode === "sequence" ? 8 : selectedMode === "pulse" ? 10 : 0;
  return 14 + state.streak * 3 + state.level + modeBonus + intensityInfo().bonus;
}

function afterGoodHit() {
  if (selectedMode === "sequence") {
    sequenceIndex += 1;
    if (sequenceIndex >= sequence.length) {
      state.score += 35;
      setupSequence();
      setFeedback("Sequência completa. Nova ordem criada.");
      playTone("combo");
    } else {
      target = sequence[sequenceIndex];
      setFeedback(`Certo. Agora alvo ${sequenceIndex + 1} de 3.`);
    }
    updateTargetDisplay();
    return;
  }

  if (selectedMode === "pulse") {
    setFeedback(state.streak >= 6 ? "Excelente controlo. Continue no pulso." : "Certo no tempo. Espere o próximo pulso.");
    return;
  }

  setFeedback(state.streak >= 8 ? "Combo forte. Mantenha a calma." : "Certo. Continua atento.");
}

function pulse(element) {
  element.classList.remove("pulse");
  void element.offsetWidth;
  element.classList.add("pulse");
}

function setFeedback(message) {
  feedbackEl.textContent = message;
  state.messageClock = 1.8;
}

function accuracy() {
  if (state.clicks === 0) return 100;
  return Math.round((state.hits / state.clicks) * 100);
}

function focusQuality() {
  const precision = accuracy();
  const calm = Math.max(0, 100 - state.misses * 7);
  const combo = Math.min(100, state.bestStreak * 9);
  return Math.round(precision * 0.55 + calm * 0.25 + combo * 0.2);
}

function tempoLabel() {
  if (!state.running && !state.over) return "Calmo";
  if (selectedIntensity === "pro" || state.level >= 7) return "Intenso";
  if (selectedIntensity === "gentle") return "Leve";
  if (state.level >= 4) return "Médio";
  return "Calmo";
}

function updateHud() {
  scoreEl.textContent = state.score;
  streakEl.textContent = state.streak;
  timeEl.textContent = Math.max(0, Math.ceil(state.time));
  bestEl.textContent = bestScore;
  accuracyEl.textContent = `${accuracy()}%`;
  qualityEl.textContent = focusQuality();
  levelEl.textContent = state.level;
  tempoEl.textContent = tempoLabel();
  todayEl.textContent = todaySessions;
  timebarFill.style.transform = `scaleX(${Math.max(0, state.time / sessionDuration)})`;
  if (state.running && !state.paused) stateEl.textContent = "Em jogo";
}

function resetGame() {
  state = freshState();
  if (selectedMode === "sequence") setupSequence();
  chooseTarget();
  overlay.classList.add("show");
  overlay.querySelector("h2").textContent = "Entre no modo foco";
  overlay.querySelector("p").textContent = modeInfo().description;
  overlayStart.textContent = "Jogar agora";
  pauseBtn.textContent = "Pausar";
  pauseBtn.setAttribute("aria-pressed", "false");
  setFeedback(modeInfo().ready);
  refreshSettingsUi();
  updateHud();
  draw();
}

function changeMode(mode) {
  if (!modes[mode]) return;
  selectedMode = mode;
  refreshModeUi();
  resetGame();
}

function changeDuration(duration) {
  sessionDuration = duration;
  resetGame();
}

function changeIntensity(intensity) {
  if (!intensityConfig[intensity]) return;
  selectedIntensity = intensity;
  resetGame();
}

function changeDailyGoal(goal) {
  dailyGoal = goal;
  saveSetting("dailyGoal", dailyGoal);
  refreshSettingsUi();
  updateHud();
}

function startBreathingPause() {
  if (!state.running || state.over) {
    setFeedback("Respire fundo antes de começar. Clique em Começar quando estiver pronto.");
    return;
  }
  state.wasPausedBeforeBreath = state.paused;
  state.paused = true;
  state.breath = 12;
  pauseBtn.textContent = "Continuar";
  pauseBtn.setAttribute("aria-pressed", "true");
  overlay.classList.remove("show");
  haptic(30);
}

window.addEventListener("resize", () => { resizeCanvas(); canvasBox = canvas.getBoundingClientRect(); });
canvas.addEventListener("pointerdown", handlePointer);
startBtn.addEventListener("click", startGame);
overlayStart.addEventListener("click", startGame);
pauseBtn.addEventListener("click", pauseGame);
breathBtn.addEventListener("click", startBreathingPause);
resetBtn.addEventListener("click", resetGame);
modeButtons.forEach((button) => {
  button.addEventListener("click", () => changeMode(button.dataset.mode));
});
durationButtons.forEach((button) => {
  button.addEventListener("click", () => changeDuration(Number(button.dataset.duration)));
});
intensityButtons.forEach((button) => {
  button.addEventListener("click", () => changeIntensity(button.dataset.intensity));
});
prepToggle.addEventListener("change", () => {
  prepEnabled = prepToggle.checked;
  saveSetting("prepEnabled", prepEnabled);
  resetGame();
});
calmToggle.addEventListener("change", () => {
  calmEffects = calmToggle.checked;
  saveSetting("calmEffects", calmEffects);
  refreshSettingsUi();
});
hapticToggle.addEventListener("change", () => {
  hapticEnabled = hapticToggle.checked;
  saveSetting("hapticEnabled", hapticEnabled);
  refreshSettingsUi();
  if (hapticEnabled) haptic(25);
});
goalButtons.forEach((button) => {
  button.addEventListener("click", () => changeDailyGoal(Number(button.dataset.goal)));
});
soundBtn.addEventListener("click", () => {
  soundEnabled = !soundEnabled;
  soundBtn.textContent = soundEnabled ? "Som ligado" : "Som desligado";
  soundBtn.setAttribute("aria-pressed", String(soundEnabled));
  if (soundEnabled) {
    ensureAudio();
    playTone("hit");
  }
});

resizeCanvas();
let canvasBox = canvas.getBoundingClientRect();
refreshModeUi();
refreshSettingsUi();
chooseTarget();
updateHud();
requestAnimationFrame(loop);
