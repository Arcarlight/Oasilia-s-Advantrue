// 图鉴：卡牌图鉴 + 敌人图鉴。
//
// 两个入口共用这一份实现：
//   · 标题页 —— 还没开局也能翻（没有 run 的时候「这一局带着的卡」自然是空集）；
//   · 游戏内 —— 地图页的「图鉴」按钮、战斗 HUD 上那枚图标，以及卡组一览里展开的
//     卡牌图鉴（那块网格也走这里的 fillCardGrid，排序 / 分组标题 / 「没拿过」的压暗
//     全站只有一套实现，不会出现「卡组页有分组、图鉴里没有」这种两边不一致）。
//
// ── 一条硬规矩：只存 id，不存名字 ─────────────────────────────────────
// 跨局记录（meta.seenCards / seenEnemies）里存的是卡牌 id 与敌人 id。
// 名字是**原地改写**的内容字段（切语言就变），存下来就会被冻结成当时的语言；
// id 是中性的，渲染时现查 —— 所以玩家中途切成日语，三年前的记录也跟着变日语。
//
// ── 另一条：跨局记录**一次读完**，别在每个格子里各读一遍 ──────────────
// save.readMeta() 每次都要 JSON.parse 一遍 localStorage（那份记录里还有 30 局战绩），
// 一张卡一个格子地读就是 192 次 parse、156 次 parse —— 打开图鉴会明显卡一下。
// 所以下面都是「进来读一次，传着走」。这一条是量出来的，不是想当然。

import { el, clear, modal } from './dom.js';
import { cardEl } from './cards.js';
import { SORT_MODES, sortCards, groupLabel, cardPowerTotal, resolveCardText } from './cardtext.js';
import { CARDS, CARD_BY_ID } from '../data/cards.js';
import { heroById } from '../data/heroes.js';
// 道具图鉴（手持道具）：数据 + 效果说人话的那一份表 + 卖出价（引擎算的）
import { ITEMS, itemArtUrl } from '../data/items.js';
import { holdLines, useLine } from '../core/itemtext.js';
import { itemSellPrice } from '../core/item-rules.js';
import { ENEMIES, ENEMY_BY_ID, MOVE_POOLS, TIERS } from '../data/enemies.js';
import { BIOMES, BALANCE } from '../data/balance.js';
import { createPortrait } from '../core/portraits.js';
import { createIcon, ICONS } from '../core/icons.js';
import { createAnim, DIR } from '../core/sprites.js';
import { turnArt } from '../core/gen9.js';
import { save } from '../core/save.js';
import { t } from '../core/i18n.js';
import { audio } from '../core/audio.js';
import { showCardDetail } from './carddetail.js';
// 流派标签（图标 / 名字 / 说明）：图鉴里那一排「流派：」筛选按钮用它
import { CARD_TAG_INFO } from './cardtags.js';

/**
 * 击败次数 -> 奖牌档位（0 = 还没拿到牌）与档位表。
 *
 * 用户要求：**打败 5 次铜牌 / 15 次银牌 / 25 次金牌 / 50 次紫金牌**，挂在图鉴里那只的行走图右上角。
 * 素材包里只有一张白色奖牌剪影（Kenney `medal1.png`），四种颜色是 CSS 染出来的
 * （和 `.ico-*` 的 mask 一个道理，见 style.css 的 .medal-*）。
 */
export function medalTier(wins) {
  if (wins >= 50) return 4;
  if (wins >= 25) return 3;
  if (wins >= 15) return 2;
  if (wins >= 5) return 1;
  return 0;
}

export const MEDALS = [
  null,
  { cls: 'medal-bronze', get name() { return t('铜牌'); }, at: 5 },
  { cls: 'medal-silver', get name() { return t('银牌'); }, at: 15 },
  { cls: 'medal-gold', get name() { return t('金牌'); }, at: 25 },
  { cls: 'medal-platinum', get name() { return t('紫金牌'); }, at: 50 },
];

/** 这一局正带着哪些卡（标题页没有 run —— 那时给空数组，全部按「以前拿过 / 没见过」显示） */
export const deckIdsOf = (game) => game?.data?.deck ?? [];

/** 卡牌图鉴的状态判据（读一次跨局记录，避免每个格子都 parse 一遍 localStorage） */
export function codexStateOf(id, deck, seen) {
  if (deck.has(id)) return 'deck';
  return seen.has(id) ? 'seen' : 'new';
}

// ============================================================
// 卡牌图鉴
// ============================================================

/** 卡牌收集进度（进度条上的「86 / 192」；拿到过就算，重复的不另算） */
export function cardCodexProgress(deckIds = []) {
  const seen = new Set(save.readMeta().seenCards ?? []);
  const deck = new Set(deckIds);
  let got = 0;
  for (const c of CARDS) if (deck.has(c.id) || seen.has(c.id)) got += 1;
  return { got, total: CARDS.length };
}

/**
 * 把一批卡填进网格。
 *
 * 三种状态（这一局带着 / 以前拿过 / 没见过）由 codexStateOf() 现算 ——
 * 卡组页的正片（全是「带着」）和展开的图鉴（三种混在一起）用的是同一份判断。
 */
