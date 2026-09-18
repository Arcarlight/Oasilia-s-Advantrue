// 鼠标指针：Kenney 光标包（assets/img/cursors/）+ **按当前地图主题色描边**。
//
// 为什么运行时生成而不是预先导出 6 套图：地图随时可能加，主题色也写在 content/biomes.json 里，
// 用 canvas 现算一次就能跟着主题走 —— 换地图不用重新导素材，也不会漏掉某张图。
// 描边做法：把原图在 8 个方向各画一遍、整体染成主题色当底，再把白色原图叠在上面。
// 光标尺寸固定 32×32（CSS 光标的安全尺寸），热点（热点坐标）沿用原图的值。
const BASE = 'assets/img/cursors/';

/** 4 种光标：默认 / 可点 / 按下 / 悬停说明（file 是原图，x,y 是热点） */
const CURSORS = {
  default: { file: 'hand_open.png', x: 12, y: 4 },
  pointer: { file: 'hand_point.png', x: 12, y: 4 },
  active: { file: 'hand_closed.png', x: 12, y: 4 },
  help: { file: 'cursor_help.png', x: 8, y: 4 },
};

const SIZE = 32;
const OUTLINE = 2;          // 描边粗细（像素）
/** 白色外圈向外扩多少像素（要比本体大，白边才露得出来） */
const HALO = 2;
const cache = new Map();    // color -> { default: dataURL, ... }
let images = null;          // { default: HTMLImageElement, ... }
let applied = null;         // 当前生效的颜色，避免每帧重复生成

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

async function loadAll() {
  if (images) return images;
  const entries = await Promise.all(Object.entries(CURSORS).map(async ([k, v]) => [k, await loadImage(BASE + v.file)]));
  images = Object.fromEntries(entries);
  return images;
}

/**
 * 描边色 = 主题色**压深**（保留色相与饱和度，把亮度压到 45% 左右）。
 * 直接用主题色当描边的话，像沙漠 #f0b95c / 盐海 #7fe6ff 这种亮色主题，
 * 描边在浅色地图上几乎和背景融在一起，等于没有描边。
 */
export function outlineColor(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex).trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l0 = (max + min) / 2;
  const s0 = max === min ? 0 : (l0 > 0.5 ? (max - min) / (2 - max - min) : (max - min) / (max + min));
  let h = 0;
  if (max !== min) {
    if (max === r) h = ((g - b) / (max - min) + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / (max - min) + 2) / 6;
    else h = ((r - g) / (max - min) + 4) / 6;
  }
  // 直接按 HSL 把亮度摁到 22% 左右：只压「亮度」不动色相，所以深琥珀还是琥珀、深青还是青。
  // （之前是 min(L, 0.45)*0.92 ≈ 0.41，对高饱和色来说看着仍然很亮 —— 视觉亮度跟 L 不成正比，
  //   琥珀色 L=0.41 依旧是「亮橙」。实测反馈「还是太浅」，所以这次直接给低值。）
  const l = Math.min(l0, 0.34) * 0.65;          // 亮色主题 → ≈0.22，本来就暗的更暗
  const s = Math.min(1, s0 * 1.15);             // 提一点饱和度，压深后不发灰
  const hue2rgb = (p, q, t) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const to255 = (v) => Math.max(0, Math.min(255, Math.round(v * 255)));
  const hex2 = (v) => to255(v).toString(16).padStart(2, '0');
  return '#' + hex2(hue2rgb(p, q, h + 1 / 3)) + hex2(hue2rgb(p, q, h)) + hex2(hue2rgb(p, q, h - 1 / 3));
}

/**
 * 生成「白色外描边 + 压深主题色本体」的光标。
 *
 * 顺序很关键（踩过一次）：先把剪影向外扩一圈填**白**当外描边，再把剪影本体填成
 * 压深的主题色，最后白描边在下、深色本体压在上面 —— 于是看起来就是
 * 「深色手 + 一圈白边」。反过来（白手 + 深色边）在浅色地图上几乎看不见。
 */
function themedCursor(img, bodyColor) {
  const mk = () => {
    const c = document.createElement('canvas');
    c.width = SIZE; c.height = SIZE;
    return c;
  };
  /** 把图按一组偏移画一遍后整体染成 color（偏移决定形状扩多大） */
  const tint = (offsets, color) => {
    const c = mk();
    const g = c.getContext('2d');
    for (const [dx, dy] of offsets) g.drawImage(img, dx, dy, SIZE, SIZE);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = color;
    g.fillRect(0, 0, SIZE, SIZE);
    return c;
  };
  // 外圈：朝四周扩 HALO 像素。**必须比本体大**，否则本体正好把白边盖满 ——
  // 上一版就是两边用了同样的偏移，像素核对时「白边 0 个」才发现。
  const ring = [];
  for (let dx = -HALO; dx <= HALO; dx++) {
    for (let dy = -HALO; dy <= HALO; dy++) {
      if (dx * dx + dy * dy > HALO * HALO + 1) continue;     // 圆形外圈，方角会显得脏
      ring.push([dx, dy]);
    }
  }
  try {
    const halo = tint(ring, '#ffffff');                      // 外描边：白
    const body = tint([[0, 0]], bodyColor);                  // 本体：压深的主题色（原剪影大小）
    const out = mk();
    const og = out.getContext('2d');
    og.drawImage(halo, 0, 0);
    og.drawImage(body, 0, 0);
    return out.toDataURL('image/png');
  } catch {
    return null;
  }
}

/**
 * 把整套光标换成「主题色描边」版本。同一颜色只生成一次。
 * @param {string} color 主题色（形如 #f0b95c）
 */
export async function applyCursorTheme(color) {
  if (!color || applied === color) return applied === color;
  applied = color;                                             // 先标记，避免并发重复生成
  let urls = cache.get(color);
  if (!urls) {
    const imgs = await loadAll();
    const edge = outlineColor(color);                            // 本体颜色：压深的主题色（外面再包一圈白）
    urls = {};
    for (const [k, v] of Object.entries(CURSORS)) {
      const img = imgs[k];
      urls[k] = img ? (themedCursor(img, edge) ?? BASE + v.file) : BASE + v.file;
    }
    cache.set(color, urls);
  }
  const u = (k) => `url(${urls[k]}) ${CURSORS[k].x} ${CURSORS[k].y}`;
  const css = [
    `html, body { cursor: ${u('default')}, auto !important; }`,
    `a, button, select, summary, [role="button"], .btn, .card, .map-node, .legend-item, .option, .shop-item button { cursor: ${u('pointer')}, pointer !important; }`,
    `a:active, button:active, .btn:active, .card:active, .map-node:active { cursor: ${u('active')}, pointer !important; }`,
    `[data-tip] { cursor: ${u('help')}, help !important; }`,
    `input, textarea { cursor: text !important; }`,
  ].join('\n');
  let tag = document.getElementById('cursor-theme');
  if (!tag) {
    tag = document.createElement('style');
    tag.id = 'cursor-theme';
    document.head.append(tag);
  }
  tag.textContent = css;                                       // 追加在最后 → 覆盖 style.css 里的静态光标
  return true;
}

/** 调试用：当前生效的颜色与生成结果 */
export function cursorStatus() {
  const tag = document.getElementById('cursor-theme');
  return {
    color: applied,
    outline: applied ? outlineColor(applied) : null,
    injected: !!tag,
    bytes: tag ? tag.textContent.length : 0,
    cached: [...cache.keys()],
  };
}
