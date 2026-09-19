// 遭遇演出：从地图踏进战斗之间的过场。
//
// 效果（用户点名要的）：
//   黑幕**一上来就把整个屏幕盖住**（地图不再露出任何一角）；
//   我方**背影**从右边非线性划到左下，敌人的**正面图**从左滑到右上 —— 两只**错开**站位；
//   一条黑底 + 主题色的横线跟着敌人的正面图铺过来（右端始终贴着它的中线）；
//   双双停留一小会（这段时间用来预载战斗资源），然后一起滑出屏幕、进战斗。
//   敌人的立绘旁边写着大号的名字和档位标注（野生 / 较强 / 精英 / 首领）。
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
  /** 两只立绘横向划入 */
  slideIn: 560,
  /** 横线跟着敌人铺完之后，把没铺到的部分补满 */
  bandFill: 300,
  /** 双双停留：预载和战斗界面挂载都在这一小会里做完 */
  hold: 620,
  /** 一起滑出屏幕 */
  slideOut: 460,
};

/** 停留阶段最多为预载多等这么久；超了就先走，剩下的在后台继续载 */
const WARM_CAP = 1200;
/** 停留本身不能短于这个值（倍率调到最快时也得让人看清对面是谁） */
const HOLD_MIN = 300;
/** 横线的粗细 */
const LINE_H = 8;

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
export const encounterDebug = { freeze: null, _release: null };

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
 * 所以「横线的右端 = 敌人立绘的中线」是构造上成立的，
 * 而不是靠两条 CSS 曲线碰巧对齐（差几像素就能看出横线没「跟着」立绘）。
 *
 * 用 setInterval 而不是 requestAnimationFrame：标签页不可见时 rAF 会被节流到几乎不动，
 * 那样演出会卡在半路、战斗永远进不去（行走图那边也是因为这个才用 setInterval）。
 */
function tween(ms, onTick) {
  return new Promise((resolve) => {
    const t0 = performance.now();
    const tick = () => {
      const p = ms <= 0 ? 1 : Math.min(1, (performance.now() - t0) / ms);
      onTick(p);
      if (p >= 1) { clearInterval(timer); resolve(); }
    };
    const timer = setInterval(tick, 16);
    onTick(0);
  });
}

/** 非线性缓动：强 ease-out（起步猛、收尾慢），"划进来"的手感就靠它 */
const easeOut = (p) => 1 - Math.pow(1 - p, 3.2);
/** 退场用 ease-in：慢慢起步、越走越快，像被甩出画面 */
const easeIn = (p) => Math.pow(p, 2.2);
const lerp = (a, b, p) => a + (b - a) * p;

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
    // 名字用大号写在立绘旁边，档位（野生 / 较强 / 精英 / 首领）用数据里的名字，别抄一份
    const plate = el('div', { class: 'enc-plate' }, [
      el('div', { class: 'enc-name', text: enemy.name ?? '' }),
      el('div', { class: 'enc-tier', text: TIERS[enemy.tier]?.name ?? '' }),
    ]);
    const enemyWrap = el('div', { class: 'enc-fighter enc-enemy' }, [plate, enemyBody]);
    const playerWrap = el('div', { class: 'enc-fighter enc-player' }, [playerBody]);
    /**
     * 黑幕 + 那条横线。
     *
     * 黑幕是**整屏**的、一上来就不透明 —— 用户明确要求「黑幕能遮挡住整个屏幕」，
     * 所以它不是「被横线慢慢张开」的东西：地图从第一帧起就一点都看不见。
     * 横线是黑幕的子节点，于是退场时黑幕往右滑，线跟着一起走。
     */
    const line = el('i', { class: 'enc-line' });
    const curtain = el('div', { class: 'enc-curtain' }, [line]);

    root = el('div', { class: 'encounter', dataset: { tier: enemy.tier ?? 'normal', phase: 'in' } }, [
      curtain, enemyWrap, playerWrap,
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
     * 划入：两只横向对穿，横线的右端 = 敌人立绘**此刻**的中线。
     *
     * 位置每一帧都**现量**（不用开演前算好的常数）：名牌的字是 CJK 字体渲染的，
     * 而字体是异步加载的 —— 字体一落定，名牌宽度就变、整组立绘跟着挪，
     * 事先算好的常数会立刻偏掉（诊断量到过 1.9px 的漂移，就是字体在这一瞬间换上了）。
     * 现量现贴，布局怎么变都跟得上。
     */
    const slideTick = (p) => {
      const e = easeOut(p);
      const dx = Math.round(off * (1 - e));
      playerWrap.style.transform = `translateY(-50%) translateX(${dx}px)`;
      enemyWrap.style.transform = `translateY(-50%) translateX(${-dx}px)`;
      const r = (enemyArt ? enemyBody : enemyWrap).getBoundingClientRect();
      // 右端贴的是敌人立绘的中线；线的**高度**也对齐它的中腰 ——
      // 两只错开站位之后，线跟着上边那只走（这是「跟随正面图」的字面意思），
      // 而不是钉在屏幕正中。
      line.style.width = `${Math.max(0, Math.round(r.left + r.width / 2))}px`;
      line.style.top = `${Math.round(r.top + r.height / 2 - LINE_H / 2)}px`;
    };

    // ---- ① 划入 + 横线跟着敌人铺过来 ----
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
      // 诊断：把「划到一半」这一帧钉住（截图脚本要拍横线到底有没有跟着立绘）
      slideTick(0.55);
      root.classList.add('plate-in');
      await debugHold('in-mid');
    } else {
      await tween(t(PACE.slideIn), (p) => {
        slideTick(p);
        // 划到一半时把名字「写」上去（此时幕布已经铺到那块地方，黑底上白字才读得清）
        if (p > 0.5) root.classList.add('plate-in');
      });
    }
    if (abort()) return false;

    // ---- ② 横线铺满整幅宽度 ----
    setPhase('fill');
    // 起点就取横线此刻的实际值（而不是再算一遍），接着往右铺到屏幕另一头。
    // 黑幕本身早就是满屏的了，这一步只是把那条主题色横线拉通（"把屏幕盖住"的是黑幕）。
    const w0 = parseFloat(line.style.width) || 0;
    await tween(t(PACE.bandFill), (p) => {
      line.style.width = `${Math.round(lerp(w0, vw, p))}px`;
    });
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
    await tween(t(PACE.slideOut), (p) => {
      const e = easeIn(p);
      playerWrap.style.transform = `translateY(-50%) translateX(${Math.round(-off * e)}px)`;
      enemyWrap.style.transform = `translateY(-50%) translateX(${Math.round(off * e)}px)`;
      // 整块黑幕（连同上面那条线）跟着敌人一起退场：从左边开始把战斗画面让出来
      curtain.style.transform = `translateX(${Math.round(vw * e)}px)`;
    });
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
