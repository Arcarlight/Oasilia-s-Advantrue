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
 * 每一行用**不同的波长**（3.1.2，用户：「每条波浪左右错开一点，现在这样感觉有点整齐」）。
 *
 * 波长有个硬约束：只能是「单元宽度 ÷ 整数」（见文件头，否则平铺有缝）。
 * 但那个**整数**每行可以不一样 —— 全都取同一个的话，各行的波峰会在竖直方向排成一列，
 * 整片看上去像一匹印花布；错开之后相邻行的波峰互相穿过去，才像水面。
 * 这 8 个数是「每行一个周期里放几个波」，故意不等距（含 7 这种质数，避免各行周期成倍数关系）。
 */
const WAVE_COUNTS = [3, 4, 5, 4, 3, 5, 4, 3];

/** 一个整数 n 的、最接近 target 的因数（用来挑「一个波里放多少字」） */
function nearestDivisor(n, target) {
  let best = 1;
  for (let d = 1; d <= n; d += 1) {
    if (n % d) continue;
    if (Math.abs(d - target) < Math.abs(best - target)) best = d;
  }
  return best;
}

/**
 * 挑「段与段之间补几个全角空格」。
 *
 * 两件事要同时满足，否则花纹就不对：
 *   · **缝要小**（用户：「每段中间的缝隙还是太大」）→ 补的空格越少越好；
 *   · 一个周期的**字数必须能分成几个完整的波** —— 波长只能是「单元宽度 ÷ 整数」，
 *     不然波长除不尽平铺周期，接缝处波峰对不上（会有竖缝）。
 * 踩过的坑：固定补 1 个空格时，最长那句图鉴文本正好凑出 53 个字 —— **质数**，
 * 约数只有 1 和 53，于是整个周期只能算一个波，波就没了。
 * 所以这里从 1 个空格往上试，找到第一个「有接近 18 的约数」的组合。
 */
function chooseUnitChars(maxChars, targetWave = 18) {
  for (let pad = 1; pad <= 6; pad += 1) {
    const n = maxChars + pad;
    const d = nearestDivisor(n, targetWave);
    if (d > 1 && Math.abs(d - targetWave) <= Math.max(2, targetWave * 0.35)) return { unitChars: n, waveChars: d, pad };
  }
  const n = maxChars + 1;
  return { unitChars: n, waveChars: nearestDivisor(n, targetWave), pad: 1 };
}

/**
 * 把「一个周期的花纹」画成位图。
 * @returns {{url:string, unit:number, size:number}} 位图地址、一个周期的像素宽、字号
 */
function paintPattern(bands, w, h) {
  // 字号随场地高度走：0.045 倍（行距是它的 1.55 倍上下，行与行之间才有呼吸）
  const size = Math.max(14, Math.min(34, Math.round(h * 0.045)));
  const texts = Object.values(bands).filter(Boolean);
  const maxChars = Math.max(...texts.map((t) => [...t].length));
  // 补几个空格、一个波里放几个字：两件事一起挑（见 chooseUnitChars 的说明）
  const { unitChars, waveChars } = chooseUnitChars(maxChars, 18);
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
  /** 排布时的步进 = 字形宽度 + 字距（两边用同一条规则，不然位图和量到的宽度对不上） */
  const stepOf = (ch) => widthOf(ch) + size * TRACKING;
  const unitAdv = (t) => [...unit(t)].reduce((s, ch) => s + stepOf(ch), 0);
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
      const amp = gap * (0.26 + (i % 3) * 0.05 + (i % 2 ? 0.04 : 0));   // 波幅跟行距挂钩，行与行不会撞上
      /**
       * 这一行的波长 = 单元宽度 ÷ 整数（`WAVE_COUNTS[i]`）。
       * 两半场错开一位取，免得上下两半的节奏刚好对齐。
       */
      const waveCount = WAVE_COUNTS[(i + (side === 'player' ? 3 : 0)) % WAVE_COUNTS.length];
      const wl = unitW / waveCount;
      wls.push(wl);
      /**
       * 相位：按**黄金角**（2.399 弧度）逐行递增 —— 相邻行的波峰错开的角度和周期「不成倍数」，
       * 于是它们永远不会排成一列（用 i*1.7 这种等差相位时，隔几行就会重新对齐）。
       */
      const phase = i * 2.399 + (side === 'enemy' ? 0.6 : 2.4);
      ctx.fillStyle = `rgba(${INK}, ${LINE_ALPHA[i % LINE_ALPHA.length]})`;
      /**
       * ③ 逐字沿正弦排布：位置按实测字宽累加，角度取这一点的切线。
       *
       * ⚠ 每一行的起点还要错开，而且要用**黄金比**那种不规则间距（`i * 0.618` 取小数部分）：
       * 所有行共用同一套字形网格、波长又一样的话，段与段之间的空隙会在纵向排成一列列竖缝，
       * 看着像表格格子（用户报的「每段中间的缝隙还是太大」有一半是这个原因）。
       * 黄金比错位能让空隙永远不在同一列上相遇。起点错开不影响平铺。
       *
       * 从 -2 画到 unitChars+2：首尾各多画两个字，它们跨过平铺边界的部分由相邻那一块补上。
       */
      const order = [];
      for (let k = -2; k <= unitChars + 2; k += 1) order.push(u[((k % unitChars) + unitChars) % unitChars]);
      let x = -2 * stepOf(u[0]) - ((i * 0.618) % 1) * size;
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
        x += stepOf(ch);
      }
    }
  }
  warnIfBandEmpty(cv, h, size);
  return { url: cv.toDataURL('image/png'), unit: px, size, unitW, wls, canvas: cv };
}

