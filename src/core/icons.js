// 小图标（Essentials 的 animated Icons，来自 Generation 9 Pack）。
//
// 素材是 `assets/icons/<slug>.png`：**64×64 一帧、横向排开**的动图条（本作这 214 张都是 2 帧）。
// 帧数记在 src/data/icons.js 的 ICON_META 里（由 tools/import-icons.mjs 生成），帧宽固定 64。
//
// 为什么用 CSS 动画而不是 setInterval 逐帧画：
//   敌人图鉴一屏就有几十上百张图标，每张挂一个定时器太贵；
//   `background-position` + `steps(N)` 是纯 CSS 的，浏览器自己排帧。
//   代价是 background-position 不走合成器（要重绘），所以图鉴里帧率压得比较低（见 ICONS.fps）。
//
// 拿不到小图标时**返回 null**，调用方退回 PMD 头像（图鉴里就是这么兜底的），不会开天窗。

import { ICON_META } from '../data/icons.js';

const BASE = 'assets/icons/';

/** 帧率：图鉴一屏几十张图标，慢一点更省电；详情页那张大一点，快一点更有生气 */
export const ICONS = { gridFps: 4, detailFps: 7 };

/** 这只物种有没有小图标 */
export const hasIcon = (slug) => !!ICON_META[slug];

/** 小图标的地址：单文件包内联成 data URI（file:// 下读不了本地 png） */
export function iconUrl(slug) {
  if (!ICON_META[slug]) return null;
  const inlined = typeof window !== 'undefined' && window.__OASIS_ICONS__
    ? window.__OASIS_ICONS__[slug]
    : null;
  return inlined ?? `${BASE}${slug}.png`;
}

/**
 * 建一个会动的小图标。
 * @param {string} slug 物种 slug
 * @param {{size?:number, fps?:number, className?:string, alt?:string}} opts
 * @returns {HTMLElement|null} 没有这张图标时返回 null
 */
export function createIcon(slug, opts = {}) {
  const { size = 40, fps = ICONS.gridFps, className = '', alt = '' } = opts;
  const meta = ICON_META[slug];
  const url = iconUrl(slug);
  if (!meta || !url) return null;

  const node = document.createElement('span');
  node.className = `poke-icon ${className}`.trim();
  node.style.width = `${size}px`;
  node.style.height = `${size}px`;
  node.style.backgroundImage = `url(${url})`;
  node.style.backgroundSize = `${meta.frames * size}px ${size}px`;
  // 一轮 = 帧数 × 单帧时长；steps(N) 让它一帧一帧跳，而不是平滑滑动
  node.style.animation = `poke-icon-play ${(meta.frames / fps).toFixed(3)}s steps(${meta.frames}) infinite`;
  node.style.setProperty('--icon-total', `${meta.frames * size}px`);
  if (alt) {
    node.setAttribute('role', 'img');
    node.setAttribute('aria-label', alt);
  }
  return node;
}