export function fillCardGrid(container, cards, { sortMode = 'default', deckIds = [] } = {}) {
  clear(container);
  const deck = new Set(deckIds);
  const seen = new Set(save.readMeta().seenCards ?? []);
  const copies = new Map();
  for (const id of deckIds) copies.set(id, (copies.get(id) ?? 0) + 1);

  let lastGroup = null;
  for (const { card, group } of sortCards(cards, sortMode)) {
    const state = codexStateOf(card.id, deck, seen);
    // 「按特殊效果」时插分组标题：光靠排序玩家看不出为什么这张排在前面
    if (sortMode === 'effect' && group !== lastGroup) {
      lastGroup = group;
      container.append(el('div', { class: 'grid-group' }, [el('span', { text: groupLabel(group) })]));
    }
    const badges = [];
    if (sortMode === 'damage') badges.push(t('威力 {n}%', { n: cardPowerTotal(card) }));
    const n = copies.get(card.id) ?? 0;
    if (state === 'deck' && n > 1) badges.push(`×${n}`);
    /**
     * 只给敌人用的牌（`enemyOnly`）单独标一行「仅敌人可用」。
     *
     * 为什么不干脆从图鉴里删掉它们：玩家在战斗里**看得见**敌方出这些牌
     * （「扬起沙尘！」那种），图鉴里留着一栏才讲得通 ——
     * 而且它们的解锁条件是「**看见就解锁**」（见 battle.js 的 onCardPlayed），
     * 不是「拿到手」。不标的话，玩家会以为这 40 张自己也能抽到。
     */
    if (card.enemyOnly) badges.push(t('仅敌人可用'));
    /**
     * **主角专属牌**（3.0）：告诉玩家「这张只有那一位主角抽得到」。
     * 不标的话，欧亚西莉亚的玩家会一直等一张永远不会出现在自己奖励里的牌。
     */
    if (card.heroOnly) {
      const h = heroById(card.heroOnly);
      if (h) badges.push(t('专属：{name}', { name: h.name }));
    }
    if (state === 'new') badges.push(t('未获得'));
    else if (state === 'seen') badges.push(t('曾拿过'));
    const node = cardEl(card, {
      size: 'sm',
      badges,
      onClick: () => showCardDetail(card, { state: () => ({ owned: n }) }),
    });
    // 没拿过的卡压暗：图鉴里「全亮」会让玩家以为这些都算已收集（用户反馈）
    if (state === 'new') node.classList.add('card-unowned');
    if (card.enemyOnly) node.classList.add('card-enemy-only');
    container.append(node);
  }
}

/**
 * 卡牌图鉴（独立一页）。
 *
 * 以前它只是卡组一览里一个折叠 `<details>`，而卡组一览要**先开一局**才进得去 ——
 * 于是「刚进游戏、想先看看这里面有什么牌」是做不到的（用户要求把它放到标题页）。
 */
export function showCardCodex(game) {
  const deckIds = deckIdsOf(game);
  let sortMode = 'default';
  const progress = cardCodexProgress(deckIds);

  const body = el('div', {});
  body.append(el('div', { class: 'codex-head' }, [
    el('div', { class: 'codex-progress' }, [
      el('b', { text: `${progress.got} / ${progress.total}` }),
      el('span', { text: t('已收集的卡牌种类（拿到过就算，重复的不另算）') }),
    ]),
  ]));

  const grid = el('div', { class: 'card-grid', style: { marginTop: '10px' } });
  const sortHint = el('span', { class: 'sort-hint' });
  const sortBar = el('div', { class: 'sort-bar' }, [el('span', { class: 'sort-label', text: t('排序：') })]);
  const tabs = SORT_MODES.map((m) => {
    const tab = el('button', {
      class: `sort-tab${m.key === sortMode ? ' active' : ''}`,
      dataset: { tip: m.hint() },
      onClick: () => {
        sortMode = m.key;
        audio.ui('toggle');
        for (const x of tabs) x.classList.toggle('active', x.dataset.sort === sortMode);
        paint();
      },
    }, [m.label()]);
    tab.dataset.sort = m.key;
    sortBar.append(tab);
    return tab;
  });
  sortBar.append(sortHint);

  /**
   * 「只看玩家能拿到的 / 只看仅敌人可用的」——用户要的「在图鉴里分类」。
   *
   * 为什么值得单独一个筛选：图鉴一共 273 张，其中 **40 张只给敌人用**；
   * 玩家想盘点「我还能抽到哪些」时，这 40 张会一直混在里面（而且它们标着「未获得」，
   * 永远拿不到，看着像收集不完）。加这一排之后两边都能一眼看全。
   */
  const OWNER_TABS = [
    { key: 'all', label: t('全部') },
    { key: 'player', label: t('玩家可用') },
    { key: 'enemy', label: t('仅敌人可用') },
  ];
  let owner = 'all';
  const ownerBar = el('div', { class: 'sort-bar' }, [el('span', { class: 'sort-label', text: t('分类：') })]);
  const ownerTabs = OWNER_TABS.map((o) => {
    const tab = el('button', {
      class: `sort-tab${o.key === owner ? ' active' : ''}`,
      onClick: () => {
        owner = o.key;
        audio.ui('toggle');
        for (const x of ownerTabs) x.classList.toggle('active', x.dataset.owner === owner);
        paint();
      },
    }, [o.label]);
    tab.dataset.owner = o.key;
    ownerBar.append(tab);
    return tab;
  });
  body.append(ownerBar);

  /**
   * **按流派筛选**（v2.9961.1）：毒流 / 出血流 / 单次高伤 / 削弱流 / 强化流 / 蓄势流。
   *
   * 为什么要它：这些流派牌散在 284 张里，光靠翻根本看不出「强化流的牌到底有几张」——
   * 用户就直接问过「你这真的加了能加 buff 的卡牌吗？」。加一排按钮之后，
   * 点一下就能把该流派的牌全列出来（含每档稀有度各几张）。
   */
  const allTags = new Map();               // tag → 张数（只数玩家能拿到的）
  for (const c of CARDS) {
    if (c.enemyOnly) continue;
    for (const k of c.tags ?? []) allTags.set(k, (allTags.get(k) ?? 0) + 1);
  }
  const tagItems = [...allTags.entries()]
    .filter(([k]) => CARD_TAG_INFO[k])
    .sort((a, b) => b[1] - a[1]);
  let tag = 'all';
  const tagBar = el('div', { class: 'sort-bar' }, [el('span', { class: 'sort-label', text: t('流派：') })]);
  const tagTabs = [];
  const mkTagTab = (key, label, count) => {
    const tab = el('button', {
      class: `sort-tab${key === tag ? ' active' : ''}`,
      onClick: () => {
        tag = key;
        audio.ui('toggle');
        for (const x of tagTabs) x.classList.toggle('active', x.dataset.tag === tag);
        paint();
      },
    }, [count == null ? label : `${label} ${count}`]);
    tab.dataset.tag = key;
    tagBar.append(tab);
    tagTabs.push(tab);
    return tab;
  };
  mkTagTab('all', t('全部'), null);
  for (const [k, n] of tagItems) {
    const info = CARD_TAG_INFO[k];
    mkTagTab(k, info.label(), n).dataset.tip = info.desc();
  }
  body.append(tagBar);

  const ownerFiltered = () => (owner === 'all' ? CARDS
    : owner === 'enemy' ? CARDS.filter((c) => c.enemyOnly)
      : CARDS.filter((c) => !c.enemyOnly));
  const tagFiltered = () => (tag === 'all' ? ownerFiltered() : ownerFiltered().filter((c) => (c.tags ?? []).includes(tag)));

  const paint = () => {
    fillCardGrid(grid, tagFiltered(), { sortMode, deckIds });
    sortHint.textContent = SORT_MODES.find((m) => m.key === sortMode)?.hint() ?? '';
  };

  body.append(sortBar, grid);
  body.append(el('div', { class: 'help-card', style: { marginTop: '12px' } }, [
    el('h4', { text: t('怎么看这一页') }),
    el('ul', {}, [
      el('li', { text: t('亮着的卡 = 已经拿到过；灰掉并标着「未获得」的还没见过。') }),
      el('li', { text: t('标着「仅敌人可用」的牌你抽不到 —— 在战斗里**看见敌方打出**它就解锁（图鉴会记下来）。') }),
      el('li', { text: t('卡牌图鉴是跨局的：开新一局也照样记着。') }),
      el('li', { text: t('点任意一张卡，看完整说明、效果明细和关键词解释。') }),
      el('li', { text: t('想看「这一局正带着什么」，去游戏里的卡组一览（按 D）。') }),
    ]),
  ]));
  paint();
  return modal({ title: t('卡牌图鉴'), wide: true, body });
}

