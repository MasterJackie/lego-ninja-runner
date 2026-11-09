/* =========================================================
 * entities.js —— 伪 3D 三车道跑酷的实体与绘制
 * 世界坐标 (worldX, z, y)：worldX 横向，z 纵深(向屏幕内)，y 离地高度
 * 所有角色/障碍/拾取物均为 Canvas 原语拼出的乐高风格。
 * ========================================================= */

/* ---------------- 工具函数 ---------------- */
function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function stud(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.35, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fill();
}

// 世界坐标 → 屏幕坐标 + 缩放
function project(worldX, z, y = 0) {
  const zz = Math.max(0, z);
  const p = CFG.focal / (CFG.focal + zz); // 1 @ z=0，远→0
  const scale = p;
  const sy = CFG.horizonY + (CFG.bottomY - CFG.horizonY) * p - y * p;
  const sx = CFG.vanishX + worldX * p;
  return { sx, sy, scale };
}
const laneX = (lane) => (lane - 1) * CFG.laneW; // 0,1,2 → -120, 0, +120

/* =========================================================
 * 玩家 Player —— 三车道 + 跳跃 + 滑铲
 * ========================================================= */
class Player {
  constructor(kind) {
    this.kind = kind;
    this.def = NINJAS[kind];
    this.reset();
  }
  reset() {
    this.lane = 1;           // 目标车道 0/1/2
    this.laneX = laneX(1);   // 当前横向世界坐标（平滑插值）
    this.y = 0;              // 离地高度
    this.vy = 0;
    this.onGround = true;
    this.state = 'run';
    this.slideTimer = 0;
    this.invuln = 0;
    this.skillUsed = false;
    this.skillTimer = 0;
    this.animT = 0;
  }

  // 当前碰撞车道（用目标车道，响应更干脆）
  hitLane() { return this.lane; }

  update(input, game) {
    this.animT += 1;

    // 变道
    if (input.leftPressed && this.lane > 0) { this.lane--; game.onLaneChange(); }
    if (input.rightPressed && this.lane < CFG.lanes - 1) { this.lane++; game.onLaneChange(); }
    // 平滑插值
    const targetX = laneX(this.lane);
    this.laneX += (targetX - this.laneX) * 0.28;

    // 跳跃
    if (input.jumpPressed && this.onGround) {
      this.vy = CFG.jumpVel;
      this.onGround = false;
      this.state = 'jump';
      game.spawnDust(this.laneX, CFG.playerZ, 0, this.kind);
    }
    // 滑铲（地面才能滑；空中按↓可快速下落）
    if (input.slidePressed) {
      if (this.onGround) {
        this.state = 'slide';
        this.slideTimer = CFG.slideFrames;
        game.spawnDust(this.laneX, CFG.playerZ, 0, this.kind);
      } else {
        this.vy -= 6; // 空中速降（y 向上为正，vy 减小=下落更快）
      }
    }
    if (this.state === 'slide') {
      this.slideTimer--;
      if (this.slideTimer <= 0) this.state = 'run';
    }

    // 重力（y 向上为正：vy 逐帧减小，达到顶点后下落）
    if (!this.onGround) {
      this.vy -= CFG.gravity;
      this.y += this.vy;
      if (this.y <= 0) {
        this.y = 0; this.vy = 0; this.onGround = true; this.state = 'run';
        game.spawnDust(this.laneX, CFG.playerZ, 0, this.kind);
      }
    }

    if (this.invuln > 0) this.invuln--;
    if (this.skillTimer > 0) {
      this.skillTimer--;
      if (this.kind === 'water' && this.animT % 2 === 0) game.spawnIce(this.laneX, CFG.playerZ, this.y);
    }
  }

  isInvincible() { return this.invuln > 0 || this.skillTimer > 0; }
  isJumping() { return !this.onGround && this.y > CFG.jumpClearY; }
  isSliding() { return this.state === 'slide'; }

  useSkill(game) {
    if (this.skillUsed) return false;
    this.skillUsed = true;
    if (this.kind === 'water') {
      this.skillTimer = this.def.skillFrames;
      game.flash('#bfe9ff', 0.35);
    } else {
      game.spawnFireball(this.laneX, CFG.playerZ, 40);
      game.flash('#ffb347', 0.3);
    }
    return true;
  }

