// 精灵动画：SpriteCollab 的精灵图是「每帧一格、横向拼接、每 8 行一循环」的二维表。
// 这里用 canvas 逐帧裁切重绘，天然忽略空白帧（透明帧会被跳过）。

// 单文件构建（oasis-game.html）会把元数据内联成 window.__OASIS_SPRITE_META__，
// 这样即使用 file:// 直接双击打开也能跑（file:// 下 fetch 会被 CORS 拦掉）。
let META = (typeof window !== 'undefined' && window.__OASIS_SPRITE_META__) || null;
let metaPromise = null;

export async function loadSpriteMeta() {
  if (META) return META;
  if (!metaPromise) {
    metaPromise = fetch('assets/data/sprites.json')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((json) => {
        META = json;
        return META;
      });
  }
  return metaPromise;
}

export function getSpriteMeta() {
  return META;
}

/** 物种 slug -> 动画信息（缺这个动作时退回 Idle，再退回任意一个存在的动作） */
export function animInfo(slug, anim = 'Idle') {
  const r = resolveAnim(slug, anim);
  return r ? r.info : null;
}

/**
 * 解析出「真正能用的动作」。
 * 为什么需要它：SpriteCollab 里有些物种没有 Idle（例如独角虫 / 傲骨燕），
 * 以前 animInfo 会返回 null 让整只怪画不出来；而且当「请求的动作存在、但 Idle 不存在」时，
 * 旧的写法会用 Attack 的帧信息去裁 Idle 的图，尺寸对不上就直接花屏。
 * 现在统一由一个函数回答「用哪个动作名 + 用哪份帧信息」，两者永远配套。
 */
export function resolveAnim(slug, anim = 'Idle') {
  const s = META?.[slug];
  if (!s || !s.anims) return null;
  if (s.anims[anim]) return { anim, info: s.anims[anim] };
  if (s.anims.Idle) return { anim: 'Idle', info: s.anims.Idle };
  const first = Object.keys(s.anims)[0];
  return first ? { anim: first, info: s.anims[first] } : null;
}

const sheetCache = new Map();

/**
 * 还活着的动画 canvas 数量（createAnim 建一个 +1，destroy() -1）。
 *
 * 这是给诊断用的：动画是靠 setInterval 推进的（见 createAnim 里的说明），
 * 元素从 DOM 上摘掉**不会**停掉那个定时器 —— 忘了 destroy 就是每打一场漏两个。
 * 这种漏很难用眼睛看出来，所以把它变成一个能断言的数字：
 * tools/diag-encounter.js 连打两场，比较前后的数量。
 */
let liveAnims = 0;
export function liveAnimCount() { return liveAnims; }

function loadSheet(slug, anim) {
  const key = `${slug}/${anim}`;
  if (sheetCache.has(key)) return sheetCache.get(key);
  const p = new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`精灵图加载失败: ${key}`));
    // 单文件构建会把精灵图内联成 data URI（file:// 下不能直接读本地 png）
    const inlined = typeof window !== 'undefined' && window.__OASIS_SPRITES__
      ? window.__OASIS_SPRITES__[key]
      : null;
    img.src = inlined ?? `assets/pokemon/${slug}/${anim}.png`;
  });
  sheetCache.set(key, p);
  return p;
}

/**
 * PMD 精灵图的朝向行序（官方 PMD Sprite Format 文档）：
 *   "Frames of an animation are ordered horizontally by sequence,
 *    and vertically by direction."
 * 也就是 **水平方向是帧序列，竖直方向是朝向**，8 个朝向按下面的固定顺序排列。
 * 实战里战斗是侧面视角，所以玩家用 DIR.RIGHT（朝右），敌人用 DIR.LEFT（朝左）。
 */
export const DIR = {
  DOWN: 0,
  DOWN_RIGHT: 1,
  RIGHT: 2,
  UP_RIGHT: 3,
  UP: 4,
  UP_LEFT: 5,
  LEFT: 6,
  DOWN_LEFT: 7,
};

export const DIR_NAMES = ['下', '右下', '右', '右上', '上', '左上', '左', '左下'];

function isFrameBlank(img, ctx, x, y, fw, fh) {
  ctx.clearRect(0, 0, fw, fh);
  ctx.drawImage(img, x, y, fw, fh, 0, 0, fw, fh);
  const data = ctx.getImageData(0, 0, fw, fh).data;
  for (let i = 3; i < data.length; i += 4 * 7) if (data[i] > 8) return false;
  return true;
}

