// 遭遇演出：从地图踏进战斗之间的过场。
//
// 效果（用户点名要的）：
//   黑幕**一上来就把整个屏幕盖住**（地图不再露出任何一角）；
//   我方**背影**从右边非线性划到左下，敌人的**正面图**从左滑到右上 —— 两只**错开**站位；
//   一组黑底 + 主题色的光带从屏幕左边外面扫进来：它**从头到尾都是整幅视口宽**
//   （用户：「我希望光条没有拉长，进来就是最长的」），扫到屏幕右边的那一刻敌人正好站定；
//   名牌（大号名字 + 档位霓虹灯）**从屏幕右边外面划进来**，霓虹灯的 4 份从右往左一份份拉开、
//   名字最后落定；
//   双双停留一小会（这段时间用来预载战斗资源），然后名牌**比黑幕先一步**滑出屏幕、进战斗。
//
// 每个动作都有一条能量的判据（诊断逐条验，见 tools/diag-encounter.js）：
//   · 立绘 —— 非线性（前半段时间走完 >60% 路程）；
//   · 光带 —— 全程宽度恒等于视口宽（不漏一丝「先短后长」）、右端从左到右单调扫过、
//             落定时正好贴到屏幕右边；
//   · 名牌 —— 起点在屏幕右边外面、一路往左、停在自己的位置上；名字最后落定；
//             霓虹灯 4 份中途间距被拉开、结束那刻收拢回静态间距；
//   · 退场 —— 名牌和黑幕**同向但错开**（名牌更快，先一步出画）。
//
// 用的是**回合立绘**（Generation 9 Pack 的正/背面图，src/core/gen9.js），
// 不是战斗场地上的 PMD 行走图 —— 用户特意澄清过：「我表示的立绘是放在表示回合数旁边的那个立绘」。
// 立绘在导入时已经按可见内容裁到包围盒，所以**图框就是怪兽本人**：
// 不用再补透明留白，横线贴它的中线就一定是贴着画面，名牌也能直接顶上去。
//
// ── 关于「停留时预载能不能治好音效慢半拍」────────────────────────────
// 能，但**光有动画没有用**：浏览器不会因为画面上有东西在动就去预载任何文件。
// 起作用的是这里显式调用的 audio.warm() / sprites.preloadAnim() / music.preload()：
//
//   audio.play(name) 的链路是 fetch → decodeAudioData → src.start()，
//   所以每个音效**第一次响**都要先等一次网络往返 + 解码。冷启动时最明显：
//   点下第一张攻击卡，「挥剑声」会比动画慢半拍 —— 因为那一瞬间才刚开始下载文件
//   （战斗那 26 个音效一共约 2.9 MB，单个最大 296 KB；线上实测冷启动约 2.9 秒）。
//   warm() 在演出里就把这批文件变成 AudioBuffer 存进 audio.js 的缓存，
//   之后 play() 拿到的就是现成的 buffer，`src.start()` 是立刻响的。
//
//   同理，music.play() 要先 fetch 整首 ogg 再解码（一首 3 分钟），
//   不预解码的话「进战斗」的那一下会先是安静的。这里 decode:true 一起解掉。
//
// 所以「停留一小会」不是纯装饰 —— 它把这段时间换成了资源预载。
// 缓存命中时 warm() 立刻兑现，停留就只剩「让玩家看清对面是谁」的时间。

import { el, sleep } from './dom.js';
import { preloadAnim } from '../core/sprites.js';
import { turnArt, fitArt } from '../core/gen9.js';
import { audio, BATTLE_SFX, ENCOUNTER_SFX } from '../core/audio.js';
import { music } from '../core/bgm.js';
import { createPortrait } from '../core/portraits.js';
import { speedMulOf, loadBattleSpeed } from '../data/balance.js';
import { TIERS } from '../data/enemies.js';

/**
 * 节奏（毫秒，会乘以玩家的「战斗演出速度」倍率）。
 * 想整体调快调慢改这里，别去各个阶段里手改数字。
 */
const PACE = {
  /** 两只立绘横向划入（光带横扫、名牌从右边划进来都在这一段时间里） */
  slideIn: 560,
  /** 双双停留：预载和战斗界面挂载都在这一小会里做完 */
  hold: 620,
  /** 一起滑出屏幕 */
  slideOut: 460,
};

