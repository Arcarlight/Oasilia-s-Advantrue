// 遭遇演出：从地图踏进战斗之间的过场。
//
// 效果（用户点名要的）：
//   我方**背影**从右边非线性划到左边，敌人的**正面图**从左滑到右边；
//   同时一条黑底 + 主题色的横线跟着敌人的正面图，把屏幕整个盖住；
//   双双停留一小会，然后一起滑出屏幕、进战斗。
//   敌人的立绘旁边写着大号的名字和档位标注（野生 / 较强 / 精英 / 首领）。
//
// 朝向：SpriteCollab 的精灵图竖直方向是朝向，UP 那一行是「背对镜头」——
//   所以「我方背影」= DIR.UP，「敌人正面图」= DIR.DOWN，不是随便挑的。
//
// ── 关于「停留时预载能不能治好音效慢半拍」────────────────────────────
// 能，但**光有动画没有用**：浏览器不会因为画面上有东西在动就去预载任何文件。
// 起作用的是这里显式调用的 audio.warm() / sprites.preloadAnim() / music.preload()：
//
//   audio.play(name) 的链路是 fetch → decodeAudioData → src.start()，
//   所以每个音效**第一次响**都要先等一次网络往返 + 解码。冷启动时最明显：
//   点下第一张攻击卡，「挥剑声」会比动画慢半拍 —— 因为那一瞬间才刚开始下载文件。
//   warm() 在停留阶段就把这批文件变成 AudioBuffer 存进 audio.js 的缓存，
//   之后 play() 拿到的就是现成的 buffer，`src.start()` 是立刻响的。
//
//   同理，music.play() 要先 fetch 整首 ogg 再解码（一首 3 分钟），
//   不预解码的话「进战斗」的那一下会先是安静的。这里 decode:true 一起解掉。
//
// 所以「停留一小会」不是纯装饰 —— 它把这段时间换成了资源预载。
// 缓存命中时 warm() 立刻兑现，停留就只剩「让玩家看清对面是谁」的时间。

import { el, sleep } from './dom.js';
import { createAnim, animInfo, preloadAnim, frameCoverage, DIR } from '../core/sprites.js';
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
  /** 两只精灵横向划入 */
  slideIn: 560,
  /** 横线跟到敌人身上之后，再张开把屏幕盖满 */
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
/** 横线（还没张开时）的粗细 */
const LINE_H = 8;

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
const easeInOut = (p) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);
const lerp = (a, b, p) => a + (b - a) * p;

/**
 * 立绘缩放：按视口算 —— 敌人正面图占屏高 34%、我方背影离镜头更近占 40%。
 *
 * 缩放必须**由帧高推出来**（各物种帧高不同，写死 3、4 就会有的巨大有的迷你），
 * 而且要先拿 cov（frameCoverage 的留白测量）把帧里的透明部分补回来：
 * 精灵图的帧尺寸含留白，沙漠蜻蜓 32×72 的帧里真正画着龙的只有约 30×28 ——
 * 只按帧高算，「占 40% 高」实际只有 13%，怪兽小得像只虫子。
 * 宽度也夹一道，免得宽扁的精灵在窄窗口里横着溢出去压到名字。
 */
function scaleFor(slug, anim, vhFrac, vwFrac, fallback, cov) {
  const info = animInfo(slug, anim);
  if (!info) return fallback;
  // 留白极端到内容只有一成时，当作量不到，免得缩放炸掉
  const sh = cov && cov.sh > 0.12 ? cov.sh : 1;
  const sw = cov && cov.sw > 0.12 ? cov.sw : 1;
  const byH = (window.innerHeight * vhFrac) / (info.fh * sh);
  const byW = (window.innerWidth * vwFrac) / (info.fw * sw);
  return Math.max(0.5, Math.min(byH, byW));
}

/**
 * 把立绘在帧里的位置对齐到**有画面的那块**。
 *
 * 帧的下缘往往留着一截透明（影子位、动作幅度），直接用画布中线摆的话，
 * 怪兽会整体偏上、跟横线错开半个身位。这里按测得的内容中心把画布挪回去，
 * 挪完「画布中线」就等于「画面中线」，横线照着画布中线贴就一定对得准。
 */
function alignCanvas(canvas, info, scale, cov) {
  if (!canvas || !info || !cov) return;
  const h = info.fh * scale;
  const dy = Math.round((0.5 - cov.cy) * h);
  if (dy) canvas.style.transform = `translateY(${dy}px)`;
}

