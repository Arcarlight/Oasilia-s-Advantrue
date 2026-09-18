// 战斗引擎：纯逻辑 + 事件流。
// 引擎不碰 DOM，只把发生的事写进 state.events，UI 负责按顺序演出这些事件。
//
// 核心规则（用户需求）：
//   · AP 每回合回复到「由敏捷决定」的固定值
//   · 攻击方 ATK + 卡牌威力，减去防守方 DF 的减伤后造成伤害
//   · 每回合双方抽卡；卡牌使用后要么销毁（exhaust），要么回到卡组最底端
//   · 敏捷越高，每回合抽卡越多、手牌上限越大
//   · 战斗结束后玩家 HP 保留（由外部 state 处理）

import { BALANCE, apFromAgi, drawFromAgi, handFromAgi, playsFromAgi, critChance, dodgeChance } from '../data/balance.js';
import { CARD_BY_ID } from '../data/cards.js';
import { makeRng } from './rng.js';

export const STATUS_INFO = {
  poison: { name: '中毒', art: 'flask_half', color: '#a86ce0', desc: '回合开始流失等于层数的生命，然后层数 -1。' },
  burn: { name: '灼伤', art: 'flare_1', color: '#ff8a3c', desc: '回合开始流失等于层数的生命，层数不减。' },
  weak: { name: '虚弱', art: 'smoke_1', color: '#8f8f8f', desc: '攻击力下降 25%。' },
  bleed: { name: '出血', art: 'slash_1', color: '#e35b5b', desc: '每次受到攻击额外流失层数的生命。' },
};

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
    burn: 0,
    weak: 0,
    bleed: 0,
    ap: 0,
    apMax: 0,
    drawN: 0,
    handMax: 0,
    blockBonus: 0,
  };
}

export function effectiveAtk(side) {
  const base = Math.max(0, (side.atk ?? 0) + (side.atkMod ?? 0));
  return Math.max(0, Math.round((side.weak ?? 0) > 0 ? base * 0.75 : base));
}
export function effectiveDef(side) {
  return Math.max(0, Math.round((side.def ?? 0) + (side.defMod ?? 0)));
}
export function effectiveAgi(side) {
  return Math.max(1, Math.round((side.agi ?? 1) + (side.agiMod ?? 0)));
}
export function effectiveLuck(side) {
  return Math.max(0, Math.round((side.luck ?? 0) + (side.luckMod ?? 0)));
}

/**
 * 削弱下限：攻击 / 防御 / 敏捷 的下降最多到「基础值的 debuffFloorPct」（默认一半）。
 * 每次应用 buff 后（recalcDerived）与读取数值时都会走一遍，
 * 保证不管历史数据怎么写，防御都不会被压成负数（0 防御＝减伤公式形同虚设）。
 */
export function clampDebuffs(s) {
  const floor = BALANCE.debuffFloorPct ?? 0.5;
  const clampOne = (base, mod) => Math.max(-Math.max(0, Math.round((base ?? 0) * (1 - floor))), mod ?? 0);
  s.atkMod = clampOne(s.atk, s.atkMod);
  s.defMod = clampOne(s.def, s.defMod);
  s.agiMod = clampOne(s.agi, s.agiMod);
  return s;
}

  /** 单次命中的伤害计算（opts.attackMul 用于敌方输出修正） */
