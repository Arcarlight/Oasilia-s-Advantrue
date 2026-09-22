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
//   · 文字：每一行的重复单元 = 图鉴文本 + 一个全角空格（缝里留一口气）；
//   · 波长：必须能整除位图宽度，所以波长取「位图宽度 ÷ 波数」（那个波数每行不同）；
//   · 字形网格：按**实测字宽**逐个累加排布（图鉴文本里有半角数字，1 和汉字的宽度不一样，
//     不能假设「一个字符正好一个字号宽」），而两个半场各按各的宽度缩放到**整数像素宽**
//     ——两个半场的文本长度不一样（半角数字只占半个字宽），各缩各的才不会在接缝处对不齐。
//   · 每行排到哪里为止：**一直排到铺满整幅位图**（3.1.3 修的，之前会空出右端一截）。
//
// 变亮：三层用同一张位图，只是 `opacity` 不同（底色 0.10 / 高亮 0.22），
// 高亮那两份再用 radial-gradient 的 mask 圈住自己那一侧（敌人右上、主角左下）。
// 「同一张图 + 只改 opacity」这一点很重要：变亮就是同一片文字更亮一点，不会多出别的形状。
//
// 手感 / 眼感的对账工具（这一路的需求都是「看着太整齐了」这类主观话）：
//   · `?decor=canvas` 把那张位图本身摊在屏幕上（看接缝、看字形对不对最直接）；
//   · `?decor=probe` 逐像素量一遍，打印每行的波峰位置、字格起点、最长的一段空白，
//     以及两个半场左 / 中 / 右的字迹量。
import { el } from './dom.js';

/**
 * 每个半场铺几行，以及字号 / 字距的取法。
 *
 * 这一路被用户来回拧过五次，最后一次（3.1）把两个毛病一起说了出来：
 * 「这也还是太密了，而且我方这边还是有很大的空格」—— 这两句其实是**两个方向**：
 *   · 「太密」= 一行里的字挤成一条黑带（横向没有呼吸）；
 *   · 「空格大」= 行与行之间的空白带太宽（纵向节奏太散）。
 * 所以不能只往一个方向拧，这一版两头各让一步：
 *   · 行数 7 → **8**、字号收到 **0.045 倍场地高**（行距/字号 ≈ 1.55，和上一版一样有呼吸）；
 *   · 字距 **0.06 → 0.11**：横向把字拉开一点，一行才不像一条黑带；
 *   · 两个行带压满整个场地（0.00~0.49 / 0.51~1.00）：中间那条带间空隙从 8% 缩到 **2%**，
 *     场地中央不再有一条横贯整屏的空白带；
 *   · 半场的文本**永远不为空**：某一边缺文本时用另一边的顶上（见 battleDecor），
 *     否则那整半就是空的（那种失效看起来就是「我方这边有很大的空格」）。
 */
const LINES = 8;
/** 上半（敌人）与下半（主角）各自的行带（相对场地高度的比例，留出起伏余量） */
const BANDS = { enemy: [0.0, 0.49], player: [0.51, 1.0] };
/** 字距（相对字号）：给花纹留一点空气，不然一整行字挤成一条黑带 */
const TRACKING = 0.11;
/** 每行自己的浓淡（画进位图里，避免整片一个调子；整层的不透明度写在 style.css） */
const LINE_ALPHA = [0.45, 0.60, 0.75, 0.90];
/** 位图里文字的填充色（暖白；用户要的是「和背景颜色相近」） */
const INK = '255, 241, 216';

/**
 * 每一行用**不同的波长**（3.1.2）。
 *
 * 波长有个硬约束：只能是「一个周期的宽度 ÷ 整数」（见文件头，否则平铺有缝）。
 * 但那个**整数**每行可以不一样 —— 全都取同一个的话，各行的波峰会在竖直方向排成一列，
 * 整片看上去像一匹印花布；错开之后相邻行的波峰互相穿过去，才像水面。
 * 这 8 个数故意不等距（含 5 这种质数，避免各行周期成倍数关系）。
 */
