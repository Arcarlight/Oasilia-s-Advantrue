// 战斗背景那层**波浪花纹文字**（3.0.5，用户要的）。
//
// 用户的原话：「现在战斗画面背景有点略过简单，请问你可以在背景铺一层像波浪一样的，
// 和背景颜色相近但勉强能看清的文本作为装饰吗？用简体中文的文本就可以，这个字体里的汉字
// 长得很像图案，可以作为装饰。而玩家或敌人周围的背景文本在敌人行动或是玩家行动时会
// 微微变亮，但又不会太过明显。文本可以直接采用52wiki上对应的宝可梦介绍。」
// 第二版的原话：「我希望这个波纹能密一点更不显眼一点，然后真的像波浪一样动起来，
// 现在这样还是太死板了。」
//
// 于是这一层是四件事拼出来的：
//   ① **文本**：content/species-dex.json 里从 52wiki 抓的图鉴介绍（tools/fetch-species-dex.mjs）。
//      上半片铺**这一场敌人**那个物种的，下半片铺**主角**那个物种的 —— 两半各铺各的，
//      所以「那一侧行动时变亮」亮起来的才是它自己的那段话。
//   ② **字体**：仓库根目录的「余繁离形体.otf」（用户提供），
//      tools/subset-fonts.mjs 按这份文本单独裁成 92KB 的子集（装饰字体覆盖 1206 个字，100%）。
//      它的汉字更像图案而不是字，正好当纹理用。
//   ③ **波浪**：SVG 的 <textPath> —— 每行一条正弦路径，文字沿着路径走。
//      SVG 而不是 CSS：CSS 只能靠逐行 rotate 假装斜排，弯不出真正的波形。
//   ④ **动**（第二版加的）：每半场拆成三个小组，每组各自慢慢地左右漂、上下浮，
//      周期各不相同 —— 波峰看着就像在水面上走。**不用逐帧 JS**：
//      一条 CSS 关键帧 + 每组自己的 `--dx/--dy/--dur/--delay` 就够，
//      而且三份图层（底色 + 两份高亮）拿到的是同一组参数，永远同步、不会重影。
//
// 变亮的做法：整层画**三份**（底色一份 + 左右各一份高亮），高亮那两份用 CSS 的
// radial-gradient mask 圈住自己那一侧（敌人右上、玩家左下），平时 opacity 0，
// 那一侧行动时把某一层点亮（见 battle-view.js 的 decorAct）。这样「变亮」的范围
// 天然就是「那一侧的周围」，不需要按坐标算，也不会有硬边。
import { el } from './dom.js';

/** SVG 逻辑画布（CSS 用 xMidYMid slice 铺满整个战场，比例不同时裁掉溢出的部分） */
const VB = { w: 1200, h: 780 };
/**
 * 每个半场铺几行。
 * 3.0.6 从 7 行加到 13 行：用户要「密一点」—— 行距一缩小，它就从「几条大字」变成
 * 一层织纹，密度上来了才更像背景而不是内容。
 */
const LINES = 13;
/** 上半（敌人）与下半（主角）各自的行 y 范围（留出漂动用的上下余量） */
const BANDS = {
  enemy: { top: 18, bottom: 342 },
  player: { top: 438, bottom: 762 },
};
/**
 * 每半场分几个「漂动小组」：组内的行一起走，组与组之间方向 / 速度 / 相位都不同。
 * 只有整层一起动会显得像一张纸在平移，分三组才像水面。
 */
const DRIFT_GROUPS = 3;
/** 文本不够长时用来补位的分隔符（一起进子集，见 subset-fonts 的 DECOR_SEP） */
const SEP = '　·　';

/**
 * 一条正弦路径。
 *
 * 用折线采样而不是贝塞尔：这里的波幅只有 7~14、波长 400 上下，每 24 单位采一个点
 * 已经看不出棱角，而**参数改起来是一行**（贝塞尔的控制点要跟着振幅重算，改一次错一次）。
 *
 * x 从 -240 铺到 VB.w + 240：小组左右漂动最多 ±100，路径必须比画布宽出一截，
 * 不然漂到一边就会露出一段空白（第一版只多铺 80，漂起来缝就出来了）。
 */
