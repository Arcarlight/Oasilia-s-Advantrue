// 战斗引擎：纯逻辑 + 事件流。
// 引擎不碰 DOM，只把发生的事写进 state.events，UI 负责按顺序演出这些事件。
//
// 核心规则（用户需求）：
//   · AP 每回合回复到「由敏捷决定」的固定值
//   · 攻击方 ATK + 卡牌威力，减去防守方 DF 的减伤后造成伤害
//   · 每回合双方抽卡；卡牌使用后进**弃牌堆**（标着销毁的进销毁堆）
//   · 牌堆抽空、还要再抽时，才把弃牌堆洗回牌堆（每回合抽牌/手牌上限都由敏捷决定）
//   · 敏捷越高，每回合抽卡越多、手牌上限越大
//   · 战斗结束后玩家 HP 保留（由外部 state 处理）

import { BALANCE, apFromAgi, drawFromAgi, handFromAgi, playsFromAgi, critChance, dodgeChance } from '../data/balance.js';
import { CARD_BY_ID } from '../data/cards.js';
import { makeRng } from './rng.js';
// 日志文本也是给玩家看的，所以引擎里每一句模板都走 t()（见 src/core/i18n.js 顶部的说明）
import { t } from './i18n.js';
import { STAT_NAMES } from './ui-words.js';

export const STATUS_INFO = {
  poison: {
    name: '中毒',
    art: 'flask_half',
    color: '#a86ce0',
    desc: '回合开始流失「最大生命的 0.8% × 层数」，然后层数 -1。目标是血越厚掉得越多。',
  },
  toxic: {
    name: '剧毒',
    art: 'flask_full',
    color: '#7a3fd0',
    desc: '回合开始流失「最大生命的 0.6% × 层数」，然后层数 **+1**（不衰减，越拖越痛）。',
  },
  burn: {
    name: '灼伤',
    art: 'flare_1',
    color: '#ff8a3c',
    desc: '回合开始流失「最大生命的 0.4% × 层数」，层数不减 —— 挂上去就一直烧。',
  },
  weak: { name: '虚弱', art: 'smoke_1', color: '#8f8f8f', desc: '攻击力下降 25%。' },
  bleed: {
    name: '出血',
    art: 'slash_1',
    color: '#e35b5b',
    desc: '每次受到攻击额外流失「最大生命的 0.5% × 层数」——打得越多掉得越多。',
  },
};

/** 会随时间流失生命的状态（其余是标记类） */
export const DOT_STATUSES = ['poison', 'toxic', 'burn'];
/** 全部负面状态（净化 / 白雾要清的名单） */
export const ALL_STATUSES = ['poison', 'toxic', 'burn', 'weak', 'bleed'];

/**
 * **我方强化（buff）**：带持续回合的正面效果 —— 和中毒 / 灼伤那些负面状态是同一层东西，
 * 只是一侧是坏的、一侧是好的。用户的原话：
 *   「为我方添加强化效果（例如增大 AP 上限、同种卡打出多次效果（包括伤害、
 *     叠加异常层数）翻倍等强化，这个目前没有任何我方强化效果）」
 *
 * 规则（都在这一份表里说了算）：
 *   · 每个强化有**层数 n** 和**剩余回合 turns**，挂上时同类取「更强的 n、更长的回合」；
 *   · 在**那一方自己回合开始时**倒计时，到 0 就消失（有日志）；
 *   · 显示成玩家卡旁边的一排胶囊（和大招 / 状态胶囊一样），悬停有说明。
 *
 * 目前四个：
 *   apMax   行动点上限 +n（每回合真的多 n 点，不是「只多这一次」）
 *   echo    回响：再次打出**同一张牌**时，它的伤害与状态层数 ×(1 + n)
 *   power   攻击牌威力 +n%（buff 版的力量：会到期，但可以和小牌一起早期拿到）
 *   stacks  附加状态层数 +n（毒 / 出血流铺得更快）
 */
export const BUFF_INFO = {
  apMax: {
    name: '行动点上限',
    ico: 'ico-action_points',
    color: '#8fd4ff',
    desc: '每回合的行动点上限 +{n} —— 一个回合能做的事真的变多了。',
  },
  echo: {
    name: '回响',
    ico: 'ico-refresh',
    color: '#ffd27a',
    desc: '再次打出同一张牌时，它的伤害与附加状态层数 ×{mul} —— 打法变成「把一张牌反复打」。',
  },
  power: {
    name: '威力提升',
    ico: 'ico-sword',
    color: '#ff9f8a',
    desc: '攻击牌威力 +{n}%（和「力量」叠加，只是它会到期）。',
  },
  stacks: {
    name: '附加层数',
    ico: 'ico-poison',
    color: '#c9a3ff',
    desc: '给对手附加状态时，层数 +{n} —— 铺毒 / 出血更快。',
  },
};
export const BUFF_KEYS = Object.keys(BUFF_INFO);


/**
 * 一层持续伤害值 = 目标最大生命 × 百分比 + 1。
 * 「+1」是为了让前期（血量两三百）的毒依然有存在感，不至于取整成 0。
 */
export function dotTickDamage(side, stacks, pct, mul = 1) {
  if (!stacks || !pct) return 0;
  const base = Math.max(0, Math.round((side.maxHp * pct + 1) * stacks));
  // `mul` 由调用方给：持有效果「持续伤害 +X%」算在**施加者**头上（打人的人加强，不是挨打的人）
  return Math.max(0, Math.round(base * mul));
}

// ================= 手持道具的系数（用户要的「手持道具」机制） =================
//
// 这一节是**道具与战斗的唯一接口**：道具的持有效果在 game.js 里被汇总成一张表
// （sumHeldMods），开局时挂在 `side.mods` 上（只有玩家那一侧有），战斗里所有地方
// 都通过下面这三个小函数去读 —— 想加一个新的持有效果，就在这里读它 + 在对应的
// 计算点调一次，别的地方不用动。
//
// 为什么要收成三个函数：持有效果散在十几处计算里，直接写 `side.mods?.xxx?.add ?? 0`
// 会出现「有的地方忘了判空、有的地方把 mul 和 add 搞混」这类错，而且很难查
// （效果静默不生效，界面上看不出任何异常）。
function modAdd(side, key) {
  const v = side?.mods?.[key];
  if (!v) return 0;
  if (typeof v.add === 'number' && v.add) return v.add;
  if (typeof v.mul === 'number' && v.mul !== 1) return v.mul - 1;
  return 0;
}
function modMul(side, key) {
  return side?.mods?.[key]?.mul ?? 1;
}
function modFlag(side, key) {
  return !!side?.mods?.[key]?.flag;
}

function cloneSide(base) {
  return {
    ...base,
    hp: base.maxHp,
    shield: 0,
    atkMod: 0,
    defMod: 0,
    agiMod: 0,
    luckMod: 0,
    poison: 0,
    toxic: 0,
    burn: 0,
    weak: 0,
    bleed: 0,
    ap: 0,
    apMax: 0,
    /** 「行动点上限 +N」的强化值（recalcDerived 会把它加回 apMax，见 grantBuff） */
    apMaxBonus: 0,
    /** 我方强化（BUFF_INFO）：{ key: { n, turns } } */
    buffs: {},
    /** 预约生效的效果（「下回合开始…」）：[{ turns, effects }] */
    pending: [],
    /** 「再打出 N 张牌 / 再过 N 个回合后生效」：[{ on, count, left, effects, name, seq }] */
    triggers: [],
    /**
     * 这一方**打过几张牌**（从 1 开始）。预约（triggers）记着自己是在第几张牌上创建的，
     * 于是「再打出 N 张牌」不会把创建它的那一张算进去（见 fireTimers）。
     */
    playSeq: 0,
    /** 本场战斗里每种牌打过几张（回响用它判断「同一张牌」） */
    playedIds: {},
    drawN: 0,
    handMax: 0,
    blockBonus: 0,
  };
}

export function effectiveAtk(side) {
  const base = Math.max(0, (side.atk ?? 0) + (side.atkMod ?? 0) + modAdd(side, 'atk'));
  return Math.max(0, Math.round((side.weak ?? 0) > 0 ? base * 0.75 : base));
}
export function effectiveDef(side) {
  return Math.max(0, Math.round((side.def ?? 0) + (side.defMod ?? 0) + modAdd(side, 'def')));
}
export function effectiveAgi(side) {
  return Math.max(1, Math.round((side.agi ?? 1) + (side.agiMod ?? 0) + modAdd(side, 'agi')));
}
export function effectiveLuck(side) {
  return Math.max(0, Math.round((side.luck ?? 0) + (side.luckMod ?? 0) + modAdd(side, 'luck')));
}

/**
 * 削弱下限：属性的下降最多到「基础值的 debuffFloorPct」（按项配置，默认一半）。
 * 每次应用 buff 后（recalcDerived）与读取数值时都会走一遍，
 * 保证不管历史数据怎么写，防御都不会被压成负数（0 防御＝减伤公式形同虚设）。
 * 敏捷单独有一个更浅的下限，因为它一个人管着 AP / 抽牌 / 出牌上限三件事。
 */
/** 某一项属性的削弱下限比例（读配置；配置既可以是数字也可以是按项的对象） */
export function debuffFloor(stat) {
  const cfg = BALANCE.debuffFloorPct ?? 0.5;
  return typeof cfg === 'number' ? cfg : (cfg[stat] ?? 0.5);
}

export function clampDebuffs(s) {
  const clampOne = (stat, base, mod) => Math.max(-Math.max(0, Math.round((base ?? 0) * (1 - debuffFloor(stat)))), mod ?? 0);
  s.atkMod = clampOne('atk', s.atk, s.atkMod);
  s.defMod = clampOne('def', s.def, s.defMod);
  s.agiMod = clampOne('agi', s.agi, s.agiMod);
  s.luckMod = clampOne('luck', s.luck, s.luckMod);
  return s;
}

/**
 * 一条伤害效果在**当前场面**下的实际威力。
 *
 * 卡牌的 power 是基础值，另外几种条件会临时加上去：
 *   execThreshold  斩杀：目标血量低于阈值时加成（稀有攻击牌的收尾手段）
 *   bonusPerStack  随目标身上的某一状态层数加成（出血流 / 毒流的「越叠越疼」）
 *   bonusIfDot     目标身上只要有持续伤害就加成
 *   plusShield     把**自己的护盾**折算成威力（坦克流的输出方式）
 * 引擎算伤害、AI 打分、界面预估三处都调它 —— 以前这三处各写一份，
 * 加了新机制就会漏掉一两处（AI 会看不见新牌的价值，界面上数字对不上）。
 */
