// 弹窗类界面：卡组 / 出战卡牌、背包、帮助、设置

import { el, clear, modal, toast } from './dom.js';
import { cardEl, cardTag } from './cards.js';
import {
  SORT_MODES, sortCards, groupLabel, cardDamageTotal, richHTML, collectKeywords, effectLines,
} from './cardtext.js';
import { audio } from '../core/audio.js';
import { music } from '../core/bgm.js';
import { BALANCE, apFromAgi, drawFromAgi, handFromAgi, playsFromAgi, critChance, dodgeChance, SPEED_OPTIONS, BATTLE_SPEED_KEY, loadBattleSpeed, RARITY } from '../data/balance.js';
// itemEffect / inventoryEntries：道具有没有「主动使用」的效果、背包里哪些真的还有 ——
// 背包界面和引擎共用这两份判断，别在界面里自己抄一遍数据模型的规则
// （抄漏过一次：判断写的是 `item.heal` 而数据字段叫 `healPct`，整个背包一个按钮都没有）
import { itemEffect, inventoryEntries } from '../core/game.js';
import { CARD_BY_ID, CARDS, ITEMS } from '../data/cards.js';
// 说明页里「一共几章」也从地图生成器现问，别再手写（曾经写成「三章」，而实际是 6 章）
import { stageCount } from '../data/mapgen.js';
import { save } from '../core/save.js';
import { BGM_NAMES } from '../core/bgm.js';
import { renderHud } from './hud.js';

// ============================================================
// 卡组一览（只读）
// ============================================================
/**
 * 卡组界面。
 *
 * 这里**不再是「挑选出战卡牌」**：带进战斗的就是你拥有的全部卡牌。
 * 以前可以在 2~14 张之间自由勾选，两头都出过问题 ——
 *   ① 只带「子弹拳 + 电光一闪」两张 0 费抽牌时，两张牌互相抽回来，
 *      每回合把出牌上限打满、直接秒人（用户反馈的「无限循环」）；
 *   ② 把连招堵住之后，小卡组又变成废物（一回合只打得出两张）。
 * 所以「卡组厚薄」改成资源问题：想精简只能去**商店花钱删卡**（同一家越删越贵），
 * 或者用营地换一张更强的牌。这个界面负责把「你现在带着什么」看清楚：
 * 排序（含特殊效果分组）、卡牌详情、以及「哪张牌还带着几份」。
 */