// ============================================================
// 敌人图鉴
// ============================================================

const TIER_ORDER = ['mob', 'normal', 'elite', 'boss'];

/** 读一次跨局记录，敌人图鉴要用的两个集合（别再在格子里各读一次） */
export function enemyCodexSets() {
  const meta = save.readMeta();
  const seen = new Set(meta.seenEnemies ?? []);
  const beaten = new Set(meta.slainEnemies ?? []);
  // 老存档里可能只有 seen（没有 slain）：见过的都补进 seen，免得两边集合不一致
  for (const id of beaten) seen.add(id);
  return { seen, beaten, meta };
}

/** 敌人收录进度（见过就算收录；击败与否是卡片上的一个 ✓） */
export function enemyCodexProgress(sets = enemyCodexSets()) {
  return {
    seen: ENEMIES.filter((e) => sets.seen.has(e.id)).length,
    beaten: ENEMIES.filter((e) => sets.beaten.has(e.id)).length,
    total: ENEMIES.length,
  };
}

/** 一只敌人的图鉴状态：'new' 没见过 / 'met' 见过 / 'slain' 打赢过 */
function enemyState(id, sets) {
  if (sets.beaten.has(id)) return 'slain';
  return sets.seen.has(id) ? 'met' : 'new';
}

/**
 * 敌人图鉴。
 *
 * 这是**宝可梦图鉴**的做法：按地图分节、每节里按档位排；没见过的画成剪影，
 * 只留图鉴编号（「这里还有一只没见过的」本身就是要给玩家的信息）。
 * 见过的能看到它的台词与招式池 —— 开打之前先知道对面会什么，是这类游戏最实用的情报。
 *
 * 顶上那排筛选是给「还差哪几只没打过」用的：156 只一次全铺出来太长了。
 */
export function showEnemyCodex() {
  const sets = enemyCodexSets();
  const progress = enemyCodexProgress(sets);
  let filter = 'all';

  const body = el('div', {});
  body.append(el('div', { class: 'codex-head' }, [
    el('div', { class: 'codex-progress' }, [
      el('b', { text: `${progress.seen} / ${progress.total}` }),
      el('span', { text: t('已收录的宝可梦（遇见过就算，打赢过的会打上 ✓）') }),
    ]),
    el('div', { class: 'codex-sub', text: t('其中已击败 {a} / {b}', { a: progress.beaten, b: progress.total }) }),
  ]));

  const filters = [
    { key: 'all', label: t('全部') },
    { key: 'met', label: t('已收录') },
    { key: 'new', label: t('未收录') },
    { key: 'slain', label: t('已击败') },
  ];
  const filterBar = el('div', { class: 'sort-bar' }, [el('span', { class: 'sort-label', text: t('筛选：') })]);
  const tabs = filters.map((f) => {
    const tab = el('button', {
      class: `sort-tab${f.key === filter ? ' active' : ''}`,
      onClick: () => {
        filter = f.key;
        audio.ui('toggle');
        for (const x of tabs) x.classList.toggle('active', x.dataset.f === filter);
        paint();
      },
    }, [f.label]);
    tab.dataset.f = f.key;
    filterBar.append(tab);
    return tab;
  });
  body.append(filterBar);

  const list = el('div', { class: 'dex-sections' });
  body.append(list);

  function paint() {
    clear(list);
    let shown = 0;
    // 按地图分节：顺序取 BIOMES 的键顺序（含后加的四张新图），节内按 野生 → 较强 → 精英 → 首领
    for (const key of Object.keys(BIOMES)) {
      const all = ENEMIES.filter((e) => e.biome === key)
        .sort((a, b) => TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier));
      if (!all.length) continue;
      const rows = all.filter((e) => {
        const st = enemyState(e.id, sets);
        if (filter === 'met') return st !== 'new';
        if (filter === 'new') return st === 'new';
        if (filter === 'slain') return st === 'slain';
        return true;
      });
      if (!rows.length) continue;
      shown += rows.length;

      const got = all.filter((e) => enemyState(e.id, sets) !== 'new').length;
      const section = el('div', { class: 'dex-section' }, [
        el('div', { class: 'dex-section-head' }, [
          el('span', { class: 'dex-section-dot', style: { background: BIOMES[key].accent ?? '#f0b95c' } }),
          el('span', { class: 'dex-section-name', text: BIOMES[key].name }),
          el('span', { class: 'dex-section-count', text: `${got} / ${all.length}` }),
        ]),
      ]);
      const grid = el('div', { class: 'dex-grid' });
      for (const e of rows) grid.append(enemyCard(e, sets));
      section.append(grid);
      list.append(section);
    }
    if (!shown) list.append(el('p', { class: 'dex-empty', text: t('这个筛选下没有宝可梦 —— 换一个筛选看看。') }));
  }

  paint();
  body.append(el('div', { class: 'help-card', style: { marginTop: '12px' } }, [
    el('h4', { text: t('怎么看这一页') }),
    el('ul', {}, [
      el('li', { text: t('剪影 = 还没遇见。图鉴编号一直看得见，就当是「这里还有一只」。') }),
      el('li', { text: t('点开见过的宝可梦，能看到它的台词、招牌招式和招式池 —— 打之前先看清它会什么。') }),
      el('li', { text: t('敌人图鉴也是跨局的：中途退出、开新一局，记录都还在。') }),
    ]),
  ]));
  return modal({ title: t('敌人图鉴'), wide: true, body });
}