/**
 * 取出**某一朝向行**的帧序列。
 * 之前这里把 8 个朝向全部当成连续帧连在一起播了，结果宝可梦看起来一直在原地转圈。
 *
 * @param {object} info 帧信息
 * @param {HTMLImageElement} img 精灵图
 * @param {CanvasRenderingContext2D} ctx 探针用的 2D 上下文（尺寸 = 一帧）
 * @param {number|null} dirRow 想要的行；null = 自动挑第一行有内容的
 */
function frameList(info, img, ctx, dirRow = null) {
  const { fw, fh, cols, rows } = info;
  const rowHasContent = (r) => {
    for (let c = 0; c < cols; c++) {
      if (!isFrameBlank(img, ctx, c * fw, r * fh, fw, fh)) return true;
    }
    return false;
  };

  let row = dirRow;
  if (row == null || row < 0 || row >= rows || !rowHasContent(row)) {
    // 兜底：这个物种没做满 8 个朝向时，退回到第一行有内容的方向
    row = 0;
    for (let r = 0; r < rows; r++) if (rowHasContent(r)) { row = r; break; }
  }

  const out = [];
  for (let c = 0; c < cols; c++) {
    const x = c * fw;
    const y = row * fh;
    if (!isFrameBlank(img, ctx, x, y, fw, fh)) out.push({ x, y });
  }
  return out;
}

/**
 * 把一整张精灵表按某一朝向行里**所有动画帧**的内容外接框裁掉透明边。
 *
 * 为什么需要：PMD 的帧格子是固定尺寸（常见 48×64），角色本身往往只有格子高度的六成，
 * 上下左右全是透明填充。图鉴里三张图并排时，行走图就因为「格子大、人小」显得又小又扁
 * （用户两次反馈「行走图被压扁」）。
 * 这里按内容裁掉空白，再按内容高度定缩放，行走图就能和其他两张图一样高。
 *
 * @returns {{x:number,y:number,w:number,h:number}}
 */