export function showDeck(game) {
  const d = game.data;
  /** 当前排序方式：默认 / 伤害 / 特殊效果 / 费用 / 稀有度 */
  let sortMode = 'default';

  const body = el('div', {});

  // 卡组构成统计（按类型/费用给个概览，比单纯数张数有用）
  const kinds = { damage: 0, shield: 0, heal: 0, status: 0, buff: 0, draw: 0, ap: 0, cleanse: 0 };
  let zeroCost = 0;
  for (const id of d.deck) {
    const c = CARD_BY_ID[id];
    if (!c) continue;
    if (c.ap === 0) zeroCost += 1;
    for (const e of c.effects) if (kinds[e.kind] != null) kinds[e.kind] += 1;
  }
  const damageCards = d.deck.filter((id) => CARD_BY_ID[id]?.effects.some((e) => e.kind === 'damage')).length;

  const statsPanel = el('div', { class: 'help-grid' }, [
    el('div', { class: 'help-card' }, [
      el('h4', { text: `每回合的预算（敏捷 ${d.agi}）` }),
      el('ul', {}, [
        el('li', { text: `行动点 AP ${apFromAgi(d.agi)} 点 —— 回合开始回满，出牌花的就是它。` }),
        el('li', { text: `抽牌 ${drawFromAgi(d.agi)} 张 —— 手牌上限 ${handFromAgi(d.agi)} 张，抽满后多出来的直接进弃牌堆。` }),
        el('li', { text: `出牌上限 ${playsFromAgi(d.agi)} 张 —— 一回合最多打这么多张，AP 再多也越不过它。` }),
        el('li', { text: '三项都由敏捷决定；每场战斗胜利涨属性时，它们会跟着一起涨。' }),
      ]),
    ]),
    el('div', { class: 'help-card' }, [
      el('h4', { text: `卡组（${d.deck.length} 张）` }),
      el('ul', {}, [
        el('li', { text: `能造成伤害的牌 ${damageCards} 张 ｜ 0 费牌 ${zeroCost} 张` }),
        el('li', { text: `护盾 ${kinds.shield} ｜ 回复 ${kinds.heal} ｜ 状态 ${kinds.status} ｜ 强化 ${kinds.buff}` }),
        el('li', { text: `抽牌 ${kinds.draw} ｜ 回 AP ${kinds.ap} ｜ 净化 ${kinds.cleanse}` }),
      ]),
    ]),
    el('div', { class: 'help-card' }, [
      el('h4', { text: '怎么改卡组' }),
      el('ul', {}, [
        el('li', { text: '带进战斗的就是你拥有的全部卡牌——不能挑着不带（以前能只带两张，会变成「两张牌互相刷」的无限连招）。' }),
        el('li', { text: '想精简：去商店买「卡牌移除服务」删掉不要的牌，同一家店里越删越贵。' }),
        el('li', { text: '想换牌：营地的「冥想」可以把一张牌换成随机的高稀有度牌。' }),
        el('li', { text: '卡组越薄 → 越容易抽到关键牌；越厚 → 每回合能打出的总量上限更高。' }),
      ]),
    ]),
  ]);

  // ---- 排序条 ----
  const sortHint = el('span', { class: 'sort-hint' });
  const sortBar = el('div', { class: 'sort-bar' }, [
    el('span', { class: 'sort-label', text: '排序：' }),
  ]);
  const sortTabs = SORT_MODES.map((m) => {
    const tab = el('button', {
      class: `sort-tab${m.key === sortMode ? ' active' : ''}`,
      dataset: { tip: m.hint },
      onClick: () => {
        sortMode = m.key;
        audio.ui('toggle');
        for (const t of sortTabs) t.classList.toggle('active', t.dataset.sort === sortMode);
        paint();
      },
    }, [m.label]);
    tab.dataset.sort = m.key;
    sortBar.append(tab);
    return tab;
  });
  sortBar.append(sortHint);

  const grid = el('div', { class: 'card-grid' });
  body.append(statsPanel, sortBar, grid);

  function openDetail(card) {
    audio.ui('click2');
    const owned = d.deck.filter((x) => x === card.id).length;
    showCardDetail(card, {
      state: () => ({ picked: owned, owned, readOnly: true }),
    });
  }

  /**
   * 把一批卡填进网格。卡组网格和卡牌图鉴共用这一份 ——
   * 以前图鉴自己抄了一遍「排序后逐张 append」，于是漏了分组标题：
   * 卡组页按「特殊效果」排序有分组，展开图鉴却没有（诊断脚本量出来的）。
   *
   * items 是 `{ card, state }`：state = 'deck' 这一局带着 / 'seen' 以前拿过 / 'new' 没见过
   */
  function fillGrid(container, items) {
    clear(container);
    let lastGroup = null;
    for (const { card, group } of sortCards(items.map((it) => it.card), sortMode)) {
      const state = items.find((it) => it.card === card)?.state ?? 'deck';
      // 「按特殊效果」时插分组标题：光靠排序玩家看不出为什么这张排在前面
      if (sortMode === 'effect' && group !== lastGroup) {
        lastGroup = group;
        container.append(el('div', { class: 'grid-group' }, [el('span', { text: groupLabel(group) })]));
      }
      const badges = [];
      if (sortMode === 'damage') badges.push(`伤害 ${cardDamageTotal(card)}`);
      // 同一张牌带了几份：卡组里同名卡比较多时一眼看得出来
      const copies = d.deck.filter((x) => x === card.id).length;
      if (state === 'deck' && copies > 1) badges.push(`×${copies}`);
      if (state === 'new') badges.push('未获得');
      else if (state === 'seen') badges.push('曾拿过');
      const node = cardEl(card, { size: 'sm', badges, onClick: () => openDetail(card) });
      // 没拿过的卡压暗：图鉴里「全亮」会让玩家以为这些都算已收集（用户反馈）
      if (state === 'new') node.classList.add('card-unowned');
      container.append(node);
    }
  }

  function paint() {
    // 卡组里同一张牌只画一张（角标写 ×N）—— 20 张的卡组里四张撞击画四遍没意义
    const seen = new Set();
    const items = [];
    for (const id of d.deck) {
      if (seen.has(id) || !CARD_BY_ID[id]) continue;
      seen.add(id);
      items.push({ card: CARD_BY_ID[id], state: 'deck' });
    }
    fillGrid(grid, items);
    sortHint.textContent = SORT_MODES.find((m) => m.key === sortMode)?.hint ?? '';
  }
  paint();

  /**
   * 图鉴里每张卡的状态：
   *   deck = 这一局带着（最亮，没有任何标记）
   *   seen = 以前某局拿到过（跨局记录在 save 的 meta 里）
   *   new  = 从没见过（压暗 + 「未获得」）
   */
  const codexState = (id) => {
    if (d.deck.includes(id)) return 'deck';
    return new Set(save.readMeta().seenCards ?? []).has(id) ? 'seen' : 'new';
  };
  const collectedCount = () => CARDS.filter((c) => codexState(c.id) !== 'new').length;

  const codex = el('details', { style: { marginTop: '14px' } }, [
    el('summary', { style: { cursor: 'pointer', padding: '6px 0', fontWeight: '700' } }, [
      el('span', { text: '卡牌图鉴' }),
      el('span', { style: { opacity: '.75', fontWeight: '400' }, text: `（已收集 ${collectedCount()} / ${CARDS.length} 种，点开可以逐个看详情）` }),
    ]),
  ]);
  const codexGrid = el('div', { class: 'card-grid', style: { marginTop: '10px' } });
  codex.append(codexGrid);
  // 图鉴也跟着排序走：不然「按伤害排序」只排上半页，图鉴还是乱的
  codex.addEventListener('toggle', () => {
    if (!codex.open) return;
    fillGrid(codexGrid, CARDS.map((card) => ({ card, state: codexState(card.id) })));
  });
  body.append(codex);

  return modal({ title: '卡组一览', wide: true, body });
}