export function damagePowerOf(attacker, defender, eff, powerMul = 1) {
  let power = eff.power;  if (eff.execThreshold != null && defender.hp / defender.maxHp < eff.execThreshold) {
    power += eff.execBonus ?? 0;
  }
  if (eff.bonusPerStack) {
    const list = Array.isArray(eff.bonusPerStack.status) ? eff.bonusPerStack.status : [eff.bonusPerStack.status];
    const stacks = list.reduce((n, s) => n + (defender[s] ?? 0), 0);
    power += Math.min(eff.bonusPerStack.max ?? 9999, stacks * (eff.bonusPerStack.per ?? 0));
  }
  if (eff.bonusIfDot && ['poison', 'toxic', 'burn'].some((s) => (defender[s] ?? 0) > 0)) {
    power += eff.bonusIfDot;
  }
  /**
   * 削弱流的收尾：**对手每损失 1 点防御，威力 +powerPerDefLost%**。
   *
   * 「伤害 + 削弱属性」这类牌以前最大的问题是**削弱的价值会随时间归零**（用户原话：
   * 「现在的设计会导致削弱卡到后面变得价值不高」）—— 因为对手的防御有下限（半价），
   * 削到底之后再削就是浪费。加上这一条之后，「先削、再补一刀」变成一条真正的终结路线。
   */
  if (eff.powerPerDefLost) {
    const lost = Math.max(0, (defender.def ?? 0) - effectiveDef(defender));
    power += lost * eff.powerPerDefLost;
  }
  if (eff.plusShield) {    // 「每 1 点护盾折算成 plusShield 点威力百分比」。
    // 曾经写成 round(护盾 / 攻击 × 100 × plusShield) —— 想让「护盾转伤害」跟攻击力脱钩，
    // 结果反过来了：攻击力**越低**、同样一层护盾折出来的威力越高。
    // 实测一个攻击力 3、叠了一身盾的首领能靠一张「重磅冲撞」打出 40+ 伤害，
    // 直接把推导工具的打桩测量污染成「攻击力 3 也能秒人」。现在不做除法，只做乘法。
    power += Math.min(eff.maxShieldBonus ?? 240, Math.round((attacker.shield ?? 0) * eff.plusShield));
  }
  /**
   * 手持道具的攻击加成（只有玩家那一侧挂了 mods）：
   *   attackPct       攻击牌威力 +X%（每件叠加，见 sumHeldMods）
   *   firstAttackPct  本回合**第一张**攻击牌额外 +X%（先制之爪 / 电气种子）
   * 取整放在最后：先加再乘，免得小数值被四舍五入吃掉。
   */
  const bonus = modAdd(attacker, 'attackPct') + (attacker.firstAttackPending ? modAdd(attacker, 'firstAttackPct') : 0);
  if (bonus) power = Math.round(power * (1 + bonus));
  /** 回响（同种卡重复打出）：乘在最后，和道具加成之后 */
  if (powerMul && powerMul !== 1) power = Math.round(power * powerMul);
  return power;
}

  /** 单次命中的伤害计算（opts.attackMul 用于敌方输出修正） */
export function computeHit(attacker, defender, power, opts = {}) {
  const { ignoreDefPct = 0, critMult = BALANCE.luckCritMult, isCrit = false, attackMul = 1 } = opts;
  const effAtk = effectiveAtk(attacker) * attackMul;
  // 威力是「攻击力的百分比」：power + strength 就是这一下打出的攻击力倍数（100 = 一倍攻击）。
  // 必须先取整再算减伤，否则小数值的攻击力会被四舍五入吃掉。
  const raw = Math.round((effAtk * (power + (attacker.strength ?? 0))) / 100);
  const def = effectiveDef(defender) * (1 - ignoreDefPct);
  let dmg = Math.round((raw * BALANCE.armorK) / (BALANCE.armorK + def));
  if (isCrit) dmg = Math.round(dmg * critMult);
  // 出血每击一次额外掉血；「持续伤害 +X%」按施加者（attacker）算
  dmg += dotTickDamage(defender, defender.bleed ?? 0, BALANCE.statusPct?.bleed ?? 0, 1 + modAdd(attacker, 'dotPct'));
  // 手持道具的减伤（只有玩家那一侧有 mods）
  const taken = modAdd(defender, 'damageTakenPct');
  if (taken) dmg = Math.round(dmg * (1 + taken));
  return Math.max(BALANCE.minDamage, dmg);
}

export class Battle {
  /**
   * @param {object} cfg
   * @param {object} cfg.player  {name, slug, hp, maxHp, atk, def, agi, luck}
   * @param {string[]} cfg.deck  出战卡组的一串卡 id
   * @param {object} cfg.enemy   {id, slug, name, hp, maxHp, atk, def, agi, tier, deck, lines}
   * @param {number} cfg.seed
   */
  constructor(cfg) {
    this.rng = makeRng(cfg.seed ?? Math.floor(Math.random() * 1e9));
    this.turn = 0;
    this.over = false;
    this.winner = null;
    this.events = [];
    this.log = [];
    this.luckPointBonus = 0;
    /**
     * 手持道具的持有效果汇总表（由 game.js 的 heldMods() 传进来）。
     * **只挂在玩家那一侧** —— 敌人没有手持道具，所以 `this.enemy.mods` 永远是 undefined，
     * 上面那几个 modAdd / modMul / modFlag 对它就是 0 / 1 / false。
     */
    this.mods = cfg.mods ?? {};
    /**
     * 「哪一方打了哪张牌」的回调（由 game.js 传进来）。
     *
     * 为什么需要：卡牌图鉴里有 **40 张只给敌人用的牌**（`enemyOnly`）——
     * 玩家永远抽不到，所以它们的解锁条件不能是「拿到手」，而应该是「在战斗里看见它出招」。
     * 用户定的规则：「只给敌人用的卡可以设置成看到就在图片里解锁」。
     * 钩子放在这里而不是事件流里：事件流是给界面放演出用的，会被 takeEvents 消费掉。
     */
    this.onCardPlayed = cfg.onCardPlayed ?? null;

    const p = cfg.player;
    this.player = cloneSide({
      key: 'player',
      name: p.name,
      slug: p.slug,
      maxHp: p.maxHp,
      hp: p.maxHp,
      atk: p.atk,
      def: p.def,
      agi: p.agi,
      luck: p.luck,
      strength: 0,
    });
    this.player.hp = p.hp; // 战斗间的血量保留
    this.player.mods = this.mods;

    const e = cfg.enemy;
    this.enemy = cloneSide({
      key: 'enemy',
      // 这两个不是战斗数值、但界面上要用：`id` 用来回溯内容条目，`bossTitle` 是首领称号
      // （「流沙之主」那种）。以前 cloneSide 只搬了战斗要用的字段，于是 bossTitle 一路
      // 传到这儿就被丢掉了 —— 内容里写了、面板上却怎么都不显示。
      id: e.id,
      bossTitle: e.bossTitle ?? null,
      name: e.name,
      slug: e.slug,
      maxHp: e.maxHp,
      hp: e.maxHp,
      atk: e.atk,
      def: e.def,
      agi: e.agi,
      luck: e.tier === 'boss' ? 8 : e.tier === 'elite' ? 6 : 4,
      strength: 0,
      tier: e.tier,
      powerMul: e.powerMul ?? 1,
    });

    this.decks = {
      player: this.buildDeck(cfg.deck),
      enemy: this.buildDeck(e.deck ?? ['tackle']),
    };
    for (const side of ['player', 'enemy']) {
      this.decks[side] = { draw: this.rng.shuffle(this.decks[side]), hand: [], discard: [], exhaust: [] };
    }

    /**
     * 精英的「追求最高伤害」是**概率**的（用户要的：精英有很大概率这样、杂兵不会）：
     * 每场战斗开局掷一次，掷中就整场都按贪心打法走 —— 比每回合重掷更好读
     * （玩家能看出「这一只打得很凶」）。
     */
    if (this.enemy?.tier === 'elite') this._eliteGreedy = this.rng.chance(0.75);
    this.recalcDerived();
  }

  buildDeck(ids) {
    return ids.map((id, i) => ({ uid: `${i}-${id}`, id, card: CARD_BY_ID[id] })).filter((c) => c.card);
  }

  recalcDerived() {
    for (const key of ['player', 'enemy']) {
      const s = this[key];
      clampDebuffs(s);
      const agi = effectiveAgi(s);
      // 行动点上限 = 敏捷推出来的那份 + 「行动点上限 +N」强化（apMaxBonus 不会被重算清掉）
      s.apMax = apFromAgi(agi) + (s.apMaxBonus ?? 0);
      s.drawN = drawFromAgi(agi);
      s.handMax = handFromAgi(agi);
      s.playMax = playsFromAgi(agi);
    }
  }

  // ====================== 我方强化（buff） ======================

  /** 某一侧某个强化的层数（没有就是 0） */
  buffValue(key, buff) {
    return this[key]?.buffs?.[buff]?.n ?? 0;
  }

  /**
   * 给某一侧挂一个强化。
   * 同类强化**取更强的层数与更长的回合**（不叠数值，避免「连打三张就无限叠」）。
   */
  grantBuff(key, buff, n = 1, turns = 3) {
    const s = this[key];
    const info = BUFF_INFO[buff];
    if (!s || !info) return null;
    if (buff === 'apMax') s.apMaxBonus = (s.apMaxBonus ?? 0) + n;   // 上限是永久加的（本场战斗）
    const cur = s.buffs[buff];
    s.buffs[buff] = { n: Math.max(n, cur?.n ?? 0), turns: Math.max(turns, cur?.turns ?? 0) };
    this.recalcDerived();
    const label = buff === 'echo'
      ? t('「{name}」×{mul}', { name: t('回响'), mul: (1 + s.buffs[buff].n).toFixed(1).replace(/\.0$/, '') })
      : t(info.name);
    this.emitLogged(
      { type: 'buffUp', side: key, buff, n: s.buffs[buff].n, turns: s.buffs[buff].turns, value: this.buffValue(key, buff) },
      t('{name} 获得了强化「{label}」（持续 {turns} 回合）。', { name: s.name, label, turns: s.buffs[buff].turns }),
      key === 'player' ? 'good' : 'bad'
    );
    return s.buffs[buff];
  }

  /** 那一方回合开始时：强化倒计时，到 0 就消失 */
  tickBuffs(key) {
    const s = this[key];
    for (const [buff, v] of Object.entries(s.buffs ?? {})) {
      if (!v || v.turns <= 0) continue;
      v.turns -= 1;
      if (v.turns > 0) continue;
      if (buff === 'apMax') s.apMaxBonus = Math.max(0, (s.apMaxBonus ?? 0) - v.n);
      delete s.buffs[buff];
      this.recalcDerived();
      this.emitLogged(
        { type: 'buffDown', side: key, buff, value: 0 },
        t('{name} 的强化「{label}」结束了。', { name: s.name, label: t(BUFF_INFO[buff]?.name ?? buff) }),
        'info'
      );
    }
  }

  /** 「下回合开始生效」：预约一串效果，turns 个该方回合之后在回合开始时结算 */
  scheduleEffects(key, effects, turns = 1, name = null) {
    const s = this[key];
    if (!s || !effects?.length) return;
    s.pending.push({ turns, effects, name });
  }

  /** 「再打出 N 张牌 / 再过 N 个回合后生效」 */
  addTrigger(key, spec) {
    const s = this[key];
    if (!s || !spec?.effects?.length) return;
    s.triggers.push({
      on: spec.on ?? 'plays',
      left: Math.max(1, spec.count ?? 1),
      effects: spec.effects,
      name: spec.name ?? null,
      /**
       * **创建这个预约的那一次出牌**（`playSeq`）。见 fireTimers 的说明：
       * 「再打出 N 张牌」里的 N **不该把创建它的这张牌自己算进去**
       * （用户报的：「标着再打两张牌就能触发效果的卡，现在打一张就可以了」）。
       */
      seq: s.playSeq ?? 0,
    });
  }

  /**
   * 到时候了就把「预约的效果」放出来。
   * @param {'turn'|'plays'} why 触发原因（回合开始 / 又打了一张牌）
   */
  fireTimers(key, why) {
    const s = this[key];
    if (!s) return;
    // ① 预约（下回合开始）
    if (why === 'turn') {
      for (const p of [...(s.pending ?? [])]) {
        p.turns -= 1;
        if (p.turns > 0) continue;
        s.pending.splice(s.pending.indexOf(p), 1);
        this.emitLogged(
          { type: 'timer', side: key, name: p.name },
          t('{name} 攒的那一手到时间了。', { name: s.name }),
          key === 'player' ? 'good' : 'bad'
        );
        for (const eff of p.effects) {
          if (this.over) return;
          this.resolveEffect(key, eff, {});
        }
      }
    }
    // ② 计数触发（打出 N 张牌 / 过 N 个回合）
    for (const tr of [...(s.triggers ?? [])]) {
      if (tr.on !== why) continue;
      /**
       * **创建它的那一次出牌不算**（`tr.seq === s.playSeq`）：
       * 卡面写「打出这张牌之后，**再**打出 2 张牌时生效」，那么它应该等**两张别的牌**。
       * 以前这里不判 seq，于是这张牌自己把计数吃掉一格 —— 实测「二连劈」打出 1 张就触发，
       * 而卡面写着 2 张（用户报的正是这个）。
       */
      if (why === 'plays' && tr.seq === (s.playSeq ?? 0)) continue;
      tr.left -= 1;
      if (tr.left > 0) continue;
      s.triggers.splice(s.triggers.indexOf(tr), 1);
      this.emitLogged(
        { type: 'timer', side: key, name: tr.name },
        t('{name} 的「{label}」生效了！', { name: s.name, label: tr.name ?? t('蓄势') }),
        key === 'player' ? 'good' : 'bad'
      );
      for (const eff of tr.effects) {
        if (this.over) return;
        this.resolveEffect(key, eff, {});
      }
    }
  }