/** 停留阶段最多为预载多等这么久；超了就先走，剩下的在后台继续载 */
const WARM_CAP = 1200;
/** 停留本身不能短于这个值（倍率调到最快时也得让人看清对面是谁） */
const HOLD_MIN = 300;

/**
 * 两只立绘的站位（错开）与大小。
 *   · 敌人正面图在**右上**、我方背影在**左下** —— 和战斗场地里的对角站位一致，
 *     也让两只不会挤在同一条水平线上。
 *   · vh 是「立绘位高度 ÷ 视口高」，真正画出来多大还要乘一个跟着物种走的大小系数
 *     （fitArt 里的 art.scale：大岩蛇比刺尾虫占地方）。
 *   · maxAspect 卡住横向：大岩蛇那种特别宽的别横着铺出去压到名字 / 屏幕外。
 */
const SLOT = {
  enemy: { vh: 0.36, vw: 0.30, maxAspect: 1.7, top: '32%', side: 'right' },
  player: { vh: 0.44, vw: 0.34, maxAspect: 1.9, top: '72%', side: 'left' },
};

/**
 * 那条横线**不是孤零零一条**（用户：「背景那条线可以多放几条，光秃秃的一条不太好看」）。
 * 围着主线再放几条更细更暗的，组成一组霓虹灯管：
 *   o = 相对主线的高度偏移（px，主线中线为 0）
 *   t = 粗细（px）      a = 不透明度      w = 宽度倍率（外侧几条短一点，收出一点层次）
 * 它们全都跟着敌人走（宽度、纵向位置都由外层 .enc-lines 统一给），
 * 所以整组一起铺过来、一起铺满，不会各走各的。
 */
const LINES = [
  { o: -56, t: 1, a: 0.26, w: 0.6 },
  { o: -30, t: 2, a: 0.44, w: 0.84 },
  { o: 0, t: 4, a: 1, w: 1, main: true },
  { o: 32, t: 2, a: 0.38, w: 0.78 },
  { o: 60, t: 1, a: 0.22, w: 0.5 },
];

/**
 * 光带的长度：**恒等于整幅视口宽**（用户：「我希望光条没有拉长，进来就是最长的」）。
 *
 * 这条常数不再是「划入阶段的临时长度」，而是写死不动的长度 ——
 * 光带从第一帧起就是满宽，唯一会变的是它的**位置**（整条从左往右扫）。
 */
const BAND_VW = 1;

/**
 * 名牌（名字 + 霓虹灯）的进场参数。
 *
 * 整块从屏幕右边划进来，但**里面每一份到达的时间不同**，做出「从右往左逐渐拉开」：
 *   START      —— 整段划入的第几成进度时名牌起步（前面先让敌人和光带动起来）
 *   LAYER_*    —— 霓虹灯的 4 份，每一份自己有一段「把多留的距离收回去」的时间窗：
 *       · 第 i 份从 `i × LAYER_STEP` 开始收，到 `LAYER_DONE + i × LAYER_DONE_STEP` 收完；
 *       · 于是最靠右的基准那份（--i: 0）**最早**收回、往左的一份份排在后面 ——
 *         中途那 4 份是**朝右边拖开**的一串（实测间距能到静态的 3 倍多），
 *         再从左往右一份份落回自己的位置，这就是「从右往左逐渐拉开」。
 *       · 收的速度用 smoothstep（两头速度都是 0）。用 ease-out 收的话，
 *         每一份刚轮到自己的时候速度是**从 0 直接跳到最大**，看起来就是「猛地跳一下」。
 *   LAYER_PULL —— 每份多留的距离（占整段位移的比例）。
 *                 **不要调太小**：它决定了中途能拖多开；太小就等于整排一起平移、看不出错开。
 *   NAME_AT    —— 名字从名牌进场的第几成开始收自己那点滞后
 *                 （**不能留到最后一刻**：留到最后一刻收，就是「名字猛地往前一跳」）
 *   NAME_PULL  —— 名字多留的距离
 *   EXIT_LEAD  —— 退场时名牌比黑幕**快**这一点（用户：「离开的和黑幕错开一点，
 *                 不要完全跟着走」）。同一时刻黑幕走了 easeIn(p)，名牌走的是
 *                 easeIn(p × EXIT_LEAD)，所以它先一步出画，两者在退场中途明显错开。
 */
const PLATE = {
  START: 0.12,
  LAYER_STEP: 0.1,
  LAYER_DONE: 0.55,
  LAYER_DONE_STEP: 0.15,
  LAYER_PULL: 0.45,
  NAME_AT: 0.5,
  NAME_PULL: 0.3,
  EXIT_LEAD: 1.25,
};