// ============================================================
// 卡牌详情（卡组页点卡牌进来）
// ============================================================
/**
 * 卡牌详细介绍页：大卡面 + 完整说明 + 效果明细 + 关键词解释。
 *
 * 起因（用户需求）：卡组页原来只有卡面本身 —— 描述被卡面宽度截断、
 * 「无视对手一半防御」「给对手 2 层灼伤」这类效果到底值多少全靠猜。
 * 这里把 effects 数据原样翻成人话，并且把文案里出现的状态词做成
 * 可以悬停查看的词条（悬停说明由 tips.js 全站统一提供）。
 */
export function showCardDetail(card, opts = {}) {
  const { picking = false, state = null, onAdd = null, onRemove = null } = opts;
  const rarity = RARITY[card.rarity]?.name ?? card.rarity;
  const dmg = cardDamageTotal(card);

  const stateEl = el('div', { class: 'detail-deckstate' });
  /**
   * 「加入」和「拿掉」两个按钮（只有**能改卡组**的界面才给，比如商店的删卡服务）。
   *
   * 以前只有一个按钮、按当前份数换文案（没带过 → 加入；带过 → 拿掉），
   * 于是「我已经带了 1 张、想再带一张」这件事根本没有按钮可点 ——
   * 卡组里只有一张的牌更是彻底点不进第二张，玩家看到的就是「点了没反应」。
   * 加不进去的时候（这张牌全带上了 / 卡组满了）「加入」按钮会禁用并把原因写在按钮上。
   *
   * 卡组一览现在是**只读**的（出战卡组恒等于全部所持卡牌），那时传进来的
   * onAdd / onRemove 都是 null，弹窗里只会显示「这张牌带了几份」。
   */
  const addBtn = el('button', {
    class: 'btn btn-primary',
    onClick: () => { onAdd?.(); sync(); },
  });
  const removeBtn = el('button', {
    class: 'btn btn-ghost',
    onClick: () => { onRemove?.(); sync(); },
  });
  /**
   * 说明挂在**外层的 span** 上，不挂在按钮上：
   * 禁用的表单控件在浏览器里收不到鼠标事件（mouseover 不会派发），
   * 挂按钮上等于「说了原因但玩家看不到」。外层的 span 收得到。
   */
  const addWrap = el('span', { class: 'btn-wrap' }, [addBtn]);
  const sync = () => {
    if (!state) { stateEl.textContent = ''; return; }
    const { picked = 0, owned = 1, full = false, max = 0, readOnly = false } = state();
    stateEl.textContent = readOnly
      ? (owned > 0
        // 「出战卡组 = 全部所持卡牌」这句是旧概念的残留：现在根本没有单独的出战卡组了
        ? `你的卡组里有这张：${owned} 张`
        : '这张还没拿到（去奖励 / 商店 / 事件里找找）')
      : (picked > 0
        ? `出战卡组里有这张：${picked} / ${owned} 张`
        : `这张还没进出战卡组（卡组里一共有 ${owned} 张）`);
    if (!picking || readOnly) return;
    if (picked >= owned) {
      // 卡组里就只有这么多张：把话说在按钮上，别让玩家反复点
      addBtn.textContent = `只能拥有 ${owned} 张`;
      addBtn.disabled = true;
      addBtn.className = 'btn';
      addWrap.dataset.tip = `你的卡组里一共只有 ${owned} 张「${card.name}」，已经全部带上了。\n想再多带，得先在奖励 / 商店 / 营地里多拿几张。`;
    } else if (full) {
      addBtn.textContent = `出战卡组已满（${max} 张）`;
      addBtn.disabled = true;
      addBtn.className = 'btn';
      addWrap.dataset.tip = `出战卡组上限是 ${max} 张，现在已经满了。\n先在卡组页拿掉几张，再加这一张。`;
    } else {
      addBtn.textContent = picked > 0 ? `再加入一张（${picked} / ${owned}）` : `加入出战卡组（共 ${owned} 张）`;
      addBtn.disabled = false;
      addBtn.className = 'btn btn-primary';
      delete addWrap.dataset.tip;
    }
    removeBtn.textContent = `拿掉一张（${picked} / ${owned}）`;
    removeBtn.classList.toggle('hidden', picked === 0);
  };

  // 大卡面：只是展示，所以不可交互（说明文字在下面另有一份可悬停的）
  const bigCard = cardEl(card, { size: 'lg' });
  bigCard.classList.add('card-static');

  const info = el('div', { class: 'card-detail-info' }, [
    el('div', { class: 'detail-head' }, [
      el('h2', { text: card.name }),
      el('span', { class: `detail-chip rarity-${card.rarity}`, text: rarity }),
      el('span', { class: 'detail-chip' }, [el('span', { class: 'ico-action_points', style: { width: '12px', height: '12px' } }), el('span', { text: `${card.ap} AP` })]),
      el('span', { class: 'detail-chip', text: cardTag(card) }),
      dmg ? el('span', { class: 'detail-chip', text: `卡面伤害 ${dmg}` }) : null,
      card.exhaust ? el('span', { class: 'detail-chip', text: '用后销毁' }) : null,
    ]),
    el('div', { class: 'detail-desc', html: richHTML(card.text) }),
  ]);

  // 效果明细：一行一条，把 effects 翻成人话
  const rows = effectLines(card);
  if (rows.length) {
    const box = el('div', { class: 'detail-rows' });
    for (const r of rows) {
      box.append(el('div', { class: 'detail-row' }, [
        el('span', { class: `dr-ico ${r.ico}`, style: r.ink ? { backgroundColor: r.ink } : {} }),
        el('span', { class: 'dr-label', text: r.label }),
        el('span', { class: 'dr-value', text: r.value }),
        r.note ? el('span', { class: 'dr-note', text: r.note }) : null,
      ]));
    }
    info.append(el('div', { class: 'detail-sec' }, [el('h4', { text: '效果明细' }), box]));
  }

  // 关键词：文案里出现过的词条，悬停看用处
  const kws = collectKeywords(card.text);
  if (kws.length) {
    const wrap = el('div', { class: 'detail-kw' });
    for (const k of kws) {
      // 颜色走 CSS 类（深色底上用亮色），不写内联
      wrap.append(el('span', {
        class: `kw ${k.cls}`,
        dataset: { tip: k.tip },
        text: k.label,
      }));
    }
    info.append(el('div', { class: 'detail-sec' }, [
      el('h4', { text: '关键词（鼠标停上去看说明）' }),
      wrap,
    ]));
  }

  if (state) {
    info.append(el('div', { class: 'detail-actions' }, [
      picking ? addWrap : null,
      picking ? removeBtn : null,
      stateEl,
    ]));
  }

  const body = el('div', { class: 'card-detail' }, [
    el('div', { class: 'card-detail-main' }, [bigCard]),
    info,
  ]);
  sync();

  return modal({ title: `卡牌详情 · ${card.name}`, wide: true, body });
}