function contentBox(info, img, pctx, row) {
  const { fw, fh, cols } = info;
  let x0 = Infinity; let y0 = Infinity; let x1 = -1; let y1 = -1;
  const probe = document.createElement('canvas');
  probe.width = fw;
  probe.height = fh;
  const px = probe.getContext('2d', { willReadFrequently: true });
  for (let c = 0; c < cols; c++) {
    if (isFrameBlank(img, pctx, c * fw, row * fh, fw, fh)) continue;
    px.clearRect(0, 0, fw, fh);
    px.drawImage(img, c * fw, row * fh, fw, fh, 0, 0, fw, fh);
    const d = px.getImageData(0, 0, fw, fh).data;
    for (let y = 0; y < fh; y++) {
      for (let x = 0; x < fw; x++) {
        if (d[(y * fw + x) * 4 + 3] > 8) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
      }
    }
  }
  if (x1 < 0) return { x: 0, y: 0, w: fw, h: fh };   // 整行全空：老样子兜底
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/**
 * 创建一个动画 DOM 元素。
 * @param {string} slug 物种 slug
 * @param {{anim?:string, scale?:number, fps?:number, flip?:boolean, dir?:number|null,
 *          className?:string, autoScale?:number, trim?:boolean}} opts
 *   dir = 朝向行（DIR.RIGHT / DIR.LEFT ...），不传就自动挑第一行有内容的
 *   autoScale = 目标显示高度（px）：按**内容**高度自动定 scale，忽略 scale
 *   trim = 裁掉帧里的透明边（图鉴那种「要和其他图并排」的场合用）
 */
export async function createAnim(slug, opts = {}) {
  const {
    anim = 'Idle', scale = 3, fps = 8, flip = false, className = '', dir = null,
    autoScale = null, trim = false,
  } = opts;
  const resolved = resolveAnim(slug, anim);
  if (!resolved) throw new Error(`没有 ${slug} 的动画数据`);
  const { anim: animName, info } = resolved;

  const img = await loadSheet(slug, animName);
  const probe = document.createElement('canvas');
  probe.width = info.fw;
  probe.height = info.fh;
  const pctx = probe.getContext('2d', { willReadFrequently: true });
  // frames 用 let：setDir() 换朝向时会整条换掉（朝向 = 精灵图的一行）
  let frames = frameList(info, img, pctx, dir);
  /** 当前朝向的裁剪框：换朝向时跟着更新（各朝向的外接框不完全一样） */
  let box = trim ? contentBox(info, img, pctx, frames[0] ? Math.round(frames[0].y / info.fh) : 0) : null;
  const contentH = () => (box ? box.h : info.fh);
  const fitScale = autoScale ? autoScale / contentH() : 0;
  const useScale = autoScale ? fitScale : scale;

  const canvas = document.createElement('canvas');
  canvas.width = Math.round((box ? box.w : info.fw) * useScale);
  canvas.height = Math.round((box ? box.h : info.fh) * useScale);
  canvas.className = `anim ${className}`.trim();
  canvas.style.width = `${canvas.width}px`;
  canvas.style.height = `${canvas.height}px`;
  canvas.style.imageRendering = 'pixelated';
  if (flip) canvas.style.transform = 'scaleX(-1)';

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingEnabled = false;

  let i = 0;
  let last = 0;
  const step = 1000 / fps;
  let raf = 0;
  let stopped = false;

  // 动画用 setInterval 驱动而不是 rAF：rAF 在页面不可见时会被节流到几乎不动，
  // 这样至少在切标签页回来之后不会出现「卡住不动」的观感问题。
  let timer = 0;
  function startLoop() {
    stopLoop();
    timer = setInterval(() => {
      if (stopped) return;
      i = (i + 1) % Math.max(1, frames.length);
      paint();
    }, step);
  }
  function stopLoop() {
    if (timer) { clearInterval(timer); timer = 0; }
  }

  function paint() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const f = frames[i];
    if (!f) return;
    /**
     * 两种画法：
     *   · trim=false —— 按帧原样铺满 canvas（战斗 / 遭遇演出用的就是这种，
     *     它们靠格子里的固定留白保持角色在场景里的站位一致）；
     *   · trim=true —— 只画内容外接框（图鉴那种「和其他图并排」的场合），
     *     格子的透明留白被裁掉，人就能填满给它留的位置。
     */
    if (box) ctx.drawImage(img, f.x + box.x, f.y + box.y, box.w, box.h, 0, 0, canvas.width, canvas.height);
    else ctx.drawImage(img, f.x, f.y, info.fw, info.fh, 0, 0, info.fw, info.fh);
  }
  paint();
  startLoop();

  /** 播一遍就停在最后一帧 */
  canvas.playOnce = (fpsOverride) => {
    stopLoop();
    i = 0;
    paint();
    stopped = false;
    const s = 1000 / (fpsOverride ?? fps);
    timer = setInterval(() => {
      i += 1;
      if (i >= frames.length) {
        i = frames.length - 1;
        paint();
        stopLoop();
        stopped = true;
        return;
      }
      paint();
    }, s);
  };

  /**
   * 这个物种的这张图，**哪些朝向行真的有内容**（8 个朝向 = 8 行）。
   *
   * 素材库里绝大多数物种（208 / 214）画满了 8 个朝向，但确实有几只没画满 ——
   * frameList() 会退回第一行有内容的，于是「鼠标在右下」可能落到「右上」那一行，
   * 看起来就是转了个别的方向。图鉴那句话（「行走图跟着鼠标转」）要能被量，
   * 所以把「这个物种支持哪些朝向」直接暴露出来，而不是让调用方去猜。
   */
  canvas.contentDirs = () => {
    const out = [];
    for (let r = 0; r < info.rows; r++) {
      let has = false;
      for (let c = 0; c < info.cols; c++) {
        if (!isFrameBlank(img, pctx, c * info.fw, r * info.fh, info.fw, info.fh)) { has = true; break; }
      }
      if (has) out.push(r);
    }
    return out;
  };

  canvas.destroy = () => {
    // 幂等：外部（战斗界面）会在换动作和收场时各调一次，重复调用不能把计数减穿
    if (canvas._destroyed) return;
    canvas._destroyed = true;
    liveAnims -= 1;
    stopped = true;
    stopLoop();
    cancelAnimationFrame(raf);
  };
  /**
   * 换朝向行（DIR.RIGHT / DIR.LEFT / DIR.DOWN …），动画接着播。
   *
   * 图鉴详情页用它做「行走图跟着鼠标转」（用户要求）：8 个朝向就是精灵图的 8 行，
   * 换行不用重新建 canvas、也不用重新取图 —— 只把帧序列换掉，再重画当前这一帧。
   * 这个物种没画满 8 个朝向时 frameList() 会自动退回第一行有内容的，不会开出空画布。
   */
  canvas.setDir = (next) => {
    if (next === canvas.dirRow) return false;
    frames = frameList(info, img, pctx, next);
    canvas.dirRow = next;
    // 各朝向的外接框不一样（转身之后宽高会变），所以换向时重新量一次
    if (trim) {
      box = contentBox(info, img, pctx, frames[0] ? Math.round(frames[0].y / info.fh) : 0);
      const s = autoScale ? autoScale / box.h : useScale;
      canvas.width = Math.round(box.w * s);
      canvas.height = Math.round(box.h * s);
      canvas.style.width = `${canvas.width}px`;
      canvas.style.height = `${canvas.height}px`;
      ctx.imageSmoothingEnabled = false;
    }
    if (i >= frames.length) i = 0;
    paint();
    return true;
  };
  liveAnims += 1;
  canvas.frameCount = frames.length;
  canvas.dirRow = dir;
  /**
   * 记下「这张 canvas 是按哪套帧信息建的」。
   * 外部（例如战斗布局自适应）要改它的 CSS 显示尺寸时，必须用**同一套**帧信息算宽高比；
   * 否则会拿 Idle 的帧尺寸去套 Attack 的图，行走图就被压扁了（这个 bug 真的出现过）。
   * 开了 trim 的话，显示出来的比例是**内容外接框**的比例，所以这里给的是它。
   */
  canvas.frameInfo = box ? { fw: box.w, fh: box.h, cols: info.cols, rows: info.rows } : info;
  canvas.trimmed = !!box;
  canvas.animName = animName;

  return canvas;
}