const ROW_WAVES = [3, 4, 5, 4, 3, 5, 4, 3];

/**
 * 每一行的**起点**（3.1.3，用户：「我说的左右错开是指 x 轴上每一道波我希望起点都在不同位置，
 * 而不是现在像方便面一样 x 轴全都对齐」）。
 *
 * 3.1.2 这里写的是 `(i * 0.618) % 1` —— 黄金比取小数。它确实把各行错开了，而且错得**特别均匀**：
 * 「低差异序列」的定义就是「任意两个点的间距都差不多」。可在花纹上「均匀」正是「规律」，
 * 眼睛看到的是一排等距斜过去的面条。更要命的是它只错开**不到一个字**：
 * 同一半场里各行用的是同一段文本、又是同一套字格，于是同一个字在竖直方向排成了一列列 ——
 * `?decor=probe` 量出来各行的字格偏移只有 0/0/20/6/2/24/8/20 像素，而一个字有 26 像素宽，
 * 也就是说「看得出来是在同一列上」。
 *
 * 现在改成**整段文本一起转**：这一行从第几个字开始排。转小半段就是几百像素，
 * 各行在同一个 x 上用的完全是文本里不同的位置，字柱自然就散了。
 * 这 8 个比例是手挑的 —— 不按等差、也不按黄金比：相邻两行间距忽大忽小（0.11~0.30 个周期），
 * 而且任意两行都不会挨得太近（最小间隔 0.09 ≈ 一个字的宽度）。
 */
const ROW_START = [0.00, 0.64, 0.24, 0.88, 0.39, 0.14, 0.75, 0.48];
/** 起点再补一个**不到一个字**的零头：只转整字的话，两行的字格仍然落在同一个网格上 */
const ROW_DRIFT = [0.00, 0.37, 0.71, 0.13, 0.58, 0.92, 0.26, 0.85];
/**
 * 每一行的波峰落在自己波长里的什么位置（比例，0 = 波峰贴着左边缘）。
 *
 * 这是「波从哪儿起」的第二个旋钮，和 ROW_START 各管一头：起点管**字**排在哪里，
 * 相位管**波**鼓在哪里。原来是 `i * 2.399`（又是低差异序列），所以量出来会有
 * 「两行的波峰都在第 194 像素」这种巧合（用户的「全都对齐」有它一份）。
 */
const ROW_CREST = [0.10, 0.85, 0.55, 0.30, 0.62, 0.92, 0.07, 0.43];
/**
 * 波幅（相对行距）。原来写的是 `0.26 + (i%3)*0.05 + (i%2 ? 0.04 : 0)` ——
 * 那本身就是个周期为 6 的花样，整片看上去像一张瓦楞纸。
 * 换成手挑的一串：大的小的交替，但没有周期。
 */
const ROW_AMP = [0.34, 0.21, 0.30, 0.24, 0.37, 0.20, 0.28, 0.33];

/** 以上四个表都按「行号」取；主角那一半再挪 3 格，免得上下两半的节奏刚好对上 */
const rowAt = (i, side) => (i + (side === 'player' ? 3 : 0)) % LINES;

/**
 * 把「一个周期的花纹」画成位图。
 * @returns {{url:string, unit:number, size:number, rows:RowFact[]}} 位图地址、一个周期的像素宽、字号
 */