// ============================================================
// 背包
// ============================================================
export function showItems(game) {
  const wrap = el('div', {});
  const body = el('div', {});
  wrap.append(body);

  const paint = () => {
    clear(body);
    // 只列**真的还有**的东西（数量 > 0）：开局数据自带一个 `potion_big: 0`，
    // 照单全收的话开局就有一行「厉害伤药 ×0」配着「使用」按钮，点了只说「现在用不了」
    const entries = inventoryEntries(game.data.items);
    if (!entries.length) {
      body.append(el('p', { text: '背包是空的。地图上的宝箱和商店会给你补货。' }));
    } else {
      const list = el('div', { class: 'shop-list' });
      for (const [id, n] of entries) {
        const item = ITEMS[id];
        if (!item) continue;
        /**
         * 「这件东西能不能用」必须问 itemEffect()，**不能在这里自己判断**。
         *
         * 这里以前写的是 `item.heal ? 使用按钮 : 「已生效」`，而药水的数据字段叫 `healPct`
         * ——于是七件道具全都显示「已生效」，一个「使用」按钮都没有，背包整个是死的
         * （玩家反馈：「道具都写着已生效，像好伤药那种完全没法用」）。
         * 同理，只有**回血类**才该因为「HP 已满」被禁用；护符类跟血量无关。
         */
        const eff = itemEffect(item);
        const hpFull = game.data.hp >= game.data.maxHp;
        const blocked = eff?.kind === 'heal' && hpFull;
        const use = () => {
          const res = game.useItem(id);
          if (res?.ok) {
            audio.useItem();
            toast(res.text, 'good');
            paint();
            renderHud(game);
          } else {
            toast(res?.text ?? '现在用不了。', 'bad');
          }
        };
        // 背包以前一行图标都没有，只能读名字；现在用注册表给道具挑的图标
        list.append(el('div', { class: 'shop-item' }, [
          el('h4', {}, [
            el('span', { class: `shop-ico ${item.ico ?? 'ico-backpack'}` }),
            el('span', { text: `${item.name} ×${n}` }),
          ]),
          el('p', { text: item.desc }),
          el('div', { class: 'row' }, [
            eff
              ? el('button', {
                  class: 'btn btn-sm btn-primary',
                  disabled: blocked,
                  dataset: blocked ? { tip: 'HP 已经满了，喝了也是浪费 —— 受伤之后再来。' } : null,
                  onClick: use,
                }, [blocked ? 'HP 已满' : '使用'])
              : el('span', { class: 'price', dataset: { tip: '这类道具拿到手就已经生效了，不需要使用。' } }, ['已生效']),
          ]),
        ]));
      }
      body.append(list);
    }
    body.append(el('div', { class: 'help-card', style: { marginTop: '12px' } }, [
      el('h4', { text: '道具怎么用' }),
      el('ul', {}, [
        el('li', { text: '药水留在背包里，想什么时候喝就点「使用」——不占出牌次数，战斗中也随时能用（按 I 打开背包）。' }),
        el('li', { html: '护符 / 活力药这类「本局 +N」的道具，<b>拿到手就自动生效</b>了，不会留在背包里。' }),
      ]),
    ]));
    body.append(el('div', { class: 'help-card', style: { marginTop: '12px' } }, [
      el('h4', { text: '地图上的回血方式' }),
      el('ul', {}, [
        // 数字全部现算：这几条以前写死成 35% / 4%，和 BALANCE 里的 40% / 12% 早就对不上了
        el('li', { text: `绿洲营地：回复最大生命的 ${Math.round(BALANCE.restHealPct * 100)}%（营地还可以把一张卡换成更强的卡）。` }),
        el('li', { text: '卡牌：羽栖、文柚果、急救等回复类卡牌，战斗中随时可用。' }),
        el('li', { text: '事件：不少选项能直接回血，或者提升最大生命。' }),
        el('li', { text: `每场战斗胜利后自动回复最大生命的 ${Math.round(BALANCE.healAfterBattlePct * 100)}%。` }),
        el('li', { text: `走到首领节点前会先自动回复 ${Math.round(BALANCE.preBossHealPct * 100)}% 生命。` }),
      ]),
    ]));
  };
  paint();
  return modal({ title: '背包与补给', body: wrap, wide: true });
}

