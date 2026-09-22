// 战斗界面：把引擎吐出的事件流按顺序演出成动画。

import { el, clear, sleep, floatAt, toast } from './dom.js';
import { cardEl } from './cards.js';
import { setCardTextContext, resolveCardText } from './cardtext.js';
import { initTips } from './tips.js';
import { createAnim, createStill, animInfo, resolveAnim, DIR } from '../core/sprites.js';
import { createPortrait, setPortraitEmotion, emotionForEvent } from '../core/portraits.js';
import { turnArt as turnArtOf, fitArt, ART_FROM_SCALE } from '../core/gen9.js';
import { audio } from '../core/audio.js';
import { STATUS_INFO, ALL_STATUSES, BUFF_INFO, computeHit, effectiveAtk, effectiveDef } from '../core/battle.js';
import { CARD_BY_ID } from '../data/cards.js';
// 演出速度相关的选项/读取放在 balance.js 里，设置弹窗也直接用它
import { BIOMES, speedMulOf, loadBattleSpeed, apFromAgi, drawFromAgi, playsFromAgi, BALANCE } from '../data/balance.js';
import { TIERS, ENEMIES } from '../data/enemies.js';
// 主角记录（3.0）：战斗面板上「性别 物种 / 属性 · 特性」那一行按主角走
import { heroById } from '../data/heroes.js';
// 装饰字体（战斗背景花纹）之外，战斗界面还用到「远程招式的属性」这一组判断（见 animForCard）
import { battleDecor } from './battle-decor.js';

/**
 * 哪些属性的招算「远程」（挥手的姿势）——用于挑 Shoot 还是 Attack。
 * 一般 / 格斗 / 地面 / 岩石 / 钢 / 毒 / 虫 是近身（撞击、地震、落石…）。
 */
const RANGED_TYPES = new Set(['火', '水', '电', '冰', '超能', '草', '妖精', '幽灵', '恶', '龙', '飞行']);

/**
 * 近身招的**白名单**：属性判据（上面那张表）对「恶」「龙」这类系会判错 ——
 * 「咬住」是恶系但明显是上去咬一口，「龙爪」是龙系但也是近身 —— 所以这些常见的接触招
 * 单独点出来，优先判近身（用户要的是「远程攻击改成 shoot」，那就别把咬一口也当远程）。
 */
const MELEE_MOVES = new Set([
  'tackle', 'bite', 'double_kick', 'dragon_claw', 'dragon_rush', 'crunch', 'fire_fang', 'thunder_fang',
  'ice_fang', 'thunder_punch', 'fire_punch', 'ice_punch', 'close_combat', 'superpower', 'body_press',
  'iron_head', 'cross_chop', 'bug_bite', 'x_scissor', 'knock_off', 'u_turn', 'lunge', 'mach_punch',
  'wing_attack', 'aerial_ace', 'bite_off', 'dragon_tail', 'steel_wing', 'headbutt', 'stomp',
]);
import { t } from '../core/i18n.js';
// 属性短标签 / 悬停说明放在纯数据模块里（待翻清单靠扫源码收，见那个文件的说明）。
// 读取处照旧 t(STAT_SHORT.…)、t(STAT_TIP[label], { … })。
import { STAT_SHORT, STAT_TIP, STAT_TIP_FOE } from '../core/ui-words.js';

/**
 * 状态胶囊的图标。以前胶囊上只有一个纯色小圆点，「中毒/灼伤/虚弱/流血」全靠读文字区分；
 * 现在换成各自的图标（颜色仍然用 STATUS_INFO 的主题色，mask + currentColor 染色）。
 */
const STATUS_ICO = {
  poison: 'ico-poison',
  toxic: 'ico-skull',
  burn: 'ico-flame',
  weak: 'ico-temperature_down',
  bleed: 'ico-heart_break_02',
};

/** 战斗面板属性行的图标：和顶部 HUD 的 chip 用同一套语义（剑/盾/鞋/三叶草） */
const STAT_ICO = { 攻: 'ico-sword', 防: 'ico-shield', 速: 'ico-shoe', 运: 'ico-clover' };

/**
 * 状态胶囊的固定顺序（直接沿用引擎那份状态表，不另抄一份）。
 * 顺序固定是为了「先挂毒、后挂灼伤」和反过来的情况看起来一样 ——
 * 以前每次刷新都是整排重建，顺序跟着引擎字段走，玩家看到的排布会跳。
 */
const CHIP_ORDER = ALL_STATUSES;

/**
 * 胶囊退场动画的时长（毫秒），必须和 style.css 里的 chipOut 一致。
 * 这里只是「动画放完把它真的摘掉」的定时器，去掉动画不影响功能 ——
 * 所以 CSS 那边如果改了时长，这里跟着改，别让节点在消失之后还占着位置。
 */
const CHIP_OUT_MS = 320;
/** Δ 角标的存活时间（比动画长一点，飘完再摘） */
const CHIP_DELTA_MS = 760;

/**
 * 重播一个 CSS 动画。
 *
 * 动画挂在类名上，同名的类再 add 一次浏览器不会当回事（状态没变），
 * 所以要先摘掉、强制重排、再挂回去 —— 连续两次「中毒 +1」才都能弹。
 * cls 传空串就是「只摘不挂」（护盾涨的那一下用 CSS 自带的入场动画）。
 */
function restartAnim(node, cls) {
  if (!node) return;
  node.classList.remove('enter', 'tick-up', 'tick-down', 'val-up', 'val-down');
  void node.offsetWidth;
  if (cls) node.classList.add(cls);
}

/**
 * 战斗演出的节奏表（毫秒）。想整体调快调慢就乘以用户的倍率，
 * 不要再去每个分支里手改数字——之前就是为了「看着不拖沓」把数字砍了一半，
 * 结果快到看不清对手出了什么牌。
 */
const PACE = {
  battleStart: 340,
  turnStart: 280,
  /**
   * 回合切换的光带横扫（和 turnStart 一起构成过场；够慢才看得清回合数，
   * 而且它现在**不挡操作**，所以停留时间从 1250 拉长到了 2600）。
   */
  turnSweep: 2600,
  /**
   * 回合立绘：由大变小落到回合数旁边。
   * turnArtLead 是「光带停稳之后隔多久放立绘」（按 sweep 时长的比例），
   * 取 .22 是为了让「数字先落定 → 立绘再收拢进来」读起来有先后。
   */
  turnArtLead: 0.22,
  turnArtIn: 620,
  turnArtHold: 620,
  turnArtOut: 300,
  turnEnd: 200,
  draw: 140,
  reshuffle: 190,
  /** 对手出牌后卡面停留时间：这是「看清对手用了什么牌」的关键，别调太短 */
  cardHold: 620,
  /** 自己出牌不用看那么久，手感要跟手 */
  cardHoldSelf: 300,
  cardGap: 130,
  attack: 260,
  damage: 340,
  crit: 520,
  trueDamage: 320,
  shield: 320,
  heal: 320,
  status: 300,
  /** 净化 / 引爆：先让要消失的状态胶囊亮一下白光，再让它们化掉（PACE.purge 是那一下白光） */
  purge: 150,
  cleanse: 240,
  detonate: 260,
  buff: 300,
  dodge: 400,
  resist: 260,
  discard: 110,
  /** 销毁：碎片飞散完再收场（比 discard 长，不然看不清「这张牌没了」） */
  exhaust: 520,
  gainAp: 180,
  battleEnd: 800,
  settle: 380,
};

/** 演出倍率：1 = 标准速度，越大越慢。设置面板里可调。 */

/**
 * 手牌卡面的自然尺寸（和 style.css 的 :root `--card-w/--card-h` 一致）。
 * 出牌展示区按可用空间算尺寸时要用它：宽高比决定形状，宽度决定 `--u`（内部等比缩放）。
 * 改动这两个数记得同步 style.css。
 */
const NAT_CARD_W = 186;
const NAT_CARD_H = 190;
/** 卡面的宽高比（宽 ÷ 高），出牌展示区按它换算尺寸 */
const CARD_ASPECT = NAT_CARD_W / NAT_CARD_H;


export class BattleScreen {
  constructor(game, host) {
    this.game = game;
    this.host = host;
    this.battle = game.battle;
    this.busy = false;
    this.selected = null;
    this.enemyAnim = null;
    this.playerAnim = null;
    this.enemyScale = 3;
    /**
     * 演出用的血量/护盾副本。
     *
     * 引擎的 endTurn() 是一次性把整个敌方回合算完、把事件排进队列的，
     * 所以 battle.player.hp 在演出刚开始时就已经是「回合结束」的数值了。
     * 界面如果直接读引擎数值，血条就会在第一个事件时就跳到最终值——
     * 看起来就是「回合一开始血就扣完了」。这里让界面自己按事件推进血量。
     */
    this.dispHp = {};
    this.dispShield = {};
    this.speedMul = speedMulOf(loadBattleSpeed());
    /** 演出用的属性/状态快照，见 captureDisp */
    this.disp = { player: null, enemy: null };
    /** 演出用的回合数 / 当前行动方：引擎的 active 会提前跳回玩家，直接读会让「敌方回合」显示成「你的行动」 */
    this.dispTurn = this.battle.turn;
    this.dispActive = this.battle.active;
    /**
     * 界面是否已经挂到 DOM 上。
     * 进战斗前会先放一段遭遇演出（src/ui/encounter.js），那期间 BattleScreen 已经建好
     * 但还没 mount()：此时玩家按空格 / 数字键不该作用在一张还没上场的界面上。
     */
    this.mounted = false;
    this.captureDisp('player');
    this.captureDisp('enemy');
  }

  /**
   * 演出看门狗：**保证界面永远不会被「卡住」**。
   *
   * 起因（玩家反馈）：「打不出卡」这个问题非常随机，而且卡住的时候手牌是全灰的、
   * 点上去一点反应都没有。回想一下界面为什么会锁死 —— 出牌/结束回合期间 `busy` 会置位，
   * 手牌这时整批渲染成 disabled；只要那次演出的 `await` 链因为任何原因没走完
   * （某个动画的 promise 不 resolve、某处抛异常、切后台被浏览器冻结……），
   * `busy` 就永远是 true，手牌永远是灰的，而灰卡片的点击是被吞掉的（连提示都没有）。
   *
   * 这里的做法不是去猜是哪一次 await 挂了，而是：
   *   ① 每处理一个事件就记一次时间戳；
   *   ② 只要「busy 且已经 6 秒没有任何事件推进」，就强制收尾 + 重刷界面；
   *   ③ 顺便在控制台留下一行现场信息，方便下次复现时定位。
   * 6 秒是留足余量：一次出牌演出（含慢速档）最长也就 3~4 秒，
   * 敌人整回合是连续事件、时间戳会一直刷新，所以不会被误判。
   */
  startWatchdog() {
    if (this._watchdog) return;
    this._eventAt = Date.now();
    this._watchdog = setInterval(() => {
      /**
       * ① **战斗已经结束、却还挂在战场上**（用户报的「打完 boss 卡在战场上」）。
       *
       * 正常路径是出牌 / 结束回合的尾巴上 `if (battle.over) settle()`。只要那一步因为
       * 任何原因没跑到（演出被打断、某处抛异常、看门狗中途清过 busy…），玩家就会永远
       * 停在这一屏：敌人 0 血、意图胶囊写着「战斗结束」，手牌点击全被引擎拒绝
       * （`playCard` 会说「战斗已经结束了」），「结束回合」也早退 —— 无路可走。
       *
       * 所以这里当作**兜底**：只要战斗结束、演出已经停下（`!busy`）、又还没结算过，
       * 就自己补一次结算。`settle()` 自己的 settled 标志保证不会重复。
       */
      if (this.battle?.over && !this.settled && !this.busy && this.mounted) {
        console.warn('[oasis] 战斗已结束但还没结算 —— 看门狗补一次结算。');
        window.__oasisSettleRecover = (window.__oasisSettleRecover ?? 0) + 1;
        this.settle();
        return;
      }
      if (!this.busy) { this._eventAt = Date.now(); return; }
      const stalled = Date.now() - (this._eventAt ?? Date.now());
      if (stalled < 6000) return;
      console.warn(`[oasis] 演出卡住 ${(stalled / 1000).toFixed(1)} 秒，强制恢复界面（busy=${this.busy}）`);
      window.__oasisStuckCount = (window.__oasisStuckCount ?? 0) + 1;
      this.busy = false;
      this.forceRecover();
    }, 500);
  }

  /**
   * 强制把界面拉回「可以继续玩」的状态。
   * 每一步都单独 try：这是兜底路径，不能因为某一步又抛异常而前功尽弃。
   */
  forceRecover() {
    try { clear(this.playerPlay); } catch (err) { console.error(err); }
    try { clear(this.enemyPlay); } catch (err) { console.error(err); }
    try { this.resyncDisp(); } catch (err) { console.error(err); }
    try { this.refreshAll(); } catch (err) { console.error(err); }
    try { this.renderHand(); } catch (err) { console.error(err); }
    toast(t('演出卡了一下，已经自动恢复。'), 'bad');
  }

  /**
   * 「这张牌为什么打不出去」——点灰卡片时给一句话，而不是默默吞掉点击。
   * 以前灰卡片的点击是直接 return 的，玩家看到的就是「点了没反应、出不了牌」。
   */
  cantPlayReason(entry) {
    const b = this.battle;
    const cost = b.cardCost(entry);
    if (b.over) return t('战斗已经结束了。');
    if (this.busy || b.active !== 'player') return t('对手正在行动，稍等一下。');
    if ((b.player.playsLeft ?? 0) <= 0) return t('本回合出牌次数用完了（{n} 张）——按「结束回合」进入下一回合。', { n: b.player.playMax });
    if (cost > b.player.ap) return t('AP 不够：这张「{card}」要 {cost} 点，你现在还有 {ap} 点。', { card: entry.card.name, cost, ap: b.player.ap });
    return t('现在打不出这张牌。');
  }

  /** 把一侧的当前数值抄成「界面自己的副本」，动画期间只用这份副本 */
  captureDisp(key) {
    const s = this.battle[key];
    this.disp[key] = {
      hp: s.hp, maxHp: s.maxHp, shield: s.shield,
      ap: s.ap, apMax: s.apMax, playsLeft: s.playsLeft ?? 0, playMax: s.playMax ?? 0,
      atkMod: s.atkMod ?? 0, defMod: s.defMod ?? 0, agiMod: s.agiMod ?? 0, luckMod: s.luckMod ?? 0,
      poison: s.poison ?? 0, toxic: s.toxic ?? 0, burn: s.burn ?? 0, weak: s.weak ?? 0, bleed: s.bleed ?? 0,
    };
    this.dispHp[key] = s.hp;
    this.dispShield[key] = s.shield;
  }

