/* =========================================================
 * config.js —— 全局配置、难度与角色定义
 * ========================================================= */

// 画布与世界参数（逻辑分辨率 960x540，CSS 等比缩放）
// 采用神庙逃亡式伪 3D：相机在 z=0 看向 +Z，世界坐标 (worldX, z, y)
const CFG = {
  width: 960,
  height: 540,

  // —— 透视投影 ——
  horizonY: 205,       // 地平线 / 消失点 y
  vanishX: 480,        // 消失点 x（画面中心）
  bottomY: 545,        // z=0 处的屏幕 y（脚底）
  focal: 300,          // 焦距，控制透视强度
  maxZ: 1700,          // 生成距离（最远可见 z）

  // —— 三车道 ——
  lanes: 3,
  laneW: 120,          // 车道中心间距（世界单位）
  laneHalf: 52,        // 半车道宽（碰撞/路面用）
  playerZ: 0,          // 玩家所在 z 平面

  // —— 物理（世界单位，y 向上为正）——
  gravity: 0.9,
  jumpVel: 15,         // 起跳初速度（正=向上）
  jumpClearY: 56,      // 跳跃超过此高度视为越过矮障碍（需高于矮墙顶 54）
  slideFrames: 34,     // 滑铲持续帧数
  invulnFrames: 90,    // 受击后无敌帧数
  playerH: 62,         // 站立碰撞高
  slideH: 30,          // 滑铲碰撞高

  // —— 速度（z 单位/帧），实际值由难度覆盖 ——
  speedBase: 14,
  speedMax: 30,
  speedRamp: 0.002,

  // —— 生成 ——
  spawnZ: 1700,
  cullZ: -60,
};

// 三档难度
// spawnGapMul：障碍生成间距倍率，越大障碍越少
const DIFFICULTIES = {
  easy: {
    key: 'easy', name: '简单',
    startSpeed: 10, maxSpeed: 21, speedRamp: 0.0014,
    spawnGapMul: 1.45, skillUses: 5,
    desc: '慢速 · 障碍少 · 5 次技能',
  },
  normal: {
    key: 'normal', name: '普通',
    startSpeed: 12, maxSpeed: 26, speedRamp: 0.0018,
    spawnGapMul: 1.1, skillUses: 3,
    desc: '标准速度 · 3 次技能',
  },
  hard: {
    key: 'hard', name: '困难',
    startSpeed: 14, maxSpeed: 30, speedRamp: 0.002,
    spawnGapMul: 0.9, skillUses: 1,
    desc: '极速 · 障碍密集 · 1 次技能',
  },
};

// 六个忍者角色
// skillType 决定技能逻辑，theme 用于粒子/特效配色
const NINJAS = {
  water: {
    key: 'water',
    name: '水系忍者',
    title: 'ICE BRIDGE',
    color: '#2a8fd8',     // 主色（躯干 / 头巾）
    dark: '#1f6fb8',      // 暗色描边 / 阴影
    light: '#7fd4ff',     // 亮色高光
    scarf: '#bfe9ff',     // 飘带
    skin: '#f5c518',      // 肤色（乐高黄）
    skillName: '冰桥',
    skillDesc: '短时间无敌，穿越一切障碍',
    skillType: 'iceBridge',
    skillFrames: 210,     // 3.5s @60fps
    theme: '#bfe9ff',
  },
  fire: {
    key: 'fire',
    name: '火系忍者',
    title: 'FIREBALL',
    color: '#e74c3c',
    dark: '#a93226',
    light: '#ff9a6b',
    scarf: '#ffb347',
    skin: '#f5c518',
    skillName: '火球',
    skillDesc: '发射火球，焚毁前方所有障碍',
    skillType: 'fireball',
    skillFrames: 0,
    theme: '#ff8a3c',
  },
  life: {
    key: 'life',
    name: '生命系忍者',
    title: 'LIFE ORB',
    color: '#2ecc71',
    dark: '#1e8449',
    light: '#a9f5c8',
    scarf: '#d9ffe8',
    skin: '#f5c518',
    skillName: '生命光球',
    skillDesc: '发射生命光球，摧毁前方障碍',
    skillType: 'lifeOrb',
    skillFrames: 0,
    theme: '#7dffb0',
  },
  ice: {
    key: 'ice',
    name: '冰系忍者',
    title: 'FREEZE GROUND',
    color: '#e8f3ff',
    dark: '#7f9db8',
    light: '#ffffff',
    scarf: '#bfe9ff',
    skin: '#f5c518',
    skillName: '冰冻地面',
    skillDesc: '冰封跑道，自身加速且免疫伤害',
    skillType: 'freeze',
    skillFrames: 210,
    theme: '#cfefff',
  },
  earth: {
    key: 'earth',
    name: '土系忍者',
    title: 'GROUND BURST',
    color: '#3a3a3a',
    dark: '#141414',
    light: '#7a7a7a',
    scarf: '#8d6e63',
    skin: '#f5c518',
    skillName: '地面隆起',
    skillDesc: '隆起地面，顶飞本赛道前方障碍',
    skillType: 'quake',
    skillFrames: 0,
    theme: '#c49a6c',
  },
  lightning: {
    key: 'lightning',
    name: '电系忍者',
    title: 'CHAIN LIGHTNING',
    color: '#1f3c88',
    dark: '#122656',
    light: '#6f9dff',
    scarf: '#a9d4ff',
    skin: '#f5c518',
    skillName: '枝状闪电',
    skillDesc: '释放树枝状闪电，清理前方障碍',
    skillType: 'lightning',
    skillFrames: 0,
    theme: '#9ad0ff',
  },
};
