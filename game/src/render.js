// render.js — all Canvas 2D drawing for VELVET HEIST:
// floor textures, props, light pools, vision cones, entities,
// annotations, the full side-panel HUD, job board and results screen.

'use strict';

const W = 1280, H = 720;
const PANEL = { x: 920, y: 64, w: 344, h: 640 };

function fmtMoney(n) { return '$' + n.toLocaleString('en-US'); }
function fmtTime(s) {
  const m = Math.floor(s / 60), ss = Math.floor(s % 60);
  return (m < 10 ? '0' : '') + m + ':' + (ss < 10 ? '0' : '') + ss;
}
function wrapText(ctx, text, x, y, maxW, lineH) {
  const words = text.split(' ');
  let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, y);
      line = w;
      y += lineH;
    } else line = test;
  }
  if (line) ctx.fillText(line, x, y);
  return y;
}

class Renderer {
  constructor(canvas) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.light = document.createElement('canvas');
    this.light.width = FIELD.w;
    this.light.height = FIELD.h;
    this.lctx = this.light.getContext('2d');
  }

  draw(game, input) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#0b0a12';
    ctx.fillRect(0, 0, W, H);
    this.drawTopBar(game);
    if (game.screen === 'board') {
      this.drawField(game, true);
      this.drawHUD(game);
      this.drawBoard(game);
    } else if (game.screen === 'results') {
      this.drawField(game, true);
      this.drawHUD(game);
      this.drawResults(game);
    } else if (game.screen === 'caught') {
      this.drawField(game, true);
      this.drawHUD(game);
      this.drawCaught(game);
    } else {
      this.drawField(game, false);
      this.drawHUD(game);
    }
    if (game.banner && game.screen === 'play') this.drawBanner(game);
  }

  // ---------- top bar ----------
  drawTopBar(game) {
    const ctx = this.ctx;
    const L = game.level();
    ctx.fillStyle = '#171225';
    ctx.fillRect(0, 0, W, 56);
    ctx.fillStyle = '#c9a227';
    ctx.fillRect(0, 56, W, 2);
    ctx.fillStyle = '#f2d06b';
    ctx.font = 'bold 22px Georgia, serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('VELVET HEIST', 16, 36);
    ctx.fillStyle = '#c9a227';
    ctx.font = 'bold 12px monospace';
    ctx.fillText('5 HEISTS  ·  14 GUARDS  ·  26 TREASURES  ·  3 GADGETS', 210, 35);
    ctx.fillStyle = '#e8e2d0';
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(L.name + ' — ' + L.room, 1264, 26);
    ctx.fillStyle = '#9fb2d8';
    ctx.font = '12px monospace';
    ctx.fillText('OBJECTIVE: ' + L.objective, 1264, 44);
    ctx.textAlign = 'left';
  }

  // ---------- field ----------
  drawField(game, dim) {
    const ctx = this.ctx;
    const L = game.level();
    this.drawFloor(game);
    this.drawProps(game);
    this.drawLoot(game);
    this.drawExit(game);
    this.drawLasers(game);
    this.drawCones(game);
    this.drawGuards(game);
    this.drawCameras(game);
    this.drawPebbles(game);
    this.drawPlayer(game);
    this.drawCallouts(game);
    this.drawLighting(game);
    if (game.state === 'ALARM' && game.screen === 'play') {
      ctx.strokeStyle = 'rgba(255,40,40,' + (0.5 + 0.3 * Math.sin(game.t * 6)) + ')';
      ctx.lineWidth = 4;
      ctx.strokeRect(FIELD.x, FIELD.y, FIELD.w, FIELD.h);
    }
    if (dim) {
      ctx.fillStyle = 'rgba(5,5,12,0.55)';
      ctx.fillRect(FIELD.x, FIELD.y, FIELD.w, FIELD.h);
    }
  }

  drawFloor(game) {
    const ctx = this.ctx;
    const L = game.level();
    const rng = mulberry32(L.id * 7919 + 13);
    // base
    ctx.fillStyle = L.floorTint;
    ctx.fillRect(FIELD.x, FIELD.y, FIELD.w, FIELD.h);
    if (L.floor === 'wood') {
      for (let y = FIELD.y; y < FIELD.y + FIELD.h; y += 40) {
        for (let x = FIELD.x; x < FIELD.x + FIELD.w; x += 80) {
          const v = rng();
          ctx.fillStyle = v > 0.66 ? 'rgba(255,220,150,0.06)' : v > 0.33 ? 'rgba(0,0,0,0.08)' : 'rgba(0,0,0,0.02)';
          ctx.fillRect(x, y, 80, 40);
          ctx.strokeStyle = 'rgba(30,18,6,0.5)';
          ctx.lineWidth = 1;
          ctx.strokeRect(x + 0.5, y + 0.5, 80, 40);
          ctx.strokeStyle = 'rgba(60,40,14,0.25)';
          ctx.beginPath();
          ctx.moveTo(x + 12 + rng() * 50, y + 8);
          ctx.lineTo(x + 20 + rng() * 40, y + 32);
          ctx.stroke();
        }
      }
    } else if (L.floor === 'tile') {
      for (let y = FIELD.y; y < FIELD.y + FIELD.h; y += 44) {
        for (let x = FIELD.x; x < FIELD.x + FIELD.w; x += 44) {
          const v = rng();
          ctx.fillStyle = v > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.07)';
          ctx.fillRect(x, y, 44, 44);
          ctx.strokeStyle = 'rgba(20,30,34,0.4)';
          ctx.strokeRect(x + 0.5, y + 0.5, 44, 44);
        }
      }
    } else if (L.floor === 'marble') {
      for (let i = 0; i < 46; i++) {
        ctx.strokeStyle = 'rgba(220,225,255,' + (0.04 + rng() * 0.08) + ')';
        ctx.lineWidth = 1 + rng() * 1.5;
        ctx.beginPath();
        let x = FIELD.x + rng() * FIELD.w, y = FIELD.y + rng() * FIELD.h;
        ctx.moveTo(x, y);
        for (let k = 0; k < 4; k++) { x += (rng() - 0.5) * 160; y += (rng() - 0.5) * 120; ctx.lineTo(x, y); }
        ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      for (let y = FIELD.y; y < FIELD.y + FIELD.h; y += 88) {
        ctx.beginPath(); ctx.moveTo(FIELD.x, y); ctx.lineTo(FIELD.x + FIELD.w, y); ctx.stroke();
      }
      for (let x = FIELD.x; x < FIELD.x + FIELD.w; x += 88) {
        ctx.beginPath(); ctx.moveTo(x, FIELD.y); ctx.lineTo(x, FIELD.y + FIELD.h); ctx.stroke();
      }
    } else if (L.floor === 'carpet') {
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      ctx.fillRect(FIELD.x, FIELD.y, FIELD.w, FIELD.h);
      for (let y = FIELD.y + 22; y < FIELD.y + FIELD.h; y += 44) {
        for (let x = FIELD.x + 22; x < FIELD.x + FIELD.w; x += 44) {
          ctx.fillStyle = 'rgba(212,175,55,0.16)';
          ctx.beginPath(); ctx.arc(x, y, 3.5, 0, TAU); ctx.fill();
        }
      }
      ctx.strokeStyle = 'rgba(212,175,55,0.35)';
      ctx.lineWidth = 2;
      ctx.strokeRect(FIELD.x + 10, FIELD.y + 10, FIELD.w - 20, FIELD.h - 20);
    } else { // stone
      for (let y = FIELD.y; y < FIELD.y + FIELD.h; y += 56) {
        for (let x = FIELD.x; x < FIELD.x + FIELD.w; x += 56) {
          const v = rng();
          ctx.fillStyle = v > 0.5 ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.09)';
          ctx.fillRect(x, y, 56, 56);
          ctx.strokeStyle = 'rgba(10,10,16,0.45)';
          ctx.strokeRect(x + 0.5, y + 0.5, 56, 56);
          if (rng() > 0.7) { ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fillRect(x + 8 + rng() * 30, y + 8 + rng() * 30, 4, 4); }
        }
      }
    }
    // border walls
    ctx.fillStyle = '#241d33';
    ctx.fillRect(FIELD.x - 4, FIELD.y - 4, FIELD.w + 8, 10);
    ctx.fillRect(FIELD.x - 4, FIELD.y + FIELD.h - 6, FIELD.w + 8, 10);
    ctx.fillRect(FIELD.x - 4, FIELD.y - 4, 10, FIELD.h + 8);
    ctx.fillRect(FIELD.x + FIELD.w - 6, FIELD.y - 4, 10, FIELD.h + 8);
    ctx.strokeStyle = '#c9a227';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(FIELD.x + 6.5, FIELD.y + 6.5, FIELD.w - 13, FIELD.h - 13);
    // interior walls
    for (const w of L.walls) {
      ctx.fillStyle = '#2c2440';
      ctx.fillRect(w.x, w.y, w.w, w.h);
      ctx.fillStyle = '#c9a227';
      ctx.fillRect(w.x, w.y, w.w, 3);
      ctx.fillRect(w.x, w.y + w.h - 3, w.w, 3);
    }
  }

  drawProps(game) {
    const ctx = this.ctx;
    const L = game.level();
    for (const p of L.props) {
      if (p.kind === 'rug') {
        ctx.fillStyle = 'rgba(120,20,30,0.55)';
        ctx.fillRect(p.x, p.y, p.w, p.h);
        ctx.strokeStyle = '#c9a227';
        ctx.lineWidth = 2;
        ctx.strokeRect(p.x + 4, p.y + 4, p.w - 8, p.h - 8);
        ctx.strokeStyle = 'rgba(201,162,39,0.5)';
        ctx.strokeRect(p.x + 10, p.y + 10, p.w - 20, p.h - 20);
      } else if (p.kind === 'crate') {
        ctx.fillStyle = '#8a6a3b';
        ctx.fillRect(p.x, p.y, p.w, p.h);
        ctx.strokeStyle = '#5d4423';
        ctx.lineWidth = 2;
        ctx.strokeRect(p.x, p.y, p.w, p.h);
        ctx.beginPath();
        ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + p.w, p.y + p.h);
        ctx.moveTo(p.x + p.w, p.y); ctx.lineTo(p.x, p.y + p.h);
        ctx.stroke();
      } else if (p.kind === 'shelf') {
        ctx.fillStyle = '#4a3421';
        ctx.fillRect(p.x, p.y, p.w, p.h);
        const cols = ['#a33', '#3a6', '#36a', '#da3', '#863'];
        for (let i = 0; i < Math.floor(p.w / 12); i++) {
          ctx.fillStyle = cols[i % cols.length];
          ctx.fillRect(p.x + 3 + i * 12, p.y + 3, 8, p.h - 6);
        }
      } else if (p.kind === 'table') {
        ctx.fillStyle = '#5d3f22';
        ctx.fillRect(p.x, p.y, p.w, p.h);
        ctx.fillStyle = '#7a5630';
        ctx.fillRect(p.x + 4, p.y + 4, p.w - 8, p.h - 8);
        ctx.strokeStyle = '#3a2812';
        ctx.strokeRect(p.x, p.y, p.w, p.h);
        ctx.fillStyle = '#e8e2d0';
        ctx.beginPath(); ctx.arc(p.x + p.w / 2, p.y + p.h / 2, 6, 0, TAU); ctx.fill();
      } else if (p.kind === 'plant') {
        ctx.fillStyle = '#2d6b2d';
        ctx.beginPath(); ctx.arc(p.x + p.w / 2, p.y + p.h / 2, p.w / 2, 0, TAU); ctx.fill();
        ctx.fillStyle = '#3f8f3f';
        ctx.beginPath(); ctx.arc(p.x + p.w / 2 - 6, p.y + p.h / 2 - 5, p.w / 3.4, 0, TAU); ctx.fill();
        ctx.fillStyle = '#7a4a22';
        ctx.fillRect(p.x + p.w / 2 - 7, p.y + p.h - 8, 14, 8);
      } else if (p.kind === 'painting') {
        ctx.fillStyle = '#c9a227';
        ctx.fillRect(p.x - 2, p.y - 2, p.w + 4, p.h + 4);
        ctx.fillStyle = '#3a5a8a';
        ctx.fillRect(p.x, p.y, p.w, p.h);
        ctx.fillStyle = '#e8b23a';
        ctx.beginPath(); ctx.arc(p.x + p.w / 2, p.y + p.h / 2, 4, 0, TAU); ctx.fill();
      } else if (p.kind === 'pillar') {
        ctx.fillStyle = '#8a8578';
        ctx.fillRect(p.x, p.y, p.w, p.h);
        ctx.fillStyle = '#b5b0a2';
        ctx.fillRect(p.x + 3, p.y + 3, p.w - 6, p.h - 6);
        ctx.strokeStyle = '#5d584c';
        ctx.strokeRect(p.x, p.y, p.w, p.h);
      }
    }
    // bushes (cover)
    for (const b of L.bushes) {
      ctx.fillStyle = '#1d4a24';
      ctx.beginPath(); ctx.ellipse(b.x + b.w / 2, b.y + b.h / 2, b.w / 2, b.h / 2, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#2f6b35';
      for (let i = 0; i < 7; i++) {
        const bx = b.x + 12 + (i * 13) % (b.w - 20);
        const by = b.y + 10 + ((i * 29) % (b.h - 18));
        ctx.beginPath(); ctx.arc(bx, by, 9, 0, TAU); ctx.fill();
      }
      ctx.fillStyle = '#9be07f';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(b.name, b.x + b.w / 2, b.y + b.h / 2 + 3);
      ctx.textAlign = 'left';
    }
    // lamps
    for (const l of L.lamps) {
      ctx.fillStyle = '#3a2f1a';
      ctx.beginPath(); ctx.arc(l.x, l.y, 7, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ffd76a';
      ctx.beginPath(); ctx.arc(l.x, l.y, 4.5, 0, TAU); ctx.fill();
    }
  }

  drawLoot(game) {
    const ctx = this.ctx;
    const L = game.level();
    const drawOne = (item, main) => {
      if (item.taken) return;
      const pulse = 1 + 0.12 * Math.sin(game.t * 3 + item.x);
      const r = (main ? 26 : 17) * pulse;
      const g = ctx.createRadialGradient(item.x, item.y, 2, item.x, item.y, r + 14);
      g.addColorStop(0, 'rgba(255,215,106,0.55)');
      g.addColorStop(1, 'rgba(255,215,106,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(item.x, item.y, r + 14, 0, TAU); ctx.fill();
      ctx.fillStyle = main ? '#3a2c05' : '#2c2405';
      ctx.beginPath(); ctx.arc(item.x, item.y, main ? 17 : 12, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#ffd76a';
      ctx.lineWidth = main ? 2.5 : 1.5;
      ctx.stroke();
      ctx.fillStyle = '#ffd76a';
      ctx.font = 'bold ' + (main ? 15 : 11) + 'px Georgia, serif';
      ctx.textAlign = 'center';
      const glyph = { gem: '◆', flower: '✿', crown: '♛', chip: '●', vase: '⚱', watch: '◷', candle: '♨' }[item.kind] || '◆';
      ctx.fillText(glyph, item.x, item.y + (main ? 5 : 4));
      ctx.font = 'bold 10px monospace';
      ctx.fillStyle = '#ffe9a8';
      ctx.fillText(item.name.toUpperCase(), item.x, item.y + (main ? 32 : 26));
      ctx.fillStyle = '#c9a227';
      ctx.font = '10px monospace';
      ctx.fillText(fmtMoney(item.value), item.x, item.y + (main ? 44 : 38));
      ctx.textAlign = 'left';
    };
    for (const t of L.loot) drawOne(t, false);
    drawOne(L.mainLoot, true);
  }

  drawExit(game) {
    const ctx = this.ctx;
    const e = game.level().exit;
    ctx.fillStyle = game.exitOpen ? '#1d7a34' : '#5a2a2a';
    ctx.fillRect(e.x, e.y, e.w, e.h);
    ctx.strokeStyle = game.exitOpen ? '#7fe07f' : '#c96a6a';
    ctx.lineWidth = 2;
    ctx.strokeRect(e.x, e.y, e.w, e.h);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(game.exitOpen ? 'EXIT — GO!' : 'EXIT LOCKED', e.x + e.w / 2, e.y + e.h / 2 - 2);
    ctx.font = '9px monospace';
    ctx.fillText(e.name, e.x + e.w / 2, e.y + e.h / 2 + 10);
    ctx.textAlign = 'left';
  }

  drawLasers(game) {
    const ctx = this.ctx;
    const flash = game.laserFlash > 0;
    for (const lz of game.level().lasers) {
      ctx.strokeStyle = flash ? '#ff4040' : 'rgba(255,60,60,0.85)';
      ctx.lineWidth = flash ? 4 : 2;
      ctx.beginPath(); ctx.moveTo(lz.x1, lz.y1); ctx.lineTo(lz.x2, lz.y2); ctx.stroke();
      ctx.fillStyle = '#ff8080';
      ctx.beginPath(); ctx.arc(lz.x1, lz.y1, 4, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(lz.x2, lz.y2, 4, 0, TAU); ctx.fill();
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(lz.name, (lz.x1 + lz.x2) / 2, (lz.y1 + lz.y2) / 2 - 8);
      ctx.textAlign = 'left';
    }
  }

  drawCones(game) {
    const ctx = this.ctx;
    const cone = (x, y, facing, range, half, color) => {
      const g = ctx.createRadialGradient(x, y, 6, x, y, range);
      g.addColorStop(0, color + 'cc');
      g.addColorStop(1, color + '00');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.arc(x, y, range, facing - half, facing + half);
      ctx.closePath();
      ctx.fill();
    };
    for (const gd of game.guards) {
      const col = gd.mode === 'chase' ? '#ff4040' : gd.suspicion > 35 ? '#ff9a2a' : '#ffd76a';
      cone(gd.x, gd.y, gd.facing, 175, 0.62, col);
    }
    for (const c of game.cameras) {
      if (c.disabled > 0) {
        cone(c.x, c.y, c.angle, c.range, 0.5, '#888888');
      } else {
        cone(c.x, c.y, c.angle, c.range, 0.5, c.spotted ? '#ff4040' : '#ff5a5a');
      }
    }
  }

  drawGuards(game) {
    const ctx = this.ctx;
    for (const g of game.guards) {
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath(); ctx.ellipse(g.x, g.y + 10, 13, 5, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = g.color;
      ctx.beginPath(); ctx.arc(g.x, g.y, 12, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#14101c';
      ctx.lineWidth = 2;
      ctx.stroke();
      // facing tick
      ctx.strokeStyle = '#14101c';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(g.x, g.y);
      ctx.lineTo(g.x + Math.cos(g.facing) * 15, g.y + Math.sin(g.facing) * 15);
      ctx.stroke();
      // suspicion arc
      if (g.suspicion > 2) {
        ctx.strokeStyle = g.suspicion > 70 ? '#ff4040' : '#ff9a2a';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(g.x, g.y, 17, -Math.PI / 2, -Math.PI / 2 + (g.suspicion / 100) * TAU);
        ctx.stroke();
      }
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(g.name, g.x, g.y - 22);
      ctx.textAlign = 'left';
      if (g.mark) {
        ctx.fillStyle = g.mark === '!' ? '#ff4040' : '#ffd76a';
        ctx.font = 'bold 22px Georgia, serif';
        ctx.textAlign = 'center';
        ctx.fillText(g.mark, g.x, g.y - 36);
        ctx.textAlign = 'left';
      }
      if (g.bubble) {
        ctx.font = '11px monospace';
        const w = ctx.measureText(g.bubble.text).width + 14;
        const bx = g.x - w / 2, by = g.y - 62;
        ctx.fillStyle = '#f5efdc';
        ctx.beginPath();
        ctx.roundRect(bx, by, w, 20, 5);
        ctx.fill();
        ctx.fillStyle = '#14101c';
        ctx.textAlign = 'center';
        ctx.fillText(g.bubble.text, g.x, by + 14);
        ctx.textAlign = 'left';
      }
    }
  }

  drawCameras(game) {
    const ctx = this.ctx;
    for (const c of game.cameras) {
      ctx.fillStyle = c.disabled > 0 ? '#777' : c.spotted ? '#ff4040' : '#c9c9c9';
      ctx.beginPath(); ctx.arc(c.x, c.y, 8, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#14101c';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.strokeStyle = c.disabled > 0 ? '#777' : '#ff4040';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(c.x, c.y);
      ctx.lineTo(c.x + Math.cos(c.angle) * 16, c.y + Math.sin(c.angle) * 16);
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(c.disabled > 0 ? c.name + ' — OFF ' + Math.ceil(c.disabled) + 's' : c.name, c.x, c.y - 14);
      ctx.textAlign = 'left';
    }
  }

  drawPebbles(game) {
    const ctx = this.ctx;
    for (const pb of game.pebbles) {
      const maxR = 46 * (1 - pb.t / 1.4);
      ctx.strokeStyle = 'rgba(255,215,106,' + (0.9 - pb.t * 0.5) + ')';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(pb.x, pb.y, Math.max(6, maxR), 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.arc(pb.x, pb.y, Math.max(3, maxR * 0.55), 0, TAU); ctx.stroke();
      ctx.fillStyle = '#999';
      ctx.beginPath(); ctx.arc(pb.x, pb.y, 4, 0, TAU); ctx.fill();
    }
    for (const s of game.smokes) {
      const g = ctx.createRadialGradient(s.x, s.y, 4, s.x, s.y, s.r);
      g.addColorStop(0, 'rgba(200,200,210,0.75)');
      g.addColorStop(1, 'rgba(200,200,210,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, TAU); ctx.fill();
      ctx.fillStyle = '#e8e8f0';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('SMOKE — blind ' + Math.ceil(s.t) + 's', s.x, s.y - s.r - 4);
      ctx.textAlign = 'left';
    }
  }

  drawPlayer(game) {
    const ctx = this.ctx;
    const p = game.player;
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath(); ctx.ellipse(p.x, p.y + 11, 13, 5, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#1c1426';
    ctx.beginPath(); ctx.arc(p.x, p.y, 13, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#ffd76a';
    ctx.lineWidth = 2;
    ctx.stroke();
    // hood + mask
    ctx.fillStyle = '#ffd76a';
    ctx.beginPath(); ctx.arc(p.x - 4, p.y - 2, 2.2, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(p.x + 4, p.y - 2, 2.2, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('MOTH', p.x, p.y + 26);
    ctx.fillStyle = '#ffd76a';
    ctx.font = '9px monospace';
    const vis = game.playerInSmoke() ? 'HIDDEN IN SMOKE' : game.playerInBush() ? 'HIDDEN IN FERNS' : game.playerInLight() ? 'IN THE LIGHT' : 'IN SHADOW';
    ctx.fillText(vis, p.x, p.y + 37);
    ctx.textAlign = 'left';
  }

  drawCallouts(game) {
    if (game.screen !== 'play') return;
    const ctx = this.ctx;
    for (const c of game.level().callouts) {
      ctx.strokeStyle = 'rgba(255,215,106,0.8)';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(c.lx, c.ly); ctx.lineTo(c.ax, c.ay); ctx.stroke();
      ctx.fillStyle = '#ffd76a';
      ctx.beginPath(); ctx.arc(c.ax, c.ay, 3.5, 0, TAU); ctx.fill();
      ctx.font = 'bold 11px monospace';
      const w = ctx.measureText(c.text).width + 16;
      const bx = clamp(c.lx - 8, FIELD.x + 4, FIELD.x + FIELD.w - w - 4);
      ctx.fillStyle = 'rgba(20,16,28,0.88)';
      ctx.beginPath(); ctx.roundRect(bx, c.ly - 16, w, 22, 4); ctx.fill();
      ctx.strokeStyle = '#c9a227';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = '#ffe9a8';
      ctx.fillText(c.text, bx + 8, c.ly - 1);
    }
  }

  drawLighting(game) {
    const ctx = this.ctx;
    const lc = this.lctx;
    lc.clearRect(0, 0, FIELD.w, FIELD.h);
    lc.globalCompositeOperation = 'source-over';
    lc.fillStyle = 'rgba(4,6,18,0.5)';
    lc.fillRect(0, 0, FIELD.w, FIELD.h);
    lc.globalCompositeOperation = 'destination-out';
    const hole = (x, y, r, a) => {
      const g = lc.createRadialGradient(x - FIELD.x, y - FIELD.y, 4, x - FIELD.x, y - FIELD.y, r);
      g.addColorStop(0, 'rgba(0,0,0,' + a + ')');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      lc.fillStyle = g;
      lc.beginPath(); lc.arc(x - FIELD.x, y - FIELD.y, r, 0, TAU); lc.fill();
    };
    for (const l of game.level().lamps) hole(l.x, l.y, l.r, 0.95);
    const L = game.level();
    if (!L.mainLoot.taken) hole(L.mainLoot.x, L.mainLoot.y, 60, 0.7);
    hole(game.player.x, game.player.y, 66, 0.55);
    if (game.exitOpen) hole(L.exit.x + 22, L.exit.y + 26, 70, 0.8);
    ctx.drawImage(this.light, FIELD.x, FIELD.y);
  }

  // ---------- HUD side panel ----------
  drawHUD(game) {
    const ctx = this.ctx;
    const L = game.level();
    const P = PANEL;
    ctx.fillStyle = '#14101c';
    ctx.fillRect(P.x, P.y, P.w, P.h);
    ctx.strokeStyle = '#c9a227';
    ctx.lineWidth = 2;
    ctx.strokeRect(P.x, P.y, P.w, P.h);
    let y = P.y + 10;
    const x = P.x + 12;
    const w = P.w - 24;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#f2d06b';
    ctx.font = 'bold 18px Georgia, serif';
    ctx.fillText('VELVET HEIST', x, y + 14);
    ctx.fillStyle = '#c9a227';
    ctx.font = 'bold 10px monospace';
    ctx.fillText('5 HEISTS · 14 GUARDS · 26 TREASURES · 3 GADGETS', x, y + 30);
    y += 40;
    ctx.strokeStyle = 'rgba(201,162,39,0.5)';
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w, y); ctx.stroke();
    y += 8;
    // job
    ctx.fillStyle = '#e8e2d0';
    ctx.font = 'bold 13px monospace';
    ctx.fillText(L.name, x, y + 12);
    ctx.fillStyle = '#9fb2d8';
    ctx.font = '11px monospace';
    ctx.fillText(L.room + '  ·  PAR ' + fmtTime(L.par), x, y + 28);
    y += 36;
    // detection
    const stateCol = game.state === 'ALARM' ? '#ff4040' : game.state === 'SUSPICIOUS' ? '#ff9a2a' : '#7fe07f';
    ctx.fillStyle = '#8a8578';
    ctx.font = 'bold 10px monospace';
    ctx.fillText('DETECTION', x, y + 10);
    ctx.fillStyle = stateCol;
    ctx.font = 'bold 16px monospace';
    ctx.fillText(game.state, x + 96, y + 10);
    y += 20;
    // alarm meter
    ctx.fillStyle = '#8a8578';
    ctx.font = 'bold 10px monospace';
    ctx.fillText('ALARM', x, y + 10);
    ctx.fillStyle = '#2a2233';
    ctx.fillRect(x + 96, y, 170, 13);
    const ag = ctx.createLinearGradient(x + 96, 0, x + 266, 0);
    ag.addColorStop(0, '#7fe07f'); ag.addColorStop(0.5, '#ff9a2a'); ag.addColorStop(1, '#ff4040');
    ctx.fillStyle = ag;
    ctx.fillRect(x + 96, y, 170 * clamp(game.alarm / 100, 0, 1), 13);
    ctx.strokeStyle = '#c9a227';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 96, y, 170, 13);
    ctx.fillStyle = '#e8e2d0';
    ctx.font = 'bold 11px monospace';
    ctx.fillText(Math.round(game.alarm) + '%', x + 272, y + 11);
    y += 22;
    // visibility / noise
    const vis = game.playerInSmoke() ? 'HIDDEN IN SMOKE' : game.playerInBush() ? 'HIDDEN IN FERNS' : game.playerInLight() ? 'IN THE LIGHT' : 'IN SHADOW';
    const visCol = vis.indexOf('HIDDEN') === 0 ? '#7fe07f' : vis === 'IN THE LIGHT' ? '#ff9a2a' : '#9fb2d8';
    ctx.fillStyle = '#8a8578';
    ctx.font = 'bold 10px monospace';
    ctx.fillText('VISIBILITY', x, y + 10);
    ctx.fillStyle = visCol;
    ctx.font = 'bold 11px monospace';
    ctx.fillText(vis, x + 96, y + 10);
    y += 16;
    ctx.fillStyle = '#8a8578';
    ctx.font = 'bold 10px monospace';
    ctx.fillText('NOISE', x, y + 10);
    ctx.fillStyle = game.noise > 0.5 ? '#ff9a2a' : '#7fe07f';
    ctx.font = 'bold 11px monospace';
    ctx.fillText(game.player.running ? 'LOUD — RUNNING' : game.noise > 0 ? 'HEARD — PEBBLE THROWN' : 'SILENT', x + 96, y + 10);
    y += 20;
    // loot
    const totalLoot = 1 + L.loot.length;
    ctx.fillStyle = '#8a8578';
    ctx.font = 'bold 10px monospace';
    ctx.fillText('LOOT', x, y + 10);
    ctx.fillStyle = '#ffd76a';
    ctx.font = 'bold 12px monospace';
    ctx.fillText(game.lootTaken + ' / ' + totalLoot + '   ' + fmtMoney(game.valueTaken), x + 96, y + 10);
    y += 16;
    ctx.fillStyle = '#c9a227';
    ctx.font = '11px monospace';
    ctx.fillText('TARGET: ' + (L.mainLoot.taken ? '✓ ' : '○ ') + L.mainLoot.name, x, y + 10);
    y += 20;
    // gadgets
    ctx.fillStyle = '#8a8578';
    ctx.font = 'bold 10px monospace';
    ctx.fillText('GADGETS', x, y + 10);
    y += 16;
    const gad = [
      ['PEBBLE ×' + game.gadgets.pebble, 'CLICK throw — pulls a guard'],
      ['SMOKE ×' + game.gadgets.smoke, 'SPACE — blinds cones 6s'],
      ['EMP ×' + game.gadgets.emp, 'E — cameras off 8s'],
    ];
    for (const [g, d] of gad) {
      ctx.fillStyle = '#ffd76a';
      ctx.font = 'bold 12px monospace';
      ctx.fillText(g, x, y + 10);
      ctx.fillStyle = '#9fb2d8';
      ctx.font = '10px monospace';
      ctx.fillText(d, x + 96, y + 10);
      y += 15;
    }
    y += 4;
    // spotted / time / close calls
    ctx.fillStyle = '#8a8578';
    ctx.font = 'bold 10px monospace';
    ctx.fillText('SPOTTED', x, y + 10);
    ctx.fillStyle = game.spotted ? '#ff4040' : '#7fe07f';
    ctx.font = 'bold 12px monospace';
    ctx.fillText(String(game.spotted), x + 96, y + 10);
    ctx.fillStyle = '#8a8578';
    ctx.font = 'bold 10px monospace';
    ctx.fillText('TIME', x + 170, y + 10);
    ctx.fillStyle = '#e8e2d0';
    ctx.font = 'bold 12px monospace';
    ctx.fillText(fmtTime(game.time), x + 216, y + 10);
    y += 16;
    ctx.fillStyle = '#8a8578';
    ctx.font = 'bold 10px monospace';
    ctx.fillText('CLOSE CALLS', x, y + 10);
    ctx.fillStyle = '#e8e2d0';
    ctx.font = 'bold 12px monospace';
    ctx.fillText(String(game.closeCalls), x + 96, y + 10);
    y += 20;
    // goal
    ctx.fillStyle = '#8a8578';
    ctx.font = 'bold 10px monospace';
    ctx.fillText('GOAL', x, y + 10);
    ctx.fillStyle = '#e8e2d0';
    ctx.font = '11px monospace';
    y = wrapText(ctx, L.objective, x, y + 24, w, 14) + 2;
    y += 8;
    ctx.strokeStyle = 'rgba(201,162,39,0.5)';
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w, y); ctx.stroke();
    y += 8;
    // legend
    ctx.fillStyle = '#8a8578';
    ctx.font = 'bold 10px monospace';
    ctx.fillText('LEGEND', x, y + 10);
    y += 16;
    const legend = [
      ['#ffd76a', 'Vision cone — guard sightline'],
      ['#ff5a5a', 'Camera sweep — seen = alarm'],
      ['#ff4040', 'Laser grid — crossing = +alarm'],
      ['#ffd76a', '◆ Loot — gold glow, named value'],
      ['#2f6b35', 'Fern bed — hide here, unseen'],
      ['#ffd76a', 'Lamp pool — light exposes you'],
    ];
    for (const [c, t] of legend) {
      ctx.fillStyle = c;
      ctx.fillRect(x, y + 1, 10, 10);
      ctx.fillStyle = '#c9c9c9';
      ctx.font = '10px monospace';
      ctx.fillText(t, x + 16, y + 10);
      y += 13;
    }
    y += 4;
    // controls
    ctx.fillStyle = '#8a8578';
    ctx.font = 'bold 10px monospace';
    ctx.fillText('CONTROLS', x, y + 10);
    y += 16;
    const controls = [
      'WASD / ARROWS — move MOTH',
      'SHIFT — run (loud)',
      'MOUSE CLICK — throw pebble',
      'SPACE — smoke bomb',
      'E — EMP burst',
      'J — job board',
    ];
    ctx.fillStyle = '#c9c9c9';
    ctx.font = '10px monospace';
    for (const c of controls) { ctx.fillText(c, x, y + 10); y += 12; }
    y += 2;
    // minimap
    this.drawMinimap(game, x, y, w);
  }

  drawMinimap(game, x, y, w) {
    const ctx = this.ctx;
    const mw = w, mh = 64;
    const sx = mw / FIELD.w, sy = mh / FIELD.h;
    ctx.fillStyle = '#0b0a12';
    ctx.fillRect(x, y, mw, mh);
    ctx.strokeStyle = '#c9a227';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, mw, mh);
    const L = game.level();
    ctx.fillStyle = 'rgba(201,162,39,0.25)';
    for (const wl of L.walls) ctx.fillRect(x + wl.x * sx, y + wl.y * sy, wl.w * sx, wl.h * sy);
    ctx.fillStyle = '#ffd76a';
    if (!L.mainLoot.taken) { ctx.beginPath(); ctx.arc(x + L.mainLoot.x * sx, y + L.mainLoot.y * sy, 3.5, 0, TAU); ctx.fill(); }
    for (const t of L.loot) {
      if (!t.taken) { ctx.fillStyle = '#c9a227'; ctx.beginPath(); ctx.arc(x + t.x * sx, y + t.y * sy, 2.5, 0, TAU); ctx.fill(); }
    }
    ctx.fillStyle = '#1d7a34';
    ctx.fillRect(x + L.exit.x * sx, y + L.exit.y * sy, 6, 6);
    for (const g of game.guards) {
      ctx.fillStyle = g.mode === 'chase' ? '#ff4040' : g.color;
      ctx.beginPath(); ctx.arc(x + g.x * sx, y + g.y * sy, 3, 0, TAU); ctx.fill();
    }
    // route
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    game.route.forEach((pt, i) => {
      const rx = x + pt.x * sx, ry = y + pt.y * sy;
      if (i === 0) ctx.moveTo(rx, ry); else ctx.lineTo(rx, ry);
    });
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(x + game.player.x * sx, y + game.player.y * sy, 4, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#ffd76a';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#8a8578';
    ctx.font = 'bold 9px monospace';
    ctx.fillText('MINIMAP — your route in white', x, y + mh + 11);
  }

  drawBanner(game) {
    const ctx = this.ctx;
    const b = game.banner;
    ctx.font = 'bold 15px monospace';
    const w = ctx.measureText(b.text).width + 36;
    const bx = (W - w) / 2, by = FIELD.y + FIELD.h - 40;
    ctx.fillStyle = b.text.indexOf('SPOTTED') === 0 ? 'rgba(160,20,20,0.92)' : 'rgba(20,16,28,0.92)';
    ctx.beginPath(); ctx.roundRect(bx, by, w, 30, 6); ctx.fill();
    ctx.strokeStyle = '#ffd76a';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#ffe9a8';
    ctx.textAlign = 'center';
    ctx.fillText(b.text, W / 2, by + 20);
    ctx.textAlign = 'left';
  }

  // ---------- job board ----------
  drawBoard(game) {
    const ctx = this.ctx;
    const cx = FIELD.x + 44, cy = FIELD.y + 30, cw = FIELD.w - 88, ch = FIELD.h - 60;
    ctx.fillStyle = 'rgba(16,12,26,0.94)';
    ctx.beginPath(); ctx.roundRect(cx, cy, cw, ch, 10); ctx.fill();
    ctx.strokeStyle = '#c9a227';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#f2d06b';
    ctx.font = 'bold 30px Georgia, serif';
    ctx.fillText('VELVET HEIST', cx + cw / 2, cy + 48);
    ctx.fillStyle = '#c9a227';
    ctx.font = 'bold 13px monospace';
    ctx.fillText('5 HEISTS  ·  14 GUARDS  ·  26 TREASURES  ·  3 GADGETS  ·  ONE THIEF: MOTH', cx + cw / 2, cy + 72);
    ctx.fillStyle = '#e8e2d0';
    ctx.font = '12px monospace';
    ctx.fillText('Pick a job. Steal the target. Reach the getaway door. Never get spotted.', cx + cw / 2, cy + 94);
    let y = cy + 118;
    const cardH = 76;
    LEVELS.forEach((L, i) => {
      const done = game.completed[i];
      const locked = i > 0 && !game.completed[i - 1];
      ctx.fillStyle = locked ? 'rgba(40,36,52,0.8)' : 'rgba(42,32,58,0.9)';
      ctx.beginPath(); ctx.roundRect(cx + 24, y, cw - 48, cardH, 8); ctx.fill();
      ctx.strokeStyle = done ? '#7fe07f' : locked ? '#555' : '#c9a227';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.textAlign = 'left';
      ctx.fillStyle = done ? '#7fe07f' : locked ? '#888' : '#f2d06b';
      ctx.font = 'bold 15px monospace';
      ctx.fillText(L.name, cx + 44, y + 24);
      ctx.fillStyle = '#9fb2d8';
      ctx.font = '12px monospace';
      ctx.fillText(L.room + '  ·  ' + L.guards.length + ' guards  ·  ' + (1 + L.loot.length) + ' treasures  ·  ' + fmtMoney(L.mainLoot.value + L.loot.reduce((m, t) => m + t.value, 0)), cx + 44, y + 44);
      ctx.fillStyle = '#e8e2d0';
      ctx.font = '11px monospace';
      ctx.fillText('TARGET: ' + L.mainLoot.name + '  —  ' + L.objective, cx + 44, y + 62);
      ctx.textAlign = 'right';
      ctx.fillStyle = done ? '#7fe07f' : locked ? '#888' : '#ffd76a';
      ctx.font = 'bold 13px monospace';
      const stars = game.levelRatings[i] || 0;
      ctx.fillText(done ? 'DONE  ' + '★'.repeat(stars) + '☆'.repeat(3 - stars) : locked ? '🔒 LOCKED' : '▶  PRESS ' + (i + 1), cx + cw - 44, y + 34);
      ctx.textAlign = 'left';
      y += cardH + 10;
    });
    ctx.textAlign = 'center';
    ctx.fillStyle = '#8a8578';
    ctx.font = '11px monospace';
    ctx.fillText('Keys 1–5 start a job  ·  WASD move  ·  CLICK throw pebble  ·  SPACE smoke  ·  E EMP  ·  J board', cx + cw / 2, cy + ch - 16);
    ctx.textAlign = 'left';
  }

  // ---------- results ----------
  drawResults(game) {
    const ctx = this.ctx;
    const r = game.results;
    const L = game.level();
    const cx = FIELD.x + 30, cy = FIELD.y + 18, cw = FIELD.w - 60, ch = FIELD.h - 36;
    ctx.fillStyle = 'rgba(16,12,26,0.95)';
    ctx.beginPath(); ctx.roundRect(cx, cy, cw, ch, 10); ctx.fill();
    ctx.strokeStyle = '#c9a227';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#7fe07f';
    ctx.font = 'bold 30px Georgia, serif';
    ctx.fillText('GETAWAY CLEAN', cx + cw / 2, cy + 46);
    ctx.fillStyle = '#f2d06b';
    ctx.font = 'bold 14px monospace';
    ctx.fillText(r.job + ' — ' + r.room, cx + cw / 2, cy + 70);
    // route replay map (left)
    const mx = cx + 24, my = cy + 88, mw = 400, mh = 300;
    ctx.fillStyle = '#0b0a12';
    ctx.fillRect(mx, my, mw, mh);
    ctx.strokeStyle = '#c9a227';
    ctx.lineWidth = 1;
    ctx.strokeRect(mx, my, mw, mh);
    const sx = mw / FIELD.w, sy = mh / FIELD.h;
    ctx.fillStyle = 'rgba(201,162,39,0.3)';
    for (const wl of L.walls) ctx.fillRect(mx + wl.x * sx, my + wl.y * sy, wl.w * sx, wl.h * sy);
    ctx.fillStyle = '#2f6b35';
    for (const b of L.bushes) ctx.fillRect(mx + b.x * sx, my + b.y * sy, b.w * sx, b.h * sy);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    r.route.forEach((pt, i) => {
      const rx = mx + pt.x * sx, ry = my + pt.y * sy;
      if (i === 0) ctx.moveTo(rx, ry); else ctx.lineTo(rx, ry);
    });
    ctx.stroke();
    const s0 = r.route[0], s1 = r.route[r.route.length - 1];
    ctx.fillStyle = '#7fe07f';
    ctx.beginPath(); ctx.arc(mx + s0.x * sx, my + s0.y * sy, 6, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ffd76a';
    ctx.beginPath(); ctx.arc(mx + s1.x * sx, my + s1.y * sy, 6, 0, TAU); ctx.fill();
    ctx.fillStyle = '#8a8578';
    ctx.font = 'bold 10px monospace';
    ctx.fillText('ROUTE REPLAY — your path through ' + r.room, mx + mw / 2, my + mh + 16);
    // stats (right)
    const sx0 = mx + mw + 28;
    ctx.textAlign = 'left';
    const stats = [
      ['TIME', fmtTime(r.time) + '  (par ' + fmtTime(L.par) + ')'],
      ['TIMES SPOTTED', String(r.spotted)],
      ['CLOSE CALLS', String(r.closeCalls)],
      ['GADGETS USED', String(r.gadgetsUsed)],
      ['VALUABLES', r.loot + ' / ' + r.lootTotal],
      ['TAKE', fmtMoney(r.value)],
    ];
    let sy2 = my + 8;
    for (const [k, v] of stats) {
      ctx.fillStyle = '#8a8578';
      ctx.font = 'bold 11px monospace';
      ctx.fillText(k, sx0, sy2 + 12);
      ctx.fillStyle = '#e8e2d0';
      ctx.font = 'bold 14px monospace';
      ctx.fillText(v, sx0 + 130, sy2 + 12);
      sy2 += 26;
    }
    sy2 += 10;
    // medals
    ctx.fillStyle = '#8a8578';
    ctx.font = 'bold 11px monospace';
    ctx.fillText('MEDALS', sx0, sy2 + 10);
    sy2 += 22;
    const medals = [
      ['NEVER SPOTTED', r.medals.ghost],
      ['EVERY TREASURE', r.medals.clean],
      ['UNDER ' + L.par + 's', r.medals.fast],
    ];
    for (const [m, got] of medals) {
      ctx.fillStyle = got ? '#ffd76a' : '#555';
      ctx.font = 'bold 13px monospace';
      ctx.fillText((got ? '★ ' : '☆ ') + m, sx0, sy2 + 12);
      sy2 += 20;
    }
    sy2 += 12;
    ctx.fillStyle = '#f2d06b';
    ctx.font = 'bold 16px Georgia, serif';
    ctx.fillText('★'.repeat(r.stars) + '☆'.repeat(3 - r.stars), sx0, sy2 + 12);
    sy2 += 26;
    ctx.fillStyle = '#e8e2d0';
    ctx.font = 'italic 13px Georgia, serif';
    ctx.fillText(r.ghostText, sx0, sy2 + 12);
    sy2 += 30;
    // take breakdown — every treasure carried out
    ctx.fillStyle = '#8a8578';
    ctx.font = 'bold 11px monospace';
    ctx.fillText('TAKE — WHAT YOU CARRIED OUT', sx0, sy2 + 10);
    sy2 += 18;
    const taken = [L.mainLoot].concat(L.loot).filter((t) => t.taken);
    ctx.font = '11px monospace';
    for (const t of taken) {
      ctx.fillStyle = '#ffd76a';
      ctx.fillText('◆ ' + t.name, sx0, sy2 + 10);
      ctx.fillStyle = '#e8e2d0';
      ctx.textAlign = 'right';
      ctx.fillText(fmtMoney(t.value), sx0 + 300, sy2 + 10);
      ctx.textAlign = 'left';
      sy2 += 15;
    }
    // bottom buttons
    ctx.textAlign = 'center';
    ctx.fillStyle = '#c9a227';
    ctx.font = 'bold 13px monospace';
    const next = game.levelIndex + 1 < LEVELS.length
      ? 'NEXT JOB: ' + LEVELS[game.levelIndex + 1].name + '  —  press N'
      : 'ALL 5 JOBS DONE — you are a legend';
    ctx.fillText(next, cx + cw / 2, cy + ch - 36);
    ctx.fillStyle = '#8a8578';
    ctx.font = '11px monospace';
    ctx.fillText('press J for job board    ·    press R to replay this job', cx + cw / 2, cy + ch - 16);
    ctx.textAlign = 'left';
  }

  drawCaught(game) {
    const ctx = this.ctx;
    const cx = FIELD.x + 120, cy = FIELD.y + 200, cw = FIELD.w - 240, ch = 220;
    ctx.fillStyle = 'rgba(40,8,12,0.95)';
    ctx.beginPath(); ctx.roundRect(cx, cy, cw, ch, 10); ctx.fill();
    ctx.strokeStyle = '#ff4040';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff4040';
    ctx.font = 'bold 34px Georgia, serif';
    ctx.fillText('CAUGHT!', cx + cw / 2, cy + 60);
    ctx.fillStyle = '#e8e2d0';
    ctx.font = '14px monospace';
    ctx.fillText('Caught by ' + game.caughtBy + ' in ' + game.level().room + '.', cx + cw / 2, cy + 96);
    ctx.fillText('The alarm was faster than your feet.', cx + cw / 2, cy + 120);
    ctx.fillStyle = '#ffd76a';
    ctx.font = 'bold 13px monospace';
    ctx.fillText('Press R to retry this job  ·  J for the job board', cx + cw / 2, cy + 164);
    ctx.textAlign = 'left';
  }
}