  /**
   * 按事件推进「界面副本」。
   * 引擎是整回合一次算完的，所以界面不能读引擎的实时数值，
   * 只能靠事件一条一条把副本推到当前该显示的样子；最后再对齐回引擎真值。
   */
  applyEventToDisp(ev) {
    if (ev.type === 'battleStart') {
      for (const key of ['player', 'enemy']) {
        const snap = ev[key];
        if (!snap) continue;
        this.captureDisp(key);
        this.disp[key].hp = snap.hp;
        this.disp[key].shield = snap.shield;
      }
      return;
    }
    const d = ev.side ? this.disp[ev.side] : null;
    if (!d) return;
    switch (ev.type) {
      case 'turnStart':
        if (ev.ap != null) d.ap = ev.ap;
        d.shield = 0;                 // 引擎在自身回合开始时清空护盾
        d.playsLeft = d.playMax;
        this.dispActive = ev.side;
        if (ev.turn != null) this.dispTurn = ev.turn;
        break;
      case 'playCard':
        d.ap = Math.max(0, d.ap - (ev.cost ?? 0));
        d.playsLeft = Math.max(0, d.playsLeft - 1);
        break;
      case 'gainAp':
        if (ev.ap != null) d.ap = ev.ap;
        break;
      case 'damage':
      case 'trueDamage':
      case 'heal':
        if (ev.hp != null) d.hp = ev.hp;
        if (ev.shield != null) d.shield = ev.shield;
        break;
      case 'shield':
        if (ev.total != null) d.shield = ev.total;
        break;
      case 'buff':
        if (ev.stat === 'atk') d.atkMod += ev.amount;
        else if (ev.stat === 'def') d.defMod += ev.amount;
        else if (ev.stat === 'agi') d.agiMod += ev.amount;
        else if (ev.stat === 'luck') d.luckMod += ev.amount;
        break;
      case 'status':
        if (ev.status) d[ev.status] = ev.value;
        break;
      /**
       * 层数翻倍：一次把好几种状态的层数改掉，所以事件带的是 `values`（状态 → 新层数）。
       * 和上面那两条同一个坑：视图里没有这一支的话，引擎已经翻倍、界面还挂着旧层数，
       * 胶囊上的数字会当场说谎，直到回合收尾才补上。
       */
      case 'statusDouble':
        for (const [st, v] of Object.entries(ev.values ?? {})) d[st] = v;
        break;
      /**
       * 转嫁：自己那侧的层数清零、对手那侧加上去 —— 一条事件同时改两边。
       * 这里只处理**自己**这一侧的副本（`side` 是发动者）；对手那侧的副本由它自己的事件分支
       * 在 `status` 上更新不到，所以引擎把两边的最终值都放在 `values` 里，这里一并同步。
       */
      case 'statusSteal': {
        for (const st of ev.statuses ?? []) d[st] = 0;
        const other = this.disp?.[ev.side === 'player' ? 'enemy' : 'player'];
        if (other) for (const [st, v] of Object.entries(ev.values ?? {})) other[st] = v;
        break;
      }
      /**
       * 净化 / 引爆会一次性把好几个状态清成 0。
       *
       * 这两条事件以前**根本没有进这个副本**（switch 里没有对应的 case），
       * 于是引擎已经把毒清干净了，界面副本还留着层数 ——
       * 胶囊会一直挂到回合收尾的 resyncDisp 才掉，中间整段演出都在说假话。
       */
      case 'cleanse':
        for (const st of ev.statuses ?? []) d[st] = 0;
        if (ev.mods) { d.atkMod = ev.mods.atk; d.defMod = ev.mods.def; d.agiMod = ev.mods.agi; }
        break;
      case 'detonate':
        for (const st of ev.statuses ?? []) d[st] = 0;
        break;
      default:
        break;
    }
    this.dispHp[ev.side] = d.hp;
    this.dispShield[ev.side] = d.shield;
  }

  /** 演出结束后把副本对齐回引擎真值（防止有事件没覆盖到的字段残留） */
  resyncDisp() {
    this.captureDisp('player');
    this.captureDisp('enemy');
    this.dispTurn = this.battle.turn;
    this.dispActive = this.battle.active;
  }

  /** 按用户设置的倍率等待 */
  wait(ms) {
    return sleep(Math.max(16, Math.round(ms * this.speedMul)));
  }

  async mount() {
    const b = this.battle;
    const biome = BIOMES[this.game.data.map.biome] ?? BIOMES.desert;
    clear(this.host);
    this.mounted = true;

    this.screen = el('div', {
      class: 'screen battle-screen',
      style: {
        '--sky-1': biome.sky[0], '--sky-2': biome.sky[1], '--sky-3': biome.sky[2],
        '--ground': biome.ground, '--accent': biome.accent,
      },
    });

    // ---- 对手 ----
    this.enemyHpFill = el('i', { style: { width: '100%' } });
    this.enemyHpText = el('b', { text: `${b.enemy.hp} / ${b.enemy.maxHp}` });
    this.enemyShield = el('div', { class: 'fighter-shield hidden' });
    this.enemyStatuses = el('div', { class: 'fighter-statuses' });
    this.enemyStats = el('div', { class: 'stat-chips' });

    // 头像框（PMD portrait），让角色卡有「人样」
    this.enemyFace = el('div', { class: 'fighter-face' });
    this.playerFace = el('div', { class: 'fighter-face' });

    /**
     * 首领称号：写在**名字底下那一行**、小字号、**总宽与名字相等**（用户要求）。
     *
     * 之前它跟在名字后面（一行里挤着名字 + 档位角标 + 称号），窄屏上会被省略号切掉；
     * 现在单独一行，拆成单字 + `space-between` 撑到与名字等宽 —— 和遭遇演出里那一行同一套做法。
     * 名字宽度要**现量**（字号是固定值，但中文字体与档位角标都会占宽），
     * 所以在 mount() 与窗口尺寸变化时各量一次（见 fitBossTitle）。
     */
    this.enemyNameEl = el('span', { class: 'fighter-name-text', text: b.enemy.name });
    this.bossTitleRow = b.enemy.bossTitle
      ? el('div', { class: 'boss-title-row' }, [
          el('div', { class: 'boss-title' }, [...b.enemy.bossTitle].map((ch) => el('span', { text: ch }))),
        ])
      : null;

    this.enemyCard = el('div', { class: 'fighter-card' }, [
      el('div', { class: 'fighter-head' }, [
        this.enemyFace,
        el('div', { class: 'fighter-info' }, [
          el('div', { class: 'fighter-name' }, [
            this.enemyNameEl,
            el('span', { class: `tier tier-${b.enemy.tier}`, text: TIERS[b.enemy.tier]?.name ?? '' }),
          ].filter(Boolean)),
          this.bossTitleRow,
          el('div', { class: 'fighter-types', text: this.enemySubtitle() }),
        ]),
      ]),
      this.enemyShield,
      el('div', { class: 'bar bar-hp enemy' }, [this.enemyHpFill, this.enemyHpText]),
      this.enemyStats,
      this.enemyStatuses,
    ]);

    this.enemyBody = el('div', { class: 'fighter-body' });
    // 敌方「打出来的牌」展示区：对手每用一张牌就在这里把卡面摊开
    this.enemyPlay = el('div', { class: 'play-zone enemy-play' });
    this.enemyFighter = el('div', { class: 'fighter fighter-enemy' }, [this.enemyCard, this.enemyBody, this.enemyPlay]);

    /** 这一局的主角（性别 / 物种 / 属性 / 特性那一行靠它） */
    const hero = heroById(this.game.data.hero) ?? {};

    // ---- 我方 ----
    this.playerHpFill = el('i', { style: { width: '100%' } });
    this.playerHpText = el('b', { text: `${b.player.hp} / ${b.player.maxHp}` });
    this.playerShield = el('div', { class: 'fighter-shield hidden' });
    this.playerStatuses = el('div', { class: 'fighter-statuses' });
    this.playerStats = el('div', { class: 'stat-chips' });

    this.playerCard = el('div', { class: 'fighter-card' }, [
      el('div', { class: 'fighter-head' }, [
        this.playerFace,
        el('div', { class: 'fighter-info' }, [
          el('div', { class: 'fighter-name' }, [
            el('span', { text: this.game.data.name }),
            /**
             * 「性别 + 物种」那一小行**跟着主角走**（3.0 有两位主角）。
             * 以前写死成「♀ 沙漠蜻蜓 / 地面 / 龙 · 特性：飘浮」——
             * 换成阿特拉斯（♂ 暴飞龙 · 龙/飞行 · 威吓）之后，战斗面板上那一行会公然写错。
             * 数据取自 content/heroes.json（经 src/data/heroes.js）。
             */
            el('span', { class: 'tier', text: `${hero.gender ?? ''} ${hero.speciesName ?? ''}`.trim() }),
          ]),
          el('div', { class: 'fighter-types', text: `${(hero.types ?? []).join(' / ')} · ${t('特性：{ability}', { ability: hero.ability ?? '' })}` }),
        ]),
      ]),
      this.playerShield,
      el('div', { class: 'bar bar-hp' }, [this.playerHpFill, this.playerHpText]),
      this.playerStats,
      this.playerStatuses,
    ]);
    this.playerBody = el('div', { class: 'fighter-body' });
    this.playerPlay = el('div', { class: 'play-zone player-play' });
    this.playerFighter = el('div', { class: 'fighter fighter-player' }, [this.playerBody, this.playerCard, this.playerPlay]);

    // ---- 中间：回合 / 敌方意图 ----
    // 回合徽章用时钟（骰子是「随机」，跟回合没关系）
    this.turnBadgeText = el('span', { text: t('第 1 回合') });
    this.turnBadge = el('div', { class: 'turn-badge' }, [el('span', { class: 'ico-clock' }), this.turnBadgeText]);
    this.intentEl = el('div', { class: 'intent' }, [el('span', { class: 'ico-sword' }), el('span', { text: t('正在观察……') })]);

    // ---- 战斗日志 + 弃牌区 ----
    this.logEl = el('div', { class: 'battle-log' });
    /**
     * 弃牌区（3.1，用户提的）：「右方日志可以往上挪，腾出下方空间用于放置玩家打过的牌，
     * 这样就可以看到弃牌区有哪些牌了」。
     * 以前底栏只知道弃牌的**张数**（「弃牌 3」），打出去的是什么牌、还剩哪些资源，全靠记性。
     */
    this.discardEl = el('div', { class: 'discard-zone' });
    this.sidePanel = el('div', { class: 'battle-side' }, [this.logEl, this.discardEl]);

    // ---- 底部：AP / 手牌 ----
    this.apOrbs = el('div', { class: 'ap-orbs' });
    // AP 的图标就是注册表里的 action_points（纯文本「AP」），所以文字里不再重复写一遍
    this.apIco = el('span', { class: 'ap-ico ico-action_points' });
    this.apText = el('div', { class: 'ap-text', text: '3 / 3' });
    this.pileInfo = el('div', { class: 'pile-info' });
    /**
     * 每回合的「预算」：敏捷到底给了什么，直接摊在界面上。
     * 以前只有悬停提示里的一句话，玩家只知道敏捷涨 AP，
     * 不知道抽牌数和出牌上限也是它管的（反馈：「UI 没显示敏捷的影响」）。
     */
    this.budgetEl = el('div', { class: 'budget-chips' });
    this.handEl = el('div', { class: 'hand' });
    this.endTurnBtn = el('button', {
      class: 'btn btn-primary btn-lg',
      onClick: () => this.onEndTurn(),
    }, [el('span', { class: 'ico-check' }), el('span', { text: t('结束回合') })]);

    this.battleBar = el('div', { class: 'battle-bar' }, [
      el('div', { class: 'ap-display' }, [this.apOrbs, this.apIco, this.apText]),
      this.budgetEl,
      this.pileInfo,
      this.endTurnBtn,
    ]);

    this.battleBottom = el('div', { class: 'battle-bottom' }, [this.battleBar, this.handEl]);

    this.weather = el('div', { class: 'weather' });    for (let i = 0; i < 40; i++) {
      const p = Math.random();
      this.weather.append(el('i', {
        style: {
          left: `${Math.random() * 100}%`,
          top: `${Math.random() * 100}%`,
          animationDuration: `${2.2 + p * 3}s`,
          animationDelay: `${-p * 4}s`,
          opacity: String(0.2 + p * 0.6),
        },
      }));
    }

    /**
     * 背景花纹的文字：敌人那一半用**这一场敌人物种**的图鉴介绍（52wiki 抓的），
     * 主角那一半用**主角物种**的 —— 见 ui/battle-decor.js 的说明。
     *
     * 这里按 slug 查表，而不是让引擎把那条文本带进战斗对象：
     * 装饰是界面的事，引擎不需要知道背景上铺了什么字。
     * 兜底：万一某个物种缺文本（理论上体检已经拦住了），就用另一边的，别留一块空白。
     */
    const decorEnemy = ENEMIES.find((e) => e.slug === b.enemy?.slug)?.dexText ?? '';
    const decorHero = hero?.dexText ?? '';
    this.decor = battleDecor({
      enemyText: decorEnemy,
      playerText: decorHero,
      fallback: decorEnemy || decorHero,
    });

    this.field = el('div', { class: 'battle-field' }, [
      /**
       * 背景那层波浪花纹文字（3.0.5）。放在**最前面** = 垫在最底下：
       * 天气粒子、两边角色、日志都盖在它上面（z-index 不需要，DOM 顺序就是层叠顺序，
       * 而且它 pointer-events: none，不会挡任何点击）。
       * 上半片是敌人那个物种的图鉴介绍、下半片是主角的 —— 谁的回合谁那半片亮一点。
       */
      this.decor,
      this.weather,
      this.enemyFighter,
      el('div', { class: 'battle-middle' }, [this.turnBadge, this.intentEl]),
      this.playerFighter,
      this.sidePanel,
    ]);

    this.screen.append(this.field, this.battleBottom);
    this.host.append(this.screen);

    /**
     * 截图 / 诊断用：`?decor=player|enemy` 把某一侧的高亮**钉住**。
     *
     * 为什么需要它：这个高亮是「那一侧行动时亮起、停手后淡回去」的瞬时状态，
     * 而截图（Edge 的 --virtual-time-budget）会把定时器一路快进到结束 ——
     * 于是永远截不到「亮着」的那一帧，也就没法核对「到底亮了多少」。
     * 钉住之后才能拿两张图逐区域比亮度（tools/measure-decor-glow.py）。
     */
    const pin = new URLSearchParams(location.search).get('decor');
    if (pin === 'player' || pin === 'enemy') {
      this.decorPin = pin;
      this.screen.dataset.acting = pin;
      /**
       * 钉住的同时把过渡关掉：截图跑在虚拟时间下，**CSS 过渡不会推进**，
       * 于是「刚点亮」的那一刻被冻在 opacity 0 上，截出来的图看起来像没生效。
       * 关掉过渡之后读到的就是那条规则真正的目标值（1），截图也才是「亮着」的样子。
       */
      for (const n of this.screen.querySelectorAll('.decor-glow')) n.style.transition = 'none';
    }

    // 先量一次场地（精灵缩放与出牌区位置都靠它），窗口变化时再量
    this.layoutBattle();
    // 首领称号那一行的宽度要跟名字对齐，也得现量（字体 / 档位角标都会占宽）
    this.fitBossTitle();
    this.onResize = () => {
      clearTimeout(this._resizeTimer);
      this._resizeTimer = setTimeout(() => {
        this.layoutBattle();
        this.fitBossTitle();
        // 手牌叠放量跟可用宽度有关，窗口一变就得重算
        this.fitHand(this.battle.hand('player').length);
      }, 120);
    };
    window.addEventListener('resize', this.onResize);
    this.startWatchdog();
    /**
     * 光监听窗口还不够：行走图换动作（Idle↔Attack 帧宽不同）、状态图标换行、
     * 日志长高都会改变可用空间，而窗口尺寸没变。所以直接盯住这几个盒子的尺寸变化。
     */
    if (typeof ResizeObserver !== 'undefined') {
      this._ro = new ResizeObserver(() => this.onResize());
      for (const node of [this.enemyFighter, this.playerFighter, this.logEl]) {
        if (node) this._ro.observe(node);
      }
    }

    // ---- 精灵 ----
    await this.loadSprites();
    /**
     * 背景花纹那张位图**等装饰字体就绪之后再补画一次**。
     *
     * 位图是 canvas 画出来的一次性快照：字体还没加载完就画，画进去的是兜底字体的字形，
     * 而且不会自己变。所以这里显式等一下这个字体（`document.fonts.load` 只等这一个，
     * 比 `fonts.ready` 快，不会把进战斗的时间拖长），再 force 重画一次。
     */
    try {
      await document.fonts?.load?.('20px "Oasis Decor"');
    } catch { /* 字体加载失败就退回首次画的那张 */ }
    this.decor?.relayoutDecor?.(this.fieldR?.width ?? 0, this.fieldR?.height ?? 0, true);
    // 场地尺寸一变（手牌、日志、状态图标都会改它的高度）就得重画那张位图：
    // 位图是按当时的高度画的，贴的时候又按像素高度贴 —— 不重画就会被拉伸变形
    if (typeof ResizeObserver !== 'undefined' && this.decor) {
      this._decorRo?.disconnect?.();
      this._decorRo = new ResizeObserver(() => this.decor?.syncDecor?.());
      this._decorRo.observe(this.decor);
    }
    // 进战斗时把可能残留的文本选区清掉：
    // 在上一屏（地图 / 卡组）拖鼠标留下的选区会一直画在那儿，看起来像一块蓝色色块
    // （用户就是这么被吓到的：以为是伤害数字背后的「蓝底」）。
    // CSS 那边已经整页 user-select: none，这里只是兜掉「切屏前就已经选中的」情况。
    window.getSelection?.()?.removeAllRanges?.();
    this.refreshAll();
    this.renderHand();
    this.layoutBattle();
    await sleep(160);
    await this.playEvents(this.battle.takeEvents());
  }