// ============================================================
// 道具图鉴（手持道具）
// ============================================================
//
// 规则和敌人图鉴一样（用户选的「跟敌人图鉴同一套规则」）：
//   没拿过 = 压暗的剪影 + ？？？，拿过 = 图标 + 名字 + 效果 + 出处。
// 「拿过」记在 save 的 meta.seenItems 里（由 Game.giveItem 那一处记，见 save.noteItems）。

export function itemCodexSets() {
  const meta = save.readMeta();
  return { seen: new Set(meta.seenItems ?? []), meta };
}

export function itemCodexProgress(sets = itemCodexSets()) {
  const list = Object.values(ITEMS);
  return {
    seen: list.filter((i) => sets.seen.has(i.id)).length,
    total: list.length,
  };
}

/** 一件道具的图鉴状态（拿到了就没变过 —— 道具不像敌人有「见过但没打赢」这一档） */
function itemState(id, sets) {
  return sets.seen.has(id) ? 'got' : 'new';
}

/**
 * 道具图鉴。
 *
 * 按**用法**分三节，而不是按稀有度：玩家翻这一页时想知道的是
 * 「有什么东西能拿在手上」「有什么能战斗外应急」，不是「哪个贵」。
 * 属性掉落物那一节里，每件还会标出它属于哪个属性（打那个属性的敌人更容易掉）。
 */
export function showItemCodex() {
  const sets = itemCodexSets();
  const progress = itemCodexProgress(sets);
  let filter = 'all';

  const SECTIONS = [
    { key: 'drop', title: t('属性掉落物（打赢对应属性的敌人更容易掉）'), match: (i) => i.drop != null },
    { key: 'hold', title: t('持有生效（拿在手上一直起作用）'), match: (i) => i.kind === 'hold' && i.drop == null },
    { key: 'use', title: t('战斗外使用（用掉就没了）'), match: (i) => i.kind === 'use' },
  ];

  const body = el('div', {});
  body.append(el('div', { class: 'codex-head' }, [
    el('div', { class: 'codex-progress' }, [
      el('b', { text: `${progress.seen} / ${progress.total}` }),
      el('span', { text: t('已见过的道具（拿到过一次就算）') }),
    ]),
    el('div', { class: 'codex-sub', text: t('商人那里能买、也能卖；宝箱和敌人掉落是另外两个来路。') }),
  ]));

  const filters = [
    { key: 'all', label: t('全部') },
    { key: 'got', label: t('已见过') },
    { key: 'new', label: t('还没见过') },
    { key: 'hold', label: t('持有型') },
    { key: 'use', label: t('使用型') },
  ];
  const filterBar = el('div', { class: 'sort-bar' }, [el('span', { class: 'sort-label', text: t('筛选：') })]);
  const tabs = filters.map((f) => {
    const tab = el('button', {
      class: `sort-tab${f.key === filter ? ' active' : ''}`,
      onClick: () => {
        filter = f.key;
        audio.ui('toggle');
        for (const x of tabs) x.classList.toggle('active', x.dataset.f === filter);
        paint();
      },
    }, [f.label]);
    tab.dataset.f = f.key;
    filterBar.append(tab);
    return tab;
  });
  body.append(filterBar);

  const list = el('div', { class: 'dex-sections' });
  body.append(list);

  function paint() {
    clear(list);
    let shown = 0;
    for (const sec of SECTIONS) {
      const all = Object.values(ITEMS).filter(sec.match).sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
      if (!all.length) continue;
      const rows = all.filter((i) => {
        const st = itemState(i.id, sets);
        if (filter === 'got') return st === 'got';
        if (filter === 'new') return st === 'new';
        if (filter === 'hold') return i.kind === 'hold';
        if (filter === 'use') return i.kind === 'use';
        return true;
      });
      if (!rows.length) continue;
      shown += rows.length;
      const got = all.filter((i) => itemState(i.id, sets) === 'got').length;
      const section = el('div', { class: 'dex-section' }, [
        el('div', { class: 'dex-section-head' }, [
          el('span', { class: 'dex-section-name', text: sec.title }),
          el('span', { class: 'dex-section-count', text: `${got} / ${all.length}` }),
        ]),
      ]);
      const grid = el('div', { class: 'dex-grid' });
      for (const it of rows) grid.append(itemCard(it, sets));
      section.append(grid);
      list.append(section);
    }
    if (!shown) list.append(el('p', { class: 'dex-empty', text: t('这个筛选下没有道具 —— 换一个筛选看看。') }));
  }

  paint();
  body.append(el('div', { class: 'help-card', style: { marginTop: '12px' } }, [
    el('h4', { text: t('怎么看这一页') }),
    el('ul', {}, [
      el('li', { text: t('压暗的剪影 = 还没拿到过。名字与效果要拿到手之后才登记。') }),
      el('li', { text: t('点开一件道具，能看到它的全部效果、价钱，以及在哪里能弄到。') }),
      el('li', { text: t('道具图鉴也是跨局的：拿到过一次就永久登记，重开一局不会忘。') }),
    ]),
  ]));
  return modal({ title: t('道具图鉴'), wide: true, body });
}

/** 图鉴里的一张道具卡（没拿过的画成压暗剪影 + ？？？） */
function itemCard(item, sets) {
  const got = itemState(item.id, sets) === 'got';
  const art = el('div', { class: 'dex-art' });
  art.append(el('img', {
    class: `item-codex-art${got ? '' : ' silhouette'}`,
    src: itemArtUrl(item.id),
    alt: got ? item.name : '',
    draggable: false,
  }));
  const chips = [];
  chips.push(el('span', { class: `item-kind ${item.kind}`, text: item.kind === 'hold' ? t('持有') : t('可用') }));
  if (item.drop) chips.push(el('span', { class: 'item-type', text: item.drop }));
  return el('button', {
    class: `dex-card item-card ${got ? 'got' : 'new'}`,
    dataset: { tip: got ? `${item.name} · ${t(item.desc)}` : t('还没拿过的道具') },
    onClick: () => { audio.ui('click2'); showItemDetail(item.id, sets); },
  }, [
    art,
    el('div', { class: 'dex-card-name', text: got ? item.name : t('？？？') }),
    el('div', { class: 'item-chips' }, chips),
  ]);
}

