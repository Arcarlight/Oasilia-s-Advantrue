// 战斗背景那层**波浪花纹文字**（3.0.5 起，用户要的）。
//
// 用户的原话，四批：
//   ① 「可以在背景铺一层像波浪一样的，和背景颜色相近但勉强能看清的文本作为装饰吗？
//      用简体中文的文本就可以，这个字体里的汉字长得很像图案，可以作为装饰。
//      而玩家或敌人周围的背景文本在敌人行动或是玩家行动时会微微变亮，但又不会太过明显。
//      文本可以直接采用52wiki上对应的宝可梦介绍。」
//   ② 「我希望这个波纹能密一点更不显眼一点，然后真的像波浪一样动起来，现在这样还是太死板了。」
//   ③ 「怎么这些字还只是左右平移？我想的是像波浪那样波动，而不是现在这样平移。」
//   ④ 「而且现在这个字有很严重的性能问题啊，我看了一眼巨卡无比。」
//
// ---------------------------------------------------------------------------
// 为什么最后是「一张可平铺的位图 + GPU 平移」，而不是 SVG 文字在动
// ---------------------------------------------------------------------------
// 前三版都是「真的 SVG 文字，每行一条正弦路径，靠 CSS 动画让它们动」。④ 说的卡就是这么来的：
// 一层 26 行、每行一份重复到铺满的图鉴文本，三层（底色 + 两份高亮）合起来 16000 多个字形，
// 而只要有一个元素在动，**整个 SVG 每帧都要重新光栅化一遍** —— 1.6 万个字形 × 每秒几十帧。
// （本机 headless 量主线程只有 4.2ms/帧，因为光栅化不在主线程上；但真浏览器里那一秒几十次的
//   大片重绘就是玩家感觉到的「巨卡」。tools/measure-fps.mjs 量的是主线程，量不到这一层，
//   所以这个问题的判据是**设计上别让它每帧重绘**，而不是靠那台机器上的数字。）
//
// 关键认识：一行正弦波 `y = A·sin(k(x − vt))` 的样子，就是**波形不动、一直往前推** ——
// 所以「让它像波浪那样滚」在实现上等于**沿 x 平移整整一个周期**。既然如此：
//   · 把「一个周期的花纹」**画成一张位图**（离屏 canvas，只画一次）；
//   · 用它当这层的 `background-image`，`repeat-x` 平铺；
//   · 让这一层用 CSS `transform` 平移一个周期，linear + infinite。
// 因为位图本身就是一个周期的、可无缝平铺的图案，平移一个周期之后画面**逐像素相同**，
// 接缝完全看不出来；而 transform 是合成层上的操作 —— **每帧不需要重绘任何东西**。
// 位图里只有「一个周期」的字（约 1000 个字形，是原来三层合计的 1/16），且只画一次。
//
// 要让「一个周期」真的无缝，三件事必须对齐（这是最容易写错的地方）：
//   · 文字：每一行的重复单元 = 图鉴文本 + 若干全角空格，单元里字符数固定 = unitChars；
//   · 波长：必须能整除单元宽度，所以波长取「单元宽度 ÷ 整数」；
//   · 字形网格：按**实测字宽**逐个累加排布（图鉴文本里有半角数字，1 和汉字的宽度不一样，
//     不能假设「一个字符正好一个字号宽」），最后再把整幅位图缩放到整数像素宽。
//
// 变亮：三层用同一张位图，只是 `opacity` 不同（底色 0.10 / 高亮 0.22），
// 高亮那两份再用 radial-gradient 的 mask 圈住自己那一侧（敌人右上、主角左下）。
// 「同一张图 + 只改 opacity」这一点很重要：变亮就是同一片文字更亮一点，不会多出别的形状。
import { el } from './dom.js';

/** 每个半场铺几行（3.0.6 从 7 行加到 13 行：用户要「密一点」） */
const LINES = 13;
/** 上半（敌人）与下半（主角）各自的行带（相对战场高度的比例，留出起伏余量） */
const BANDS = { enemy: [0.03, 0.45], player: [0.55, 0.97] };
/** 文本重复单元里补几个全角空格 */
const UNIT_PAD = 3;
/** 每行自己的浓淡（画进位图里，避免整片一个调子；整层的不透明度写在 style.css） */
const LINE_ALPHA = [0.45, 0.60, 0.75, 0.90];
/** 一个波形里放多少字（必须能整除 unitChars，否则平铺会有缝 —— 见文件头） */
const WAVE_CHOICES = [10, 20, 40];
/** 位图里文字的填充色（暖白；用户要的是「和背景颜色相近」） */
const INK = '255, 241, 216';