  enemySubtitle() {
    const def = this.game.battleContext?.enemyDef;
    if (!def) return '';
    const dex = `No.${def.dex}`;
    return `${dex} · ${def.types.join(' / ')}`;
  }

  /**
   * 按「这一行实际有多少高度」算精灵缩放。
   *
   * 以前所有地方的缩放都是写死的（玩家 3、敌人 2.2~2.7），再靠 CSS 的 `max-height: 38vh` 兜底。
   * 38vh 是相对**视口**的，和战斗场地真正剩多少高度没关系 —— 窗口一矮，
   * 行走图就会顶出行外、被上方 HUD 压住。现在缩放完全由行高推出来，多大的窗口都能塞进去。
   */
  fitScale(slug, anim, rowH, base) {
    const info = animInfo(slug, anim) ?? animInfo(slug, 'Idle');
    if (!info) return base;
    const maxH = Math.max(56, (rowH ?? 320) - 18);   // 上下各留一点空隙
    return Math.max(0.7, Math.min(base, maxH / info.fh));
  }

  /**
   * 首领称号那一行：把总宽撑到与名字相等（用户要求）。
   *
   * 拆成单字 + `space-between` 撑开，首字左边缘与末字右边缘正好贴住名字的两端 ——
   * 比算 `letter-spacing` 稳（不用扣掉「最后一个字后面那份间距」）。
   * 称号比名字还长时不硬撑，退回自然宽度居中。
   */
  fitBossTitle() {
    const titleEl = this.bossTitleRow?.querySelector('.boss-title');
    if (!titleEl || !this.enemyNameEl) return;
    titleEl.style.width = '';
    const nameW = this.enemyNameEl.offsetWidth;
    const titleW = titleEl.offsetWidth;
    if (!nameW || !titleW) return;
    if (titleW <= nameW) {
      titleEl.style.width = `${nameW}px`;
      titleEl.classList.remove('centered');
    } else {
      titleEl.classList.add('centered');
    }
  }

  /** 布局自适应：测量场地 → 定精灵缩放 → 摆出牌展示区。窗口变化时会重新跑一遍。 */
  layoutBattle() {
    if (this.destroyed || !this.field) return;
    const fieldR = this.field.getBoundingClientRect();
    if (fieldR.height < 40) return;
    this.fieldR = fieldR;
    this.rowR = {
      enemy: this.enemyFighter.getBoundingClientRect(),
      player: this.playerFighter.getBoundingClientRect(),
    };
    this.field.style.setProperty('--row-enemy-h', `${Math.round(this.rowR.enemy.height)}px`);
    this.field.style.setProperty('--row-player-h', `${Math.round(this.rowR.player.height)}px`);

    // ① 精灵：按行高重新定尺寸（内部分辨率不变，只改 CSS 显示尺寸，所以不会糊）
    for (const side of ['player', 'enemy']) {
      const slug = side === 'player' ? this.game.data.slug : this.battle.enemy.slug;
      const base = side === 'player' ? this.playerBaseScale : this.enemyBaseScale;
      const name = side === 'player' ? this.playerAnimName : this.enemyAnimName;
      const canvas = side === 'player' ? this.playerAnim : this.enemyAnim;
      this.applyAnimScale(canvas, slug, name ?? 'Idle', this.rowR[side].height, base);
      if (side === 'player') this.playerScale = this.fitScale(slug, name ?? 'Idle', this.rowR[side].height, base);
      else this.enemyScale = this.fitScale(slug, name ?? 'Idle', this.rowR[side].height, base);
    }

    // ② 行太矮时把角色卡压缩：否则信息卡会溢出到自己这一行外面，和邻行/出牌卡撞在一起
    for (const side of ['enemy', 'player']) {
      const fighter = side === 'enemy' ? this.enemyFighter : this.playerFighter;
      fighter.classList.toggle('compact', this.rowR[side].height < 128);
    }
    // ③ 出牌展示区
    for (const side of ['enemy', 'player']) this.layoutPlayZone(side);
    // ④ 背景花纹：按精灵位置钉住高亮中心，并把位图和场地尺寸对一次账
    this.layoutDecorGlow(fieldR);
    this.decor?.syncDecor?.();
  }

  /**
   * 背景花纹的高亮中心（3.0.6）。
   *
   * 为什么不能在 CSS 里写死百分比：花纹那一层要跟着战场盒子缩放，而「画布的 20%」
   * 和「战场上敌方精灵的位置」根本不是一回事。第一版写死了 74%/20% 与 26%/80%，
   * 实测两边亮度差了一倍多（敌人那侧 +4.3%、玩家那侧只有 +1.6%）。
   * 现在拿两只精灵的实际中心换算成**相对战场盒子的百分比**，写进 --glow-* 给 CSS 的 mask 用 ——
   * 窗口怎么变、行高怎么变，亮的那一块都跟着精灵走。
   */
  layoutDecorGlow(fieldR = this.fieldR) {
    if (!this.decor || !fieldR?.width) return;
    const bands = this.decor.decorBands ?? {};
    const box = {
      enemy: this.enemyBody ?? this.enemyFighter,
      player: this.playerBody ?? this.playerFighter,
    };
    for (const [side, node] of Object.entries(box)) {
      const r = node?.getBoundingClientRect?.();
      if (!r?.width) continue;
      /**
       * 横向跟着精灵走（亮的是它那一片），**纵向用那条行带的中心**。
       * 用精灵自己的纵向位置踩过坑：我方精灵贴在场地最左边偏下，圈有一半落在场地外、
       * 剩下的大半被角色信息卡盖住 —— 实测我方那侧只亮了 +3.6%、对手 +12.8%，
       * 玩家立刻就看出来「我方不会点亮」。行带中心才是「它那半片文字」的正中央。
       */
      const band = bands[side];
      const y = band ? ((band[0] + band[1]) / 2) * 100
        : ((r.top + r.height / 2) - fieldR.top) / fieldR.height * 100;
      const x = ((r.left + r.width / 2) - fieldR.left) / fieldR.width * 100;
      // 夹一下：精灵本来就贴着边（我方在最左），圈心贴边会有一小半落到场地外，
      // 白亮一片看不见的区域；夹到 24~76 之后，圈基本都落在场地里
      this.decor.style.setProperty(`--glow-${side}-x`, `${Math.max(24, Math.min(76, x)).toFixed(1)}%`);
      this.decor.style.setProperty(`--glow-${side}-y`, `${Math.max(6, Math.min(94, y)).toFixed(1)}%`);
    }
  }

  /**
   * 把已经建好的动画 canvas 按当前行高重新定尺寸。
   *
   * 关键：宽高必须用**这张 canvas 自己的帧信息**（`createAnim` 时挂在 canvas.frameInfo 上）来算。
   * Idle / Attack / Hurt 的帧尺寸并不一样（沙漠蜻蜓是 32×72 / 64×80 / 48×72），
   * 拿错一套就会把宽高比算歪 —— 表现出来就是行走图被压扁。
   */
  applyAnimScale(canvas, slug, anim, rowH, base) {
    if (!canvas) return;
    const info = canvas.frameInfo ?? animInfo(slug, anim) ?? animInfo(slug, 'Idle');
    if (!info) return;
    const maxH = Math.max(56, (rowH ?? 320) - 18);
    const s = Math.max(0.7, Math.min(base, maxH / info.fh));
    canvas.style.width = `${Math.round(info.fw * s)}px`;
    canvas.style.height = `${Math.round(info.fh * s)}px`;
  }

  /**
   * 自动摆放某一边的出牌展示区（不写死坐标）。
   *
   * 两种摆法，按「哪种能给出更大更清楚的卡面」来选：
   *   A 外侧空白：卡面贴着信息卡外侧那一块空位（大多数宽窗口的情况，看起来最自然）
   *   B 右栏日志上方：左栏被怪兽和角色卡占满时（窄窗口 / 行很矮），挪到右边日志上方
   * 卡面尺寸也跟着可用空间缩，永远不会压到精灵、角色卡、日志或顶栏。
   */
  layoutPlayZone(side) {
    const zone = side === 'enemy' ? this.enemyPlay : this.playerPlay;
    const fighter = side === 'enemy' ? this.enemyFighter : this.playerFighter;
    const info = side === 'enemy' ? this.enemyCard : this.playerCard;
    if (!zone || !fighter || !info) return;
    const row = fighter.getBoundingClientRect();
    const infoR = info.getBoundingClientRect();
    const fieldR = this.fieldR ?? this.field.getBoundingClientRect();
    const logR = this.logEl?.getBoundingClientRect();
    // 展示区里除了卡面还有一行「对手使用了」标签，算空间时要带上它（以前漏了，结果卡面总是往下多出 20 多像素）
    const LABEL_H = 26;

    // A：外侧空白（敌人信息卡靠右 → 外侧是左；我方靠左 → 外侧是右）
    const outerLeft = side === 'enemy';
    const space = outerLeft ? infoR.left - row.left - 10 : row.right - infoR.right - 10;
    // 卡面高度上限 = 行高 - 上下留白 - 标签高度；下限给到 64px（再小就没法看了，
    // 那时候 useB 会把它挪到右栏）。以前下限写 84，行只有 100px 高时卡片比行还高，就会顶到顶栏。
    const hA = Math.max(64, Math.min(176, row.height - 14 - LABEL_H));
    const wA = Math.max(0, Math.min(Math.round(hA * CARD_ASPECT), Math.round(space)));

    // B：右栏（日志上方）的空白。
    // 日志是贴底、高度随内容长的，所以这里按「它长到最大高度」来预留，
    // 否则卡面放好之后日志一长高就会压上来。
    const logStyles = this.logEl ? getComputedStyle(this.logEl) : null;
    const logMaxH = logStyles ? (parseFloat(logStyles.maxHeight) || 150) : 150;
    const logBottom = logR && logR.height ? logR.bottom : fieldR.bottom - 6;
    const logTopWorst = logBottom - Math.max(logR?.height ?? 0, logMaxH);
    const aboveLog = logTopWorst - fieldR.top - 16 - LABEL_H;
    const hB = Math.round(Math.max(0, Math.min(166, aboveLog)));
    const wB = Math.round(hB * CARD_ASPECT);

    /**
     * 选哪种摆法：**一律优先留在自己这一侧**（方案 A）。
     * 玩家的牌被甩到右上角会让人一眼找不到，所以玩家的门槛更严（外侧 < 72px 才挪）。
     * 敌人本来就在右上角，右栏对它来说也是"自己那半场"，所以允许更早挪过去（< 88px），
     * 免得在窄窗口里贴着信息卡上看不清。
     */
    const minSideW = side === 'enemy' ? 88 : 72;
    const fitsB = aboveLog >= 84 && wB >= 96;
    const useB = fitsB && wA < minSideW;

    // 调试：带 ?dgview=1 时打印这次摆放的决策依据（诊断脚本会读它）
    if (typeof location !== 'undefined' && /[?&]dgview=1/.test(location.search)) {
      console.log(`[d2] [layout] ${side} row=${Math.round(row.height)} space=${Math.round(space)} hA=${hA} wA=${wA} aboveLog=${Math.round(aboveLog)} wB=${wB} useB=${useB}`);
    }

    if (!useB) {
      // ---- 方案 A：自己这一侧（外侧空白） ----
      const w = Math.max(56, wA);
      const h = Math.round(w / CARD_ASPECT);
      zone.style.position = 'absolute';
      zone.style.transform = 'none';
      zone.style.top = `${Math.max(0, Math.round(row.height / 2 - (h + LABEL_H) / 2))}px`;
      if (outerLeft) { zone.style.left = '0px'; zone.style.right = 'auto'; }
      else { zone.style.right = '0px'; zone.style.left = 'auto'; }
      this.sizePlayCard(zone, w, h);
      return;
    }

    // ---- 方案 B：右栏日志上方 ----
    const h = Math.round(Math.max(84, Math.min(166, aboveLog)));
    const w = Math.round(h * CARD_ASPECT);
    const top = Math.round(Math.max(fieldR.top + 4, logTopWorst - 8 - (h + LABEL_H)));
    const left = Math.round(Math.max(fieldR.left + 8, fieldR.right - w - 14));
    zone.style.position = 'fixed';
    zone.style.transform = 'none';
    zone.style.top = `${top}px`;
    zone.style.left = `${left}px`;
    zone.style.right = 'auto';
    this.sizePlayCard(zone, w, h);
  }

  /**
   * 给出牌展示区的卡面定尺寸。
   *
   * 除了宽高，还要写一个 `--u`（卡面内部的等比缩放倍率）：
   * 卡面的内边距、字号、美术高度、底栏……在 CSS 里全都写成 `calc(原值 * var(--u))`，
   * 所以小卡面是标准卡面的**缩小版**，排版比例完全一致 —— 文案一定放得下。
   *
   * 以前只改 --card-w/--card-h，字和间距保持不变：卡一窄，能放下的行数就变少，
   * `-webkit-line-clamp` 直接把描述截掉，对手打出的牌只能看到半句
   * （用户报的：「敌人打出的牌还是有卡牌简介被截断的问题」，二连踢只剩「连续 2 次造成 7 点伤」）。
   */
  sizePlayCard(zone, w, h) {
    zone.style.setProperty('--card-w', `${w}px`);
    zone.style.setProperty('--card-h', `${h}px`);
    zone.style.setProperty('--u', (w / NAT_CARD_W).toFixed(4));
  }

  async loadSprites() {
    const b = this.battle;
    const tier = b.enemy.tier;
    this.enemyBaseScale = tier === 'boss' ? 2.7 : tier === 'elite' ? 2.4 : 2.2;
    this.playerBaseScale = 3;
    this.playerAnimName = 'Idle';
    this.enemyAnimName = 'Idle';
    const rowH = this.rowR ?? { enemy: 300, player: 220 };

    // 头像：先挂上，拿不到就算了（不影响战斗）
    createPortrait(b.enemy.slug, { emotion: 'normal', size: 40, alt: b.enemy.name }).then((img) => {
      if (img) { clear(this.enemyFace).append(img); }
    });
    createPortrait(this.game.data.slug, { emotion: 'determined', size: 40, alt: this.game.data.name }).then((img2) => {
      if (img2) { clear(this.playerFace).append(img2); }
    });

    try {
      // 对角站位：敌人在右上，所以让它朝左下（DOWN_LEFT）看向玩家。
      // 以前是纯侧面的 DIR.LEFT，和站位的对角线对不上，打起来像各打各的空气。
      const scale = this.fitScale(b.enemy.slug, 'Idle', rowH.enemy.height, this.enemyBaseScale);
      this.enemyScale = scale;
      this.enemyAnim = await createAnim(b.enemy.slug, { anim: 'Idle', scale, fps: 7, dir: DIR.DOWN_LEFT });
      this.enemyIdleAnim = this.enemyAnim;
      this.enemyBody.append(this.enemyAnim);
    } catch (err) {
      this.enemyBody.append(el('div', { class: 'card-art', style: { width: '96px', height: '96px' } }));
    }
    try {
      // 玩家在左下，朝右上（UP_RIGHT）看向敌人
      const scale = this.fitScale(this.game.data.slug, 'Idle', rowH.player.height, this.playerBaseScale);
      this.playerScale = scale;
      this.playerAnim = await createAnim(this.game.data.slug, { anim: 'Idle', scale, fps: 8, dir: DIR.UP_RIGHT });
      this.playerIdleAnim = this.playerAnim;
      this.playerBody.append(this.playerAnim);
    } catch (err) {
      /* 忽略 */
    }
    this.layoutBattle();
  }

  // ================= 状态刷新 =================