function paintPattern(bands, h) {
  // 字号随场地高度走：0.045 倍（行距是它的 1.55 倍上下，行与行之间才有呼吸）
  const size = Math.max(14, Math.min(34, Math.round(h * 0.045)));
  /**
   * 每行的重复单元 = 图鉴文本 + 一个全角空格（缝里留一口气）。
   *
   * ⚠ 补空格**不再需要在字数上凑约数**：波长现在是「一个周期的宽度 ÷ 波数」，
   * 除得尽与否跟文本有几个字无关。（3.1.2 之前是「单元宽度 ÷ 字数约数」，
   * 而最长那句图鉴正好 53 个字 —— 质数，约数只有 1 和 53，一个周期里只剩一个波，
   * 波形就没了；那段折腾记在 ROW_WAVES 上。）
   */
  const unit = (t) => t + '　';

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
  /** 排布时的步进 = 字形宽度 + 字距（两边用同一条规则，不然位图和量到的宽度对不上） */
  const stepOf = (ch) => widthOf(ch) + size * TRACKING;
  const advOf = (t) => [...t].reduce((s, ch) => s + stepOf(ch), 0);
  /**
   * 两个半场各量各的：图鉴文本的长度不一样（半角数字只占半个字宽），
   * 所以**各按各的缩放**，让每一半都严格以 px 为周期（见下面 `s`）。
   * 原来是一个全局缩放（px / 最长那一半）：短的那一半周期就不是 px，
   * 平铺到接缝处会对不齐，而且字串排不满整幅位图 —— `?decor=probe` 量到右端
   * 有 50~62 像素宽的空白（每个周期一条竖向空白带）。
   */
  const pad = { enemy: unit(bands.enemy ?? ''), player: unit(bands.player ?? '') };
  const bandW = { enemy: advOf(pad.enemy), player: advOf(pad.player) };
  const unitW = Math.max(bandW.enemy, bandW.player);
  const px = Math.max(160, Math.round(unitW));            // 位图宽度取整（整数像素平铺最干净）

  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  cv.width = Math.round(px * dpr);
  cv.height = Math.max(1, Math.round(h * dpr));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, px, h);
  ctx.font = font;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';

  const rows = [];
  for (const [side, [top, bottom]] of Object.entries(BANDS)) {
    const u = pad[side];
    if (!u) continue;
    const n = u.length;
    /** 这一半的横向缩放：一个周期正好等于 px（这样平铺接缝处逐像素接得上） */
    const s = px / bandW[side];
    const bandTop = h * top;
    const gap = (h * (bottom - top)) / (LINES - 1);
    for (let i = 0; i < LINES; i += 1) {
      const k = rowAt(i, side);
      const lineY = bandTop + i * gap;
      const amp = gap * ROW_AMP[k];
      /** 这一行的波长 = 一个周期的宽度 ÷ 波数（`ROW_WAVES[i]`）—— 两边场各取各的表项 */
      const wl = px / ROW_WAVES[k];
      wls.push(wl);
      /** 相位：把波峰挪到这一行自己的 ROW_CREST 位置（0 = 贴着左边缘） */
      const phase = Math.PI / 2 - ROW_CREST[k] * Math.PI * 2;
      /** 这一行的字从文本的哪儿起（体检报告里要报一个像素数，见 probeTile） */
      const startIdx = Math.round(ROW_START[k] * n) % n;
      const startPx = startIdx * size * (1 + TRACKING) + ROW_DRIFT[k] * size;
      rows.push({
        band: side, i, lineY, amp, wl, phase,
        start: ROW_START[k], crestFrac: ROW_CREST[k], startPx,
      });
      ctx.fillStyle = `rgba(${INK}, ${LINE_ALPHA[i % LINE_ALPHA.length]})`;
      /**
       * 这一行的字串从第 `startIdx` 个字开始循环取用，起点再往左挪一个零头。
       * 从 x = -零头 一路排到**铺满整幅位图**（`sx >= px` 才停）：
       * 排到 x < 0 的部分会被画布裁掉，由左边相邻那一块（也就是上一周期的尾巴）补上 ——
       * 因为整个排布（字格 + 波）严格以 px 为周期，接缝处本来就是逐像素相同的。
       */
      const charAt = (j) => u[(((startIdx + j) % n) + n) % n];
      let xu = -ROW_DRIFT[k] * size;
      for (let j = 0; j < n + 40; j += 1) {
        const ch = charAt(j);
        const sx = xu * s;
        if (sx >= px) break;
        const a = (sx / wl) * Math.PI * 2 + phase;
        const y = lineY + amp * Math.sin(a);
        // 切线角度 = atan(dy/dx)，dy/dx = amp·cos(a)·2π/wl
        const slope = (amp * Math.cos(a) * Math.PI * 2) / wl;
        ctx.save();
        ctx.translate(sx, y);
        ctx.rotate(Math.atan(slope));
        ctx.scale(s, 1);
        ctx.fillText(ch, 0, 0);
        ctx.restore();
        xu += stepOf(ch);
      }
    }
  }
  const fill = inkReport(cv, px, h);
  return { url: cv.toDataURL('image/png'), unit: px, size, unitW, wls, canvas: cv, rows, fill };
}

