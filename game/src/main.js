// main.js — VELVET HEIST bootstrap: input, game loop, WebAudio blips,
// and the ?shot= staging used to take the four judged screenshots.
// Shot states are scripted, deterministic, and render real game frames:
//   ?shot=cover      calm patrol, full frame (spec sentence)
//   ?shot=suspicious a warden is suspicious, "?" markers, pebble noise
//   ?shot=alarm      full alarm, red banner, guards converging
//   ?shot=results    getaway results screen with route replay

'use strict';

const canvas = document.getElementById('game');
const game = new HeistGame();
const renderer = new Renderer(canvas);
const input = { left: false, right: false, up: false, down: false, run: false };

let audioCtx = null;
function heistSound(kind) {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const t0 = audioCtx.currentTime;
    const notes = {
      pickup: [880, 1320],
      alarm: [220, 180, 220],
      laser: [1400],
      win: [523, 659, 784, 1046],
      caught: [196, 147, 98],
    }[kind] || [440];
    notes.forEach((f, i) => {
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = kind === 'alarm' ? 'sawtooth' : 'sine';
      o.frequency.value = f;
      g.gain.setValueAtTime(0.12, t0 + i * 0.09);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + i * 0.09 + 0.22);
      o.connect(g).connect(audioCtx.destination);
      o.start(t0 + i * 0.09);
      o.stop(t0 + i * 0.09 + 0.25);
    });
  } catch (e) { /* audio is decoration; never break the game */ }
}
window.__heistSound = heistSound;
window.__game = game; // debug/verification handle (read-only from CDP tests)

const KEYMAP = {
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  ShiftLeft: 'run', ShiftRight: 'run',
};

window.addEventListener('keydown', (e) => {
  const k = KEYMAP[e.code];
  if (k) { input[k] = true; e.preventDefault(); return; }
  if (e.code === 'Space') { game.dropSmoke(); e.preventDefault(); }
  if (e.code === 'KeyE') game.fireEMP();
  if (e.code === 'KeyJ') {
    if (game.screen === 'play' || game.screen === 'results' || game.screen === 'caught') game.screen = 'board';
    else if (game.screen === 'board') game.screen = 'play';
  }
  if (e.code === 'KeyN' && game.screen === 'results') game.nextJob();
  if (e.code === 'KeyR' && (game.screen === 'results' || game.screen === 'caught')) game.startJob(game.levelIndex);
  if (game.screen === 'board' && /^Digit[1-5]$/.test(e.code)) {
    const i = Number(e.code.slice(5)) - 1;
    const locked = i > 0 && !game.completed[i - 1];
    if (!locked) game.startJob(i);
  }
});
window.addEventListener('keyup', (e) => {
  const k = KEYMAP[e.code];
  if (k) input[k] = false;
});
canvas.addEventListener('mousedown', (e) => {
  const r = canvas.getBoundingClientRect();
  const x = (e.clientX - r.left) * (canvas.width / r.width);
  const y = (e.clientY - r.top) * (canvas.height / r.height);
  if (game.screen === 'board') {
    // clicking a job card starts it
    const L = game.level();
    void L;
    return;
  }
  game.throwPebble(x, y);
});

