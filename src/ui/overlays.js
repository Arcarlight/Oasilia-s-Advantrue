// 弹窗类界面：卡组 / 出战卡牌、背包、帮助、设置

import { el, clear, modal, toast } from './dom.js';
import { cardEl, cardTag } from './cards.js';
import {
  SORT_MODES, sortCards, groupLabel, cardDamageTotal, richHTML, collectKeywords, effectLines,
} from './cardtext.js';
import { audio } from '../core/audio.js';
import { music } from '../core/bgm.js';
import { BALANCE, apFromAgi, drawFromAgi, handFromAgi, critChance, dodgeChance, SPEED_OPTIONS, BATTLE_SPEED_KEY, loadBattleSpeed, RARITY } from '../data/balance.js';
import { CARD_BY_ID, CARDS, ITEMS } from '../data/cards.js';
import { save } from '../core/save.js';
import { BGM_NAMES } from '../core/bgm.js';
import { renderHud } from './hud.js';

// ============================================================
// 卡组 / 出战卡牌选择
// ============================================================
export function showDeck(game, opts = {}) {
  const d = game.data;
  const picking = opts.picking === true;
  /**
   * 出战卡组按「卡组里的第几张」记账（出现序号），不是按卡牌 id。
   *
   * 以前是按 id 数份数：卡组里有 4 张「撞击」时，界面把前 N 份画成已选，
   * 而「取消」永远是扣掉第一份 —— 玩家点第 4 张卡上的圆圈，被取消的却是第 1 张，
   * 自己点的那张毫无变化（用户反馈：「这个按钮不起作用了」）。
   * 现在每一份都有自己的序号，点哪一份就切换哪一份，和眼睛看到的完全一致。
   */
  let chosenSet = new Set();
  /** 按出现序号选卡：用于「自动推荐」这类只给 id 列表的来源 */
  function selectIds(ids) {
    const used = new Set();
    const set = new Set();
    for (const id of ids) {
      const k = d.deck.findIndex((x, i) => x === id && !used.has(i));
      if (k < 0) continue;
      used.add(k);
      set.add(k);
    }
    return set;
  }
  chosenSet = selectIds(d.battleDeck ?? game.defaultBattleDeck());
  /** 当前排序方式：默认 / 伤害 / 特殊效果 / 费用 / 稀有度 */
  let sortMode = 'default';
  /** 出战卡组（id 数组，保存 / 结算用） */
  const chosenIds = () => [...chosenSet].sort((a, b) => a - b).map((k) => d.deck[k]);

  const body = el('div', {});

  const statsPanel = el('div', { class: 'help-grid' }, [
    el('div', { class: 'help-card' }, [
      el('h4', { text: '当前数值' }),
      el('ul', {}, [
        el('li', { text: `攻击 ${d.atk} ｜ 防御 ${d.def} ｜ 敏捷 ${d.agi} ｜ 幸运 ${d.luck}` }),
        el('li', { text: `每回合 AP ${apFromAgi(d.agi)} ｜ 抽牌 ${drawFromAgi(d.agi)} 张 ｜ 手牌上限 ${handFromAgi(d.agi)}` }),
        el('li', { text: `暴击率 ${critChance(d.luck).toFixed(1)}% ｜ 闪避率 ${dodgeChance(d.luck).toFixed(1)}%` }),
      ]),
    ]),
    el('div', { class: 'help-card' }, [
      el('h4', { text: '出战规则' }),
      el('ul', {}, [
        el('li', { text: `每次战斗至少带 ${BALANCE.minBattleDeck} 张，最多 ${BALANCE.maxBattleDeck} 张。` }),
        el('li', { text: picking ? '点卡牌看它的详细说明；点左上角的圆圈加入 / 拿掉。' : '点卡牌可以看它的详细说明。' }),
        picking ? el('li', { text: '加不进去的时候按钮会直接写明原因：这张牌带满了写「只能拥有 N 张」，出战卡组满 14 张写「出战卡组已满」。' }) : null,
        el('li', { text: '作战时只从「出战卡组」抽牌（卡组会用弃牌堆循环）。' }),
        el('li', { text: '带得少 → 更容易抽到核心卡；带得多 → 总伤害上限更高。' }),
      ]),
    ]),
  ]);

  const toolbar = el('div', { class: 'deck-toolbar' });
  const countEl = el('span', { class: 'deck-count' });
  const btnAuto = el('button', {
    class: 'btn btn-sm btn-ghost',
    onClick: () => { chosenSet = selectIds(game.defaultBattleDeck()); audio.ui('toggle'); paint(); },
  }, ['自动推荐']);
  const btnAll = el('button', {
    class: 'btn btn-sm btn-ghost',
    onClick: () => {
      // 「尽量多带」= 每种先来一张（保持卡组多样性），还不到上限再用剩下的份数补满
      const set = new Set();
      const seen = new Set();
      d.deck.forEach((id, k) => { if (!seen.has(id)) { seen.add(id); set.add(k); } });
      const trimmed = new Set([...set].slice(0, BALANCE.maxBattleDeck));
      for (let k = 0; k < d.deck.length && trimmed.size < BALANCE.maxBattleDeck; k++) trimmed.add(k);
      chosenSet = trimmed;
      audio.ui('toggle');
      paint();
    },
  }, [`尽量多带（上限 ${BALANCE.maxBattleDeck}）`]);
  toolbar.append(
    el('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } }, [countEl]),
    el('div', { style: { display: 'flex', gap: '8px' } }, [btnAuto, btnAll]),
  );

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
  body.append(statsPanel, toolbar, sortBar, grid);

  const ownedCount = (id) => d.deck.filter((x) => x === id).length;
  /** 这张牌已经带了几份（详情页显示用） */
  const pickedOf = (id) => [...chosenSet].filter((k) => d.deck[k] === id).length;
  /** 出战卡组是不是已经满了 */
  const deckFull = () => chosenSet.size >= BALANCE.maxBattleDeck;

  /** 点某一份的圆圈：切换的就是**这一份** */
  function toggleOcc(k) {
    if (chosenSet.has(k)) {
      chosenSet.delete(k);
      audio.ui('toggle');
    } else {
      if (deckFull()) {
        // 加不进去的时候一定要说清为什么 —— 以前只弹个提示就 return，
        // 玩家看到的是「点了没反应」（用户反馈）。
        toast(`出战卡组已经满了（${BALANCE.maxBattleDeck} 张）—— 先拿掉几张再加。`, 'bad');
        return;
      }
      chosenSet.add(k);
      audio.ui('click');
    }
    paint();
  }

  /**
   * 加一张 / 拿掉一张（详情页那两个按钮用）。
   * 返回 false 表示「加不了」：卡组里这张牌的所有份数都在出战卡组里了，或者出战卡组满了。
   * 详情页拿这个结果去改按钮上的字（「只能拥有 X 张」/「出战卡组已满」），
   * 而不是让按钮点了像没反应。
   */
  function addOne(id) {
    // 先看这张牌还有没有空闲的份数
    const free = d.deck.findIndex((x, k) => x === id && !chosenSet.has(k));
    if (free < 0) return false;
    if (deckFull()) {
      toast(`出战卡组已经满了（${BALANCE.maxBattleDeck} 张）—— 先拿掉几张再加。`, 'bad');
      return false;
    }
    chosenSet.add(free);
    audio.ui('click');
    paint();
    return true;
  }
  function removeOne(id) {
    const mine = [...chosenSet].filter((k) => d.deck[k] === id).sort((a, b) => a - b);
    if (!mine.length) return false;
    chosenSet.delete(mine[mine.length - 1]);
    audio.ui('toggle');
    paint();
    return true;
  }

  function openDetail(card) {
    audio.ui('click2');
    showCardDetail(card, {
      picking,
      state: () => ({
        picked: pickedOf(card.id),
        owned: ownedCount(card.id),
        full: deckFull(),
        max: BALANCE.maxBattleDeck,
      }),
      onAdd: () => addOne(card.id),
      onRemove: () => removeOne(card.id),
    });
  }

  /**
   * 把一批卡填进网格。卡组网格和卡牌图鉴共用这一份 ——
   * 以前图鉴自己抄了一遍「排序后逐张 append」，于是漏了分组标题：
   * 卡组页按「特殊效果」排序有分组，展开图鉴却没有（诊断脚本量出来的）。
   *
   * items 是 `{ card, occ, state }`：
   *   occ   = 在卡组里的出现序号（图鉴用 null）
   *   state = 'deck' 这一局正带着 / 'seen' 以前拿到过 / 'new' 从没见过（只有图鉴用）
   * sortCards 返回的下标是「传进去那个数组的下标」，所以排序后还能找回是哪一份。
   */
  function fillGrid(container, items, { check = false } = {}) {
    clear(container);
    let lastGroup = null;
    for (const { i, card, group } of sortCards(items.map((it) => it.card), sortMode)) {
      const occ = items[i]?.occ ?? null;
      const state = items[i]?.state ?? 'deck';
      // 「按特殊效果」时插分组标题：光靠排序玩家看不出为什么这张排在前面
      if (sortMode === 'effect' && group !== lastGroup) {
        lastGroup = group;
        container.append(el('div', { class: 'grid-group' }, [el('span', { text: groupLabel(group) })]));
      }
      const badges = [];
      if (sortMode === 'damage') badges.push(`伤害 ${cardDamageTotal(card)}`);
      if (state === 'new') badges.push('未获得');
      else if (state === 'seen') badges.push('曾拿过');
      const node = cardEl(card, {
        size: 'sm',
        check,
        checked: check && occ != null && chosenSet.has(occ),
        badges,
        onClick: () => openDetail(card),
        onCheck: check && occ != null ? () => toggleOcc(occ) : null,
      });
      // 没拿过的卡压暗：图鉴里「全亮」会让玩家以为这些都算已收集（用户反馈）
      if (state === 'new') node.classList.add('card-unowned');
      // 出战卡组满了：把「还没选」的那些圆圈画成锁住的样子、换上说明，
      // 免得玩家一个个点过去都是「点了没反应」。
      if (check && occ != null && !chosenSet.has(occ) && deckFull()) {
        const box = node.querySelector('.card-check');
        if (box) {
          box.classList.add('locked');
          box.dataset.tip = `出战卡组已经满了（${BALANCE.maxBattleDeck} 张）—— 先拿掉几张再加。`;
        }
      }
      container.append(node);
    }
  }

  function paint() {
    fillGrid(grid, d.deck.map((id, k) => ({ card: CARD_BY_ID[id], occ: k })).filter((it) => it.card), { check: picking });
    const n = chosenSet.size;
    const ok = n >= BALANCE.minBattleDeck && n <= BALANCE.maxBattleDeck;
    countEl.className = `deck-count ${ok ? 'ok' : 'bad'}`;
    countEl.textContent = `出战卡组 ${n} 张（需 ${BALANCE.minBattleDeck} ~ ${BALANCE.maxBattleDeck} 张）`;
    sortHint.textContent = SORT_MODES.find((m) => m.key === sortMode)?.hint ?? '';
  }
  paint();

  /**
   * 图鉴里每张卡的状态：
   *   deck = 这一局正带着（最亮，没有任何标记）
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
    fillGrid(codexGrid, CARDS.map((card) => ({ card, occ: null, state: codexState(card.id) })));
  });
  body.append(codex);

  // 存下弹窗句柄再返回：保存按钮要调 m.close()，
  // 以前这里写的是 `return modal({...})`，于是 m 根本没定义 ——
  // 点「保存出战卡组」会抛 ReferenceError，卡组存进去了但弹窗不关（看着像没反应）。
  const m = modal({
    title: picking ? '挑选出战卡牌' : '卡组一览',
    wide: true,
    body,
    foot: picking ? [
      el('button', {
        class: 'btn btn-primary',
        onClick: () => {
          const ids = chosenIds();
          const res = game.setBattleDeck(ids);
          if (!res.ok) return toast(res.reason, 'bad');
          toast(`出战卡组已保存（${ids.length} 张）`, 'good');
          audio.ui('confirm');
          m.close();
        },
      }, [el('span', { class: 'ico-check' }), el('span', { text: '保存出战卡组' })]),
    ] : null,
  });
  return m;
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
   * 「加入」和「拿掉」拆成两个按钮。
   *
   * 以前只有一个按钮、按当前份数换文案（没带过 → 加入；带过 → 拿掉），
   * 于是「我已经带了 1 张、想再带一张」这件事根本没有按钮可点 ——
   * 卡组里只有一张的牌更是彻底点不进第二张，玩家看到的就是「点了没反应」。
   *
   * 现在加不进去的时候（这张牌的所有份数都带了 / 出战卡组满了）
   * 「加入」按钮会**禁用并直接把原因写在按钮上**（用户要求：「只能拥有 X 张」）。
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
    const { picked = 0, owned = 1, full = false, max = 0 } = state();
    stateEl.textContent = picked > 0
      ? `出战卡组里有这张：${picked} / ${owned} 张`
      : `这张还没进出战卡组（卡组里一共有 ${owned} 张）`;
    if (!picking) return;
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

  if (picking || state) {
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
    const entries = Object.entries(game.data.items ?? {});
    if (!entries.length) {
      body.append(el('p', { text: '背包是空的。地图上的宝箱和商店会给你补货。' }));
    } else {
      const list = el('div', { class: 'shop-list' });
      for (const [id, n] of entries) {
        const item = ITEMS[id];
        if (!item) continue;
        // 背包以前一行图标都没有，只能读名字；现在用注册表给道具挑的图标
        list.append(el('div', { class: 'shop-item' }, [
          el('h4', {}, [
            el('span', { class: `shop-ico ${item.ico ?? 'ico-backpack'}` }),
            el('span', { text: `${item.name} ×${n}` }),
          ]),
          el('p', { text: item.desc }),
          el('div', { class: 'row' }, [
            item.heal
              ? el('button', {
                  class: 'btn btn-sm btn-primary',
                  disabled: game.data.hp >= game.data.maxHp,
                  onClick: () => {
                    const res = game.useItem(id);
                    if (res?.ok) {
                      audio.useItem();
                      toast(res.text, 'good');
                      paint();
                      renderHud(game);
                    } else {
                      toast(res?.text ?? '现在用不了。', 'bad');
                    }
                  },
                }, [game.data.hp >= game.data.maxHp ? 'HP 已满' : '使用'])
              : el('span', { class: 'price', text: '已生效' }),
          ]),
        ]));
      }
      body.append(list);
    }
    body.append(el('div', { class: 'help-card', style: { marginTop: '12px' } }, [
      el('h4', { text: '地图上的回血方式' }),
      el('ul', {}, [
        el('li', { text: '绿洲营地：回复最大生命的 35%（营地还可以把一张卡换成更强的卡）。' }),
        el('li', { text: '卡牌：羽栖、文柚果、急救等回复类卡牌，战斗中随时可用。' }),
        el('li', { text: '事件：不少选项能直接回血，或者提升最大生命。' }),
        el('li', { text: '每场战斗胜利后自动回复最大生命的 4%。' }),
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
  const body = el('div', { class: 'help-grid' }, [
    el('div', { class: 'help-card' }, [
      el('h4', { text: '怎么玩' }),
      el('ul', {}, [
        el('li', { text: '在分叉地图上选择前进路线：战斗 / 事件 / 宝箱 / 商店 / 营地 / 首领。' }),
        el('li', { text: '战斗胜利后可以拿卡、拿金币、拿道具。击败章节首领进入下一章。' }),
        el('li', { text: 'HP 在战斗之间保留，降到 0 这一局就结束了。' }),
        el('li', { text: '三章都走完就算通关，看看你能走多远。' }),
      ]),
    ]),
    el('div', { class: 'help-card' }, [
      el('h4', { text: '战斗规则' }),
      el('ul', {}, [
        el('li', { html: '每回合 AP 回满，由<code>敏捷</code>决定：AP = 2 + 敏捷 ÷ 2（上限 8）。' }),
        el('li', { html: '伤害 =（攻击 + 卡牌威力）× 60 ÷ (60 + 对方防御)，最低 1 点；先扣<code>护盾</code>。' }),
        el('li', { html: '每回合抽牌数、出牌上限也看<code>敏捷</code>：抽牌 = 3 + 敏捷 ÷ 5，出牌上限 = 3 + 敏捷 ÷ 2。' }),
        el('li', { html: '抽上来的牌比手牌上限多，多出来的会自动进弃牌堆——所以不要囤牌。' }),
        el('li', { html: '<code>幸运</code>影响暴击率与闪避率，暴击伤害 ×1.6。' }),
        el('li', { html: '卡牌用完默认洗回<code>卡组最底端</code>；标着<code>销毁</code>的卡一场战斗只能用一次。' }),
        el('li', { text: '卡组抽空时，弃牌堆会洗回卡组继续抽。' }),
        el('li', { text: '护盾在持有者自己的回合开始时清空，所以它其实是「这一轮的减伤」。' }),
      ]),
    ]),
    el('div', { class: 'help-card' }, [
      el('h4', { text: '成长与续航' }),
      el('ul', {}, [
        el('li', { text: '每场战斗胜利都会永久提升属性（精英与首领给得更多），这是跟得上后续章节的关键。' }),
        el('li', { text: '走到首领节点时会先自动恢复一部分生命。' }),
        el('li', { text: '打完章节首领完全回血，然后进入下一章。' }),
        el('li', { text: '治疗类卡牌（羽栖、文柚果、急救）按最大生命的百分比恢复，后期一样有用。' }),
        el('li', { text: '护盾类卡牌（变硬、铁壁、守住）的量会随你的防御成长。' }),
      ]),
    ]),
    el('div', { class: 'help-card' }, [
      el('h4', { text: '状态效果' }),
      el('ul', {}, [
        el('li', {}, [el('span', { class: 'help-ico ico-poison' }), '中毒：回合开始流失等于层数的生命，然后层数 -1。']),
        el('li', {}, [el('span', { class: 'help-ico ico-flame' }), '灼伤：回合开始流失等于层数的生命，层数不减少。']),
        el('li', {}, [el('span', { class: 'help-ico ico-temperature_down' }), '虚弱：攻击力降低 25%，持续若干回合。']),
        el('li', {}, [el('span', { class: 'help-ico ico-heart_break_02' }), '流血：每次受到攻击额外流失层数的生命。']),
        el('li', {}, [el('span', { class: 'help-ico ico-shield_02' }), '护盾：先于 HP 承受伤害，回合开始时清空。']),
      ]),
    ]),
    el('div', { class: 'help-card' }, [
      el('h4', { text: '卡组与出战' }),
      el('ul', {}, [
        el('li', { text: '地图上随时可以打开「卡组」，勾选这一场带哪些卡。' }),
        el('li', { text: `每场战斗至少带 ${BALANCE.minBattleDeck} 张，最多 ${BALANCE.maxBattleDeck} 张。` }),
        el('li', { text: '带得少更容易抽到核心卡；带得多总输出更高但抽卡更散。' }),
        el('li', { text: '保存后从下一场战斗开始生效。' }),
      ]),
    ]),
    el('div', { class: 'help-card' }, [
      el('h4', { text: '快捷键' }),
      el('ul', {}, [
        el('li', { html: '<code>1</code> ~ <code>9</code> 打出手牌中第 N 张。' }),
        el('li', { html: '<code>空格</code> 结束回合。' }),
        el('li', { html: '<code>D</code> 打开卡组/出战选择。' }),
        el('li', { html: '<code>Esc</code> 关闭弹窗。' }),
      ]),
    ]),
    el('div', { class: 'help-card' }, [
      el('h4', { text: '关于素材' }),
      el('ul', {}, [
        el('li', { text: '宝可梦精灵图来自 PMDCollab/SpriteCollab（各作者署名见仓库 credits.txt）。' }),
        el('li', { text: '界面图标、面板、音效、粒子来自 Kenney 素材包（CC0）。' }),
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
