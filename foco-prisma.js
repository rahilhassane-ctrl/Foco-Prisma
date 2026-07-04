const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");

const scoreEl = document.querySelector("#score");
const streakEl = document.querySelector("#streak");
const timeEl = document.querySelector("#time");
const accuracyEl = document.querySelector("#accuracy");
const levelEl = document.querySelector("#level");
const stateEl = document.querySelector("#state");
const targetTextEl = document.querySelector("#targetText");
const targetSymbolEl = document.querySelector("#targetSymbol");
const overlay = document.querySelector("#overlay");
const startBtn = document.querySelector("#startBtn");
const pauseBtn = document.querySelector("#pauseBtn");
const resetBtn = document.querySelector("#resetBtn");
const overlayStart = document.querySelector("#overlayStart");

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

let state = freshState();
let lastFrame = 0;
let spawnClock = 0;
let target = { color: colors[0], shape: shapes[0] };

function freshState() {
  return {
    running: false,
    paused: false,
    over: false,
    score: 0,
    streak: 0,
    hits: 0,
    misses: 0,
    clicks: 0,
    time: 60,
    level: 1,
    pieces: [],
    ripples: [],
  };
}

function resizeCanvas() {
  const box = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.max(320, Math.floor(box.width * ratio));
  canvas.height = Math.max(320, Math.floor(box.height * ratio));
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
}

function chooseTarget() {
  target = {
    color: colors[Math.floor(Math.random() * colors.length)],
    shape: shapes[Math.floor(Math.random() * shapes.length)],
  };
  targetTextEl.textContent = `${target.color.label} ${target.shape.label}`;
  targetSymbolEl.style.background = target.color.value;
  targetSymbolEl.style.borderRadius = target.shape.name === "circular" ? "50%" : target.shape.name === "quadrado" ? "9px" : "5px";
  targetSymbolEl.style.clipPath = clipFor(target.shape.name);
}

function clipFor(shape) {
  if (shape === "triangular") return "polygon(50% 4%, 96% 92%, 4% 92%)";
  if (shape === "diamante") return "polygon(50% 2%, 98% 50%, 50% 98%, 2% 50%)";
  return "none";
}

function startGame() {
  state = freshState();
  state.running = true;
  overlay.classList.remove("show");
  chooseTarget();
  updateHud();
}

function pauseGame() {
  if (!state.running || state.over) return;
  state.paused = !state.paused;
  pauseBtn.textContent = state.paused ? "Continuar" : "Pausar";
  pauseBtn.setAttribute("aria-pressed", String(state.paused));
  stateEl.textContent = state.paused ? "Pausado" : "Em jogo";
}

function finishGame() {
  state.running = false;
  state.over = true;
  state.time = 0;
  overlay.classList.add("show");
  overlay.querySelector("h2").textContent = state.score >= 450 ? "Excelente foco" : state.score >= 250 ? "Bom treino" : "Continue treinando";
  overlay.querySelector("p").textContent = `Pontuação: ${state.score}. Precisão: ${accuracy()}%. Sequência máxima aproximada: ${state.streak}.`;
  overlayStart.textContent = "Jogar de novo";
  stateEl.textContent = "Finalizado";
  updateHud();
}

function spawnPiece(width, height) {
  const isTarget = Math.random() < 0.38;
  const color = isTarget ? target.color : colors[Math.floor(Math.random() * colors.length)];
  const shape = isTarget ? target.shape : shapes[Math.floor(Math.random() * shapes.length)];
  const size = 30 + Math.random() * Math.max(10, 18 - state.level);
  const piece = {
    x: size + Math.random() * (width - size * 2),
    y: -size,
    size,
    color,
    shape,
    speed: 72 + state.level * 20 + Math.random() * 45,
    wobble: Math.random() * Math.PI * 2,
    rotation: Math.random() * Math.PI,
    isTarget: color.name === target.color.name && shape.name === target.shape.name,
  };
  state.pieces.push(piece);
}

function loop(now) {
  const dt = Math.min(0.04, (now - lastFrame) / 1000 || 0);
  lastFrame = now;
  if (state.running && !state.paused) update(dt);
  draw();
  requestAnimationFrame(loop);
}