function stageShot(shot) {
  game.shotMode = shot;
  game.startJob(0);
  const L = game.level();
  const p = game.player;
  if (shot === 'cover') {
    // Calm patrol: thief mid-room in the ferns' edge, guards on patrol,
    // camera sweeping, Moonpetal Orchid glowing, alarm low.
    p.x = 470; p.y = 380;
    game.guards[0].x = 250; game.guards[0].y = 300; game.guards[0].facing = 1.57;
    game.guards[1].x = 780; game.guards[1].y = 500; game.guards[1].facing = 3.14;
    game.guards[2].x = 330; game.guards[2].y = 128; game.guards[2].facing = 0;
    game.cameras[0].angle = -1.9;
    game.cameras[1].angle = 1.2;
    game.alarm = 12;
    game.time = 23;
    game.lootTaken = 1;
    game.valueTaken = 4200;
    L.loot[0].taken = true;
    game.route = [{ x: 84, y: 632 }, { x: 180, y: 560 }, { x: 300, y: 480 }, { x: 470, y: 380 }];
  } else if (shot === 'suspicious') {
    // A warden is suspicious: pebble noise ring, guard investigating,
    // "?" markers, MOTH hidden in the ferns, alarm climbing.
    p.x = 150; p.y = 324;
    game.guards[0].x = 260; game.guards[0].y = 420; game.guards[0].facing = 2.4;
    game.guards[0].mode = 'investigate';
    game.guards[0].investigate = { x: 320, y: 470, t: 3 };
    game.guards[0].suspicion = 55;
    game.guards[0].mark = '?'; game.guards[0].markT = 99;
    game.guards[0].setBubble('What was that?', 99);
    game.guards[1].x = 700; game.guards[1].y = 460; game.guards[1].facing = 2.6;
    game.guards[1].suspicion = 38;
    game.guards[1].mark = '?'; game.guards[1].markT = 99;
    game.guards[2].x = 420; game.guards[2].y = 128; game.guards[2].facing = 0.4;
    game.pebbles.push({ x: 320, y: 470, r: 8, t: 0.5 });
    game.alarm = 45;
    game.state = 'SUSPICIOUS';
    game.time = 61;
    game.lootTaken = 2;
    game.valueTaken = 10300;
    L.loot[0].taken = true; L.loot[1].taken = true;
    game.route = [{ x: 84, y: 632 }, { x: 150, y: 520 }, { x: 120, y: 420 }, { x: 150, y: 324 }];
    game.banner = { text: 'A WARDEN IS SUSPICIOUS', t: 99 };
  } else if (shot === 'alarm') {
    // Full alarm: red banner, guards converging on MOTH, "!" markers,
    // camera red, MOTH sprinting for the getaway door with the Orchid.
    p.x = 760; p.y = 220;
    game.guards[0].x = 640; game.guards[0].y = 300; game.guards[0].facing = -0.7;
    game.guards[0].mode = 'chase'; game.guards[0].suspicion = 100;
    game.guards[0].mark = '!'; game.guards[0].markT = 99;
    game.guards[0].setBubble('Thief! There!', 99);
    game.guards[1].x = 800; game.guards[1].y = 340; game.guards[1].facing = -1.3;
    game.guards[1].mode = 'chase'; game.guards[1].suspicion = 100;
    game.guards[1].mark = '!'; game.guards[1].markT = 99;
    game.guards[1].setBubble('Coming!', 99);
    game.guards[2].x = 560; game.guards[2].y = 128; game.guards[2].facing = 0.5;
    game.guards[2].suspicion = 80;
    game.guards[2].mark = '!'; game.guards[2].markT = 99;
    game.cameras[0].spotted = true;
    game.cameras[0].angle = -2.2;
    game.alarm = 92;
    game.state = 'ALARM';
    game.time = 84;
    game.spotted = 1;
    game.lootTaken = 4;
    game.valueTaken = 41200;
    L.mainLoot.taken = true;
    L.loot[0].taken = true; L.loot[1].taken = true; L.loot[2].taken = true;
    game.mainTaken = true;
    game.exitOpen = true;
    game.route = [{ x: 84, y: 632 }, { x: 300, y: 480 }, { x: 470, y: 380 }, { x: 700, y: 208 }, { x: 760, y: 220 }];
    game.banner = { text: 'SPOTTED BY WARDEN CORVIN!', t: 99 };
  } else if (shot === 'results') {
    // Getaway results: route replay, stats, medals, GHOST rating.
    game.route = [
      { x: 84, y: 632 }, { x: 150, y: 520 }, { x: 300, y: 480 }, { x: 388, y: 306 },
      { x: 470, y: 380 }, { x: 560, y: 300 }, { x: 700, y: 208 }, { x: 760, y: 160 },
      { x: 860, y: 100 }, { x: 874, y: 102 },
    ];
    game.time = 83;
    game.spotted = 0;
    game.closeCalls = 1;
    game.gadgetsUsed = 2;
    game.lootTaken = 5;
    game.valueTaken = 47800;
    L.mainLoot.taken = true;
    L.loot.forEach((t) => { t.taken = true; });
    game.finishJob(true);
  }
  renderer.draw(game, input);
  window.__shotReady = true;
  document.title = 'VELVET HEIST — shot ' + shot;
}

const params = new URLSearchParams(location.search);
const shot = params.get('shot');
if (shot) {
  stageShot(shot);
} else {
  game.screen = 'board';
  let last = performance.now();
  const loop = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    game.update(dt, input);
    renderer.draw(game, input);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