/** 一件道具的详情（图鉴里点开） */
export function showItemDetail(id, sets = itemCodexSets()) {
  const item = ITEMS[id];
  if (!item) return null;
  const got = itemState(id, sets) === 'got';
  const rows = [];
  if (got) {
    for (const line of holdLines(item)) rows.push(el('div', { class: 'detail-row' }, [el('span', { class: 'dr-label', text: t('持有') }), el('span', { text: line })]));
    const u = useLine(item);
    if (u) rows.push(el('div', { class: 'detail-row' }, [el('span', { class: 'dr-label', text: t('使用') }), el('span', { text: u })]));
  }

  const body = el('div', { class: 'item-detail' }, [
    el('div', { class: 'item-detail-top' }, [
      el('img', { class: `item-detail-art${got ? '' : ' silhouette'}`, src: itemArtUrl(id), alt: got ? item.name : '', draggable: false }),
      el('div', { class: 'item-detail-info' }, [
        el('h2', { text: got ? item.name : t('？？？') }),
        el('div', { class: 'item-chips' }, [
          el('span', { class: `item-kind ${item.kind}`, text: item.kind === 'hold' ? t('持有生效') : t('战斗外使用') }),
          el('span', { class: `detail-chip rarity-${item.rarity}`, text: t(RARITY_NAME[item.rarity] ?? item.rarity) }),
          item.drop ? el('span', { class: 'item-type', text: t('{type} 属性掉落', { type: item.drop }) }) : null,
        ]),
        el('p', { text: got ? t(item.desc) : t('还没拿过这件东西 —— 拿到手之后这里会写明它的效果。') }),
      ]),
    ]),
    rows.length ? el('div', { class: 'detail-sec' }, [el('h4', { text: t('效果') }), el('div', { class: 'detail-rows' }, rows)]) : null,
    got ? el('div', { class: 'detail-sec' }, [
      el('h4', { text: t('来路与价钱') }),
      el('ul', { class: 'item-src' }, [
        el('li', { text: t('商人：买入 {buy} 金币，卖出 {sell} 金币。', { buy: item.price, sell: itemSellPrice(item) }) }),
        item.drop ? el('li', { text: t('敌人掉落：打赢 {type} 属性的宝可梦时概率更高。', { type: item.drop }) }) : null,
        el('li', { text: t('宝箱：开箱时有概率开出来。') }),
      ]),
    ]) : null,
  ]);
  return modal({ title: t('道具图鉴'), wide: true, body });
}

/** 稀有度的中文名（和卡牌图鉴共用同一套变量） */
const RARITY_NAME = { common: '普通', uncommon: '精良', rare: '稀有', epic: '史诗' };

/** 图鉴里的一张敌人卡（没见过的画成剪影，只留图鉴编号） */function enemyCard(def, sets) {
  const state = enemyState(def.id, sets);
  const known = state !== 'new';
  const tierName = TIERS[def.tier]?.name ?? def.tier;

  const art = el('div', { class: 'dex-art' });
  if (known) {
    /**
     * 见过的用**小图标**（Generation 9 Pack 的 animated Icons，会动）。
     * 它是 64×64 一帧的动图条，靠 CSS `steps()` 逐帧播（见 src/core/icons.js）。
     * 那只没有小图标时退回 PMD 头像 —— 图鉴不能因为少一张素材就开天窗。
     */
    const icon = createIcon(def.slug, { size: 40, alt: def.name });
    if (icon) art.append(icon);
    else {
      createPortrait(def.slug, { emotion: 'normal', size: 64, alt: def.name }).then((img) => {
        if (!img) return;
        clear(art);
        art.append(img);
      });
    }
  } else {
    art.append(el('span', { class: 'dex-unknown', text: '?' }));
  }

  return el('button', {
    class: `dex-card ${state}`,
    dataset: {
      tip: known
        ? `${def.name} · ${tierName}${def.bossTitle ? ` · ${def.bossTitle}` : ''}`
        : t('还没遇见过的宝可梦'),
    },
    onClick: () => { audio.ui('click2'); showEnemyDetail(def, sets, sets.meta); },
  }, [
    art,
    el('div', { class: 'dex-card-body' }, [
      el('div', { class: 'dex-card-name', text: known ? def.name : t('？？？') }),
      el('div', { class: 'dex-card-meta' }, [
        el('span', { class: 'dex-no', text: `#${def.dex ?? '----'}` }),
        el('span', { class: `dex-tier tier-${def.tier}`, text: tierName }),
      ]),
    ]),
    state === 'slain' ? el('span', { class: 'dex-slain ico-check' }) : null,
  ]);
}

/** 一只敌人的详情：出场台词 / 招牌招式 / 招式池 / 战绩 */
/**
 * 「按鼠标方向转向」的朝向行。
 *
 * 行序见 sprites.js 的 DIR：0 下 / 1 右下 / 2 右 / 3 右上 / 4 上 / 5 左上 / 6 左 / 7 左下。
 * 算法：以精灵图中心为原点，鼠标在哪个方向就取那一行。
 * 屏幕坐标 y 是**向下**的，而朝向表的 0 号是「下」、顺时针经「右」到「左下」，
 * 所以要用 `atan2(-dy, dx)`（把屏幕的 y 翻过来，让 0° = 右、90° = 上），
 * 再映射到「每 45° 一个朝向、表的顺序是 下→右下→右→…→左下（也就是从『右』开始逆时针）」：
 *   sector = round(角度 / 45)（右 = 0、上 = 2、左 = 4、下 = -2）
 *   row = (2 + sector) % 8
 * 实测（tools/diag-codex.js 第 ⑤ 节逐个方向打表，鼠标在 下/右下/右/… → 行）：
 *   0,1,2,3,4,5,6,7 —— 八个方向一一对上。
 */
export function dirFromPoint(cx, cy, px, py) {
  if (![cx, cy, px, py].every((v) => Number.isFinite(v))) return DIR.DOWN;
  const dx = px - cx;
  const dy = py - cy;
  if (!dx && !dy) return DIR.DOWN;
  const deg = (Math.atan2(-dy, dx) * 180) / Math.PI;
  const sector = Math.round(deg / 45);
  return ((2 + sector) % 8 + 8) % 8;
}

/** 击败次数 -> 奖牌档位（0 = 还没拿到牌） */