  /**
   * 把战斗中的血量同步回 run，并刷新顶部 HUD。
   * 之前 HUD 只在切屏时才重画，所以战斗里掉了血、顶部那条血条一直停在进战斗时的数值，
   * 看起来就像「掉血掉到死、血条完全没动过」。
   * 现在每次刷新战斗界面都会顺手把 HUD 对齐一次（只是赋值文本与宽度，开销可忽略）。
   */
  syncHud() {
    if (this.game.phase !== 'battle' || !this.battle) return;
    const d = this.game.data;
    const hp = Math.max(0, this.dispHp?.player ?? this.battle.player.hp);
    d.hp = hp;
    const pct = Math.max(0, (hp / d.maxHp) * 100);
    const fill = document.getElementById('hud-hp-fill');
    const text = document.getElementById('hud-hp-text');
    if (fill) {
      fill.style.width = `${pct}%`;
      fill.className = `hp-fill${pct <= 25 ? ' crit' : pct <= 55 ? ' warn' : ''}`;
    }
    if (text) text.textContent = `${hp} / ${d.maxHp}`;
  }

  /** 头像没挂上时补一张（拿不到就留空框，不影响战斗） */
  refreshFace() {
    const b = this.battle;
    if (this.enemyFace && !this.enemyFace.childElementCount) {
      createPortrait(b.enemy.slug, { emotion: 'normal', size: 40, alt: b.enemy.name }).then((img) => {
        if (img && this.enemyFace && !this.enemyFace.childElementCount) clear(this.enemyFace).append(img);
      });
    }
    if (this.playerFace && !this.playerFace.childElementCount) {
      createPortrait(this.game.data.slug, { emotion: 'determined', size: 40, alt: this.game.data.name }).then((img) => {
        if (img && this.playerFace && !this.playerFace.childElementCount) clear(this.playerFace).append(img);
      });
    }
  }

  refreshAll() {
    this.refreshSide('player');
    this.refreshSide('enemy');
    this.refreshTurn();
    this.refreshPiles();
    this.refreshIntent();
    this.refreshFace();
    this.syncHud();
    this.renderHand();
  }

  refreshSide(key) {
    const b = this.battle;
    const s = b[key];
    const isPlayer = key === 'player';
    const fill = isPlayer ? this.playerHpFill : this.enemyHpFill;
    const text = isPlayer ? this.playerHpText : this.enemyHpText;
    const shieldEl = isPlayer ? this.playerShield : this.enemyShield;
    const statusEl = isPlayer ? this.playerStatuses : this.enemyStatuses;
    const statsEl = isPlayer ? this.playerStats : this.enemyStats;
    if (!fill || !text || !shieldEl || !statusEl || !statsEl) {
      console.warn('[battle] refreshSide 缺元素', key, { fill: !!fill, text: !!text, shieldEl: !!shieldEl, statusEl: !!statusEl, statsEl: !!statsEl });
      return;
    }

    // 用「演出血量」而不是引擎血量：引擎已经算到了回合末，直接读会一次性跳到底
    const hp = Math.max(0, this.dispHp[key] ?? s.hp);
    const pct = Math.max(0, (hp / s.maxHp) * 100);
    fill.style.width = `${pct}%`;
    if (!isPlayer) {
      const bar = fill.parentElement;
      bar.classList.toggle('mid', pct <= 55 && pct > 25);
      bar.classList.toggle('enemy', pct > 55);
    }
    text.textContent = `${hp} / ${s.maxHp}`;

    const shieldVal = this.dispShield[key] ?? s.shield;
    if (shieldVal > 0) {
      shieldEl.classList.remove('hidden');
      // 护盾值用盾牌（圆角款）：和「防御属性」的基础盾区分开
      shieldEl.dataset.tip = t('护盾 {n}：先替你吃伤害，吃光之后剩下的才掉血。\n持有者自己的回合开始时清空，所以它是「撑过这一轮」的资源。', { n: shieldVal });
      /**
       * 只在数字真的变了时才重建内容。
       *
       * 以前这里每次刷新都 clear() + 重新 append，而 .fighter-shield 挂着 popIn 入场动画 ——
       * 于是护盾徽章在每一次刷新（每一段伤害、每一次抽牌…）都会重播一遍「弹出来」，
       * 多段攻击时看着像在抖。现在只有涨的那一下才算「入场」。
       */
      if (shieldEl.dataset.val !== String(shieldVal)) {
        const prev = Number(shieldEl.dataset.val) || 0;
        shieldEl.dataset.val = String(shieldVal);
        clear(shieldEl).append(
          el('span', { class: 'ico-shield_02', style: { width: '13px', height: '13px' } }),
          el('span', { text: String(shieldVal) })
        );
        // 涨 = 刚加上（弹一下 + 蓝光），掉 = 被打掉了（缩一下）
        restartAnim(shieldEl, shieldVal > prev ? 'tick-up' : 'tick-down');
      }
    } else {
      shieldEl.classList.add('hidden');
      shieldEl.classList.remove('tick-up', 'tick-down');
      delete shieldEl.dataset.tip;
      // 归零：下一次再加护盾才算「涨」，否则会漏掉刷新后的那一下入场动画
      shieldEl.dataset.val = '0';
      clear(shieldEl);
    }

    // 状态胶囊必须读**演出副本**：引擎在 endTurn() 里就把整个敌方回合算完了，
    // 直接读 s[st] 会让「虚弱/中毒」在对手的招还没演到身上时就先冒出来。
    // （血量/护盾早就走 disp 了，状态这块当初漏了 —— 和当年那个「血条不动」是同一类 bug。）
    const dd = this.disp[key] ?? {};
    this.syncStatusChips(statusEl, dd);
    /**
     * **强化胶囊**（我方 buff，v2.9961 新加的）：行动点上限 / 回响 / 威力提升 / 附加层数。
     * 和状态胶囊同一排、同一套样式，只是往另一头（右边）排 —— 玩家一眼能看出
     * 「哪些是坏的、哪些是我给自己挂的」。数据直接读引擎（强化只在回合边界变化，
     * 不像血量那样会被一次性算完的敌方回合抢跑）。
     */
    this.syncBuffChips(statusEl, this.battle[key]?.buffs ?? {});

    clear(statsEl);
    const rows = isPlayer
      ? [
          [STAT_SHORT.atk, b.player.atk + (dd?.atkMod ?? 0), b.player.atk],
          [STAT_SHORT.def, b.player.def + (dd?.defMod ?? 0), b.player.def],
          [STAT_SHORT.agi, b.player.agi + (dd?.agiMod ?? 0), b.player.agi],
          [STAT_SHORT.luck, (b.player.luck ?? 0) + (dd?.luckMod ?? 0), b.player.luck ?? 0],
        ]
      : [
          [STAT_SHORT.atk, b.enemy.atk + (dd?.atkMod ?? 0), b.enemy.atk],
          [STAT_SHORT.def, b.enemy.def + (dd?.defMod ?? 0), b.enemy.def],
          [STAT_SHORT.agi, b.enemy.agi + (dd?.agiMod ?? 0), b.enemy.agi],
        ];
    const agi = b.player.agi;
    /**
     * 悬停说明里的数字：表在 src/core/ui-words.js（纯数据，工具扫得到），
     * 表里的 `{…}` 由 t() 的第二个参数填 —— 公式取自 BALANCE，属性取当前值，
     * 所以改平衡时文案跟着动（以前这几句把 3 / 2 / 9 / 5 / 8 抄成了死数字）。
     */
    const TIP_VARS = {
      K: BALANCE.armorK,
      agi,
      ap: apFromAgi(agi), apBase: BALANCE.apBase, apPerAgi: BALANCE.apPerAgi, apMax: BALANCE.apMax,
      draw: drawFromAgi(agi), drawBase: BALANCE.drawBase, drawPerAgi: BALANCE.drawPerAgi, drawMax: BALANCE.drawMax,
      plays: playsFromAgi(agi), playBase: BALANCE.playBase, playPerAgi: BALANCE.playPerAgi, playMax: BALANCE.playMax,
    };
    for (const [label, val, base] of rows) {
      const diff = val - base;
      // 对手那几格只说结论（不摊开算公式），只有「速」单独一句，其余回落到 STAT_TIP
      const tip = (isPlayer ? STAT_TIP[label] : (STAT_TIP_FOE[label] ?? STAT_TIP[label])) ?? '';
      statsEl.append(el('span', {
        dataset: { tip: `${t(tip, TIP_VARS)}${diff < 0 ? '\n' + t('当前被削弱了 {n} 点。', { n: -diff }) : ''}` },
      }, [
        el('span', { class: STAT_ICO[label] ?? 'ico-star', style: { width: '11px', height: '11px' } }),
        el('span', { text: t(label) }),
        el('b', { class: diff > 0 ? 'up' : diff < 0 ? 'down' : '', text: String(val) }),
      ]));
    }

    // 顶部 HUD 也跟着一起刷：只在整个回合演完时刷的话，
    // 演出途中「角色卡上的血条已经掉了、顶部的还满着」，看着像没掉血。
    if (isPlayer) this.syncHud();
  }

  /**
   * 强化胶囊（我方 buff）：和状态胶囊同一排，`data-buff` 前缀区分（退场逻辑按 data-st 找，互不干扰）。
   * 显示成「名字 + 剩余回合」，悬停给出完整说明。
   */
  syncBuffChips(statusEl, buffs) {
    const keys = Object.keys(buffs ?? {}).filter((k) => BUFF_INFO[k] && (buffs[k]?.turns ?? 0) > 0);
    for (const node of [...statusEl.children]) {
      if (node.dataset.buff && !keys.includes(node.dataset.buff)) node.remove();
    }
    for (const k of keys) {
      const v = buffs[k];
      const info = BUFF_INFO[k];
      const label = t(info.name);
      const val = k === 'echo' ? `×${(1 + v.n).toFixed(1).replace(/\.0$/, '')}` : `+${v.n}`;
      const text = `${label} ${val} · ${t('剩 {n} 回合', { n: v.turns })}`;
      const tip = `${label} ${val}\n${t(info.desc, { n: v.n, mul: (1 + v.n).toFixed(1).replace(/\.0$/, '') })}\n${t('剩余 {n} 回合。', { n: v.turns })}`;
      let node = [...statusEl.children].find((n) => n.dataset.buff === k);
      if (!node) {
        node = el('span', {
          class: 'status-chip buff enter',
          dataset: { buff: k, val: val, tip },
          style: { '--chip': info.color, boxShadow: `inset 0 0 0 1px ${info.color}66` },
        }, [
          el('span', { class: `status-ico ${info.ico}`, style: { backgroundColor: info.color } }),
          el('span', { class: 'status-val', text }),
        ]);
        statusEl.append(node);
        continue;
      }
      const valEl = node.querySelector('.status-val');
      if (valEl && valEl.textContent !== text) { valEl.textContent = text; restartAnim(valEl, 'val-up'); }
      node.dataset.val = val;
      node.dataset.tip = tip;
    }
  }

  /**
   * 状态胶囊的增删改 —— 按状态名**对齐**，而不是每次重建一遍。
   *
   * 以前这里（在 refreshSide 里）是 clear() + 重新 append：胶囊每次刷新都是新节点，
   * 于是「被挂上毒」只能是凭空出现、「毒解掉了」直接凭空消失，想加动画也没地方加 ——
   * 入场动画挂在新建的节点上，每刷一次都会重播，多段攻击时会闪成一片。
   * 现在节点留着：新来的播入场、层数变了的弹一下、走掉的带着退场动画化掉。
   *
   * 判断依据永远是**演出副本 dd**（不是引擎实时值），和血量/护盾同一套规矩：
   * 引擎在 endTurn() 里已经把整个敌方回合算完了，读实时值会让状态提前冒出来。
   */
  syncStatusChips(statusEl, dd) {
    const want = CHIP_ORDER.filter((st) => (dd?.[st] ?? 0) > 0);
    /** 已经在场上的胶囊（正在退场的也算：同一回合里又被挂上就把它救回来） */
    const have = new Map();
    for (const node of [...statusEl.children]) {
      if (node.dataset.st) have.set(node.dataset.st, node);
    }

    for (const st of want) {
      const val = dd[st];
      const info = STATUS_INFO[st];
      const tip = `${info.name} ${t('{n} 层', { n: val })}\n${info.desc}\n${t('解法：「白雾」「焕然一新」这类解状态牌可以直接清掉。')}`;
      let node = have.get(st);
      if (!node) {
        node = el('span', {
          class: 'status-chip enter',
          dataset: { st, val: String(val), tip },
          // 主题色同时给 CSS：入场闪一下、退场化掉都按这个颜色走
          style: { '--chip': info.color, boxShadow: `inset 0 0 0 1px ${info.color}66` },
        }, [
          el('span', { class: `status-ico ${STATUS_ICO[st] ?? 'ico-warn'}`, style: { backgroundColor: info.color } }),
          el('span', { class: 'status-val', text: `${info.name} ${val}` }),
        ]);
        statusEl.append(node);
        have.set(st, node);
        continue;
      }
      this.reviveChip(node);
      node.classList.remove('purge');
      // 层数变了：数字滑一下 + 弹一颗 Δ（不然「毒从 3 层掉到 2 层」在这么小的胶囊上根本看不出来）
      if (node.dataset.val !== String(val)) {
        const prev = Number(node.dataset.val) || 0;
        const delta = val - prev;
        node.dataset.val = String(val);
        node.dataset.tip = tip;
        const valEl = node.querySelector('.status-val');
        if (valEl) {
          valEl.textContent = `${info.name} ${val}`;
          restartAnim(valEl, delta > 0 ? 'val-up' : 'val-down');
        }
        this.popDelta(node, delta, info.color);
        restartAnim(node, delta > 0 ? 'tick-up' : 'tick-down');
      }
    }

    // 不在 want 里的：退场（正在退的不要重复起动画，否则会被反复打断）
    for (const [st, node] of have) {
      if (want.includes(st)) continue;
      this.retireChip(node);
    }

    // 归位：状态顺序固定，别因为「先挂毒后挂灼伤」就每次换位置
    let cursor = statusEl.firstChild;
    for (const st of want) {
      const node = have.get(st);
      if (!node || node === cursor) { if (node) cursor = node.nextSibling; continue; }
      statusEl.insertBefore(node, cursor);
    }
  }

  /** 让胶囊退场：先化掉，动画放完再真的摘掉 */
  retireChip(node) {
    if (node.dataset.leaving) return;
    node.dataset.leaving = '1';
    node.classList.remove('enter', 'tick-up', 'tick-down');
    node.classList.add('out');
    clearTimeout(node._leaveTimer);
    node._leaveTimer = setTimeout(() => node.remove(), CHIP_OUT_MS);
  }

  /** 退场途中又挂上了同一种状态：把动画叫停，让它接着用同一颗胶囊 */
  reviveChip(node) {
    if (!node.dataset.leaving) return;
    clearTimeout(node._leaveTimer);
    delete node.dataset.leaving;
    node.classList.remove('out');
    restartAnim(node, 'enter');
  }

  /** 被净化的前一下：先亮白光，玩家才看得见「消失的是这几个」 */
  /**
   * 净化 / 引爆时，把**真的被清掉的那几个**胶囊点亮一下。
   *
   * ⚠ 这里以前是按「演出副本里这一项的层数已经归零」来判断的，而这一排里除了状态胶囊
   * （`data-st`）还混着**强化胶囊**（`data-buff`，强化没有层数、读出来恒为 0）——
   * 于是每一次净化都会把「力量 +8」「护盾」这些良性 buff 一起点亮（用户报的
   * 「清理恶性 buff 时良性 buff 也会发光」）。
   * 现在改成按**引擎给的名单**点：cleanse / detonate 事件的 `statuses` 就是这一下清掉的那几个，
   * 名单里没有的一律不碰。强化胶囊连判断都不进。
   */
  markPurge(key, ev = null) {
    const statusEl = key === 'player' ? this.playerStatuses : this.enemyStatuses;
    if (!statusEl) return 0;
    const cleared = new Set(ev?.statuses ?? []);
    let n = 0;
    for (const node of [...statusEl.children]) {
      if (!node.dataset.st) continue;                  // 强化胶囊：净化不动它，也不该发光
      if (!cleared.has(node.dataset.st)) continue;      // 这一下没清到它
      node.classList.add('purge');
      n += 1;
    }
    return n;
  }

  /** 层数变化时弹一颗 +N / −N，飘完自己消失 */
  popDelta(node, delta, color) {
    if (!delta) return;
    node.querySelector('.status-delta')?.remove();
    const badge = el('span', {
      class: `status-delta ${delta > 0 ? 'up' : 'down'}`,
      // 只表示「这次变了多少」，当前层数仍然读胶囊上的数字
      text: `${delta > 0 ? '+' : '−'}${Math.abs(delta)}`,
      style: { color },
    });
    node.append(badge);
    setTimeout(() => badge.remove(), CHIP_DELTA_MS);
  }

