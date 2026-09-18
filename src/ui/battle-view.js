// 战斗界面：把引擎吐出的事件流按顺序演出成动画。

import { el, clear, sleep, floatAt, toast } from './dom.js';
import { cardEl } from './cards.js';
import { initTips } from './tips.js';
import { createAnim, createStill, animInfo, DIR } from '../core/sprites.js';
import { createPortrait, setPortraitEmotion, emotionForEvent } from '../core/portraits.js';
import { audio } from '../core/audio.js';
import { STATUS_INFO, computeHit } from '../core/battle.js';
import { CARD_BY_ID } from '../data/cards.js';
// 演出速度相关的选项/读取放在 balance.js 里，设置弹窗也直接用它
import { BIOMES, speedMulOf, loadBattleSpeed } from '../data/balance.js';
import { TIERS } from '../data/enemies.js';

const TIER_LABEL = { mob: '野生', normal: '较强', elite: '精英', boss: '首领' };

/**
 * 状态胶囊的图标。以前胶囊上只有一个纯色小圆点，「中毒/灼伤/虚弱/流血」全靠读文字区分；
 * 现在换成各自的图标（颜色仍然用 STATUS_INFO 的主题色，mask + currentColor 染色）。
 */
const STATUS_ICO = {
  poison: 'ico-poison',
  burn: 'ico-flame',
  weak: 'ico-temperature_down',
  bleed: 'ico-heart_break_02',
};

/** 战斗面板属性行的图标：和顶部 HUD 的 chip 用同一套语义（剑/盾/鞋/三叶草） */
const STAT_ICO = { 攻: 'ico-sword', 防: 'ico-shield', 速: 'ico-shoe', 运: 'ico-clover' };

/**
 * 战斗演出的节奏表（毫秒）。想整体调快调慢就乘以用户的倍率，
 * 不要再去每个分支里手改数字——之前就是为了「看着不拖沓」把数字砍了一半，
 * 结果快到看不清对手出了什么牌。
 */
