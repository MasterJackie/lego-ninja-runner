/* =========================================================
 * game.js —— 神庙逃亡式三车道伪 3D 跑酷主循环
 * ========================================================= */

class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = true;

    this.state = 'menu';
    this.kind = 'water';
    this.best = Number(localStorage.getItem('lnr_best') || 0);

    this.bg = new Image();
    this.bg.src = 'assets/bg.jpg';
    this.bgLoaded = false;
    this.bg.onload = () => { this.bgLoaded = true; };
    this.bg.onerror = () => { this.bgLoaded = false; };

    this.resetRun();
    this.bindInput();
    this.last = performance.now();
    this.acc = 0;
    this.step = 1000 / 60;

    requestAnimationFrame((t) => this.loop(t));
  }

  resetRun() {
    this.player = new Player(this.kind);
    this.obstacles = [];
    this.pickups = [];
    this.particles = [];
    this.fireballs = [];
    this.speed = CFG.speedBase;
    this.distance = 0;
    this.score = 0;
    this.coins = 0;
    this.lives = 3;
    this.spawnGap = 360;     // z 间距
    this.sinceSpawn = 400;   // 起步先空一段
    this.scrollZ = 0;
    this.flashAmt = 0;
    this.flashColor = '#fff';
    this.shake = 0;
  }

  start() { this.resetRun(); this.state = 'playing'; }

  /* ---------------- 输入 ---------------- */
  bindInput() {
    this.keys = new Set();
    this.pressed = new Set();
    // 用 e.code 规范化键位：不受输入法（中文/IME）影响，空格始终是 Space
    const CODE_MAP = {
      Space: ' ',
      ArrowUp: 'arrowup', ArrowDown: 'arrowdown', ArrowLeft: 'arrowleft', ArrowRight: 'arrowright',
      KeyW: 'w', KeyA: 'a', KeyS: 's', KeyD: 'd',
      KeyJ: 'j', KeyK: 'k',
      ShiftLeft: 'shift', ShiftRight: 'shift',
      Enter: 'enter',
    };
    const normKey = (e) => CODE_MAP[e.code] || e.key.toLowerCase();

    window.addEventListener('keydown', (e) => {
      const k = normKey(e);
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
      if (!this.keys.has(k)) this.pressed.add(k);
      this.keys.add(k);
      if (this.state === 'menu' && (k === 'enter' || k === ' ')) this.start();
      if (this.state === 'gameover' && (k === 'enter' || k === ' ')) this.start();
    });
    window.addEventListener('keyup', (e) => { this.keys.delete(normKey(e)); });
    window.__game = this;

    // 触屏滑动（移动端）
    let tx = 0, ty = 0, lastTap = 0;
    this.canvas.addEventListener('touchstart', (e) => {
      const t = e.touches[0]; tx = t.clientX; ty = t.clientY;
    }, { passive: true });
    this.canvas.addEventListener('touchend', (e) => {
      const t = e.changedTouches[0];
      const dx = t.clientX - tx, dy = t.clientY - ty;
      const now = performance.now();
      if (Math.abs(dx) < 18 && Math.abs(dy) < 18) {
        // 双击释放技能
        if (now - lastTap < 300) this.pressed.add('shift');
        lastTap = now;
        return;
      }
      if (Math.abs(dx) > Math.abs(dy)) this.pressed.add(dx < 0 ? 'arrowleft' : 'arrowright');
      else this.pressed.add(dy < 0 ? 'arrowup' : 'arrowdown');
    }, { passive: true });
  }

  get input() {
    const p = this.pressed;
    return {
      leftPressed: p.has('arrowleft') || p.has('a'),
      rightPressed: p.has('arrowright') || p.has('d'),
      jumpPressed: p.has('arrowup') || p.has('w') || p.has(' '),
      slidePressed: p.has('arrowdown') || p.has('s'),
      skillPressed: p.has('shift') || p.has('j') || p.has('k'),
    };
  }

  /* ---------------- 粒子（世界坐标 → 屏幕） ---------------- */
  worldToScreen(worldX, z, y) { return project(worldX, z, y); }
  spawnDust(worldX, z, y, kind) {
    const s = this.worldToScreen(worldX, z, y);
    const n = 6;
    for (let i = 0; i < n; i++) {
      this.particles.push(new Particle(
        s.sx + (Math.random() - 0.5) * 20, s.sy,
        (Math.random() - 0.5) * 3, -Math.random() * 2 - 0.5,
        18 + Math.random() * 10, kind === 'water' ? '#cfe8ff' : '#ffd9a0',
        3 + Math.random() * 2, 'dust'));
    }
  }
  spawnIce(worldX, z, y) {
    const s = this.worldToScreen(worldX, z, y);
    for (let i = 0; i < 2; i++) {
      this.particles.push(new Particle(
        s.sx - 10 - Math.random() * 30, s.sy - 10 - Math.random() * 40,
        -this.speed * 0.3 - Math.random(), (Math.random() - 0.5) * 1.5,
        26 + Math.random() * 18, '#bfe9ff', 3 + Math.random() * 3, 'ice'));
    }
  }
  spawnFireball(worldX, z, y) {
    this.fireballs.push(new Fireball(worldX, z, y));
    const s = this.worldToScreen(worldX, z, y);
    for (let i = 0; i < 14; i++) {
      this.particles.push(new Particle(s.sx, s.sy,
        (Math.random() - 0.3) * 5, (Math.random() - 0.5) * 5,
        22 + Math.random() * 14, i % 2 ? '#ff8a3c' : '#ffd166',
        3 + Math.random() * 3, 'spark'));
    }
  }
  flash(color, amt) { this.flashColor = color; this.flashAmt = amt; }
  onLaneChange() { /* 可接音效 */ }

  /* ---------------- 生成波次 ---------------- */
  spawnWave() {
    const z = CFG.spawnZ;
    const r = Math.random();
    if (r < 0.22) {
      // 全车道跳跃（必须跳）
      this.obstacles.push(new Obstacle('jump', [0, 1, 2], z));
    } else if (r < 0.40) {
      // 全车道滑铲（必须滑）
      this.obstacles.push(new Obstacle('slide', [0, 1, 2], z));
    } else if (r < 0.62) {
      // 单车道障碍（随机类型），其它车道放金币
      const l = Math.floor(Math.random() * 3);
      const kinds = ['jump', 'slide', 'block'];
      this.obstacles.push(new Obstacle(kinds[Math.floor(Math.random() * kinds.length)], [l], z));
      this.coinLine(z + 60, (l + 1) % 3, 0);
      this.coinLine(z + 60, (l + 2) % 3, 0);
    } else if (r < 0.82) {
      // 两条车道堵死，留一条
      const open = Math.floor(Math.random() * 3);
      const blocked = [0, 1, 2].filter((x) => x !== open);
      this.obstacles.push(new Obstacle(Math.random() < 0.5 ? 'jump' : 'block', blocked, z));
      this.coinLine(z + 40, open, 0);
    } else {
      // 奖励波：金币弧（需跳跃收集）+ 宝石
      const l = Math.floor(Math.random() * 3);
      this.coinArc(z, l);
      if (Math.random() < 0.4) this.pickups.push(new Pickup('gem', (l + 1) % 3, z + 60, 30));
      if (Math.random() < 0.12) this.pickups.push(new Pickup('heart', (l + 2) % 3, z + 30, 40));
    }
  }
  coinLine(z, lane, y) {
    for (let i = 0; i < 4; i++) this.pickups.push(new Pickup('coin', lane, z + i * 34, y));
  }
  coinArc(z, lane) {
    for (let i = 0; i < 6; i++) {
      const t = i / 5;
      const y = 90 * Math.sin(t * Math.PI); // 抛物线弧
      this.pickups.push(new Pickup('coin', lane, z + i * 30, y));
    }
  }

  /* ---------------- 更新 ---------------- */
  update() {
    if (this.state !== 'playing') return;
    const input = this.input;
    this.pressed.clear();

    this.speed = Math.min(CFG.speedMax, this.speed + CFG.speedRamp);
    this.distance += this.speed;
    this.scrollZ += this.speed;
    this.score = Math.floor(this.distance / 12) + this.coins * 10;

    this.player.update(input, this);
    if (input.skillPressed) this.player.useSkill(this);

    // 火球：焚毁前方（z <= 火球 z）的所有障碍
    for (const fb of this.fireballs) {
      fb.update();
      for (const o of this.obstacles) {
        if (!o.dead && o.z <= fb.z && o.z > CFG.playerZ - 20) {
          o.dead = true; this.score += 5;
          this.explodeWorld(o.lanes[0], o.z, 60, '#ff8a3c');
        }
      }
    }
    this.fireballs = this.fireballs.filter((f) => !f.dead);

    // 障碍
    this.sinceSpawn += this.speed;
    if (this.sinceSpawn >= this.spawnGap) {
      this.spawnWave();
      this.sinceSpawn = 0;
      this.spawnGap = Math.max(230, 420 - this.speed * 6);
    }
    for (const o of this.obstacles) o.update(this.speed);

    // 拾取
    for (const p of this.pickups) p.update(this.speed);

    // 碰撞：拾取
    for (const p of this.pickups) {
      if (p.dead) continue;
      if (p.collect(this.player)) {
        p.dead = true;
        if (p.type === 'coin') this.coins++;
        else if (p.type === 'gem') { this.coins += 5; this.flash('#1abc9c', 0.2); }
        else if (p.type === 'heart') { this.lives = Math.min(3, this.lives + 1); this.flash('#e74c3c', 0.25); }
        const s = project(laneX(p.lane), p.z, p.y);
        this.burst(s.sx, s.sy, p.type === 'coin' ? '#f1c40f' : p.type === 'gem' ? '#1abc9c' : '#e74c3c');
      }
    }

    // 碰撞：障碍
    for (const o of this.obstacles) {
      if (o.dead || o.hit) continue;
      if (!o.collides(this.player)) continue;
      o.hit = true;
      if (this.player.isInvincible()) {
        o.dead = true; this.score += 5;
        this.explodeWorld(o.lanes[0], o.z, 50, this.player.kind === 'water' ? '#bfe9ff' : '#ff8a3c');
      } else {
        this.hitObstacle(o);
      }
    }

    this.obstacles = this.obstacles.filter((o) => !o.dead);
    this.pickups = this.pickups.filter((p) => !p.dead);

    for (const pt of this.particles) pt.update();
    this.particles = this.particles.filter((p) => !p.dead);

    this.flashAmt *= 0.9;
    this.shake *= 0.85;
  }

  hitObstacle(o) {
    this.lives--;
    this.player.invuln = CFG.invulnFrames;
    this.shake = 10;
    this.flash('#ffffff', 0.4);
    this.explodeWorld(this.player.laneX, 0, 40, '#ffffff');
    if (this.lives <= 0) this.gameOver();
  }
  gameOver() {
    this.state = 'gameover';
    if (this.score > this.best) { this.best = this.score; localStorage.setItem('lnr_best', String(this.best)); }
  }
  burst(x, y, color) {
    for (let i = 0; i < 10; i++) this.particles.push(new Particle(x, y,
      (Math.random() - 0.5) * 5, (Math.random() - 0.5) * 5 - 1,
      18 + Math.random() * 14, color, 2 + Math.random() * 2, 'spark'));
  }
  explodeWorld(lane, z, y, color) {
    const s = project(laneX(lane), z, y);
    for (let i = 0; i < 18; i++) this.particles.push(new Particle(s.sx, s.sy,
      (Math.random() - 0.5) * 7, (Math.random() - 0.5) * 7,
      22 + Math.random() * 18, i % 2 ? color : '#ffffff', 3 + Math.random() * 3, 'spark'));
  }

  /* ---------------- 渲染 ---------------- */
  render() {
    const ctx = this.ctx;
    ctx.save();
    if (this.shake > 0.3) ctx.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);

    this.drawBackground(ctx);
    this.drawTrack(ctx);

    // 实体按 z 降序（远→近）绘制
    const items = [];
    for (const o of this.obstacles) items.push({ z: o.z, draw: () => o.draw(ctx) });
    for (const p of this.pickups) items.push({ z: p.z, draw: () => p.draw(ctx) });
    for (const fb of this.fireballs) items.push({ z: fb.z, draw: () => fb.draw(ctx) });
    items.sort((a, b) => b.z - a.z);
    for (const it of items) it.draw();

    if (this.state !== 'menu') this.player.draw(ctx);
    for (const pt of this.particles) pt.draw(ctx);

    ctx.restore();

    if (this.flashAmt > 0.02) {
      ctx.save(); ctx.globalAlpha = this.flashAmt; ctx.fillStyle = this.flashColor;
      ctx.fillRect(0, 0, CFG.width, CFG.height); ctx.restore();
    }
    if (this.onState) this.onState(this.snapshot());
  }

  snapshot() {
    return {
      state: this.state, kind: this.kind, score: this.score, best: this.best,
      coins: this.coins, lives: this.lives, speed: this.speed,
      skillUsed: this.player ? this.player.skillUsed : false,
      skillReady: this.player ? !this.player.skillUsed : true,
      skillActive: this.player ? this.player.skillTimer > 0 : false,
      def: NINJAS[this.kind],
    };
  }

  drawBackground(ctx) {
    const g = ctx.createLinearGradient(0, 0, 0, CFG.horizonY + 40);
    g.addColorStop(0, '#5db4f0'); g.addColorStop(1, '#cfeeff');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, CFG.width, CFG.horizonY + 40);

    if (this.bgLoaded && this.bg.width > 0) {
      const drawH = CFG.horizonY + 60;
      const bw = (this.bg.width / this.bg.height) * drawH;
      const off = (this.scrollZ * 0.05) % bw;
      let x = -off;
      while (x < CFG.width) { ctx.drawImage(this.bg, x, 0, bw, drawH); x += bw; }
    }
    // 远景积木山丘贴地平线
    ctx.save();
    const moff = this.scrollZ * 0.15;
    for (let i = -1; i < 7; i++) {
      const bx = i * 220 - (moff % 220);
      this.drawLegoHill(ctx, bx, CFG.horizonY + 20, 200, 70, '#7ec96a', '#5fa84e');
    }
    ctx.restore();
  }
  drawLegoHill(ctx, x, baseY, w, h, color, dark) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, baseY);
    ctx.quadraticCurveTo(x + w / 2, baseY - h, x + w, baseY);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = dark;
    for (let i = 0; i < 5; i++) {
      const sx = x + 20 + i * (w / 6);
      const sy = baseY - Math.sin(((sx - x) / w) * Math.PI) * h * 0.85;
      stud(ctx, sx, sy, 3.5);
    }
  }

  drawTrack(ctx) {
    // 路面梯形
    const nearL = project(-CFG.laneW * 1.5, 0, 0);
    const nearR = project(CFG.laneW * 1.5, 0, 0);
    const farL = project(-CFG.laneW * 1.5, CFG.maxZ, 0);
    const farR = project(CFG.laneW * 1.5, CFG.maxZ, 0);
    ctx.fillStyle = '#3a5f3a';
    ctx.beginPath();
    ctx.moveTo(nearL.sx, nearL.sy); ctx.lineTo(nearR.sx, nearR.sy);
    ctx.lineTo(farR.sx, farR.sy); ctx.lineTo(farL.sx, farL.sy);
    ctx.closePath(); ctx.fill();

    // 滚动横带（速度感）
    const band = 70;
    const off = this.scrollZ % band;
    for (let z = -off; z < CFG.maxZ; z += band) {
      const l = project(-CFG.laneW * 1.5, z, 0);
      const r = project(CFG.laneW * 1.5, z, 0);
      const l2 = project(-CFG.laneW * 1.5, z + band * 0.5, 0);
      const r2 = project(CFG.laneW * 1.5, z + band * 0.5, 0);
      const idx = Math.floor((z + off) / band);
      ctx.fillStyle = idx % 2 ? '#416941' : '#365a36';
      ctx.beginPath();
      ctx.moveTo(l.sx, l.sy); ctx.lineTo(r.sx, r.sy);
      ctx.lineTo(r2.sx, r2.sy); ctx.lineTo(l2.sx, l2.sy);
      ctx.closePath(); ctx.fill();
    }

    // 车道分隔虚线（2 条）+ 两侧路缘
    this.drawLaneLine(ctx, -CFG.laneW * 0.5);
    this.drawLaneLine(ctx, CFG.laneW * 0.5);
    this.drawEdgeWall(ctx, -CFG.laneW * 1.5, true);
    this.drawEdgeWall(ctx, CFG.laneW * 1.5, false);
  }
  drawLaneLine(ctx, worldX) {
    const dash = 40, gap = 40, cycle = dash + gap;
    const off = this.scrollZ % cycle;
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    for (let z = -off; z < CFG.maxZ; z += cycle) {
      if (z + dash < 0) continue;
      const a = project(worldX, Math.max(0, z), 0);
      const b = project(worldX, z + dash, 0);
      const w = Math.max(1.5, 6 * a.scale);
      ctx.beginPath();
      ctx.moveTo(a.sx - w / 2, a.sy); ctx.lineTo(a.sx + w / 2, a.sy);
      ctx.lineTo(b.sx + w / 2, b.sy); ctx.lineTo(b.sx - w / 2, b.sy);
      ctx.closePath(); ctx.fill();
    }
  }
  drawEdgeWall(ctx, worldX, left) {
    // 路边乐高矮墙，用一串砖块
    const bw = 40;
    const off = this.scrollZ % bw;
    for (let z = -off; z < CFG.maxZ; z += bw) {
      if (z < 0) continue;
      const base = project(worldX, z, 0);
      const s = base.scale;
      if (s < 0.05) continue;
      ctx.save();
      ctx.translate(base.sx, base.sy);
      ctx.scale(s, s);
      ctx.fillStyle = left ? '#b96415' : '#2c3e50';
      const w = 36, h = 34;
      roundRect(ctx, -w / 2, -h, w, h, 3); ctx.fill();
      ctx.fillStyle = left ? '#8a4a0f' : '#1a252f';
      roundRect(ctx, -w / 2, -4, w, 4, 2); ctx.fill();
      stud(ctx, 0, -h + 8, 5);
      ctx.restore();
    }
  }

  loop(now) {
    let dt = now - this.last; this.last = now;
    if (dt > 100) dt = 100;
    this.acc += dt;
    while (this.acc >= this.step) { this.update(); this.acc -= this.step; }
    this.render();
    requestAnimationFrame((t) => this.loop(t));
  }
}

window.addEventListener('load', () => {
  const canvas = document.getElementById('game');
  const game = new Game(canvas);
  setupUI(game);
});