  emit(ev) {
    this.events.push(ev);
    return ev;
  }

  pushLog(text, kind = 'info') {
    this.log.push({ text, kind, turn: this.turn });
  }

  /**
   * emit 一个事件，同时把这条日志「挂」在事件上。
   *
   * 以前界面是用「引擎日志数组的最后一条」去猜当前事件对应哪行日志的，
   * 结果一张卡有多个效果时（比如龙之舞同时 +攻击 +敏捷）两个事件都取到了同一条日志，
   * 战斗日志里就会出现两行一模一样的「敏捷 +3」，而「攻击 +3」永远不显示。
   * 现在日志文本跟着事件走，界面直接读 ev.log，不会再串行。
   */
  emitLogged(ev, text, kind = 'info') {
    this.pushLog(text, kind);
    return this.emit({ ...ev, log: text, logKind: kind });
  }

  side(key) { return this[key]; }
  other(key) { return key === 'player' ? this.enemy : this.player; }

  // ====================== 抽卡 / 牌堆 ======================

  /**
   * 从牌堆顶抽 n 张；牌堆空了就先把**弃牌堆**洗回牌堆再继续抽。
   *
   * 手牌满了就**抽不动了**（直接停手，不把那张牌丢掉）。
   * 旧写法是「抽到但塞不进手牌 → 静默丢进弃牌堆」，玩家的感受就是
   * 「我什么都没干，牌怎么莫名其妙进了弃牌区」（用户反馈）——
   * 一回合结束手里剩 5 张、下回合又抽 5 张，只有 1 张放得下，另外 4 张就无声无息地没了。
   * 现在：抽不进来就留在牌堆顶，等腾出手牌位再抽得到。少抽几张不会让谁变弱 ——
   * 手牌上限本来就是玩家自己的预算（敏捷决定）。
   *
   * 关于「一张牌能不能在同一回合里被反复抽回来」：
   * 曾经加过一条「打出去的牌当回合抽不回来」的规则，用来堵「子弹拳 + 电光一闪」两张
   * 0 费抽 1 互相刷的连招。但那条规则把**所有**小卡组一起废掉了（2 张卡组从每回合 8 张
   * 掉到 2 张），而真正的病根其实是「出战卡组可以随便挑成 2 张」——
   * 那个开关已经取消（出战卡组 = 全部所持卡牌，精简要花钱删卡），所以这条规则**已回退**。
   *
   * 现在打出去的牌进弃牌堆，要等牌堆抽空才洗回来，所以同一回合里能不能再抽到同一张牌
   * 取决于牌堆还剩多少 —— 这是**可控**的轮换，而且有出牌上限兜底：
   * 不管怎么轮换，一回合最多也就打 `playMax`（3 + 敏捷÷2，上限 9）张牌 —— 不会死循环。
   */
  drawCards(key, n) {
    const d = this.decks[key];
    const max = this[key].handMax;
    const drawn = [];
    for (let i = 0; i < n; i++) {
      // 手牌满了就停手：先判这一条，免得白白把弃牌堆洗一遍、还发一个假的「洗牌」事件
      if (d.hand.length >= max) break;
      if (d.draw.length === 0) {
        if (d.discard.length === 0) break;
        d.draw = this.rng.shuffle(d.discard);
        d.discard = [];
        this.emit({ type: 'reshuffle', side: key });
      }
      d.hand.push(d.draw.shift());
      drawn.push(d.hand[d.hand.length - 1]);
    }
    if (drawn.length) this.emit({ type: 'draw', side: key, cards: drawn.map((c) => c.id) });
    if (key === 'player') this.checkPileIntegrity('抽牌后');
    return drawn;
  }

  /** 洗牌（重新开局用） */
  shuffleAll(key) {
    const d = this.decks[key];
    d.draw = this.rng.shuffle([...d.draw, ...d.discard, ...d.hand]);
    d.discard = [];
    d.hand = [];
  }

  /**
   * 牌堆哨兵：同一张牌（uid）不能同时出现在两堆里，也不能在同一堆里出现两次。
   *
   * 起因：玩家反馈「我只有一张羽栖，战斗里却抽出了两张」。
   * 把 86 种卡各塞进小卡组打一遍、再跑 150 局全流程逐操作对账（见
   * tools/test-deck-integrity.mjs 与 tools/test-deck-growth.mjs）都**没有复现**——
   * 那份反馈实际是「同一张牌轮换着又被抽回来」的正常现象（同一张牌，
   * 整场战斗里 uid 始终不变）。但「凭空多一张」这种事只要真发生过一次就该留下痕迹，
   * 所以这里常驻一个哨兵：一旦真的发生，控制台会直接说清是哪张牌、出现在哪几堆。
   *
   * 开销：牌组最多几十张，一次 Set 扫描，比重绘一帧便宜得多，所以在正式版里也开着。
   */
  checkPileIntegrity(where) {
    const seen = new Map();
    // 注意是 decks[side][pile] —— decks 的第一层是「哪一方」，不是「哪一堆」。
    // （哨兵第一版写成了 this.decks[key]，永远扫到 undefined，于是它其实从来没生效过；
    //   是「故意制造重复、看它会不会响」那条反例断言把它抓出来的。）
    for (const side of ['player', 'enemy']) {
      for (const key of ['draw', 'hand', 'discard', 'exhaust']) {
        for (const entry of this.decks[side]?.[key] ?? []) {
          const id = `${side}:${entry.uid}`;
          const at = seen.get(id);
          if (at) {
            const name = entry.card?.name ?? entry.id;
            const msg = `[oasis] 牌堆异常（${where}）：${side} 的「${name}」uid=${entry.uid} `
              + `同时出现在「${at}」和「${key}」里。请把这一行发给作者 —— 这就是「一张牌变成两张」的现场。`;
            console.error(msg);
            if (typeof window !== 'undefined') {
              window.__oasisLastError = { at: new Date().toISOString(), message: msg };
            }
            return false;
          }
          seen.set(id, key);
        }
      }
    }
    return true;
  }

  // ====================== 回合流程 ======================

  start() {
    this.emitLogged({ type: 'battleStart', player: this.snapshot('player'), enemy: this.snapshot('enemy') }, t('遭遇 {name}！', { name: this.enemy.name }));
    this.beginPlayerTurn();
  }

  /**
   * 回合开始的持续伤害与状态结算。
   *
   * 伤害按「最大生命的百分比 × 层数」算（见 BALANCE.statusPct）：
   * 这是「后期上毒只扣个位数」的修复 —— 固定值在血量上千之后等于没有。
   * 中毒每回合减 1 层（会自己结束），剧毒每回合 **加 1 层**（越拖越痛），灼伤层数不变。
   */
  tickStatuses(key) {
    const s = this[key];
    const pct = BALANCE.statusPct ?? {};
    /**
     * 持有效果（只对**玩家施加的**那些生效，所以倍率取 this.player 的 mods）：
     *   dotPct          持续伤害总量 +X%
     *   poisonTickPct   中毒每回合额外扣「最大生命 × X」（毒毒糖 / 剧毒宝珠）
     *   poisonNoDecay   中毒层数不随时间减少（同上）
     */
    const dotMul = 1 + modAdd(this.player, 'dotPct');
    const poisonExtra = modAdd(this.player, 'poisonTickPct');
    const noDecay = modFlag(this.player, 'poisonNoDecay');
    if (s.poison > 0) {
      let dmg = dotTickDamage(s, s.poison, pct.poison, dotMul);
      if (poisonExtra) dmg += dotTickDamage(s, s.poison, poisonExtra, 1);
      this.dealTrueDamage(key, dmg, t('中毒'));
      if (!noDecay) {
        s.poison = Math.max(0, s.poison - 1);
        this.emit({ type: 'status', side: key, status: 'poison', delta: -1, value: s.poison });
      }
    }
    if (s.toxic > 0) {
      let dmg = dotTickDamage(s, s.toxic, pct.toxic, dotMul);
      if (poisonExtra) dmg += dotTickDamage(s, s.toxic, poisonExtra, 1);
      this.dealTrueDamage(key, dmg, t('剧毒'));
      s.toxic += 1;
      this.emit({ type: 'status', side: key, status: 'toxic', delta: 1, value: s.toxic });
    }
    if (s.burn > 0) {
      const dmg = dotTickDamage(s, s.burn, pct.burn, dotMul);
      this.dealTrueDamage(key, dmg, t('灼伤'));
    }
    // 虚弱**不在这里**扣层：见 decayWeak()。
  }

  /**
   * 虚弱按「整整用过一个回合」计时：在**那一方回合结束时**才减 1 层。
   *
   * 以前是放在回合开始时扣的，结果是：敌人在它回合给你挂 1 层虚弱 →
   * 你的回合一开始就减到 0 → 你这一回合的攻击一次都没被削弱，
   * 等于「挂了但完全没效果」（池子里的扬沙 / 岩崩都是 1 层，所以很容易碰上）。
   * 现在改成回合结束才减层：挂上之后那一方**打完整个回合**才掉层，层数就等于「还能削弱几个回合」。
   */
  decayWeak(key) {
    const s = this[key];
    if (s.weak > 0) {
      s.weak -= 1;
      this.emit({ type: 'status', side: key, status: 'weak', delta: -1, value: s.weak });
    }
  }

  dealTrueDamage(key, amount, reason) {
    const s = this[key];
    if (amount <= 0) return 0;
    const dealt = Math.min(s.hp, amount);
    s.hp -= dealt;
    this.emitLogged({ type: 'trueDamage', side: key, amount: dealt, hp: s.hp, reason },
      t('{name} 因{reason}失去 {amount} 点 HP。', { name: s.name, reason: t(reason), amount: dealt }), 'bad');
    this.checkDeath();
    return dealt;
  }