/**
 * 停留阶段要预载的东西。按「进战斗后立刻就用得上」排序：
 *   1. 战斗音效 —— 第一次响不用再等网络 + 解码（「音效慢半拍」的根因）
 *   2. 这一场的 BGM —— 预解码，幕布掀开时音乐已经在响
 *   3. 打起来才会换的行走图（攻击 / 受伤）与角色卡头像
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
  let enemyAnim = null;
  let playerAnim = null;

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
    // 先量两张图的「帧里有多少是真画面」（frameCoverage 顺带把图取回来，
    // 后面 createAnim 会命中同一份缓存，不会多下一次请求），再据此定缩放。
    const [enemyCov, playerCov] = await Promise.all([
      frameCoverage(enemy.slug, 'Idle', DIR.DOWN).catch(() => null),
      frameCoverage(game.data.slug, 'Idle', DIR.UP).catch(() => null),
    ]);
    const enemyScale = scaleFor(enemy.slug, 'Idle', 0.34, 0.30, 3, enemyCov);
    const playerScale = scaleFor(game.data.slug, 'Idle', 0.4, 0.32, 3.4, playerCov);

    // 两张图并行建（串行会白等一倍）；取不到就 null，下面会降级
    [enemyAnim, playerAnim] = await Promise.all([
      createAnim(enemy.slug, { anim: 'Idle', fps: 7, dir: DIR.DOWN, scale: enemyScale }).catch(() => null),
      createAnim(game.data.slug, { anim: 'Idle', fps: 8, dir: DIR.UP, scale: playerScale }).catch(() => null),
    ]);
    // 两只都拿不到图就别演了，直接进战斗（宁可没演出，也不能卡住）
    if (!enemyAnim && !playerAnim) { cover(); return false; }

    const enemyInfo = animInfo(enemy.slug, 'Idle');
    const playerInfo = animInfo(game.data.slug, 'Idle');
    alignCanvas(enemyAnim, enemyInfo, enemyScale, enemyCov);
    alignCanvas(playerAnim, playerInfo, playerScale, playerCov);

    const enemyBody = el('div', { class: 'enc-body' }, [enemyAnim]);
    const playerBody = el('div', { class: 'enc-body' }, [playerAnim]);
    // 名字用大号写在立绘旁边，档位（野生 / 较强 / 精英 / 首领）用数据里的名字，别抄一份
    const plate = el('div', { class: 'enc-plate' }, [
      el('div', { class: 'enc-name', text: enemy.name ?? '' }),
      el('div', { class: 'enc-tier', text: TIERS[enemy.tier]?.name ?? '' }),
    ]);
    // 画布左边常常也有一截透明，名牌会跟怪兽隔出一条空档。
    // 按测得的留白把名牌往里拉，拉到「贴着画出东西的那条边」为止（最多拉到画布的 1/3，别压上去）。
    let enemyCx = 0.5;
    if (enemyCov && enemyInfo) {
      const boxW = enemyInfo.fw * enemyScale;
      const leftPad = Math.max(0, enemyCov.cx - enemyCov.sw / 2) * boxW;
      plate.style.marginRight = `${-Math.round(Math.min(leftPad, boxW * 0.34))}px`;
      if (enemyCov.cx > 0.05 && enemyCov.cx < 0.95) enemyCx = enemyCov.cx;
    }
    const enemyWrap = el('div', { class: 'enc-fighter enc-enemy' }, [plate, enemyBody]);
    const playerWrap = el('div', { class: 'enc-fighter enc-player' }, [playerBody]);
    // 横线：黑底 + 主题色（主题色跟着地图走，CSS 用 var(--accent)，见 body[data-biome]）
    const band = el('div', { class: 'enc-band' }, [el('i', { class: 'enc-band-core' })]);

    root = el('div', { class: 'encounter', dataset: { tier: enemy.tier ?? 'normal' } }, [
      band, enemyWrap, playerWrap,
    ]);
    document.body.append(root);

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
      const r = (enemyAnim ? enemyBody : enemyWrap).getBoundingClientRect();
      // 右端贴的是**画面**的中线（画布中线已经用 alignCanvas 对齐过了，
      // 横向则按 cx 修正 —— 帧左右也可能不对称）
      band.style.width = `${Math.max(0, Math.round(r.left + r.width * enemyCx))}px`;
      band.style.top = `${Math.round(r.top + r.height / 2 - LINE_H / 2)}px`;
    };
    band.style.height = `${LINE_H}px`;

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

    // ---- ② 横线张开，把屏幕盖满 ----
    // 起点就取横线此刻的实际值（而不是再算一遍），接着往下长
    const w0 = parseFloat(band.style.width) || 0;
    const top0 = parseFloat(band.style.top) || 0;
    await tween(t(PACE.bandFill), (p) => {
      const e = easeInOut(p);
      band.style.width = `${Math.round(lerp(w0, vw, e))}px`;
      band.style.height = `${Math.round(lerp(LINE_H, vh, e))}px`;
      band.style.top = `${Math.round(lerp(top0, 0, e))}px`;
    });
    audio.play('maximize', { volume: 0.5 });
    root.classList.add('is-full');
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
    await tween(t(PACE.slideOut), (p) => {
      const e = easeIn(p);
      playerWrap.style.transform = `translateY(-50%) translateX(${Math.round(-off * e)}px)`;
      enemyWrap.style.transform = `translateY(-50%) translateX(${Math.round(off * e)}px)`;
      // 幕布跟着敌人一起退场：从左边开始把战斗画面让出来
      band.style.transform = `translateX(${Math.round(vw * e)}px)`;
    });
    return true;
  } catch (err) {
    console.error('[oasis] 遭遇演出出错，直接进战斗：', err);
    return false;
  } finally {
    root?.remove();
    // 行走图的定时器是 createAnim 起的，元素从 DOM 上摘掉它还在跑，
    // 必须显式 destroy —— 否则每打一场就漏两个 setInterval。
    enemyAnim?.destroy?.();
    playerAnim?.destroy?.();
    encounterDebug._release = null;
    // 演出没走完（出错 / 被中断）也要保证战斗界面能挂上，别把玩家一个人留在黑屏上
    if (!abort()) cover();
  }
}
