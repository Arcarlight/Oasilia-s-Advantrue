// 头像（PMD portrait）：HUD、战斗角色卡、标题、结算都用它。
//
// 素材来自 SpriteCollab 的 portrait/ 目录 —— 每个物种 16 种表情，每张只有 1~2 KB。
// 这里做了三层兜底，保证任何情况下都不会出现破图：
//   1) assets/portraits/<slug>/<Emotion>.png（首选）
//   2) 透明占位（拿不到就隐藏，让布局自己塌陷，不显示裂图）
//   3) 由调用方决定要不要退回精灵静帧

const BASE = 'assets/portraits/';

/** 表情名与来源一致（SpriteCollab 的 portrait 文件名） */
export const EMOTION = {
  normal: 'Normal',
  happy: 'Happy',
  joyous: 'Joyous',
  inspired: 'Inspired',
  determined: 'Determined',
  angry: 'Angry',
  sad: 'Sad',
  pain: 'Pain',
  worried: 'Worried',
  surprised: 'Surprised',
  shouting: 'Shouting',
  stunned: 'Stunned',
  dizzy: 'Dizzy',
  sigh: 'Sigh',
  crying: 'Crying',
  teary: 'Teary-Eyed',
};

/**
 * 战斗里根据事件挑表情。
 *
 * `ev` 是必要的第三个参数：**强化和削弱用的是同一种事件**（`type: 'buff'`），
 * 只有数值的正负能把它们分开。以前只看 type，两者一律给 'inspired' ——
 * 那是一张**淡黄底的兴奋脸**，于是「刺耳声把你的防御削掉 5 点」的时候，
 * 你自己的头像反而一脸兴奋（用户反馈：「受伤的时候为什么用激动的表情」）。
 */
export function emotionForEvent(type, side, ev = {}) {
  switch (type) {
    case 'damage':
    case 'trueDamage':
      return 'pain';
    case 'heal':
      return 'happy';
    case 'shield':
      return 'determined';
    case 'buff': {
      // requested 是卡面写的数（被属性下限夹住时 delta 会变成 0 甚至 +1），
      // 所以判定方向要用 requested，没有它才退回 amount
      const dir = ev.requested ?? ev.amount ?? 0;
      return dir < 0 ? 'worried' : 'inspired';
    }
    case 'status':
      return side === 'player' ? 'worried' : 'stunned';
    case 'dodge':
      return 'determined';
    case 'playCard':
      return 'shouting';
    case 'battleEnd':
      return 'joyous';
    default:
      return 'normal';
  }
}

/**
 * 情绪的「正负」分组。回退时**绝不跨组**：
 * 一张「痛苦」的图找不到时，宁可退到中性的 Normal，也不能退到黄底的 Happy。
 *
 * 这条以前是隐患而不是显式规则 —— 旧的回退顺序写死成
 * `normal → determined → happy → surprised …`，靠「每种宝可梦都有 Normal」侥幸没出事；
 * 一旦某个物种缺 Normal，挨打就会变成一张笑脸。
 */
const VALENCE = {
  pain: 'bad', angry: 'bad', sad: 'bad', worried: 'bad',
  stunned: 'bad', sigh: 'bad', crying: 'bad', teary: 'bad',
  happy: 'good', joyous: 'good', inspired: 'good',
};
/** 中性脸：任何情绪找不到图时都可以退到这里 */
const NEUTRAL_ORDER = ['normal', 'determined', 'surprised', 'shouting', 'dizzy'];

/** 该按什么顺序去找图：自己 → 同正负的其它表情 → 中性脸 → 剩下的 */
export function emotionFallbackOrder(emotion) {
  const same = VALENCE[emotion];
  const all = Object.keys(EMOTION).filter((e) => e !== emotion);
  const group = same ? all.filter((e) => VALENCE[e] === same) : [];
  const neutral = NEUTRAL_ORDER.filter((e) => e !== emotion && !group.includes(e));
  const rest = all.filter((e) => !group.includes(e) && !neutral.includes(e));
  return [emotion, ...group, ...neutral, ...rest];
}

const cache = new Map();

function loadImage(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(url);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/**
 * 取头像 URL。会按「想要的表情 -> Normal -> 其它常见表情」的顺序尝试，
 * 拿不到就返回 null（调用方会退回精灵静帧或直接隐藏，不会出现破图）。
 * @param {string} slug 物种 slug
 * @param {string} emotion EMOTION 的键
 */
export async function portraitUrl(slug, emotion = 'normal') {
  const key = `${slug}/${emotion}`;
  if (cache.has(key)) return cache.get(key);

  const inlined = typeof window !== 'undefined' && window.__OASIS_PORTRAITS__
    ? window.__OASIS_PORTRAITS__
    : null;
  const src = (emo) => {
    const file = EMOTION[emo] ?? EMOTION.normal;
    return inlined ? (inlined[`${slug}/${file}`] ?? null) : `${BASE}${slug}/${file}.png`;
  };

  const p = (async () => {
    // 回退顺序由 emotionFallbackOrder() 决定：同正负的表情优先，中性脸兜底，
    // **永远不会**把「痛苦」退成「高兴」（见那里的说明）
    const order = emotionFallbackOrder(emotion);
    for (const emo of order) {
      const url = src(emo);
      if (!url) continue;
      // 内联（data URI）时不必探测，直接认它存在
      if (inlined) return url;
      if (await loadImage(url)) return url;
    }
    return null;
  })();
  cache.set(key, p);
  return p;
}

/**
 * 创建一个头像 <img> 元素。
 * @param {string} slug
 * @param {{emotion?:string, size?:number, className?:string, alt?:string}} opts
 */
export async function createPortrait(slug, opts = {}) {
  const { emotion = 'normal', size = 48, className = '', alt = '' } = opts;
  const url = await portraitUrl(slug, emotion);
  if (!url) return null;
  const img = document.createElement('img');
  img.src = url;
  img.alt = alt;
  img.className = `portrait ${className}`.trim();
  img.style.width = `${size}px`;
  img.style.height = `${size}px`;
  img.style.imageRendering = 'pixelated';
  img.draggable = false;
  return img;
}

/**
 * 把已经存在的 <img>（或容器）换一个表情，用于战斗中做表情反应。
 * 找不到图就保持原样，不会破图。
 */
export async function setPortraitEmotion(node, slug, emotion) {
  const url = await portraitUrl(slug, emotion);
  if (!url || !node) return false;
  if (node.tagName === 'IMG') {
    node.src = url;
    return true;
  }
  const inner = node.querySelector('img');
  if (inner) { inner.src = url; return true; }
  return false;
}
