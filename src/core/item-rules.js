// 手持道具的**纯规则**（不碰 Game 实例、不 import game.js）。
//
// 为什么单独一个模块：这些函数本来是写在 game.js 里的，而 eventfx.js 需要 heldCount()，
// 于是变成 `game.js → events → eventfx.js → game.js` 的**循环 import**。
// 开发时（一个个模块分开加载）看不出问题，**打包成单文件就炸**：
//   Uncaught TypeError: Cannot destructure property 'heldCount' of '__mods.src/core/game.js' as it is undefined
// （verify-bundle 抓到的。）
//
// 判据很简单：**谁都能 import 的叶子模块**里只放纯函数 —— 输入是数据，输出是数据，
// 不读存档、不碰 DOM、不认识 Game。要改道具的叠加规则、卖出价、分类，都在这里改一次。
import { ITEMS } from '../data/items.js';

/** 手持栏里的东西按 id 归并（同名多件合成一条 ×n），顺序按拿到手的先后 */
export function heldEntries(held) {
  const out = [];
  for (const id of held ?? []) {
    const item = ITEMS[id];
    if (!item) continue;
    const found = out.find((e) => e.id === id);
    if (found) found.n += 1;
    else out.push({ id, item, n: 1 });
  }
  return out;
}

/** 手上这件东西有几个（事件的条件判断用它） */
export function heldCount(held, id) {
  return (held ?? []).filter((x) => x === id).length;
}

/**
 * 把持有效果汇总成一张系数表：`{ attackPct: {add:0.2,n:2}, poisonNoDecay: {flag:true}, ... }`
 *
 * 叠加规则（用户定的）：**数值型按件数叠加**（两件 +10% 就是 +20%），
 * **开关型重复无效**（多拿一件「中毒不衰减」没有任何额外好处，界面会标「已生效」）。
 */
export function sumHeldMods(held) {
  const acc = {};
  for (const id of held ?? []) {
    const item = ITEMS[id];
    if (!item || item.kind !== 'hold') continue;
    for (const m of item.hold?.mods ?? []) {
      const e = acc[m.key] ?? (acc[m.key] = { add: 0, mul: 1, flag: false, n: 0 });
      e.n += 1;
      if (typeof m.add === 'number') e.add += m.add;
      else if (typeof m.mul === 'number') e.mul *= m.mul;
      else e.flag = true;
    }
  }
  return acc;
}

/**
 * 一件道具「用下去会发生什么」——**界面和引擎共用这一份判断**。
 * 只有 `kind: 'use'` 的道具才有这一步；持有型没有「使用」这个动作（效果一直开着）。
 */
export function itemUseEffect(item) {
  if (!item || item.kind !== 'use') return null;
  return item.use ?? null;
}

/** 卖出价：售价的 40% */
export function itemSellPrice(item) {
  return Math.max(1, Math.round((item?.price ?? 0) * 0.4));
}
