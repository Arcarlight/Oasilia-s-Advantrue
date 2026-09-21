// 游戏状态机：地图 → 战斗 / 事件 / 宝箱 / 商店 / 营地 → 下一章 → 结局。
// 所有玩家数据都在 game.data 里，可序列化（存档直接用 JSON.stringify）。

import { BALANCE, BIOMES, BIOME_SLOTS, STAGE_BIOME, RARITY, REWARD_WEIGHTS, apFromAgi, drawFromAgi, handFromAgi, critChance, dodgeChance } from '../data/balance.js';
import { CARD_BY_ID, STARTER_DECK, rollCard, rollCards, CARDS, playerPool } from '../data/cards.js';
import { HEROES, HERO_ORDER, heroById, heroOf, starterDeckFor, heroMapShape, heroEnemyMul, heroRewardMul, heroRewardWeights, DEFAULT_HERO_ID } from '../data/heroes.js';
import { ITEMS, ITEM_ART, STARTER_ITEMS } from '../data/items.js';
import { ENEMIES, ENEMY_BY_ID, poolFor, scaleEnemy } from '../data/enemies.js';
import { generateMap, nextNodes, startNodes, nodeById, NODE_TYPES, stageCount, endlessRowBonus, endlessBranchBonus } from '../data/mapgen.js';
import { eventsFor } from '../data/events.js';
import { pickMerchant, MERCHANTS } from '../data/merchants.js';
import { makeRng } from './rng.js';
import { Battle, STATUS_INFO } from './battle.js';
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

// ================= 营地冥想：把一张卡换成更强的 =================
//
// 这两个小工具放在文件顶部，是因为 restUpgrade / upgradeCandidates 要用它们，
// 而那两个方法在类里（写在类前面更清楚：它们不认识 Game，只认卡牌数据）。

/** 卡牌稀有度从低到高（冥想换牌按这个顺序比较「更强」） */
const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic'];

/**
 * 这张牌算哪种**用途**（冥想换牌时尽量保持卡组形状：攻击牌换攻击牌）。
 * 只看效果种类，不看数值 —— 数值强弱由稀有度那一档保证。
 */
function cardRoleOf(card) {
  const kinds = new Set((card?.effects ?? []).map((e) => e.kind));
  if (kinds.has('damage')) return 'attack';
  if (kinds.has('shield')) return 'defense';
  if (kinds.has('heal')) return 'heal';
  return 'utility';
}

/**
 * 固定的「抖动」：把一段文字映射到 [0, 0.9)。
 *
 * 冥想候选的打分要给同分的一堆牌排个先后，但**不能掷骰子** ——
 * 名单要在「界面显示」和「玩家点下去之后引擎再算一遍」之间保持一致
 * （见 upgradeCandidates 里的说明：以前用 rng() 掷，点哪张都是随机给一张）。
 * 用 (原卡 id + 候选 id) 算出来的这个数，同一张牌永远是同一个值。
 */
function stableJitter(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1000) / 1000 * 0.9;
}

// ================= 道具（手持道具） =================//
// 这一版把「背包（id → 数量，无限格）」换成了**手持道具**：
//   · 一局只有 3 个手持栏，每打赢一个 boss +1（heldMax()）；
//   · `kind: 'hold'` 拿在手上就一直生效（heldMods() 把它们汇总成一张系数表）；
//   · `kind: 'use'` **只能在战斗外使用**（战斗里能嗑药太强，用户点名禁掉）；
//   · 拿满时给不进去 —— 由界面问玩家「丢掉哪一件」（giveItem 返回 overflow）。
//
// **纯规则**（归并 / 求和 / 卖出价 / 分类）在 src/core/item-rules.js：那里是叶子模块，
// eventfx 之类的地方也要用它，写在 game.js 里会形成循环 import（打包成单文件才会炸）。
import { heldEntries, heldCount, sumHeldMods, itemUseEffect, itemSellPrice } from './item-rules.js';

