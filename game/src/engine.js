// engine.js — VELVET HEIST game state: movement, guard AI, cameras,
// lasers, detection, gadgets, loot, win/lose, route replay.
// No rendering here; render.js draws what this computes.

'use strict';

const TAU = Math.PI * 2;

function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }
function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= TAU;
  while (d < -Math.PI) d += TAU;
  return d;
}
function mulberry32(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), s | 1);
    t = (t + Math.imul(t ^ (t >>> 7), t | 61)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rectHit(r, x, y, rad) {
  const cx = clamp(x, r.x, r.x + r.w);
  const cy = clamp(y, r.y, r.y + r.h);
  return (x - cx) * (x - cx) + (y - cy) * (y - cy) < rad * rad;
}

function segmentBlocked(x1, y1, x2, y2, walls) {
  const steps = Math.ceil(dist(x1, y1, x2, y2) / 8);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const x = x1 + (x2 - x1) * t;
    const y = y1 + (y2 - y1) * t;
    for (const w of walls) {
      if (x >= w.x && x <= w.x + w.w && y >= w.y && y <= w.y + w.h) return true;
    }
  }
  return false;
}

function pointInRect(x, y, r) {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

class Guard {
  constructor(def) {
    this.name = def.name;
    this.color = def.color;
    this.waypoints = def.waypoints;
    this.speed = def.speed;
    this.wp = 0;
    this.x = def.waypoints[0][0];
    this.y = def.waypoints[0][1];
    this.facing = 0;
    this.suspicion = 0;
    this.mode = 'patrol'; // patrol | investigate | chase
    this.investigate = null; // {x,y,t}
    this.bubble = null; // {text,t}
    this.mark = null; // '?' | '!'
    this.markT = 0;
  }
  setBubble(text, t) { this.bubble = { text, t }; }
  update(dt, game) {
    if (this.bubble) { this.bubble.t -= dt; if (this.bubble.t <= 0) this.bubble = null; }
    if (this.markT > 0) { this.markT -= dt; if (this.markT <= 0) this.mark = null; }
    if (this.mode === 'chase') {
      const p = game.player;
      const d = dist(this.x, this.y, p.x, p.y);
      if (d > 4) {
        const a = Math.atan2(p.y - this.y, p.x - this.x);
        this.facing = a;
        game.moveEntity(this, Math.cos(a) * this.speed * 1.35 * dt, Math.sin(a) * this.speed * 1.35 * dt);
      }
      if (d > 320 || game.alarm < 55) { this.mode = 'patrol'; this.mark = '?'; this.markT = 1.2; }
      return;
    }
    if (this.mode === 'investigate' && this.investigate) {
      const iv = this.investigate;
      const d = dist(this.x, this.y, iv.x, iv.y);
      if (d > 6) {
        const a = Math.atan2(iv.y - this.y, iv.x - this.x);
        this.facing = a;
        game.moveEntity(this, Math.cos(a) * this.speed * 1.15 * dt, Math.sin(a) * this.speed * 1.15 * dt);
      } else {
        iv.t -= dt;
        this.facing += dt * 1.4;
        if (iv.t <= 0) { this.mode = 'patrol'; this.investigate = null; }
      }
      return;
    }
    // patrol
    const target = this.waypoints[this.wp];
    const d = dist(this.x, this.y, target[0], target[1]);
    if (d < 6) {
      this.wp = (this.wp + 1) % this.waypoints.length;
    } else {
      const a = Math.atan2(target[1] - this.y, target[0] - this.x);
      this.facing = a;
      game.moveEntity(this, Math.cos(a) * this.speed * dt, Math.sin(a) * this.speed * dt);
    }
  }
}

class Camera {
  constructor(def) {
    this.name = def.name;
    this.x = def.x; this.y = def.y;
    this.base = def.base; this.sweep = def.sweep; this.range = def.range;
    this.phase = Math.random() * TAU;
    this.angle = def.base;
    this.disabled = 0;
    this.spotted = false;
  }
  update(dt, t) {
    if (this.disabled > 0) this.disabled -= dt;
    this.angle = this.base + Math.sin(t * 0.55 + this.phase) * this.sweep;
  }
}

class HeistGame {
  constructor() {
    this.levelIndex = 0;
    this.screen = 'board'; // board | play | results | caught
    this.player = { x: 0, y: 0, r: 13, speed: 165, moving: false, running: false };
    this.guards = [];
    this.cameras = [];
    this.pebbles = [];
    this.smokes = [];
    this.alarm = 0;
    this.state = 'CALM'; // CALM | SUSPICIOUS | ALARM
    this.spotted = 0;
    this.closeCalls = 0;
    this.gadgetsUsed = 0;
    this.gadgets = { pebble: 5, smoke: 2, emp: 1 };
    this.time = 0;
    this.route = [];
    this.routeT = 0;
    this.noise = 0; // 0..1 recent noise level
    this.noiseT = 0;
    this.exitOpen = false;
    this.mainTaken = false;
    this.lootTaken = 0;
    this.valueTaken = 0;
    this.results = null;
    this.caughtBy = null;
    this.banner = null; // {text,t}
    this.laserFlash = 0;
    this.levelTimes = [];
    this.levelRatings = [];
    this.completed = [false, false, false, false, false];
    this.t = 0;
    this.smokeT = 0;
    this.empT = 0;
    this.shotMode = null;
    this.loadLevel(0);
  }

  level() { return LEVELS[this.levelIndex]; }

  loadLevel(i) {
    this.levelIndex = i;
    const L = LEVELS[i];
    this.player.x = L.start.x;
    this.player.y = L.start.y;
    this.guards = L.guards.map((g) => new Guard(g));
    this.cameras = L.cameras.map((c) => new Camera(c));
    this.pebbles = [];
    this.smokes = [];
    this.alarm = 0;
    this.state = 'CALM';
    this.spotted = 0;
    this.closeCalls = 0;
    this.gadgetsUsed = 0;
    this.gadgets = { pebble: 5, smoke: 2, emp: 1 };
    this.time = 0;
    this.route = [{ x: L.start.x, y: L.start.y }];
    this.routeT = 0;
    this.noise = 0;
    this.exitOpen = false;
    this.mainTaken = false;
    this.lootTaken = 0;
    this.valueTaken = 0;
    this.results = null;
    this.caughtBy = null;
    this.banner = null;
    this.laserFlash = 0;
    this.smokeT = 0;
    this.empT = 0;
    L.loot.forEach((t) => { t.taken = false; });
    L.mainLoot.taken = false;
  }

  startJob(i) {
    this.loadLevel(i);
    this.screen = 'play';
  }

  moveEntity(e, dx, dy) {
    const L = this.level();
    const r = e.r || 12;
    let nx = e.x + dx;
    let ny = e.y + dy;
    nx = clamp(nx, FIELD.x + r, FIELD.x + FIELD.w - r);
    ny = clamp(ny, FIELD.y + r, FIELD.y + FIELD.h - r);
    const solids = L.walls.concat(L.props.filter((p) => p.kind !== 'rug' && p.kind !== 'painting'));
    let blockedX = false, blockedY = false;
    for (const s of solids) {
      if (rectHit(s, nx, e.y, r)) blockedX = true;
      if (rectHit(s, e.x, ny, r)) blockedY = true;
    }
    if (!blockedX) e.x = nx;
    if (!blockedY) e.y = ny;
  }

  playerInBush() {
    const p = this.player;
    return this.level().bushes.some((b) => pointInRect(p.x, p.y, b));
  }

  playerInLight() {
    const p = this.player;
    return this.level().lamps.some((l) => dist(p.x, p.y, l.x, l.y) < l.r * 0.8);
  }

  playerInSmoke() {
    const p = this.player;
    return this.smokes.some((s) => dist(p.x, p.y, s.x, s.y) < s.r);
  }

  canSee(gx, gy, facing, range, halfAngle) {
    const p = this.player;
    const d = dist(gx, gy, p.x, p.y);
    if (d > range) return false;
    if (d < 26) return true;
    const a = Math.atan2(p.y - gy, p.x - gx);
    if (Math.abs(angleDiff(a, facing)) > halfAngle) return false;
    if (segmentBlocked(gx, gy, p.x, p.y, this.level().walls)) return false;
    if (this.playerInBush() && d > 70) return false;
    if (this.playerInSmoke()) return false;
    return true;
  }

  throwPebble(tx, ty) {
    if (this.screen !== 'play' || this.gadgets.pebble <= 0) return false;
    const p = this.player;
    const d = dist(p.x, p.y, tx, ty);
    const maxR = 240;
    const k = d > maxR ? maxR / d : 1;
    const lx = p.x + (tx - p.x) * k;
    const ly = p.y + (ty - p.y) * k;
    this.gadgets.pebble--;
    this.gadgetsUsed++;
    this.pebbles.push({ x: lx, y: ly, r: 8, t: 0 });
    this.noise = 1; this.noiseT = 0.6;
    // nearest guard investigates
    let best = null, bd = 1e9;
    for (const g of this.guards) {
      const gd = dist(g.x, g.y, lx, ly);
      if (gd < bd) { bd = gd; best = g; }
    }
    if (best && bd < 340) {
      best.mode = 'investigate';
      best.investigate = { x: lx, y: ly, t: 4 };
      best.setBubble('What was that?', 2.2);
      best.mark = '?'; best.markT = 2.2;
    }
    return true;
  }

  dropSmoke() {
    if (this.screen !== 'play' || this.gadgets.smoke <= 0) return false;
    this.gadgets.smoke--;
    this.gadgetsUsed++;
    this.smokes.push({ x: this.player.x, y: this.player.y, r: 74, t: 6 });
    return true;
  }

  fireEMP() {
    if (this.screen !== 'play' || this.gadgets.emp <= 0) return false;
    this.gadgets.emp--;
    this.gadgetsUsed++;
    this.empT = 8;
    for (const c of this.cameras) c.disabled = 8;
    this.banner = { text: 'EMP BURST — all cameras blind for 8s', t: 2.5 };
    return true;
  }

  update(dt, input) {
    this.t += dt;
    if (this.screen !== 'play') return;
    this.time += dt;
    const p = this.player;
    const L = this.level();

    // --- movement
    let mx = 0, my = 0;
    if (input.left) mx -= 1;
    if (input.right) mx += 1;
    if (input.up) my -= 1;
    if (input.down) my += 1;
    p.running = !!input.run;
    p.moving = mx !== 0 || my !== 0;
    if (p.moving) {
      const len = Math.hypot(mx, my);
      const sp = p.speed * (p.running ? 1.55 : 1);
      this.moveEntity(p, (mx / len) * sp * dt, (my / len) * sp * dt);
      if (p.running) { this.noise = Math.max(this.noise, 0.7); this.noiseT = 0.4; }
    }
    if (this.noiseT > 0) { this.noiseT -= dt; if (this.noiseT <= 0) this.noise = 0; }

    // --- route recording
    this.routeT += dt;
    if (this.routeT > 0.25) {
      this.routeT = 0;
      this.route.push({ x: p.x, y: p.y });
    }

    // --- pebbles / smoke decay
    for (const pb of this.pebbles) pb.t += dt;
    this.pebbles = this.pebbles.filter((pb) => pb.t < 1.4);
    for (const s of this.smokes) s.t -= dt;
    this.smokes = this.smokes.filter((s) => s.t > 0);
    if (this.laserFlash > 0) this.laserFlash -= dt;
    if (this.banner) { this.banner.t -= dt; if (this.banner.t <= 0) this.banner = null; }

    // --- loot pickup
    const tryTake = (item) => {
      if (!item.taken && dist(p.x, p.y, item.x, item.y) < 26) {
        item.taken = true;
        this.lootTaken++;
        this.valueTaken += item.value;
        if (item === L.mainLoot) {
          this.mainTaken = true;
          this.exitOpen = true;
          this.banner = { text: 'TARGET SECURED — ' + item.name.toUpperCase() + ' — reach the getaway door!', t: 3 };
        }
        return true;
      }
      return false;
    };
    if (tryTake(L.mainLoot)) this.onSound('pickup');
    for (const t of L.loot) if (tryTake(t)) this.onSound('pickup');

    // --- exit
    if (this.exitOpen && pointInRect(p.x, p.y, L.exit)) {
      this.finishJob(true);
      return;
    }

    // --- lasers
    for (const lz of L.lasers) {
      const d = distToSegment(p.x, p.y, lz.x1, lz.y1, lz.x2, lz.y2);
      if (d < 10) {
        this.alarm = clamp(this.alarm + 30 * dt * 10, 0, 100);
        this.laserFlash = 0.4;
        this.onSound('laser');
      }
    }

    // --- guards: vision + suspicion
    let maxSusp = 0;
    let anyChase = false;
    for (const g of this.guards) {
      const seen = this.canSee(g.x, g.y, g.facing, 175, 0.62);
      if (seen) {
        const rate = this.playerInLight() ? 62 : 26;
        g.suspicion = clamp(g.suspicion + rate * dt, 0, 100);
        if (g.suspicion > 35 && g.mode === 'patrol') {
          g.mode = 'investigate';
          g.investigate = { x: p.x, y: p.y, t: 2.5 };
          g.setBubble('Hmm… did something move?', 2);
          g.mark = '?'; g.markT = 2;
        }
        if (g.suspicion >= 100 && g.mode !== 'chase') {
          g.mode = 'chase';
          g.setBubble('Thief! There!', 2.4);
          g.mark = '!'; g.markT = 2.4;
          this.spotted++;
          this.alarm = Math.max(this.alarm, 88);
          this.banner = { text: 'SPOTTED BY ' + g.name + '!', t: 2.2 };
          this.onSound('alarm');
        }
      } else {
        g.suspicion = clamp(g.suspicion - 14 * dt, 0, 100);
      }
      maxSusp = Math.max(maxSusp, g.suspicion);
      if (g.mode === 'chase') anyChase = true;
      g.update(dt, this);
      // caught?
      if (dist(g.x, g.y, p.x, p.y) < 22) {
        this.finishJob(false, g.name);
        return;
      }
      // close call
      if (g.mode === 'chase' && dist(g.x, g.y, p.x, p.y) < 90 && !g._closeCounted) {
        g._closeCounted = true;
        this.closeCalls++;
        setTimeout(() => { g._closeCounted = false; }, 4000);
      }
    }

    // --- cameras
    for (const c of this.cameras) {
      c.update(dt, this.t);
      if (c.disabled > 0) { c.spotted = false; continue; }
      const seen = this.canSee(c.x, c.y, c.angle, c.range, 0.5);
      c.spotted = seen;
      if (seen) {
        this.alarm = clamp(this.alarm + 42 * dt, 0, 100);
        if (this.alarm > 70 && this.state !== 'ALARM') {
          this.spotted++;
          this.banner = { text: 'SPOTTED BY ' + c.name + '!', t: 2.2 };
          this.onSound('alarm');
        }
      }
    }

    // --- alarm + state
    if (anyChase || maxSusp > 70) this.alarm = clamp(this.alarm + 6 * dt, 0, 100);
    else this.alarm = clamp(this.alarm - 5 * dt, 0, 100);
    const prev = this.state;
    this.state = this.alarm >= 70 ? 'ALARM' : this.alarm >= 30 ? 'SUSPICIOUS' : 'CALM';
    if (this.state === 'ALARM' && prev !== 'ALARM') this.onSound('alarm');
    if (this.alarm >= 100 && !anyChase) {
      // full alarm: nearest guard chases
      let best = null, bd = 1e9;
      for (const g of this.guards) {
        const gd = dist(g.x, g.y, p.x, p.y);
        if (gd < bd) { bd = gd; best = g; }
      }
      if (best) { best.mode = 'chase'; best.setBubble('Thief! There!', 2.4); best.mark = '!'; best.markT = 2.4; }
    }
  }

  finishJob(won, caughtBy) {
    const L = this.level();
    const totalLoot = 1 + L.loot.length;
    const medals = {
      ghost: this.spotted === 0,
      clean: this.lootTaken === totalLoot,
      fast: this.time <= L.par,
    };
    const stars = (medals.ghost ? 1 : 0) + (medals.clean ? 1 : 0) + (medals.fast ? 1 : 0);
    this.results = {
      won,
      job: L.name,
      room: L.room,
      time: this.time,
      spotted: this.spotted,
      closeCalls: this.closeCalls,
      gadgetsUsed: this.gadgetsUsed,
      loot: this.lootTaken,
      lootTotal: totalLoot,
      value: this.valueTaken,
      medals,
      stars,
      ghostText: stars === 3
        ? 'GHOST — Nobody will ever know you were there.'
        : stars === 2
          ? 'SHADOW — Almost a ghost. One slip, that is all.'
          : 'LOUD — The whole city heard that one.',
      route: this.route.slice(),
    };
    if (won) {
      this.completed[this.levelIndex] = true;
      this.levelTimes[this.levelIndex] = this.time;
      this.levelRatings[this.levelIndex] = stars;
      this.screen = 'results';
      this.onSound('win');
    } else {
      this.caughtBy = caughtBy || 'a warden';
      this.screen = 'caught';
      this.onSound('caught');
    }
  }

  nextJob() {
    const next = this.levelIndex + 1;
    if (next < LEVELS.length) this.startJob(next);
    else this.screen = 'board';
  }

  onSound(kind) {
    if (typeof window !== 'undefined' && window.__heistSound) window.__heistSound(kind);
  }
}

function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((px - x1) * dx + (py - y1) * dy) / len2;
  t = clamp(t, 0, 1);
  return dist(px, py, x1 + dx * t, y1 + dy * t);
}
