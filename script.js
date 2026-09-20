/* ═══════════════════════════════════════════
   Factorino Birthday — script.js
   No external dependencies.
═══════════════════════════════════════════ */

'use strict';

// ── DOM refs ──────────────────────────────
const audio       = document.getElementById('bg-music');
const musicCtrl   = document.getElementById('music-ctrl');
const iconPlay    = document.getElementById('icon-play');
const iconPause   = document.getElementById('icon-pause');
const bgCanvas    = document.getElementById('bg-canvas');
const vizCanvas   = document.getElementById('visualizer-canvas');
const confCanvas  = document.getElementById('confetti-canvas');

// ── State ─────────────────────────────────
let currentStage  = 1;
let audioCtx      = null;
let analyser      = null;
let audioSource   = null;
let vizRAF        = null;
let bgRAF         = null;
let confRAF       = null;
let isPlaying     = false;
let audioReady    = false;
let particles     = [];
let confettiParts = [];

// ══════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════

function $(id) { return document.getElementById(id); }

function goTo(id) {
  const current = $(`stage-${currentStage}`) || $(`stage-${currentStage === 8 ? 'final' : currentStage}`);
  const isCurrentFinal = currentStage === 8;
  const leaving = isCurrentFinal ? $('stage-final') : $(`stage-${currentStage}`);
  const arriving = id === 'final' ? $('stage-final') : $(`stage-${id}`);

  if (leaving) {
    leaving.classList.remove('active');
    leaving.classList.add('exiting');
    setTimeout(() => leaving.classList.remove('exiting'), 1600);
  }

  setTimeout(() => {
    if (arriving) {
      arriving.classList.add('active');
    }
  }, 500);

  if (typeof id === 'number') currentStage = id;
  else currentStage = 8;
}

// ══════════════════════════════════════════
// BACKGROUND PARTICLES
// ══════════════════════════════════════════