  beginPlayerTurn() {
    if (this.over) return;
    this.turn += 1;
    this.active = 'player';
    const p = this.player;
    // 护盾在自身回合开始时清空（保留一整个敌方回合）；
    // 「广域防守」这类牌会给一份 keepShield 标记，那一次的护盾留着不丢。
    if (p.keepShield) p.keepShield = false;
    else p.shield = 0;
    /**
     * 手持道具在**每回合开始**的那几件事（只在玩家这一侧，敌人没有 mods）：
     *   apPerTurn / apFirstTurn  AP 加成（首回合那份只在第 1 回合给）
     *   drawPerTurn              多抽几张
     *   healPerTurnPct           每回合回一点血
     *   battleStartShieldPct     第 1 回合开始先给一层护盾
     *   battleStartCleanse       第 1 回合开始清掉自己身上的负面状态
     *   firstAttackPending       给「本回合第一张攻击牌 +X%」（先制之爪）打一个标记，
     *                            出过一张攻击牌就清掉（见 resolveCard）
     */
    const firstTurn = this.turn === 1;
    if (firstTurn && modFlag(p, 'battleStartCleanse')) {
      for (const k of ALL_STATUSES) if ((p[k] ?? 0) > 0) { p[k] = 0; this.emit({ type: 'status', side: 'player', status: k, delta: -99, value: 0 }); }
    }
    if (firstTurn && modAdd(p, 'battleStartShieldPct')) {
      p.shield += Math.round(p.maxHp * modAdd(p, 'battleStartShieldPct') * (1 + modAdd(p, 'shieldPct')));
    }
    p.ap = p.apMax + p.blockBonus + modAdd(p, 'apPerTurn') + (firstTurn ? modAdd(p, 'apFirstTurn') : 0);
    p.blockBonus = 0;
    p.playsLeft = p.playMax;
    p.firstAttackPending = true;
    this.emit({ type: 'turnStart', side: 'player', turn: this.turn, ap: p.ap });
    this.tickStatuses('player');
    if (this.over) return;
    /**
     * 「下回合生效」/「N 回合后生效」的预约在这里结算（**在自己回合开始时**）。
     * 强化（buff）的倒计时不在这里 —— 它在回合**结束**时扣（和虚弱同一套计时），
     * 否则「持续 1 回合」的 AP 上限强化会在给你 AP 之前就过期。
     */
    this.fireTimers('player', 'turn');
    if (this.over) return;
    if (modAdd(p, 'healPerTurnPct')) {
      const h = Math.round(p.maxHp * modAdd(p, 'healPerTurnPct'));
      if (h > 0 && p.hp < p.maxHp) {
        p.hp = Math.min(p.maxHp, p.hp + h);
        this.emitLogged({ type: 'heal', side: 'player', amount: h, hp: p.hp },
          t('{name} 因手上的道具回复了 {amount} 点 HP。', { name: p.name, amount: h }), 'good');
      }
    }
    this.drawCards('player', p.drawN + modAdd(p, 'drawPerTurn'));
  }
  playCard(uid, opts = {}) {
    if (this.over || this.active !== 'player') return { ok: false, reason: t('不是你的回合') };
    const d = this.decks.player;
    const idx = d.hand.findIndex((c) => c.uid === uid);
    if (idx < 0) return { ok: false, reason: t('手牌里没有这张卡') };
    const entry = d.hand[idx];
    const card = entry.card;
    const cost = this.cardCost(entry);
    if (cost > this.player.ap) return { ok: false, reason: t('AP 不足') };
    if ((this.player.playsLeft ?? 0) <= 0) return { ok: false, reason: t('本回合出牌次数已用完') };

    this.player.ap -= cost;
    this.player.playsLeft -= 1;
    d.hand.splice(idx, 1);
    this.emitLogged({ type: 'playCard', side: 'player', id: card.id, name: card.name, cost }, t('{name} 使用了「{card}」。', { name: this.player.name, card: card.name }));
    // 通知外面「哪一方打了哪张牌」：图鉴靠它把**只给敌人用的牌**记成「见过」
    // （玩家永远拿不到那 40 张，所以它们的解锁条件是「在战斗里看见它出招」，见 game.js 的 startBattle）
    this.onCardPlayed?.('player', card.id);
    this.resolveCard('player', card, opts);

    // 使用后的去向：销毁区 or **弃牌堆**
    // （牌堆抽空、还要再抽的时候，弃牌堆才会洗回牌堆 —— 这是用户点名要的规则：
    //  「卡打出去以后会进入弃牌区而不是再放入卡组，直到卡组抽光以后才会让弃牌区回到卡组」。
    //  以前是「打出去塞回牌堆最底端」，玩家很难预判下一张抽到什么，而且弃牌堆只在
    //  手牌溢出的情况下涨 —— 那张牌是怎么进去的完全看不出来。）
    if (card.exhaust) {
      d.exhaust.push(entry);
      this.emit({ type: 'exhaust', side: 'player', id: card.id });
    } else {
      d.discard.push(entry);
      this.emit({ type: 'discard', side: 'player', cards: [card.id] });
    }
    this.checkPileIntegrity('出牌后');
    return { ok: true, card: card.id, cost };
  }

  /** 卡牌实际费用（沙暴等卡可以改费用；目前只用了基础值 + 状态修正位） */
  cardCost(entry) {
    const c = entry.card;
    return Math.max(0, c.ap + (c.apMod ?? 0));
  }

  canPlay(uid) {
    const entry = this.decks.player.hand.find((c) => c.uid === uid);
    if (!entry) return false;
    return this.cardCost(entry) <= this.player.ap
      && (this.player.playsLeft ?? 0) > 0
      && !this.over && this.active === 'player';
  }

  // ====================== 效果解释器 ======================

  /**
   * 结算一张牌的所有效果。
   *
   * 关键规则：**带伤害的牌，如果攻击被完全闪开，后续那些「打到对手身上」的附加效果也不生效**。
   * 以前不管中没中，附加的中毒 / 降防御照样挂上去 —— 日志里就会出现
   * 「Oasis 闪开了攻击！」紧跟一行「Oasis 的防御 -2」，看着就很别扭（也确实不公平）。
   * 纯变化牌（没伤害的，例如刺耳声）不受影响，该生效还是生效。
   */
  resolveCard(sourceKey, card, opts = {}) {
    const hasDamage = card.effects.some((e) => e.kind === 'damage');
    let damageAttempted = false;
    let damageLanded = false;
    const src = this[sourceKey];
    /**
     * **回响**（同种卡打出多次翻倍）：本场战斗里这张牌之前打过几次？
     * 有「回响」强化时，第 2 次及以后打出同名卡 → 伤害与附加状态层数 ×(1 + n)。
     * 这就是用户点名的「同种卡打出多次效果翻倍」：打法围绕**反复打同一张牌**展开。
     */
    const plays = src.playedIds?.[card.id] ?? 0;
    const echo = plays > 0 ? (this.buffValue(sourceKey, 'echo') || 0) : 0;
    if (echo > 0) {
      opts = { ...opts, powerMul: 1 + echo, stackMul: 1 + echo };
      this.emitLogged(
        { type: 'echo', side: sourceKey, id: card.id, times: plays + 1, mul: 1 + echo },
        t('回响：这是第 {n} 次打出「{card}」，威力与层数 ×{mul}。', { n: plays + 1, card: card.name, mul: (1 + echo).toFixed(1).replace(/\.0$/, '') }),
        sourceKey === 'player' ? 'good' : 'bad'
      );
    }
    src.playedIds = src.playedIds ?? {};
    src.playedIds[card.id] = plays + 1;
    /**
     * 第几张牌（**每一次出牌 +1**）：「再打出 N 张牌就生效」的预约靠它区分
     * 「创建它的那次出牌」和「之后打出的牌」（见 addTrigger / fireTimers）。
     * 必须在**结算效果之前**先 +1，这样这张牌自己创建的预约带的就是当前这张牌的序号。
     */
    src.playSeq = (src.playSeq ?? 0) + 1;
    /**
     * 手持道具里那几件「每次出攻击牌都要付代价」的东西（生命宝珠的 selfDamagePct）：
     * 一张牌里可能有好几段伤害，但**一件道具只为一张牌收一次利息**，
     * 所以用 playedOnce 把「这一张牌已经收过」记下来。
     */
    let charged = false;
    for (const eff of card.effects) {
      if (this.over) break;
      if (hasDamage && damageAttempted && !damageLanded && this.targetsFoe(eff)) continue;
      const res = this.resolveEffect(sourceKey, eff, opts);
      if (eff.kind === 'damage') {
        damageAttempted = true;
        if (!res?.allDodged) damageLanded = true;
        // 第一张攻击牌打出去了：把「首张攻击 +X%」的标记清掉
        if (src?.firstAttackPending) src.firstAttackPending = false;
        if (!charged && modAdd(src, 'selfDamagePct')) {
          charged = true;
          const cost = Math.max(1, Math.round(src.maxHp * modAdd(src, 'selfDamagePct')));
          this.dealTrueDamage(sourceKey, cost, t('手上的道具'));
        }
      }
    }
    /** 「再打出 N 张牌就生效」的计数（打出的这一张算第一张） */
    this.fireTimers(sourceKey, 'plays');
  }

  /** 这个效果是不是打在对手身上（自己身上的护盾 / 抽牌 / 强化不算） */
  targetsFoe(eff) {
    if (eff.kind === 'status') return eff.target !== 'self';
    if (eff.kind === 'buff') return eff.target === 'enemy';
    if (eff.kind === 'damage') return true;
    return false;
  }