  /**
   * 悬停说明：实现搬到了 src/ui/tips.js（全站共用一份），这里只留一句转调。
   *
   * 以前这套逻辑长在战斗界面里，于是卡组页 / 卡牌详情页的词条没法悬停查看 ——
   * 而挑牌时恰恰最需要查「中毒 / 灼伤 / 护盾」到底干什么。
   */
  initTips() {
    initTips();
  }

  /**
   * 回合过场：一条斜切的光带横扫过屏幕，带出「第 N 回合 / 你的行动（对手行动）」，
   * 并在回合数**左边（我方）/ 右边（敌方）**停一张「由大变小」的立绘。
   *
   * 两个刻意的设计（都是用户反馈定下来的）：
   *
   * ① **过场不挡操作**。这个方法只是**把浮层挂上去就返回**，事件流不等它演完 ——
   *    所以抽牌演完、手牌解锁时，光带还在屏幕上飘着，玩家已经可以出牌了。
   *    以前 `await turnSweep()` 会把整个回合开头卡住，光带扫完才能动作。
   *    代价是光带必须自己负责收场（下面的 timer），并且要能容忍
   *    「上一根还没走完，下一回合就来了」——所以每次进来先把上一根拆掉。
   *
   * ② 光带**停住的时间拉长了**（PACE.turnSweep 从 1250 提到 2600）：
   *    既然不挡操作了，停留久一点才有时间看清回合数和立绘。
   *
   * 立绘挂在光带内部（不是别的地方），并做了反向 skew：
   * 光带整体 `skewX(-12deg)`，立绘再 `skewX(12deg)` 掰回来 ——
   * 宝可梦歪着站很奇怪，但反斜的光带是这套 UI 的样子。
   */
  turnIntro(side, turn) {
    if (this.destroyed) return;
    if (side !== 'player' && side !== 'enemy') return;
    const ms = Math.max(700, Math.round(PACE.turnSweep * this.speedMul));

    // 上一根光带可能还在（连点/演出重叠）：先拆掉，连同它的定时器
    this.clearTurnIntro();

    const artPlayer = el('div', { class: 'turn-art turn-art-player' });
    const artEnemy = el('div', { class: 'turn-art turn-art-enemy' });
    const band = el('div', { class: `turn-sweep sweep-${side}` }, [
      el('div', { class: 'turn-sweep-glow' }),
      el('div', { class: 'turn-sweep-row' }, [
        artPlayer,
        el('div', { class: 'turn-sweep-mid' }, [
          el('div', { class: 'turn-sweep-text', text: t('第 {n} 回合', { n: turn }) }),
          el('div', { class: 'turn-sweep-sub', text: side === 'player' ? t('你的行动') : t('对手行动') }),
        ]),
        artEnemy,
      ]),
    ]);
    band.style.setProperty('--sweep-ms', `${ms}ms`);
    document.body.append(band);

    this._sweep = { band, slots: { player: artPlayer, enemy: artEnemy }, timers: [] };
    // 立绘等光带停稳之后再入场（关键帧里 16% 就到位了，这里取 22% 留一点余量）
    this._sweep.timers.push(setTimeout(() => this.turnArt(side, turn), Math.round(ms * PACE.turnArtLead)));
    // 动画播完再拆（+80ms 余量，免得 CSS 动画最后几帧被截掉）
    this._sweep.timers.push(setTimeout(() => {
      band.remove();
      if (this._sweep?.band === band) this._sweep = null;
    }, ms + 80));
  }

  /** 拆掉当前这根回合光带（连同它没跑完的定时器） */
  clearTurnIntro() {
    if (!this._sweep) return;
    for (const t of this._sweep.timers) clearTimeout(t);
    this._sweep.band.remove();
    this._sweep = null;
  }

  /**
   * 回合立绘：一张「由大变小」的正面 / 背面图落到回合数旁边（我方在左，敌方在右）。
   *
   * 为什么是背面对我方、正面对敌方：和正作一致 —— 玩家永远看着自己宝可梦的后背。
   * 素材来自 Generation 9 Pack（assets/gen9/，导入时已裁到包围盒，见 tools/import-gen9.mjs）。
   *
   * 缩放原点是「靠着回合数的那条边」：于是它一开始是**盖住回合数**的一大团，
   * 收拢之后停在旁边，而不是从旁边「长出来」。
   * 时长跟着「演出速度」缩放，和光带用同一套倍率。
   */
  async turnArt(side, turn) {
    if (this.destroyed || !this._sweep) return;
    const slot = this._sweep.slots[side];
    if (!slot) return;
    slot.replaceChildren();

    const slug = side === 'player' ? this.game.data?.slug : this.battle.enemy?.slug;
    const kind = side === 'player' ? 'back' : 'front';
    const art = turnArtOf(slug, kind);
    // 没素材（新物种 / 内联缺失）就安静跳过：宁可这一回合不画，也不要留个破图
    if (!art) return;

    /**
     * 立绘位的实际高度由 CSS 变量 --tart-h 决定。
     * getComputedStyle 拿的是「已经按窗口宽度 clamp 过」的真实像素值，
     * 所以窄窗口下立绘会自己变小，不需要第二套断点。
     */
    const slotH = parseFloat(getComputedStyle(slot).height) || 96;
    const { w, h } = fitArt(art, slotH);

    const inMs = Math.max(120, Math.round(PACE.turnArtIn * this.speedMul));
    const outMs = Math.max(80, Math.round(PACE.turnArtOut * this.speedMul));
    slot.style.setProperty('--tart-in', `${inMs}ms`);
    slot.style.setProperty('--tart-out', `${outMs}ms`);
    slot.style.setProperty('--tart-from', String(ART_FROM_SCALE));
    // 图在立绘位里是绝对定位 + top:50% 垂直居中的，CSS 不知道它多高，
    // 所以把高度也当成变量传进去（margin-top 用负一半把它拉回来）。
    slot.style.setProperty('--tart-ih', `${h}px`);

    const img = el('img', {
      class: 'turn-art-img',
      src: art.url,
      alt: '',
      style: { width: `${w}px`, height: `${h}px` },
    });
    img.draggable = false;
    const glow = el('div', {
      class: 'turn-art-glow',
      style: { width: `${w}px`, height: `${Math.round(h * 0.6)}px` },
    });
    slot.append(glow, img);

    await this.wait(PACE.turnArtIn + PACE.turnArtHold);
    if (this.destroyed) return;
    img.classList.add('turn-art-out');
    glow.classList.add('turn-art-out');
    await this.wait(PACE.turnArtOut);
    slot.replaceChildren();
  }

  /** 清掉立绘位（切屏 / 销毁时用，防止动画节点留在 DOM 里） */
  clearTurnArt() {
    for (const slot of Object.values(this._sweep?.slots ?? {})) slot.replaceChildren();
  }

  refreshTurn() {
    this.initTips();
    const b = this.battle;
    this.turnBadgeText.textContent =
      t('第 {n} 回合 · {side}', { n: this.dispTurn, side: this.dispActive === 'player' ? t('你的行动') : t('对手行动') });
    this.refreshBudget();
    // AP 也走「演出血量」那一套：否则敌方回合还没演完，AP 就已经是下一回合的了
    const dp = this.disp.player ?? { ap: b.player.ap, apMax: b.player.apMax };
    clear(this.apOrbs);
    const max = Math.max(dp.apMax ?? b.player.apMax, dp.ap ?? 0);
    const orbs = [];
    for (let i = 0; i < max; i++) {
      const orb = el('div', { class: `ap-orb${i < dp.ap ? '' : ' spent'}` });
      this.apOrbs.append(orb);
      orbs.push(orb);
    }
    // AP 被花掉时不要「啪」地直接变暗：让花掉的那几颗先弹一下再灭，数字滚下去，
    // 再从血条那儿飘一个「-N」出来（以前是一瞬间跳完，打牌打得快时几乎看不到）。
    const prev = this._shownAp ?? dp.ap;
    const spent = Math.max(0, Math.min(prev, max) - dp.ap);
    if (spent > 0) {
      for (let k = 0; k < spent; k++) {
        const orb = orbs[dp.ap + k];
        if (!orb) continue;
        orb.classList.remove('spent');
        orb.classList.add('ap-orb-spending');
        orb.style.animationDelay = `${k * 70}ms`;
        setTimeout(() => {
          orb.classList.remove('ap-orb-spending');
          orb.classList.add('spent');
        }, 250 + k * 70);
      }
      this.rollApText(prev, dp.ap, max);
      floatAt(this.apOrbs, `-${spent}`, 'float-ap');
    } else if (dp.ap > prev) {
      // 回合开始时 AP 回满：也不要瞬间亮起来，一颗一颗「充能」进去
      const gained = dp.ap - prev;
      for (let k = 0; k < gained; k++) {
        const orb = orbs[prev + k];
        if (!orb) continue;
        orb.classList.add('ap-orb-filling');
        orb.style.animationDelay = `${k * 65}ms`;
        setTimeout(() => orb.classList.remove('ap-orb-filling'), 340 + k * 65);
      }
      this.rollApText(prev, dp.ap, max);
      floatAt(this.apOrbs, `+${gained}`, 'float-ap');
    } else {
      this.apText.textContent = `${dp.ap} / ${max}`;
    }
    this.apOrbs.dataset.tip = t('行动点 {ap}/{max}：打出卡牌要花行动点。\n回合开始时回满，敏捷越高每回合越多。', { ap: dp.ap, max });
    this._shownAp = dp.ap;
  }

  /**
   * 「本回合的预算」胶囊：出牌还剩几张、每回合抽几张。
   *
   * 为什么要有它：敏捷决定的三件事里，AP 有球、手牌上限写在牌堆行里，
   * 但**出牌上限**在界面上完全看不见 —— 玩家只会遇到「牌明明是亮的却打不出去」，
   * 或者反过来，不知道自己的敏捷升上去之后一回合能连打多少张。
   * 这里把它写成「还能出 N / M」，并且把算法和当前敏捷值一起放进悬停说明。
   */
  refreshBudget() {
    if (!this.budgetEl) return;
    const b = this.battle;
    const p = b.player ?? {};
    const dp = this.disp.player ?? {};
    const agi = p.agi ?? 0;
    const playsMax = dp.playMax ?? p.playMax ?? playsFromAgi(agi);
    const left = Math.max(0, dp.playsLeft ?? p.playsLeft ?? playsMax);
    const drawN = dp.drawN ?? p.drawN ?? drawFromAgi(agi);
    const handMax = dp.handMax ?? p.handMax ?? 8;

    /**
     * 三个「预算」胶囊的悬停说明。
     * 公式里的数字全部从 BALANCE 取（别抄第二份）：这几句以前把 3 / 2 / 9 / 5 / 8 写死了，
     * 改平衡时改的只有 balance.js，文案会悄悄和实际脱节。
     */
    const agiTip = t('行动点 = {base} + 敏捷 ÷ {perAgi}（上限 {max}）', { base: BALANCE.apBase, perAgi: BALANCE.apPerAgi, max: BALANCE.apMax });
    const playTip = t('出牌上限 = {base} + 敏捷 ÷ {perAgi}（向下取整，最高 {max}）', { base: BALANCE.playBase, perAgi: BALANCE.playPerAgi, max: BALANCE.playMax });
    const drawTip = t('抽牌 = {base} + 敏捷 ÷ {perAgi}（向下取整，最高 {max}）', { base: BALANCE.drawBase, perAgi: BALANCE.drawPerAgi, max: BALANCE.drawMax });

    clear(this.budgetEl).append(
      el('span', {
        class: `budget-chip${left <= 0 ? ' out' : ''}`,
        dataset: {
          tip: t('本回合还能打出 **{left}** 张牌（上限 {max}）。\n', { left, max: playsMax })
            + t('{tip}——你现在敏捷 {agi} → **{n} 张**。\n', { tip: playTip, agi, n: playsFromAgi(agi) })
            + t('打不出去通常不是卡住了：先看这里是不是 0，再看 AP 够不够。'),
        },
      }, [
        el('span', { class: 'ico-card', style: { width: '12px', height: '12px' } }),
        ' ' + t('出牌') + ' ',
        el('b', { text: `${left} / ${playsMax}` }),
      ]),
      el('span', {
        class: 'budget-chip',
        dataset: {
          tip: t('每回合开始抽 **{n}** 张。\n', { n: drawN })
            + t('{tip}——你现在敏捷 {agi} → **{n} 张**。\n', { tip: drawTip, agi, n: drawFromAgi(agi) })
            + t('手牌上限 {n} 张，抽到手牌满就抽不动了（剩下的留在牌堆顶，不会丢）。', { n: handMax }),
        },
      }, [
        el('span', { class: 'ico-deck', style: { width: '12px', height: '12px' } }),
        ' ' + t('抽牌') + ' ',
        el('b', { text: String(drawN) }),
      ]),
    );
  }

  /** AP 数字滚动：从 from 缓动到 to（ease-out），避免数字直接跳 */
  rollApText(from, to, max) {
    clearInterval(this._apRoll);
    const t0 = performance.now();
    const dur = 280;
    const tick = () => {
      const k = Math.min(1, (performance.now() - t0) / dur);
      const eased = 1 - Math.pow(1 - k, 3);
      this.apText.textContent = `${Math.round(from + (to - from) * eased)} / ${max}`;
      if (k >= 1) {
        clearInterval(this._apRoll);
        this._apRoll = null;
        this.apText.textContent = `${to} / ${max}`;
      }
    };
    this._apRoll = setInterval(tick, 30);
    tick();
  }

  refreshPiles() {
    const d = this.battle.decks.player;
    clear(this.pileInfo);
    const mk = (tip, children) => el('span', { dataset: { tip } }, children);
    this.pileInfo.append(
      mk(t('牌堆：还没抽到的牌。抽完会把弃牌洗回来。'), [el('span', { class: 'ico-cards', style: { width: '13px', height: '13px' } }), ' ' + t('卡组') + ' ', el('b', { text: String(d.draw.length) })]),
      mk(t('弃牌：打出去的牌会进这里（不进牌堆）。牌堆抽空、还要再抽的时候，这里才洗回牌堆。'), [t('弃牌') + ' ', el('b', { text: String(d.discard.length) })]),
      mk(t('销毁：带「使用后销毁」的牌打完就进这里，本场战斗不会再出现。'), [t('销毁') + ' ', el('b', { text: String(d.exhaust.length) })]),
      mk(t('手牌：当前能打出的牌。上限由敏捷决定，抽到手牌满就抽不动了（剩下的留在牌堆顶，不会丢）。'), [t('手牌') + ' ', el('b', { text: `${d.hand.length}/${this.battle.player.handMax}` })]),
    );
    this.renderDiscard();
  }

  /**
   * 弃牌区（3.1）：把**玩家打过的牌**摊在右侧日志下面。
   *
   * 用户的原话：「右方日志可以往上挪，腾出下方空间用于放置玩家打过的牌，
   * 这样就可以看到弃牌区有哪些牌了」—— 以前底栏只有一个「弃牌 3」的数字。
   *
   * 显示顺序按**打出的先后**（弃牌堆就是 push 进去的），最新的排在前面 ——
   * 打完一张牌马上就能在左侧看到它，不用翻。
   * 张数多的时候只留最近的一批（`MAX_SHOWN`），并写明「共 N 张」，
   * 免得十几张牌把日志挤没（要看全量的话，牌堆 / 弃牌的数字和悬停说明还在底栏）。
   */
  renderDiscard() {
    const d = this.battle?.decks?.player;
    if (!this.discardEl || !d) return;
    const MAX_SHOWN = 12;
    const all = d.discard ?? [];
    clear(this.discardEl);
    const head = el('div', { class: 'discard-head' }, [
      el('span', { text: t('弃牌区') }),
      el('b', { text: t('{n} 张', { n: all.length }) }),
    ]);
    this.discardEl.append(head);
    if (!all.length) {
      this.discardEl.append(el('div', { class: 'discard-empty', text: t('还没打出过牌。') }));
      return;
    }
    const list = el('div', { class: 'discard-list' });
    for (const entry of all.slice(-MAX_SHOWN).reverse()) {
      const card = entry?.card ?? CARD_BY_ID[entry?.id ?? entry];
      if (!card) continue;
      const cost = card.ap ?? 0;
      list.append(el('span', {
        class: `discard-card${card.rarity ? ' rarity-' + card.rarity : ''}`,
        dataset: {
          tip: `${card.name}（${t('费用 {n}', { n: cost })}）\n${t(resolveCardText(card))}`,
        },
      }, [
        el('i', { class: 'discard-cost', text: String(cost) }),
        el('span', { class: 'discard-name', text: card.name }),
      ]));
    }
    this.discardEl.append(list);
  }

