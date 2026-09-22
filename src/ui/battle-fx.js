// 战斗里那套「贴图特效」的总台（3.1.4 从 battle-view.js 里拆出来的）。
//
// ---------------------------------------------------------------------------
// 素材：Kenney 的粒子包，39 张图（tools/copy-kenney.mjs 拷进 assets/img/fx/）
// ---------------------------------------------------------------------------
// 它们不是「一个特效的若干帧」，而是**一族一族的不同形状**（对比过 md5 和像素）：
//   spark_01~07  七道闪电（形状各异：细的、炸开的、折线的…）
//   star_01~09   一整套星芒：小星 → 圆环(02/03) → 柔光球 → 四芒 → 六芒 → 八芒爆闪(09)
//   trace_01~07  竖着的流光条（细线 / 波浪 / 粗条，当飞行物与残影用）
//   twirl_01~03  月牙弧（三个角度）
//   dirt_1/2 土块 · flare_1 小闪 · light_1 同心光环 · magic_1 符文阵 · magic_2 罗盘星
//   slash_1 斩击 · smoke_1 烟
//
// ---------------------------------------------------------------------------
// ⚠ 为什么全部改成「遮罩上色」（这一版最大的一个发现）
// ---------------------------------------------------------------------------
// 这些贴图**全是纯灰的** —— 逐像素量过最高饱和度：magic_1 0.00、flare_1 0.00、
// star_09 0.00、light_1 0.01（脚本见下面的注释）。而上一版给每种状态配的「中毒=绿雾、
// 灼伤=火光、出血=红痕」用的是 CSS `filter: hue-rotate()` —— **对灰色一点作用都没有**
// （色相旋转改的是颜色，灰没有颜色可改）。
// 也就是说那套配色从写下来那天起就没生效过：中毒和灼伤看起来一模一样，
// 「用一点特效区分状态」这件事其实一件都没做到。
//
// 现在的做法：**贴图当背景**（形状与羽化边都在，这条路上玩家一直看得见特效），
// 颜色交给元素自己的 `filter`（`sepia → hue-rotate → saturate → brightness`，见 tintFilter）。
// 这样同一张白星芒可以是金的（强化）、绿的（中毒）、青的（护盾）、红的（出血），
// 而且**换颜色不换形状**这件事是真的了（以前连形状都只用了两张）。
//
// ⚠ 中途试过「拿贴图 alpha 当 mask + background-color 上色」——在无头浏览器里是好的，
// 但玩家机器上**整个特效层渲染成了全透明**（报「什么特效都没了」，而同一时间护盾的闪白
// 还是好的，说明普通 CSS 没问题、是 mask 那条路不通）。所以退回到 background-image + filter。
//
// 怎么量：`ffmpeg -i x.png -f rawvideo -pix_fmt rgba -` 拿原始像素，
// 逐点算 (max-min)/max 取最大值；纯灰的图这个值恒为 0。
import { el } from './dom.js';

/**
 * `?fxfreeze=1`：把特效**定住不消失**（截图 / 诊断用）。
 *
 * 为什么要它：特效是一闪而过的，而 shot.mjs 跑在虚拟时间下、CSS 动画又不跟虚拟时间走
 * （见 tools/shot.mjs 的说明）—— 普通截图根本拍不到「打中的那一下」。
 * 定住之后可以把一次真实的命中拍下来看（而不是只能看 ?dgfxdemo=1 摆的那一套）。
 */
const FREEZE = typeof location !== 'undefined' && /[?&]fxfreeze=1/.test(location.search);