function update(dt) {
  const box = canvas.getBoundingClientRect();
  state.time -= dt;
  state.level = Math.min(7, 1 + Math.floor((60 - state.time) / 10));
  spawnClock -= dt;
  if (spawnClock <= 0) {
    spawnPiece(box.width, box.height);
    spawnClock = Math.max(0.28, 0.84 - state.level * 0.07);
  }

  for (const piece of state.pieces) {
    piece.y += piece.speed * dt;
    piece.x += Math.sin(performance.now() / 460 + piece.wobble) * (0.18 + state.level * 0.03);
    piece.rotation += dt * 0.8;
  }

  let escapedTargets = 0;
  state.pieces = state.pieces.filter((piece) => {
    const visible = piece.y < box.height + piece.size;
    if (!visible && piece.isTarget) escapedTargets += 1;
    return visible;
  });
  if (escapedTargets > 0) {
    state.misses += escapedTargets;
    state.streak = 0;
    state.score = Math.max(0, state.score - escapedTargets * 8);
  }

  state.ripples = state.ripples.filter((ripple) => {
    ripple.life -= dt;
    ripple.radius += 220 * dt;
    return ripple.life > 0;
  });

  if (Math.floor(state.time) === 40 || Math.floor(state.time) === 20) {
    if (!state.changedAt || Math.abs(state.changedAt - Math.floor(state.time)) > 1) {
      state.changedAt = Math.floor(state.time);
      chooseTarget();
    }
  }

  if (state.time <= 0) finishGame();
  updateHud();
}

function draw() {
  const box = canvas.getBoundingClientRect();
  ctx.clearRect(0, 0, box.width, box.height);
  drawFocusLane(box.width, box.height);
  for (const piece of state.pieces) drawPiece(piece);
  for (const ripple of state.ripples) drawRipple(ripple);
}

function drawFocusLane(width, height) {
  ctx.save();
  ctx.globalAlpha = 0.38;
  ctx.strokeStyle = "#fff4d6";
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 18]);
  ctx.beginPath();
  ctx.arc(width / 2, height / 2, Math.min(width, height) * 0.31, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawPiece(piece) {
  ctx.save();
  ctx.translate(piece.x, piece.y);
  ctx.rotate(piece.rotation);
  ctx.fillStyle = piece.color.value;
  ctx.shadowColor = "rgba(0, 0, 0, 0.28)";
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 5;
  ctx.beginPath();
  if (piece.shape.name === "circular") {
    ctx.arc(0, 0, piece.size / 2, 0, Math.PI * 2);
  } else if (piece.shape.name === "quadrado") {
    roundedRect(-piece.size / 2, -piece.size / 2, piece.size, piece.size, 7);
  } else if (piece.shape.name === "triangular") {
    ctx.moveTo(0, -piece.size / 2);
    ctx.lineTo(piece.size / 2, piece.size / 2);
    ctx.lineTo(-piece.size / 2, piece.size / 2);
    ctx.closePath();
  } else {
    ctx.moveTo(0, -piece.size / 2);
    ctx.lineTo(piece.size / 2, 0);
    ctx.lineTo(0, piece.size / 2);
    ctx.lineTo(-piece.size / 2, 0);
    ctx.closePath();
  }
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.68)";
  ctx.stroke();
  ctx.restore();
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

function hitTest(x, y) {
  for (let i = state.pieces.length - 1; i >= 0; i -= 1) {
    const piece = state.pieces[i];
    const distance = Math.hypot(piece.x - x, piece.y - y);
    if (distance <= piece.size * 0.72) return { piece, index: i };
  }
  return null;
}

function handlePointer(event) {
  if (!state.running || state.paused) return;
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  const hit = hitTest(x, y);
  if (!hit) return;
  state.clicks += 1;
  state.pieces.splice(hit.index, 1);
  if (hit.piece.isTarget) {
    state.hits += 1;
    state.streak += 1;
    state.score += 12 + state.streak * 2 + state.level;
    state.ripples.push({ x, y, radius: 4, life: 0.45, good: true });
  } else {
    state.misses += 1;
    state.streak = 0;
    state.score = Math.max(0, state.score - 18);
    state.ripples.push({ x, y, radius: 4, life: 0.45, good: false });
  }
  updateHud();
}

function accuracy() {
  if (state.clicks === 0) return 100;
  return Math.round((state.hits / state.clicks) * 100);
}

function updateHud() {
  scoreEl.textContent = state.score;
  streakEl.textContent = state.streak;
  timeEl.textContent = Math.max(0, Math.ceil(state.time));
  accuracyEl.textContent = `${accuracy()}%`;
  levelEl.textContent = state.level;
  if (state.running && !state.paused) stateEl.textContent = "Em jogo";
}

window.addEventListener("resize", resizeCanvas);
canvas.addEventListener("pointerdown", handlePointer);
startBtn.addEventListener("click", startGame);
overlayStart.addEventListener("click", startGame);
pauseBtn.addEventListener("click", pauseGame);
resetBtn.addEventListener("click", () => {
  state = freshState();
  chooseTarget();
  overlay.classList.add("show");
  overlay.querySelector("h2").textContent = "Treine atenção em 60 segundos";
  overlay.querySelector("p").textContent = "O jogo mostra um alvo. Clique nas peças iguais e deixe as parecidas passarem. Quanto mais calma e precisão, maior o foco.";
  overlayStart.textContent = "Jogar agora";
  pauseBtn.textContent = "Pausar";
  pauseBtn.setAttribute("aria-pressed", "false");
  updateHud();
  draw();
});

resizeCanvas();
chooseTarget();
updateHud();
requestAnimationFrame(loop);