  resolveEffect(sourceKey, eff, opts = {}) {
    const self = this[sourceKey];
    const foeKey = sourceKey === 'player' ? 'enemy' : 'player';
    const foe = this[foeKey];

    switch (eff.kind) {
      case 'damage': {
        const hits = eff.hits ?? 1;
        let landed = 0;
        for (let h = 0; h < hits && !this.over; h++) {
          const r = this.resolveHit(sourceKey, foeKey, eff, opts, h, hits);
          if (!r?.dodged) landed += 1;
        }
        return { allDodged: landed === 0 };
      }
      case 'shield': {
        // 护盾量与玩家防御挂钩：防御越高，格挡牌越强。
        // 否则后期「变硬 +7」对比几十点的敌人输出完全没意义。
        const scale = 1 + (eff.scaleWithDef ? effectiveDef(self) / 12 : 0);
        // 手持道具的 shieldPct（蓝色碎片 / 岩石宝石 / 金属粉…）
        const amount = Math.round(eff.amount * scale * (1 + (self.shieldBonus ?? 0)) * (1 + modAdd(self, 'shieldPct')));
        self.shield += amount;
        // keep：这一份护盾「下回合不清空」（普通护盾在持有者回合开始时归零）
        if (eff.keep) self.keepShield = true;
        this.emitLogged({ type: 'shield', side: sourceKey, amount, total: self.shield }, t('{name} 获得 {amount} 点护盾。', { name: self.name, amount }), 'good');
        break;
      }
      case 'heal': {
        // 手持道具的 healPct（哞哞牛奶 / 奇迹种子 / 妖精羽毛…）：恢复类卡牌回得更多
        const amount = Math.round((eff.pct ? self.maxHp * eff.pct : eff.amount) * (1 + modAdd(self, 'healPct')));
        const healed = Math.min(amount, self.maxHp - self.hp);
        self.hp += healed;
        if (healed > 0) {
          this.emitLogged({ type: 'heal', side: sourceKey, amount: healed, hp: self.hp }, t('{name} 回复 {amount} 点 HP。', { name: self.name, amount: healed }), 'good');
        } else {
          this.emit({ type: 'heal', side: sourceKey, amount: 0, hp: self.hp });
        }
        break;
      }
      case 'draw':
        this.drawCards(sourceKey, eff.n);
        break;
      case 'ap': {
        self.ap += eff.n;
        this.emit({ type: 'gainAp', side: sourceKey, amount: eff.n, ap: self.ap });
        break;
      }
      case 'buff': {
        const targetKey = eff.target === 'enemy' ? foeKey : sourceKey;
        // 注意：这个局部变量以前叫 `t`，和 i18n 的 t() 撞名了（改名叫 actor，
        // 否则下面 t('…') 会变成「拿角色对象当函数调」—— 直接 TypeError）。
        const actor = this[targetKey];
        // 属性下降有下限（BALANCE.debuffFloorPct），recalcDerived() 里会把 defMod 等夹住。
        // 所以这里必须报**实际变化量**：夹住之后 delta 可能是 -1 甚至 0，
        // 以前不管夹没夹都照报 eff.amount（例如「防御 -2」），于是界面上日志、音效、
        // 特效全演了一遍，数值却一动不动 —— 看起来就像「削弱没附加成功」。
        //
        // amount 是固定值，pct 是「按目标基础属性的百分比」：后期敌人防御只有 16 上下，
        // 固定 -5 两下就顶到底，所以稀有卡改用百分比削弱（-30% 永远有效）。
        const amount = eff.pct != null ? Math.round((actor[eff.stat] ?? 0) * eff.pct) : eff.amount;
        const before = this.statValue(targetKey, eff.stat);
        if (eff.stat === 'atk') actor.atkMod += amount;
        else if (eff.stat === 'def') actor.defMod += amount;
        else if (eff.stat === 'agi') actor.agiMod += amount;
        else if (eff.stat === 'luck') actor.luckMod += amount;
        this.recalcDerived();
        const after = this.statValue(targetKey, eff.stat);
        const delta = after - before;
        const clamped = delta !== amount;
        const label = t('{name} 的{stat}', { name: actor.name, stat: statName(eff.stat) });
        const text = delta === 0
          ? t('{label}已经降到底了（当前 {now}），这次没能再降。', { label, now: after })
          : t('{label} {delta}（当前 {now}）{clamped}。', {
            label,
            delta: `${delta > 0 ? '+' : ''}${delta}`,
            now: after,
            clamped: clamped ? t('，已经到底了') : '',
          });
        this.emitLogged(
          { type: 'buff', side: targetKey, stat: eff.stat, amount: delta, requested: amount, clamped, value: after },
          text,
          delta > 0 ? 'good' : 'bad'
        );
        break;
      }
      /**
       * 力量：接下来每一次攻击的威力都 +n（百分比）。
       * 和 buff 的区别是它不改属性面板，只在伤害公式里加在「威力」上 ——
       * 所以它不吃削弱上限，也不影响敏捷/抽牌这些派生值。
       */
      case 'strength': {
        // 力量有上限：它是永久叠加的，而「打完回牌堆底端」意味着同一张加力量的牌
        // 一个回合里能被再抽回来。没有上限时敌人（比如带 3 张「过热」的火系精英）
        // 打到第五回合就叠到 +480%，之后每张牌都是五倍伤害（见 BALANCE.strengthCap）。
        const cap = BALANCE.strengthCap ?? 9999;
        const before = self.strength ?? 0;
        self.strength = Math.min(cap, before + eff.n);
        const gained = self.strength - before;
        this.emitLogged(
          { type: 'strength', side: sourceKey, amount: gained, value: self.strength, capped: gained !== eff.n },
          gained > 0
            ? t('{name} 的攻击威力 +{gained}%（本场战斗累计 {total}%{capped}）。', {
              name: self.name, gained, total: self.strength, capped: self.strength >= cap ? t('，已经到上限') : '',
            })
            : t('{name} 的攻击威力已经到上限了（{total}%）。', { name: self.name, total: self.strength }),
          sourceKey === 'player' ? 'good' : 'bad'
        );
        break;
      }
      /** 额外行动点 / 出牌次数：把「这一回合能做的事」本身当成资源卖 */
      case 'apBonus':
        self.blockBonus = (self.blockBonus ?? 0) + eff.n;
        this.emitLogged(
          { type: 'gainAp', side: sourceKey, amount: eff.n, ap: self.ap + eff.n },
          t('{name} 下回合额外获得 {n} 点行动点。', { name: self.name, n: eff.n }),
          sourceKey === 'player' ? 'good' : 'bad'
        );
        break;
      case 'plays': {
        self.playsLeft = (self.playsLeft ?? 0) + eff.n;
        this.emitLogged(
          { type: 'plays', side: sourceKey, amount: eff.n, value: self.playsLeft },
          t('{name} 本回合多出 {n} 次出牌机会。', { name: self.name, n: eff.n }),
          sourceKey === 'player' ? 'good' : 'bad'
        );
        break;
      }
      /**
       * **强化（buff）**：给自己（或对手）挂一条带回合数的正面效果。
       * 目前四种：行动点上限 +N / 回响 / 威力 +N% / 附加层数 +N（见 BUFF_INFO）。
       */
      case 'grantBuff': {
        const targetKey = eff.target === 'enemy' ? foeKey : sourceKey;
        this.grantBuff(targetKey, eff.buff, eff.n ?? 1, eff.turns ?? 3);
        break;
      }
      /**
       * **下回合生效**：把这串效果预约到 `turns` 个该方回合之后的回合开始时结算。
       * 「先蓄一手、下回合爆」—— 和立即结算的区别是它**不占用这一回合的行动点产出比**，
       * 代价是给对手一个回合的反应时间。
       */
      case 'delay': {
        this.scheduleEffects(sourceKey, eff.effects ?? [], eff.turns ?? 1, eff.name ?? null);
        this.emitLogged(
          { type: 'delay', side: sourceKey, turns: eff.turns ?? 1, name: eff.name ?? null },
          t('{name} 蓄势待发：{turns} 回合后生效。', { name: self.name, turns: eff.turns ?? 1 }),
          sourceKey === 'player' ? 'good' : 'bad'
        );
        break;
      }
      /**
       * **行动 N 次后生效**：`on: 'plays'` 数「又打出几张牌」、`on: 'turn'` 数「再过几个回合」。
       * 用户点名要的第二种节奏（「或是我方行动（敌方行动）N 次后生效」）。
       */
      case 'trigger': {
        this.addTrigger(sourceKey, { on: eff.on ?? 'plays', count: eff.count ?? 2, effects: eff.effects ?? [], name: eff.name ?? null });
        this.emitLogged(
          { type: 'triggerSet', side: sourceKey, on: eff.on ?? 'plays', count: eff.count ?? 2, name: eff.name ?? null },
          eff.on === 'turn'
            ? t('{name} 埋下了一手：{count} 回合后生效。', { name: self.name, count: eff.count ?? 2 })
            : t('{name} 埋下了一手：再打出 {count} 张牌就生效。', { name: self.name, count: eff.count ?? 2 }),
          sourceKey === 'player' ? 'good' : 'bad'
        );
        break;
      }
      /**
       * 引爆：把对手身上的中毒 / 剧毒层数立刻结算成伤害并清掉。
       * 毒流派的收尾手段 —— 没有它，「上毒」永远要等对方自己掉血。
       */
      case 'detonate': {
        const stacks = DOT_STATUSES.reduce((s, st) => s + (foe[st] ?? 0), 0);
        if (stacks <= 0) {
          this.emitLogged({ type: 'detonate', side: foeKey, amount: 0, stacks: 0, statuses: [] }, t('{name} 身上没有可以引爆的持续伤害。', { name: foe.name }), 'info');
          break;
        }
        const per = eff.perStack ?? 3;
        const dmg = Math.round(foe.maxHp * (BALANCE.statusPct?.poison ?? 0.008) * stacks * per);
        // 一起炸掉的是哪几种毒：界面按名单把对手身上的胶囊化掉（同 cleanse）
        const cleared = DOT_STATUSES.filter((st) => (foe[st] ?? 0) > 0);
        for (const st of DOT_STATUSES) foe[st] = 0;
        this.emitLogged(
          { type: 'detonate', side: foeKey, amount: dmg, stacks, statuses: cleared },
          t('引爆了 {name} 身上 {n} 层持续伤害！', { name: foe.name, n: stacks }),
          sourceKey === 'player' ? 'good' : 'bad'
        );
        this.dealTrueDamage(foeKey, dmg, t('引爆'));
        break;
      }
      /**
       * 层数翻倍：把一侧身上的**持续伤害层数**直接 ×2（中毒 / 剧毒 / 灼伤 / 出血）。
       *
       * 毒流与出血流的放大器：先铺层数、再翻倍、最后引爆 —— 比「再挂一层」划算得多，
       * 也让「先铺后爆」这条线多了个决策点（铺到几层翻倍最赚）。
       * 没有可翻的层数时不空放：照实说一句，免得玩家以为卡坏了。
       */
      case 'statusDouble': {
        const targetKey = eff.target === 'self' ? sourceKey : foeKey;
        const actor = this[targetKey];   // 同上：别叫 t，会和 i18n 的 t() 撞名
        const hit = DOT_STATUSES.filter((st) => (actor[st] ?? 0) > 0);
        if (!hit.length) {
          this.emitLogged(
            { type: 'statusDouble', side: targetKey, values: {}, gained: 0 },
            t('{name} 身上没有可以翻倍的层数。', { name: actor.name }),
            'info'
          );
          break;
        }
        let gained = 0;
        const values = {};
        for (const st of hit) { gained += actor[st]; actor[st] *= 2; values[st] = actor[st]; }
        this.emitLogged(
          { type: 'statusDouble', side: targetKey, values, gained, statuses: hit },
          t('{name} 身上的持续伤害层数翻倍了（+{n} 层）！', { name: actor.name, n: gained }),
          targetKey === 'player' ? 'bad' : 'good'
        );
        break;
      }
      /**
       * 转嫁：把自己身上的持续伤害层数**全部推给对手**（自己清零）。
       *
       * 和「层数翻倍」是一对：翻倍放大的是**对手**身上的层数，转嫁是把自己挨的那份**还回去**。
       * 它让「被上毒」从纯粹的坏事变成一种资源 —— 顶着毒铺自己的节奏，再一次性还清。
       * 自己身上没有层数时不空放（照实说一句）。
       */
      case 'statusSteal': {
        const from = this[sourceKey];
        const to = this[foeKey];
        const hit = DOT_STATUSES.filter((st) => (from[st] ?? 0) > 0);
        if (!hit.length) {
          this.emitLogged(
            { type: 'statusSteal', side: sourceKey, values: {}, gained: 0 },
            t('{name} 身上没有可以转嫁的层数。', { name: from.name }),
            'info'
          );
          break;
        }
        let moved = 0;
        const values = {};
        for (const st of hit) { moved += from[st]; to[st] = (to[st] ?? 0) + from[st]; from[st] = 0; values[st] = to[st]; }
        this.emitLogged(
          { type: 'statusSteal', side: sourceKey, values, gained: moved, statuses: hit },
          t('{name} 把自己身上的持续伤害层数全部转嫁给了对手（{n} 层）！', { name: from.name, n: moved }),
          sourceKey === 'player' ? 'good' : 'bad'
        );
        break;
      }
      case 'status': {
        const targetKey = eff.target === 'self' ? sourceKey : foeKey;
        const actor = this[targetKey];   // 同上：别叫 t，会和 i18n 的 t() 撞名
        // 有些招式挂状态是「有概率的」（岩崩的虚弱就是）：没中要说清是谁抵抗了什么。
        // 以前这里只 emit 了一个不带日志的 resist 事件，界面上凭空飘出两个字「抵抗」，
        // 玩家根本不知道那是什么意思（实测被问到了）。
        if (eff.chance != null && !this.rng.chance(eff.chance)) {
          const nm = STATUS_INFO[eff.status]?.name ?? eff.status;
          this.emitLogged(
            { type: 'resist', side: targetKey, status: eff.status, chance: eff.chance },
            t('{name} 抵抗了{status}。', { name: actor.name, status: nm }),
            targetKey === 'player' ? 'good' : 'bad'
          );
          break;
        }
        /**
         * 层数 + 手持道具（只在**给对手上状态**时生效，自己挨的状态不会被自己的道具加强）：
         *   poisonStacks     中毒 / 剧毒 +n 层（毒针）
         *   burnStacks       灼伤 +n 层（火焰宝珠）
         *   bleedStacksMult  出血 ×n（锐利之爪，用户点名的例子）
         *   debuffStacks     削弱类（虚弱）+n 层（大地石板 / 王者之证 / 月之石…）
         */
        let stacks = eff.stacks;
        if (targetKey !== sourceKey) {
          const from = this.player;
          if (eff.status === 'poison' || eff.status === 'toxic') stacks += modAdd(from, 'poisonStacks');
          else if (eff.status === 'burn') stacks += modAdd(from, 'burnStacks');
          else if (eff.status === 'bleed') stacks = Math.round(stacks * modMul(from, 'bleedStacksMult'));
          else if (eff.status === 'weak') stacks += modAdd(from, 'debuffStacks');
        }
        /** 「附加层数 +N」这个**强化**（buff 版，毒 / 出血流铺得更快）：只有给对手上状态时才加 */
        if (targetKey !== sourceKey) stacks += this.buffValue(sourceKey, 'stacks');
        /** 回响：同一张牌再打一次，层数也跟着 ×(1+n)（用户点名的「叠加异常层数也翻倍」） */
        if (opts.stackMul && opts.stackMul !== 1) stacks = Math.round(stacks * opts.stackMul);
        actor[eff.status] = (actor[eff.status] ?? 0) + stacks;
        this.emitLogged(
          { type: 'status', side: targetKey, status: eff.status, delta: stacks, value: actor[eff.status] },
          t('{name} 获得了 {n} 层{status}。', { name: actor.name, n: stacks, status: STATUS_INFO[eff.status].name }),
          targetKey === 'player' ? 'bad' : 'good'
        );
        break;
      }
      case 'selfDmg': {
        // pct 版本按最大生命算（血祭类的代价随血量走，后期不会变成「几乎不痛」）
        const amount = eff.pct != null ? Math.round(self.maxHp * eff.pct) : eff.amount;
        // 代价的「名目」会写进战斗日志（「受到了 X 点伤害（血祭）」）。它写的是**卡名**，
        // 所以要过一遍 t()，否则日 / 英模式里日志里会夹一个中文卡名。
        this.dealTrueDamage(sourceKey, amount, t(eff.reason ?? '反作用力'));
        break;
      }
      case 'discard': {
        const d = this.decks[sourceKey];
        const n = Math.min(eff.n, d.hand.length);
        const removed = d.hand.splice(0, n);
        d.discard.push(...removed);
        this.emit({ type: 'discard', side: sourceKey, cards: removed.map((c) => c.id) });
        break;
      }
      case 'exhaustHand': {
        const d = this.decks[sourceKey];
        const removed = d.hand.splice(0);
        d.exhaust.push(...removed);
        this.emit({ type: 'discard', side: sourceKey, cards: removed.map((c) => c.id), toExhaust: true });
        break;
      }
      case 'luckPoint':
        this.luckPointBonus += eff.n;
        break;
      /**
       * 清除自身的属性下降（可选连状态一起清）。
       * 削弱牌是永久叠加的，玩家总得有个解法，不然只能眼看着防御被磨平。
       * 注意：这个方法里的「自己」变量叫 self，不是 s。
       */
      case 'cleanse': {
        const removed = [];
        /**
         * 具体被清掉的是哪几个状态。
         *
         * 以前这条事件只带一个「清掉了几个」的数字，界面拿不到名单，
         * 于是引擎里的中毒已经归零、界面上的胶囊还挂着（要到回合结束 resyncDisp 才掉）——
         * 玩家打完「白雾」看不见任何反馈，只觉得这张牌没生效。
         * 名单是给界面用的：它按名单把对应的胶囊逐个化掉。
         */
        const cleared = [];
        if ((self.atkMod ?? 0) < 0) { removed.push(t('攻击 {n}', { n: self.atkMod })); self.atkMod = 0; }
        if ((self.defMod ?? 0) < 0) { removed.push(t('防御 {n}', { n: self.defMod })); self.defMod = 0; }
        if ((self.agiMod ?? 0) < 0) { removed.push(t('敏捷 {n}', { n: self.agiMod })); self.agiMod = 0; }
        if (eff.statuses) {
          for (const st of ALL_STATUSES) {
            if ((self[st] ?? 0) > 0) { removed.push(t('{status} {n}', { status: STATUS_INFO[st].name, n: self[st] })); cleared.push(st); self[st] = 0; }
          }
        }
        this.recalcDerived();
        this.emitLogged(
          {
            type: 'cleanse', side: sourceKey, removed: removed.length, statuses: cleared,
            // 属性下降清完之后剩多少：界面副本按这个对齐（不清的话面板上还挂着「攻 -8」）
            mods: { atk: self.atkMod ?? 0, def: self.defMod ?? 0, agi: self.agiMod ?? 0 },
          },
          removed.length
            ? t('{name} 清除了身上的削弱（{list}）。', { name: self.name, list: removed.join(t('、')) })
            : t('{name} 身上没有可清除的削弱。', { name: self.name }),
          'good'
        );
        break;
      }
      default:
        break;
    }
  }

