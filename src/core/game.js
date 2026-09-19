// 游戏状态机：地图 → 战斗 / 事件 / 宝箱 / 商店 / 营地 → 下一章 → 结局。
// 所有玩家数据都在 game.data 里，可序列化（存档直接用 JSON.stringify）。

import { BALANCE, BIOMES, apFromAgi, drawFromAgi, handFromAgi, critChance, dodgeChance } from '../data/balance.js';
import { CARD_BY_ID, ITEMS, STARTER_DECK, STARTER_ITEMS, rollCard, rollCards, CARDS } from '../data/cards.js';
import { ENEMIES, ENEMY_BY_ID, poolFor, scaleEnemy } from '../data/enemies.js';
import { generateMap, nextNodes, startNodes, nodeById, NODE_TYPES, stageCount } from '../data/mapgen.js';
import { eventsFor } from '../data/events.js';
import { pickMerchant, MERCHANTS } from '../data/merchants.js';
import { makeRng } from './rng.js';
import { Battle } from './battle.js';
import { save } from './save.js';
import { t } from './i18n.js';
import { STAT_NAMES } from './ui-words.js';

export const Phase = {
  TITLE: 'title',
  MAP: 'map',
  BATTLE: 'battle',
  EVENT: 'event',
  CHEST: 'chest',
  SHOP: 'shop',
  REST: 'rest',
  REWARD: 'reward',
  GAMEOVER: 'gameover',
  VICTORY: 'victory',
  DECK: 'deck',
};

// 属性名的中文表搬到了 src/core/ui-words.js（纯数据模块：待翻清单靠扫源码收集，
// 表藏在引擎/界面模块里工具既扫不到「谁在用」也 import 不起来）。
// 这里继续导出一次：src/ui/screens.js 等照旧从 game.js 取 STAT_NAMES。
export { STAT_NAMES };

// ================= 道具 =================

/**
 * 一件道具「用下去会发生什么」——**界面和引擎共用这一份判断**。
 *
 * 为什么必须抽出来：背包界面以前自己写了一句 `item.heal ? 显示「使用」按钮 : 显示「已生效」`，
 * 而药水的数据里根本没有 `heal` 字段（它们用的是 `healPct`）——
 * 于是**七件道具全部显示「已生效」、一个「使用」按钮都没有**，背包等于整个是死的
 * （玩家反馈：「道具都写着已生效，像好伤药那种完全没法用」）。
 * 这就是「界面把数据模型的规则又抄了一遍」的老毛病，改数据忘改界面。
 *
 * @returns {{kind:'heal', flat?:number, pct?:number}|{kind:'stat', key:string, amount:number}|null}
 *   null = 这件道具有没有主动使用的效果（那种才该显示「已生效」）
 */
export function itemEffect(item) {
  if (!item) return null;
  if (item.healPct) return { kind: 'heal', pct: item.healPct };
  if (item.heal) return { kind: 'heal', flat: item.heal };
  if (item.stat) {
    const [key, amount] = Object.entries(item.stat)[0] ?? [];
    if (key) return { kind: 'stat', key, amount };
  }
  return null;
}

/**
 * 背包里**真的还有**的东西（数量 > 0，而且认得出来是什么）。
 *
 * 数量为 0 的条目要滤掉：开局数据 `STARTER_ITEMS` 就带着一个 `potion_big: 0`，
 * 用光最后一件时也可能留下 0。以前背包照单全收，于是开局第一眼就是一行
 * 「厉害伤药 ×0」配着一个「使用」按钮，点下去只说「现在用不了」——
 * 这也是「背包看起来整个没用」的一部分。
 */
export function inventoryEntries(items) {
  return Object.entries(items ?? {}).filter(([id, n]) => n > 0 && !!ITEMS[id]);
}

export class Game {
  /**
   * @param {{seed?:number, onChange?:Function}} opts
   */
  constructor(opts = {}) {
    this.onChange = opts.onChange ?? (() => {});
    this.rng = makeRng(opts.seed ?? Math.floor(Math.random() * 1e9));
    this.phase = Phase.TITLE;
    this.data = null;
    this.battle = null;
    this.pendingMap = null;
    this.message = null;
    this.meta = save.readMeta();
    this.usedEvents = [];
    this.awaiting = null; // UI 需要处理的交互（例如战斗结算）
    this.mapDirty = false;
  }

  // ================= 基础工具 =================

  newRun(seed) {
    if (seed != null) this.rng = makeRng(seed);
    const p = BALANCE.player;
    this.usedEvents = [];
    this.data = {
      seed: this.rng.seed,
      name: p.name,
      slug: p.species,
      speciesName: p.speciesName,
      hp: p.maxHp,
      maxHp: p.maxHp,
      atk: p.atk,
      def: p.def,
      agi: p.agi,
      luck: p.luck,
      gold: 60,
      deck: [...STARTER_DECK],
      items: { ...STARTER_ITEMS },
      relics: [],
      battleDeck: null,
      stage: 0,
      map: null,
      nodeId: null,
      route: [],
      floor: 0,
      kills: 0,
      turnsThisRun: 0,
      damageDealt: 0,
      healing: 0,
      startedAt: Date.now(),
    };
    this.data.map = generateMap(0, this.rng);
    this.phase = Phase.MAP;
    this.pendingMap = null;
    this.save();
    this.changed();
    return this.data;
  }

  changed() {
    this.onChange(this);
  }

  save() {
    if (this.data && this.phase !== Phase.TITLE && this.phase !== Phase.GAMEOVER && this.phase !== Phase.VICTORY) {
      save.writeRun(this.data);
      // 顺手把「这一局拿到过哪些卡」记进跨局图鉴：
      // save() 是所有卡牌变动（奖励 / 商店 / 营地 / 宝箱 / 事件）之后的必经之路，
      // 挂在这里就不用去十几个地方各记一次。
      const before = this.meta?.seenCards?.length ?? 0;
      const next = save.noteCards(this.data.deck);
      if ((next.seenCards?.length ?? 0) !== before) this.meta = next;
    }
  }

  loadFromData(data) {
    if (!data || !data.map) return false;
    this.data = data;
    this.phase = Phase.MAP;
    this.pendingMap = null;
    this.changed();
    return true;
  }

