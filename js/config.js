/* =========================================================
 * config.js —— 全局配置与角色定义
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

  // —— 速度（z 单位/帧）——
  speedBase: 14,
  speedMax: 30,
  speedRamp: 0.002,

  // —— 生成 ——
  spawnZ: 1700,
  cullZ: -60,
};

// 两个忍者角色
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
    skillFrames: 210,     // 3.5s @60fps
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
    skillFrames: 0,       // 瞬时技能
  },
};