// ---------------------------------------------------------------------------
// 开关：什么时候才演这一段
// ---------------------------------------------------------------------------

/**
 * 'map'（默认）只有「玩家从地图上走过去撞见的」战斗才演；
 * 'always' 任何入口都演（遭遇演出的诊断脚本用它，因为它是直接 startBattle 的）；
 * 'never'  完全不演（其余截图 / 冒烟脚本用，它们都是「进战斗立刻读 DOM」）。
 */
let mode = 'map';

export function setEncounterMode(m) { mode = m; }
export function encounterMode() { return mode; }

/** @param {string} entry game.battleEntry：'map' = 从地图走进去的 */
export function wantsEncounter(entry) {
  if (mode === 'never') return false;
  if (mode === 'always') return true;
  return entry === 'map';
}

/** 诊断用：把演出钉在某个阶段不动（截图脚本用），正常游戏里永远是 null */
export const encounterDebug = { freeze: null, freezeP: null, _release: null };

export function releaseEncounterDebug() {
  encounterDebug.freeze = null;
  const r = encounterDebug._release;
  encounterDebug._release = null;
  r?.();
}

function debugHold(phase) {
  if (encounterDebug.freeze !== phase) return Promise.resolve();
  return new Promise((resolve) => { encounterDebug._release = resolve; });
}

// ---------------------------------------------------------------------------
// 小工具
// ---------------------------------------------------------------------------

/**
 * 演出时间轴。**所有会动的东西都由同一个 ticker 推进**，
 * 所以「光带扫到哪儿」和「敌人走到哪儿」是同一套进度算出来的，
 * 而不是靠两条 CSS 曲线碰巧对齐（差几像素就能看出两者没对上）。
 *
 * 用 setInterval 而不是 requestAnimationFrame：标签页不可见时 rAF 会被节流到几乎不动，
 * 那样演出会卡在半路、战斗永远进不去（行走图那边也是因为这个才用 setInterval）。
 */
function tween(ms, onTick, until = 1) {
  return new Promise((resolve) => {
    const t0 = performance.now();
    const tick = () => {
      const p = ms <= 0 ? 1 : Math.min(1, (performance.now() - t0) / ms);
      const q = Math.min(p, until);
      onTick(q);
      if (q >= until) { clearInterval(timer); resolve(); }
    };
    const timer = setInterval(tick, 16);
    onTick(0);
  });
}

/** 非线性缓动：强 ease-out（起步猛、收尾慢），"划进来"的手感就靠它 */
const easeOut = (p) => 1 - Math.pow(1 - p, 3.2);
/** 退场用 ease-in：慢慢起步、越走越快，像被甩出画面 */
const easeIn = (p) => Math.pow(p, 2.2);
/** 两头速度都是 0 的缓动：接在别的运动后面时，接缝处才不会有「一顿再起步」 */
const smoothstep = (p) => p * p * (3 - 2 * p);
/** 夹到 0~1：名牌的进场进度会算出负数（那一段它就该待在屏幕外） */
const clamp01 = (p) => (p < 0 ? 0 : p > 1 ? 1 : p);
/**
 * 造一张立绘 <img>。
 *
 * fitArt 是回合立绘那套已经在用的规则：瘦高的按立绘位高度撑满，扁宽的被最大宽度卡住；
 * 再乘一个跟着物种走的大小系数（art.scale），所以大岩蛇看起来就是比刺尾虫占地方。
 * 这里给的立绘位高度同时受 vh / vw 两个上限压着，窄窗口下立绘会自己变小。
 */
function makeArt(slug, kind, slot) {
  const art = turnArt(slug, kind);
  // 素材缺失（新物种还没 import-gen9）就返回 null：宁可少画一只，也不要留个破图
  if (!art) return null;
  const byH = window.innerHeight * slot.vh;
  const byW = (window.innerWidth * slot.vw) / Math.max(0.2, art.ar);
  const { w, h } = fitArt(art, Math.min(byH, byW), slot.maxAspect);
  const img = el('img', {
    class: 'enc-art',
    alt: '',
    dataset: { slug, kind },
    style: { width: `${w}px`, height: `${h}px` },
  });
  img.src = art.url;
  img.draggable = false;
  return img;
}