  // ================= 属性成长 =================

  getStat(key) {
    return this.data?.[key] ?? 0;
  }

  gainStat(key, amount) {
    const d = this.data;
    const cap = BALANCE.cap[key] ?? 999;
    const before = d[key];
    d[key] = Math.max(1, Math.min(cap, d[key] + amount));
    if (key === 'maxHp') d.hp = Math.min(d.maxHp, d.hp + amount);
    return d[key] - before;
  }

  heal(amount) {
    const d = this.data;
    const healed = Math.min(amount, d.maxHp - d.hp);
    d.hp += healed;
    d.healing += healed;
    return healed;
  }

  takeDamage(amount) {
    const d = this.data;
    const cost = Math.min(amount, d.hp - 1); // 地图事件不会直接致死
    d.hp -= Math.max(0, cost);
    return Math.max(0, cost);
  }

  giveItem(id, n = 1) {
    const item = ITEMS[id];
    const eff = itemEffect(item);
    /**
     * **本局永久生效的道具（护符 / 活力药）拿到就直接生效，不占背包格子。**
     *
     * 为什么：这类道具写的是「本局攻击 +4」——它是永久加成，没有「什么时候用」这个决策，
     * 留在背包里只会让玩家买了却什么都没得到（界面还会显示「已生效」，名不副实）。
     * 药水不一样：**什么时候喝**是真决策，所以留在背包里按需使用。
     *
     * 返回值带上「实际生效了什么」，调用方可以把它写进给玩家看的文案里。
     */
    if (eff?.kind === 'stat') {
      const applied = [];
      for (let i = 0; i < n; i++) {
        const gained = this.gainStat(eff.key, eff.amount);
        applied.push(gained);
      }
      return { id, n, stored: false, applied: { key: eff.key, amount: applied.reduce((a, b) => a + b, 0) } };
    }
    this.data.items[id] = (this.data.items[id] ?? 0) + n;
    return { id, n, stored: true, applied: null };
  }

  useItem(id) {
    const item = ITEMS[id];
    if (!item || (this.data.items[id] ?? 0) <= 0) return null;
    const eff = itemEffect(item);
    if (!eff) return { ok: false, text: t('「{name}」没有可以主动使用的效果。', { name: item.name }) };
    if (eff.kind === 'heal') {
      const amount = eff.pct ? Math.round(this.data.maxHp * eff.pct) : eff.flat;
      if (amount > 0 && this.data.hp >= this.data.maxHp) return { ok: false, text: t('HP 已经满了。') };
      this.consumeItem(id);
      const h = this.heal(amount);
      return { ok: true, text: t('使用「{name}」，回复 {hp} 点 HP。', { name: item.name, hp: h }) };
    }
    // 属性类：正常情况下拿到时就已经生效了（见 giveItem），
    // 这里留着是为了兜住老存档里已经躺在背包里的那几件
    this.consumeItem(id);
    const gained = this.gainStat(eff.key, eff.amount);
    return { ok: true, text: t('使用「{name}」，{stat} +{n}。', { name: item.name, stat: t(STAT_NAMES[eff.key] ?? eff.key), n: gained }) };
  }

  consumeItem(id) {
    this.data.items[id] = (this.data.items[id] ?? 0) - 1;
    if (this.data.items[id] <= 0) delete this.data.items[id];
  }

  addCard(id) {
    this.data.deck.push(id);
    return CARD_BY_ID[id];
  }

  removeCard(id) {
    const i = this.data.deck.indexOf(id);
    if (i >= 0) {
      this.data.deck.splice(i, 1);
      return true;
    }
    return false;
  }

  /** 事件专用：直接塞一张随机卡进卡组并返回卡对象 */
  offerRandomCard(boost = 0) {
    const card = rollCard(boost, this.data.deck);
    this.addCard(card.id);
    return card;
  }

  offerCardOfRarity(rarities = ['rare'], boost = 0.5) {
    for (let i = 0; i < 200; i++) {
      const card = rollCard(boost, []);
      if (rarities.includes(card.rarity)) {
        this.addCard(card.id);
        return card;
      }
    }
    const fallback = CARD_BY_ID['dragon_claw'];
    this.addCard(fallback.id);
    return fallback;
  }

  // ================= 地图 =================

  get map() { return this.data?.map ?? null; }

  /** 当前可选的下一站 */
  availableNodes() {
    if (!this.data?.map) return [];
    if (!this.data.nodeId) return startNodes(this.data.map);
    return nextNodes(this.data.map, this.data.nodeId);
  }

  biomeOfRun() {
    return BIOMES[this.data?.map?.biome ?? 'desert'];
  }

  goToNode(nodeId) {
    const node = nodeById(this.data.map, nodeId);
    if (!node) return;
    this.data.nodeId = node.id;
    this.data.route.push(node.id);
    this.data.floor += 1;
    node.visited = true;
    this.pendingMap = node;
    this.enterNode(node);
  }

  enterNode(node) {
    switch (node.type) {
      case 'battle': return this.startBattle('normal', 0, 'map');
      case 'elite': return this.startBattle('elite', 0, 'map');
      case 'boss': return this.startBossBattle();
      case 'event': return this.startEvent();
      case 'chest': return this.startChest();
      case 'shop': return this.startShop();
      case 'rest': return this.startRest();
      default: return this.startBattle('normal', 0, 'map');
    }
  }

  /** 首领战：开打前先回一口血，免得玩家因为前半章掉了点血就被卡死在这里 */
  startBossBattle() {
    const d = this.data;
    const healed = this.heal(Math.round(d.maxHp * (BALANCE.preBossHealPct ?? 0.35)));
    this.preBossHeal = healed;
    return this.startBattle('boss', 0, 'map');
  }