/**
 * 一只敌人的详情：行走图（跟着鼠标转向 + 右上角奖牌）/ 立绘 / 小图标
 * + 名称编号称号属性 + 卡牌 + 战绩（挑战 / 失败 / 胜率）+ 口吻台词。
 *
 * 布局是用户指定的：**不要三张图各套一个框**，行走图 / 立绘 / 小图标摆在左上，
 * 右边放名称等信息，下面才是卡牌与战绩。
 */
function showEnemyDetail(def, sets, meta) {
  const state = enemyState(def.id, sets);
  const known = state !== 'new';
  const tierName = TIERS[def.tier]?.name ?? def.tier;
  const biome = BIOMES[def.biome];
  const metaAll = meta ?? save.readMeta();
  const wins = Math.max(0, countSlain(metaAll, def.id));
  const battles = Math.max(wins, countSeen(metaAll, def.id));
  const losses = Math.max(0, battles - wins);

  /**
   * 左边那一整块图（.dex-art-compose）：立绘当主体、行走图压右下、小图标压左下。
   * **先建好容器**（不是 null）：下面的 `if (known)` / `else` 两个分支都往它里面 append，
   * 第一版只在一个分支里建，没见过的剪影点开就抛「Cannot read properties of null (reading 'append')」——
   * 界面上看起来只是「点了没反应」。
   */
  const artRow = el('div', { class: 'dex-art-compose' });

  if (known) {
    /**
     * 左边那**一整块**（用户给的排版，第二版）：
     *   回合立绘放大当主体；行走图按正常尺寸压在**立绘的右下角**（和立绘部分重叠）；
     *   小图标压在**立绘的左下角**（也重叠，尺寸不放大）。
     * 三张图**不是一样大**：立绘是主体，另外两张是压在它角上的小图。
     * 标签改成悬停说明 —— 三张图叠成一幅画之后，再排三个标签会把画面挤乱。
     */
    const turnBox = el('div', { class: 'dex-turnart', dataset: { tip: t('回合切换时「由大变小」的那张立绘') } });
    {
      const art = turnArt(def.slug, 'front');
      if (art) {
        const img = document.createElement('img');
        img.src = art.url;
        img.alt = def.name;
        img.className = 'dex-turnart-img';
        img.draggable = false;
        turnBox.append(img);
      } else {
        turnBox.append(el('span', { class: 'dex-unknown', text: '?' }));
      }
    }
    artRow.append(turnBox);

    const walkBox = el('div', { class: 'dex-walk', dataset: { tip: t('行走图：鼠标指向哪边它就转向哪边') } });
    /**
     * 精灵图是**异步**取回来的，而它建好之后要替换掉占位内容 ——
     * 这里不能直接 clear(walkBox)：walkBox 上还挂着别的东西，
     * `clear` 会把它们一起清掉（第一版就是这么翻车的：15 次银牌死活不出现）。
     * 所以画布单独放一个子节点，只清那一个。
     */
    const walkStage = el('div', { class: 'dex-walk-stage' });
    walkBox.append(walkStage);
    let walkCanvas = null;
    createAnim(def.slug, {
      anim: 'Idle', fps: 7, dir: DIR.DOWN, className: 'dex-anim',
      // 正常尺寸（立绘的六成），不跟着立绘放大；trim 裁掉帧里的透明留白，人才能填满这一格
      autoScale: 104, trim: true,
    })
      .then((canvas) => {
        walkCanvas = canvas;
        clear(walkStage).append(canvas);
        // 建好之后再按鼠标当前的相对位置定一次朝向（否则要等第一次移动才转）
        aimAtPointer();
      })
      .catch(() => {});
    /** 以精灵图中心为原点算朝向 */
    const aimAtPointer = (ev) => {
      if (!walkCanvas) return;
      const r = walkCanvas.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const px = ev?.clientX ?? window.__dexPointer?.x;
      const py = ev?.clientY ?? window.__dexPointer?.y;
      if (!Number.isFinite(px) || !Number.isFinite(py)) return;
      walkCanvas.setDir(dirFromPoint(r.left + r.width / 2, r.top + r.height / 2, px, py));
    };
    const onMove = (ev) => { window.__dexPointer = { x: ev.clientX, y: ev.clientY }; aimAtPointer(ev); };
    document.addEventListener('mousemove', onMove);
    artRow.__onClose = () => document.removeEventListener('mousemove', onMove);
    artRow.append(walkBox);

    const iconBox = el('div', { class: 'dex-iconbox', dataset: { tip: t('小图标：会动的那个小头像') } });
    const icon = createIcon(def.slug, { size: 48, fps: ICONS.detailFps, alt: def.name });
    iconBox.append(icon ?? el('span', { class: 'dex-unknown', text: '?' }));
    artRow.append(iconBox);
  } else {
    const q = () => el('span', { class: 'dex-unknown big', text: '?' });
    artRow.append(el('div', { class: 'dex-turnart' }, [q()]));
  }

  // ── 上半场右列：名称 / 编号 / 称号 / 属性 + 三条简短介绍 ──
  /**
   * 版式（用户给的排版，第三版）：
   *
   *   ┌ 图（立绘 + 行走图 + 小图标）┐│ 名称 / 编号 / 称号 / 属性
   *   │                            ││ 简短介绍
   *   │                            ││ 怎么打
   *   └────────────────────────────┘│ 面板
   *   ══════════════ 分割线（正好在图和图鉴下方文本之间）══════════════
   *   ┌ 挑战 / 击败 / 失败 / 胜率 / 招式 ────── 击败奖牌进度 ── 🥇
   *   │ 它会用的卡牌            │ 它可能会这么说 / 出场台词
   *   └─────────────────────────┴────────────────────────────┘
   *
   * **左下方空一块**是第一版的问题：右列比图高，右列的卡牌、台词一路往下排，
   * 左边那 210px 宽的图早早就结束，下面全是空白。
   * 所以这一版把「分割线以下」的东西**全部**搬到横跨整个图鉴的 `.dex-detail-bottom`，
   * 上半场只剩「图 +（行首 + 三条简短介绍）」，右列再靠 flex 撑到和图一样高。
   */
  const info = el('div', { class: 'dex-detail-info' });
  /**
   * 首领称号（3.1，用户提的）：以前它和「#0844」「较强」「地面」这些一起挤在名字右边，
   * 做成了一枚胶囊 —— 而「流沙之主」这种称号是**名字的一部分**（遭遇演出里就打在大字名下面），
   * 塞进一排小胶囊里既挤又不像称号。现在它单独占名字下面那一行，不用胶囊。
   */
  const head = el('div', { class: 'detail-head' }, [
    el('h2', { text: known ? def.name : t('？？？') }),
    el('span', { class: 'detail-chip', text: `#${def.dex ?? '----'}` }),
    el('span', { class: `detail-chip tier-${def.tier}`, text: tierName }),
    el('span', { class: 'detail-chip', text: biome?.name ?? def.biome }),
    (def.types ?? []).length ? el('span', { class: 'detail-chip', text: (def.types ?? []).join(' / ') }) : null,
  ]);
  info.append(head);
  if (known && def.bossTitle) {
    info.append(el('div', { class: 'dex-boss-title', text: def.bossTitle }));
  }

  if (known) {
    info.append(introRows(def));
  } else {
    info.append(el('p', {
      class: 'dex-locked',
      text: t('还没遇见过它。多走走、多打几场，遇见的宝可梦会自动记进图鉴。'),
    }));
  }

  /** 分割线以下：横跨整个图鉴的一栏 */
  const bottom = el('div', { class: 'dex-detail-bottom' });

  if (known) {
    /**
     * 战绩 + 击败奖牌。
     * 奖牌**只在这里出现**（用户给的排版：计数条只有一条、最右端是奖牌）。
     * 第一版把它挂在行走图右上角，会和这一条重复成两个奖牌 —— 所以现在只有这一处。
     * 上面那条分割线现在是 `.dex-detail-top` 的下边线，所以这里不再画第二条。
     */
    const medal = MEDALS[medalTier(wins)];
    const stat = (label, value, cls = '') => el('div', { class: `dex-stat ${cls}`.trim() }, [
      el('b', { text: String(value) }),
      el('span', { text: label }),
    ]);
    const bar = el('div', { class: 'dex-medal-bar' });
    for (const m of MEDALS.slice(1)) {
      const done = wins >= m.at;
      const prev = MEDALS[MEDALS.indexOf(m) - 1]?.at ?? 0;
      const pct = done ? 100 : Math.max(0, Math.min(100, ((wins - prev) / (m.at - prev)) * 100));
      bar.append(el('div', {
        class: `dex-medal-step ${m.cls}${done ? ' done' : ''}`,
        dataset: { tip: done ? t('{name}：已达成（击败 {n} 次）', { name: t(m.name), n: m.at }) : t('{name}：击败 {n} 次解锁', { name: t(m.name), n: m.at }) },
      }, [
        el('span', { class: `dex-medal-ico ${m.cls}` }),
        el('span', { class: 'dex-medal-fill', style: { width: `${pct}%` } }),
        el('span', { class: 'dex-medal-num', text: String(m.at) }),
      ]));
    }
    bottom.append(el('div', { class: 'dex-record-row' }, [
      el('div', { class: 'dex-stats' }, [
        stat(t('挑战'), battles),
        stat(t('击败'), wins),
        stat(t('失败'), losses),
        stat(t('胜率'), battles ? `${Math.round((wins / battles) * 100)}%` : t('—')),
        stat(t('招式'), countPool(def)),
      ]),
      el('div', { class: 'dex-medal-row' }, [
        el('span', { class: 'dex-medal-cap', text: t('击败奖牌') }),
        bar,
      ]),
      medal ? el('span', {
        class: `dex-medal dex-medal-inline ${medal.cls}`,
        dataset: { tip: t('{name}：已经击败它 {n} 次。', { name: t(medal.name), n: wins }) },
      }) : null,
    ]));

    /** 右侧那一小块：口吻台词 + 出场台词（横栏被分成「牌 / 话」两段） */
    const side = el('div', { class: 'dex-detail-side' });

    /**
     * 「它可能会这么说」：**头像 + 对话框**（用户给的版式）。
     *
     * 头像用的是 PMD 头像（assets/portraits/<slug>/，和 HUD / 战斗里同一张脸），
     * 不是那只小图标 —— 用户点名「头像是 portraits」。
     * 拿不到头像时退回小图标，图鉴不会因为一张素材开天窗。
     *
     * 台词走 `def.voice`（content/enemy-voice.json，每只 3 句），
     * **不再拿出场台词充数** —— 用户就是发现这两栏印的是同一句话才要求重写的。
     */
    const sayBox = (line, note) => {
      const face = el('div', { class: 'dex-say-face' });
      createPortrait(def.slug, { emotion: 'normal', size: 64, alt: def.name })
        .then((img) => {
          if (img) face.append(img);
          else {
            const ico = createIcon(def.slug, { size: 48, alt: def.name });
            if (ico) face.append(ico);
          }
        })
        .catch(() => {});
      return el('div', { class: `detail-sec dex-voice${state === 'slain' ? '' : ' locked'}` }, [
        el('div', { class: 'dex-say' }, [
          face,
          el('div', { class: 'dex-say-main' }, [
            el('h4', { text: t('它可能会这么说') }),
            el('div', { class: 'dex-say-bubble' }, [el('p', { class: 'dex-voice-line', text: line })]),
            note ? el('span', { class: 'dex-voice-note', text: note }) : null,
          ]),
        ]),
      ]);
    };
    const says = (def.voice ?? []).filter(Boolean);
    const spoken = (def.lines ?? []).filter(Boolean);
    if (state === 'slain' && says.length) {
      const idx = (wins - 1) % says.length;
      side.append(sayBox(`「${says[idx]}」`, t('第 {n} 次打赢它时，它就是这么说的。', { n: idx + 1 })));
    } else if (spoken.length) {
      // 见过但还没打赢：只给一个空框，别把台词提前漏出去
      side.append(sayBox(t('打赢它一次就能听到。'), ''));
    }

    if (def.lines?.length) {
      const lineBox = el('div', { class: 'dex-lines' });
      for (const line of def.lines) lineBox.append(el('p', { text: line }));
      side.append(el('div', { class: 'detail-sec' }, [el('h4', { text: t('出场台词') }), lineBox]));
    }

    /** 它手上的牌：开打时一定会有的「专属牌」+ 会从里面抓的「招式池」 */
    const hand = el('div', { class: 'detail-sec' });
    hand.append(el('h4', { text: t('它会用的卡牌') }));
    const signature = (def.signature ?? []).filter((id) => CARD_BY_ID[id]);
    const pool = resolvePool(def).filter((id) => CARD_BY_ID[id]);
    if (signature.length) {
      hand.append(el('div', { class: 'dex-move-group' }, [
        el('span', { class: 'dex-move-cap', text: t('专属（开打时一定在它手上）') }),
        moveChips(signature, 'sig'),
      ]));
    }
    if (pool.length) {
      hand.append(el('div', { class: 'dex-move-group' }, [
        el('span', { class: 'dex-move-cap', text: t('招式池（它会从这里面抓牌）') }),
        moveChips(pool, ''),
      ]));
    }
    if (!signature.length && !pool.length) hand.append(el('p', { class: 'dex-empty', text: t('（这只没有登记招式）') }));

    bottom.append(el('div', { class: 'dex-detail-cols' }, [hand, side]));
  }

  const body = el('div', { class: 'dex-detail' }, [
    el('div', { class: 'dex-detail-top' }, [artRow, info]),
    bottom.childNodes.length ? bottom : null,
  ]);
  const m = modal({ title: t('图鉴详情 · {name}', { name: known ? def.name : t('？？？') }), wide: true, body });
  // 关掉时把 mousemove 解绑（弹窗里那只会跟着鼠标转，监听器不能留着）
  const origClose = m.close;
  m.close = () => { artRow.__onClose?.(); origClose(); };
  return m;
}