  /**
   * 中间那个小胶囊：对手下回合大概会造成多少威胁。
   *
   * 之前它是拿「敌方手牌」去猜的，但敌人是在它自己回合开始时才抽牌，
   * 轮到玩家时它手牌是空的 —— 于是这个胶囊永远显示同一句话，看着像坏了。
   * 现在用引擎的 predictEnemyThreat()：拿整副牌 + 下回合的行动点/出牌数模拟一遍，
   * 显示的是**上界**（真抽到什么牌仍然随机），所以文案写「最多」而不是断言。
   */
  refreshIntent() {
    const b = this.battle;
    /**
     * 悬停说明：这两个数分别是什么（很多人第一眼会当成「他一定会打我这么多」）。
     * 3.0.1 起这里报**两个**数：预计（按随机抽牌平均）+ 最多（抽得最顺的上界）。
     */
    this.intentEl.dataset.tip = t('对手下回合能打掉你多少：\n**预计**是照它真实的出牌方式、按它随机抽牌平均出来的（做决策看这个数）。\n**最多**是它抽得最顺时的上界，很少真会发生。');
    if (b.over) {
      this.intentEl.className = 'intent calm';
      clear(this.intentEl).append(el('span', { class: 'ico-dice' }), el('span', { text: t('战斗结束') }));
      return;
    }
    if (this.dispActive !== 'player') {
      this.intentEl.className = 'intent calm';
      clear(this.intentEl).append(el('span', { class: 'ico-dice' }), el('span', { text: t('对手正在行动……') }));
      return;
    }

    // 局部变量以前叫 t，和 i18n 的 t() 撞名了（改名叫 threat，否则下面 t('…') 会变成
    // 「拿预测结果当函数调」—— 直接 TypeError）。
    const threat = b.predictEnemyThreat();
    const hpNow = this.dispHp?.player ?? b.player.hp;
    clear(this.intentEl);
    if (threat.damage <= 0) {
      this.intentEl.className = 'intent calm';
      this.intentEl.append(
        el('span', { class: 'ico-shield' }),
        el('span', { text: t('下回合对手以变化招式为主') }),
      );
      return;
    }
    /**
     * 两个数一起报（用户报过「这条非常不准」）：
     *   · **预计**（expected）= 照真 AI 的打法、按它**随机抽牌**平均出来的伤害 —— 这才是玩家该拿来做决策的数；
     *   · **最多**（damage）= 它抽得最顺时的上界。
     * 只报上界的话，玩家会觉得「明明写着 300，我一共只挨了 80」；只报期望又藏掉了被一波带走的风险。
     * 颜色按**预计**给（会打死你就是危险；只有上界够打死你则标「当心」）。
     */
    const rng = (n) => n;
    const deadly = threat.expected >= hpNow;
    const risky = !deadly && threat.damage >= hpNow;
    const pct = threat.expected / Math.max(1, hpNow);
    this.intentEl.className = `intent${deadly ? ' danger' : (risky || pct >= 0.3) ? ' warn' : ''}`;
    this.intentEl.append(
      el('span', { class: deadly ? 'ico-skull' : 'ico-sword' }),
      el('span', {
        text: deadly
          ? t('危险：下回合约 {e} 伤害（最多 {d}），会被打倒', { e: rng(threat.expected), d: rng(threat.damage) })
          : t('下回合预计 {e} 伤害（最多 {d}{extra}）', {
            e: rng(threat.expected),
            d: rng(threat.damage),
            extra: threat.topName ? t(' · 最狠：{name}', { name: threat.topName }) : '',
          }),
      }),
    );
  }

  renderHand() {
    const b = this.battle;
    const hand = b.hand('player');
    // 卡面文案里的 {d} 是实时算的，所以画手牌之前先把上下文对齐到当前这只敌人
    // （战斗外的界面由 ui.js 统一设置，这里是战斗中更准的一份）
    setCardTextContext({ atk: effectiveAtk(b.player), def: effectiveDef(b.enemy), selfDef: effectiveDef(b.player) });
    // 找出「这次新抽到的牌」：给它们放「从屏幕下方滑上来」的入场动画。
    // 用 uid 对比（每场战斗内唯一），所以打牌后重画手牌不会让老牌又动一次。
    const seen = this._handSeen ?? (this._handSeen = new Set());
    const fresh = new Set();
    for (const entry of hand) if (!seen.has(entry.uid)) fresh.add(entry.uid);
    const keep = new Set(hand.map((e) => e.uid));
    for (const uid of [...seen]) if (!keep.has(uid)) seen.delete(uid);
    for (const uid of fresh) seen.add(uid);

    clear(this.handEl);
    if (!hand.length) {
      // 别写「让沙暴把卡牌送回来」——听起来像打出去的牌会自己回来。
      // 现在打出去的牌在弃牌区，只有牌堆抽空时才会洗回来，所以只说「结束回合、下回合再抽」。
      this.handEl.append(el('div', { class: 'hand-empty', text: t('手牌空了 —— 结束回合，下回合会重新抽牌。') }));
      return;
    }
    let freshIndex = 0;
    /**
     * 叠放顺序：**左边的牌压在上层**（3.1，用户提的）。
     *
     * 手牌是负边距互相叠着的，压住的是**右边那张的左半边**——而费用角标在左上角，
     * 正好被压掉（用户：「右边的卡牌居上，会导致卡牌费用被挡住」）。
     * DOM 顺序决定叠放顺序（后面的压前面），所以这里按位置倒着写 z-index：
     * 第一张（最左）给最高的层级。悬停时 CSS 那条 `z-index: 20` 仍然盖过全部。
     */
    for (const [idx, entry] of hand.entries()) {
      const canPlay = b.canPlay(entry.uid) && !this.busy && b.active === 'player' && !b.over;
      const node = cardEl(entry.card, {
        disabled: !canPlay,
        dmgText: this.damageBadge(entry.card),
        onClick: () => this.playCard(entry.uid),
        // 灰卡片也要能点：点一下告诉玩家「为什么打不出去」。
        // 以前这里直接吞掉点击，玩家看到的就是「点了没反应 / 出不了牌」。
        onDisabledClick: () => { audio.bad(); toast(this.cantPlayReason(entry), 'bad'); },
      });
      if (canPlay) node.classList.add('playable');
      // 左边的牌在最上层（费用角标在左上角，别被右边那张压掉）
      node.style.zIndex = String(hand.length - idx);
      if (fresh.has(entry.uid)) {
        node.classList.add('card-draw-in');
        node.style.animationDelay = `${Math.min(freshIndex, 6) * 55}ms`;   // 一张接一张，不是一起蹦出来
        freshIndex += 1;
      }
      this.handEl.append(node);
    }
    this.fitHand(hand.length);
  }

  /**
   * 手牌横向摆放：张数多的时候让牌互相叠一点，保证整手牌不溢出屏幕。
   *
   * 以前是 CSS 里写死的 `margin: 0 -14px`：卡面小的时候够用，卡变大之后
   * 手里捏七八张就会顶到两侧屏幕外（或者被 flex 压变形）。
   * 这里按「手牌区实际宽度 + 当前卡面宽度」算出该叠多少 —— 卡面本身不缩小，
   * 因为玩家要看清的就是卡面。
   */
  fitHand(count) {
    const host = this.handEl;
    if (!host) return;
    const cardW = parseFloat(getComputedStyle(host).getPropertyValue('--card-w')) || 186;
    const w = host.clientWidth || window.innerWidth;
    const BASE = 12;                       // 最少叠这么多，牌与牌之间自然压着
    if (count <= 1 || w <= cardW) {
      host.style.setProperty('--hand-overlap', `${BASE}px`);
      return;
    }
    // 每张牌实际占位 = 卡宽 - 2×重叠；让 n 张牌正好铺满可用宽度
    const step = Math.max(40, Math.min(cardW - 2 * BASE, (w - 8 - cardW) / (count - 1)));
    const overlap = Math.max(BASE, Math.min(cardW * 0.34, (cardW - step) / 2));
    host.style.setProperty('--hand-overlap', `${Math.round(overlap)}px`);
  }

  /** 卡面右下角显示「按当前攻防估算的伤害」 */
  damageBadge(card) {
    if (this.game.data.showDamagePreview === false) return null;
    const hits = card.effects.filter((e) => e.kind === 'damage');
    if (!hits.length) return null;
    const b = this.battle;
    let total = 0;
    for (const e of hits) {
      total += computeHit(b.player, b.enemy, e.power, { ignoreDefPct: e.ignoreDefPct ?? 0 }) * (e.hits ?? 1);
    }
    return `≈${total}`;
  }

  // ================= 玩家操作 =================

  async playCard(uid) {
    if (this.busy || !this.mounted) return;
    const entry = this.battle.hand('player').find((c) => c.uid === uid);
    if (!entry) return;
    const res = this.battle.playCard(uid);
    if (!res.ok) {
      audio.bad();
      toast(res.reason, 'bad');
      return;
    }
    audio.cardPlay();
    this.busy = true;
    this._eventAt = Date.now();
    // 注意：这里不能读引擎数值去刷界面。
    // endTurn() 会把整个敌方回合一次算完，扣血/加盾/变属性全都已经落在引擎上了，
    // 一刷新就会「回合刚开始血就掉完了」。界面只刷演出副本（disp），
    // 副本按事件一条条推进，所以伤害是随着对手出招一段段扣下去的。
    this.refreshAll();
    try {
      await this.playEvents(this.battle.takeEvents());
    } finally {
      this.busy = false;
      this._eventAt = Date.now();
      // 兜底：收尾这两步各自 try —— 万一抛异常，手牌会停在「演出中整批禁用」的样子，
      // 那就成了玩家反馈的「随机打不出卡」。
      try { this.resyncDisp(); } catch (err) { console.error(err); }
      try { this.refreshAll(); } catch (err) { console.error(err); this.forceRecover(); }
    }
    if (this.battle.over) await this.settle();
  }

  async onEndTurn() {
    if (this.busy || this.battle.over || !this.mounted) return;
    this.busy = true;
    this._eventAt = Date.now();
    audio.ui('click2');
    this.battle.endTurn();
    // 同上：只刷演出副本，让演出按事件推进
    this.refreshAll();
    try {
      await this.playEvents(this.battle.takeEvents());
    } finally {
      this.busy = false;
      // 兜底：收尾时也单独 try —— 万一 resyncDisp/refreshAll 抛异常，
      // 手牌会停在「演出中整批禁用」的样子，那就是玩家说的「打不出卡」。
      try { this.resyncDisp(); } catch (err) { console.error(err); }
      try { this.refreshAll(); } catch (err) { console.error(err); this.forceRecover(); }
    }
    if (this.battle.over) await this.settle();
  }

  // ================= 事件演出 =================

  async playEvents(events) {
    for (const ev of events) {
      if (this.destroyed) return;
      await this.playEvent(ev);
    }
  }

  /** 让角色卡上的头像跟着事件换表情 */
  reactFace(side, emotion) {
    const box = side === 'player' ? this.playerFace : this.enemyFace;
    const slug = side === 'player' ? this.game.data.slug : this.battle.enemy.slug;
    if (box) setPortraitEmotion(box, slug, emotion);
  }

  /**
   * 背景花纹「这一侧行动了，它那半片微微亮一点」（3.0.5，用户要的）。
   *
   * 亮的是**它自己那半片**（敌人上半、主角下半），做法见 battle-decor.js：
   * 高亮层平时 opacity 0，这里把 `data-acting` 挂到 .battle-screen 上，CSS 点亮对应那层。
   * 每次行动都会**重新计时**（出牌比回合开始密集），停手一段时间后自己淡回去 ——
   * 用户要的是「微微变亮，但又不会太过明显」，所以：
   *   · 亮度只从 10% 提到 20%（不是闪一下，也不是持续发光）；
   *   · 淡入淡出用 CSS 过渡（0.55s），没有硬切。
   */
  decorAct(side, holdMs = 1300) {
    if (!this.screen || !side) return;
    if (this.decorPin) { this.screen.dataset.acting = this.decorPin; return; }   // 截图用：钉住不动
    this.screen.dataset.acting = side;
    clearTimeout(this._decorTimer);
    this._decorTimer = setTimeout(() => {
      if (this.screen) this.screen.dataset.acting = '';
    }, Math.max(400, holdMs * this.speedMul));
  }