/**
 * 目标色 → 一串 CSS `filter`。
 *
 * ⚠ 为什么不用「拿 alpha 当 mask + background-color 上色」那套（3.1.4 初版就是那么写的）：
 * 玩家报「**什么特效都没了**」，而**护盾的闪白还在** —— 闪白是普通的 CSS filter，
 * 而 mask 那套在玩家的机器上渲染成了全透明（形状来自 mask，mask 没了就是什么都没有）。
 * 更要紧的是：**改之前用 background-image 的那些普攻特效，玩家本来一直看得见** ——
 * 也就是说这一套「贴图当背景 + filter 上色」才是被验证过能跑的做法。
 *
 * 具体做法：贴图本身是**纯白**的（见文件头），先用 `sepia(1)` 把它染成暖奶油色
 * （色相约 35°），再 `hue-rotate` 转到目标色相、`saturate` 把灰白图拉出颜色、
 * `brightness` 压出深浅。`filter` 不改 alpha —— 所以贴图的形状与羽化边都原样保留。
 */
export function tintFilter(color) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(color ?? '').trim());
  if (!m) return 'none';
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  const l = (mx + mn) / 2;
  const d = mx - mn;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (d !== 0) {
    if (mx === r) h = 60 * (((g - b) / d) % 6);
    else if (mx === g) h = 60 * ((b - r) / d + 2);
    else h = 60 * ((r - g) / d + 4);
  }
  if (h < 0) h += 360;
  const rot = (h - 35 + 360) % 360;
  const sat = Math.max(1, 1 + s * 3.4);
  // 目标越暗，压得越暗（深蓝的龙不能渲染成浅蓝）
  const bri = Math.max(0.42, Math.min(1.6, 0.5 + l * 1.1));
  return `sepia(1) hue-rotate(${rot.toFixed(0)}deg) saturate(${sat.toFixed(2)}) brightness(${bri.toFixed(2)})`;
}
/**
 * 属性 → 特效颜色。**这份色表是从用户给的「属性列表」参考图上逐格取色得到的**
 * （tools/shots/sample-types.mjs 直接把图的像素读出来取中位色，不靠肉眼抄），
 * 所以和玩家在界面里看到的属性胶囊是同一套颜色。
 *
 * 取色时踩过一个小坑：自动探测「有颜色的横条」会漏掉灰、黑的那两颗
 * （「一般」是灰的、「恶」是近黑的，饱和度不够），第一版于是把「恶」取成了「钢」的颜色 ——
 * 现在按两列探测结果的并集补齐网格再逐格取。
 *
 * ⚠ 色值只是**目标色**，真正上色是经 `tintFilter()` 变成一串 CSS filter
 * （贴图是纯白的，色相/明暗全靠那串 filter 调）。
 */
const TYPE_TINT = {
  一般: '#9fa19f', 飞行: '#81b9ef', 火: '#e62829', 超能: '#ef4179',
  水: '#2980ef', 虫: '#91a119', 电: '#fac000', 岩石: '#afa981',
  草: '#3fa129', 幽灵: '#704170', 冰: '#3fd8ff', 龙: '#5060e1',
  格斗: '#ff8000', 恶: '#50413f', 毒: '#9141cb', 钢: '#60a1b8',
  地面: '#915121', 妖精: '#ef70ef',
};

/** 属性升降时行走图的闪光色（用户：「降低时闪蓝光，提升时闪红光，和加护盾那个效果一样」） */
export const FLASH_UP = '#ff4a3a';
export const FLASH_DOWN = '#4a9aff';
/** 状态 → [贴图, 颜色]：中毒绿、剧毒紫、灼伤橙、出血红、虚弱紫罗兰 */
const STATUS_FX = {
  poison: ['magic_1', '#7fd45a'],
  toxic: ['magic_1', '#b06ad8'],
  burn: ['flare_1', '#ff8b3a'],
  bleed: ['slash_1', '#ff5a5a'],
  weak: ['twirl_02', '#c08ade'],
};

/** 一张牌的属性 → 颜色（没有属性就返回中性暖白） */
export function tintOf(types) {
  const list = Array.isArray(types) ? types : [types];
  for (const tp of list) if (tp && TYPE_TINT[tp]) return TYPE_TINT[tp];
  return '#f4e6c8';
}

/** 状态 → {fx, color} */
export function statusLook(status) {
  const [fx, color] = STATUS_FX[status] ?? STATUS_FX.poison;
  return { fx, color };
}

