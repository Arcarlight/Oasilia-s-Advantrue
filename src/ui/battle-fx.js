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
// 现在把贴图的 alpha 当 mask、颜色交给 `background-color`（见 style.css 的 .fx-burst）：
// 同一张白星芒可以是金的（强化）、绿的（中毒）、青的（护盾）、红的（出血），
// 而且**换颜色不换形状**这件事是真的了（以前连形状都只用了两张）。
//
// 怎么量：`ffmpeg -i x.png -f rawvideo -pix_fmt rgba -` 拿原始像素，
// 逐点算 (max-min)/max 取最大值；纯灰的图这个值恒为 0。
import { el } from './dom.js';

/**
 * 属性 → 特效颜色。
 *
 * 用户点名了几个：「火是红色、格斗是粉红、龙是深蓝色、毒是紫色等等」——
 * 其余按宝可梦官方的属性配色取色相，但**整体提亮**：特效是叠在暗背景上、
 * 用 `mix-blend-mode: screen` 加亮的，官方那套（暗红 #C22E28、深褐 #705848 之类）
 * 直接拿来会糊成一片黑，只剩「有东西闪了一下」。
 */
const TYPE_TINT = {
  一般: '#d8d2a8', 格斗: '#ff7fa8', 飞行: '#b0a0ff', 毒: '#b45ad8', 地面: '#e8c96a',
  岩石: '#cbb25c', 虫: '#b4cc38', 幽灵: '#8f6ae0', 钢: '#c4ccdc', 火: '#ff4a30',
  水: '#5aa0ff', 草: '#6ad050', 电: '#ffe23a', 超能: '#ff5ac0', 冰: '#86dcd8',
  龙: '#3a4ad8', 恶: '#a5825e', 妖精: '#ffb0d8',
};
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
export function fxSize(body, mul = 1.25) {
  const r = body?.getBoundingClientRect?.();
  if (!r?.width) return 120;
  const base = Math.max(r.width, r.height * 0.8);
  return Math.round(Math.max(70, Math.min(260, base * mul)));
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
      // 颜色在这里给，形状（alpha）由 CSS 的 mask 从贴图里取 —— 见文件头
      '--fx-img': `url(assets/img/fx/${fx}.png)`,
      '--fx-color': color ?? '#fff',
      '--fx-rot': `${rotate}deg`,
      '--fx-ms': `${ms}ms`,
      '--fx-delay': `${delay}ms`,
      '--fx-size': `${size}px`,
      mixBlendMode: blend,
      transform: flip ? 'scaleX(-1)' : '',
    },
  });
  parent.append(node);
  setTimeout(() => node.remove(), ms + delay + 80);
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
      '--fx-img': `url(assets/img/fx/${fx}.png)`,
      '--fx-color': color ?? '#fff',
      '--fx-rot': `${rot}deg`,
      '--fx-ms': `${ms}ms`,
      '--fx-dx': `${dx}px`,
      '--fx-dy': `${dy}px`,
    },
  });
  field.append(node);
  setTimeout(() => node.remove(), ms + 80);
  return node;
}

/**
 * 行走图闪一下白光：护盾 / 强化 / 净化这类「身上发生了变化」用这个表示。
 *
 * 全白不是叠一层白图，而是 `brightness(0) invert(1)`（见 style.css 的 whiteFlash）：
 * 先把整只精灵压成黑、再反相成白，**透明的地方仍然是透明的** ——
 * 所以看到的是「这一只精灵的剪影全白了一下」，不是一块白色方块。
 */
export function flashWhite(body, { ms = 620 } = {}) {
  if (!body) return;
  body.classList.remove('fighter-flash');
  void body.offsetWidth;            // 强制重排：连着两次强化也要能重新播
  body.classList.add('fighter-flash');
  body.style.setProperty('--flash-ms', `${ms}ms`);
  setTimeout(() => body.classList.remove('fighter-flash'), ms + 40);
}