// ============================================================
// 帮助
// ============================================================
export function showHelp() {
  /**
   * 说明页里的数字**一律从 BALANCE / stageCount() 现算**，不许再手写。
   *
   * 这一页以前到处是写死的数字，改完平衡就全对不上了 —— 实测过期的有：
   * 「三章都走完就算通关」（早就 6 章）、「营地回复 35%」（实际 40%）、
   * 「每场战斗胜利后回复 4%」（实际 12%）。手写数字 = 一定会过期。
   */
  const pct = (v) => `${Math.round(v * 100)}%`;
  const stages = stageCount();
  const body = el('div', { class: 'help-grid' }, [
    el('div', { class: 'help-card' }, [
      el('h4', { text: '怎么玩' }),
      el('ul', {}, [
        el('li', { text: '在分叉地图上选择前进路线：战斗 / 事件 / 宝箱 / 商店 / 营地 / 首领。' }),
        el('li', { text: '战斗胜利后可以拿卡、拿金币、拿道具。击败章节首领进入下一章。' }),
        el('li', { text: 'HP 在战斗之间保留，降到 0 这一局就灰溜溜地回家了。' }),
        el('li', { text: `${stages} 章都走完就算通关，看看你能走多远。` }),
      ]),
    ]),
    el('div', { class: 'help-card' }, [
      el('h4', { text: '战斗规则' }),
      el('ul', {}, [
        el('li', { html: `每回合 AP 回满，由<code>敏捷</code>决定：AP = 2 + 敏捷 ÷ 2（上限 ${BALANCE.apMax}）。` }),
        el('li', { html: '伤害 =（攻击 + 卡牌威力）× 60 ÷ (60 + 对方防御)，最低 1 点；先扣<code>护盾</code>。' }),
        el('li', { html: `每回合抽牌数、出牌上限也看<code>敏捷</code>：抽牌 = 3 + 敏捷 ÷ 5（上限 ${BALANCE.drawMax}），出牌上限 = 3 + 敏捷 ÷ 2（上限 ${BALANCE.playMax}）。这三项在你战斗界面的底栏写着当前数值。` }),
        el('li', { html: `抽上来的牌比手牌上限（3 + 敏捷 ÷ 5，上限 ${BALANCE.handMax}）多，多出来的会自动进弃牌堆——所以不要囤牌。` }),
        el('li', { html: `<code>幸运</code>影响暴击率与闪避率，暴击伤害 ×${BALANCE.luckCritMult}。` }),
        el('li', { html: '卡牌用完默认洗回<code>卡组最底端</code>；标着<code>销毁</code>的卡一场战斗只能用一次。' }),
        el('li', { html: '牌组薄的时候，同一张牌一个回合里能被打上好几次（打完回底端、又抽回来）—— 这是<code>花了钱删卡</code>才换来的构筑，但每回合能打几张仍然卡死在出牌上限。' }),
        el('li', { text: '卡组抽空时，弃牌堆会洗回卡组继续抽。' }),
        el('li', { text: '护盾在持有者自己的回合开始时清空，所以它其实是「这一轮的减伤」。' }),
        el('li', { html: '每次进入新回合会有一条<code>回合光带</code>扫过屏幕，写着「第 N 回合」和这一侧的正 / 背面立绘。<b>它不挡操作</b> —— 光带还在飘的时候你已经可以出牌了。' }),
      ]),
    ]),
    el('div', { class: 'help-card' }, [
      el('h4', { text: '道具与背包' }),
      el('ul', {}, [
        el('li', { html: `按 <code>I</code> 打开背包。药水（好伤药 ${pct(0.25)} / 厉害伤药 ${pct(0.5)}）留在背包里，想喝就点「使用」——<b>不占出牌次数</b>，战斗中随时能用。` }),
        el('li', { html: '护符与活力药这类「本局 +N」的道具，<b>拿到手就自动生效</b>，不会留在背包里。' }),
        el('li', { text: '来源：宝箱、事件、商店（铁匠铺一定有护符、药草摊一定有药），以及首领奖励。' }),
      ]),
    ]),
    el('div', { class: 'help-card' }, [
      el('h4', { text: '成长与续航' }),
      el('ul', {}, [
        el('li', { text: '每场战斗胜利都会永久提升属性（精英与首领给得更多），这是跟得上后续章节的关键。' }),
        el('li', { text: `走到首领节点时会先自动恢复 ${pct(BALANCE.preBossHealPct)} 生命。` }),
        el('li', { text: BALANCE.fullHealAfterBoss ? '打完章节首领完全回血，然后进入下一章。' : '打完章节首领后进入下一章。' }),
        el('li', { text: `每场战斗胜利后自动回复最大生命的 ${pct(BALANCE.healAfterBattlePct)}；绿洲营地回复 ${pct(BALANCE.restHealPct)}。` }),
        el('li', { text: '回复类卡牌里，羽栖 / 急救 / 水流环 / 睡觉按最大生命的百分比回，文柚果 / 寄生种子 / 生命水滴是固定值 —— 前期固定值更顶用，后期百分比更顶用。' }),
        el('li', { text: '护盾类卡牌（变硬、铁壁、守住）的量会随你的防御成长。' }),
      ]),
    ]),
    el('div', { class: 'help-card' }, [
      el('h4', { text: '状态效果' }),
      el('ul', {}, [
        el('li', {}, [el('span', { class: 'help-ico ico-poison' }), '中毒：回合开始流失等于层数的生命，然后层数 -1。']),
        el('li', {}, [el('span', { class: 'help-ico ico-flame' }), '灼伤：回合开始流失等于层数的生命，层数不减少。']),
        el('li', {}, [el('span', { class: 'help-ico ico-temperature_down' }), '虚弱：攻击力降低 25%。挂上之后那一方要打完整整一个回合才掉 1 层，所以「1 层」= 削弱对方一个回合。']),
        el('li', {}, [el('span', { class: 'help-ico ico-heart_break_02' }), '出血：每次受到攻击额外流失层数的生命。']),
        el('li', {}, [el('span', { class: 'help-ico ico-shield_02' }), '护盾：先于 HP 承受伤害，回合开始时清空。']),
        el('li', { text: '属性被削有下限：最多削到基础值的一半，不会被磨成负数。' }),
        el('li', { text: '「白雾」清自己所有属性下降，「焕然一新」连负面状态一起清 —— 被削弱得难受时找这两张。' }),
      ]),
    ]),
    el('div', { class: 'help-card' }, [
      el('h4', { text: '卡组' }),
      el('ul', {}, [
        el('li', { text: '带进战斗的就是你拥有的全部卡牌 —— 不能挑着不带，也不能只带两张。' }),
        el('li', { html: '想让卡组更精：去商店买<code>卡牌移除服务</code>删掉不要的牌，同一家店里越删越贵（最多删到剩 3 张）。' }),
        el('li', { html: '想换牌：营地的<code>冥想</code>能把一张牌换成随机的高稀有度牌（只能二选一，不能又休息又冥想）。' }),
        el('li', { text: '卡组越薄 → 越容易每回合抽到关键牌；越厚 → 每回合能打出的总量上限更高，但抽得散。' }),
        el('li', { text: '卡组一览里可以排序、点开单卡看详情，每种卡带了几张会标成 ×N，还能展开卡牌图鉴看收集进度。' }),
      ]),
    ]),
    el('div', { class: 'help-card' }, [
      el('h4', { text: '快捷键' }),
      el('ul', {}, [
        el('li', { html: '<code>1</code> ~ <code>9</code> 打出手牌中第 N 张。' }),
        el('li', { html: '<code>空格</code> 结束回合。' }),
        el('li', { html: '<code>D</code> 打开卡组一览（只读：能排序、看详情、看图鉴）。' }),
        el('li', { html: '<code>I</code> 打开背包（喝药在这里）。' }),
        el('li', { html: '<code>H</code> 或 <code>?</code> 打开这一页。' }),
        el('li', { html: '<code>Esc</code> 关闭弹窗（叠了好几层时只关最上面那层）。' }),
      ]),
    ]),
    el('div', { class: 'help-card' }, [
      el('h4', { text: '关于素材' }),
      el('ul', {}, [
        el('li', { text: '宝可梦精灵图与表情头像来自 PMDCollab/SpriteCollab（各作者署名见仓库 credits.txt）。' }),
        el('li', { text: '回合切换立绘来自 Generation 9 Pack（正面 / 背面图）。' }),
        el('li', { text: '界面图标、面板、音效、粒子来自 Kenney 素材包与 Game-Icon-Pack（都是 CC0）。' }),
        el('li', { text: 'BGM 来自「音楽の卵」(ontama-m.com)：个人/法人均可免费使用、无需报告、无需署名、可商用。' }),
        el('li', { text: '宝可梦译名以 52poke 神奇宝贝百科为准。' }),
        el('li', { text: '非商业同人练习作品。' }),
      ]),
    ]),
  ]);
  return modal({ title: '沙漠精灵 · 玩法说明', body, wide: true });
}