  /** 章节推进 */
  nextStage() {
    const d = this.data;
    d.stage += 1;
    if (d.stage >= stageCount()) {
      this.phase = Phase.VICTORY;
      this.meta = save.patchMeta({ wins: (this.meta.wins ?? 0) + 1, unlocked: true });
      save.clearRun();
      this.changed();
      return;
    }
    const bonus = BALANCE.stageClearGold[d.stage - 1] ?? 40;
    d.gold += bonus;
    // 打完首领完全恢复：下一章的敌人强度是按满血设计的
    const healLines = [];
    if (BALANCE.fullHealAfterBoss) {
      const healed = this.heal(d.maxHp);
      if (healed > 0) healLines.push(t('HP 完全恢复（+{n}）', { n: healed }));
    }
    d.map = generateMap(d.stage, this.rng);
    d.nodeId = null;
    d.floor = 0;
    this.phase = Phase.MAP;
    this.message = {
      title: t('进入 {biome}', { biome: BIOMES[d.map.biome].name }),
      text: `${t(BIOMES[d.map.biome].desc)}\n\n${t('章节通关奖励：金币 +{gold}', { gold: bonus })}${healLines.length ? '，' + healLines.join('，') : ''}`,
      tone: 'good',
    };
    this.save();
    this.changed();
  }

  // ================= 战斗 =================

  /**
   * 带进战斗的卡组 = **你拥有的全部卡牌**（不可挑着不带）。
   *
   * 以前这里可以自由挑一个子集（2~14 张），结果两头都出问题：
   *   ① 只带「子弹拳 + 电光一闪」两张 0 费抽 1 的牌 → 两张牌互相抽回来，
   *      每回合把出牌上限打满，两回合秒掉对手（用户反馈的「无限循环」）；
   *   ② 把那个连招堵住之后，小卡组又直接变成废物（一回合只能打两张）。
   *
   * 所以干脆取消「挑着不带」这个免费开关：**卡组的厚薄变成资源问题** ——
   * 想精简只能去商店花钱删卡（同一家越删越贵），或者在营地换一张更强的牌。
   * 这也让「带得少 = 更容易抽到关键牌，带得多 = 每回合总量上限更高」这个取舍
   * 由玩家自己攒卡 / 花钱决定，而不是开局随手勾两下。
   */
  activeBattleDeck() {
    return this.data.deck;
  }

  /**
   * 默认出战卡组（按「先带伤害牌、再按每 AP 伤害排序」挑一批）。
   *
   * 现在出战卡组恒等于全部所持卡牌（见 activeBattleDeck），这个函数只留给
   * 诊断脚本 / 模拟器当「一副合理的牌」的参考，游戏里不再调用。
   */
  defaultBattleDeck() {
    const uniq = [];
    const seenCount = new Map();
    for (const id of this.data.deck) {
      const n = (seenCount.get(id) ?? 0) + 1;
      seenCount.set(id, n);
      uniq.push({ id, card: CARD_BY_ID[id], n });
    }
    const isDamage = (card) => !!card && card.effects.some((e) => e.kind === 'damage');
    const ranked = uniq
      .filter((x) => x.card)
      .sort((a, b) => {
        const da = isDamage(a.card) ? 0 : 1;
        const db = isDamage(b.card) ? 0 : 1;
        if (da !== db) return da - db;
        // 同类型里，平均每 AP 的伤害更高优先
        const eff = (x) => {
          const power = x.card.effects.filter((e) => e.kind === 'damage').reduce((s, e) => s + e.power * (e.hits ?? 1), 0);
          return power / Math.max(1, x.card.ap);
        };
        return eff(b) - eff(a);
      });

    const picks = [];
    for (const x of ranked) {
      if (picks.length >= BALANCE.maxBattleDeck) break;
      picks.push(x.id);
    }
    // 重复卡按出现次数补齐，避免同一张卡出现次数超过卡组里实际拥有的数量
    const used = new Map();
    const out = [];
    for (const id of picks) {
      const c = (used.get(id) ?? 0) + 1;
      if (c > (seenCount.get(id) ?? 0)) continue;
      used.set(id, c);
      out.push(id);
    }
    // 保证不少于最小张数
    while (out.length < BALANCE.minBattleDeck && this.data.deck.length) {
      out.push(this.data.deck[out.length % this.data.deck.length]);
    }
    return out;
  }

  /**
   * 兼容旧存档：以前这里能存一份「出战子集」，现在出战卡组恒等于全部卡牌，
   * 所以这个入口只保留「清掉存档里那份旧数据」的作用。
   */
  setBattleDeck() {
    this.data.battleDeck = null;
    this.save();
    return { ok: true };
  }