/**
 * 停留阶段要预载的东西。按「进战斗后立刻就用得上」排序：
 *   1. 战斗音效 —— 第一次响不用再等网络 + 解码（「音效慢半拍」的根因）
 *   2. 这一场的 BGM —— 预解码，幕布掀开时音乐已经在响
 *   3. 打起来才会换的行走图（攻击 / 受伤）与角色卡头像
 *
 * 注意第 3 项预热的仍然是**行走图**（PMD 精灵图）—— 战斗场地上用的是它，
 * 而这场演出用的是立绘，两套东西不通用。
 */
function warmBattleAssets(game, battle) {
  const jobs = [
    audio.warm([...BATTLE_SFX, ...ENCOUNTER_SFX]),
    // music.current 就是刚切过来的那首战斗曲（UI.render 比这场演出先一步切歌）
    music.preload([music.current].filter(Boolean), { decode: true }),
    preloadAnim(battle.enemy.slug, 'Attack'),
    preloadAnim(battle.enemy.slug, 'Hurt'),
    preloadAnim(game.data.slug, 'Attack'),
    preloadAnim(game.data.slug, 'Hurt'),
    createPortrait(battle.enemy.slug, { emotion: 'normal' }),
    createPortrait(game.data.slug, { emotion: 'determined' }),
  ];
  // 单项失败不影响其它项，也不该让演出卡住
  return Promise.all(jobs.map((p) => Promise.resolve(p).catch(() => null)));
}

// ---------------------------------------------------------------------------
// 演出本体
// ---------------------------------------------------------------------------

/**
 * 放一遍遭遇演出。
 * @param {object} opts
 * @param {object} opts.game
 * @param {object} opts.battle  这一场的 Battle 实例（只读它的 enemy）
 * @param {() => void} [opts.onCovered] 幕布**完全盖住屏幕**时回调（战斗界面在此时挂载最稳）
 * @param {() => boolean} [opts.shouldAbort] 返回 true 就立刻收场（演出期间玩家切屏了）
 * @returns {Promise<boolean>} 演出是否完整放完
 */