  draw(ctx) {
    const proj = project(this.laneX, CFG.playerZ, this.y);
    const s = proj.scale * 1.05;

    // 地面阴影（随高度缩小变淡，强化腾空感）
    const sh = project(this.laneX, CFG.playerZ, 0);
    const shScale = Math.max(0.35, 1 - this.y * 0.0045);
    ctx.save();
    ctx.globalAlpha = Math.max(0.12, 0.5 - this.y * 0.0028);
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(sh.sx, sh.sy, 34 * sh.scale * shScale, 8 * sh.scale * shScale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    const p = this.computePose();
    drawNinja(ctx, proj.sx, proj.sy, this.kind, p, this.animT, s);

    // 受击闪烁
    if (this.invuln > 0 && Math.floor(this.animT / 4) % 2 === 0 && this.skillTimer <= 0) {
      ctx.save();
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.ellipse(proj.sx, proj.sy - 30 * s, 20 * s, 34 * s, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    // 冰桥光环
    if (this.skillTimer > 0 && this.kind === 'water') {
      ctx.save();
      ctx.globalAlpha = 0.5 + 0.2 * Math.sin(this.animT * 0.3);
      const g = ctx.createRadialGradient(proj.sx, proj.sy - 30 * s, 4 * s, proj.sx, proj.sy - 30 * s, 55 * s);
      g.addColorStop(0, 'rgba(180,230,255,0.9)');
      g.addColorStop(1, 'rgba(120,200,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(proj.sx, proj.sy - 30 * s, 55 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  jumpProgress() {
    if (this.onGround) return 0;
    const apex = (CFG.jumpVel * CFG.jumpVel) / (2 * CFG.gravity);
    return Math.max(0, Math.min(1, this.y / apex));
  }
  computePose() {
    const t = this.animT;
    if (this.state === 'jump') {
      const jp = this.jumpProgress();
      if (this.kind === 'water') {
        // 水系：腾空翻转一圈
        return { type: 'jump', legSwing: 0.4, armSwing: -0.9, bodyAngle: Math.sin(jp * Math.PI) * Math.PI, crouch: 0, scarf: 1.5 };
      }
      // 火系：弹射后仰 + 双臂上举
      return { type: 'jump', legSwing: 0.7, armSwing: -1.3, bodyAngle: -0.35, crouch: 0, scarf: 1.8 };
    }
    if (this.state === 'slide') {
      // 滑铲：身体大幅前倾压低，腿前伸、臂后摆（与跳跃明显不同）
      return { type: 'slide', legSwing: 1.3, armSwing: 1.4, bodyAngle: this.kind === 'fire' ? -0.78 : -0.62, crouch: 1, scarf: 2.3 };
    }
    const ph = (t * 0.4) % (Math.PI * 2);
    return { type: 'run', legSwing: Math.sin(ph), armSwing: -Math.sin(ph), bodyAngle: Math.sin(ph) * 0.05, crouch: 0, scarf: 1 + 0.2 * Math.sin(t * 0.3) };
  }
}

/* =========================================================
 * 乐高忍者绘制（pose + scale）
 * ========================================================= */
function drawNinja(ctx, cx, fy, kind, pose, animT, scale = 1) {
  const def = NINJAS[kind];
  const s = scale;
  const W = 44 * s, H = 64 * s;

  ctx.save();
  ctx.translate(cx, fy);
  if (pose.crouch) { ctx.translate(0, 26 * s); ctx.rotate(pose.bodyAngle); }
  else { ctx.rotate(pose.bodyAngle || 0); }

  drawScarf(ctx, def, pose, animT, s);

  const legW = 11 * s, legH = 18 * s, legY = -legH;
  const swing = pose.legSwing * 6 * s;
  ctx.fillStyle = def.dark;
  roundRect(ctx, -W / 2 + 3 * s, legY + swing * 0.3, legW, legH - Math.abs(swing) * 0.2, 3 * s); ctx.fill();
  roundRect(ctx, W / 2 - 3 * s - legW, legY - swing * 0.3, legW, legH - Math.abs(swing) * 0.2, 3 * s); ctx.fill();
  ctx.fillStyle = '#222';
  roundRect(ctx, -W / 2 + 2 * s, -3 * s, legW + 2 * s, 4 * s, 2 * s); ctx.fill();
  roundRect(ctx, W / 2 - 3 * s - legW, -3 * s, legW + 2 * s, 4 * s, 2 * s); ctx.fill();

  const torsoW = 30 * s, torsoH = 26 * s, torsoY = legY - torsoH + 2 * s;
  ctx.fillStyle = def.color;
  roundRect(ctx, -torsoW / 2, torsoY, torsoW, torsoH, 4 * s); ctx.fill();
  ctx.fillStyle = def.dark;
  roundRect(ctx, -torsoW / 2, torsoY + torsoH - 6 * s, torsoW, 6 * s, 3 * s); ctx.fill();
  ctx.fillStyle = '#2c3e50';
  ctx.fillRect(-torsoW / 2, torsoY + torsoH - 8 * s, torsoW, 4 * s);
  ctx.fillStyle = def.light;
  ctx.beginPath(); ctx.arc(0, torsoY + torsoH / 2 - 2 * s, 4 * s, 0, Math.PI * 2); ctx.fill();

  const armW = 7 * s, armH = 18 * s;
  const aSwing = pose.armSwing * 5 * s;
  ctx.fillStyle = def.color;
  roundRect(ctx, -torsoW / 2 - armW + 1 * s, torsoY + 2 * s - aSwing, armW, armH, 3 * s); ctx.fill();
  roundRect(ctx, torsoW / 2 - 1 * s, torsoY + 2 * s + aSwing, armW, armH, 3 * s); ctx.fill();
  ctx.fillStyle = def.skin;
  ctx.beginPath(); ctx.arc(-torsoW / 2 - armW / 2 + 1 * s, torsoY + 2 * s - aSwing + armH, 3.5 * s, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(torsoW / 2 + armW / 2 - 1 * s, torsoY + 2 * s + aSwing + armH, 3.5 * s, 0, Math.PI * 2); ctx.fill();

  const head = 24 * s, headY = torsoY - head + 2 * s;
  ctx.fillStyle = def.skin;
  roundRect(ctx, -head / 2, headY, head, head, 4 * s); ctx.fill();
  ctx.fillStyle = def.color;
  roundRect(ctx, -head / 2, headY, head, head * 0.42, 4 * s); ctx.fill();
  ctx.fillStyle = def.dark;
  ctx.fillRect(-head / 2, headY + head * 0.34, head, 2 * s);
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(-6 * s, headY + head * 0.52, 4 * s, 3 * s);
  ctx.fillRect(2 * s, headY + head * 0.52, 4 * s, 3 * s);
  ctx.fillStyle = def.dark;
  stud(ctx, 0, headY - 1 * s, 4 * s);

  ctx.restore();

  if (pose.type === 'slide') {
    ctx.save();
    ctx.globalAlpha = 0.6;
    const col = kind === 'water' ? '#bfe9ff' : '#ff8a3c';
    ctx.fillStyle = col;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(cx - (20 + i * 10) * s, fy - 14 * s + i * 2 * s, (5 - i) * s, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}
function drawScarf(ctx, def, pose, animT, s) {
  ctx.save();
  ctx.fillStyle = def.scarf;
  const len = (18 + pose.scarf * 14) * s;
  const wave = Math.sin(animT * 0.3) * 3 * s;
  ctx.beginPath();
  ctx.moveTo(-12 * s, -50 * s);
  ctx.quadraticCurveTo(-len * 0.6, -52 * s + wave, -len, -44 * s + wave * 1.5);
  ctx.quadraticCurveTo(-len * 0.6, -46 * s + wave, -12 * s, -40 * s);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
function drawNinjaPreview(ctx, kind, w, h) {
  ctx.clearRect(0, 0, w, h);
  const t = performance.now() * 0.005;
  const pose = { type: 'run', legSwing: Math.sin(t) * 0.3, armSwing: -Math.sin(t) * 0.3, bodyAngle: 0, crouch: 0, scarf: 1 };
  drawNinja(ctx, w / 2, h - 10, kind, pose, t * 20, 1);
}

/* =========================================================
 * 障碍 Obstacle —— 带 z、占据若干车道
 *  kind: 'jump' 矮墙(跳) | 'slide' 悬空横杆(滑) | 'block' 高墙(变道/技能)
 * ========================================================= */
class Obstacle {
  constructor(kind, lanes, z) {
    this.kind = kind;
    this.lanes = lanes;           // 车道索引数组
    this.z = z;
    this.dead = false;
    this.hit = false;
    this.scored = false;
  }
  update(speed) { this.z -= speed; if (this.z < CFG.cullZ) this.dead = true; }

  // 是否与玩家碰撞（玩家在碰撞平面 z≈0 时判定）
  collides(player) {
    if (this.hit) return false;
    if (Math.abs(this.z - CFG.playerZ) > 26) return false; // 不在碰撞窗
    if (!this.lanes.includes(player.hitLane())) return false;
    if (this.kind === 'jump' && player.isJumping()) return false;
    if (this.kind === 'slide' && player.isSliding()) return false;
    // 'block' 任何姿态都撞，除非技能无敌
    return true;
  }

  draw(ctx) {
    for (const l of this.lanes) {
      const wx = laneX(l);
      const base = project(wx, this.z, 0);
      if (base.scale < 0.04) continue;
      const s = base.scale;
      ctx.save();
      ctx.translate(base.sx, base.sy);
      ctx.scale(s, s);
      this.drawKind(ctx, this.kind);
      ctx.restore();
    }
  }

  drawKind(ctx, kind) {
    if (kind === 'jump') {
      // 矮乐高墙
      const w = 92, h = 54;
      ctx.fillStyle = '#7f8c8d';
      roundRect(ctx, -w / 2, -h, w, h, 4); ctx.fill();
      ctx.fillStyle = '#566566';
      roundRect(ctx, -w / 2, -8, w, 8, 3); ctx.fill();
      ctx.fillStyle = '#95a5a6';
      for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) stud(ctx, -w / 2 + 18 + c * 28, -h + 16 + r * 22, 5);
    } else if (kind === 'slide') {
      // 悬空横杆：两立柱 + 横梁（下方留空可滑过）
      const barY = 60, barH = 34, w = 100;
      ctx.fillStyle = '#5d4037';
      ctx.fillRect(-w / 2, -barY - barH, 7, barY + barH);
      ctx.fillRect(w / 2 - 7, -barY - barH, 7, barY + barH);
      ctx.fillStyle = '#e67e22';
      roundRect(ctx, -w / 2, -barY - barH, w, barH, 4); ctx.fill();
      ctx.fillStyle = '#b96415';
      roundRect(ctx, -w / 2, -barY - 6, w, 6, 3); ctx.fill();
      ctx.fillStyle = '#f39c12';
      for (let i = 0; i < 4; i++) stud(ctx, -w / 2 + 16 + i * 24, -barY - barH + 16, 5);
    } else {
      // 高墙
      const w = 96, h = 150;
      ctx.fillStyle = '#8e44ad';
      roundRect(ctx, -w / 2, -h, w, h, 4); ctx.fill();
      ctx.fillStyle = '#6c3483';
      roundRect(ctx, -w / 2, -8, w, 8, 3); ctx.fill();
      ctx.fillStyle = '#9b59b6';
      for (let r = 0; r < 4; r++) for (let c = 0; c < 2; c++) stud(ctx, -w / 2 + 26 + c * 44, -h + 20 + r * 32, 6);
    }
  }
}

/* =========================================================
 * 拾取物 Pickup —— 车道 + z + 离地高度
 * ========================================================= */
class Pickup {
  constructor(type, lane, z, y = 0) {
    this.type = type;
    this.lane = lane;
    this.z = z;
    this.y = y;
    this.dead = false;
    this.phase = Math.random() * Math.PI * 2;
  }
  update(speed) { this.z -= speed; this.phase += 0.12; if (this.z < CFG.cullZ) this.dead = true; }

  collect(player) {
    if (Math.abs(this.z - CFG.playerZ) > 30) return false;
    if (this.lane !== player.hitLane()) return false;
    // 高度：玩家需大致在该高度带（金币带 ±40）
    if (Math.abs(this.y - player.y) > 42) return false;
    return true;
  }

  draw(ctx) {
    const proj = project(laneX(this.lane), this.z, this.y + Math.sin(this.phase) * 3);
    if (proj.scale < 0.04) return;
    const s = proj.scale;
    ctx.save();
    ctx.translate(proj.sx, proj.sy);
    ctx.scale(s, s);
    if (this.type === 'coin') {
      const sq = Math.abs(Math.cos(this.phase * 1.5));
      ctx.fillStyle = '#f1c40f';
      ctx.beginPath(); ctx.ellipse(0, 0, 10 * sq + 2, 11, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#f39c12';
      ctx.beginPath(); ctx.ellipse(0, 2, 7 * sq + 1, 7, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff8dc';
      ctx.beginPath(); ctx.arc(-2, -3, 2, 0, Math.PI * 2); ctx.fill();
    } else if (this.type === 'gem') {
      ctx.fillStyle = '#1abc9c';
      ctx.beginPath();
      ctx.moveTo(0, -12); ctx.lineTo(10, -2); ctx.lineTo(6, 12); ctx.lineTo(-6, 12); ctx.lineTo(-10, -2);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#a3e4d7';
      ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(5, -2); ctx.lineTo(-5, -2); ctx.closePath(); ctx.fill();
    } else {
      ctx.fillStyle = '#e74c3c';
      ctx.beginPath();
      ctx.moveTo(0, 8);
      ctx.bezierCurveTo(-12, -2, -6, -12, 0, -4);
      ctx.bezierCurveTo(6, -12, 12, -2, 0, 8);
      ctx.fill();
    }
    ctx.restore();
  }
}

/* =========================================================
 * 火球 Fireball —— 向 +z 飞行，焚毁前方所有障碍
 * ========================================================= */
class Fireball {
  constructor(worldX, z, y) { this.worldX = worldX; this.z = z; this.y = y; this.vz = 26; this.dead = false; this.phase = 0; this.maxZ = 760; }
  update() { this.z += this.vz; this.phase += 0.5; if (this.z > this.maxZ) this.dead = true; }
  draw(ctx) {
    const proj = project(this.worldX, this.z, this.y);
    if (proj.scale < 0.03) return;
    const s = proj.scale;
    ctx.save();
    ctx.translate(proj.sx, proj.sy);
    for (let i = 5; i > 0; i--) {
      ctx.globalAlpha = 0.15 * i;
      ctx.fillStyle = i % 2 ? '#ff8a3c' : '#ffd166';
      const bz = Math.max(0, this.z - i * 18);
      const bp = project(this.worldX, bz, this.y);
      ctx.beginPath(); ctx.arc(bp.sx - proj.sx, bp.sy - proj.sy, (14 - i) * s, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    const g = ctx.createRadialGradient(0, 0, 2 * s, 0, 0, 16 * s);
    g.addColorStop(0, '#fff7c2'); g.addColorStop(0.5, '#ffb347'); g.addColorStop(1, '#e74c3c');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, 14 * s, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}

/* =========================================================
 * 粒子 Particle（屏幕空间）
 * ========================================================= */
class Particle {
  constructor(x, y, vx, vy, life, color, size, type) {
    this.x = x; this.y = y; this.vx = vx; this.vy = vy;
    this.life = life; this.max = life; this.color = color;
    this.size = size; this.type = type || 'dot'; this.dead = false;
  }
  update() {
    this.x += this.vx; this.y += this.vy;
    this.vy += this.type === 'dust' ? 0.15 : 0.05;
    this.life--;
    if (this.life <= 0) this.dead = true;
  }
  draw(ctx) {
    const a = this.life / this.max;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = this.color;
    if (this.type === 'spark') ctx.fillRect(this.x - 1, this.y - 1, this.size, this.size);
    else { ctx.beginPath(); ctx.arc(this.x, this.y, this.size * a, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  }
}
