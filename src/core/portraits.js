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

/** 战斗里根据事件挑表情 */
export function emotionForEvent(type, side) {
  switch (type) {
    case 'damage':
    case 'trueDamage':
      return side === 'player' ? 'pain' : 'pain';
    case 'heal':
      return 'happy';
    case 'shield':
      return 'determined';
    case 'buff':
      return 'inspired';
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

const cache = new Map();

/** 表情不存在时的回退顺序（SpriteCollab 里有些物种只画了少量表情） */
const FALLBACK = ['normal', 'determined', 'happy', 'surprised', 'pain', 'angry', 'sad', 'worried'];

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
    const order = [emotion, ...FALLBACK.filter((e) => e !== emotion)];
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