function wavePath(y, amp, wl, phase) {
  const step = 24;
  const pts = [];
  for (let x = -240; x <= VB.w + 240; x += step) {
    pts.push([x, y + amp * Math.sin((x / wl) * Math.PI * 2 + phase)]);
  }
  return pts.map(([x, yy], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${yy.toFixed(1)}`).join(' ');
}

/**
 * 一个漂动小组的**动画参数**（写进内联的自定义属性，CSS 关键帧读它们）。
 *
 * 方向按「奇偶」错开：一半往左走、一半往右走，相邻两组的波峰就会互相穿过去 ——
 * 那正是水面在动的样子。周期故意**互质**（17 / 21 / 23 / 27 / 29 秒这类），
 * 于是整片纹理很久都不会回到同一个组合，看不出循环。
 */
function driftStyle(band, g) {
  const sign = (g % 2 === 0) ? -1 : 1;
  const dir = band === 'enemy' ? 1 : -1;
  const dur = 17 + ((g * 4 + (band === 'player' ? 3 : 0)) % 11) * 1.3;   // 17 ~ 30s
  const dx1 = Math.round(sign * dir * (46 + g * 17));                    // 46 ~ 80
  const dx2 = Math.round(-sign * dir * (30 + g * 11));
  const dy1 = Math.round(6 + g * 2.5);
  const dy2 = -Math.round(4 + g * 2);
  return {
    '--dx1': `${dx1}px`, '--dy1': `${dy1}px`,
    '--dx2': `${dx2}px`, '--dy2': `${dy2}px`,
    '--dur': `${dur}s`,
    '--delay': `${-(g * 3.1 + (band === 'enemy' ? 0 : 1.7)).toFixed(1)}s`,
  };
}

/**
 * 造一份 SVG：`prefix` 是这一份的 id 前缀（三份共用一个页面，id 不能撞）。
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
    const gap = (band.bottom - band.top) / (LINES - 1);
    // 先把 13 行按顺序切成三组（0-4 / 5-8 / 9-12）
    const groups = Array.from({ length: DRIFT_GROUPS }, () => []);
    for (let i = 0; i < LINES; i += 1) groups[Math.floor((i / LINES) * DRIFT_GROUPS)].push(i);
    for (let g = 0; g < groups.length; g += 1) {
      const group = document.createElementNS(ns, 'g');
      group.setAttribute('class', 'decor-drift');
      for (const [k, v] of Object.entries(driftStyle(side, g))) group.setAttribute('style', `${group.getAttribute('style') ?? ''}${k}:${v};`);
      for (const i of groups[g]) {
        const y = band.top + i * gap;
        // 每行的波幅 / 波长 / 相位 / 字号都错开一点：整片看起来才像「水」而不是「条纹」
        const amp = 7 + (i % 3) * 3.5 + (side === 'player' ? 1.5 : 0);
        const wl = 380 + (i % 4) * 75;
        const phase = i * 1.7 + (side === 'enemy' ? 0.6 : 2.4);
        const size = 19 + (i % 3) * 2;
        const id = `${prefix}-${side}-${i}`;
        const path = document.createElementNS(ns, 'path');
        path.setAttribute('id', id);
        path.setAttribute('d', wavePath(y, amp, wl, phase));
        path.setAttribute('fill', 'none');
        const t = document.createElementNS(ns, 'text');
        t.setAttribute('font-size', String(size));
        /**
         * 每行的浓淡也有细微差别，避免整片一个调子。
         * 3.0.6 整体压得更淡（底色 fill 从 .085 降到 .045，见 style.css）——
         * 行数翻倍本身就让墨量变多了，两件事得一起调，不然「密」会变成「更显眼」。
         */
        t.setAttribute('opacity', String(0.45 + (i % 4) * 0.15));
        const tp = document.createElementNS(ns, 'textPath');
        tp.setAttribute('href', `#${id}`);
        tp.setAttribute('startOffset', String(-((i * 137) % 260)));   // 每行错开起点
        tp.textContent = filler(text, size);
        t.append(tp);
        group.append(path, t);
      }
      svg.append(group);
    }
  }
  return svg;
}

/**
 * 把一段图鉴文本铺满一行：按「一个汉字约等于一个字号宽」估出需要重复几遍，
 * 多铺几遍无所谓 —— `<textPath>` 只画落在路径上的那部分，超出末尾的自动不显示。
 */
function filler(text, size) {
  const len = Math.max(1, [...text].length);
  const perLine = Math.ceil(((VB.w + 480) * 1.25) / (len * size));
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
   * 三份的漂动参数由同一套函数算出来，所以它们永远同步（不同步就会看出重影）。
   */
  box.append(svgCopy('decE', bands, 'decor-glow decor-glow-enemy'));
  box.append(svgCopy('decP', bands, 'decor-glow decor-glow-player'));
  return box;
}