/** 这只敌人的招式池（deck 可能是池子名，也可能直接是一串卡 id） */
function resolvePool(def) {
  if (Array.isArray(def.deck)) return def.deck;
  return MOVE_POOLS[def.deck] ?? def.deck ?? [];
}

/**
 * 右列那三条「简短介绍」（用户给的排版）。
 *
 * ① 身份：content/enemy-intro.json 里那句手写的（「沙丘自己站了起来…」这类）。
 * ② 怎么打：**从招式池与专属技里推** —— 有几张攻击牌、有没有削弱、有没有招牌技。
 * ③ 面板：档位 + 这一章的 HP / 攻击（章节按这张地图能出现在第几章算）。
 *
 * ②③ 故意不手写：手写一句「血厚、爱降防」，数值或牌池一改它就变成假话，
 * 而这里读的是引擎同一份数据，永远对得上。
 */
function introRows(def) {
  const pool = resolvePool(def).map((id) => CARD_BY_ID[id]).filter(Boolean);
  const attacks = pool.filter((c) => (c.effects ?? []).some((e) => e.kind === 'damage'));
  const debuffs = pool.filter((c) => (c.effects ?? []).some((e) => e.kind === 'status' || (e.kind === 'buff' && e.target === 'enemy' && (e.amount ?? 0) < 0)));
  const supports = pool.length - attacks.length - debuffs.length;
  const sig = (def.signature ?? []).filter((id) => CARD_BY_ID[id]);
  const typeLine = (def.types ?? []).join(' / ');

  // ② 打法：攻击 / 削弱 / 辅助 / 招牌
  const bits = [];
  if (attacks.length) bits.push(t('攻击 {n} 张', { n: attacks.length }));
  if (debuffs.length) bits.push(t('削弱 {n} 张', { n: debuffs.length }));
  if (supports > 0) bits.push(t('辅助 {n} 张', { n: supports }));
  const style = bits.join(' · ');
  const sigText = sig.length
    ? t('，招牌招「{name}」开打时一定在它手上', { name: CARD_BY_ID[sig[0]].name })
    : '';

  // ③ 面板：这一章的 HP / 攻击（地图的 slots 决定它可能出现在第几章；取第一档）
  const stage = (BIOMES[def.biome]?.slots ?? [0])[0] ?? 0;
  const hp = BALANCE.enemyHp?.[def.tier]?.[stage];
  const atk = BALANCE.enemyAtk?.[def.tier]?.[stage];
  const statText = (hp == null || atk == null)
    ? ''
    : t('生命约 {hp} · 攻击约 {atk}', { hp, atk });

  const row = (label, text) => (text
    ? el('div', { class: 'dex-intro-row' }, [
        el('span', { class: 'dex-intro-cap', text: label }),
        el('span', { class: 'dex-intro-text', text }),
      ])
    : null);

  return el('div', { class: 'dex-intro' }, [
    row(t('简短介绍'), def.intro ?? ''),
    row(t('怎么打'), style ? `${style}${sigText}` : ''),
    row(t('面板'), [typeLine, statText].filter(Boolean).join(' · ')),
  ]);
}