/** 一个整数 n 的、最接近 target 的因数（用来挑「一个波里放多少字」） */
function nearestDivisor(n, target) {  let best = 1;
  for (let d = 1; d <= n; d += 1) {
    if (n % d) continue;
    if (Math.abs(d - target) < Math.abs(best - target)) best = d;
  }
  return best;
}

/**
 * 把「一个周期的花纹」画成位图。
 * @returns {{url:string, unit:number, size:number}} 位图地址、一个周期的像素宽、字号
 */
function paintPattern(bands, w, h) {
  const size = Math.max(11, Math.min(21, Math.round(h * 0.029)));
  const texts = Object.values(bands).filter(Boolean);
  const maxChars = Math.max(...texts.map((t) => [...t].length));
  const unitChars = maxChars + UNIT_PAD;
  /** 每行的重复单元（图鉴文本 + 全角空格）——所有行共用同一个字符数，宽度就一致 */
  const unit = (t) => t + '　'.repeat(unitChars - [...t].length);

  const cv = document.createElement('canvas');
  const ctx = cv.getContext('2d');
  const font = `${size}px "Oasis Decor", "Oasis Hand", sans-serif`;
  ctx.font = font;
  /** 每一行用到的波长（体检要用它验「能整除一个周期的宽度」= 平铺无缝） */
  const wls = [];
  // ① 先按**实测字宽**累加，量出一个周期的真实宽度（半角数字只有半个字宽）
  const adv = new Map();
  const widthOf = (ch) => {
    if (!adv.has(ch)) adv.set(ch, ctx.measureText(ch).width);
    return adv.get(ch);
  };
  const unitAdv = (t) => [...unit(t)].reduce((s, ch) => s + widthOf(ch), 0);
  const unitW = Math.max(...texts.map(unitAdv));
  const px = Math.max(160, Math.round(unitW));            // 位图宽度取整（整数像素平铺最干净）

  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  cv.width = Math.round(px * dpr);
  cv.height = Math.max(1, Math.round(h * dpr));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, px, h);
  /**
   * ② 横向缩放到**整数像素宽**：实测宽度与取整后的宽度差不到 1px，
   * 但如果不缩放，每个平铺块都会攒出一点点缝。缩放量在千分之一上下，看不出来。
   */
  ctx.scale(px / unitW, 1);
  ctx.font = font;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';

  for (const [side, [top, bottom]] of Object.entries(BANDS)) {
    const text = bands[side];
    if (!text) continue;
    const u = unit(text);
    const bandTop = h * top;
    const gap = (h * (bottom - top)) / (LINES - 1);
    for (let i = 0; i < LINES; i += 1) {
      const lineY = bandTop + i * gap;
      const amp = gap * (0.22 + (i % 3) * 0.07);          // 波幅跟行距挂钩，行与行不会撞上
      // 一个波里放多少字：必须是 unitChars 的因数（不然平铺有缝），取最接近 20 的那个
      const waveChars = nearestDivisor(unitChars, 20) || WAVE_CHOICES[0];
      const wl = (unitW * waveChars) / unitChars;         // 波长整除一个周期的宽度
      wls.push(wl);
      /** 相位每行错开：整片才像水面，而不是 13 条一样的波（错开多少不影响平铺） */
      const phase = i * 1.7 + (side === 'enemy' ? 0.6 : 2.4) + (i % 2 ? 1.2 : 0);
      ctx.fillStyle = `rgba(${INK}, ${LINE_ALPHA[i % LINE_ALPHA.length]})`;
      /**
       * ③ 逐字沿正弦排布：位置按实测字宽累加，角度取这一点的切线。
       * 从 i=0 画到 unitChars+1：首尾各多画一个字，它们跨过平铺边界的部分由相邻那一块补上。
       */
      let x = 0;
      const order = [...u, u[0], u[1] ?? ''];
      for (const ch of order) {
        const a = (x / wl) * Math.PI * 2 + phase;
        const y = lineY + amp * Math.sin(a);
        // 切线角度 = atan(dy/dx)，dy/dx = amp·cos(a)·2π/wl
        const slope = (amp * Math.cos(a) * Math.PI * 2) / wl;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(Math.atan(slope));
        ctx.fillText(ch, 0, 0);
        ctx.restore();
        x += widthOf(ch);
      }
    }
  }
  return { url: cv.toDataURL('image/png'), unit: px, size, unitW, wls, canvas: cv };
}

