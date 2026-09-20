// 悬停说明浮层：全站共用一份。
//
// 以前这套逻辑长在 BattleScreen 里面（只有战斗界面才 initTips），
// 于是卡组页 / 详情页上的「中毒 · 灼伤 · 护盾 · 销毁」这些词没法悬停查看 ——
// 而那恰恰是玩家最需要查词的地方（挑牌的时候才要想「这状态到底干什么」）。
// 现在抽成独立模块：谁都能调 initTips()，document 级委托只绑一次。
//
// 用法：给元素写 `dataset.tip`，文本里可以用 **重点** 标粗。

import { el, richText } from './dom.js';

let bound = false;

/** 建浮层 + 绑委托（可重复调用，只有第一次生效） */
export function initTips() {
  if (bound) return;
  bound = true;

  if (!document.querySelector('.tip-layer')) {
    document.body.append(el('div', { class: 'tip-layer' }));
  }

  const show = (target) => {
    const host = target?.closest?.('[data-tip]');
    const text = host?.dataset?.tip;
    const layer = document.querySelector('.tip-layer');
    if (!text || !layer) return;
    // 提示文本里允许写 **重点**：先把 HTML 转义、再把 **x** 变成 <b>x</b>（dom.js 的 richText）。
    // （以前只有 textContent，于是「**最坏情况**」这几个星号原样显示出来了。）
    layer.innerHTML = richText(text);
    layer.classList.add('show');
    const r = host.getBoundingClientRect();
    const lr = layer.getBoundingClientRect();
    const left = Math.max(8, Math.min(r.left + r.width / 2 - lr.width / 2, innerWidth - lr.width - 8));
    const top = r.top - lr.height - 8 > 6 ? r.top - lr.height - 8 : r.bottom + 8;
    layer.style.left = `${left}px`;
    layer.style.top = `${top}px`;
  };
  const hide = () => document.querySelector('.tip-layer')?.classList.remove('show');

  document.addEventListener('mouseover', (e) => show(e.target));
  document.addEventListener('focusin', (e) => show(e.target));
  document.addEventListener('mouseout', (e) => { if (e.target?.closest?.('[data-tip]')) hide(); });
  document.addEventListener('scroll', hide, true);
  // 点下去就收起来：否则点完详情页里的关键词，浮层会僵在那儿挡住下一步操作
  document.addEventListener('mousedown', hide, true);
}

/** 手动收掉浮层（切换界面时用） */
export function hideTip() {
  document.querySelector('.tip-layer')?.classList.remove('show');
}