/** 招式池里的牌数（详情页的数字统计用） */
function countPool(def) {
  return resolvePool(def).filter((id) => CARD_BY_ID[id]).length;
}

/** 挑战次数（facedCount；老存档没有这份计数时退回「打赢过就算 1 次」） */
function countSeen(meta, id) {
  const faced = meta.facedCount?.[id];
  if (faced != null) return faced;
  const wins = (meta.slainEnemies ?? []).includes(id) ? 1 : 0;
  return (meta.seenEnemies ?? []).includes(id) ? Math.max(1, wins) : 0;
}

/**
 * 见过几次 / 击败几次。
 *
 * `meta.slainEnemies` 是**去重集合**（记的是「打赢过」这件事），所以严格说没有次数 ——
 * 但用户要「挑战次数 / 失败次数 / 击败 5 次给铜牌」，就必须有计数。
 * 所以从这一版起额外记 `meta.slainCount`（id -> 次数），老存档没有这份计数时
 * 退回「打赢过 = 1 次」（不会显示成 0 次，也不会白送奖牌）。
 */
function countSlain(meta, id) {
  return meta.slainCount?.[id] ?? ((meta.slainEnemies ?? []).includes(id) ? 1 : 0);
}

/** 招式胶囊：悬停看这张牌的完整效果（浮层由 tips.js 全站统一提供） */
function moveChips(ids, cls) {
  const wrap = el('div', { class: 'dex-moves' });
  for (const id of ids) {
    const card = CARD_BY_ID[id];
    wrap.append(el('span', {
      class: `dex-move ${cls}`.trim(),
      dataset: { tip: resolveCardText(card) },
    }, [
      el('span', { class: 'ico-action_points', style: { width: '11px', height: '11px' } }),
      el('span', { text: `${card.ap}` }),
      el('span', { text: card.name }),
    ]));
  }
  return wrap;
}