/**
 * 造整层装饰。
 *
 * 返回的元素上挂了一个 `relayoutDecor(w, h)`：画位图（一个周期）并把三层铺上去。
 * 战场尺寸变了要重画（行距、字号、一个周期的宽度都跟着高度走），所以
 * battle-view 在 mount 与 resize 时各调一次。
 *
 * @param {{enemyText?:string, playerText?:string, fallback?:string}} opts
 * @returns {HTMLElement}
 */
export function battleDecor({ enemyText, playerText, fallback = '' } = {}) {
  const bands = { enemy: enemyText || fallback, player: playerText || fallback };
  const box = el('div', { class: 'battle-decor' });
  /**
   * 三层用**同一张位图**：不透明度写在 style.css 的 .decor-base / .decor-glow 里
   * （底色 0.10、高亮 0.22）——**不能写在内联样式上**，
   * 不然「那一侧行动时点亮」那条 CSS 规则根本盖不过内联值（第一次就是这么写的，
   * 结果两份高亮一直亮着，实测 0.22/0.22/0.22）。
   */
  const layers = [
    'decor-layer decor-base',
    'decor-layer decor-glow decor-glow-enemy',
    'decor-layer decor-glow decor-glow-player',
  ].map((cls) => {
    const node = el('div', { class: cls });
    box.append(node);
    return node;
  });

  let last = { w: 0, h: 0 };
  /**
   * @param {number} w 战场宽
   * @param {number} h 战场高
   * @param {boolean} force 尺寸没变也重画（字体晚一步加载好时要用它补一次，见 battle-view）
   */
  box.relayoutDecor = (w, h, force = false) => {
    const W = Math.round(w);
    const H = Math.round(h);
    if (!W || !H) return;
    if (!force && Math.abs(W - last.w) < 2 && Math.abs(H - last.h) < 2) return;
    last = { w: W, h: H };
    const { url, unit, size, unitW, wls, canvas } = paintPattern(bands, W, H);
    /**
     * `?decor=canvas`：把那张平铺位图本身摊在屏幕上（调试用）。
     * 花纹出问题时（比如字被叠成一列、接缝有缝）看它比看战场直接得多 ——
     * 战场上是三层叠着、还半透明，肉眼分不出是位图画错了还是铺错了。
     */
    if (new URLSearchParams(location.search).get('decor') === 'canvas') {
      canvas.style.cssText = `position:absolute;left:0;top:0;z-index:9;opacity:1;outline:2px solid #f0f;`
        + `width:${unit}px;height:${H}px;image-rendering:pixelated;`;
      if (canvas.parentNode !== box) box.append(canvas);
    }
    /**
     * 留在元素上给体检用的一组事实（smoke-check 会读它验「平铺无缝」）：
     * `unit` 是一个周期的像素宽（也就是滚动距离），`wls` 是每一行的波长 ——
     * 平铺无缝的数学条件就是**每一行的波长都能整除 unit**（否则接缝处波形对不上）。
     */
    box.decorFacts = { unit, size, unitW: Math.round(unitW), wls: wls.map((x) => Math.round(x * 100) / 100) };
    for (const node of layers) {
      node.style.backgroundImage = `url(${url})`;
      node.style.backgroundSize = `${unit}px 100%`;
      // 滚一个周期 = 回到逐像素相同的画面，所以这条动画永远不会「跳」
      node.style.setProperty('--roll', `${unit}px`);
      node.style.setProperty('--rollDur', `${(unit / 26).toFixed(1)}s`);   // 约 26 像素/秒
    }
  };
  return box;
}
