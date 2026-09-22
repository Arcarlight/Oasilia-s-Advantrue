// 战斗背景那层**波浪花纹文字**（3.0.5，用户要的）。
//
// 用户的原话：「现在战斗画面背景有点略过简单，请问你可以在背景铺一层像波浪一样的，
// 和背景颜色相近但勉强能看清的文本作为装饰吗？用简体中文的文本就可以，这个字体里的汉字
// 长得很像图案，可以作为装饰。而玩家或敌人周围的背景文本在敌人行动或是玩家行动时会
// 微微变亮，但又不会太过明显。文本可以直接采用52wiki上对应的宝可梦介绍。」
//
// 于是这一层是三件事拼出来的：
//   ① **文本**：content/species-dex.json 里从 52wiki 抓的图鉴介绍（tools/fetch-species-dex.mjs）。
//      上半片铺**这一场敌人**那个物种的，下半片铺**主角**那个物种的 —— 两半各铺各的，
//      所以「那一侧行动时变亮」亮起来的才是它自己的那段话。
//   ② **字体**：仓库根目录的「余繁离形体.otf」（用户提供），
//      tools/subset-fonts.mjs 按这份文本单独裁成 92KB 的子集（装饰字体覆盖 1206 个字，100%）。
//      它的汉字更像图案而不是字，正好当纹理用。
//   ③ **波浪**：SVG 的 <textPath> —— 每行一条正弦路径，文字沿着路径走。
//      SVG 而不是 CSS：CSS 只能靠逐行 rotate 假装斜排，弯不出真正的波形。
//
// 变亮的做法：整层画**三份**（底色一份 + 左右各一份高亮），高亮那两份用 CSS 的
// radial-gradient mask 圈住自己那一侧（敌人右上、玩家左下），平时 opacity 0，
// 那一侧行动时把某一层点亮（见 battle-view.js 的 decorAct）。这样「变亮」的范围
// 天然就是「那一侧的周围」，不需要按坐标算，也不会有硬边。
import { el } from './dom.js';

/** SVG 逻辑画布（CSS 用 xMidYMid slice 铺满整个战场，比例不同时裁掉溢出的部分） */
const VB = { w: 1200, h: 780 };
/** 每个半场铺几行 */
const LINES = 7;
/** 上半（敌人）与下半（主角）各自的行 y 范围 */
const BANDS = {
  enemy: { top: 26, bottom: 336 },
  player: { top: 442, bottom: 752 },
};
/** 文本不够长时用来补位的分隔符（一起进子集，见 subset-fonts 的 DECOR_SEP） */
const SEP = '　·　';

/**
 * 一条正弦路径。
 *
 * 用折线采样而不是贝塞尔：这里的波幅只有 7~15、波长 400 上下，每 24 单位采一个点
 * 已经看不出棱角，而**参数改起来是一行**（贝塞尔的控制点要跟着振幅重算，改一次错一次）。
 */
function wavePath(y, amp, wl, phase) {
  const step = 24;
  const pts = [];
  for (let x = -80; x <= VB.w + 80; x += step) {
    pts.push([x, y + amp * Math.sin((x / wl) * Math.PI * 2 + phase)]);
  }
  return pts.map(([x, yy], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${yy.toFixed(1)}`).join(' ');
}

/**
 * 造一份 SVG：`idp` 是这一份的 id 前缀（三份共用一个页面，id 不能撞）。
 * @param {string} prefix
 * @param {{enemy?:string, player?:string}} bands
 * @param {string} cls 挂在 <svg> 上的类名（底色 / 高亮）
 */
function svgCopy(prefix, bands, cls) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${VB.w} ${VB.h}`);
  svg.setAttribute('preserveAspectRatio', 'xMidYMid slice');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  if (cls) svg.setAttribute('class', cls);
  for (const [side, band] of Object.entries(BANDS)) {
    const text = bands[side];
    if (!text) continue;
    const g = document.createElementNS(ns, 'g');
    const gap = (band.bottom - band.top) / (LINES - 1);
    for (let i = 0; i < LINES; i += 1) {
      const y = band.top + i * gap;
      // 每行的波幅 / 波长 / 相位 / 字号都错开一点：整片看起来才像「水」而不是「条纹」
      const amp = 12 + (i % 3) * 5 + (side === 'player' ? 3 : 0);
      const wl = 430 + (i % 4) * 95;
      const phase = i * 1.7 + (side === 'enemy' ? 0.6 : 2.4);
      const size = 25 + (i % 3) * 3;
      const id = `${prefix}-${side}-${i}`;
      const path = document.createElementNS(ns, 'path');
      path.setAttribute('id', id);
      path.setAttribute('d', wavePath(y, amp, wl, phase));
      path.setAttribute('fill', 'none');
      const t = document.createElementNS(ns, 'text');
      t.setAttribute('font-size', String(size));
      // 每行的浓淡也有细微差别，避免整片一个调子
      t.setAttribute('opacity', String(0.55 + (i % 4) * 0.15));
      const tp = document.createElementNS(ns, 'textPath');
      tp.setAttribute('href', `#${id}`);
      tp.setAttribute('startOffset', String(-((i * 137) % 260)));   // 每行错开起点
      tp.textContent = filler(text, size);
      t.append(tp);
      g.append(path, t);
    }
    svg.append(g);
  }
  return svg;
}

/**
 * 把一段图鉴文本铺满一行：按「一个汉字约等于一个字号宽」估出需要重复几遍，
 * 多铺几遍无所谓 —— `<textPath>` 只画落在路径上的那部分，超出末尾的自动不显示。
 */
function filler(text, size) {
  const len = Math.max(1, [...text].length);
  const perLine = Math.ceil((VB.w * 1.25) / (len * size));
  return Array.from({ length: perLine + 2 }, () => text).join(SEP);
}

/**
 * 造整层装饰。
 * @param {{enemyText?:string, playerText?:string, fallback?:string}} opts
 * @returns {HTMLElement}
 */
export function battleDecor({ enemyText, playerText, fallback = '' } = {}) {
  const bands = { enemy: enemyText || fallback, player: playerText || fallback };
  const box = el('div', { class: 'battle-decor' });
  box.append(svgCopy('dec', bands, 'decor-base'));
  /**
   * 两份高亮：内容与底色**完全一样**，只是换了 CSS 类 ——
   * 于是「变亮」在视觉上就是「同一片文字更亮了一点」，不会多出别的形状。
   */
  box.append(svgCopy('decE', bands, 'decor-glow decor-glow-enemy'));
  box.append(svgCopy('decP', bands, 'decor-glow decor-glow-player'));
  return box;
}