  statValue(key, stat) {
    const s = this[key];
    switch (stat) {
      case 'atk': return effectiveAtk(s);
      case 'def': return effectiveDef(s);
      case 'agi': return effectiveAgi(s);
      case 'luck': return effectiveLuck(s);
      default: return 0;
    }
  }

  resolveHit(sourceKey, foeKey, eff, opts, hitIndex, hitCount) {
    const attacker = this[sourceKey];
    const defender = this[foeKey];

    // 闪避判定
    const dodge = dodgeChance(effectiveLuck(defender));
    if (dodge > 0 && this.rng() * 100 < dodge) {
      this.emitLogged({ type: 'dodge', side: foeKey, index: hitIndex }, t('{name} 闪开了攻击！', { name: defender.name }), foeKey === 'player' ? 'good' : 'bad');
      return { dodged: true };
    }

    // 暴击判定
    const crit = this.rng() * 100 < critChance(effectiveLuck(attacker));
    const power = damagePowerOf(attacker, defender, eff, opts.powerMul ?? 1);
    const dmg = computeHit(attacker, defender, power, {
      ignoreDefPct: eff.ignoreDefPct ?? 0,
      isCrit: crit,
      attackMul: sourceKey === 'enemy' ? BALANCE.enemyAtkMul * (attacker.powerMul ?? 1) : 1,
    });

    this.applyDamage(foeKey, dmg, { crit, source: sourceKey, index: hitIndex, total: hitCount });

    // 吸血：按造成的伤害回一口（卡牌的 drainPct）
    if (eff.drainPct) {
      const attacker2 = this[sourceKey];
      const back = Math.max(1, Math.round(dmg * eff.drainPct));
      const healed = Math.min(back, attacker2.maxHp - attacker2.hp);
      if (healed > 0) {
        attacker2.hp += healed;
        this.emitLogged(
          { type: 'heal', side: sourceKey, amount: healed, hp: attacker2.hp },
          t('{name} 吸取了 {amount} 点生命。', { name: attacker2.name, amount: healed }),
          sourceKey === 'player' ? 'good' : 'bad'
        );
      }
    }

    if (eff.recoilPct) {
      const recoil = Math.max(1, Math.round(dmg * eff.recoilPct));
      this.dealTrueDamage(sourceKey, recoil, t('反作用力'));
    }
    return { dodged: false, dmg, crit };
  }

  applyDamage(key, dmg, meta = {}) {
    const s = this[key];
    let left = dmg;
    let absorbed = 0;
    if (s.shield > 0) {
      absorbed = Math.min(s.shield, left);
      s.shield -= absorbed;
      left -= absorbed;
    }
    const dealt = Math.min(s.hp, left);
    s.hp -= dealt;
    /**
     * 手持道具里与「造成伤害」挂钩的两件事：
     *   lifestealPct  造成伤害时回复其 X%（贝壳铃）—— 只算**玩家打出去**的伤害；
     *   healOnKillPct 击败敌人时回血（恶之宝石）在 checkDeath 里结（这里还没判死活）。
     */
    if (meta.source === 'player' && key === 'enemy' && dealt > 0 && modAdd(this.player, 'lifestealPct')) {
      const heal = Math.max(1, Math.round(dealt * modAdd(this.player, 'lifestealPct')));
      const got = Math.min(heal, this.player.maxHp - this.player.hp);
      if (got > 0) {
        this.player.hp += got;
        this.emitLogged({ type: 'heal', side: 'player', amount: got, hp: this.player.hp },
          t('{name} 因手上的道具回复了 {amount} 点 HP。', { name: this.player.name, amount: got }), 'good');
      }
    }
    const label = meta.crit ? t('会心一击！') : '';
    this.emitLogged(
      {
        type: 'damage', side: key, amount: dealt, absorbed, crit: !!meta.crit,
        hp: s.hp, shield: s.shield, index: meta.index ?? 0, total: meta.total ?? 1,
        source: meta.source,
      },
      t('{attacker} 对 {target} 造成 {amount} 点伤害{shield}{label}', {
        attacker: this[meta.source].name,
        target: s.name,
        amount: dealt,
        shield: absorbed ? t('（护盾挡下 {n}）', { n: absorbed }) : '',
        label,
      }),
      key === 'player' ? 'bad' : 'good'
    );
    this.checkDeath();
  }

  checkDeath() {
    // 已经判定过就不要再判一次：否则同一场战斗会重复 emit battleEnd，
    // 日志里就会出现一堆重复的「XX 倒下了……」。
    if (this.over) return;
    if (this.enemy.hp <= 0 && this.player.hp <= 0) {
      this.over = true;
      this.winner = 'draw';
    } else if (this.enemy.hp <= 0) {
      this.over = true;
      this.winner = 'player';
      // 手持道具「击败敌人时回复最大生命 X%」（恶之宝石 / 大蘑菇）
      if (modAdd(this.player, 'healOnKillPct')) {
        const heal = Math.max(1, Math.round(this.player.maxHp * modAdd(this.player, 'healOnKillPct')));
        const got = Math.min(heal, this.player.maxHp - this.player.hp);
        if (got > 0) {
          this.player.hp += got;
          this.emitLogged({ type: 'heal', side: 'player', amount: got, hp: this.player.hp },
            t('{name} 因手上的道具回复了 {amount} 点 HP。', { name: this.player.name, amount: got }), 'good');
        }
      }
    } else if (this.player.hp <= 0) {
      /**
       * 手持道具的「一局一次：濒死时留 1 点生命」（复活草 / 妖异石板）。
       *
       * 放在**判定死亡的那一刻**做，而不是在受伤时扣血 —— 这样它对「中毒致死」
       * 「反伤致死」「真伤致死」全都成立（那些都不走 applyDamage）。
       * 用过就把开关关掉（`usedSurvive` 记在玩家那一侧），一局只有一次。
       */
      if (modFlag(this.player, 'surviveOnce') && !this.player.usedSurvive) {
        this.player.usedSurvive = true;
        this.player.hp = 1;
        this.emitLogged({ type: 'heal', side: 'player', amount: 1, hp: 1 },
          t('手上的道具撑住了 {name} —— 只剩 1 点 HP。', { name: this.player.name }), 'good');
      } else {
        this.over = true;
        this.winner = 'enemy';
      }
    }
    if (this.over) {
      this.emit({ type: 'battleEnd', winner: this.winner, hp: this.player.hp });
      this.pushLog(this.winner === 'player' ? t('{name} 倒下了！', { name: this.enemy.name }) : this.winner === 'enemy' ? t('{name} 倒下了……', { name: this.player.name }) : t('同归于尽。'), this.winner === 'player' ? 'good' : 'bad');
    }
  }

  /** 结束玩家回合 */
  endTurn() {
    if (this.over || this.active !== 'player') return;
    const p = this.player;
    // 手牌保留（上限在抽卡时判定），这里只切换行动方
    this.emit({ type: 'turnEnd', side: 'player' });
    this.decayWeak('player');   // 虚弱用满这一回合才减层
    this.tickBuffs('player');   // 强化也是「用满这一回合」才倒计时（和虚弱同一套计时）
    this.active = 'enemy';
    this.beginEnemyTurn();
  }