  async playEvent(ev) {
    // 看门狗的心跳：每推进一步就记一次时间，卡住时才看得出来（见 startWatchdog）
    this._eventAt = Date.now();
    // 先把「界面副本」推进到这条事件之后的状态，再演动画
    this.applyEventToDisp(ev);
    // 大部分事件都可以顺手给对应角色换个表情
    // （必须把整条 ev 传进去：强化和削弱是同一种事件，只有数值正负能把它们分开）
    if (ev.side && ['damage', 'trueDamage', 'heal', 'shield', 'buff', 'status', 'dodge', 'playCard'].includes(ev.type)) {
      this.reactFace(ev.side, emotionForEvent(ev.type, ev.side, ev));
    }
    switch (ev.type) {
      case 'battleStart':
        this.refreshAll();
        // 「遭遇 XX！」这行也要进日志，否则开场日志框是空的（一进来像是没有战斗信息）
        this.pushLogLine(this.logOf(ev));
        await this.wait(PACE.battleStart);
        break;
      case 'turnStart': {
        this.refreshTurn();
        this.refreshSide(ev.side);
        // 轮到这一侧了：背景花纹先亮起它那半片（出牌时会再续一次，见 playCard 那一支）
        this.decorAct(ev.side, 1100);
        /**
         * 回合过场（光带 + 立绘）**不 await**：它自己演完自己收场。
         *
         * 这样抽牌演完、手牌一解锁，光带还在屏幕上飘着，玩家就能出牌了 ——
         * 用户要的就是这个手感（「可以让条消失之前玩家就可以出牌」）。
         * 代价是它不能再替我们「垫时间」，所以光带自己把停留时间拉长到了
         * PACE.turnSweep（见 turnIntro）。
         */
        this.turnIntro(ev.side, ev.turn);
        this.refreshSide(ev.side === 'player' ? 'enemy' : 'player');
        // 意图胶囊也要跟着换（之前漏了这一句，敌方回合里还挂着玩家回合的文案）
        this.refreshIntent();
        await this.wait(PACE.turnStart);
        break;
      }
      case 'turnEnd':
        await this.wait(PACE.turnEnd);
        break;
      case 'draw':
        /**
         * 发牌音效：引擎的 `draw` 是**一批一次**（`ev.cards` 是这一批抽到的牌），
         * 所以按张数连响几下（audio.dealCards 里封顶 3 下）。
         * 以前这里一次只响一声、而且音量 0.32，压在别的音效底下基本听不见 ——
         * 玩家的感受就是「发牌没有音效」。
         */
        if (ev.side === 'player') audio.dealCards((ev.cards ?? []).length);
        this.refreshSide(ev.side);
        this.refreshPiles();
        await this.wait(PACE.draw);
        break;
      case 'reshuffle':
        if (ev.side === 'player') audio.shuffle();
        this.refreshPiles();
        await this.wait(PACE.reshuffle);
        break;
      case 'playCard': {
        // 先把牌亮出来（对手用了什么牌是必须看得见的），再做出招动作
        this.pushLogLine(this.logOf(ev));
        // 背景花纹：这一侧在动，它那半片亮一点（敌我同一套写法）
        this.decorAct(ev.side, 1500);
        // AP 要**跟着出牌当场扣**：playEvent 开头已经把界面副本推进过了（disp.ap 已经减掉），
        // 这里立刻刷新 AP 栏，消耗动画就是「出牌瞬间」播；以前要等整批演出结束才刷，
        // 感觉像是「打完了才扣 AP」。
        if (ev.side === 'player') this.refreshTurn();
        await this.revealCard(ev.side, ev.id, ev.cost);
        // 按卡牌类型放音效：地震是地震声、火焰牙是火声、铁壁是护盾声
        audio.cardSound(CARD_BY_ID[ev.id]);
        await this.attackAnim(ev.side, CARD_BY_ID[ev.id]);
        if (ev.side === 'player') this.refreshPiles();
        await this.wait(PACE.cardGap);
        break;
      }
      case 'trueDamage': {
        const targetBody = ev.side === 'player' ? this.playerBody : this.enemyBody;
        floatAt(targetBody, `-${ev.amount}`, 'float-dmg');
        targetBody.classList.add('fighter-hurt');
        this.burstFx(targetBody, 'slash_1', { size: 110, ms: 380 });
        audio.hurt();
        setTimeout(() => targetBody.classList.remove('fighter-hurt'), 320);
        this.refreshSide(ev.side);
        this.pushLogLine(this.logOf(ev));
        await this.wait(PACE.trueDamage);
        break;
      }
      case 'damage': {
        const targetBody = ev.side === 'player' ? this.playerBody : this.enemyBody;
        const targetCardEl = ev.side === 'player' ? this.playerCard : this.enemyCard;
        await this.hitAnim(ev, targetBody, targetCardEl);
        break;
      }
      case 'shield': {
        const body = ev.side === 'player' ? this.playerBody : this.enemyBody;
        floatAt(body, t('+{n} 护盾', { n: ev.amount }), 'float-shield');
        audio.shieldUp();
        // 「变硬」这类防御强化也要闪一下白光，玩家才知道这回合真的硬了
        this.flash(body);
        this.burstFx(body, 'light_1', { size: 150, ms: 480 });
        this.burstFx(body, 'trace_1', { size: 130, ms: 520, rotate: 45 });
        this.refreshSide(ev.side);
        this.pushLogLine(this.logOf(ev));
        await this.wait(PACE.shield);
        break;
      }
      case 'heal': {
        const body = ev.side === 'player' ? this.playerBody : this.enemyBody;
        if (ev.amount > 0) {
          floatAt(body, `+${ev.amount}`, 'float-heal');
          audio.heal();
          this.burstFx(body, 'spark_1', { size: 120, ms: 500, klass: 'fx-heal' });
          this.burstFx(body, 'star_1', { size: 96, ms: 620, klass: 'fx-heal' });
        }
        this.refreshSide(ev.side);
        this.pushLogLine(this.logOf(ev));
        await this.wait(PACE.heal);
        break;
      }
      case 'status': {
        if (ev.status === 'poison' || ev.status === 'toxic') audio.poison();
        else if (ev.status === 'burn') audio.burn();
        else if (ev.status === 'weak') audio.dizzy();
        const body = ev.side === 'player' ? this.playerBody : this.enemyBody;
        // 中毒=绿雾、剧毒=深紫雾、灼伤=火光、虚弱=紫旋、出血=红痕
        const STATUS_FX = { poison: 'magic_1', toxic: 'magic_1', burn: 'flare_1', weak: 'twirl_1', bleed: 'slash_1' };
        this.burstFx(body, STATUS_FX[ev.status] ?? 'magic_1', {
          size: 124, ms: 520, klass: `fx-status fx-status-${ev.status}`,
        });
        // 胶囊自己的入场 / 层数变化动画由 refreshSide 里的对齐逻辑负责（见 syncStatusChips）
        this.refreshSide(ev.side);
        this.pushLogLine(this.logOf(ev));
        await this.wait(PACE.status);
        break;
      }
      /**
       * 净化：把身上被清掉的状态**当着玩家的面**化掉。
       *
       * 这条事件以前在界面这边完全没有分支 —— 引擎已经把毒清成 0 了，
       * 界面既不刷胶囊也不打日志（「X 清除了身上的削弱（中毒 3）」这行字从来没出现过），
       * 玩家打完「白雾」只看到一张牌摊开又收起，胶囊还挂在原位，然后下回合它自己没了。
       * 现在：白光一闪 → 要消失的胶囊亮起 → 一起化掉 → 日志落行。
       */
      /**
       * 层数翻倍：把对手身上已有的持续伤害层数 ×2。
       * 演出刻意和「再挂一层」拉开：不是冒一滴毒，而是**数字整排翻过去**，
       * 否则玩家看不出这张牌做了什么（层数变了、特效却和上毒一样，等于没反馈）。
       */
      case 'statusDouble': {
        this.pushLogLine(this.logOf(ev));
        const body = ev.side === 'player' ? this.playerBody : this.enemyBody;
        if ((ev.gained ?? 0) > 0) {
          audio.poison();
          this.burstFx(body, 'magic_1', { size: 160, ms: 560, klass: 'fx-status fx-status-toxic' });
          this.burstFx(body, 'spark_1', { size: 130, ms: 520, klass: 'fx-status' });
          floatAt(body, t('层数 ×2'), 'float-dmg');
          await this.wait(PACE.purge);
          this.refreshSide(ev.side);
        }
        await this.wait(PACE.detonate);
        break;
      }
      /**
       * 转嫁：把自己身上的持续伤害推给对手。演出和「翻倍」刻意区分：
       * 自己这侧的胶囊**化掉**、对手那侧**冒出来**，让人一眼看出是「搬过去了」。
       */
      case 'statusSteal': {
        this.pushLogLine(this.logOf(ev));
        const mine = ev.side === 'player' ? this.playerBody : this.enemyBody;
        const other = ev.side === 'player' ? this.enemyBody : this.playerBody;
        if ((ev.gained ?? 0) > 0) {
          audio.poison();
          floatAt(mine, t('转嫁'), 'float-heal');
          this.burstFx(other, 'magic_1', { size: 160, ms: 560, klass: 'fx-status fx-status-toxic' });
          this.burstFx(mine, 'light_1', { size: 140, ms: 460 });
          if (this.markPurge(ev.side, ev)) await this.wait(PACE.purge);
          this.refreshSide(ev.side);
          this.refreshSide(ev.side === 'player' ? 'enemy' : 'player');
          await this.wait(PACE.purge);
        }
        await this.wait(PACE.detonate);
        break;
      }
      case 'cleanse': {
        const body = ev.side === 'player' ? this.playerBody : this.enemyBody;
        this.pushLogLine(this.logOf(ev));
        if ((ev.removed ?? 0) > 0) {
          audio.heal();
          this.flash(body);
          this.burstFx(body, 'light_1', { size: 150, ms: 480 });
          this.burstFx(body, 'spark_1', { size: 120, ms: 520, klass: 'fx-heal' });
          if (this.markPurge(ev.side, ev)) {
            floatAt(body, t('净化'), 'float-heal');
            // 先让那几个胶囊亮一下白光：不然「哪几个被清掉了」根本看不见
            await this.wait(PACE.purge);
          }
          this.refreshSide(ev.side);
        }
        await this.wait(PACE.cleanse);
        break;
      }
      /**
       * 引爆（剧毒爆发）：把对手身上的中毒 / 剧毒一次性炸掉。
       * 和净化同理 —— 以前也是「引擎清了、界面还挂着胶囊」，而且日志行同样被打丢了。
       */
      case 'detonate': {
        this.pushLogLine(this.logOf(ev));
        const body = ev.side === 'player' ? this.playerBody : this.enemyBody;
        if ((ev.stacks ?? 0) > 0) {
          audio.poison();
          this.burstFx(body, 'magic_1', { size: 150, ms: 560, klass: 'fx-status fx-status-toxic' });
          floatAt(body, t('引爆 ×{n}', { n: ev.stacks }), 'float-dmg');
          if (this.markPurge(ev.side, ev)) await this.wait(PACE.purge);
          this.refreshSide(ev.side);
        }
        await this.wait(PACE.detonate);
        break;
      }
      case 'buff': {
        this.refreshSide(ev.side);
        const body = ev.side === 'player' ? this.playerBody : this.enemyBody;
        // amount 是**实际变化量**（引擎已经把下降下限算进去了）。为 0 就是「已到下限、没变化」：
        // 这时候不该再放削弱音效和特效（以前会照放，看起来像附加成功了但数值没动）。
        if (ev.amount === 0 && body) {
          floatAt(body, t('已到下限'), 'float-miss');
          audio.miss();
          await this.wait(PACE.buff);
        } else {
          if (ev.amount > 0) audio.buffUp(); else audio.buffDown();
          await this.buffFx(ev);
        }
        this.pushLogLine(this.logOf(ev));
        await this.wait(PACE.buff);
        break;
      }
      case 'dodge': {
        const body = ev.side === 'player' ? this.playerBody : this.enemyBody;
        floatAt(body, t('闪避！'), 'float-miss');
        audio.miss();
        this.pushLogLine(this.logOf(ev));
        await this.wait(PACE.dodge);
        break;
      }
      case 'resist':
        // 说清「抵抗了什么」：光两个字「抵抗」没人看得懂（岩崩的虚弱是有概率的）
        floatAt(ev.side === 'player' ? this.playerBody : this.enemyBody,
          t('抵抗{status}', { status: STATUS_INFO[ev.status]?.name ?? '' }), 'float-miss');
        audio.miss();
        this.pushLogLine(this.logOf(ev));
        await this.wait(PACE.resist);
        break;
      case 'discard':
        // 打出去的牌进弃牌区（旧版是「塞回牌堆最底端」，那条事件叫 toBottom，已经不存在了）
        this.refreshPiles();
        await this.wait(PACE.discard);
        break;
      case 'exhaust': {
        // 销毁：如果刚摊在场上的是同一张牌，就让它碎成碎片淡出（不然玩家只看到一行日志）
        const held = this._heldExhaust;
        if (held && held.id === ev.id) {
          this._heldExhaust = null;
          this.shatter(held.node);
          await this.wait(PACE.exhaust);
          clear(held.zone);
        }
        this.refreshPiles();
        await this.wait(PACE.discard);
        break;
      }
      case 'gainAp':
        // 「回 AP 的牌」这条事件没有日志（效果面上已经写着 +AP），
        // 但「下回合额外获得 N 点行动点」那种是带日志的 —— 不推的话那行字一样看不见
        this.pushLogLine(this.logOf(ev));
        this.refreshTurn();
        await this.wait(PACE.gainAp);
        break;
      case 'battleEnd':
        await this.onBattleEnd(ev);
        break;
      default:
        /**
         * 引擎挂了日志、但界面这边没写专属演出的事件（力量加成、额外出牌次数…）。
         *
         * 日志文本是**跟着事件走**的（见 battle.js 的 emitLogged），而这里以前是空的
         * `break` —— 于是「剑舞」加的威力、「轻装」多出的出牌次数，战斗日志里一行都没有：
         * 效果真的生效了，玩家却找不到任何痕迹。没写演出的至少也要把话留下。
         */
        this.pushLogLine(this.logOf(ev));
        break;
    }
  }

  /**
   * 取出这条事件对应的日志行。
   * 引擎会把日志文本挂在事件上（ev.log），所以这里不需要再去猜
   * 「日志数组的最后一条是不是我的」——以前那样猜，一张卡带两个效果时就会打印两遍同一条。
   */
  logOf(ev) {
    if (ev && ev.log) return { text: ev.log, kind: ev.logKind ?? 'info' };
    return null;
  }

  // ================= 简单特效（复用工作区的 fx 贴图）=================

  /** 角色行走图闪一下白光：强化 / 变化类技能用这个表示「生效了」 */
  flash(body) {
    if (!body) return;
    body.classList.remove('fighter-flash');
    // 强制重排，保证连续两次强化也能重新播动画
    void body.offsetWidth;
    body.classList.add('fighter-flash');
    setTimeout(() => body.classList.remove('fighter-flash'), 560);
  }

  /**
   * 在身上叠一张特效贴图（assets/img/fx/*.png），播完自动移除。
   * @param {HTMLElement} body 角色容器
   * @param {string} fx 特效图名（不带扩展名）
   * @param {{size?:number, ms?:number, rotate?:number, tone?:string, class?:string, flip?:boolean}} opts
   */
  burstFx(body, fx, opts = {}) {
    if (!body) return null;
    const { size = 120, ms = 460, rotate = 0, tone = 'screen', klass = '', flip = false } = opts;
    const node = el('div', {
      class: `fx-burst ${klass}`.trim(),
      style: {
        width: `${size}px`,
        height: `${size}px`,
        backgroundImage: `url(assets/img/fx/${fx}.png)`,
        mixBlendMode: tone,
        // 用 CSS 变量把参数递给 keyframes / 居中用的负边距
        '--fx-rot': `${rotate}deg`,
        '--fx-ms': `${ms}ms`,
        '--fx-size': `${size}px`,
        transform: flip ? 'scaleX(-1)' : '',
      },
    });
    body.append(node);
    setTimeout(() => node.remove(), ms + 60);
    return node;
  }

  /** 强化 / 削弱：闪光 + 对应属性的特效 + 飘字 */
  async buffFx(ev) {
    const body = ev.side === 'player' ? this.playerBody : this.enemyBody;
    if (!body) return;
    const up = ev.amount > 0;
    const stat = ev.stat;
    // 每种属性给一套「看得出是哪一项」的贴图与颜色
    const LOOK = {
      atk: { fx: 'flare_1', tone: 'screen', text: t(STAT_SHORT.atk) },
      def: { fx: 'trace_1', tone: 'screen', text: t(STAT_SHORT.def) },
      agi: { fx: 'twirl_1', tone: 'screen', text: t(STAT_SHORT.agi) },
      luck: { fx: 'star_1', tone: 'screen', text: t(STAT_SHORT.luck) },
    };
    const look = LOOK[stat] ?? { fx: 'magic_1', tone: 'screen', text: '' };
    if (up) {
      this.flash(body);
      this.burstFx(body, look.fx, { size: 132, ms: 460, rotate: 0 });
      // 星星是双向的：上升用金色，下降用暗紫
      floatAt(body, `${look.text} ${ev.amount > 0 ? '+' : ''}${ev.amount}`, 'float-buff');
    } else {
      this.burstFx(body, 'smoke_1', { size: 130, ms: 460, tone: 'multiply', klass: 'fx-debuff' });
      floatAt(body, `${look.text} ${ev.amount}`, 'float-debuff');
    }
    await this.wait(180);
  }

  /**
   * 把一张牌「打出来」：在对应一侧把卡面摊开，停留一会儿再收起。
   * 对手的牌摊在敌方半场（.enemy-play），自己的牌摊在己方半场。
   */
  async revealCard(side, cardId, cost) {
    const zone = side === 'player' ? this.playerPlay : this.enemyPlay;
    const card = CARD_BY_ID[cardId];
    if (!zone || !card) return;
    // 每次摊牌前重新量一次布局（日志长高、状态图标换行、手牌区渲染都会改变可用空间）
    this.layoutBattle();
    const node = el('div', { class: `played-card played-${side}` }, [
      // 标一句是谁打的，免得对手的牌摊在自己半场里让人困惑
      el('div', { class: 'played-label', text: side === 'enemy' ? t('对手使用了') : t('你使用了') }),
      // 用**正常尺寸**的卡面（不是卡组列表里那种 sm 小卡）：之前 92px 宽会把卡名挤成
      // 「电光…」、描述竖着一列列断行，玩家根本看不清对手打的是什么。
      cardEl(card, { size: 'md', disabled: true, cost: cost ?? card.ap }),
    ]);
    clear(zone).append(node);
    await sleep(16);
    node.classList.add('in');
    await this.wait(side === 'enemy' ? PACE.cardHold : PACE.cardHoldSelf);
    // 带「销毁」的牌**不要**在这里摘掉 .in：摘了会先播一遍「淡出 + 倾斜」的退场过渡，
    // 紧接着才播碎裂，看起来就是两段动画打架。让它保持显形的样子，直接等碎裂接走。
    if (card.exhaust) {
      this._heldExhaust = { node, zone, id: cardId };
      return;
    }
    node.classList.remove('in');
    await this.wait(180);
    if (node.parentElement === zone) clear(zone);
  }