  /**
   * 生成敌人卡组：从招式池随机抽卡，同时把平均威力压在档位上限之内。
   * 这是防止「一回合三张大地震」秒人的关键。
   *
   * 另外还限制「削弱牌」的数量：削弱是整场战斗永久叠加的，
   * 一副 9 张里塞四五张降属性牌，玩家会一路挨打还还不了手（实测出来的问题）。
   */
  /**
   * 拼一副敌人的牌组。
   *
   * 以前是「从池子里随机抽 9 次」——允许重复、只卡「平均威力上限」，结果出过这种事：
   * 首领的 9 张牌里 **4 张白雾 + 3 张伤害牌**，而那 3 张伤害牌（地震/龙爪/热风）都带销毁，
   * 两个回合就永久打光了，剩下十几个回合它手上只有白雾/铁壁/健美，
   * 于是「每回合只放一张防御牌」混到死（玩家实测反馈）。
   * 现在：牌组放大到跟它的抽牌速度匹配，伤害牌有数量下限，同一张牌有份数上限。
   */
  buildEnemyDeck(pool, kind, scaled, signature = []) {
    // 牌组大小：敌人每回合要抽 6~8 张，牌组太小等于一回合打穿整副牌
    const SIZE = { normal: 14, elite: 18, boss: 22 }[kind] ?? 14;
    // 伤害牌下限：保证「后期还有牌可打」，不会被销毁牌掏空
    const MIN_DAMAGE = { normal: 9, elite: 12, boss: 15 }[kind] ?? 9;
    /**
     * 平均威力上限与单张上限：**三档统一**。
     *
     * 以前是 110/170/210 与 240/380/500，再加上「普通档从弱到强挑、精英首领从强到弱挑」，
     * 结果两边的**每点攻击的杀伤力**差出 2.7 倍。这个差距不会消失，只会转移到别处：
     * 推导工具要给精英凑出同样的每回合压力，就只能把它的攻击力压到比「较强」还低 ——
     * 于是出现了玩家看到的那一幕：**较强 攻 128 / 首领 攻 25**，
     * 「较强的怪甚至比 boss 都强，攻击力比 boss 强 5 倍不止」。
     *
     * 现在三档用同一套规则铺牌，档位之间的强弱改由这几件事承担：
     * 招式包（kit_xxx vs kit_xxx_hi，后者多出大招与强化牌）、血量、攻击力、专属招式。
     * 这样攻击力可以老老实实逐档递增，玩家一眼就能看懂。
     */
    const MAX_AVG = 120;
    const MAX_SINGLE = 300;
    const MAX_DEBUFF = { normal: 1, elite: 2, boss: 2 }[kind] ?? 1;
    /** 同一张非伤害牌最多几份（白雾 ×4 这种事不能再出现） */
    const COPY_UTILITY = 1;
    const BASIC = 'tackle';

    const powerOf = (id) => (CARD_BY_ID[id]?.effects ?? [])
      .filter((e) => e.kind === 'damage')
      .reduce((s, e) => s + e.power * (e.hits ?? 1), 0);
    const isDamage = (id) => powerOf(id) > 0;
    /**
     * 「纯削弱」的牌 —— 用来限制敌人牌组里的削弱密度。
     *
     * 必须**排除带伤害的牌**：像「尖石攻击」这种「造成伤害 + 顺手降对手防御」的牌，
     * 它的身份是攻击牌。以前这里漏了这条排除（注释里写了、代码里没写），
     * 于是首领牌组里塞进两张尖石/落石之后，削弱额度就满了，
     * 后面几圈**再也加不进来任何一张带降防的攻击牌** ——
     * 剩下的位置全被「撞击」兜底灌满，一副 22 张的牌平均威力只有 105%，
     * 首领打起来像小怪（tools/diag-enemydeck.mjs 实测）。
     */
    const isDebuff = (id) => {
      const card = CARD_BY_ID[id];
      if (!card) return false;
      if (card.effects.some((e) => e.kind === 'damage')) return false;
      return card.effects.some((e) => (e.kind === 'buff' && e.target === 'enemy' && ((e.amount ?? 0) < 0 || (e.pct ?? 0) < 0))
        || e.kind === 'status');
    };

    const uniq = [...new Set(pool)].filter((id) => CARD_BY_ID[id] && powerOf(id) <= MAX_SINGLE);
    /**
     * 铺牌顺序：**三档统一从强到弱**。
     *
     * 旧版是「普通档从弱到强、精英首领从强到弱」，本意是「杂兵不靠单张牌打人」，
     * 结果是普通档的牌组被 25% 威力的「撞击 / 抓挠」灌满，平均威力只有精英的一半 ——
     * 推导工具为了给「较强」凑出同样的每回合压力，只能把它的攻击力顶到 128
     * （见上面 MAX_AVG 的注释）。档位差异不该靠「谁手里全是烂牌」来体现。
     */
    const dmgPool = uniq.filter(isDamage).sort((a, b) => powerOf(b) - powerOf(a));
    const utilPool = uniq.filter((id) => !isDamage(id));
    // 同一张伤害牌最多几份：按「把牌组填满还需要重复几轮」来定，
    // 免得池子小而重复上限又低时，剩下的位置全被最弱的普攻（撞击）灌满
    const COPY_DAMAGE = Math.max(2, Math.ceil((SIZE - utilPool.length) / Math.max(1, dmgPool.length)));

    const deck = [];
    const copies = new Map();
    const count = (id) => copies.get(id) ?? 0;
    const add = (id) => { deck.push(id); copies.set(id, count(id) + 1); };

    // ⓪ 专属招式：首领 / 精英的招牌招一定进牌组（各一份），
    //    否则它可能被随机抽牌的骰子漏掉，玩家永远见不到「这一只怪的特点」。
    for (const id of signature) {
      if (CARD_BY_ID[id] && !copies.has(id)) add(id);
    }

    const dmgCount = () => deck.reduce((n, id) => n + (isDamage(id) ? 1 : 0), 0);
    const debuffCount = () => deck.reduce((n, id) => n + (isDebuff(id) ? 1 : 0), 0);
    const sumPower = () => deck.reduce((s, id) => s + powerOf(id), 0);
    const projAvg = (id) => (sumPower() + powerOf(id)) / (deck.length + 1);

    /**
     * 按「池子里每张牌轮流各来一份」铺满牌组，而不是「先把弱招堆够再补」。
     *
     * 旧写法有两种翻车方式：① 弱招优先 → 首领牌组一半是撞击；
     * ② 纯随机抽 → 抽不到招牌招。轮流铺开之后，一副牌里池子里的每张牌都有份，
     * 只有池子太小（份数上限转满）时才用普攻兜底。
     */
    let guard = 0;
    for (let round = 0; deck.length < SIZE && round < 12 && guard++ < 40; round++) {
      for (const id of [...dmgPool, ...utilPool]) {
        if (deck.length >= SIZE) break;
        // 第一圈每种伤害牌各来一份（保证「每张池子里的牌都见得到」），之后才允许重复
        const cap = isDamage(id) ? (round === 0 ? 1 : COPY_DAMAGE) : COPY_UTILITY;
        if (count(id) >= cap) continue;
        if (isDebuff(id) && debuffCount() >= MAX_DEBUFF) continue;
        // 平均威力上限：已经凑够伤害牌之后，再塞强招会被挡掉（防止「一回合三张地震」秒人）
        if (isDamage(id) && projAvg(id) > MAX_AVG && dmgCount() >= MIN_DAMAGE) continue;
        add(id);
      }
    }
    // 池子里的伤害牌不够 MIN_DAMAGE 就用普攻补足，最后兜底填满
    while (dmgCount() < MIN_DAMAGE && deck.length < SIZE) add(BASIC);
    while (deck.length < SIZE) add(BASIC);
    return deck;
  }

