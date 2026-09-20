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
import { ENEMIES, ENEMY_BY_ID, MOVE_POOLS, TIERS } from '../data/enemies.js';
import { BIOMES } from '../data/balance.js';
import { createPortrait } from '../core/portraits.js';
import { createIcon, ICONS } from '../core/icons.js';
import { createAnim, DIR } from '../core/sprites.js';
import { turnArt } from '../core/gen9.js';
import { save } from '../core/save.js';
import { t } from '../core/i18n.js';
import { audio } from '../core/audio.js';
import { showCardDetail } from './carddetail.js';

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

/** 图鉴里的一张敌人卡（没见过的画成剪影，只留图鉴编号） */
function enemyCard(def, sets) {
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

  const artRow = el('div', { class: 'dex-art-row' });
  const artCell = (label, node, cls = '') => el('div', { class: `dex-art-cell ${cls}`.trim() }, [
    el('div', { class: 'dex-art-box' }, [node]),
    el('div', { class: 'dex-art-cap', text: label }),
  ]);

  if (known) {
    // ── 行走图：按鼠标方向转（用户要求）。朝向变了就换精灵图的朝向行，动画接着播 ──
    const walkBox = el('div', { class: 'dex-walk' });
    /**
     * 精灵图是**异步**取回来的，而它建好之后要替换掉占位内容 ——
     * 这里不能直接 clear(walkBox)：奖牌已经先挂在 walkBox 上了，
     * `clear` 会把奖牌一起清掉（第一版就是这么翻车的：15 次银牌死活不出现）。
     * 所以画布单独放一个子节点，只清那一个。
     */
    const walkStage = el('div', { class: 'dex-walk-stage' });
    walkBox.append(walkStage);
    let walkCanvas = null;
    createAnim(def.slug, { anim: 'Idle', scale: 3, fps: 7, dir: DIR.DOWN, className: 'dex-anim' })
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

    const medal = MEDALS[medalTier(wins)];
    if (medal) {
      walkBox.append(el('span', {
        class: `dex-medal ${medal.cls}`,
        dataset: { tip: t('{name}：已经击败它 {n} 次。', { name: t(medal.name), n: wins }) },
      }));
    }
    artRow.append(artCell(t('行走图'), walkBox, 'dex-art-walk'));

    const turnBox = el('div', { class: 'dex-turnart' });
    {
      const art = turnArt(def.slug, 'front');
      if (art) {
        const img = document.createElement('img');
        img.src = art.url;
        img.alt = def.name;
        img.className = 'dex-turnart-img';
        img.draggable = false;
        img.style.height = '100%';
        img.style.width = 'auto';
        turnBox.append(img);
      } else {
        turnBox.append(el('span', { class: 'dex-unknown', text: '?' }));
      }
    }
    artRow.append(artCell(t('回合立绘'), turnBox));

    const iconBox = el('div', { class: 'dex-iconbox' });
    const icon = createIcon(def.slug, { size: 80, fps: ICONS.detailFps, alt: def.name });
    iconBox.append(icon ?? el('span', { class: 'dex-unknown', text: '?' }));
    artRow.append(artCell(t('小图标'), iconBox));
  } else {
    const q = () => el('span', { class: 'dex-unknown big', text: '?' });
    artRow.append(artCell(t('行走图'), q()), artCell(t('回合立绘'), q()), artCell(t('小图标'), q()));
  }

  // ── 右侧：名称 / 编号 / 称号 / 属性 + 战绩 ──
  const head = el('div', { class: 'dex-detail-head' });
  head.append(el('div', { class: 'detail-head' }, [
    el('h2', { text: known ? def.name : t('？？？') }),
    el('span', { class: 'detail-chip', text: `#${def.dex ?? '----'}` }),
    el('span', { class: `detail-chip tier-${def.tier}`, text: tierName }),
    el('span', { class: 'detail-chip', text: biome?.name ?? def.biome }),
    (def.types ?? []).length ? el('span', { class: 'detail-chip', text: (def.types ?? []).join(' / ') }) : null,
    known && def.bossTitle ? el('span', { class: 'detail-chip boss-title', text: def.bossTitle }) : null,
  ]));

  if (known) {
    const medal = MEDALS[medalTier(wins)];
    const stat = (label, value, cls = '') => el('div', { class: `dex-stat ${cls}`.trim() }, [
      el('b', { text: String(value) }),
      el('span', { text: label }),
    ]);
    head.append(el('div', { class: 'dex-stats' }, [
      stat(t('挑战'), battles),
      stat(t('击败'), wins),
      stat(t('失败'), losses),
      stat(t('胜率'), battles ? `${Math.round((wins / battles) * 100)}%` : t('—')),
      stat(t('招式'), countPool(def)),
    ]));

    // 奖牌进度：4 段（5 / 15 / 25 / 50）
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
    head.append(el('div', { class: 'dex-medal-row' }, [
      el('span', { class: 'dex-medal-cap', text: t('击败奖牌') }),
      bar,
    ]));
  }

  const info = el('div', { class: 'dex-detail-info' }, [head]);

  if (!known) {
    info.append(el('p', {
      class: 'dex-locked',
      text: t('还没遇见过它。多走走、多打几场，遇见的宝可梦会自动记进图鉴。'),
    }));
  } else {
    /**
     * 模仿它的口吻说一句话（用户要求，**只有击败过才看得到**）。
     *
     * 用的就是它的出场台词：那几句本来就是按这个世界观写的、也早就翻成日 / 英了。
     * 按击败次数轮换（第几次打赢听第几句），比再加 193 句新文案更稳 ——
     * 而且它永远和战斗里听到的那句对得上。
     */
    const lines = (def.lines ?? []).filter(Boolean);
    if (state === 'slain' && lines.length) {
      const voiceline = lines[(wins - 1) % lines.length];
      info.append(el('div', { class: 'detail-sec dex-voice' }, [
        el('h4', { text: t('它可能会这么说') }),
        el('p', { class: 'dex-voice-line', text: `「${voiceline}」` }),
        el('span', { class: 'dex-voice-note', text: t('第 {n} 次打赢它时，它就是这么说的。', { n: ((wins - 1) % lines.length) + 1 }) }),
      ]));
    } else if (lines.length) {
      info.append(el('div', { class: 'detail-sec dex-voice locked' }, [
        el('h4', { text: t('它可能会这么说') }),
        el('p', { class: 'dex-voice-line', text: t('打赢它一次就能听到。') }),
      ]));
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
    info.append(hand);

    if (def.lines?.length) {
      const lineBox = el('div', { class: 'dex-lines' });
      for (const line of def.lines) lineBox.append(el('p', { text: line }));
      info.append(el('div', { class: 'detail-sec' }, [el('h4', { text: t('出场台词') }), lineBox]));
    }
  }

  const body = el('div', { class: 'dex-detail' }, [el('div', { class: 'dex-detail-top' }, [artRow, info])]);
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