function initBgParticles() {
  const ctx = bgCanvas.getContext('2d');
  const DPR = Math.min(window.devicePixelRatio || 1, 2);

  function resize() {
    bgCanvas.width  = window.innerWidth  * DPR;
    bgCanvas.height = window.innerHeight * DPR;
    bgCanvas.style.width  = window.innerWidth  + 'px';
    bgCanvas.style.height = window.innerHeight + 'px';
    ctx.scale(DPR, DPR);
  }
  resize();

  const COUNT = Math.min(38, Math.floor(window.innerWidth * window.innerHeight / 22000));
  particles = [];

  for (let i = 0; i < COUNT; i++) {
    particles.push({
      x:   Math.random() * window.innerWidth,
      y:   Math.random() * window.innerHeight,
      r:   Math.random() * 1.2 + 0.3,
      vx:  (Math.random() - 0.5) * 0.12,
      vy:  (Math.random() - 0.5) * 0.1,
      a:   Math.random() * 0.18 + 0.04,
      da:  (Math.random() - 0.5) * 0.001,
    });
  }

  function draw() {
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    for (const p of particles) {
      p.x  += p.vx;
      p.y  += p.vy;
      p.a  += p.da;
      if (p.a < 0.03) p.da = Math.abs(p.da);
      if (p.a > 0.22)  p.da = -Math.abs(p.da);
      if (p.x < -4) p.x = window.innerWidth  + 4;
      if (p.x > window.innerWidth  + 4) p.x = -4;
      if (p.y < -4) p.y = window.innerHeight + 4;
      if (p.y > window.innerHeight + 4) p.y = -4;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(201,169,110,${p.a})`;
      ctx.fill();
    }
    bgRAF = requestAnimationFrame(draw);
  }
  draw();

  window.addEventListener('resize', () => {
    resize();
    particles.forEach(p => {
      if (p.x > window.innerWidth)  p.x = Math.random() * window.innerWidth;
      if (p.y > window.innerHeight) p.y = Math.random() * window.innerHeight;
    });
  });
}

// ══════════════════════════════════════════
// AUDIO + VISUALIZER
// ══════════════════════════════════════════

function setupAudio() {
  if (audioReady) return;
  audioReady = true;

  try {
    audioCtx  = new (window.AudioContext || window.webkitAudioContext)();
    analyser  = audioCtx.createAnalyser();
    analyser.fftSize = 64;
    analyser.smoothingTimeConstant = 0.82;

    audioSource = audioCtx.createMediaElementSource(audio);
    audioSource.connect(analyser);
    analyser.connect(audioCtx.destination);
  } catch (e) {
    analyser = null;
  }

  playAudio();
  initVisualizer();
}

function playAudio() {
  if (!audio.src || audio.error) return;
  const p = audio.play();
  if (p && p.catch) {
    p.catch(() => {});
  }
  isPlaying = true;
  iconPlay.style.display  = 'none';
  iconPause.style.display = 'block';
  musicCtrl.classList.add('visible');
}

function toggleAudio() {
  if (!audioReady) { setupAudio(); return; }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  if (audio.paused) {
    audio.play().catch(() => {});
    isPlaying = true;
    iconPlay.style.display  = 'none';
    iconPause.style.display = 'block';
  } else {
    audio.pause();
    isPlaying = false;
    iconPlay.style.display  = 'block';
    iconPause.style.display = 'none';
  }
}

musicCtrl.addEventListener('click', toggleAudio);

// Visualizer
function initVisualizer() {
  const ctx = vizCanvas.getContext('2d');
  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  const W   = 300;
  const H   = 40;

  vizCanvas.width  = W * DPR;
  vizCanvas.height = H * DPR;
  vizCanvas.style.width  = W + 'px';
  vizCanvas.style.height = H + 'px';
  ctx.scale(DPR, DPR);

  const BARS   = 24;
  const GAP    = 2;
  const barW   = (W - GAP * (BARS - 1)) / BARS;
  let idlePhs  = 0;
  const dataArr = analyser ? new Uint8Array(analyser.frequencyBinCount) : null;

  vizCanvas.classList.add('visible');

  function draw() {
    ctx.clearRect(0, 0, W, H);
    let values = [];

    if (analyser && dataArr && isPlaying) {
      analyser.getByteFrequencyData(dataArr);
      const step = Math.floor(dataArr.length / BARS);
      for (let i = 0; i < BARS; i++) {
        let sum = 0;
        for (let j = 0; j < step; j++) sum += dataArr[i * step + j];
        values.push(sum / step / 255);
      }
    } else {
      // idle gentle wave
      idlePhs += 0.025;
      for (let i = 0; i < BARS; i++) {
        const wave = Math.sin(idlePhs + i * 0.45) * 0.5 + 0.5;
        values.push(wave * 0.12 + 0.03);
      }
    }

    for (let i = 0; i < BARS; i++) {
      const bh  = Math.max(2, values[i] * H * 0.9);
      const x   = i * (barW + GAP);
      const y   = (H - bh) / 2;
      const alpha = 0.35 + values[i] * 0.55;
      ctx.fillStyle = `rgba(201,169,110,${alpha})`;
      ctx.beginPath();
      ctx.roundRect(x, y, barW, bh, barW / 2);
      ctx.fill();
    }
    vizRAF = requestAnimationFrame(draw);
  }
  draw();
}

// ══════════════════════════════════════════
// STAGE 1 — entrance
// ══════════════════════════════════════════

function initStage1() {
  const els = document.querySelectorAll('#stage-1 .fade-in-delayed');
  els.forEach(el => {
    const delay = parseInt(el.dataset.delay || '0', 10);
    setTimeout(() => el.classList.add('revealed'), delay);
  });
}

$('btn-1').addEventListener('click', () => goTo(2));

// ══════════════════════════════════════════
// STAGE 2
// ══════════════════════════════════════════

$('btn-2').addEventListener('click', () => goTo(3));

// ══════════════════════════════════════════
// STAGE 3 — music starts here
// ══════════════════════════════════════════

$('btn-3').addEventListener('click', () => {
  setupAudio();
  goTo(4);
});

// ══════════════════════════════════════════
// STAGE 4
// ══════════════════════════════════════════

$('btn-4').addEventListener('click', () => {
  goTo(5);
  setTimeout(initStage5, 600);
});

// ══════════════════════════════════════════
// STAGE 5 — reveal
// ══════════════════════════════════════════

function initStage5() {
  const glow  = $('stage-5').querySelector('.glow-center');
  const title = $('title-reveal');
  const sub   = $('stage-5').querySelector('.reveal-sub');
  const btn   = $('btn-5');

  setTimeout(() => glow.classList.add('active'), 100);
  setTimeout(() => title.classList.add('revealed'), 500);
  setTimeout(() => sub.classList.add('revealed'), 1200);
  setTimeout(() => {
    btn.classList.add('revealed');
  }, 2200);
}

$('btn-5').addEventListener('click', () => {
  goTo(6);
  setTimeout(initStage6, 700);
});

// ══════════════════════════════════════════
// STAGE 6 — letter line by line
// ══════════════════════════════════════════

function initStage6() {
  const lines = document.querySelectorAll('#letter-lines .letter-line');
  const btn   = $('btn-6');
  const STEP  = 680;

  lines.forEach((line, i) => {
    setTimeout(() => {
      line.classList.add('revealed');
      // scroll into view smoothly on mobile
      line.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, i * STEP + 200);
  });

  const totalDelay = lines.length * STEP + 900;
  setTimeout(() => {
    btn.style.opacity = '1';
    btn.style.pointerEvents = 'auto';
  }, totalDelay);
}

$('btn-6').addEventListener('click', () => {
  goTo(7);
  setTimeout(initStage7, 600);
});

// ══════════════════════════════════════════
// STAGE 7 — candle
// ══════════════════════════════════════════

function initStage7() {
  const wrap = $('candle-wrap');
  const btn  = $('btn-candle');

  function blowOut() {
    if (wrap.classList.contains('extinguished')) return;
    wrap.classList.add('extinguished');
    spawnParticles();
    setTimeout(() => launchConfetti(), 200);
    setTimeout(() => {
      goTo('final');
      setTimeout(initFinal, 700);
    }, 1800);
  }

  wrap.addEventListener('click', blowOut);
  btn.addEventListener('click',  blowOut);
}

// ── Candle blow-out spark particles ──────
function spawnParticles() {
  const ctx = confCanvas.getContext('2d');
  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  confCanvas.width  = window.innerWidth  * DPR;
  confCanvas.height = window.innerHeight * DPR;
  confCanvas.style.width  = window.innerWidth  + 'px';
  confCanvas.style.height = window.innerHeight + 'px';
  ctx.scale(DPR, DPR);

  // approximate candle position
  const cx = window.innerWidth  / 2;
  const cy = window.innerHeight / 2 - 60;

  const sparks = Array.from({ length: 18 }, () => ({
    x: cx, y: cy,
    vx: (Math.random() - 0.5) * 3.5,
    vy: -(Math.random() * 3.5 + 1),
    a: 1,
    r: Math.random() * 1.8 + 0.6,
    color: Math.random() > 0.5 ? '201,169,110' : '240,220,180',
  }));

  function draw() {
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    let alive = false;
    for (const s of sparks) {
      s.x  += s.vx;
      s.y  += s.vy;
      s.vy += 0.08;
      s.a  -= 0.026;
      if (s.a > 0) {
        alive = true;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${s.color},${s.a})`;
        ctx.fill();
      }
    }
    if (alive) confRAF = requestAnimationFrame(draw);
    else ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  }
  draw();
}