  /**
   * @param {'normal'|'elite'|'boss'} kind
   * @param {number} retry
   * @param {'map'|'direct'} entry
   *   'map' = 玩家在地图上走过去撞见的；'direct' = 直接开一场（诊断脚本 / 调试接口）。
   *   UI 只给 'map' 放遭遇演出（见 src/ui/encounter.js）——
   *   其余入口点进去就要立刻看到战斗画面，中间插 1.7 秒过场会把所有自动化脚本打乱。
   */
  startBattle(kind, retry = 0, entry = 'direct') {
    const d = this.data;
    const biome = d.map.biome;
    const stage = d.stage;
    const nodeIdx = d.floor;

    let enemyDef;
    if (kind === 'boss') {
      const bosses = poolFor(biome, 'boss');
      // 最后一章要把「结局首领」（content/enemies.json 里标了 final 的那个）请出来，
      // 不然 zygarde 永远不会出场——以前固定取 bosses[0]，标了 final 的那只被跳过了。
      const isFinalStage = stage >= stageCount() - 1;
      const chosen = isFinalStage ? bosses.find((b) => b.final) : null;
      enemyDef = chosen ?? (isFinalStage ? bosses[0] : this.rng.pick(bosses))
        ?? poolFor(biome, 'elite')[0] ?? ENEMIES[ENEMIES.length - 1];
    } else if (kind === 'elite') {
      const pool = poolFor(biome, 'elite');
      enemyDef = this.rng.pick(pool.length ? pool : poolFor(biome, 'normal'));
    } else {
      const pool = poolFor(biome, 'normal').concat(poolFor(biome, 'mob'));
      enemyDef = this.rng.pick(pool);
    }

    const scaled = scaleEnemy(enemyDef, stage, nodeIdx, {
      atk: d.atk, def: d.def, maxHp: d.maxHp, agi: d.agi,
    });
    // 敌人卡组：从招式池里抽 9 张，并限制「单场平均威力」，
    // 免得同一回合抽到三张大地震把玩家直接秒掉（平衡细节见 tools/check-balance.mjs）
    const deck = this.buildEnemyDeck(enemyDef.deck ?? ['tackle'], kind, scaled, enemyDef.signature ?? []);

    this.battleKind = kind;
    this.battleContext = { kind, enemyDef, scaled, retry };
    /** 这一场是怎么开起来的：'map' 会放遭遇演出，'direct' 直接进战斗 */
    this.battleEntry = entry;

    this.battle = new Battle({
      seed: this.rng.int(0, 1e9),
      player: {
        name: d.name, slug: d.slug,
        hp: d.hp, maxHp: d.maxHp,
        atk: d.atk, def: d.def, agi: d.agi, luck: d.luck,
      },
      deck: this.activeBattleDeck(),
      enemy: {
        id: enemyDef.id, slug: enemyDef.slug, name: enemyDef.name,
        maxHp: scaled.maxHp, atk: scaled.atk, def: scaled.def, agi: scaled.agi,
        tier: scaled.tier, deck, powerMul: scaled.powerMul ?? 1,
      },
    });
    this.battle.start();
    this.phase = Phase.BATTLE;
    this.changed();
    return this.battle;
  }

  /** 战斗结束结算 */
  finishBattle() {
    const b = this.battle;
    if (!b || !b.over) return null;
    const d = this.data;
    d.hp = Math.max(0, b.player.hp);
    d.turnsThisRun += b.turn;

    if (b.winner !== 'player') {
      // 失败
      this.meta = save.patchMeta({ runs: (this.meta.runs ?? 0) + 1, bestDistance: Math.max(this.meta.bestDistance ?? 0, d.floor) });
      save.clearRun();
      this.phase = Phase.GAMEOVER;
      this.changed();
      return { win: false };
    }

    d.kills += 1;
    this.meta = save.patchMeta({ kills: (this.meta.kills ?? 0) + 1 });
    const ctx = this.battleContext;
    const rewardMult = ctx.scaled.rewardMult ?? 1;
    const range = ctx.kind === 'boss' ? BALANCE.goldPerElite : ctx.kind === 'elite' ? BALANCE.goldPerElite : BALANCE.goldPerBattle;
    const gold = Math.round(this.rng.int(range[0], range[1]) * rewardMult);
    d.gold += gold;
    const heal = Math.round(d.maxHp * BALANCE.healAfterBattlePct);
    const healed = this.heal(heal);

    // 成长：每场战斗永久提升一点属性，精英/首领给得更多。
    // 没有这个成长，第 2、3 章的敌人强度就会超出玩家能跟上的范围。
    const growth = this.rollGrowth(ctx.kind);
    const growthText = this.applyGrowth(growth);

    // 抽奖励卡
    const boost = ctx.kind === 'boss' ? 0.8 : ctx.kind === 'elite' ? 0.45 : 0.1;
    const getCard = ctx.kind === 'boss' || this.rng.chance(BALANCE.cardRewardChance);
    const slots = ctx.kind === 'boss' ? 4 : 3;
    const choices = getCard ? this.withSustainPity(rollCards(slots, boost, [])) : [];
    const getPotion = this.rng.chance(BALANCE.potionDropChance);

    this.reward = {
      win: true, gold, healed, cardChoices: choices, getPotion,
      potion: getPotion ? (this.rng.chance(0.55) ? 'potion_small' : 'potion_big') : null,
      isBoss: ctx.kind === 'boss',
      enemyName: b.enemy.name,
      growth, growthText,
    };
    if (ctx.kind === 'boss' && this.rng.chance(0.75)) {
      const relicPool = ['charm_atk', 'charm_def', 'charm_agi', 'charm_luck', 'elixir'];
      this.reward.relic = this.rng.pick(relicPool);
    }
    this.phase = Phase.REWARD;
    this.save();
    this.changed();
    return this.reward;
  }