/** 从一串里随手挑一个（同一件事连着发生两次时形状不一样，看着不像复读） */
export function pickOne(list) {
  return list[Math.floor(Math.random() * list.length)];
}

/**
 * 特效的基准尺寸：**跟着精灵走**。
 * 以前各处写死 110~160，小个子（冰宝 32×32）身上像糊了一整块，
 * 大个子（沙螺蟒 96×80）身上又盖不满。现在按精灵盒子算，再夹一下。
 */
/**
 * 特效的基准尺寸：**跟着精灵走**，而且刻意**收着**。
 *
 * 以前各处写死 110~160，小个子（冰宝 32×32）身上像糊了一整块，大个子盖不满；
 * 3.1.4 改成跟精灵走之后**又放得太大**（用户：「这也太大了吧！！可以小一点」）——
 * 现在是「精灵盒子 × 0.8~1.0」这一档，比精灵略大一点点，看得见但不糊住画面。
 * 贴图本身四周有留白（512×512 里图案只占中间一块），所以乘出来的数字看着大、
 * 实际可见的部分还要再小一圈。
 */
export function fxSize(body, mul = 0.85) {
  const r = body?.getBoundingClientRect?.();
  if (!r?.width) return 96;
  const base = Math.max(r.width, r.height * 0.8);
  return Math.round(Math.max(56, Math.min(200, base * mul)));
}

/**
 * 在身上叠一张特效贴图（assets/img/fx/*.png），播完自动移除。
 *
 * @param {HTMLElement} parent 挂到谁身上（一般就是精灵盒子）
 * @param {string} fx 贴图名（不带扩展名）
 * @param {{size?:number, ms?:number, rotate?:number, color?:string, blend?:string,
 *          klass?:string, flip?:boolean, delay?:number}} opts
 */
export function burst(parent, fx, opts = {}) {
  if (!parent) return null;
  const {
    size = 120, ms = 460, rotate = 0, color = null, blend = 'screen',
    klass = '', flip = false, delay = 0,
  } = opts;
  const node = el('div', {
    class: `fx-burst ${klass}`.trim(),
    style: {
      width: `${size}px`,
      height: `${size}px`,
      // 形状：贴图当背景（和 3.1.4 之前一直用的做法一致，玩家机器上验证过能显示）
      backgroundImage: `url(assets/img/fx/${fx}.png)`,
      // 颜色：白色贴图靠这串 filter 上色（见 tintFilter 的说明）
      filter: tintFilter(color),
      '--fx-rot': `${rotate}deg`,
      '--fx-ms': `${ms}ms`,
      '--fx-delay': `${delay}ms`,
      '--fx-size': `${size}px`,
      mixBlendMode: blend,
      transform: flip ? 'scaleX(-1)' : '',
      // ?fxfreeze=1：定住不淡出（截图用，见上面的说明）
      ...(FREEZE ? { animation: 'none', opacity: '1' } : {}),
    },
  });
  parent.append(node);
  if (!FREEZE) setTimeout(() => node.remove(), ms + delay + 80);
  return node;
}

/**
 * 一发**打出去**的光：从一只精灵飞到另一只精灵，落点由调用方接着放命中特效。
 *
 * 为什么要这个：3.1.4 之前所有招式都是在**自己身上**贴一张图（远程招和近身招看起来
 * 完全一样，都只是在原地闪一下）。「远隔类」的招式应该有东西真的飞过去 ——
 * 这一条也正好和卡牌自带的「接触 / 远隔」判定对上（见 animForCard）：
 * 接触类是撞上去，远隔类是打过去。
 *
 * @param {HTMLElement} field 战场（位置参照物，坐标相对它算）
 * @param {HTMLElement} fromEl 出手那一侧的精灵
 * @param {HTMLElement} toEl 挨打那一侧的精灵
 * @returns {HTMLElement|null}
 */