// ══════════════════════════════════════════
// CONFETTI
// ══════════════════════════════════════════

function launchConfetti() {
  const ctx = confCanvas.getContext('2d');
  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  confCanvas.width  = window.innerWidth  * DPR;
  confCanvas.height = window.innerHeight * DPR;
  confCanvas.style.width  = window.innerWidth  + 'px';
  confCanvas.style.height = window.innerHeight + 'px';
  ctx.scale(DPR, DPR);

  const W = window.innerWidth;
  const H = window.innerHeight;

  const COLORS = [
    'rgba(201,169,110,ALPHA)',
    'rgba(240,220,180,ALPHA)',
    'rgba(180,150,90,ALPHA)',
    'rgba(255,235,200,ALPHA)',
    'rgba(220,200,160,ALPHA)',
  ];

  confettiParts = Array.from({ length: 55 }, () => ({
    x:    Math.random() * W,
    y:    -Math.random() * H * 0.5,
    vx:   (Math.random() - 0.5) * 1.4,
    vy:   Math.random() * 1.6 + 0.8,
    rot:  Math.random() * Math.PI * 2,
    drot: (Math.random() - 0.5) * 0.08,
    w:    Math.random() * 5 + 3,
    h:    Math.random() * 3 + 2,
    col:  COLORS[Math.floor(Math.random() * COLORS.length)],
    a:    Math.random() * 0.55 + 0.35,
  }));

  let frame = 0;
  function draw() {
    ctx.clearRect(0, 0, W, H);
    frame++;
    let alive = false;
    for (const p of confettiParts) {
      p.x   += p.vx;
      p.y   += p.vy;
      p.rot += p.drot;
      if (frame > 90) p.a -= 0.008;
      if (p.a > 0 && p.y < H + 20) {
        alive = true;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.col.replace('ALPHA', p.a.toFixed(2));
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
    }
    if (alive) confRAF = requestAnimationFrame(draw);
    else ctx.clearRect(0, 0, W, H);
  }
  draw();
}

// ══════════════════════════════════════════
// FINAL STAGE
// ══════════════════════════════════════════

function initFinal() {
  const glow  = $('stage-final').querySelector('.final-glow');
  const lines = document.querySelectorAll('#final-lines .final-line');

  setTimeout(() => glow.classList.add('active'), 100);

  lines.forEach(line => {
    const delay = parseInt(line.dataset.delay || '0', 10) + 400;
    setTimeout(() => line.classList.add('revealed'), delay);
  });
}

// ══════════════════════════════════════════
// INIT
// ══════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
  initBgParticles();
  initStage1();
});