  /**
   * 奖励「保底」：保证玩家拿得到续命与解状态的手段。
   *
   * 起因是玩家反馈：一直开不出回血牌，一路被磨死；而且**灼伤与猛降防御完全没有反制**——
   * 唯一能清负面状态的「焕然一新」是 rare 还带销毁，一局里很可能根本见不到。
   * 规则：
   *   · 卡组里一张回血牌都没有 → 这次奖励里必有一张回血牌
   *   · 卡组里一张解状态/解削弱牌都没有 → 第 2 章起必有一张（第 1 章还不至于被状态压死）
   * 只替换末尾的几个选项，前面的随机结果保留，不至于每次奖励都长一个样。
   *
   * 两条保底必须**各占一个槽位**：以前两条都写死替换 `out[out.length - 1]`，
   * 于是「既没有回血牌、也没有解状态牌」时（第 2 章起很常见），后一条会把前一条顶掉 ——
   * 实测 200/200 次奖励里一张回血牌都没有，也就是「必出回血牌」这条承诺**一直是失效的**。
   * 现在从末尾往前依次占位：回血占最后一个，解状态占倒数第二个。
   */
  withSustainPity(choices) {
    if (!choices?.length) return choices;
    const deck = this.data.deck;
    const has = (kind) => deck.some((id) => CARD_BY_ID[id]?.effects?.some((e) => e.kind === kind));
    const out = [...choices];
    const used = new Set(out.map((c) => c.id));
    let slot = out.length - 1;
    const swapInto = (test) => {
      if (slot < 0) return false;
      const pool = CARDS.filter((c) => !c.enemyOnly && !used.has(c.id) && test(c));
      if (!pool.length) return false;
      const pick = this.rng.pick(pool);
      used.add(pick.id);
      out[slot] = pick;
      slot -= 1;
      return true;
    };
    if (!has('heal')) swapInto((c) => c.effects.some((e) => e.kind === 'heal'));
    if (!has('cleanse') && this.data.stage > 0) swapInto((c) => c.effects.some((e) => e.kind === 'cleanse'));
    return out;
  }

  /** 调试用：造一份和真实战斗奖励同结构的假数据（UI 预览 / 截图用） */
  mockReward() {
    const growth = [{ stat: 'atk', amount: 1 }, { stat: 'maxHp', amount: 12 }];
    return {
      win: true,
      gold: 42,
      healed: 18,
      cardChoices: rollCards(3, 0.4, []),
      getPotion: true,
      potion: 'potion_small',
      isBoss: false,
      enemyName: t('穿山鼠'),
      growth,
      growthText: growth.map((g) => `${t(STAT_NAMES[g.stat])} +${g.amount}`).join('，'),
    };
  }

  /** 随机生成一份属性成长 */
  rollGrowth(kind) {
    const budget = kind === 'boss' ? 8 : kind === 'elite' ? 5 : 3;
    const out = [];
    const pool = [
      ['atk', 1, 1],
      ['def', 1, 1],
      ['maxHp', 8, 16],
      ['agi', 1, 1],
      ['luck', 1, 1],
    ];
    let left = budget;
    let guard = 0;
    while (left > 0 && guard++ < 20) {
      const [stat, lo, hi] = this.rng.pick(pool);
      const amount = this.rng.int(lo, hi);
      const cap = BALANCE.cap[stat];
      if (this.data[stat] >= cap) continue;
      const existing = out.find((g) => g.stat === stat);
      if (existing) existing.amount += amount;
      else out.push({ stat, amount });
      left -= stat === 'maxHp' ? 2 : 1;
    }
    return out;
  }

  applyGrowth(growth) {
    const parts = [];
    for (const g of growth) {
      const gained = this.gainStat(g.stat, g.amount);
      if (gained !== 0) parts.push(`${t(STAT_NAMES[g.stat])} +${gained}`);
    }
    return parts.join('，');
  }

  /** 奖励界面：拿卡 / 跳过 */
  takeRewardCard(cardId) {
    if (!this.reward) return;
    if (cardId) this.addCard(cardId);
    if (this.reward.relic) this.giveItem(this.reward.relic, 1);
    if (this.reward.potion) this.giveItem(this.reward.potion, 1);
    const wasBoss = this.reward.isBoss;
    this.reward = null;
    if (wasBoss) {
      this.nextStage();
    } else {
      this.phase = Phase.MAP;
      this.data.nodeId = this.data.nodeId; // 停留在当前节点，地图上会显示可继续前进
      this.save();
      this.changed();
    }
  }

  // ================= 事件 =================

  startEvent() {
    const pool = eventsFor(this.data.map.biome).filter((e) => !this.usedEvents.includes(e.id));
    const ev = pool.length ? this.rng.pick(pool) : this.rng.pick(eventsFor(this.data.map.biome));
    this.usedEvents.push(ev.id);
    this.event = ev;
    this.eventResult = null;
    this.phase = Phase.EVENT;
    this.changed();
  }

  /**
   * 选择事件选项。
   * 注意：这里**不能**调用 changed() 触发整屏重绘 —— 之前那样做会把 UI 上
   * 刚挂出来的「继续前进」按钮连同监听一起丢掉，事件页面就永远关不掉了。
   * 现在只改状态，由 UI 层自己决定怎么演。
   */
  chooseEventOption(index) {
    const ev = this.event;
    if (!ev) return null;
    const opt = ev.options[index];
    if (!opt) return null;
    const result = opt.run(this) ?? { text: t('……什么也没发生。'), tone: 'neutral' };
    this.eventResult = { index, ...result };
    this.save();
    return this.eventResult;
  }

  leaveEvent() {
    this.event = null;
    this.eventResult = null;
    this.phase = Phase.MAP;
    this.save();
    this.changed();
  }

  // ================= 宝箱 / 营地 =================

  startChest() {
    const roll = this.rng();
    const d = this.data;
    let chest;
    if (roll < 0.36) {
      const gold = this.rng.int(45, 95) + d.stage * 20;
      d.gold += gold;
      chest = { kind: 'gold', gold, text: t('一整袋金币，还有几颗碎宝石。\n「沉是沉了点，不过我不嫌弃。」\n金币 +{gold}。', { gold }) };
    } else if (roll < 0.74) {
      const card = rollCard(0.5, []);
      this.addCard(card.id);
      const gold = this.rng.int(15, 35);
      d.gold += gold;
      chest = { kind: 'card', cardId: card.id, gold, text: t('箱底压着一张卡，还有一点零钱。\n「压在最底下的多半是好东西。」\n获得「{card}」，金币 +{gold}。', { card: card.name, gold }) };
    } else if (roll < 0.9) {
      const big = this.rng.chance(0.5);
      this.giveItem(big ? 'potion_big' : 'potion_small', big ? 1 : 2);
      const healed = this.heal(Math.round(d.maxHp * 0.12));
      chest = { kind: 'item', text: t('一堆补给。你顺手给自己处理了伤口。\n「正好用得上。」\n获得{potion}，HP +{hp}。', { potion: big ? t('厉害伤药 ×1') : t('好伤药 ×2'), hp: healed }) };
    } else {
      // 宝箱怪！
      chest = { kind: 'mimic', text: t('箱子说话了。而且它很饿。\n「……那我不开了。」') };
    }
    this.chest = chest;
    this.phase = Phase.CHEST;
    this.save();
    this.changed();
    return chest;
  }