export function projectile(field, fromEl, toEl, fx, opts = {}) {
  const f = field?.getBoundingClientRect?.();
  const a = fromEl?.getBoundingClientRect?.();
  const b = toEl?.getBoundingClientRect?.();
  if (!f?.width || !a?.width || !b?.width) return null;
  const { size = 84, ms = 340, color = null, klass = '', spin = 0 } = opts;
  const x0 = a.left + a.width / 2 - f.left;
  const y0 = a.top + a.height / 2 - f.top;
  const dx = (b.left + b.width / 2) - (a.left + a.width / 2);
  const dy = (b.top + b.height / 2) - (a.top + a.height / 2);
  // trace 那族贴图是**竖着**的光条，所以要让它的长边顺着飞行方向：+90°
  const rot = Math.atan2(dy, dx) * (180 / Math.PI) + 90 + spin;
  const node = el('div', {
    class: `fx-burst fx-projectile ${klass}`.trim(),
    style: {
      width: `${size}px`,
      height: `${size}px`,
      // 起点用变量给（CSS 里 .fx-projectile 的 left/top 读它），内联写死会盖掉那条规则
      '--fx-x': `${x0}px`,
      '--fx-y': `${y0}px`,
      backgroundImage: `url(assets/img/fx/${fx}.png)`,
      filter: tintFilter(color),
      '--fx-rot': `${rot}deg`,
      '--fx-ms': `${ms}ms`,
      '--fx-dx': `${dx}px`,
      '--fx-dy': `${dy}px`,
    },
  });  field.append(node);
  setTimeout(() => node.remove(), ms + 80);
  return node;
}

/**
 * 行走图闪光用的 filter 串（护盾的白光、属性升降的红/蓝光）。
 *
 * ⚠ 上色为什么不能从**纯白**起步（3.1.8 的错就在这儿）：
 * 剪影是 `brightness(0) invert(1)` 做出来的，而纯白（255,255,255）经 `sepia(1)`
 * 只变成 (255,255,239) —— 明度 97%，这个明度下**饱和度已经顶到 1**，
 * 再怎么 `saturate()` 也挤不出颜色，`hue-rotate` 也只是把「几乎白的黄」转成「几乎白的别的色」。
 * 所以玩家看到的还是一道白光（「属性降低的颜色没有成功显示，现在都是白的」）。
 *
 * 正确做法是**先压成中灰再上色**：`invert(0.55)` 给出灰 140 左右，
 * 这个明度 sepia 之后才有饱和度可加，saturate 拉满就是一块实色。
 */
export function flashFilter(color) {
  if (!color) return 'brightness(0) invert(1)';
  return `brightness(0) invert(0.55) ${tintFilter(color)}`;
}

/**
 * 行走图闪一下光：护盾 / 强化 / 净化这类「身上发生了变化」用这个表示。
 *
 * 全白不是叠一层白图，而是 `brightness(0) invert(1)`（见 style.css 的 whiteFlash）：
 * 先把整只精灵压成黑、再反相成白，**透明的地方仍然是透明的** ——
 * 所以看到的是「这一只精灵的剪影全白了一下」，不是一块白色方块。
 *
 * 给了 `color` 就把白剪影再染成那个颜色（同一串 sepia→hue-rotate 手法）：
 *   属性**提升** → 红光，属性**被削** → 蓝光（用户要求，和护盾的白光是同一套机制）。
 */
export function flashWhite(body, { color = null, ms = 620 } = {}) {
  if (!body) return;
  body.classList.remove('fighter-flash');
  void body.offsetWidth;            // 强制重排：连着两次强化也要能重新播
  // 不给颜色时是一道纯白剪影；给了颜色就是「中灰起步再上色」（见 flashFilter 的说明）
  body.style.setProperty('--flash-filter', flashFilter(color));
  body.style.setProperty('--flash-ms', `${ms}ms`);
  body.classList.add('fighter-flash');
  setTimeout(() => body.classList.remove('fighter-flash'), ms + 40);
}