/**
 * 只把精灵图取回来（不建 canvas、不起定时器、不探帧）。
 *
 * 战斗里 Idle → Attack → Hurt 每换一次动作都要现拉一张 png，冷启动时那一帧会卡一下。
 * 遭遇演出（src/ui/encounter.js）的停留阶段顺手把这几张预热掉；
 * loadSheet 有自己的缓存，所以预热过的图 createAnim 会直接命中，不会再发请求。
 * 动作名解析走和 createAnim 同一条路（resolveAnim），不会出现「预热了 A、用的时候找 B」。
 */
export function preloadAnim(slug, anim = 'Idle') {
  const resolved = resolveAnim(slug, anim);
  if (!resolved) return Promise.resolve(null);
  return loadSheet(slug, resolved.anim).catch(() => null);
}

/** 只取某一帧的静态封面（用于卡牌 / 图鉴 / 头像），返回 canvas */
export async function createStill(slug, anim = 'Idle', scale = 2, frameIndex = 0, dir = DIR.DOWN) {
  const resolved = resolveAnim(slug, anim);
  if (!resolved) return null;
  const { anim: animName, info } = resolved;
  const img = await loadSheet(slug, animName);
  const probe = document.createElement('canvas');
  probe.width = info.fw;
  probe.height = info.fh;
  const pctx = probe.getContext('2d', { willReadFrequently: true });
  const frames = frameList(info, img, pctx, dir);
  const f = frames[Math.min(frameIndex, frames.length - 1)] ?? { x: 0, y: 0 };
  const canvas = document.createElement('canvas');
  canvas.width = info.fw;
  canvas.height = info.fh;
  canvas.style.width = `${info.fw * scale}px`;
  canvas.style.height = `${info.fh * scale}px`;
  canvas.style.imageRendering = 'pixelated';
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, f.x, f.y, info.fw, info.fh, 0, 0, info.fw, info.fh);
  return canvas;
}

/** 给 <img> 用的封面（从 canvas 导出 dataURL），可缓存 */
const coverCache = new Map();
export async function coverUrl(slug, anim = 'Idle', frameIndex = 0) {
  const key = `${slug}/${anim}/${frameIndex}`;
  if (coverCache.has(key)) return coverCache.get(key);
  const c = await createStill(slug, anim, 1, frameIndex);
  const url = c.toDataURL('image/png');
  coverCache.set(key, url);
  return url;
}