// ============================================================
// 设置
// ============================================================
export function showSettings() {
  const body = el('div', {});
  const nowPlaying = el('span', { style: { opacity: '.7', fontSize: '12px' }, text: '（未播放）' });
  const musicState = () => {
    const key = music.nowPlaying();
    return key ? `正在播放：${BGM_NAMES[key] ?? key}` : '（未播放）';
  };

  body.append(
    el('div', { class: 'setting-row' }, [
      el('label', { text: '音效音量' }),
      el('input', {
        type: 'range', min: '0', max: '100', value: String(Math.round(audio.sfxVolume * 100)),
        onInput: (e) => audio.setSfxVolume(Number(e.target.value) / 100),
      }),
    ]),
    el('div', { class: 'setting-row' }, [
      el('label', { text: 'BGM 音量' }),
      el('input', {
        type: 'range', min: '0', max: '100', value: String(Math.round(audio.musicVolume * 100)),
        onInput: (e) => audio.setMusicVolume(Number(e.target.value) / 100),
      }),
    ]),
    el('div', { class: 'setting-row' }, [
      el('label', {}, ['当前曲目', el('br'), nowPlaying]),
      el('button', {
        class: 'btn btn-sm',
        onClick: () => { nowPlaying.textContent = musicState(); },
      }, ['刷新']),
    ]),
    el('div', { class: 'setting-row' }, [
      el('label', { text: '声音开关（音效 + BGM）' }),
      el('button', {
        class: 'btn btn-sm',
        onClick: (e) => {
          const on = audio.toggle();
          e.currentTarget.textContent = on ? '已开启' : '已静音';
          nowPlaying.textContent = musicState();
        },
      }, [audio.enabled ? '已开启' : '已静音']),
    ]),
    el('div', { class: 'setting-row' }, [
      el('label', { text: '战斗演出速度' }),
      // 注意：<select> 上写 value 属性是没用的（属性不会选中 option），
      // 必须给对应的 option 加 selected，否则界面显示的选择和实际速度会对不上。
      el('select', {
        style: { minHeight: '36px', borderRadius: '8px', padding: '4px 8px', background: '#241610', color: '#f7ecd6', border: '1px solid rgba(232,207,162,.3)' },
        onChange: (e) => {
          const v = e.target.value;
          try { localStorage.setItem(BATTLE_SPEED_KEY, v); } catch { /* 忽略 */ }
          toast(`战斗演出速度：${SPEED_OPTIONS.find((o) => o.key === v)?.label ?? v}（下场战斗生效）`, 'good');
        },
      }, SPEED_OPTIONS.map((o) => el('option', {
        value: o.key,
        text: o.label,
        selected: o.key === loadBattleSpeed(),
      }))),
    ]),
    el('div', { class: 'setting-row' }, [
      el('label', { text: '切换 BGM（试听）' }),
      el('select', {
        style: { minHeight: '36px', borderRadius: '8px', padding: '4px 8px', background: '#241610', color: '#f7ecd6', border: '1px solid rgba(232,207,162,.3)' },
        onChange: (e) => { audio.playBgm(e.target.value, { restart: true }); nowPlaying.textContent = musicState(); },
      }, Object.entries(BGM_NAMES).map(([k, name]) => el('option', { value: k, text: `${name}（${k}）` }))),
    ]),
    el('div', { class: 'setting-row' }, [
      el('label', { text: '导出存档' }),
      el('button', {
        class: 'btn btn-sm',
        onClick: () => {
          const data = save.readRun();
          if (!data) return toast('当前没有进行中的存档。', 'bad');
          save.exportFile(data);
          toast('已导出 oasis-save.json', 'good');
        },
      }, ['导出 JSON']),
    ]),
    el('div', { class: 'setting-row' }, [
      el('label', { text: '清空存档' }),
      el('button', {
        class: 'btn btn-sm btn-danger',
        onClick: () => { save.clearRun(); toast('存档已清空。', 'good'); },
      }, ['删除进度']),
    ]),
    el('div', { class: 'setting-row' }, [
      el('label', { text: 'BGM 出处' }),
      el('span', { style: { fontSize: '12px', opacity: '.75', textAlign: 'right' }, text: '音楽の卵 (ontama-m.com)：免费使用、无需报告、可商用' }),
    ]),
  );

  // 打开时顺手刷新一下当前曲目
  setTimeout(() => { nowPlaying.textContent = musicState(); }, 0);

  return modal({ title: '设置', body });
}
