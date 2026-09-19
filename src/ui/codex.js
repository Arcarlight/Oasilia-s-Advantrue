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
import { ENEMIES, TIERS } from '../data/enemies.js';
import { BIOMES } from '../data/balance.js';
import { createPortrait } from '../core/portraits.js';
import { save } from '../core/save.js';
import { t } from '../core/i18n.js';
import { audio } from '../core/audio.js';
import { showCardDetail } from './carddetail.js';

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
    if (state === 'new') badges.push(t('未获得'));
    else if (state === 'seen') badges.push(t('曾拿过'));
    const node = cardEl(card, {
      size: 'sm',
      badges,
      onClick: () => showCardDetail(card, { state: () => ({ owned: n }) }),
    });
    // 没拿过的卡压暗：图鉴里「全亮」会让玩家以为这些都算已收集（用户反馈）
    if (state === 'new') node.classList.add('card-unowned');
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

  const paint = () => {
    fillCardGrid(grid, CARDS, { sortMode, deckIds });
    sortHint.textContent = SORT_MODES.find((m) => m.key === sortMode)?.hint() ?? '';
  };

  body.append(sortBar, grid);
  body.append(el('div', { class: 'help-card', style: { marginTop: '12px' } }, [
    el('h4', { text: t('怎么看这一页') }),
    el('ul', {}, [
      el('li', { text: t('亮着的卡 = 已经拿到过；灰掉并标着「未获得」的还没见过。') }),
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
  return { seen, beaten };
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

/** 图鉴里的一张敌人卡（没见过的画成剪影，只留图鉴编号） */
function enemyCard(def, sets) {
  const state = enemyState(def.id, sets);
  const known = state !== 'new';
  const tierName = TIERS[def.tier]?.name ?? def.tier;

  const art = el('div', { class: 'dex-art' });
  if (known) {
    // 头像原生 40×40，放大到 64（整数倍）最清晰
    createPortrait(def.slug, { emotion: 'normal', size: 64, alt: def.name }).then((img) => {
      if (!img) return;
      clear(art);
      art.append(img);
    });
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
    onClick: () => { audio.ui('click2'); showEnemyDetail(def, sets); },
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
function showEnemyDetail(def, sets) {
  const state = enemyState(def.id, sets);
  const known = state !== 'new';
  const tierName = TIERS[def.tier]?.name ?? def.tier;
  const biome = BIOMES[def.biome];

  const face = el('div', { class: 'dex-detail-face' });
  if (known) {
    createPortrait(def.slug, { emotion: 'normal', size: 128, alt: def.name }).then((img) => {
      if (!img) return;
      clear(face);
      face.append(img);
    });
  } else {
    face.append(el('span', { class: 'dex-unknown big', text: '?' }));
  }

  const info = el('div', { class: 'dex-detail-info' }, [
    el('div', { class: 'detail-head' }, [
      el('h2', { text: known ? def.name : t('？？？') }),
      el('span', { class: 'detail-chip', text: `#${def.dex ?? '----'}` }),
      el('span', { class: `detail-chip tier-${def.tier}`, text: tierName }),
      el('span', { class: 'detail-chip', text: biome?.name ?? def.biome }),
      (def.types ?? []).length ? el('span', { class: 'detail-chip', text: (def.types ?? []).join(' / ') }) : null,
      known && def.bossTitle ? el('span', { class: 'detail-chip', text: def.bossTitle }) : null,
    ]),
  ]);

  if (!known) {
    info.append(el('p', {
      class: 'dex-locked',
      text: t('还没遇见过它。多走走、多打几场，遇见的宝可梦会自动记进图鉴。'),
    }));
  } else {
    if (def.lines?.length) {
      const lines = el('div', { class: 'dex-lines' });
      for (const line of def.lines) lines.append(el('p', { text: line }));
      info.append(el('div', { class: 'detail-sec' }, [el('h4', { text: t('出场台词') }), lines]));
    }

    // 招牌招式：buildEnemyDeck() 保证它一定会进牌组（见 game.js 里那一步 ⓪）
    const signature = (def.signature ?? []).filter((id) => CARD_BY_ID[id]);
    if (signature.length) {
      info.append(el('div', { class: 'detail-sec' }, [
        el('h4', { text: t('招牌招式（开打时一定在它手上）') }),
        moveChips(signature, 'sig'),
      ]));
    }

    // 招式池：它可能用出来的牌（实际那副牌就是从这里铺出来的）
    const pool = (def.deck ?? []).filter((id) => CARD_BY_ID[id]);
    if (pool.length) {
      info.append(el('div', { class: 'detail-sec' }, [
        el('h4', { text: t('招式池（它会从这里面抓牌）') }),
        moveChips(pool, ''),
      ]));
    }

    info.append(el('div', { class: 'detail-sec' }, [
      el('h4', { text: t('战绩') }),
      el('p', {
        class: 'dex-record',
        text: state === 'slain'
          ? t('已经打赢过它。')
          : t('遇见过，但还没打赢过 —— 它还在图鉴上等着。'),
      }),
    ]));
  }

  const body = el('div', { class: 'card-detail' }, [
    el('div', { class: 'card-detail-main' }, [face]),
    info,
  ]);
  return modal({ title: t('图鉴详情 · {name}', { name: known ? def.name : t('？？？') }), wide: true, body });
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