const PACE = {
  battleStart: 340,
  turnStart: 280,
  /** 回合切换的光带横扫（和 turnStart 一起构成过场；够慢才看得清回合数） */
  turnSweep: 1250,
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
    toast('演出卡了一下，已经自动恢复。', 'bad');
  }

  /**
   * 「这张牌为什么打不出去」——点灰卡片时给一句话，而不是默默吞掉点击。
   * 以前灰卡片的点击是直接 return 的，玩家看到的就是「点了没反应、出不了牌」。
   */
  cantPlayReason(entry) {
    const b = this.battle;
    const cost = b.cardCost(entry);
    if (b.over) return '战斗已经结束了。';
    if (this.busy || b.active !== 'player') return '对手正在行动，稍等一下。';
    if ((b.player.playsLeft ?? 0) <= 0) return `本回合出牌次数用完了（${b.player.playMax} 张）——按「结束回合」进入下一回合。`;
    if (cost > b.player.ap) return `AP 不够：这张「${entry.card.name}」要 ${cost} 点，你现在还有 ${b.player.ap} 点。`;
    return '现在打不出这张牌。';
  }

  /** 把一侧的当前数值抄成「界面自己的副本」，动画期间只用这份副本 */
  captureDisp(key) {
    const s = this.battle[key];
    this.disp[key] = {
      hp: s.hp, maxHp: s.maxHp, shield: s.shield,
      ap: s.ap, apMax: s.apMax, playsLeft: s.playsLeft ?? 0, playMax: s.playMax ?? 0,
      atkMod: s.atkMod ?? 0, defMod: s.defMod ?? 0, agiMod: s.agiMod ?? 0, luckMod: s.luckMod ?? 0,
      poison: s.poison ?? 0, burn: s.burn ?? 0, weak: s.weak ?? 0, bleed: s.bleed ?? 0,
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

    this.enemyCard = el('div', { class: 'fighter-card' }, [
      el('div', { class: 'fighter-head' }, [
        this.enemyFace,
        el('div', { class: 'fighter-info' }, [
          el('div', { class: 'fighter-name' }, [
            el('span', { text: b.enemy.name }),
            el('span', { class: `tier tier-${b.enemy.tier}`, text: TIER_LABEL[b.enemy.tier] ?? '' }),
          ]),
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
            el('span', { class: 'tier', text: '♀ 沙漠蜻蜓' }),
          ]),
          el('div', { class: 'fighter-types', text: '地面 / 龙 · 特性：飘浮' }),
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
    this.turnBadge = el('div', { class: 'turn-badge' }, [el('span', { class: 'ico-clock' }), el('span', { text: '第 1 回合' })]);
    this.intentEl = el('div', { class: 'intent' }, [el('span', { class: 'ico-sword' }), el('span', { text: '正在观察……' })]);

    // ---- 战斗日志 ----
    this.logEl = el('div', { class: 'battle-log' });

    // ---- 底部：AP / 手牌 ----
    this.apOrbs = el('div', { class: 'ap-orbs' });
    // AP 的图标就是注册表里的 action_points（纯文本「AP」），所以文字里不再重复写一遍
    this.apIco = el('span', { class: 'ap-ico ico-action_points' });
    this.apText = el('div', { class: 'ap-text', text: '3 / 3' });
    this.pileInfo = el('div', { class: 'pile-info' });
    this.handEl = el('div', { class: 'hand' });
    this.endTurnBtn = el('button', {
      class: 'btn btn-primary btn-lg',
      onClick: () => this.onEndTurn(),
    }, [el('span', { class: 'ico-check' }), el('span', { text: '结束回合' })]);

    this.battleBar = el('div', { class: 'battle-bar' }, [
      el('div', { class: 'ap-display' }, [this.apOrbs, this.apIco, this.apText]),
      this.pileInfo,
      this.endTurnBtn,
    ]);

    this.battleBottom = el('div', { class: 'battle-bottom' }, [this.battleBar, this.handEl]);

    this.weather = el('div', { class: 'weather' });
    for (let i = 0; i < 40; i++) {
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

    this.field = el('div', { class: 'battle-field' }, [
      this.weather,
      this.enemyFighter,
      el('div', { class: 'battle-middle' }, [this.turnBadge, this.intentEl]),
      this.playerFighter,
      this.logEl,
    ]);

    this.screen.append(this.field, this.battleBottom);
    this.host.append(this.screen);

    // 先量一次场地（精灵缩放与出牌区位置都靠它），窗口变化时再量
    this.layoutBattle();
    this.onResize = () => {
      clearTimeout(this._resizeTimer);
      this._resizeTimer = setTimeout(() => {
        this.layoutBattle();
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
      this.enemyBody.append(this.enemyAnim);
    } catch (err) {
      this.enemyBody.append(el('div', { class: 'card-art', style: { width: '96px', height: '96px' } }));
    }
    try {
      // 玩家在左下，朝右上（UP_RIGHT）看向敌人
      const scale = this.fitScale(this.game.data.slug, 'Idle', rowH.player.height, this.playerBaseScale);
      this.playerScale = scale;
      this.playerAnim = await createAnim(this.game.data.slug, { anim: 'Idle', scale, fps: 8, dir: DIR.UP_RIGHT });
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
      shieldEl.dataset.tip = `护盾 ${shieldVal}：先替你吃伤害，吃光之后剩下的才掉血。\n持有者自己的回合开始时清空，所以它是「撑过这一轮」的资源。`;
      clear(shieldEl).append(el('span', { class: 'ico-shield_02', style: { width: '13px', height: '13px' } }), el('span', { text: String(shieldVal) }));
    } else {
      shieldEl.classList.add('hidden');
      delete shieldEl.dataset.tip;
    }

    // 状态胶囊必须读**演出副本**：引擎在 endTurn() 里就把整个敌方回合算完了，
    // 直接读 s[st] 会让「虚弱/中毒」在对手的招还没演到身上时就先冒出来。
    // （血量/护盾早就走 disp 了，状态这块当初漏了 —— 和当年那个「血条不动」是同一类 bug。）
    const dd = this.disp[key] ?? {};
    clear(statusEl);
    for (const st of ['poison', 'burn', 'weak', 'bleed']) {
      const val = dd[st] ?? 0;
      if (val > 0) {
        const info = STATUS_INFO[st];
        statusEl.append(el('span', {
          class: 'status-chip',
          // 悬停说明：说清它做什么、还剩几层、怎么解（自定义浮层，不用原生 title）
          dataset: { tip: `${info.name} ${val} 层\n${info.desc}\n解法：「白雾」「焕然一新」这类解状态牌可以直接清掉。` },
          style: { boxShadow: `inset 0 0 0 1px ${info.color}66` },
        }, [
          el('span', { class: `status-ico ${STATUS_ICO[st] ?? 'ico-warn'}`, style: { backgroundColor: info.color } }),
          el('span', { text: `${info.name} ${val}` }),
        ]));
      }
    }

    clear(statsEl);
    const rows = isPlayer
      ? [
          ['攻', b.player.atk + (dd?.atkMod ?? 0), b.player.atk],
          ['防', b.player.def + (dd?.defMod ?? 0), b.player.def],
          ['速', b.player.agi + (dd?.agiMod ?? 0), b.player.agi],
          ['运', (b.player.luck ?? 0) + (dd?.luckMod ?? 0), b.player.luck ?? 0],
        ]
      : [
          ['攻', b.enemy.atk + (dd?.atkMod ?? 0), b.enemy.atk],
          ['防', b.enemy.def + (dd?.defMod ?? 0), b.enemy.def],
          ['速', b.enemy.agi + (dd?.agiMod ?? 0), b.enemy.agi],
        ];
    const STAT_TIP = {
      攻: '攻击：决定你能打出多少伤害。\n实际伤害 =（攻击 + 招式威力）× 60/(60+对手防御)。',
      防: '防御：越高越抗打。\n受到的伤害会乘以 60/(60+防御)，所以防御是「减伤百分比」而不是直接扣血。',
      速: '敏捷：每回合的行动点、抽牌数、出牌上限都看它。',
      运: '幸运：暴击率与闪避率。',
    };
    for (const [label, val, base] of rows) {
      const diff = val - base;
      statsEl.append(el('span', {
        dataset: { tip: `${STAT_TIP[label] ?? ''}${diff < 0 ? `\n当前被削弱了 ${-diff} 点。` : ''}` },
      }, [
        el('span', { class: STAT_ICO[label] ?? 'ico-star', style: { width: '11px', height: '11px' } }),
        el('span', { text: label }),
        el('b', { class: diff > 0 ? 'up' : diff < 0 ? 'down' : '', text: String(val) }),
      ]));
    }

    // 顶部 HUD 也跟着一起刷：只在整个回合演完时刷的话，
    // 演出途中「角色卡上的血条已经掉了、顶部的还满着」，看着像没掉血。
    if (isPlayer) this.syncHud();
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
   * 回合切换特效：一条斜切的光带横扫过屏幕，带出「第 N 回合 / 你的行动（对手行动）」。
   * 回合切换以前只是角标数字变了，打快了根本注意不到自己已经进入下一回合。
   */
  async turnSweep(ev) {
    if (ev.side !== 'player' && ev.side !== 'enemy') return;
    const band = el('div', { class: `turn-sweep sweep-${ev.side}` }, [
      el('div', { class: 'turn-sweep-glow' }),
      el('div', { class: 'turn-sweep-text', text: `第 ${ev.turn} 回合` }),
      el('div', { class: 'turn-sweep-sub', text: ev.side === 'player' ? '你的行动' : '对手行动' }),
    ]);
    // 动画时长跟着「演出速度」缩放（CSS 写死的话，快/慢档会和这里的等待脱节：
    // 快档下光带还没走完就被移除，慢档下又会僵在屏幕中间）
    const ms = Math.max(400, Math.round(PACE.turnSweep * this.speedMul));
    band.style.setProperty('--sweep-ms', `${ms}ms`);
    document.body.append(band);
    await this.wait(PACE.turnSweep);
    band.remove();
  }

  refreshTurn() {
    this.initTips();
    const b = this.battle;
    this.turnBadge.querySelector('span:last-child').textContent =
      `第 ${this.dispTurn} 回合 · ${this.dispActive === 'player' ? '你的行动' : '对手行动'}`;
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
    this.apOrbs.dataset.tip = `行动点 ${dp.ap}/${max}：打出卡牌要花行动点。\n回合开始时回满，敏捷越高每回合越多。`;
    this._shownAp = dp.ap;
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
      mk('牌堆：还没抽到的牌。抽完会把弃牌堆洗回来。', [el('span', { class: 'ico-cards', style: { width: '13px', height: '13px' } }), ' 卡组 ', el('b', { text: String(d.draw.length) })]),
      mk('弃牌：这回合用掉、或回合结束没打出的牌。牌堆抽空时会重新洗进牌堆。', ['弃牌 ', el('b', { text: String(d.discard.length) })]),
      mk('销毁：带「使用后销毁」的牌打完就进这里，本场战斗不会再出现。', ['销毁 ', el('b', { text: String(d.exhaust.length) })]),
      mk('手牌：当前能打出的牌。上限由敏捷决定，超出的会直接进弃牌。', ['手牌 ', el('b', { text: `${d.hand.length}/${this.battle.player.handMax}` })]),
    );
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
    // 悬停说明：这个胶囊到底在算什么（很多人第一眼会当成「他一定会打我这么多」）
    this.intentEl.dataset.tip = '对手下回合**最坏情况**能打出的伤害上界（拿它整副牌 + 下回合的行动点模拟出来的）。\n真抽到什么牌仍然随机，所以文案写「最多约」，不是断言。';
    if (b.over) {
      this.intentEl.className = 'intent calm';
      clear(this.intentEl).append(el('span', { class: 'ico-dice' }), el('span', { text: '战斗结束' }));
      return;
    }
    if (this.dispActive !== 'player') {
      this.intentEl.className = 'intent calm';
      clear(this.intentEl).append(el('span', { class: 'ico-dice' }), el('span', { text: '对手正在行动……' }));
      return;
    }

    const t = b.predictEnemyThreat();
    const hpNow = this.dispHp?.player ?? b.player.hp;
    const pct = t.damage / Math.max(1, hpNow);
    clear(this.intentEl);
    if (t.damage <= 0) {
      this.intentEl.className = 'intent calm';
      this.intentEl.append(
        el('span', { class: 'ico-shield' }),
        el('span', { text: '下回合对手以变化招式为主' }),
      );
      return;
    }
    // 伤害已经够打死自己了，就把这个胶囊标成警告色
    const deadly = t.damage >= hpNow;
    this.intentEl.className = `intent${deadly ? ' danger' : pct >= 0.3 ? ' warn' : ''}`;
    this.intentEl.title = '按对手整副牌 + 它下回合的行动点/出牌数估算的上界；它实际抽到什么牌是随机的。';
    this.intentEl.append(
      el('span', { class: deadly ? 'ico-skull' : 'ico-sword' }),
      el('span', {
        text: deadly
          ? `危险：下回合最多 ${t.damage} 伤害，会被打倒`
          : `下回合最多约 ${t.damage} 伤害${t.topName ? `（最狠：${t.topName}）` : ''}`,
      }),
    );
  }

  renderHand() {
    const b = this.battle;
    const hand = b.hand('player');
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
      this.handEl.append(el('div', { class: 'hand-empty', text: '手牌空了，结束回合让沙暴把卡牌送回来。' }));
      return;
    }
    let freshIndex = 0;
    for (const entry of hand) {
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
    if (this.busy) return;
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
    if (this.busy || this.battle.over) return;
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

  async playEvent(ev) {
    // 看门狗的心跳：每推进一步就记一次时间，卡住时才看得出来（见 startWatchdog）
    this._eventAt = Date.now();
    // 先把「界面副本」推进到这条事件之后的状态，再演动画
    this.applyEventToDisp(ev);
    // 大部分事件都可以顺手给对应角色换个表情
    if (ev.side && ['damage', 'trueDamage', 'heal', 'shield', 'buff', 'status', 'dodge', 'playCard'].includes(ev.type)) {
      this.reactFace(ev.side, emotionForEvent(ev.type, ev.side));
    }
    switch (ev.type) {
      case 'battleStart':
        this.refreshAll();
        // 「遭遇 XX！」这行也要进日志，否则开场日志框是空的（一进来像是没有战斗信息）
        this.pushLogLine(this.logOf(ev));
        await this.wait(PACE.battleStart);
        break;
      case 'turnStart':
        this.refreshTurn();
        this.refreshSide(ev.side);
        await this.turnSweep(ev);
        this.refreshSide(ev.side === 'player' ? 'enemy' : 'player');
        // 意图胶囊也要跟着换（之前漏了这一句，敌方回合里还挂着玩家回合的文案）
        this.refreshIntent();
        await this.wait(PACE.turnStart);
        break;
      case 'turnEnd':
        await this.wait(PACE.turnEnd);
        break;
      case 'draw':
        if (ev.side === 'player') audio.cardDraw();
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
        floatAt(body, `+${ev.amount} 护盾`, 'float-shield');
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
        if (ev.status === 'poison') audio.poison();
        else if (ev.status === 'burn') audio.burn();
        else if (ev.status === 'weak') audio.dizzy();
        const body = ev.side === 'player' ? this.playerBody : this.enemyBody;
        // 中毒=绿雾、灼伤=火光、虚弱=紫旋、出血=红痕
        const STATUS_FX = { poison: 'magic_1', burn: 'flare_1', weak: 'twirl_1', bleed: 'slash_1' };
        this.burstFx(body, STATUS_FX[ev.status] ?? 'magic_1', {
          size: 124, ms: 520, klass: `fx-status fx-status-${ev.status}`,
        });
        this.refreshSide(ev.side);
        this.pushLogLine(this.logOf(ev));
        await this.wait(PACE.status);
        break;
      }
      case 'buff': {
        this.refreshSide(ev.side);
        const body = ev.side === 'player' ? this.playerBody : this.enemyBody;
        // amount 是**实际变化量**（引擎已经把下降下限算进去了）。为 0 就是「已到下限、没变化」：
        // 这时候不该再放削弱音效和特效（以前会照放，看起来像附加成功了但数值没动）。
        if (ev.amount === 0 && body) {
          floatAt(body, '已到下限', 'float-miss');
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
        floatAt(body, '闪避！', 'float-miss');
        audio.miss();
        this.pushLogLine(this.logOf(ev));
        await this.wait(PACE.dodge);
        break;
      }
      case 'resist':
        // 说清「抵抗了什么」：光两个字「抵抗」没人看得懂（岩崩的虚弱是有概率的）
        floatAt(ev.side === 'player' ? this.playerBody : this.enemyBody,
          `抵抗${STATUS_INFO[ev.status]?.name ?? ''}`, 'float-miss');
        audio.miss();
        this.pushLogLine(this.logOf(ev));
        await this.wait(PACE.resist);
        break;
      case 'discard':
      case 'toBottom':
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
        this.refreshTurn();
        await this.wait(PACE.gainAp);
        break;
      case 'battleEnd':
        await this.onBattleEnd(ev);
        break;
      default:
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
      atk: { fx: 'flare_1', tone: 'screen', text: '攻' },
      def: { fx: 'trace_1', tone: 'screen', text: '防' },
      agi: { fx: 'twirl_1', tone: 'screen', text: '速' },
      luck: { fx: 'star_1', tone: 'screen', text: '运' },
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
      el('div', { class: 'played-label', text: side === 'enemy' ? '对手使用了' : '你使用了' }),
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
  async attackAnim(side, card = null) {
    const body = side === 'player' ? this.playerBody : this.enemyBody;
    const anim = side === 'player' ? this.playerAnim : this.enemyAnim;
    const slug = side === 'player' ? this.game.data.slug : this.battle.enemy.slug;
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
    // 换成 Attack 帧动画（保持同一个朝向，别在出招时突然转身）
    try {
      const rowH = (this.rowR?.[side]?.height) ?? 300;
      const base = side === 'player' ? this.playerBaseScale : this.enemyBaseScale;
      const scale = this.fitScale(slug, 'Attack', rowH, base);
      const atk = await createAnim(slug, {
        anim: 'Attack',
        scale,
        fps: 12,
        dir: side === 'player' ? DIR.UP_RIGHT : DIR.DOWN_LEFT,
      });
      if (anim && anim.parentElement) anim.replaceWith(atk);
      else body.append(atk);
      atk.playOnce(14);
      if (side === 'player') { this.playerAnim?.destroy?.(); this.playerAnim = atk; this.playerAnimName = 'Attack'; this.playerScale = scale; }
      else { this.enemyAnim?.destroy?.(); this.enemyAnim = atk; this.enemyAnimName = 'Attack'; this.enemyScale = scale; }
    } catch { /* 没有 Attack 动画就只做位移 */ }
    await this.wait(PACE.attack / 2);
    body.classList.remove('lunge-player', 'lunge-enemy');
    await this.wait(PACE.attack / 2);
  }

  async hitAnim(ev, body, cardEl) {
    const tier = ev.crit ? 'float-crit' : 'float-dmg';
    floatAt(body, `-${ev.amount}${ev.crit ? '!' : ''}`, tier);
    if (ev.absorbed > 0) floatAt(cardEl, `挡下 ${ev.absorbed}`, 'float-block', -14);
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
    const cur = ev.side === 'player' ? this.playerAnim : this.enemyAnim;
    // Hurt 帧通常比 Idle 瘦一些，但仍然按行高算，避免大个子受伤时顶出画面
    const rowH = (this.rowR?.[ev.side]?.height) ?? 300;
    const base = ev.side === 'player' ? this.playerBaseScale : this.enemyBaseScale;
    const scale = this.fitScale(slug, 'Hurt', rowH, base);
    try {
      const hurt = await createAnim(slug, {
        anim: 'Hurt', scale, fps: 10,
        dir: ev.side === 'player' ? DIR.UP_RIGHT : DIR.DOWN_LEFT,
      });
      if (cur && cur.parentElement) cur.replaceWith(hurt);
      hurt.playOnce(10);
      if (ev.side === 'player') { this.playerAnim?.destroy?.(); this.playerAnim = hurt; this.playerAnimName = 'Hurt'; this.playerScale = scale; }
      else { this.enemyAnim?.destroy?.(); this.enemyAnim = hurt; this.enemyAnimName = 'Hurt'; this.enemyScale = scale; }
    } catch { /* 忽略 */ }
    this.refreshSide(ev.side);
    this.pushLogLine(this.logOf(ev));
    setTimeout(() => body.classList.remove('fighter-hurt'), 300);
    await this.wait(ev.crit ? PACE.crit : PACE.damage);
  }

  async onBattleEnd(ev) {
    const loser = ev.winner === 'player' ? this.enemyBody : this.playerBody;
    loser.classList.add('fighter-dead');
    if (ev.winner === 'player') {
      audio.down();
      audio.win();
      toast('战斗胜利！', 'good');
    } else {
      audio.lose();
      toast(`${this.game.data.name} 倒下了……`, 'bad');
    }
    this.refreshAll();
    await this.wait(PACE.battleEnd);
  }

  async settle() {
    if (this.settled) return;
    this.settled = true;
    await this.wait(PACE.settle);
    this.game.finishBattle();
    if (this.game.phase === 'reward') {
      const { renderReward } = await import('./screens.js');
      renderReward(this.game);
    } else {
      const { renderGameOver } = await import('./screens.js');
      renderGameOver(this.game);
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
    this.screen?.remove();
  }
}