/**
 * 每一行的几何事实（`?decor=probe` 用它，逐像素反推「这一行的波到底从哪儿起」）。
 * @typedef {{band:string, i:number, lineY:number, amp:number, wl:number, phase:number}} RowFact
 */

/**
 * `?decor=probe`：把**已经画好的那张位图**逐像素量一遍，把数字打到控制台。
 *
 * 为什么要有这个：花纹这一路被用户来回拧，判据一直是「看着像不像波浪」这种主观话，
 * 而这几件事其实能量 ——
 *
 *   ① **每一行的波从哪儿起**：位图里每行的字都严格贴着一条正弦排，
 *      所以拿每一列的字形重心 y 去和这一行自己的 sin/cos 做一次相关，就能把那行的相位反解出来
 *      （见下面的 atan2），再换成「波峰离左边缘多少像素」。这是可以和用户对账的数字。
 *   ② **每一行的字从哪儿起**：`startPx` = 这一行从文本的第几个字开始排、换成像素是多少。
 *      这一条是**算出来的**（画的时候就是这么摆的），不是量出来的：
 *      本来想用「每列墨量做互相关、看峰值 lag」，试过，不成立 —— 半角数字让字格不均匀，
 *      加上一个周期正好整除了，lag 有周期性歧义（算出来 106 而真值是 609），
 *      与其留一个不可信的指标，不如直接用画的时候那个数。
 *   ③ **这幅位图是不是整幅都铺满了字**：字串没排满一个周期，位图右端就会空一截 ——
 *      平铺出去是「每个周期一条竖向空白带」。3.1.2 就是这样（量到 50~62 像素宽），
 *      用户看不到但迟早会以「那边有一块空的」报上来。这里按列统计，报出最长的一段空白。
 *
 * ⚠ 每列的重心要按**帐篷权重**算（离这一行的中线越远越不算数）：
 * 相邻行本来就是上下叠着的（波幅大于行距的一半），直接取窗口内的重心会把邻居的字也算进来，
 * 反解出来的相位就是错的（第一版就是这么错的：算出来 194 和 195 两行「同相」，实际差着半个周期）。
 */