export async function playEncounter(opts = {}) {
  const { game, battle, onCovered, shouldAbort } = opts;
  const enemy = battle?.enemy;
  const abort = () => shouldAbort?.() === true;
  let covered = false;
  const cover = () => { if (covered) return; covered = true; onCovered?.(); };

  if (!enemy || !game?.data || abort()) { cover(); return false; }

  let root = null;

  try {
    const mul = speedMulOf(loadBattleSpeed());
    /**
     * 「减少动态效果」时不做横向动画，直接给一张静止的幕布卡：
     * 精灵就位、幕布铺满、名字亮出来，停一下再撤 —— 信息一样都没少。
     * （style.css 里那条 prefers-reduced-motion 只压得住 CSS transition，
     *   这里的位移是 JS 每帧写进去的，不受它管，所以得自己判断。）
     */
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true;
    const t = (ms) => (still ? 24 : Math.max(24, Math.round(ms * mul)));
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // ---- 建 DOM ----
    const enemyArt = makeArt(enemy.slug, 'front', SLOT.enemy);
    const playerArt = makeArt(game.data.slug, 'back', SLOT.player);
    // 两只都拿不到立绘就别演了，直接进战斗（宁可没演出，也不能卡住）
    if (!enemyArt && !playerArt) { cover(); return false; }

    const enemyBody = el('div', { class: 'enc-body' }, [enemyArt]);
    const playerBody = el('div', { class: 'enc-body' }, [playerArt]);
    /**
     * 名牌：**霓虹灯在下、名字压在它正中**，整块挂在屏幕右下。
     *
     * 它是 .encounter 的**直接子节点**（不是塞在敌人那一组里）—— 这是「叠在所有元素之上」
     * 的结构前提：塞在 .enc-enemy 里的话，它的层级永远低于 z-index 更高的我方立绘，
     * 霓虹灯一放大就会被立绘压住。现在它是独立的 z-index: 4，只在黑幕(1)和两只立绘(2/3)之上。
     *
     * 霓虹灯 = 同一个词用**超大空心字**横向错开叠 4 份、半透明 ——
     * 空心靠 -webkit-text-stroke（字身透明、只留描边），错开量由每份自己的 --i 决定，
     * 四份在 grid 的同一格里，所以整组自然围绕中心对称。
     * 所以「四份」在 DOM 上是看得见的：诊断直接数 .enc-neon-i 的个数，不靠肉眼。
     * 档位词用 TIERS[tier].name（野生 / 较强 / 精英 / 首领），不另抄一份。
     */
    const tierName = TIERS[enemy.tier]?.name ?? '';
    const neon = el('div', { class: 'enc-neon', 'aria-hidden': 'true' },
      [0, 1, 2, 3].map((i) => el('span', { class: 'enc-neon-i', text: tierName, style: { '--i': String(i) } })));
    const plate = el('div', { class: 'enc-plate' }, [
      neon,
      el('div', { class: 'enc-name', text: enemy.name ?? '' }),
    ]);
    const enemyWrap = el('div', { class: 'enc-fighter enc-enemy' }, [enemyBody]);
    const playerWrap = el('div', { class: 'enc-fighter enc-player' }, [playerBody]);
    /**
     * 黑幕 + 那组横线。
     *
     * 黑幕是**整屏**的、一上来就不透明 —— 用户明确要求「黑幕能遮挡住整个屏幕」，
     * 所以它不是「被横线慢慢张开」的东西：地图从第一帧起就一点都看不见。
     * 横线组跟着黑幕一起退场（它是黑幕的子节点）。
     */
    const lineBox = el('div', { class: 'enc-lines' }, LINES.map((L) => el('i', {
      class: `enc-line${L.main ? ' enc-line-main' : ''}`,
      style: { '--o': `${L.o}px`, '--t': `${L.t}px`, '--a': String(L.a), '--w': String(L.w) },
    })));
    const curtain = el('div', { class: 'enc-curtain' }, [lineBox]);

    root = el('div', { class: 'encounter', dataset: { tier: enemy.tier ?? 'normal', phase: 'in' } }, [
      curtain, enemyWrap, playerWrap, plate,
    ]);
    document.body.append(root);
    /**
     * 把当前阶段写在 data-phase 上。
     * 诊断脚本要按阶段切分时间线（「划入时横线贴着敌人」和「补满时横线当然在前头」
     * 是两回事，靠肉眼猜阶段会误报）。生产代码里它只是四行赋值，没有别的用途。
     */
    const setPhase = (p) => { root.dataset.phase = p; };

    // 起点：整个在屏幕外。用 px 而不是 vw，是为了让横线的宽度能和它精确对上。
    const off = Math.round(Math.max(vw, vh) * 1.3);

    // 先把两只摆到屏幕外（在任何一次绘制之前），免得开演第一帧闪一下「已经在终点」的立绘。
    // 用 offset* 定位是**不行**的：它们的参照物是最近的定位祖先，而 .enc-enemy 是
    // position:absolute —— 量到的是「在 .enc-enemy 里面的位置」而不是屏幕坐标
    // （这个坑真的踩了：横线被画到了敌人左边 990px 的地方）。所以一律用屏幕坐标。
    playerWrap.style.transform = `translateY(-50%) translateX(${off}px)`;
    enemyWrap.style.transform = `translateY(-50%) translateX(${-off}px)`;

    /**
     * 线组的左右两端（屏幕坐标）。
     * 组成一条线的是「两个端点」，所以这里也只记端点：位移 = 左端，宽度 = 右端 - 左端。
     * 用端点表达之后，「右端贴着敌人中线」和「整条从左边划进来」是同一套参数，不会互相打架。
     */
    const applyBand = (L, R) => {
      lineBox.style.transform = `translateX(${Math.round(L)}px)`;
      lineBox.style.width = `${Math.max(0, Math.round(R - L))}px`;
    };

    /**
     * 名牌：**从屏幕右边外面划进来**，而且里面的东西是一份份落定的。
     *
     * 以前这一步是一段 28px 的位移 + 淡入（CSS transition）。霓虹灯的字号动辄 300px，
     * 28px 连一个字宽都不到，用户看到的就是「它本来就长在那儿」——
     * 原话：「名字和霓虹灯好像没有任何进场动画，名字和霓虹灯都可以从右划入」。
     *
     * 现在整块从屏幕右侧外滑到自己的位置，**到位顺序是从右往左**：
     *   霓虹灯的 4 份 —— 最靠右的基准那份（--i: 0）先落定，往左的每一份慢一拍、多留一段距离，
     *     于是整组字是「从右往左一份份拉开」的（用户点名要的感觉）；
     *   名字 —— 最后落定（灯管先铺开、名字再压上去）。
     * 起点距离 = 名牌自己的宽度 + 它到屏幕右边的空隙（现量，字体换上来之后也不会偏）。
     */
    const nameEl = plate.querySelector('.enc-name');
    const neonLayers = [...neon.querySelectorAll('.enc-neon-i')];
    const plateGap = Math.max(0, Math.round(vw - plate.getBoundingClientRect().right));
    /** 第 i 份霓虹灯「把多留的距离收回去」的进度：越靠左（i 越大）收得越晚 */
    const layerP = (pp, i) => {
      const from = i * PLATE.LAYER_STEP;
      const to = PLATE.LAYER_DONE + i * PLATE.LAYER_DONE_STEP;
      return clamp01((pp - from) / Math.max(0.05, to - from));
    };
    const plateTick = (pp) => {
      const away = Math.round(plate.offsetWidth + plateGap + 16);
      const e = easeOut(clamp01(pp));
      plate.style.transform = `translateX(${Math.round(away * (1 - e))}px)`;
      /**
       * 每一份自己那点「多留的距离」用 **smoothstep** 收掉，不是 ease-out。
       *
       * 用 ease-out 的话，那一份刚开始收的时候速度是**从 0 直接跳到最大** ——
       * 它本来就跟着整块在动，于是合速度突然翻好几倍，看起来就是「名字猛地往前一跳」
       * （用户报的「名字进入有跳变」）。smoothstep 两头速度都是 0，
       * 接在整块的运动上速度是连续的。
       */
      neonLayers.forEach((el, i) => {
        // 多留的那段距离通过 CSS 变量交给 .enc-neon-i 的 transform（它还有自己的错开量）
        const pull = Math.round(away * PLATE.LAYER_PULL * (1 - smoothstep(layerP(pp, i))));
        el.style.setProperty('--dx', `${pull}px`);
      });
      if (!nameEl) return;
      const np = clamp01((pp - PLATE.NAME_AT) / (1 - PLATE.NAME_AT));
      nameEl.style.transform = `translateX(${Math.round(away * PLATE.NAME_PULL * (1 - smoothstep(np)))}px)`;
    };
    plateTick(0);

    /**
     * 划入：两只横向对穿；光带**从头到尾都是整幅视口宽**，整条从屏幕左边外面扫进来。
     *
     * 用户两轮下来的结论：「我希望光条没有拉长，进来就是最长的」。
     * 所以这里不做任何「先短后长」的事 —— 光带的长度恒等于视口宽，
     * 唯一的运动是**平移**：
     *   · 右端 = 敌人推进的成数 × 视口宽（敌人落定时正好到屏幕右边）；
     *   · 左端 = 右端 − 视口宽（敌人落定时正好贴住屏幕左边）。
     * 也就是说亮着的那条前沿一路扫过去，扫完的那一刻敌人也正好站定，全屏覆盖，全程不拉长。
     *
     * 代价是右端不再严丝合缝地贴在敌人中线上（它比中线略靠前，最多 17% 屏宽）——
     * 「恒长」和「贴着中线」在几何上没法同时成立：中线只到屏幕的 8x%，剩下那一段总得有人填。
     *
     * 位置每一帧都**现量**（不用开演前算好的常数）：名牌的字是 CJK 字体渲染的，
     * 而字体是异步加载的 —— 字体一落定，名牌宽度就变、整组立绘跟着挪，
     * 事先算好的常数会立刻偏掉（诊断量到过 1.9px 的漂移，就是字体在这一瞬间换上了）。
     * 现量现贴，布局怎么变都跟得上。
     */
    let bandL = 0;
    let bandR = 0;
    const slideTick = (p) => {
      const e = easeOut(p);
      const dx = Math.round(off * (1 - e));
      playerWrap.style.transform = `translateY(-50%) translateX(${dx}px)`;
      enemyWrap.style.transform = `translateY(-50%) translateX(${-dx}px)`;
      const r = (enemyArt ? enemyBody : enemyWrap).getBoundingClientRect();
      const cx = r.left + r.width / 2;
      // dx 是这一帧给敌人加的左移量，所以「落定时」的中线 = 现在的中线 + dx
      const k = clamp01(cx / Math.max(1, cx + dx));
      bandR = Math.round(k * vw * BAND_VW);
      bandL = bandR - Math.round(vw * BAND_VW);
      applyBand(bandL, bandR);
      lineBox.style.top = `${Math.round(r.top + r.height / 2)}px`;
      // 名牌：整段划入的后 88% 时间里从右边划进来
      plateTick((p - PLATE.START) / (1 - PLATE.START));
    };

    // ---- ① 划入：两只对穿 + 光带跟着敌人从左边扫进来 + 名牌从右边划进来 ----
    /**
     * 预载在这一刻就**起步**，而不是等到停留阶段才开始。
     *
     * 这批音效一共约 2.9 MB（PANICPUMPKIN 的 wav，单个最大 296 KB），
     * 真正贵的是下载；先发出去，让它和「划入 + 横线盖屏」这 800 多毫秒重叠，
     * 停留阶段只需要等剩下的那一点。停留结束时这个 Promise 一定已经兑现或已被放弃。
     */
    const warm = warmBattleAssets(game, battle);
    audio.play('magic_wind', { volume: 0.36, rate: 1.15 });
    if (encounterDebug.freeze === 'in-mid') {
      // 诊断：把「划到一半」这一帧钉住（截图脚本要拍光带跟不跟得上立绘、名牌划到哪儿了）
      slideTick(clamp01(encounterDebug.freezeP ?? 0.55));
      await debugHold('in-mid');
    } else {
      await tween(t(PACE.slideIn), slideTick);
    }
    if (abort()) return false;

    // 划完的那一刻光带已经铺满整幅宽度了（它进场时就是最长的），所以这里没有「补满」阶段 ——
    // 只有那一下「铺到边」的音效，接着直接进停留。
    audio.play('maximize', { volume: 0.5 });
    root.classList.add('is-full');
    setPhase('hold');
    if (abort()) return false;

    // ---- ③ 双双停留：此刻屏幕已经被幕布盖住，正好拿来等资源 ----
    // 幕布已经盖住屏幕了，战斗界面现在挂载最稳（mount() 会 clear 掉地图，
    // 而地图此刻被幕布挡着，看不到那一下清屏）。
    cover();
    await debugHold('hold');
    if (abort()) return false;
    // 停留本身有个下限：倍率调到最快、或者开了「减少动态效果」时，
    // 也得留出让人看清对面是谁、以及让下面的预载跑一会儿的时间。
    const holdMs = still ? 520 : Math.max(HOLD_MIN, t(PACE.hold));
    const holdStart = performance.now();
    await Promise.race([warm, sleep(WARM_CAP)]);
    const left = holdMs - (performance.now() - holdStart);
    if (left > 0) await sleep(left);
    if (abort()) return false;

    // ---- ④ 一起滑出屏幕 ----
    setPhase('out');
    // 诊断可以把退场也钉在中途（截图脚本要拍「名牌和黑幕错开」那一下）
    const outStop = encounterDebug.freeze === 'out-mid' ? clamp01(encounterDebug.freezeP ?? 0.5) : 1;
    await tween(t(PACE.slideOut), (p) => {
      const e = easeIn(p);
      playerWrap.style.transform = `translateY(-50%) translateX(${Math.round(-off * e)}px)`;
      enemyWrap.style.transform = `translateY(-50%) translateX(${Math.round(off * e)}px)`;
      // 整块黑幕（连同上面那组光带）从左边开始把战斗画面让出来
      curtain.style.transform = `translateX(${Math.round(vw * e)}px)`;
      /**
       * 名牌**跟着黑幕一起出**，但**比黑幕快一点**（用户：「离开的和黑幕错开一点，
       * 不要完全跟着走可能好一点」）。
       *
       * 它本来就叠在黑幕之上（z-index 4 > 1），所以只要位移不同就会肉眼可见地错开：
       * 黑幕走 easeIn(p)，名牌走 easeIn(p × EXIT_LEAD) —— 同一个起点、更陡的曲线，
       * 于是名牌先一步滑出画面，黑幕随后把战斗画面让出来。
       * 光带在里面（它是黑幕的子节点），仍然跟着黑幕走。
       */
      plate.style.transform = `translateX(${Math.round(vw * easeIn(clamp01(p * PLATE.EXIT_LEAD)))}px)`;
    }, outStop);
    if (outStop < 1) { await debugHold('out-mid'); }
    return true;
  } catch (err) {
    console.error('[oasis] 遭遇演出出错，直接进战斗：', err);
    return false;
  } finally {
    root?.remove();
    encounterDebug._release = null;
    // 演出没走完（出错 / 被中断）也要保证战斗界面能挂上，别把玩家一个人留在黑屏上
    if (!abort()) cover();
  }
}