  /**
   * 卡牌碎裂：把打出去的那张卡切成碎片，向两侧飞散、旋转、淡出。
   * 用于带「销毁」的卡牌 —— 以前只有一行日志，玩家感觉不到这张牌真的没了。
   */
  shatter(node) {
    if (!node || !node.getBoundingClientRect) return;
    const rect = node.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const COLS = 4, ROWS = 4;
    const w = rect.width / COLS, h = rect.height / ROWS;
    // 挂在**卡牌自己的父节点**上、用父节点坐标系定位：以前是挂到 document.body 上，
    // 结果被场景层盖住，碎片在 DOM 里齐全却根本看不见（截图时才发现）。
    const parent = node.offsetParent ?? node.parentElement ?? document.body;
    const pr = parent.getBoundingClientRect();
    const host = el('div', {
      class: 'shatter-host',
      style: {
        position: 'absolute',
        left: `${rect.left - pr.left + parent.scrollLeft}px`,
        top: `${rect.top - pr.top + parent.scrollTop}px`,
        width: `${rect.width}px`, height: `${rect.height}px`,
        pointerEvents: 'none', zIndex: '70',
      },
    });
    const src = node.cloneNode(true);
    // .played-card 默认是 opacity:0，只有 .in 才显形 —— 碎片必须把 .in 一起带上，
    // 否则碎片在 DOM 里、位置也对，就是完全看不见（截图时才发现这个坑）。
    src.classList.add('in');
    src.style.opacity = '1';
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const shard = el('div', { class: 'card-shard', style: { left: `${c * w}px`, top: `${r * h}px`, width: `${w}px`, height: `${h}px` } });
        const copy = src.cloneNode(true);
        Object.assign(copy.style, { position: 'absolute', left: `${-c * w}px`, top: `${-r * h}px`, margin: '0' });
        shard.append(copy);
        // 中间的碎片直着飞，边上的往两侧甩得更远；越靠下的碎片落得越多
        const side = (c + 0.5) / COLS - 0.5;
        shard.style.setProperty('--dx', `${(side * (150 + Math.random() * 90)).toFixed(1)}px`);
        shard.style.setProperty('--dy', `${(30 + (r / ROWS) * 110 + Math.random() * 60).toFixed(1)}px`);
        shard.style.setProperty('--rot', `${(side * 110 + (Math.random() * 50 - 25)).toFixed(0)}deg`);
        shard.style.animationDelay = `${((r + c) * 16).toFixed(0)}ms`;
        host.append(shard);
      }
    }
    parent.append(host);
    audio.play('glass', { volume: 0.42, rate: 1.05 });
    node.style.opacity = '0';           // 原卡隐去，视觉上被碎片取代
    setTimeout(() => host.remove(), 1200);
  }

  pushLogLine(entry) {
    if (!entry) return;
    // 有内容时才显示日志框（空着的时候会是一大块碍眼的深色方块）
    this.logEl.classList.add('has-content');
    this.logEl.append(el('p', { class: entry.kind, text: entry.text }));
    this.logEl.scrollTop = this.logEl.scrollHeight;
    while (this.logEl.children.length > 40) this.logEl.firstChild.remove();
  }

  /**
   * 出招动作：向前冲一下 + 换成 Attack 帧，攻击牌还会甩出一道斩击特效。
   * @param {'player'|'enemy'} side
   * @param {object} [card] 打出的卡（有伤害效果就加斩击/冲击特效）
   */
  /**
   * 这一下该播哪个动作（3.1，用户提的）。
   *
   * 规则来自用户的描述：
   *   · 远程攻击 → `Shoot`（挥手把招放出去）
   *   · 自己加 buff / 护盾 → `Charge`（蓄力）
   *   · 给对手叠 buff / 状态（削弱）→ `Shoot`
   *   · 其余（近身打人）→ `Attack`
   * 卡片数据里没有「远程 / 近身」这个字段，所以按**属性**推：火水电冰超草妖幽恶龙飞这些系
   * 在素材里都是放招的姿势，一般 / 格斗 / 地面 / 岩石 / 钢 / 毒算近身。
   */
  animForCard(card) {
    const effs = card?.effects ?? [];
    const onEnemy = (e) => e.target !== 'self';
    /**
     * 先看「自己这边」的动作，再看「打向对手」的动作。
     * 顺序有讲究：一张牌两样都干的时候（酸液护甲 = 给自己护盾 + 给对手叠中毒），
     * 按「它主要是个什么牌」来演 —— 护盾是它给人的第一印象，所以 Charge 优先。
     */
    if (effs.some((e) => ['shield', 'strength', 'grantBuff'].includes(e.kind)
      || (e.kind === 'buff' && !onEnemy(e) && ((e.amount ?? 0) > 0 || (e.pct ?? 0) > 0)))) return 'Charge';
    // 给对手挂状态 / 削弱 → 放招（状态效果在本作里都是挂给对手的：target 字段多半没写）
    if (effs.some((e) => (e.kind === 'status' && onEnemy(e))
      || (e.kind === 'buff' && onEnemy(e) && ((e.amount ?? 0) < 0 || (e.pct ?? 0) < 0)))) return 'Shoot';
    // 伤害牌：近身白名单优先，其次按属性分远近
    if (effs.some((e) => e.kind === 'damage')) {
      if (MELEE_MOVES.has(card.id)) return 'Attack';
      return (card.types ?? []).some((tp) => RANGED_TYPES.has(tp)) ? 'Shoot' : 'Attack';
    }
    // 纯抽牌 / 纯治疗之类：没有更贴的动作，蓄一下
    return effs.some((e) => e.kind === 'heal') ? 'Charge' : 'Attack';
  }

  /**
   * 这个物种有没有这个动作；没有就按 `want → Attack → Idle` 依次退。
   * 素材里 214 只物种**不是每只都画了 Shoot / Charge**（有的只画了 Idle/Attack/Hurt），
   * 所以这条回退链是必须的 —— 用户也说了「如果没有某些动画就回退到 attack 或者 idle」。
   */
  pickFighterAnim(slug, want) {
    for (const name of [want, 'Attack', 'Idle']) {
      if (name && resolveAnim(slug, name)?.anim === name) return name;
    }
    return 'Idle';
  }

  /**
   * 演一个「一次性的动作」，演完**回到 Idle**。
   *
   * 为什么要专门做这件事（3.1，用户提的）：
   *   · 以前每个动作都是**新建一张画布把 Idle 换掉**，而 `playOnce` 播完是「停在最后一帧」——
   *     于是出完招以后角色就一直僵在那一帧上（用户：「做完动作要回归 idle，而不是卡在动画的最后一帧」）；
   *   · 现在 Idle 那张画布**一直留着**（只是先藏起来），动作画布演完就摘掉、把 Idle 放回来。
   *     既不会再卡帧，也省掉了「每次出招都重造一张 Idle」的开销。
   *
   * @returns {Promise<{name:string, restore:()=>void}>}
   */
  async playFighterAnim(side, want, { fps = 12 } = {}) {
    const slug = side === 'player' ? this.game.data.slug : this.battle.enemy.slug;
    const body = side === 'player' ? this.playerBody : this.enemyBody;
    const idle = side === 'player' ? this.playerIdleAnim : this.enemyIdleAnim;
    const name = this.pickFighterAnim(slug, want);
    const key = side === 'player' ? '_playerOneshot' : '_enemyOneshot';
    const animKey = side === 'player' ? 'playerAnim' : 'enemyAnim';
    const nameKey = side === 'player' ? 'playerAnimName' : 'enemyAnimName';
    const scaleKey = side === 'player' ? 'playerScale' : 'enemyScale';
    const noop = { name, restore: () => {} };
    if (!body) return noop;
    // 上一个动作还没收场（事件挤在一起时会这样）：先让它收掉，别叠出第二张精灵图
    try { this[key]?.__restore?.(); } catch { /* ignore */ }
    try {
      const rowH = (this.rowR?.[side]?.height) ?? 300;
      const base = side === 'player' ? this.playerBaseScale : this.enemyBaseScale;
      const scale = this.fitScale(slug, name, rowH, base);
      const node = await createAnim(slug, {
        anim: name,
        scale,
        fps,
        dir: side === 'player' ? DIR.UP_RIGHT : DIR.DOWN_LEFT,
      });
      /**
       * ⚠ 换动作必须用 replaceWith **把 Idle 换出去**，不能「藏起来 + 另外 append 一张」。
       *
       * `canvas.destroy()` 只停动画、**不摘节点**（见 core/sprites.js 的 destroy），
       * 而 Idle 那张要是留在 DOM 里（哪怕 visibility: hidden），一次动作就会多留一张画布：
       * 出几次招之后屏幕上就是**叠着的两只精灵**（用户报的「行走图也出问题了」就是这个）。
       * 现在的做法：Idle 被换出去时节点仍然活着（引用在 this.*IdleAnim 上），
       * 动作演完再把它 replace 回来 —— 不重建、不残留、布局也不会跳。
       */
      const restore = () => {
        node.destroy?.();
        if (node.parentElement && idle) node.replaceWith(idle);
        else node.remove?.();
        if (this[key] === node) this[key] = null;
        if (idle) {
          this[animKey] = idle;
          this[nameKey] = 'Idle';
        } else {
          this[animKey] = node;
        }
      };
      node.__restore = restore;
      if (idle && idle.parentElement) idle.replaceWith(node);
      else body.append(node);
      node.playOnce(fps);
      this[key] = node;
      this[animKey] = node;
      this[nameKey] = name;
      this[scaleKey] = scale;
      return { name, restore };
    } catch {
      return noop;
    }
  }

  async attackAnim(side, card = null) {
    const body = side === 'player' ? this.playerBody : this.enemyBody;
    body.classList.add(side === 'player' ? 'lunge-player' : 'lunge-enemy');
    // 攻击牌甩一道弧光（朝对手那一侧偏出去），纯变化牌不甩
    const isAttack = !!card?.effects?.some((e) => e.kind === 'damage');
    if (isAttack) {
      const heavy = card.effects.some((e) => e.kind === 'damage' && (e.power ?? 0) >= 8);
      this.burstFx(body, heavy ? 'flare_1' : 'slash_1', {
        size: heavy ? 150 : 120,
        ms: 380,
        rotate: side === 'player' ? -18 : 18,
        klass: side === 'player' ? 'fx-swing-right' : 'fx-swing-left',
      });
    }
    const styleId = 'battle-lunge-style';
    if (!document.getElementById(styleId)) {
      const st = document.createElement('style');
      st.id = styleId;
      st.textContent = `
        .lunge-player { transform: translate(34px, -10px) scale(1.05); transition: transform .18s ease; }
        .lunge-enemy { transform: translate(-34px, 10px) scale(1.05); transition: transform .18s ease; }
      `;
      document.head.append(st);
    }
    // 按卡牌决定动作（远程 → Shoot、自身强化 → Charge、近身 → Attack），演完回 Idle
    const { name, restore } = await this.playFighterAnim(side, this.animForCard(card), { fps: 12 });
    void name;
    await this.wait(PACE.attack / 2);
    body.classList.remove('lunge-player', 'lunge-enemy');
    await this.wait(PACE.attack / 2);
    restore();
  }

  async hitAnim(ev, body, cardEl) {
    const tier = ev.crit ? 'float-crit' : 'float-dmg';
    floatAt(body, `-${ev.amount}${ev.crit ? '!' : ''}`, tier);
    if (ev.absorbed > 0) floatAt(cardEl, t('挡下 {n}', { n: ev.absorbed }), 'float-block', -14);
    audio.hit(Math.min(1, ev.amount / Math.max(1, this.battle.player.maxHp * 0.18)));
    body.classList.add('fighter-hurt');
    // 命中特效：会心一击更大更亮，被护盾挡下时改放一圈蓝光
    if (ev.absorbed > 0 && ev.amount <= 0) {
      this.burstFx(body, 'light_1', { size: 150, ms: 380, klass: 'fx-block' });
    } else {
      this.burstFx(body, ev.crit ? 'flare_1' : 'dirt_1', {
        size: ev.crit ? 150 : 110,
        ms: ev.crit ? 460 : 360,
        klass: ev.crit ? 'fx-impact-crit' : 'fx-impact',
      });
    }
    const slug = ev.side === 'player' ? this.game.data.slug : this.battle.enemy.slug;
    void slug;
    // Hurt 帧通常比 Idle 瘦一些，但仍然按行高算，避免大个子受伤时顶出画面
    void this.fitScale;
    const { restore } = await this.playFighterAnim(ev.side, 'Hurt', { fps: 10 });
    this.refreshSide(ev.side);
    this.pushLogLine(this.logOf(ev));
    setTimeout(() => body.classList.remove('fighter-hurt'), 300);
    await this.wait(ev.crit ? PACE.crit : PACE.damage);
    restore();
  }

  async onBattleEnd(ev) {
    const loser = ev.winner === 'player' ? this.enemyBody : this.playerBody;
    loser.classList.add('fighter-dead');
    if (ev.winner === 'player') {
      audio.down();
      audio.win();
      toast(t('战斗胜利！'), 'good');
    } else {
      audio.lose();
      toast(t('{name} 倒下了……', { name: this.game.data.name }), 'bad');
    }
    this.refreshAll();
    await this.wait(PACE.battleEnd);
  }

  async settle() {
    if (this.settled) return;
    this.settled = true;
    await this.wait(PACE.settle);
    /**
     * ⚠ 这里以前是**自己 import 出 renderReward / renderGameOver 直接画屏**的，
     * 结果是玩家报的那个 bug：「打完 boss 卡在奖励页，点卡会进卡组但界面不关、点跳过也没用」。
     *
     * 原因：直接画屏绕过了 UI 的换屏记账（`ui.current`）。奖励页是"没人认领"的一屏 ——
     * 只要这之前 UI 认为自己在别处（实际发生过：`ui.current === 'map'`），
     * 玩家点「拿卡」时引擎照样把状态推进了（卡进卡组、进下一章），
     * 但紧接着的重画在地图那一支被"已经在地图上了，只刷 HUD"的早退挡掉 ——
     * 屏幕上就一直挂着这张已经作废的奖励页，再点什么都不动了（奖励已经被领走）。
     *
     * ⚠⚠ `finishBattle()` **必须在**：它才是把 phase 从 battle 推到 reward / gameover 的那一步
     * （金币、成长、掉落卡都在里面）。改这里时曾经把它连同画屏一起删掉过一次 ——
     * 后果是**每场战斗打完都停在战场上**（敌人已经 0 血、意图胶囊写着「战斗结束」，
     * 但永远不进奖励页），用户当场就撞上了。画屏可以交给 UI，推进状态不行。
     *
     * ⚠⚠⚠ 整段还包了 try/catch：**结算这一步绝对不能把玩家留在战场上**。
     * 用户后来又报过一次「boss 战又卡住了」，现场就是 0 血的敌人 + 一句「战斗结束」，
     * 手牌和「结束回合」全都点不动（引擎会说「战斗已经结束了」）—— 也就是 settle 里
     * 某一步抛了异常，而 `settled` 已经置位，看门狗也不会再补。
     * 现在出错要①把错误原样记进 `window.__oasisLastError`（下次有人遇到，发这一行就能定位）、
     * ②硬把 phase 推出去（奖励页拿不到就退回地图 —— 我那里的兜底也认这种情况）。
     */
    try {
      this.game.finishBattle();
      // 界面换屏一律交给 UI 按 phase 分发（它自己会记账），这里不再直接画屏
      this.game.changed();
    } catch (err) {
      console.error('[oasis] 战斗结算出错：', err);
      window.__oasisLastError = {
        at: new Date().toISOString(),
        message: String(err?.message ?? err),
        stack: String(err?.stack ?? ''),
        where: 'BattleScreen.settle',
      };
      try {
        const g = this.game;
        if (g.phase === 'battle') g.phase = g.battle?.winner === 'player' ? 'reward' : 'gameover';
        g.changed();
      } catch (err2) {
        console.error('[oasis] 兜底换屏也失败了：', err2);
      }
      toast(t('结算出了点问题，已经把你带到下一屏。'), 'bad');
    }
  }

  destroy() {
    this.destroyed = true;
    if (this.onResize) window.removeEventListener('resize', this.onResize);
    clearTimeout(this._resizeTimer);
    clearInterval(this._watchdog);
    this._watchdog = null;
    try { this._ro?.disconnect(); } catch { /* 忽略 */ }
    this.playerAnim?.destroy?.();
    this.enemyAnim?.destroy?.();
    this.clearTurnIntro();
    this.screen?.remove();
  }
}