function probeTile(canvas, px, h, size, rows) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const { width: cw, height: ch } = canvas;
  const img = ctx.getImageData(0, 0, cw, ch).data;
  const sxf = cw / px;                      // 位图坐标 → 画布坐标（dpr）
  const syf = ch / h;
  const alpha = (x, y) => img[(y * cw + x) * 4 + 3];
  const out = { unit: px, size, bands: {} };
  for (const band of [...new Set(rows.map((r) => r.band))]) {
    const mine = rows.filter((r) => r.band === band);
    const y0 = Math.min(...mine.map((r) => r.lineY - r.amp - size));
    const y1 = Math.max(...mine.map((r) => r.lineY + r.amp + size));
    // ① 覆盖率：逐列看这一半有没有字，找最长的一段空白
    let run = 0; let worst = 0; let worstAt = 0; let empty = 0;
    for (let x = 0; x < cw; x += 1) {
      let ink = 0;
      for (let y = Math.max(0, Math.round(y0 * syf)); y < Math.min(ch, Math.round(y1 * syf)); y += 1) ink += alpha(x, y);
      if (ink > 0) { run = 0; continue; }
      empty += 1; run += 1;
      if (run > worst) { worst = run; worstAt = x; }
    }
    // ② 逐行量相位、报字格起点
    const lines = mine.map((r) => {
      const half = r.amp + size * 0.6;                       // 帐篷权重的作用半径
      const top = Math.max(0, Math.round((r.lineY - half) * syf));
      const bot = Math.min(ch, Math.round((r.lineY + half) * syf));
      const cy = [];                                         // 这一行的「每列字形重心 y」
      for (let x = 0; x < cw; x += 1) {
        let sum = 0; let wy = 0;
        for (let y = top; y < bot; y += 1) {
          const a = alpha(x, y);
          if (!a) continue;
          const w = a * Math.max(0, 1 - Math.abs(y / syf - r.lineY) / half);
          sum += w; wy += w * (y / syf);
        }
        cy.push(sum > 0 ? wy / sum : NaN);
      }
      let sy = 0; let n = 0;
      for (const v of cy) if (Number.isFinite(v)) { sy += v; n += 1; }
      const mean = n ? sy / n : 0;
      let sa = 0; let ca = 0;
      for (let x = 0; x < cw; x += 1) {
        if (!Number.isFinite(cy[x])) continue;
        const th = ((x / sxf) / r.wl) * Math.PI * 2;
        sa += (cy[x] - mean) * Math.sin(th);
        ca += (cy[x] - mean) * Math.cos(th);
      }
      const phase = Math.atan2(ca, sa);                      // y = lineY + amp·sin(2πx/wl + phase)
      const frac = (a) => (((a / (Math.PI * 2)) % 1) + 1) % 1;
      return {
        row: r.i,
        wl: Math.round(r.wl),
        crest: Math.round(frac(Math.PI / 2 - phase) * r.wl),          // 量出来的波峰位置
        want: Math.round(frac(Math.PI / 2 - r.phase) * r.wl),         // 画的时候用的（对不上就是画错了）
        /**
         * 这一行的量测窗口被位图边缘切了一半 —— 半场的第一行正好压在场地上沿（`BANDS` 从 0 开始），
         * 它的字本来就有一半在画布外，重心是偏的，**这一行的 `crest` 不能拿来对账**
         * （实测那行的量出来 208、画的是 32，一度以为是画错了）。其余各行才对得上。
         */
        clipped: r.lineY - half < 0 || r.lineY + half > h,
        startPx: Math.round(r.startPx),                              // 这一行从文本的哪儿开始（算出来的）
      };
    });
    out.bands[band] = {
      bandY: [Math.round(y0), Math.round(y1)],
      emptyCols: Math.round(empty / sxf),
      maxEmptyRun: Math.round(worst / sxf),
      maxEmptyAt: Math.round(worstAt / sxf),
      wls: lines.map((l) => l.wl),
      crests: lines.map((l) => l.crest),
      wantCrests: lines.map((l) => l.want),
      clipped: lines.map((l) => (l.clipped ? 1 : 0)).join(''),
      startPx: lines.map((l) => l.startPx),
    };
  }
  console.log('[decor] probe ' + JSON.stringify(out));
}

/**
 * 画完自查，顺便交出一张「字迹体检表」（冒烟测试拿它当门禁）。两件事：
 *
 *   ① **两个半场里各自都得有字**。「某一半是空的」这种失效最阴 —— 不报错、不提示，
 *      只是安静地留白，而玩家看到的是「我方这边有很大一块空白」。
 *   ② **这一半里最长的一段没有字的竖条有多少像素**（`maxEmptyRun`）。
 *      字串没排满一个周期的话，位图右端会空一截，平铺出去就是「每个周期一条竖向空白带」——
 *      3.1.2 就是这个毛病（`?decor=probe` 量到 50~62 像素宽），当时没有任何东西拦得住它。
 *
 * ⚠ 判据必须是**连续空白有多长**，不能是「两端那一条里有没有字」：
 * 第一版就是量「左 / 中 / 右三条竖带里有多少字迹」，结果的带宽是三个字宽（≈78px），
 * 而那个毛病留下的空白只有 50~60px —— 注入 bug 验证的时候，右端明明空了一截，
 * 条带里仍然有 1100 多个字迹像素，这条门禁**照样放行**。所以这里按列统计，
 * 最长空白取真值；「端头有没有字」只作为报告里的参考数字。
 *
 * 阈值在冒烟那边：**一个字宽以内算正常**（段与段之间补的那个全角空格本身就是这么宽），
 * 超过一个字宽就说明没排满。
 */
