// 「专家模式」：把卡面背后的数值直接标出来（默认关闭）。
//
// 用户要求：「在设置里添加一个专家模式，打开后可以在卡牌里看到这些详细的威力、防御影响之类的数值，
// 正常情况下默认关闭。」
//
// 打开之后，每张卡面会多出一行小字：威力% / 实际伤害（含多段）/ 护盾（含防御加成）/
// 抽牌 / 每点 AP 的效率 —— 这些数字本来就是引擎算的（见 cardtext.js 的 damageParts 与
// shieldTotal），只是平时不摆在卡面上。
//
// 存 localStorage 而不是存档：它和音量、战斗速度一样是**本机偏好**，跟着存档导出走反而奇怪。
// 换语言要重画界面（见 langswitch.js），这里也一样：改完通知订阅者重画，
// 否则设置面板关掉之后，屏幕上那些卡面还是旧的（没有那一行）。

const KEY = 'oasis.expertMode';
const listeners = new Set();
let cached = null;

/** 专家模式开着吗（默认关） */
export function expertEnabled() {
  if (cached === null) {
    try { cached = localStorage.getItem(KEY) === '1'; } catch { cached = false; }
  }
  return cached;
}

/** 开关专家模式；返回切换后的状态 */
export function setExpertEnabled(on) {
  cached = !!on;
  try { localStorage.setItem(KEY, cached ? '1' : '0'); } catch { /* 隐私模式里写不进去也无所谓 */ }
  for (const fn of listeners) fn(cached);
  return cached;
}

/** 订阅变化（src/ui/ui.js 用它重画当前界面） */
export function onExpertChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