  beginEnemyTurn() {
    if (this.over) return;
    const e = this.enemy;
    if (e.keepShield) e.keepShield = false;
    else e.shield = 0;
    e.ap = e.apMax + e.blockBonus;
    e.blockBonus = 0;
    /**
     * 每回合能出几张牌：**按档位封顶**（见 BALANCE.enemyPlaysCap 的说明）。
     * 不封的话，敌人拿着和玩家一样的 8 点行动点、配上 0~1 费的牌，
     * 一回合能打 5~7 张（实测第 6 章精英每回合平均 3.95 张、最凶一回合打掉玩家 89% 血）——
     * 而敌人数值表是按「每回合 3 张」推的。这里把它收回来。
     */
    const cap = BALANCE.enemyPlaysCap?.[e.tier];
    e.playsLeft = cap ? Math.min(e.playMax, cap) : e.playMax;
    this.emit({ type: 'turnStart', side: 'enemy', turn: this.turn, ap: e.ap });
    this.tickStatuses('enemy');
    if (this.over) return;
    this.fireTimers('enemy', 'turn');
    if (this.over) return;
    this.drawCards('enemy', e.drawN);
    this.enemyAct();
  }

  /**
   * 敌人 AI：优先能打出的最高伤害 / 治疗，简单但够用。
   * 会限制「防御/增益类牌」的使用次数——否则敌人一回合叠三张铁壁，战斗会被拖到十几回合。
   */
  enemyAct() {
    let guard = 0;
    let utilityUsed = 0;
    const greedy = this.wantsMaxDamage();
    /**
     * 贪心打法（首领 / 精英）：**先把强化挂上，再全力输出**。
     * 只有当「先挂强化」确实能让这一回合的总伤害更高时才这么做（见 planEnemyTurn）。
     * 杂兵不走这条路（老的那套评分：偶尔漏刀、偶尔先丢强化，看起来更笨）。
     */
    if (greedy) {
      const plan = this.planEnemyTurn();
      if (plan.first) {
        const entry = plan.first;
        const cost = this.cardCost(entry);
        this.enemy.ap -= cost;
        this.enemy.playsLeft -= 1;
        this.decks.enemy.hand.splice(this.decks.enemy.hand.indexOf(entry), 1);
        this.emitLogged(
          { type: 'playCard', side: 'enemy', id: entry.card.id, name: entry.card.name, cost, greedy: true },
          t('{name} 使用了「{card}」。', { name: this.enemy.name, card: entry.card.name })
        );
        this.onCardPlayed?.('enemy', entry.card.id);
        utilityUsed += 1;
        this.resolveCard('enemy', entry.card, {});
        if (entry.card.exhaust) {
          this.decks.enemy.exhaust.push(entry);
          this.emit({ type: 'exhaust', side: 'enemy', id: entry.card.id });
        } else {
          this.decks.enemy.discard.push(entry);
          this.emit({ type: 'discard', side: 'enemy', cards: [entry.card.id] });
        }
      }
    }
    while (!this.over && guard++ < 14) {
      const e = this.enemy;
      if ((e.playsLeft ?? 0) <= 0) break;
      const playable = this.decks.enemy.hand.filter((c) => this.cardCost(c) <= e.ap);
      if (!playable.length) break;
      const scored = playable.map((c) => ({ c, score: this.scoreCard('enemy', c.card) }));
      scored.sort((a, b) => b.score - a.score);
      const pick = scored[0];
      if (pick.score <= 0) break;
      // 一回合最多用一张「非伤害类」牌；而且护盾已经很厚时不再继续叠盾，
      // 否则敌人会一直铁壁，战斗被拖到十几回合（首领战特别明显）。
      const isUtility = !pick.c.card.effects.some((eff) => eff.kind === 'damage');
      const shieldHeavy = e.shield > e.maxHp * 0.12;
      if (isUtility && (utilityUsed >= 1 || (shieldHeavy && pick.c.card.effects.some((eff) => eff.kind === 'shield')))) {
        const alt = scored.find((x) => x.c.card.effects.some((eff) => eff.kind === 'damage') && x.score > 0);
        if (alt) { pick.c = alt.c; pick.score = alt.score; }
        else break;
      } else if (isUtility) {
        utilityUsed += 1;
      }

      e.ap -= this.cardCost(pick.c);
      e.playsLeft -= 1;
      this.decks.enemy.hand.splice(this.decks.enemy.hand.indexOf(pick.c), 1);
      this.emitLogged({ type: 'playCard', side: 'enemy', id: pick.c.card.id, name: pick.c.card.name, cost: this.cardCost(pick.c) }, t('{name} 使用了「{card}」。', { name: e.name, card: pick.c.card.name }));
      // 玩家**看见敌方出招** → 图鉴把这张牌记成「见过」（只给敌人用的牌就靠这一条解锁）
      this.onCardPlayed?.('enemy', pick.c.card.id);
      // 非攻击卡要让人看清，稍作停顿由 UI 处理
      this.resolveCard('enemy', pick.c.card, {});
      if (pick.c.card.exhaust) {
        this.decks.enemy.exhaust.push(pick.c);
        this.emit({ type: 'exhaust', side: 'enemy', id: pick.c.card.id });
      } else {
        // 和玩家同一条规则：打出去的牌进弃牌堆，牌堆抽空时才洗回来
        this.decks.enemy.discard.push(pick.c);
        this.emit({ type: 'discard', side: 'enemy', cards: [pick.c.card.id] });
      }
    }
    this.emit({ type: 'turnEnd', side: 'enemy' });
    this.decayWeak('enemy');    // 同上：敌人的虚弱也在它回合结束时才减层
    this.tickBuffs('enemy');    // 敌人的强化同理
    if (!this.over) {
      this.beginPlayerTurn();
    }
  }

  /**
   * 这一档敌人会不会「**追求本回合的最大伤害**」（用户要的规则）。
   *
   * 用户的原话：「目前敌人也有出现出的牌并不追求最高威力的情况，体现在有强化卡牌和输出卡牌
   * 情况下，敌人打完输出卡牌才会出强化卡牌。因此，你可以让敌人出卡时追求打出最高的伤害
   * （BOSS 会这样，精英有很大概率这样，普通小怪不会）。」
   *
   * 老 AI 的病根：强化牌的分值是**固定小分**（`Math.min(6, …)`），永远比不上一张伤害牌，
   * 于是它总是先把输出打完、最后才丢一张强化 —— 而强化牌的效果（力量 / 攻击 buff）本该
   * 让**这一回合**的输出更高。现在对首领和精英改成真正的计划：先算「先挂强化再全力输出」
   * 和「直接全力输出」哪个总伤害更高，取高的那个。
   */
  wantsMaxDamage() {
    const kind = this.enemy?.tier;
    if (kind === 'boss') return true;
    if (kind === 'elite') return this._eliteGreedy ?? false;
    return false;
  }

  /** 按「每点行动点的伤害」降序把伤害牌装进预算里，返回总伤害 */
  packDamage(cards, budget, over = null) {
    const list = cards
      .map((c) => ({ cost: this.cardCost(c), dmg: this.cardDamage('enemy', c.card, over) }))
      .filter((x) => x.dmg > 0 && x.cost <= budget)
      .sort((a, b) => (b.dmg / Math.max(1, b.cost)) - (a.dmg / Math.max(1, a.cost)));
    let left = budget;
    let total = 0;
    for (const x of list) {
      if (x.cost > left) continue;
      left -= x.cost;
      total += x.dmg;
    }
    return total;
  }

  /**
   * 一张**非伤害牌**打出去之后，本回合的攻防参数会变成什么（只算影响伤害的那几种）。
   * 只做这些近似：力量 / 攻击 buff / 威力强化 / AP 与行动点 / 多一次出牌（折算成 2 点 AP）。
   */
  overridesAfter(card) {
    const e = this.enemy;
    const over = {};
    let apGain = 0;
    for (const eff of card.effects ?? []) {
      if (eff.kind === 'strength') over.strength = (over.strength ?? e.strength ?? 0) + eff.n;
      else if (eff.kind === 'buff' && eff.target !== 'enemy' && eff.stat === 'atk') {
        const add = eff.pct != null ? Math.round((e.atk ?? 0) * eff.pct) : eff.amount;
        over.atk = (over.atk ?? e.atk) + add;
      }
      /**
       * 「威力 +n%」的强化：`damagePowerOf` 的最后一个参数是**倍率**（1.7 = +70%），
       * 所以这里要把百分比换算成倍率（÷100）。
       *
       * ⚠ 这里以前直接塞的是 `eff.n`（= 70），而 `cardDamage` 拿它当倍率用（`1 + powBuff` = ×71）——
       * 于是「先挂一张威力强化牌」在 AI 的试算里被高估了 70 倍，
       * 敌人会**毫无道理地优先去打强化牌**，战斗界面那条威胁预判也会报出
       * 「下回合预计 7627 伤害」这种荒唐数字（实测在基格尔德身上撞到过）。
       */
      else if (eff.kind === 'grantBuff' && eff.buff === 'power') over.powBuff = (over.powBuff ?? 0) + (eff.n ?? 0) / 100;
      else if (eff.kind === 'grantBuff' && eff.buff === 'apMax') apGain += eff.n ?? 0;
      else if (eff.kind === 'ap' || eff.kind === 'apBonus') apGain += eff.n ?? 0;
      else if (eff.kind === 'plays') apGain += 2;   // 多一次出牌 ≈ 多 2 点行动点
      else if (eff.kind === 'delay' || eff.kind === 'trigger') apGain += 0;   // 延后生效：本回合不涨伤害
    }
    return { over, apGain };
  }

  /**
   * 敌方这一回合的计划：**先手的那张非伤害牌（如果有）**。
   * 只有「先挂它再输出」的总伤害**严格高于**直接输出时才采用。
   *
   * @param {Array} [hand] 用哪一手牌来算（默认：敌人现在真的握在手里的那些）。
   *   预判（predictEnemyThreat）要拿**它下回合可能抽到的手牌**来算，所以留了这个口子。
   * @param {number} [apBudget] 行动点预算。默认用敌人**当前**的行动点 ——
   *   注意轮到玩家行动时敌人的 AP 是 0，所以预判必须显式传「它下回合会有多少 AP」，
   *   否则这里会把所有牌都过滤掉、永远算不出「先挂强化」（预判偏低的元凶之一）。
   */
  planEnemyTurn(hand = null, apBudget = null) {
    const e = this.enemy;
    const ap0 = apBudget ?? (e.ap ?? 0);
    const list = (hand ?? this.decks.enemy.hand).filter((c) => this.cardCost(c) <= ap0);
    let best = { total: this.packDamage(list, ap0), first: null };
    for (const c of list) {
      if ((c.card.effects ?? []).some((x) => x.kind === 'damage')) continue;   // 只看非伤害牌
      const cost = this.cardCost(c);
      const { over, apGain } = this.overridesAfter(c.card);
      const rest = list.filter((x) => x !== c);
      const total = this.packDamage(rest, ap0 - cost + apGain, over);
      if (total > best.total + 0.5) best = { total, first: c, gain: total - best.total };
    }
    return best;
  }