/**
 * 画完自查：两个半场里**各自都得有字**。
 *
 * 一层花纹「某一半是空的」这种失效最阴 —— 不报错、不提示，只是安静地留白，
 * 而玩家看到的是「我方这边有很大一块空白」。所以画完随手数几行像素，
 * 空了就在控制台上直说（带上当时的尺寸与参数，方便照着重现）。
 */
function warnIfBandEmpty(canvas, h, size) {
  try {
    const ctx = canvas.getContext('2d');
    const dpr = canvas.height / Math.max(1, h);
    const inkIn = (from, to) => {
      let n = 0;
      // 只抽 6 行来数（整块 getImageData 是一份大拷贝，而且这里只要「有没有」）
      for (let k = 0; k < 6; k += 1) {
        const y = Math.round((from + ((to - from) * k) / 5) * dpr);
        if (y < 0 || y >= canvas.height) continue;
        const row = ctx.getImageData(0, y, canvas.width, 1).data;
        for (let i = 3; i < row.length; i += 4) if (row[i] > 0) n += 1;
      }
      return n;
    };
    const inkE = inkIn(h * BANDS.enemy[0], h * BANDS.enemy[1]);
    const inkP = inkIn(h * BANDS.player[0], h * BANDS.player[1]);
    if (!inkE || !inkP) {
      console.warn('[decor] 花纹有一半是空的（敌人 ' + inkE + ' 像素 / 主角 ' + inkP + ' 像素）'
        + ' —— h=' + h + ' size=' + size + '，多半是那一半的图鉴文本缺了');
    }
  } catch { /* 自查出问题也不该影响画面 */ }
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
  const debugCanvas = new URLSearchParams(location.search).get('decor') === 'canvas';
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
    const { url, unit, size, unitW, wls, canvas } = paintPattern(bands, W, H);
    last = { w: W, h: H };
    for (const node of layers) node.style.backgroundImage = `url(${url})`;
    applyToLayers(unit, H);
    /**
     * `?decor=canvas`：把那张平铺位图本身摊在屏幕上（调试用）。
     * 花纹出问题时（比如字被压扁、接缝有缝）看它比看战场直接得多 ——
     * 战场上是三层叠着、还半透明，肉眼分不出是位图画错了还是铺错了。
     */
    if (debugCanvas) {
      canvas.style.cssText = `position:absolute;left:0;top:0;z-index:9;opacity:1;outline:2px solid #f0f;`
        + `width:${unit}px;height:${H}px;image-rendering:pixelated;`;
      if (canvas.parentNode !== box) box.append(canvas);
    }
    /**
     * 留在元素上给体检用的一组事实（smoke-check 会读它们）：
     * `unit` = 一个周期的像素宽（= 滚动距离），`wls` = 每一行的波长 ——
     * 平铺无缝的数学条件就是**每一行的波长都能整除 unit**；
     * `h` = 位图的高度，它必须等于现在场地的真实高度（不等就会被拉伸变形）。
     */
    box.decorFacts = { unit, size, h: H, unitW: Math.round(unitW), wls: wls.map((x) => Math.round(x * 100) / 100) };
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