// 再导出一次：老调用方（界面 / 测试）一直是从 game.js 拿的，别让它们全改一遍
export { heldEntries, heldCount, sumHeldMods, itemUseEffect, itemSellPrice };

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

  /**
   * 开一局。
   * @param {number} [seed]
   * @param {{endless?:boolean, hero?:string}} [opts]
   *   · `endless: true` = 无尽模式（标题页那个单独入口）；无尽局从第 1 章起就是另一个模式：
   *     地图分叉 +1、敌人略微加压，过了正片复利变强，而且**永远不会有结局页**。
   *   · `hero: '<主角 id>'` = 用哪一位主角开局（3.0 起有两位）。不传就用跨局记录里
   *     选好的那位（标题页点头图切换，存在 meta.hero 里），再没有就退回第一位。
   *     这一位主角决定：名字 / 物种 / 初始属性 / **开局卡组** / 抽卡池 / 一关多长、几个首领、
   *     敌人额外倍率（阿特拉斯那套「两倍长 + 双首领 + 更狠」就在 content/heroes.json 里）。
   */
  newRun(seed, opts = {}) {
    const endless = !!opts.endless;
    if (seed != null) this.rng = makeRng(seed);
    const p = heroById(opts.hero ?? this.titleHeroId ?? DEFAULT_HERO_ID);
    const shape = heroMapShape(p?.id ?? DEFAULT_HERO_ID);
    /** 这一局的主角 id：存档 / 抽卡池 / 结局页 / 记录页都读它 */
    const heroId = p?.id ?? DEFAULT_HERO_ID;
    this.usedEvents = [];
    this.data = {
      seed: this.rng.seed,
      /** 主角 id（3.0）：`d.hero` 是这一局所有「按主角分」的分支的唯一依据 */
      hero: heroId,
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
      deck: [...starterDeckFor(heroId)],
      /**
       * **手持道具**（用户要的机制）：一个 id 数组，可以有重复（同名多件）。
       * 上限 = heldMax() = 3 + 本局打赢的 boss 数。开局的几件在下面 giveItem 进去。
       */
      held: [],
      /** 本局打赢过几个 boss —— 手持栏 +1 的依据（见 heldMax） */
      bossKills: 0,
      /**
       * **这一章打过哪些首领**（按顺序）。一关两个首领时靠它保证「两只不重样」，
       * 以及判断「现在打的是不是本章最后一个首领」（结局首领只在那一刻出场）。
       * 换章时清空（见 nextStage）。
       */
      stageBosses: [],
      relics: [],
      battleDeck: null,
      /**
       * 这一局打过照面的敌人 id（按顺序）。挑敌人时靠它保证「同一只不出现第二次」
       * （见 pickEnemyDef）。以前没有这个账本，随机抽是有放回的，
       * 同一只怪在一章里撞见两次很常见（用户反馈「出现很多宝可梦重复」）。
       */
      metEnemies: [],
      stage: 0,
      /**
       * **无尽模式**：标题页那个单独入口开出来的局（`newRun(seed, { endless: true })`）。
       * 用户明确要求「无尽模式不要和普通模式合并，而是有另一个入口」——
       * 所以它是开局就定下来的一个标记，而不是「普通模式打到第 7 章自动变成无尽」。
       * 无尽局：地图更宽（分叉 +1）、敌人从第 1 章起就略微加压、过了正片复利变强，
       * 永远不会出现结局页；目标只有「走到第几章」。
       */
      endless,
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
    /**
     * 本局要走哪几张地图。
     *
     * 首章与终章固定（开场和收尾要有固定的调子），**中间 4 章每章从候选里抽一张** ——
     * 候选来自 content/biomes.json 的 slots（例如水晶洞窟声明 [1,2,3,4]，哪儿都可能钻进去）。
     * 尽量不重复：同一局里同一张地图只出现一次（候选不够时才允许重复），
     * 这样「这一局走了哪条路」才有记忆点。序列存进 run 数据，读档 / 重开都按它走。
     */
    const biomes = [];
    const used = new Set();
    for (let s = 0; s < stageCount(); s += 1) {
      const pool = Object.keys(BIOME_SLOTS).filter((k) => (BIOME_SLOTS[k] ?? []).includes(s));
      const fresh = pool.filter((k) => !used.has(k));
      const pick = this.rng.pick(fresh.length ? fresh : pool) ?? STAGE_BIOME[s];
      biomes.push(pick);
      used.add(pick);
    }
    this.data.biomes = biomes;
    // 无尽模式：地图更宽（分叉 +1）从第 1 章就生效 —— 这是这个模式的手感
    this.data.map = this.makeMap(0, endless);
    this.phase = Phase.MAP;
    // 开局道具（content/items.json 的 starter）：走 giveItem，所以「拿不下」也不会静默丢掉
    for (const [id, n] of Object.entries(STARTER_ITEMS ?? {})) this.giveItem(id, n);
    this.pendingMap = null;
    this.save();
    this.changed();
    return this.data;
  }

  /**
   * 生成某一章的地图：**按这一局的主角**取形状（行数倍率 / 一关几个首领），
   * 再叠上无尽模式那两条加成。
   *
   * 阿特拉斯那套「一章两倍长 + 两个首领」就落在这里：`map.rowsMul: 2`、`map.bosses: 2`，
   * 两个首领保证不重样（见 startBattle 的 stageBosses）。
   * 以前这句生成散在 newRun / nextStage 两处各写一遍，加第三个参数就会漏一处。
   */
  makeMap(stage, endless = this.isEndless()) {
    const d = this.data;
    const shape = heroMapShape(d?.hero ?? DEFAULT_HERO_ID);
    const opts = { rowsMul: shape.rowsMul, bosses: shape.bosses };
    if (endless) {
      opts.branchBonus = endlessBranchBonus(stage);
      opts.rowBonus = endlessRowBonus(stage);
    }
    return generateMap(stage, this.rng, d?.biomes?.[stage], opts);
  }

  /**
   * 本局的玩家名与物种名**跟着语言走**。
   *
   * 这两个字段在开新一局时是从主角记录上**抄下来**的副本（存档里要留着），
   * 于是「开着中文开了一局、中途切成日语」之后，副本还停在中文 ——
   * 结算页那句「{name} 展开翅膀」就会在满屏日语里冒出一个中文名字（用户截图报过）。
   * 切语言时调一次这里，从 `_zh`（中文原文）重新取一次当前语言的写法。
   */
  syncPlayerLang() {
    const p = heroOf(this.data) ?? heroById(DEFAULT_HERO_ID);
    if (!this.data || !p) return;
    const zhOf = (f) => (p._zh?.[f] ?? p[f]);
    if (this.data.name != null) this.data.name = t(zhOf('name'));
    if (this.data.speciesName != null) this.data.speciesName = t(zhOf('speciesName'));
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

  /** 手上的栏位上限：3 个，每打赢一个 boss +1（用户定的规则） */
  heldMax() {
    return 3 + Math.max(0, this.data?.bossKills ?? 0);
  }

  /** 持有效果汇总表（战斗与界面都读它，见 sumHeldMods） */
  heldMods() {
    return this._modsCache ?? (this._modsCache = sumHeldMods(this.data?.held));
  }

  /** 某个持有效果的数值（没这件东西就是 0）：battle.js 读它，别自己去翻 held */
  modAdd(key) {
    return this.heldMods()[key]?.add ?? 0;
  }

  /** 某个乘法型持有效果（没这件东西就是 1） */
  modMul(key) {
    return this.heldMods()[key]?.mul ?? 1;
  }

  /** 某个开关型持有效果（中毒不衰减 / 濒死保命 / 开局净化） */
  modFlag(key) {
    return !!this.heldMods()[key]?.flag;
  }

  /** 一件道具在商人这里卖多少钱（商人系数 × 星星沙子之类的折扣，最低 1 折不下） */
  itemPrice(item, priceMul = 1) {
    const off = Math.min(0.6, Math.max(0, this.modAdd('shopDiscountPct')));
    return Math.max(1, Math.round((item?.price ?? 0) * priceMul * (1 - off)));
  }

  /** 道具一变就把系数表作废（拿到 / 丢掉 / 卖掉 / 用掉都要调） */
  invalidateMods() {
    this._modsCache = null;
  }

  /**
   * 拿到一件道具。
   *
   * 返回 `{ ok, stored, overflow }`：
   *   · stored = true —— 进了手持栏；
   *   · overflow = true —— **栏位满了，没地方放**，界面要问玩家「丢掉哪一件」
   *     （或者把这件当场卖掉）；这时它没有被收下，调用方别当成功。
   */
  giveItem(id, n = 1) {
    const item = ITEMS[id];
    if (!item) return { ok: false, id, stored: false, overflow: false, text: t('没有这件道具。') };
    this.invalidateMods();
    let stored = 0;
    for (let i = 0; i < n; i++) {
      if (this.data.held.length >= this.heldMax()) {
        return {
          ok: stored > 0, id, item, stored: stored > 0, overflow: true, storedCount: stored,
          text: t('手持栏满了（{n} / {max}）—— 得先丢掉一件才拿得下「{name}」。', {
            n: this.data.held.length, max: this.heldMax(), name: item.name,
          }),
        };
      }
      this.data.held.push(id);
      stored += 1;
    }
    // 道具图鉴：拿到手就永久记一笔（买到 / 开箱 / 掉落都走这里，只有这一处）
    save.noteItems(this.data.held.slice(-stored));
    return { ok: true, id, item, stored: true, overflow: false, storedCount: stored };
  }

  /** 丢掉一件（超上限时玩家选的那一下；也可主动丢） */
  dropItem(id) {
    const i = this.data.held.lastIndexOf(id);
    if (i < 0) return false;
    this.data.held.splice(i, 1);
    this.invalidateMods();
    this.save();
    this.changed();
    return true;
  }

  /** 卖给商人（价钱见 itemSellPrice），返回拿到了多少金币 */
  sellItem(id) {
    const i = this.data.held.lastIndexOf(id);
    if (i < 0) return null;
    const item = ITEMS[id];
    const gold = itemSellPrice(item);
    this.data.held.splice(i, 1);
    this.data.gold += gold;
    this.invalidateMods();
    this.save();
    this.changed();
    return { gold, name: item?.name ?? id };
  }

  /**
   * 使用一件道具（**只能在战斗外**）。
   *
   * 用户点名：「战斗中不能使用『使用道具』，不然那样太 imba 了！」
   * 所以战斗里这件东西只能看、不能用 —— 界面把按钮禁掉，引擎这里也再拦一道
   * （两处都拦是故意的：这样以后谁写个新入口也绕不过去）。
   */
  useItem(id) {
    const item = ITEMS[id];
    if (!item || !this.data.held.includes(id)) return null;
    if (this.phase === Phase.BATTLE) {
      return { ok: false, text: t('战斗中不能使用道具 —— 先打完这一场。') };
    }
    const eff = itemUseEffect(item);
    if (!eff) return { ok: false, text: t('「{name}」是拿着就生效的，不用使用。', { name: item.name }) };

    // ① 回血类
    if (eff.healFull || eff.healPct || eff.healFlat) {
      const amount = eff.healFull
        ? this.data.maxHp
        : (eff.healPct ? Math.round(this.data.maxHp * eff.healPct) : eff.healFlat);
      if (!eff.healFull && amount > 0 && this.data.hp >= this.data.maxHp) {
        return { ok: false, text: t('HP 已经满了。') };
      }
      this.dropItemSilent(id);
      const h = this.heal(amount);
      return { ok: true, text: t('吃下「{name}」，回复 {hp} 点 HP。', { name: item.name, hp: h }) };
    }

    // ② 清状态类
    if (Array.isArray(eff.cleanse)) {
      const cleared = this.cleanseStatuses(eff.cleanse);
      if (!cleared.length) return { ok: false, text: t('身上没有它能解的东西。') };
      this.dropItemSilent(id);
      return {
        ok: true,
        text: t('吃下「{name}」，{list}消了。', {
          name: item.name, list: cleared.map((k) => STATUS_INFO[k]?.name ?? k).join(' / '),
        }),
      };
    }

    // ③ 永久属性类（甜苹果 / 力量之羽…）
    if (eff.stat) {
      const parts = [];
      for (const [key, amount] of Object.entries(eff.stat)) {
        parts.push(`${t(STAT_NAMES[key] ?? key)} +${this.gainStat(key, amount)}`);
      }
      this.dropItemSilent(id);
      return { ok: true, text: t('用掉「{name}」，{list}。', { name: item.name, list: parts.join('、') }) };
    }

    return { ok: false, text: t('「{name}」现在用不了。', { name: item.name }) };
  }

  /** 丢掉一件但不重画（useItem 内部用：界面自己会在拿到结果后重画） */
  dropItemSilent(id) {
    const i = this.data.held.lastIndexOf(id);
    if (i >= 0) this.data.held.splice(i, 1);
    this.invalidateMods();
  }

  /** 清掉身上指定的几个负面状态，返回真的清掉的那些 key */
  cleanseStatuses(keys) {
    const b = this.battle;
    const cleared = [];
    if (!b) return cleared;
    for (const k of keys) {
      if ((b.player?.[k] ?? 0) > 0) {
        b.player[k] = 0;
        cleared.push(k);
      }
    }
    return cleared;
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
    const card = rollCard(boost, this.data.deck, null, this.data.hero);
    this.addCard(card.id);
    return card;
  }

  offerCardOfRarity(rarities = ['rare'], boost = 0.5) {
    for (let i = 0; i < 200; i++) {
      const card = rollCard(boost, [], null, this.data.hero);
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
    const campaign = stageCount();
    d.stage += 1;
    /**
     * 走到正片尽头（第 6 章的首领之后）：
     *   · **普通模式** → 结局页，并且解锁「另一位主角」与**无尽模式**（用户指定的解锁条件）；
     *   · **无尽模式** → 继续往下走（第 7、8、9… 章），敌人按 BALANCE.endless 复利变强。
     *     无尽模式是**另一个入口**（标题页单独一个按钮），不是普通模式打完成这样 ——
     *     这一点用户专门强调过。
     */
    if (!d.endless && d.stage >= campaign) {
      this.phase = Phase.VICTORY;
      const heroId = d.hero ?? DEFAULT_HERO_ID;
      this.meta = save.patchMeta({
        wins: (this.meta.wins ?? 0) + 1,
        unlocked: true,
        bestStage: campaign,
        endlessUnlocked: true,
        /**
         * 通关记在**这一位主角**头上（3.0）：
         *   · `clearedHeroes` 是谁通过关（另一位主角的解锁条件就是它的第一条）；
         *   · `heroCleared`  这一位主角通没通过关（无尽模式的门槛：用这位主角打通过一次）。
         * 只用一个布尔的话，「阿特拉斯通过关」会把欧亚西莉亚的无尽模式也一起解锁，
         * 反过来也一样 —— 这两位的手感完全不同，通关记录必须分开记。
         */
        clearedHeroes: [...new Set([...(this.meta.clearedHeroes ?? []), heroId])],
        heroCleared: { ...(this.meta.heroCleared ?? {}), [heroId]: true },
      });
      // 通关也记一条（注意 d.stage 这时已经越界了，runSummary 里会夹回章节总数）
      this.meta = save.recordRun(this.runSummary(true));
      save.clearRun();
      this.changed();
      return;
    }
    // 通关金币：正片那张表用完之后（无尽模式的第 7 章起）按 goldBase + 每章递增
    const goldTable = BALANCE.stageClearGold[d.stage - 1];
    const bonus = goldTable ?? ((BALANCE.endless?.goldBase ?? 40) + Math.max(0, d.stage - campaign + 1) * (BALANCE.endless?.goldPerChapter ?? 20));
    d.gold += bonus;
    // 打完首领完全恢复：下一章的敌人强度是按满血设计的
    const healLines = [];
    if (BALANCE.fullHealAfterBoss) {
      const healed = this.heal(d.maxHp);
      if (healed > 0) healLines.push(t('HP 完全恢复（+{n}）', { n: healed }));
    }
    /**
     * 这一章走哪张地图：开局抽好的序列说了算（`d.biomes`，见 newRun）。
     * 无尽模式会**超出那个序列**，所以按需往后补 —— 从十张图里随机挑，
     * 尽量不重复最近三章走过的那几张（一路换风景才有「又走远了」的感觉）。
     */
    if (d.endless && Array.isArray(d.biomes)) {
      while (d.biomes.length <= d.stage) {
        const recent = new Set(d.biomes.slice(-3));
        const pool = Object.keys(BIOME_SLOTS).filter((k) => !recent.has(k));
        d.biomes.push(this.rng.pick(pool.length ? pool : Object.keys(BIOME_SLOTS)));
      }
    }
    d.map = this.makeMap(d.stage, d.endless);
    d.nodeId = null;
    d.floor = 0;
    // 新的一章：首领账本清零（一关两个首领时靠它保证不重样）
    d.stageBosses = [];
    d.bossCount = 0;
    this.phase = Phase.MAP;
    const over = d.endless && d.stage >= campaign;
    this.message = {
      title: t('进入 {biome}', { biome: BIOMES[d.map.biome].name }),
      text: `${t(BIOMES[d.map.biome].desc)}\n\n${t('章节通关奖励：金币 +{gold}', { gold: bonus })}${healLines.length ? '，' + healLines.join('，') : ''}`
        + (over ? `\n${t('无尽模式：已经走过 {n} 章，看你能走到第几章。', { n: d.stage })}` : ''),
      tone: 'good',
    };
    this.save();
    this.changed();
  }

  /** 这一局是不是无尽模式（标题页那个单独入口开出来的局） */
  isEndless() {
    return !!this.data?.endless;
  }

  /**
   * **标题页正在展示哪位主角**（3.0 的双主角：点标题页的头图切换）。
   *
   * 它同时是「下一次开局的默认主角」——点一下就写进跨局记录（`meta.hero`），
   * 关掉页面再回来还是他。为什么放在 Game 上而不是标题页自己的局部变量：
   * 换屏的记账在 UI 层，UI 需要知道「这次重画是不是因为换了主角」（见 ui.js 的 title 分支），
   * 两边读同一个状态才不会一个换了一个没换。
   */
  get titleHeroId() {
    return this._titleHeroId ?? this.meta?.hero ?? DEFAULT_HERO_ID;
  }

  set titleHeroId(id) {
    if (!id) return;
    this._titleHeroId = id;
    this.meta = save.patchMeta({ hero: id });
  }

  /** 标题页现在展示的那位主角记录 */
  titleHero() {
    return heroById(this.titleHeroId);
  }

  /**
   * 这一局敌人的**额外倍率** = 主角那一条（content/heroes.json 的 map.enemy）
   * × 无尽模式那一条。
   *
   * 为什么分成两半：用户要求「本体平衡是基准」（欧亚西莉亚 ×1，一个数都不动），
   * 同时给了阿特拉斯「难度曲线也会变高一些」（他自己那条），
   * 而无尽模式本来就有自己的一套复利。三件事各自独立，乘起来才不会互相干扰。
   */
  enemyMul(stage = this.data?.stage ?? 0) {
    const e = this.endlessEnemyMul(stage);
    const h = heroEnemyMul(this.data?.hero ?? DEFAULT_HERO_ID, stage);
    return { hp: e.hp * h.hp, atk: e.atk * h.atk };
  }

  /**
   * 无尽模式的敌人倍率：**正片那 6 章也略有加压**（这样它从第 1 章起就是「另一个模式」，
   * 而不是「普通模式打完成无尽」），过了正片之后复利叠加。
   * 返回的倍率由 startBattle 传给 scaleEnemy —— 敌人数值表本身**不动**
   * （用户说过本体平衡是基准）。
   */
  endlessEnemyMul(stage = this.data?.stage ?? 0) {
    if (!this.isEndless()) return { hp: 1, atk: 1 };
    const e = BALANCE.endless ?? {};
    const campaign = stageCount();
    const early = Math.min(stage, campaign);                    // 正片部分：温和加压
    const over = Math.max(0, stage - campaign);                 // 之后：复利
    const hp = (1 + (e.hpEarlyPerChapter ?? 0.05) * early) * Math.pow(1 + (e.hpPerChapter ?? 0.18), over);
    const atk = (1 + (e.atkEarlyPerChapter ?? 0.03) * early) * Math.pow(1 + (e.atkPerChapter ?? 0.1), over);
    return { hp, atk };
  }

  /**
   * 这一局的战绩摘要（写进跨局记录，见 save.recordRun / src/ui/records.js）。
   *
   * 只放 **id 与数字**：卡组是卡牌 id、地图是 biome key、最后那只怪是敌人 id ——
   * 名字一律不存，渲染时按当前语言现查（存下来会被冻结成写完那一局时的语言）。
   * `steps` 用 route 的总长度：`d.floor` 每章会归零，量不出「这一局走了多少步」。
   */
  runSummary(win) {
    const d = this.data;
    return {
      at: Date.now(),
      win: !!win,
      /** 这一局是不是无尽模式（记录页会给它打一个标记：「无尽 · 第 N 章」） */
      endless: !!d.endless,
      /** 这一局用的哪位主角（只存 id，名字渲染时按当前语言现查） */
      hero: d.hero ?? DEFAULT_HERO_ID,
      seed: d.seed ?? null,
      // 通关时 d.stage 已经加到越界（等于章节总数），所以夹回来
      stage: Math.min(d.stage + 1, stageCount()),
      // route 的总长度才是「这一局走了多少步」（d.floor 每章会归零）。
      // 兜底那个 `||` 是给「没经过节点就直接开打的调试局」用的 —— route 为空时至少别报 0 步
      steps: d.route?.length || (d.floor + 1),
      kills: d.kills,
      turns: d.turnsThisRun,
      gold: d.gold,
      hp: d.hp,
      maxHp: d.maxHp,
      atk: d.atk, def: d.def, agi: d.agi, luck: d.luck,
      deck: [...d.deck],
      biomes: [...(d.biomes ?? [])],
      // 这一局最后打的那一只：通关时是结局首领，失败时是把你打回家的那只
      foe: this.battle?.enemy?.id ?? this.battleContext?.enemyDef?.id ?? null,
    };
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
   * 这一局**已经打过照面的物种**。
   *
   * 按 slug 去重而不是按 id：同一只宝可梦在内容里可能占两条（`druddigon_crystal` 和
   * `druddigon_alpha`），对玩家来说那是**同一只**。
   */
  metSpecies() {
    const out = new Set();
    for (const id of this.data?.metEnemies ?? []) {
      const def = ENEMY_BY_ID[id];
      if (def) out.add(def.slug);
    }
    return out;
  }

  /**
   * 挑一只敌人。**同一局里不重复。**
   *
   * 起因（用户要求）：「现在出现很多宝可梦重复，要求不能有重复出现的敌方宝可梦。」
   * 量出来的确有：一局十几二十场战斗，而本章的池子只有十来只，随机抽是**有放回**的 ——
   * 同一只怪在一章里撞见两次很常见（生日悖论），跨章又会撞上「同一物种在不同图各占一条」的那批。
   *
   * 规则：优先从「本局还没见过的物种」里抽；池子被抽干了（真的没有新面孔了）
   * 才允许重复 —— 这时候宁可重复，也不能让战斗节点开不出敌人来。
   * 账本记在 run 数据里（`d.metEnemies`），中途存档读档也记得住。
   */
  pickEnemyDef(kind) {
    const biome = this.data?.map?.biome ?? 'desert';
    let pool;
    if (kind === 'boss') pool = poolFor(biome, 'boss');
    else if (kind === 'elite') pool = poolFor(biome, 'elite');
    else pool = poolFor(biome, 'normal').concat(poolFor(biome, 'mob'));
    // 这一档没配人（内容没写全）就往下找，别让战斗节点开天窗
    if (!pool.length) {
      pool = kind === 'boss' ? poolFor(biome, 'elite')
        : kind === 'elite' ? poolFor(biome, 'normal').concat(poolFor(biome, 'mob'))
          : poolFor(biome, 'mob');
    }
    if (!pool.length) pool = ENEMIES;
    const seen = this.metSpecies();
    const fresh = pool.filter((e) => !seen.has(e.slug));
    return this.rng.pick(fresh.length ? fresh : pool) ?? pool[0] ?? null;
  }

  /**
   * 抽一只敌人，并记进「这一局见过谁」的账本。
   * startBattle 与实测脚本（tools/measure-enemy-repeat.mjs）共用这一份 ——
   * 实测脚本要能**只抽不打**地跑一遍地图，才量得出重复率。
   */
  rollEnemyFor(kind) {
    const def = this.pickEnemyDef(kind);
    if (!def) return null;
    if (!Array.isArray(this.data.metEnemies)) this.data.metEnemies = [];
    if (!this.data.metEnemies.includes(def.id)) this.data.metEnemies.push(def.id);
    return def;
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
      /**
       * **一关可以有两个首领**（阿特拉斯那套：content/heroes.json 的 map.bosses = 2）。
       * 两条规矩：
       *   · `final` 那只（夜砂墓原的结局首领）**只出现在最后一章的最后一个首领位**，
       *     否则它会在前半场就出场，把结局提前演掉；
       *   · **同一章里两个首领不重样** —— `d.stageBosses` 记着这一章打过谁，选的时候排掉。
       */
      const totalBosses = Math.max(1, d.map?.bosses ?? 1);
      const fought = d.stageBosses ?? (d.stageBosses = []);
      const isChapterFinal = fought.length + 1 >= totalBosses;
      const isFinalStage = stage >= stageCount() - 1;
      let chosen = null;
      if (isFinalStage && isChapterFinal) chosen = bosses.find((b) => b.final) ?? null;
      if (!chosen) {
        const notFinal = bosses.filter((b) => !b.final);
        const pool = (notFinal.length ? notFinal : bosses).filter((b) => !fought.includes(b.id));
        const use = pool.length ? pool : (notFinal.length ? notFinal : bosses);
        // 章节首领也走「本局没见过优先」（池子里有两只的时候，不会连着两章撞上同一只）
        const seen = this.metSpecies();
        const fresh = use.filter((e) => !seen.has(e.slug));
        chosen = this.rng.pick(fresh.length ? fresh : use) ?? use[0] ?? null;
      }
      enemyDef = chosen ?? poolFor(biome, 'elite')[0] ?? ENEMIES[ENEMIES.length - 1];
      // 记进「本章打过谁」的账本（重样门禁与「第二个首领更难」都靠它）
      if (enemyDef?.id && !fought.includes(enemyDef.id)) fought.push(enemyDef.id);
    } else {
      enemyDef = this.rollEnemyFor(kind);
    }
    if (!enemyDef) enemyDef = ENEMIES[ENEMIES.length - 1];
    // 首领也要记进「这一局见过谁」的账本（以前只有 rollEnemyFor 那条路会记）
    if (kind === 'boss') {
      if (!Array.isArray(d.metEnemies)) d.metEnemies = [];
      if (enemyDef.id && !d.metEnemies.includes(enemyDef.id)) d.metEnemies.push(enemyDef.id);
    }

    const scaled = scaleEnemy(enemyDef, stage, nodeIdx, {
      atk: d.atk, def: d.def, maxHp: d.maxHp, agi: d.agi,
    }, this.enemyMul(stage));
    // 敌人卡组：从招式池里抽 9 张，并限制「单场平均威力」，
    // 免得同一回合抽到三张大地震把玩家直接秒掉（平衡细节见 tools/check-balance.mjs）
    const deck = this.buildEnemyDeck(enemyDef.deck ?? ['tackle'], kind, scaled, enemyDef.signature ?? []);

    this.battleKind = kind;
    this.battleContext = { kind, enemyDef, scaled, retry };
    /** 这一场是怎么开起来的：'map' 会放遭遇演出，'direct' 直接进战斗 */
    this.battleEntry = entry;

    this.battle = new Battle({
      seed: this.rng.int(0, 1e9),
      /**
       * 手持道具的持有效果（sumHeldMods 汇总）在这里交给战斗引擎。
       * 只有玩家那一侧有它 —— 这也是「拿在手上就一直生效」这句话的落点：
       * 每开一场战斗都重新算一次，所以中途捡到 / 丢掉 / 卖掉的道具立刻反映到下一场。
       */
      mods: this.heldMods(),
      /**
       * 图鉴：**看见敌方出招**就把这张牌记成「见过」。
       *
       * 卡牌图鉴里有 40 张 `enemyOnly` 的牌，玩家永远抽不到 —— 按用户定的规则，
       * 它们的解锁条件是「看到就解锁」而不是「拿到手」。玩家自己打的牌不用在这里记：
       * `save()` 已经会把卡组里的牌记进图鉴。
       */
      onCardPlayed: (side, cardId) => {
        if (side !== 'enemy' || !cardId) return;
        this.meta = save.noteCards([cardId]);
      },
      player: {
        name: d.name, slug: d.slug,
        hp: d.hp, maxHp: d.maxHp,
        atk: d.atk, def: d.def, agi: d.agi, luck: d.luck,
      },
      deck: this.activeBattleDeck(),
      enemy: {
        id: enemyDef.id, slug: enemyDef.slug, name: enemyDef.name,
        // 首领称号（「流沙之主」那种）一路带到战斗里：敌人面板上会打在名字旁边。
        // 以前这个字段只写在内容里、**界面上哪儿都不显示**，等于白写。
        bossTitle: enemyDef.bossTitle ?? null,
        maxHp: scaled.maxHp, atk: scaled.atk, def: scaled.def, agi: scaled.agi,
        tier: scaled.tier, deck, powerMul: scaled.powerMul ?? 1,
      },
    });
    this.battle.start();
    /**
     * 图鉴：**遇见**就记下来（不用打赢）。
     *
     * 记在 startBattle 里而不是各条入口里：战斗有四个来源（地图节点、宝箱怪、首领、
     * 诊断脚本直接开一场），逐个记一定会漏一个。
     * `faced: true` 同时 +1 挑战次数 —— 图鉴要显示「挑战 / 击败 / 失败」三个数，
     * 光知道「见过没有」算不出来（失败 = 挑战 − 击败）。
     */
    this.meta = save.noteEnemies([enemyDef.id], { faced: true });
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
      this.meta = save.patchMeta({
        runs: (this.meta.runs ?? 0) + 1,
        bestDistance: Math.max(this.meta.bestDistance ?? 0, d.floor),
        // bestStage 这个字段从最早的版本就躺在记录里，但**从来没有人写过它**
        // （通关记录页要用「最远打到第几章」，顺手在这里补上）
        bestStage: Math.max(this.meta.bestStage ?? 0, d.stage + 1),
      });
      // 无尽模式：记下「走到过第几章」（标题页与结算页显示它 —— 这个模式的成绩就是距离）
      if (d.endless) this.meta = save.noteEndlessBest(d.stage + 1);
      // 这一局照样进通关记录（「止步第 N 章」）—— 记录里只有通关的话，多数玩家的列表是空的
      this.meta = save.recordRun(this.runSummary(false));
      save.clearRun();
      this.phase = Phase.GAMEOVER;
      this.changed();
      return { win: false };
    }

    d.kills += 1;
    this.meta = save.patchMeta({ kills: (this.meta.kills ?? 0) + 1 });
    // 图鉴：击败过的那一档（赢了才算，见 save.noteEnemies）
    this.meta = save.noteEnemies([b.enemy?.id ?? this.battleContext?.enemyDef?.id], { slain: true });
    const ctx = this.battleContext;
    const rewardMult = ctx.scaled.rewardMult ?? 1;
    /**
     * 主角收益倍率（content/heroes.json 的 rewards；不写的那位是全部 ×1）。
     * 阿特拉斯那一份就是「他的敌人更硬，所以他这边掉得更多、奖励更好」里的后半句。
     */
    const rw = heroRewardMul(d.hero);
    const range = ctx.kind === 'boss' ? BALANCE.goldPerElite : ctx.kind === 'elite' ? BALANCE.goldPerElite : BALANCE.goldPerBattle;
    const gold = Math.round(this.rng.int(range[0], range[1]) * rewardMult * rw.gold);
    d.gold += gold;
    const heal = Math.round(d.maxHp * BALANCE.healAfterBattlePct);
    const healed = this.heal(heal);

    // 成长：每场战斗永久提升一点属性，精英/首领给得更多。
    // 没有这个成长，第 2、3 章的敌人强度就会超出玩家能跟上的范围。
    const growth = this.rollGrowth(ctx.kind);
    const growthText = this.applyGrowth(growth);

    // 抽奖励卡。
    //
    // 稀有度按**敌人档位**给（content/rarity.json 的 rewardWeights）——
    // 以前只有一个 `boost` 系数（普通 0.1 / 精英 0.45 / 首领 0.8），而它的加成是
    // 「越稀有越小」，于是打完首领和打完路边小怪抽到的史诗占比都是 3.5%，
    // 玩家一眼就看出来了（「boss 和精英给的卡并没有更好」）。现在档位表说了算。
    const tierKey = ctx.kind === 'boss' ? 'boss' : ctx.kind === 'elite' ? 'elite' : 'normal';
    /**
     * 档位权重 × 主角收益倍率（见 data/heroes.js 的 heroRewardWeights）。
     * 阿特拉斯那一份把常见往下压、把稀有与史诗往上抬 —— 他打的仗本来就是别人的两倍多，
     * 数量上的优势已经够大了，这里补的是**质量**：同样的精英，他更容易看到稀有以上的选项。
     */
    const weights = heroRewardWeights(d.hero, REWARD_WEIGHTS[tierKey] ?? null);
    /**
     * 精英与首领**必定出卡**。
     *
     * 以前这里只有 `ctx.kind === 'boss' ||`，精英那一档会跟着 70% 的概率走 ——
     * 也就是**每 10 次精英有 3 次空手**。玩家报的就是这个（「打完 boss 或精英不掉卡」）。
     * 精英 / 首领是玩家心里的大节点：金币、成长、选项数都按「更丰厚」设计，
     * 唯独卡牌还掷骰子，那一句承诺就破功了。
     * 普通怪仍按 cardRewardChance 抽 —— 一路都掉卡会让卡组膨胀得太快。
     */
    const getCard = ctx.kind === 'boss' || ctx.kind === 'elite' || this.rng.chance(BALANCE.cardRewardChance);
    const slots = ctx.kind === 'boss' || ctx.kind === 'elite' ? 4 : 3;
    const choices = getCard ? this.withSustainPity(rollCards(slots, 0, [], weights, d.hero), weights) : [];

    /**
     * 掉落道具（用户要的第三条）：**打赢之后有概率掉，而且按敌人的属性加权** ——
     * 「特定属性的敌人掉落其相应属性的掉落物概率更大」（见 rollItemDrop）。
     * 首领 / 精英那两档概率更高（它们是这一局的大节点）。
     */
    const drop = this.rollItemDrop(b.enemy, ctx.kind);

    /**
     * 每打赢一个首领：手持栏 +1（用户定的规则）。
     *
     * ⚠ 时机很重要 —— 必须在**发这件掉落之前**加，因为首领掉的东西要享受到
     * 这次打赢换来的那个新栏位。以前这一步写在「玩家点掉奖励页」的时候，
     * 于是玩家会遇到用户报的那一幕：「背包已经扩充，但还是会提示拿不下要求丢东西」
     * （按旧的 3/3 判定掉落，扩容的一格还没生效）。
     */
    if (ctx.kind === 'boss') d.bossKills = (d.bossKills ?? 0) + 1;

    this.reward = {
      win: true, gold, healed, cardChoices: choices,
      item: drop?.id ?? null,
      itemReason: drop?.reason ?? null,
      /**
       * 掉落**在这里就发**（不是等玩家点「拿卡」）。
       *
       * 两件事都靠它：① 掉落要有自己的一屏（见 ui/screens.js 的 renderItemDrop），
       * 那一屏要显示真实结果（已收进手持栏 N/M，或者拿不下要丢一件）；
       * ② 掉在手里的东西立刻进存档 —— 玩家在这一屏刷新页面也不会丢。
       */
      itemDrop: this.grantDrop(drop),
      isBoss: ctx.kind === 'boss',
      enemyName: b.enemy.name,
      growth, growthText,
    };
    this.phase = Phase.REWARD;
    this.save();
    this.changed();
    return this.reward;
  }

  /**
   * 敌人掉落的道具（概率低，且**按属性加权**）。
   *
   * 规则（用户给的）：
   *   · 基础概率很低：普通 8%、精英 18%、首领 35%（BALANCE.itemDropChance）；
   *   · 掉什么：从**这件敌人的属性**对应的掉落物里挑，权重 ×4（BALANCE.itemDropTypeWeight）——
   *     所以打毒系更容易掉毒针、剧毒宝珠；其余道具也能掉，只是权重低得多；
   *   · 稀有度也参与权重（epic 比 common 罕见）；
   *   · 这一整套再乘主角收益倍率（rewards.itemDropMul）—— 阿特拉斯掉得比欧亚西莉亚勤。
   *
   * @returns {{id:string, reason:'type'|'random'}|null}
   */
  rollItemDrop(enemy, kind = 'normal') {
    const base = { mob: BALANCE.itemDropChance?.mob ?? 0.08, normal: BALANCE.itemDropChance?.normal ?? 0.08, elite: BALANCE.itemDropChance?.elite ?? 0.18, boss: BALANCE.itemDropChance?.boss ?? 0.35 }[kind] ?? 0.08;
    /**
     * 主角收益倍率（rewards.itemDropMul）——「阿特拉斯这边更容易获得道具」就是这一行。
     * 上限 0.95：留着那 5% 的不确定性，不然首领那一档（0.45 × 1.7 = 0.77）再往上拧一点
     * 就会变成「必掉」，而「必掉」和「大概率掉」在玩家那边的体感是两回事。
     */
    const chance = Math.min(0.95, base * heroRewardMul(this.data?.hero).itemDrop);
    if (!this.rng.chance(chance)) return null;
    const types = new Set(enemy?.types ?? []);
    const TYPE_W = BALANCE.itemDropTypeWeight ?? 4;
    const RARITY_W = { common: 1, uncommon: 0.6, rare: 0.3, epic: 0.12 };
    const pool = [];
    for (const [id, item] of Object.entries(ITEMS)) {
      if (item.drop == null) continue;                       // 只在商人 / 宝箱里出的，不掉落
      const w = (RARITY_W[item.rarity] ?? 1) * (types.has(item.drop) ? TYPE_W : 1);
      // 同名多件：权重按 w 分摊成整数份，摸到哪件都行
      for (let i = 0; i < Math.max(1, Math.round(w * 20)); i++) pool.push(id);
    }
    if (!pool.length) return null;
    const id = this.rng.pick(pool);
    return { id, reason: types.has(ITEMS[id]?.drop) ? 'type' : 'random' };
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
   *
   * ⚠️ 保底**保的是功能，不是稀有度**：它以前是「在符合条件的卡里**等概率**抽一张」，
   * 于是每次奖励固定被塞进 2 张（回血 + 解状态各一），而回血/解状态牌里恰好有几张是史诗
   * （生命之泉、守护誓约）—— 结果**各档位的史诗占比被这 2 张抹平了**：
   * 实测普通怪 20.8% / 精英 18.5% / 首领 22.3%，精英甚至比普通怪还低，
   * 「精英与首领的奖励更好」当场破功。现在保底也走**该档位的稀有度权重表**，
   * 档位差异才真的能看出来。
   */
  withSustainPity(choices, weights = null) {
    if (!choices?.length) return choices;
    const deck = this.data.deck;
    const has = (kind) => deck.some((id) => CARD_BY_ID[id]?.effects?.some((e) => e.kind === kind));
    const out = [...choices];
    const used = new Set(out.map((c) => c.id));
    let slot = out.length - 1;
    /** 按稀有度权重抽一张（和 rollCards 同一套权重：该档位说了算） */
    const pickWeighted = (pool) => {
      const w = (c) => (weights ? (weights[c.rarity] ?? 0) : (RARITY[c.rarity]?.weight ?? 1));
      const rows = pool.map((c) => [w(c), c]).filter(([x]) => x > 0);
      const list = rows.length ? rows : pool.map((c) => [1, c]);
      const total = list.reduce((s, [x]) => s + x, 0);
      let r = Math.random() * total;
      for (const [x, c] of list) { r -= x; if (r <= 0) return c; }
      return list[list.length - 1][1];
    };
    const swapInto = (test) => {
      if (slot < 0) return false;
      const pool = playerPool(this.data?.hero).filter((c) => !used.has(c.id) && test(c));
      if (!pool.length) return false;
      const pick = pickWeighted(pool);
      used.add(pick.id);
      out[slot] = pick;
      slot -= 1;
      return true;
    };
    if (!has('heal')) swapInto((c) => c.effects.some((e) => e.kind === 'heal'));
    if (!has('cleanse') && this.data.stage > 0) swapInto((c) => c.effects.some((e) => e.kind === 'cleanse'));
    return out;
  }

  /**
   * 调试用：造一份和真实战斗奖励同结构的假数据（UI 预览 / 截图用）。
   * @param {'normal'|'elite'|'boss'} kind 档位 —— 稀有度与槽位数都按真实奖励那套走，
   *   这样截图看到的和玩家打完那一档看到的是一致的（`?scene=reward&kind=boss`）。
   */
  mockReward(kind = 'normal') {
    const growth = [{ stat: 'atk', amount: 1 }, { stat: 'maxHp', amount: 12 }];
    const isBoss = kind === 'boss';
    const item = isBoss ? 'dragon_fang' : 'oran_berry';
    return {
      win: true,
      gold: isBoss ? 260 : kind === 'elite' ? 88 : 42,
      healed: 18,
      cardChoices: rollCards(isBoss || kind === 'elite' ? 4 : 3, 0, [], heroRewardWeights(this.data?.hero, REWARD_WEIGHTS[kind] ?? null), this.data?.hero),
      item,
      itemReason: isBoss ? 'type' : 'random',
      // 掉落和真实战斗走同一条路（在这里就发），否则「捡到道具」那一屏会显示成没收到
      itemDrop: this.grantDrop({ id: item, reason: isBoss ? 'type' : 'random' }),
      isBoss,
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

  /**
   * 掉落道具的**发放**（打赢之后那一件）。
   *
   * 放在这里而不是「玩家点掉奖励页」的时候，是为了让掉落有自己的一屏
   * （ui/screens.js 的 renderItemDrop）：那一屏要如实显示结果 ——
   * 收下了（手持栏 3 / 4），还是拿不下（要丢掉一件）。
   *
   * @returns {{id:string, reason:string, stored:boolean, overflow:boolean, text:string}|null}
   */
  grantDrop(drop) {
    if (!drop?.id) return null;
    const res = this.giveItem(drop.id, 1);
    return {
      id: drop.id,
      reason: drop.reason ?? 'random',
      stored: !!res.stored,
      overflow: !!res.overflow,
      text: res.text ?? '',
    };
  }

  /** 奖励界面：拿卡 / 跳过 */
  takeRewardCard(cardId) {
    if (!this.reward) return;
    if (cardId) this.addCard(cardId);
    /**
     * 掉落的那件道具：正常情况**早在 finishBattle 里就发过了**（reward.itemDrop）。
     * 这里只兜底「有 item 但没有 itemDrop」的调用方（调试用的 mockReward）——
     * 免得那种路径下的道具静默消失。
     *
     * ⚠ `declined` 也要看：玩家在掉落那一屏明确点了「不要，就这样」之后，
     * 这一页**不许再问一遍**（用户报的「两个选项都会弹出让你丢东西的页面」就是这里漏了判断）。
     */
    const drop = this.reward.itemDrop;
    let overflow = (drop?.overflow && !drop?.declined) ? { id: this.reward.item, text: drop.text } : null;
    if (this.reward.item && !drop) {
      const res = this.giveItem(this.reward.item, 1);
      if (res.overflow) overflow = { id: this.reward.item, text: res.text };
    }
    const wasBoss = this.reward.isBoss;
    this.reward = null;
    this.awaitingOverflow = overflow;
    /**
     * 首领那一条**不在这里加 bossKills** —— 它在 finishBattle 里（发掉落之前）就加过了。
     * 在这里再加一次的话，一个首领会给两个栏位。
     *
     * ⚠ **只有「这一章的最后一个首领」才推进章节**（3.0.1 修的严重 bug）。
     * 阿特拉斯一章有两个首领（content/heroes.json 的 map.bosses = 2），
     * 以前只要打赢的是首领就 nextStage()，于是**打完前半场那个首领就直接跳到了下一章**，
     * 第二个首领永远见不到（用户报的「根本做不到一关打两个」）。
     * 现在按「这一章已经打赢过几个首领」与「这一章一共几个首领」比：
     * 还差一个就回地图继续走，最后一个才进下一章。
     */
    const chapterBosses = Math.max(1, this.data?.map?.bosses ?? 1);
    const beatenBosses = (this.data?.stageBosses ?? []).length;
    if (wasBoss && beatenBosses >= chapterBosses) {
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
    /**
     * **只给某一位主角的事件**（3.0）：`hero: 'atlas'` / `heroNot: 'atlas'`。
     *
     * 起因：旧事件里有几条**通篇按欧亚西莉亚写**（例如「另一位沙漠精灵」里
     * 「半空中悬着另一只沙漠蜻蜓。她比你小一点」「你也是……欧亚西莉亚？」）——
     * 换成阿特拉斯之后那几句就不成立了。用户的要求是「不用全改，只让阿特拉斯这边的事件不一样」，
     * 所以旧事件加 `heroNot: 'atlas'` 挡住，另写阿特拉斯专属的那几个。
     * 过滤放在挑事件这一处（而不是每个选项里判一次），漏不掉。
     */
    const heroId = this.data.hero ?? DEFAULT_HERO_ID;
    const fits = (e) => (!e.hero || e.hero === heroId) && (!e.heroNot || e.heroNot !== heroId);
    const valid = eventsFor(this.data.map.biome).filter(fits);
    const pool = valid.filter((e) => !this.usedEvents.includes(e.id));
    const ev = pool.length ? this.rng.pick(pool) : this.rng.pick(valid.length ? valid : eventsFor(this.data.map.biome));
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
      const card = rollCard(0.5, [], null, this.data?.hero);
      this.addCard(card.id);
      const gold = this.rng.int(15, 35);
      d.gold += gold;
      chest = { kind: 'card', cardId: card.id, gold, text: t('箱底压着一张卡，还有一点零钱。\n「压在最底下的多半是好东西。」\n获得「{card}」，金币 +{gold}。', { card: card.name, gold }) };
    } else if (roll < 0.9) {
      /**
       * 宝箱开出道具：从**全部道具**里按稀有度抽一件（比敌人掉落的概率高得多，
       * 因为宝箱本来就是「专门来给东西的」）。
       */
      const id = this.rollChestItem();
      const gave = this.giveItem(id, 1);
      const healed = this.heal(Math.round(d.maxHp * 0.12));
      this.awaitingOverflow = gave.overflow ? { id, text: gave.text } : null;
      chest = {
        kind: 'item', itemId: id,
        text: gave.overflow
          ? t('箱子里是一件「{name}」，可你手上已经拿满了。\n「得先放下点什么。」\n（手持栏满了，先丢掉一件再拿它。）', { name: ITEMS[id].name })
          : t('箱子底垫着一层干草，上面躺着一件「{name}」。\n「正好用得上。」\n获得「{name}」，HP +{hp}。', { name: ITEMS[id].name, hp: healed }),
      };
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

  /** 宝箱里开出来的道具：稀有度越高的越难出（比敌人掉落的池子宽） */
  rollChestItem() {
    const pool = [];
    const RARITY_W = { common: 1, uncommon: 0.7, rare: 0.35, epic: 0.15 };
    for (const [id, item] of Object.entries(ITEMS)) {
      for (let i = 0; i < Math.max(1, Math.round((RARITY_W[item.rarity] ?? 1) * 10)); i++) pool.push(id);
    }
    return this.rng.pick(pool);
  }

  leaveChest() {    const mimic = this.chest?.kind === 'mimic';
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

  /**
   * 冥想：这张卡能换成哪些牌 —— **稀有度必须严格更高**。
   *
   * 用户报的问题（原话）：「说换更厉害的卡，可是实测下来给的卡却是随机的，根本不会增加品质」。
   * 旧实现是一句 `rollCard(1.2, [])`：**随机**一张，只是把稀有卡概率抬了一点点 ——
   * 换到和原来同级、甚至更差的牌完全可能（玩家当然看得出「冥想」白做了）。
   *
   * 现在的硬规则：
   *   ① 候选的稀有度**严格高一档以上**（普通 → 精良 → 稀有 → 史诗）；
   *   ② 尽量**只升一档**（普通牌不会一步变成史诗），而且**用途相同**优先
   *      （原来的牌是攻击牌就给攻击牌），卡组的形状不会被打乱；
   *   ③ 已经最高一档（史诗）→ 返回空数组，调用方要**如实拒绝**，而不是硬塞一张。
   *
   * 打分排序：同用途 +2、刚好高一档 +1，再加一点**固定**扰动（见下）。
   *
   * ⚠ 那份扰动以前是 `this.rng() * 0.9` —— **每次调用都重新掷**，于是同一个问题问两遍
   * 会得到两份不一样的名单：界面上摆的 3 张是第一次的结果，玩家点下去之后
   * `restUpgrade` 又算了一遍，挑中的那张往往已经不在新名单里，
   * 于是走了兜底 `?? cands[0]` —— **点哪张都是"随机"给一张**（用户报的：
   * 「冥想窗口虽然给了三种选择，但实际上不管选什么最后给的都是随机的」）。
   * 现在扰动由 (原卡 id + 候选 id) 算出来，**同一张牌每次都得到同一份名单**：
   * 界面摆什么、点下去就给什么。
   *
   * @returns {object[]} 最多 n 张候选（已按「更适合」排好序）
   */
  upgradeCandidates(cardId, n = 3) {
    const card = CARD_BY_ID[cardId];
    if (!card) return [];
    const tier = RARITY_ORDER.indexOf(card.rarity);
    if (tier < 0 || tier >= RARITY_ORDER.length - 1) return [];   // 已经最高一档：没得换
    const role = cardRoleOf(card);
    const nextTier = RARITY_ORDER[tier + 1];
    const higher = playerPool(this.data?.hero).filter((c) => RARITY_ORDER.indexOf(c.rarity) > tier);
    const scored = higher.map((c) => ({
      c,
      score: (cardRoleOf(c) === role ? 2 : 0) + (c.rarity === nextTier ? 1 : 0) + stableJitter(cardId + '|' + c.id),
    }));
    // 分数相同时也按 id 兜底排一下，保证顺序**完全确定**（sort 本身是稳定排序，
    // 但显式带上 id 更保险：以后改排序实现也不会让名单抖）
    scored.sort((a, b) => (b.score - a.score) || a.c.id.localeCompare(b.c.id));
    return scored.slice(0, n).map((s) => s.c);
  }

  /**
   * 营地：把一张卡换成更好的（冥想）。
   *
   * @param {string} cardId 要换掉的卡
   * @param {string} [newId] 玩家从候选里挑的那张；不传就自动取最合适的一张（测试与老调用方用）
   * @returns {{removed:string, gained:string, from:string, to:string}|{ok:false, text:string}|null}
   */
  restUpgrade(cardId, newId = null) {
    if (this.rest?.done) return null;
    const card = CARD_BY_ID[cardId];
    if (!card) return null;
    const idx = this.data.deck.indexOf(cardId);
    if (idx < 0) return null;
    const cands = this.upgradeCandidates(cardId);
    /** 原来那张牌的稀有度档位（校验玩家挑的那张是不是真的更强要用它） */
    const tier = RARITY_ORDER.indexOf(card.rarity);
    if (!cands.length) {
      /**
       * 换不出更强的牌 —— **不消耗这次机会**，如实说清楚。
       * 旧实现这里会硬塞一张随机牌并且照样用掉机会，玩家等于白扔一次营地。
       */
      return {
        ok: false,
        text: t('「{name}」已经是{rarity}了 —— 冥想换不出更强的牌，这次机会先留着。', {
          name: card.name, rarity: RARITY[card.rarity]?.name ?? card.rarity,
        }),
      };
    }
    /**
     * 用玩家挑的那一张。
     *
     * ⚠ 这里以前是 `cands.find((c) => c.id === newId) ?? cands[0]` —— 名单每次重算
     * （当时打分里带 rng），找不到就**默默换成别的牌**，玩家看起来就是"点哪张都随机"。
     * 现在名单是确定的（不会找不到），并且这里再核一次：挑中的那张只要确实更强就用它，
     * 万一真对不上（名单变了 / 传了个别的 id）也**不偷偷换牌** —— 宁可如实报错。
     */
    const picked = newId ? CARD_BY_ID[newId] : null;
    const pickedOk = !!picked && !picked.enemyOnly && (!picked.heroOnly || picked.heroOnly === this.data?.hero) && RARITY_ORDER.indexOf(picked.rarity) > tier;
    if (newId && !pickedOk) {
      return { ok: false, text: t('那张牌换不了「{name}」—— 冥想只给比它更强的牌，这次机会先留着。', { name: card.name }) };
    }
    const better = pickedOk ? picked : cands[0];
    this.data.deck.splice(idx, 1);
    this.addCard(better.id);
    this.rest.upgraded = true;
    this.rest.done = true;
    this.rest.upgradeResult = {
      removed: card.name,
      gained: better.name,
      // 稀有度也一起记下来：界面要显示「精良 → 稀有」，让玩家**看得见**这次换牌确实变强了
      from: RARITY[card.rarity]?.name ?? card.rarity,
      to: RARITY[better.rarity]?.name ?? better.rarity,
    };
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
    const cards = rollCards(p.cards, p.rarityBoost, [], null, this.data?.hero);
    for (const c of cards) {
      const base = { common: 42, uncommon: 66, rare: 92, epic: 130 }[c.rarity] ?? 50;
      stock.push({
        kind: 'card', id: c.id, name: c.name, rarity: c.rarity,
        price: Math.round(base * (0.9 + this.rng() * 0.25) * p.priceMul),
      });
    }

    /**
     * 道具货架：从**全部道具**里挑（content/items.json，69 件）。
     *
     * 以前池子是写死的七件；现在是手持道具时代，货架按「这位商人必进的货 + 随机补齐」组，
     * 而且**便宜的先出**：一局最多只有 3~9 个手持栏，一上来就摆三件 epic 谁也买不起。
     * 价钱 = 道具自己的 price × 商人的 priceMul ×（星星沙子之类的折扣，见 shopDiscount）。
     */
    const allItems = Object.keys(ITEMS);
    const pool = allItems.slice().sort((a, b) => (ITEMS[a].price ?? 0) - (ITEMS[b].price ?? 0));
    const picked = [];
    for (const id of p.mustItems ?? []) if (ITEMS[id] && !picked.includes(id)) picked.push(id);
    for (const id of this.rng.shuffle(pool)) {
      if (picked.length >= p.items) break;
      if (!picked.includes(id)) picked.push(id);
    }
    for (const id of picked.slice(0, p.items)) {
      stock.push({
        kind: 'item', id, name: ITEMS[id].name, desc: ITEMS[id].desc,
        rarity: ITEMS[id].rarity, holdKind: ITEMS[id].kind,
        price: this.itemPrice(ITEMS[id], p.priceMul),
      });
    }
    // 保底：每位商人至少有一件「能回血的果子」（战斗里不能嗑药，回血只能靠牌和战斗外补给）
    if (p.items > 0 && !stock.some((s) => s.kind === 'item' && ITEMS[s.id]?.use?.healPct)) {
      const cheap = 'oran_berry';
      const last = stock.map((s) => s.kind).lastIndexOf('item');
      if (last >= 0) {
        stock[last] = {
          kind: 'item', id: cheap, name: ITEMS[cheap].name, desc: ITEMS[cheap].desc,
          rarity: ITEMS[cheap].rarity, holdKind: ITEMS[cheap].kind, price: this.itemPrice(ITEMS[cheap], p.priceMul),
        };
      }
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
    /**
     * **手持栏满了就不能成交** —— 这一条必须在 `data.gold -= price` **之前**。
     *
     * ⚠ 用户报的：「身上道具满了的时候还能买道具，但是不光没有钱还消失了」。
     * 原来的顺序是「先扣钱 → 标记售出 → 再看栏位满不满」，于是栏位满时一买就是
     * **钱扣掉了、货也卖掉了、东西没拿到**（三样全丢）。删卡服务那条拦截写在前面是对的，
     * 道具这条却写在了后面 —— 同一个坑踩了两次。
     */
    if (entry.kind === 'item' && this.data.held.length >= this.heldMax()) {
      return {
        ok: false,
        heldFull: true,
        text: t('手持栏满了（{n} / {max}）—— 先在「手持道具」里丢掉一件，再回来买。', {
          n: this.data.held.length, max: this.heldMax(),
        }),
      };
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
      // 栏位满不满在**扣钱之前**已经判过了（见上面那条 heldFull），这里直接发货
      const got = this.giveItem(entry.id, 1);
      const it = ITEMS[entry.id];
      const kindNote = it?.kind === 'hold'
        ? t('（持有：拿在手上一直生效）')
        : t('（可用：战斗外使用）');
      return { ok: true, text: t('买下「{name}」{note}。', { name: entry.name, note: kindNote }) };
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

export { BIOMES, NODE_TYPES, BALANCE, ITEMS, ITEM_ART, CARD_BY_ID, CARDS, ENEMY_BY_ID, stageCount, ENEMIES };