function inkReport(canvas, px, h) {
  const out = {};
  try {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const dpr = canvas.width / Math.max(1, px);
    for (const [side, [top, bottom]] of Object.entries(BANDS)) {
      const cy = Math.max(0, Math.round(h * top * dpr));
      const chh = Math.max(1, Math.min(canvas.height - cy, Math.round(h * (bottom - top) * dpr)));
      const d = ctx.getImageData(0, cy, canvas.width, chh).data;
      /** 每一列的字迹像素数（这一半里所有行加在一起） */
      const col = new Array(canvas.width).fill(0);
      for (let y = 0; y < chh; y += 1) {
        const row = y * canvas.width * 4;
        for (let x = 0; x < canvas.width; x += 1) col[x] += d[row + x * 4 + 3];
      }
      let run = 0; let worst = 0; let worstAt = 0;
      for (let x = 0; x < canvas.width; x += 1) {
        if (col[x] > 0) { run = 0; continue; }
        run += 1;
        if (run > worst) { worst = run; worstAt = x; }
      }
      const w = Math.round(canvas.width * 0.08);                 // 端头那一条取 8% 宽
      const sum = (from, to) => col.slice(from, to).reduce((a, b) => a + b, 0);
      out[side] = {
        left: sum(0, w),
        mid: sum(Math.round(canvas.width / 2 - w / 2), Math.round(canvas.width / 2 + w / 2)),
        right: sum(canvas.width - w, canvas.width),
        maxEmptyRun: Math.round(worst / dpr),
        maxEmptyAt: Math.round(worstAt / dpr),
      };
      const v = out[side];
      if (!v.left && !v.mid && !v.right) {
        console.warn('[decor] 花纹有一半是空的（' + side + '） —— h=' + h + '，多半是那一半的图鉴文本缺了');
      }
    }
  } catch { /* 自查出问题也不该影响画面 */ }
  return out;
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
  /**
   * 半场的文本**永远不为空**：某一边缺文本（物种没登记、抓取漏了、主角那条没生成）时
   * 用另一边顶上 —— 否则那一整半就是空的。用户看到的「我方这边有很大的空格」
   * 就是这种失效的样子（空的那半不会有任何提示，只是安静地留白）。
   */
  const enemy = enemyText || playerText || fallback;
  const player = playerText || enemyText || fallback;
  const bands = { enemy, player };
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
  const decorParam = new URLSearchParams(location.search).get('decor');
  const debugCanvas = decorParam === 'canvas';
  const probe = decorParam === 'probe';
  /**
   * 把位图铺到三层上。
   *
   * ⚠ `background-size` 的高度**必须是画进去的那个高度**（px），不能写 100%。
   * 写 100% 的话，只要「画的时候的高度」和「现在显示的高度」不一致，整幅图就被**纵向拉伸**：
   * 用户截图报的「既没有波也没有浪，全是一块一块的」就是这么来的 ——
   * 场地某一刻量到的高度偏大、之后变矮，于是每个字被压成一条横杠。
   * 现在用真实像素高度 + 纵向居中：即便重画晚了一帧，也只会轻微裁掉上下一两行，不会变形。
   */
  const applyToLayers = (unit, paintH) => {
    for (const node of layers) {
      node.style.backgroundSize = `${unit}px ${paintH}px`;
      node.style.backgroundPosition = '0 50%';
      // 滚一个周期 = 回到逐像素相同的画面，所以这条动画永远不会「跳」
      node.style.setProperty('--roll', `${unit}px`);
      node.style.setProperty('--rollDur', `${(unit / 26).toFixed(1)}s`);   // 约 26 像素/秒
    }
  };

  /**
   * 场地尺寸变了就重画。
   * @param {number} w 场地宽
   * @param {number} h 场地高
   * @param {boolean} force 尺寸没变也重画（字体晚一步加载好时要用它补一次，见 battle-view）
   */
  box.relayoutDecor = (w, h, force = false) => {
    const W = Math.round(w);
    const H = Math.round(h);
    // 太小的量测直接跳过（场地还没排好版时的 0 / 几像素会让位图压根不成形）
    if (W < 120 || H < 120) return;
    if (!force && Math.abs(W - last.w) < 1 && Math.abs(H - last.h) < 1) return;
    const { url, unit, size, unitW, wls, canvas, rows, fill } = paintPattern(bands, H);
    last = { w: W, h: H };
    for (const node of layers) node.style.backgroundImage = `url(${url})`;
    applyToLayers(unit, H);
    if (probe) probeTile(canvas, unit, H, size, rows);
    /**
     * `?decor=canvas`：把那张平铺位图本身摊在屏幕上（调试用）。
     * 花纹出问题时（比如字被压扁、接缝有缝）看它比看战场直接得多 ——
     * 战场上是三层叠着、还半透明，肉眼分不出是位图画错了还是铺错了。
     */
    if (debugCanvas) {
      canvas.style.cssText = `position:absolute;left:0;top:0;z-index:9;opacity:1;outline:2px solid #f0f;`
        + `width:${unit}px;height:${H}px;image-rendering:pixelated;`;
      /**
       * ⚠ 每次重画都要**先把上一张挪走**：场地尺寸一变就会重画，几张位图叠在同一个位置上
       * （都是 opacity:1），看起来像「字重影／一片糊」，很容易被当成花纹本身画错了 ——
       * 第一次拿 `?decor=canvas` 看这张图时就被骗过一回。
       */
      box.__dbgCanvas?.remove?.();
      box.__dbgCanvas = canvas;
      box.append(canvas);
    }
    /**
     * 留在元素上给体检用的一组事实（smoke-check 会读它们）：
     * `unit` = 一个周期的像素宽（= 滚动距离），`wls` = 每一行的波长 ——
     * 平铺无缝的数学条件就是**每一行的波长都能整除 unit**；
     * `h` = 位图的高度，它必须等于现在场地的真实高度（不等就会被拉伸变形）；
     * `fill` = 两个半场在位图左 / 中 / 右三条竖带上的字迹像素数（任何一条是 0
     *   都意味着平铺出去会看到空白带，见 inkReport）。
     */
    box.decorFacts = {
      unit, size, h: H, unitW: Math.round(unitW),
      wls: wls.map((x) => Math.round(x * 100) / 100), fill,
    };
    /**
     * 打到控制台的一份诊断（`?decor=canvas` 时才打）：窗口尺寸一变，行距 / 字号 / 波长
     * 都跟着变，「这一版在别人那台机器上到底长什么样」只能靠这行日志复现。
     */
    if (debugCanvas) console.log('[decor] ' + JSON.stringify({ ...box.decorFacts, bands: BANDS }));
    /**
     * 两个行带的位置（相对场地高度的比例）也交出去：battle-view 要按它算高亮的纵向中心。
     * 为什么不用精灵自己的中心：精灵贴着场地边（我方在最左、对手偏上），
     * 拿它的中心当圆心，圈有一半落在场地外、剩下的大半被角色信息卡盖住 ——
     * 实测我方那侧只亮了 +3.6%，对手那侧 +12.8%，玩家看出来就是「我方不会点亮」。
     */
    box.decorBands = { enemy: BANDS.enemy, player: BANDS.player };
  };

  /**
   * 每次布局都对一次账：**位图的高度必须等于场地现在的真实高度**。
   * 不等就立刻重画（上面那条「不许写 100%」是防线，这里是根治）。
   */
  box.syncDecor = () => {
    const r = box.getBoundingClientRect?.();
    if (!r?.width || !r?.height) return;
    if (Math.abs(Math.round(r.height) - last.h) >= 1 || Math.abs(Math.round(r.width) - last.w) >= 1) {
      box.relayoutDecor(r.width, r.height);
    }
  };
  return box;
}