  /** 给敌人卡牌打分（越大越想用） */
  scoreCard(key, card) {
    const foeKey = key === 'player' ? 'enemy' : 'player';
    const self = this[key];
    const foe = this[foeKey];
    let score = 0;
    for (const eff of card.effects) {
      switch (eff.kind) {
        case 'damage': {
          const hits = eff.hits ?? 1;
          const mul = key === 'enemy' ? BALANCE.enemyAtkMul * (self.powerMul ?? 1) : 1;
          const perHit = computeHit(self, foe, damagePowerOf(self, foe, eff), { ignoreDefPct: eff.ignoreDefPct ?? 0, attackMul: mul });
          // 能直接斩杀就大幅加分
          score += perHit * hits * 1.0;
          if (perHit * hits >= foe.hp + foe.shield) score += 40;
          break;
        }
        case 'heal': {
          const missing = self.maxHp - self.hp;
          const amount = eff.pct ? self.maxHp * eff.pct : eff.amount;
          // 只有真的受伤了才值得用治疗牌
          score += Math.min(missing, amount) * 0.9;
          break;
        }
        case 'shield':
          score += eff.amount * (1 + (eff.scaleWithDef ? effectiveDef(self) / 12 : 0)) * 0.5;
          break;
        case 'buff': {
          // 场面型增益不能当输出用，否则 AI 会一直叠 buff 不打人
          const amt = eff.pct != null ? Math.round((self[eff.stat] ?? 0) * eff.pct) : eff.amount;
          score += amt > 0 ? Math.min(6, amt * 1.1) : 4;
          break;
        }
        case 'status': {
          // 持续伤害的价值随目标血量上升（百分比结算），所以这里按层数 + 血量估
          const w = eff.status === 'toxic' ? 3.4 : eff.status === 'poison' ? 3 : 2.5;
          score += Math.min(14, eff.stacks * w);
          break;
        }
        case 'strength':
          score += Math.min(8, Math.abs(eff.n) * 0.25);
          break;
        case 'detonate': {
          const stacks = DOT_STATUSES.reduce((n, st) => n + (foe[st] ?? 0), 0);
          score += stacks > 0 ? Math.min(30, stacks * 3) : -5;
          break;
        }
        case 'statusDouble': {
          // 翻倍本身不产生伤害，价值全看对手身上已经铺了多少层（没层数就是废牌）
          const stacks = DOT_STATUSES.reduce((n, st) => n + (foe[st] ?? 0), 0);
          score += stacks >= 3 ? Math.min(26, stacks * 2.6) : -6;
          break;
        }
        case 'statusSteal': {
          // 转嫁：自己身上层数越多越值得打（把要吃的伤害还给对手）
          const mine = DOT_STATUSES.reduce((n, st) => n + (self[st] ?? 0), 0);
          score += mine >= 2 ? Math.min(24, mine * 3) : -6;
          break;
        }
        case 'plays':
          score += 5;
          break;
        case 'apBonus':
        case 'draw':
        case 'ap':
          score += 2;
          break;
        default:
          break;
      }
    }
    // 治疗 / 护盾只在有需要时才有价值
    const hpPct = self.hp / self.maxHp;
    for (const eff of card.effects) {
      if (eff.kind === 'heal' && hpPct > 0.75) score -= 20;
      if (eff.kind === 'shield' && hpPct > 0.85) score -= 8;
    }
    if (hpPct < 0.3) {
      for (const eff of card.effects) {
        if (eff.kind === 'heal') score += 25;
        if (eff.kind === 'shield') score += 10;
      }
    }
    return score;
  }

  /** 一张牌按当前攻防能打出多少伤害（多段求和，不含暴击/闪避的随机成分）
   *  @param {object} [over] 临时参数（AI 试算「先挂强化会怎样」时用）：atk / strength / powBuff */
  cardDamage(key, card, over = null) {
    const self0 = this[key];
    const self = over ? { ...self0, ...over } : self0;
    const foe = this[key === 'player' ? 'enemy' : 'player'];
    const mul = key === 'enemy' ? BALANCE.enemyAtkMul * (self.powerMul ?? 1) : 1;
    let total = 0;
    for (const eff of card.effects) {
      if (eff.kind !== 'damage') continue;
      const power = damagePowerOf(self, foe, eff, 1 + (over?.powBuff ?? 0));
      const perHit = computeHit(self, foe, power, { ignoreDefPct: eff.ignoreDefPct ?? 0, attackMul: mul });
      total += perHit * (eff.hits ?? 1);
    }
    return total;
  }

  /**
   * 预判敌方下回合的威胁上界（只读，不改任何状态）。
   *
   * 为什么需要它：敌人是在**它自己回合开始时**才抽牌的，所以轮到玩家行动时
   * decks.enemy.hand 基本都是空的 —— 界面拿手牌去猜，永远只能得出「无计可施」。
   * 所以这里拿「整副牌 + 下回合的行动点 / 出牌数」把它下个回合**照着真 AI 演一遍**，
   * 得到「抽得最顺时最多能打出多少」。
   *
   * ⚠ 用户报过「这条非常不准」—— 根因是它和 `enemyAct()` **各写了一套**：
   *   ① 老版本按 `scoreCard` 选牌、却不把「先挂强化」算进去 ——
   *      于是「过热（+120 力量）之后再打两张」这种回合会被低估一大截；
   *   ② 它用的是 `e.playMax`，而真 AI 现在按档位封顶（BALANCE.enemyPlaysCap）；
   *   ③ 真 AI 一回合最多用一张非伤害牌、而且精英 / 首领可能先手挂强化。
   * 现在这里逐条对齐 `enemyAct()` 的执行顺序（强化 → 再按评分贪心出牌），
   * 并且**用同一个 `cardDamage` 在同一个模拟状态上累加** —— 两套逻辑从此只有一份。
   */
  predictEnemyThreat() {
    const e = this.enemy;
    const out = { damage: 0, expected: 0, topName: null, topDamage: 0, cards: 0 };
    const pool = [...this.decks.enemy.hand, ...this.decks.enemy.draw, ...this.decks.enemy.discard];
    if (!pool.length) return out;

    // 它下回合最多能拿到的牌 = 手牌 + 抽牌数。取「最好的那几张」当上界，
    // 而不是「整副牌都能用」的荒唐上界。
    const handSize = Math.max(1, (e.drawN ?? 4) + this.decks.enemy.hand.length);
    /** 把「这一手牌照着真 AI 打一遍」算出来的伤害（上界与期望值共用这一份） */
    const playOut = (hand) => this.planThreatDamage(hand);
    const topN = (score) => pool.slice().sort((a, b) => score(b) - score(a)).slice(0, handSize);

    /**
     * **上界**：两种「最好的一手」都试一遍，取高的那个 ——
     *   ① 按评分排（AI 自己挑牌的口味：它会留一张强化牌）；
     *   ② 按伤害排（全是输出牌的那一手）。
     * 只按评分排会漏掉「一手全是 285 的大招」这种情况（评分给状态 / 强化牌也加分），
     * 实测出现过「最多 276 < 预计 349」这种自相矛盾的数。
     */
    const byScore = playOut(topN((c) => this.scoreCard('enemy', c.card)));
    const byDamage = playOut(topN((c) => this.cardDamage('enemy', c.card, null)));
    const best = byDamage.damage > byScore.damage ? byDamage : byScore;
    out.damage = best.damage;
    out.topName = best.topName;
    out.topDamage = best.topDamage;
    out.cards = best.cards;

    /**
     * **期望值**：同样是照着真 AI 打一遍，但手牌改成**随机抽**
     * （敌人是随机抽牌的，「最顺的一手」只是上界，玩家真正想知道的是「大概会挨多少」）。
     *
     * 为什么不用真随机：这个数每次重画界面都会算一遍，随机会让它一直跳；
     * 所以用一个**由回合数与牌堆状态推出来的种子**，同一回合内结果稳定。
     * 抽样 32 次够稳（这个数只用来给玩家一个量级感，不需要精确）。
     */
    if (pool.length > handSize) {
      let seed = ((this.turn * 2654435761) ^ (pool.length * 40503) ^ (this.enemy.hp * 7919) ^ (this.player.hp * 104729)) >>> 0;
      const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
      const K = 32;
      let sum = 0;
      for (let k = 0; k < K; k += 1) {
        const bag = pool.slice();
        const hand = [];
        for (let i = 0; i < handSize && bag.length; i += 1) {
          hand.push(bag.splice(Math.floor(rand() * bag.length), 1)[0]);
        }
        sum += playOut(hand).damage;
      }
      out.expected = Math.round(sum / K);
    } else {
      // 整副牌都在手上：期望值就等于上界
      out.expected = out.damage;
    }
    // 上界永远不该低于期望值（两种手牌都试过之后仍可能出现，兜一下）
    out.damage = Math.max(out.damage, out.expected);
    return out;
  }

  /**
   * 「这一手牌按真 AI 的打法能造成多少伤害」——`predictEnemyThreat` 的上下界共用它。
   *
   * 逐条对齐 `enemyAct()`：① 精英 / 首领可能先手挂一张强化（用同一个 planEnemyTurn 判断）；
   * ② 之后按评分贪心；③ 一回合最多一张非伤害牌；④ 出牌数按档位封顶。
   * **只读**：不改任何战斗状态（用 over 这套临时参数模拟强化链）。
   */
  planThreatDamage(hand) {
    const e = this.enemy;
    let ap = (e.apMax ?? 0) + (e.blockBonus ?? 0);
    const cap = BALANCE.enemyPlaysCap?.[e.tier];
    let plays = cap ? Math.min(e.playMax ?? 0, cap) : (e.playMax ?? 0);
    const out = { damage: 0, topName: null, topDamage: 0, cards: 0 };
    let over = null;
    let utility = 0;
    let remaining = hand.slice();

    // ① 先手那张非伤害牌：和 enemyAct 用同一个判断
    if (this.wantsMaxDamage()) {
      const plan = this.planEnemyTurn(remaining, ap);
      if (plan.first) {
        const entry = plan.first;
        const { over: ov, apGain } = this.overridesAfter(entry.card);
        over = { ...(over ?? {}), ...ov };
        ap -= this.cardCost(entry) - apGain;
        plays -= 1;
        utility += 1;
        out.cards += 1;
        remaining = remaining.filter((c) => c !== entry);
      }
    }
    // ② 之后按评分贪心，和 enemyAct 的主循环同一套
    let guard = 0;
    while (plays > 0 && guard++ < 12) {
      const cands = remaining
        .filter((c) => this.cardCost(c) <= ap)
        .map((c) => ({ c, score: this.scoreCard('enemy', c.card), dmg: this.cardDamage('enemy', c.card, over) }))
        .sort((a, b) => b.score - a.score);
      if (!cands.length) break;

      let pick = cands[0];
      if (!pick.c.card.effects.some((eff) => eff.kind === 'damage')) {
        if (utility >= 1) {
          const alt = cands.find((x) => x.dmg > 0);
          if (!alt) break;
          pick = alt;
        } else {
          utility += 1;
        }
      }
      if (pick.dmg <= 0 && pick.score <= 0) break;

      out.damage += pick.dmg;
      out.cards += 1;
      if (pick.dmg > out.topDamage) { out.topDamage = pick.dmg; out.topName = pick.c.card.name; }
      const { over: ov } = this.overridesAfter(pick.c.card);
      if (Object.keys(ov).length) over = { ...(over ?? {}), ...ov };
      ap -= this.cardCost(pick.c);
      plays -= 1;
      remaining.splice(remaining.indexOf(pick.c), 1);
    }
    return out;
  }

  snapshot(key) {
    const s = this[key];
    return {
      key, name: s.name, slug: s.slug, hp: s.hp, maxHp: s.maxHp,
      shield: s.shield, ap: s.ap, apMax: s.apMax,
      playsLeft: s.playsLeft ?? 0, playMax: s.playMax ?? 0,
      atk: effectiveAtk(s), def: effectiveDef(s), agi: effectiveAgi(s), luck: effectiveLuck(s),
      poison: s.poison, toxic: s.toxic, burn: s.burn, weak: s.weak, bleed: s.bleed,
      strength: s.strength ?? 0,
      hand: this.decks[key].hand.map((c) => c.id),
      drawCount: this.decks[key].draw.length,
      discardCount: this.decks[key].discard.length,
      exhaustCount: this.decks[key].exhaust.length,
    };
  }

  takeEvents() {
    const ev = this.events;
    this.events = [];
    return ev;
  }

  /** 方便 UI 拿到当前手牌 */
  hand(key = 'player') {
    return this.decks[key].hand;
  }
}

function statName(stat) {
  // 属性名的中文表在 src/core/ui-words.js（纯数据模块，待翻清单扫得到）；
  // 以前这里手抄了一份，抄在函数里的字面量既进不了清单、也和别处容易走散。
  return t(STAT_NAMES[stat] ?? stat);
}