  leaveChest() {
    const mimic = this.chest?.kind === 'mimic';
    this.chest = null;
    if (mimic) {
      // 宝箱怪也是「撞见」——照样放遭遇演出
      this.startBattle('elite', 0, 'map');
    } else {
      this.phase = Phase.MAP;
      this.save();
      this.changed();
    }
  }

  startRest() {
    const d = this.data;
    const healAmount = Math.round(d.maxHp * BALANCE.restHealPct);
    /**
     * done 是「这次机会用掉了」的总开关：休息和冥想**只能二选一**。
     * 以前 used / upgraded 各管各的，于是休息完还能再冥想，
     * 和界面上写的「你可以做一件事——只有一件」自相矛盾。
     *
     * 记录存在 run 数据里（d.rests[节点 id]）而不是只放内存，
     * 免得中途刷新页面回到同一个营地时，用掉的机会又变回来。
     */
    if (!d.rests) d.rests = {};
    const key = String(d.nodeId ?? 'r0');
    const rec = d.rests[key] ?? (d.rests[key] = { healResult: null, upgradeResult: null });
    this.rest = {
      key,
      healAmount,
      used: rec.healResult != null,
      upgraded: rec.upgradeResult != null,
      done: rec.healResult != null || rec.upgradeResult != null,
      healResult: rec.healResult,
      upgradeResult: rec.upgradeResult,
    };
    this.phase = Phase.REST;
    this.changed();
    return this.rest;
  }

  restHeal() {
    if (this.rest?.done) return null;
    const healed = this.heal(this.rest.healAmount);
    this.rest.used = true;
    this.rest.done = true;
    this.rest.healResult = healed;
    if (this.data.rests?.[this.rest.key]) this.data.rests[this.rest.key].healResult = healed;
    this.save();
    this.changed();
    return healed;
  }

  /** 营地：把一张卡换成更好的（相当于「升级」）*/
  restUpgrade(cardId) {
    if (this.rest?.done) return null;
    const card = CARD_BY_ID[cardId];
    if (!card) return null;
    const better = rollCard(1.2, []);
    const idx = this.data.deck.indexOf(cardId);
    if (idx < 0) return null;
    this.data.deck.splice(idx, 1);
    this.addCard(better.id);
    this.rest.upgraded = true;
    this.rest.done = true;
    this.rest.upgradeResult = { removed: card.name, gained: better.name };
    if (this.data.rests?.[this.rest.key]) this.data.rests[this.rest.key].upgradeResult = this.rest.upgradeResult;
    this.save();
    this.changed();
    return this.rest.upgradeResult;
  }

  leaveRest() {
    this.rest = null;
    this.phase = Phase.MAP;
    this.save();
    this.changed();
  }

  // ================= 商店 =================

  /**
   * 开一家商店。
   * @param {string} [forceMerchantId] 指定摊主（调试 / 以后「事件里出现特定商人」用）；
   *        不传就按地图 + 节点 id 挑一位。
   */
  startShop(forceMerchantId = null) {
    const d = this.data;
    const biome = d.map?.biome ?? 'desert';
    // 商人按「地图 + 节点 id」稳定挑选：同一个商店节点每次进来都是同一位摊主
    const merchant = (forceMerchantId ? MERCHANTS.find((m) => m.id === forceMerchantId) : null)
      ?? pickMerchant(biome, `${d.stage}:${d.nodeId ?? '?'}`);
    // 兜底：万一某张地图没有配商人（build-content 会拦，但别让运行期崩）
    const p = merchant ?? {
      id: 'default', name: t('沙漠商队'), role: t('杂货商人'), slug: null, emotion: 'happy',
      greet: t('「钱货两清，概不赊账。」店主是一只戴着帽子的沙河马。'), leave: t('离开商队'),
      priceMul: 1, cards: 5, items: 3, rarityBoost: 0.35, mustItems: [], service: 'remove', servicePrice: 70,
    };

    const stock = [];
    const cards = rollCards(p.cards, p.rarityBoost, []);
    for (const c of cards) {
      const base = { common: 42, uncommon: 66, rare: 92, epic: 130 }[c.rarity] ?? 50;
      stock.push({
        kind: 'card', id: c.id, name: c.name, rarity: c.rarity,
        price: Math.round(base * (0.9 + this.rng() * 0.25) * p.priceMul),
      });
    }

    // 道具：先放这位商人必进的货（药草商人一定有药、铁匠一定有护符），剩下的随机补满
    const pool = ['potion_small', 'potion_big', 'charm_atk', 'charm_def', 'charm_agi', 'charm_luck', 'elixir'];
    const picked = [];
    for (const id of p.mustItems ?? []) if (pool.includes(id) && !picked.includes(id)) picked.push(id);
    for (const id of this.rng.shuffle(pool)) {
      if (picked.length >= p.items) break;
      if (!picked.includes(id)) picked.push(id);
    }
    for (const id of picked.slice(0, p.items)) {
      stock.push({ kind: 'item', id, name: ITEMS[id].name, desc: ITEMS[id].desc, price: Math.round(ITEMS[id].price * p.priceMul) });
    }
    // 保底：每位商人至少备一瓶药（「开不出回血牌」的局总得有地方补血）
    if (p.items > 0 && !stock.some((s) => s.kind === 'item' && (s.id === 'potion_small' || s.id === 'potion_big'))) {
      const cheap = p.priceMul <= 0.9 ? 'potion_small' : 'potion_big';
      const last = stock.map((s) => s.kind).lastIndexOf('item');
      stock[last] = { kind: 'item', id: cheap, name: ITEMS[cheap].name, desc: ITEMS[cheap].desc, price: Math.round(ITEMS[cheap].price * p.priceMul) };
    }

    if (p.service === 'remove') {
      stock.push({ kind: 'service', id: 'remove', name: t('卡牌移除服务'), desc: t('从卡组里删掉一张卡。'), price: p.servicePrice });
    }
    this.shop = { merchant: p, stock, soldOut: [] };
    this.phase = Phase.SHOP;
    this.changed();
    return this.shop;
  }