export function computeHit(attacker, defender, power, opts = {}) {
  const { ignoreDefPct = 0, critMult = BALANCE.luckCritMult, isCrit = false, attackMul = 1 } = opts;
  const effAtk = effectiveAtk(attacker) * attackMul;
  // 注意：这里必须先取整再算减伤，否则小数值的攻击力会被四舍五入吃掉
  const raw = Math.round(effAtk + (power + (attacker.strength ?? 0)) * attackMul);
  const def = effectiveDef(defender) * (1 - ignoreDefPct);
  let dmg = Math.round((raw * BALANCE.armorK) / (BALANCE.armorK + def));
  if (isCrit) dmg = Math.round(dmg * critMult);
  dmg += defender.bleed ?? 0;
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

    const e = cfg.enemy;
    this.enemy = cloneSide({
      key: 'enemy',
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
      s.apMax = apFromAgi(agi);
      s.drawN = drawFromAgi(agi);
      s.handMax = handFromAgi(agi);
      s.playMax = playsFromAgi(agi);
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
   * 从卡组顶抽 n 张；牌堆空时把弃牌堆洗回卡组。
   * 抽牌数故意设计成大于手牌上限——超出部分会自动丢进弃牌堆，
   * 这样每回合的「新牌供应」是稳定的，玩家不主动出牌就会被卡住。
   *
   * 关于「一张牌能不能在同一回合里被反复抽回来」：
   * 曾经加过一条「打出去的牌当回合抽不回来」的规则，用来堵「子弹拳 + 电光一闪」两张
   * 0 费抽 1 互相刷的连招。但那条规则把**所有**小卡组一起废掉了（2 张卡组从每回合 8 张
   * 掉到 2 张），而真正的病根其实是「出战卡组可以随便挑成 2 张」——
   * 那个开关已经取消（出战卡组 = 全部所持卡牌，精简要花钱删卡），所以这条规则**已回退**。
   *
   * 现在小卡组轮换是**花钱买来的构筑**（商店删卡），而且有出牌上限兜底：
   * 不管怎么轮换，一回合最多也就打 `playMax`（3 + 敏捷÷2，上限 9）张牌 —— 不会死循环。
   */
  drawCards(key, n) {
    const d = this.decks[key];
    const max = this[key].handMax;
    const drawn = [];
    for (let i = 0; i < n; i++) {
      if (d.draw.length === 0) {
        if (d.discard.length === 0) break;
        d.draw = this.rng.shuffle(d.discard);
        d.discard = [];
        this.emit({ type: 'reshuffle', side: key });
      }
      const card = d.draw.shift();
      if (d.hand.length >= max) {
        // 手牌满了：新抽到的牌直接进弃牌堆
        d.discard.push(card);
        this.emit({ type: 'discard', side: key, cards: [card.id], overdraw: true });
        continue;
      }
      d.hand.push(card);
      drawn.push(card);
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
   * 那份反馈实际是「打出去洗回牌堆底端、又被抽回来」的正常轮换（同一张牌，
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
    this.emitLogged({ type: 'battleStart', player: this.snapshot('player'), enemy: this.snapshot('enemy') }, `遭遇 ${this.enemy.name}！`);
    this.beginPlayerTurn();
  }

  /** 回合开始的持续伤害与状态结算 */
  tickStatuses(key) {
    const s = this[key];
    if (s.poison > 0) {
      const dmg = s.poison;
      this.dealTrueDamage(key, dmg, '中毒');
      s.poison = Math.max(0, s.poison - 1);
      this.emit({ type: 'status', side: key, status: 'poison', delta: -1, value: s.poison });
    }
    if (s.burn > 0) {
      this.dealTrueDamage(key, s.burn, '灼伤');
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
    this.emitLogged({ type: 'trueDamage', side: key, amount: dealt, hp: s.hp, reason }, `${s.name} 因${reason}失去 ${dealt} 点 HP。`, 'bad');
    this.checkDeath();
    return dealt;
  }

  beginPlayerTurn() {
    if (this.over) return;
    this.turn += 1;
    this.active = 'player';
    const p = this.player;
    // 护盾在自身回合开始时清空（保留一整个敌方回合）
    p.shield = 0;
    p.ap = p.apMax + p.blockBonus;
    p.blockBonus = 0;
    p.playsLeft = p.playMax;
    this.emit({ type: 'turnStart', side: 'player', turn: this.turn, ap: p.ap });
    this.tickStatuses('player');
    if (this.over) return;
    this.drawCards('player', p.drawN);
  }

  /** 玩家出牌 */
  playCard(uid, opts = {}) {
    if (this.over || this.active !== 'player') return { ok: false, reason: '不是你的回合' };
    const d = this.decks.player;
    const idx = d.hand.findIndex((c) => c.uid === uid);
    if (idx < 0) return { ok: false, reason: '手牌里没有这张卡' };
    const entry = d.hand[idx];
    const card = entry.card;
    const cost = this.cardCost(entry);
    if (cost > this.player.ap) return { ok: false, reason: 'AP 不足' };
    if ((this.player.playsLeft ?? 0) <= 0) return { ok: false, reason: '本回合出牌次数已用完' };

    this.player.ap -= cost;
    this.player.playsLeft -= 1;
    d.hand.splice(idx, 1);
    this.emitLogged({ type: 'playCard', side: 'player', id: card.id, name: card.name, cost }, `${this.player.name} 使用了「${card.name}」。`);
    this.resolveCard('player', card, opts);

    // 使用后的去向：销毁区 or 卡组最底端
    // （牌堆空时再抽就会把弃牌堆洗回来；小卡组靠「打完回底端」在同一回合内反复抽到，
    //  这是允许的构筑玩法 —— 一回合最多打 playMax 张，不会失控，详见 drawCards 的说明）
    if (card.exhaust) {
      d.exhaust.push(entry);
      this.emit({ type: 'exhaust', side: 'player', id: card.id });
    } else {
      d.draw.push(entry);
      this.emit({ type: 'toBottom', side: 'player', id: card.id });
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
    for (const eff of card.effects) {
      if (this.over) break;
      if (hasDamage && damageAttempted && !damageLanded && this.targetsFoe(eff)) continue;
      const res = this.resolveEffect(sourceKey, eff, opts);
      if (eff.kind === 'damage') {
        damageAttempted = true;
        if (!res?.allDodged) damageLanded = true;
      }
    }
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
        const amount = Math.round(eff.amount * scale * (1 + (self.shieldBonus ?? 0)));
        self.shield += amount;
        this.emitLogged({ type: 'shield', side: sourceKey, amount, total: self.shield }, `${self.name} 获得 ${amount} 点护盾。`, 'good');
        break;
      }
      case 'heal': {
        const amount = eff.pct ? Math.round(self.maxHp * eff.pct) : eff.amount;
        const healed = Math.min(amount, self.maxHp - self.hp);
        self.hp += healed;
        if (healed > 0) {
          this.emitLogged({ type: 'heal', side: sourceKey, amount: healed, hp: self.hp }, `${self.name} 回复 ${healed} 点 HP。`, 'good');
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
        const t = this[targetKey];
        // 属性下降有下限（BALANCE.debuffFloorPct），recalcDerived() 里会把 defMod 等夹住。
        // 所以这里必须报**实际变化量**：夹住之后 delta 可能是 -1 甚至 0，
        // 以前不管夹没夹都照报 eff.amount（例如「防御 -2」），于是界面上日志、音效、
        // 特效全演了一遍，数值却一动不动 —— 看起来就像「削弱没附加成功」。
        const before = this.statValue(targetKey, eff.stat);
        if (eff.stat === 'atk') t.atkMod += eff.amount;
        else if (eff.stat === 'def') t.defMod += eff.amount;
        else if (eff.stat === 'agi') t.agiMod += eff.amount;
        else if (eff.stat === 'luck') t.luckMod += eff.amount;
        this.recalcDerived();
        const after = this.statValue(targetKey, eff.stat);
        const delta = after - before;
        const clamped = delta !== eff.amount;
        const label = `${t.name} 的${statName(eff.stat)}`;
        const text = delta === 0
          ? `${label}已经降到底了（当前 ${after}），这次没能再降。`
          : `${label} ${delta > 0 ? '+' : ''}${delta}（当前 ${after}）${clamped ? '，已经到底了' : ''}。`;
        this.emitLogged(
          { type: 'buff', side: targetKey, stat: eff.stat, amount: delta, requested: eff.amount, clamped, value: after },
          text,
          delta > 0 ? 'good' : 'bad'
        );
        break;
      }
      case 'status': {
        const targetKey = eff.target === 'self' ? sourceKey : foeKey;
        const t = this[targetKey];
        // 有些招式挂状态是「有概率的」（岩崩的虚弱就是）：没中要说清是谁抵抗了什么。
        // 以前这里只 emit 了一个不带日志的 resist 事件，界面上凭空飘出两个字「抵抗」，
        // 玩家根本不知道那是什么意思（实测被问到了）。
        if (eff.chance != null && !this.rng.chance(eff.chance)) {
          const nm = STATUS_INFO[eff.status]?.name ?? eff.status;
          this.emitLogged(
            { type: 'resist', side: targetKey, status: eff.status, chance: eff.chance },
            `${t.name} 抵抗了${nm}。`,
            targetKey === 'player' ? 'good' : 'bad'
          );
          break;
        }
        t[eff.status] = (t[eff.status] ?? 0) + eff.stacks;
        this.emitLogged(
          { type: 'status', side: targetKey, status: eff.status, delta: eff.stacks, value: t[eff.status] },
          `${t.name} 获得了 ${eff.stacks} 层${STATUS_INFO[eff.status].name}。`,
          targetKey === 'player' ? 'bad' : 'good'
        );
        break;
      }
      case 'selfDmg':
        this.dealTrueDamage(sourceKey, eff.amount, '反作用力');
        break;
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
        if ((self.atkMod ?? 0) < 0) { removed.push(`攻击 ${self.atkMod}`); self.atkMod = 0; }
        if ((self.defMod ?? 0) < 0) { removed.push(`防御 ${self.defMod}`); self.defMod = 0; }
        if ((self.agiMod ?? 0) < 0) { removed.push(`敏捷 ${self.agiMod}`); self.agiMod = 0; }
        if (eff.statuses) {
          for (const st of ['poison', 'burn', 'weak', 'bleed']) {
            if ((self[st] ?? 0) > 0) { removed.push(`${STATUS_INFO[st].name} ${self[st]}`); self[st] = 0; }
          }
        }
        this.recalcDerived();
        this.emitLogged(
          { type: 'cleanse', side: sourceKey, removed: removed.length },
          removed.length ? `${self.name} 清除了身上的削弱（${removed.join('、')}）。` : `${self.name} 身上没有可清除的削弱。`,
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
      this.emitLogged({ type: 'dodge', side: foeKey, index: hitIndex }, `${defender.name} 闪开了攻击！`, foeKey === 'player' ? 'good' : 'bad');
      return { dodged: true };
    }

    // 暴击判定
    const crit = this.rng() * 100 < critChance(effectiveLuck(attacker));
    let power = eff.power;
    // 斩杀类：目标血量低于阈值时额外加成
    if (eff.execThreshold != null && defender.hp / defender.maxHp < eff.execThreshold) {
      power += eff.execBonus ?? 0;
    }
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
          `${attacker2.name} 吸取了 ${healed} 点生命。`,
          sourceKey === 'player' ? 'good' : 'bad'
        );
      }
    }

    if (eff.recoilPct) {
      const recoil = Math.max(1, Math.round(dmg * eff.recoilPct));
      this.dealTrueDamage(sourceKey, recoil, '反作用力');
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
    const label = meta.crit ? '会心一击！' : '';
    this.emitLogged(
      {
        type: 'damage', side: key, amount: dealt, absorbed, crit: !!meta.crit,
        hp: s.hp, shield: s.shield, index: meta.index ?? 0, total: meta.total ?? 1,
        source: meta.source,
      },
      `${this[meta.source].name} 对 ${s.name} 造成 ${dealt} 点伤害${absorbed ? `（护盾挡下 ${absorbed}）` : ''}${label}`,
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
    } else if (this.player.hp <= 0) {
      this.over = true;
      this.winner = 'enemy';
    }
    if (this.over) {
      this.emit({ type: 'battleEnd', winner: this.winner, hp: this.player.hp });
      this.pushLog(this.winner === 'player' ? `${this.enemy.name} 倒下了！` : this.winner === 'enemy' ? `${this.player.name} 倒下了……` : '同归于尽。', this.winner === 'player' ? 'good' : 'bad');
    }
  }

  /** 结束玩家回合 */
  endTurn() {
    if (this.over || this.active !== 'player') return;
    const p = this.player;
    // 手牌保留（上限在抽卡时判定），这里只切换行动方
    this.emit({ type: 'turnEnd', side: 'player' });
    this.decayWeak('player');   // 虚弱用满这一回合才减层
    this.active = 'enemy';
    this.beginEnemyTurn();
  }

  beginEnemyTurn() {
    if (this.over) return;
    const e = this.enemy;
    e.shield = 0;
    e.ap = e.apMax + e.blockBonus;
    e.blockBonus = 0;
    e.playsLeft = e.playMax;
    this.emit({ type: 'turnStart', side: 'enemy', turn: this.turn, ap: e.ap });
    this.tickStatuses('enemy');
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
      this.emitLogged({ type: 'playCard', side: 'enemy', id: pick.c.card.id, name: pick.c.card.name, cost: this.cardCost(pick.c) }, `${e.name} 使用了「${pick.c.card.name}」。`);
      // 非攻击卡要让人看清，稍作停顿由 UI 处理
      this.resolveCard('enemy', pick.c.card, {});
      if (pick.c.card.exhaust) {
        this.decks.enemy.exhaust.push(pick.c);
        this.emit({ type: 'exhaust', side: 'enemy', id: pick.c.card.id });
      } else {
        // 和玩家同一条规则：打出去的牌回牌堆底部，同一回合可能再被抽到
        this.decks.enemy.draw.push(pick.c);
        this.emit({ type: 'toBottom', side: 'enemy', id: pick.c.card.id });
      }
    }
    this.emit({ type: 'turnEnd', side: 'enemy' });
    this.decayWeak('enemy');    // 同上：敌人的虚弱也在它回合结束时才减层
    if (!this.over) {
      this.beginPlayerTurn();
    }
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
          let perHit = computeHit(self, foe, eff.power, { ignoreDefPct: eff.ignoreDefPct ?? 0, attackMul: mul });
          if (eff.execThreshold != null && foe.hp / foe.maxHp < eff.execThreshold) perHit += eff.execBonus ?? 0;
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
        case 'buff':
          // 场面型增益不能当输出用，否则 AI 会一直叠 buff 不打人
          score += eff.amount > 0 ? Math.min(6, eff.amount * 1.1) : 4;
          break;
        case 'status':
          score += Math.min(8, eff.stacks * 2.5);
          break;
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

  /** 一张牌按当前攻防能打出多少伤害（多段求和，不含暴击/闪避的随机成分） */
  cardDamage(key, card) {
    const self = this[key];
    const foe = this[key === 'player' ? 'enemy' : 'player'];
    const mul = key === 'enemy' ? BALANCE.enemyAtkMul * (self.powerMul ?? 1) : 1;
    let total = 0;
    for (const eff of card.effects) {
      if (eff.kind !== 'damage') continue;
      let perHit = computeHit(self, foe, eff.power, { ignoreDefPct: eff.ignoreDefPct ?? 0, attackMul: mul });
      if (eff.execThreshold != null && foe.hp / foe.maxHp < eff.execThreshold) perHit += eff.execBonus ?? 0;
      total += perHit * (eff.hits ?? 1);
    }
    return total;
  }

  /**
   * 预判敌方下回合的威胁上界（只读，不改任何状态）。
   *
   * 为什么需要它：敌人是在**它自己回合开始时**才抽牌的，所以轮到玩家行动时
   * decks.enemy.hand 基本都是空的 —— 界面拿手牌去猜，永远只能得出「无计可施」，
   * 这就是之前那个「对手正在蓄势……」怎么写都不变的原因。
   * 现在改成拿「整副牌 + 下回合的行动点/出牌数」按 AI 同一套评分贪心模拟一遍，
   * 得到的是它下回合**最多**能打出多少伤害（真抽到什么牌仍然随机）。
   */
  predictEnemyThreat() {
    const e = this.enemy;
    const out = { damage: 0, topName: null, topDamage: 0, cards: 0 };
    const pool = [...this.decks.enemy.hand, ...this.decks.enemy.draw, ...this.decks.enemy.discard];
    if (!pool.length) return out;

    // 它下回合最多能拿到的牌 = 手牌 + 抽牌数。按分数取最好的那几张，
    // 这样估的是「抽得最顺」的上界，而不是「整副牌都能用」的荒唐上界。
    const handSize = Math.max(1, (e.drawN ?? 4) + this.decks.enemy.hand.length);
    const remaining = pool
      .slice()
      .sort((a, b) => this.scoreCard('enemy', b.card) - this.scoreCard('enemy', a.card))
      .slice(0, handSize);

    let ap = (e.apMax ?? 0) + (e.blockBonus ?? 0);
    let plays = e.playMax ?? 0;
    let utility = 0;
    let guard = 0;
    while (plays > 0 && guard++ < 12) {
      const cands = remaining
        .filter((c) => this.cardCost(c) <= ap)
        .map((c) => ({ c, score: this.scoreCard('enemy', c.card), dmg: this.cardDamage('enemy', c.card) }))
        .sort((a, b) => b.score - a.score);
      if (!cands.length) break;

      let pick = cands[0];
      if (!pick.c.card.effects.some((eff) => eff.kind === 'damage')) {
        // 与真实 AI 一致：一回合最多用一张非伤害牌
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
      poison: s.poison, burn: s.burn, weak: s.weak, bleed: s.bleed,
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
  return { atk: '攻击', def: '防御', agi: '敏捷', luck: '幸运' }[stat] ?? stat;
}