  buy(index) {
    const s = this.shop;
    if (!s) return { ok: false, text: t('没有商店') };
    const entry = s.stock[index];
    if (!entry || s.soldOut.includes(index)) return { ok: false, text: t('这件已经卖掉了。') };
    if (this.data.gold < entry.price) return { ok: false, text: t('金币不够。') };
    /**
     * 删卡服务：卡组太小就**在收钱之前**拦住。
     *
     * 以前的顺序是：扣钱 → 弹选牌窗 → 选一张 → `doRemove()` 说「卡组已经很少了，不能再删」→
     * 关窗时退款。玩家经历的是「付了钱 → 点了牌 → 钱又回来了 → 卡没删」，
     * 很容易读成「删卡根本没用」。现在直接拦住，钱一动不动，提示也只说一件事。
     * 注意这个判断必须在 `data.gold -= price` **之前**（第一版写在后面，钱照样扣了）。
     */
    if (entry.kind === 'service' && this.data.deck.length <= 3) {
      return { ok: false, text: t('卡组只剩 {n} 张了，不能再删 —— 再删就没牌可打了。', { n: this.data.deck.length }) };
    }
    this.data.gold -= entry.price;
    if (entry.kind === 'service') {
      // 删卡服务**不售罄**：卡组变薄是这一版唯一「精简」手段（不能挑着不带），
      // 所以允许在一家店里连着删，代价是每删一张这一家的报价就往上跳一截。
      this.pendingRemove = { index, paid: entry.price };
      return { ok: true, text: t('选择一张要移除的卡牌。'), needRemove: true };
    }
    s.soldOut.push(index);
    if (entry.kind === 'card') {
      this.addCard(entry.id);
      return { ok: true, text: t('买下「{name}」，已放入卡组。', { name: entry.name }) };
    }
    if (entry.kind === 'item') {
      const got = this.giveItem(entry.id, 1);
      // 护符 / 活力药是**拿到就生效**的（见 giveItem）：文案要说清「已经加上了」，
      // 否则玩家会去背包里找 —— 那里根本没有，看起来就像买了个没用的东西
      if (got.applied) {
        return { ok: true, text: t('买下「{name}」，{stat} +{n}（本局有效）。', { name: entry.name, stat: t(STAT_NAMES[got.applied.key] ?? got.applied.key), n: got.applied.amount }) };
      }
      return { ok: true, text: t('买下「{name}」，已放进背包（按 I 打开，点「使用」）。', { name: entry.name }) };
    }
    return { ok: true, text: t('成交。') };
  }

  /** 删卡服务的报价：同一家店里每删一张就涨一档（75 → 105 → 147 …） */
  static get REMOVE_PRICE_STEP() { return 1.4; }

  doRemove(cardId) {
    const card = CARD_BY_ID[cardId];
    if (!card) return null;
    if (this.data.deck.length <= 3) return { ok: false, text: t('卡组已经很少了，不能再删。') };
    /**
     * 真的删掉了才算成功。
     *
     * 以前这里把 `removeCard()` 的返回值丢掉了，无条件回一句「移除了「XX」。」——
     * 万一那张牌不在卡组里（id 对不上 / 卡组被动过），玩家会看到「删好了」的提示、
     * 回去一看牌还在，那就是标准的「根本删不掉」。现在删不掉就直说。
     */
    if (!this.removeCard(cardId)) {
      return { ok: false, text: t('卡组里已经没有「{name}」了。', { name: card.name }) };
    }
    // 涨价：下一张更贵（这一步才算「交易完成」）
    const pending = this.pendingRemove;
    if (pending && this.shop) {
      const svc = this.shop.stock[pending.index];
      if (svc) svc.price = Math.round(svc.price * Game.REMOVE_PRICE_STEP);
    }
    this.pendingRemove = null;
    this.save();
    this.changed();
    return { ok: true, text: t('移除了「{name}」。', { name: card.name }) };
  }

  /**
   * 玩家买了删卡服务、却在选牌弹窗里直接关掉：把钱退回去。
   * （以前这种情况是钱照扣、卡没删 —— 白白亏一笔，玩家只会觉得是 bug。）
   */
  refundRemove() {
    const pending = this.pendingRemove;
    if (!pending) return { ok: false, text: t('没有待处理的删卡。') };
    this.data.gold += pending.paid ?? 0;
    this.pendingRemove = null;
    this.save();
    this.changed();
    return { ok: true, text: t('取消删卡，退回 {gold} 金币。', { gold: pending.paid ?? 0 }) };
  }

  leaveShop() {
    this.shop = null;
    this.pendingRemove = null;
    this.phase = Phase.MAP;
    this.save();
    this.changed();
  }

  // ================= 展示用派生数据 =================

  derived() {
    const d = this.data;
    if (!d) return null;
    return {
      ap: apFromAgi(d.agi),
      draw: drawFromAgi(d.agi),
      hand: handFromAgi(d.agi),
      crit: critChance(d.luck).toFixed(1),
      dodge: dodgeChance(d.luck).toFixed(1),
      atk: d.atk,
      def: d.def,
      agi: d.agi,
      luck: d.luck,
    };
  }

  /** 顶部状态栏要显示的文本 */
  statusLine() {
    const d = this.data;
    if (!d) return '';
    const biome = BIOMES[d.map?.biome ?? 'desert'];
    return t('{biome} · 第 {floor} 步 / 第 {stage} 章', { biome: biome.name, floor: d.floor + 1, stage: d.stage + 1 });
  }
}

export { BIOMES, NODE_TYPES, BALANCE, ITEMS, CARD_BY_ID, CARDS, ENEMY_BY_ID, stageCount, ENEMIES };
