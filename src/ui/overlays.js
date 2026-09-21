// 弹窗类界面：卡组 / 出战卡牌、背包、帮助、设置

import { el, clear, modal, toast } from './dom.js';
import { SORT_MODES } from './cardtext.js';
import { audio } from '../core/audio.js';
import { music } from '../core/bgm.js';
import { BALANCE, apFromAgi, drawFromAgi, handFromAgi, playsFromAgi, critChance, dodgeChance, SPEED_OPTIONS, BATTLE_SPEED_KEY, loadBattleSpeed } from '../data/balance.js';
// itemEffect / inventoryEntries：道具有没有「主动使用」的效果、背包里哪些真的还有 ——
// 背包界面和引擎共用这两份判断，别在界面里自己抄一遍数据模型的规则
// （抄漏过一次：判断写的是 `item.heal` 而数据字段叫 `healPct`，整个背包一个按钮都没有）
// heldEntries / heldCount / itemUseEffect / sumHeldMods：手持道具（谁在手上、能不能用、
// 加起来是什么效果）全部由引擎那一份判断说了算，界面不再自己抄一遍规则。
import { heldEntries, itemUseEffect } from '../core/item-rules.js';
import { modLabel, holdLines, useLine } from '../core/itemtext.js';
import { ITEMS, itemArtUrl } from '../data/items.js';
import { CARD_BY_ID, CARDS } from '../data/cards.js';
// 说明页里「一共几章」也从地图生成器现问，别再手写（曾经写成「三章」，而实际是 6 章）
import { stageCount } from '../data/mapgen.js';
import { save } from '../core/save.js';
import { BGM_NAMES, BGM_CREDITS } from '../core/bgm.js';
import { t, LANGS, currentLang } from '../core/i18n.js';
import { changeLanguage } from './langswitch.js';
import { expertEnabled, setExpertEnabled } from '../core/expert.js';
import { renderHud } from './hud.js';
// 卡牌详情与图鉴网格都在别处（src/ui/carddetail.js / codex.js）——
// 标题页的卡牌图鉴也要用同一个详情页，放这里就会和它成环。
import { showCardDetail } from './carddetail.js';
import { fillCardGrid, cardCodexProgress } from './codex.js';

// 卡牌详情继续从这个模块转出去一份：tools/diag-cards.js 一直是从这里取的。
// 转出去只能写成「只列本地名字」的那种形式，**绝不能**写成带 from 的转口导出 ——
// 单文件打包器是正则拼的，带 from 的那种会在包里剩下半句 `from '…'`，
// 而且它连注释里的字面样子都会当成代码去处理（这次就是这么翻车的：
// 注释里举了个例子，包里就多出一个不存在的导出名，verify-bundle 直接「游戏没启动」）。
export { showCardDetail };

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
      el('h4', { text: t('每回合的预算（敏捷 {agi}）', { agi: d.agi }) }),
      el('ul', {}, [
        el('li', { text: t('行动点 AP {ap} 点 —— 回合开始回满，出牌花的就是它。', { ap: apFromAgi(d.agi) }) }),
        el('li', { text: t('抽牌 {draw} 张 —— 手牌上限 {hand} 张，抽到手牌满为止（放不下的留在牌堆顶，不会消失）。', { draw: drawFromAgi(d.agi), hand: handFromAgi(d.agi) }) }),
        el('li', { text: t('出牌上限 {plays} 张 —— 一回合最多打这么多张，AP 再多也越不过它。', { plays: playsFromAgi(d.agi) }) }),
        el('li', { text: t('三项都由敏捷决定；每场战斗胜利涨属性时，它们会跟着一起涨。') }),
      ]),
    ]),
    el('div', { class: 'help-card' }, [
      el('h4', { text: t('卡组（{n} 张）', { n: d.deck.length }) }),
      el('ul', {}, [
        el('li', { text: t('能造成伤害的牌 {damageCards} 张 ｜ 0 费牌 {zeroCost} 张', { damageCards, zeroCost }) }),
        el('li', { text: t('护盾 {shield} ｜ 回复 {heal} ｜ 状态 {status} ｜ 强化 {buff}', { shield: kinds.shield, heal: kinds.heal, status: kinds.status, buff: kinds.buff }) }),
        el('li', { text: t('抽牌 {draw} ｜ 回 AP {ap} ｜ 净化 {cleanse}', { draw: kinds.draw, ap: kinds.ap, cleanse: kinds.cleanse }) }),
      ]),
    ]),
    el('div', { class: 'help-card' }, [
      el('h4', { text: t('怎么改卡组') }),
      el('ul', {}, [
        el('li', { text: t('带进战斗的就是你拥有的全部卡牌 —— 不能挑着不带，也不能只带两张。') }),
        el('li', { text: t('想精简：去商店买「卡牌移除服务」删掉不要的牌，同一家店里越删越贵。') }),
        el('li', { text: t('想换牌：营地的「冥想」可以把一张牌换成随机的高稀有度牌。') }),
        el('li', { text: t('卡组越薄 → 越容易抽到关键牌；越厚 → 每回合能打出的总量上限更高。') }),
      ]),
    ]),
  ]);

  // ---- 排序条 ----
  const sortHint = el('span', { class: 'sort-hint' });
  const sortBar = el('div', { class: 'sort-bar' }, [
    el('span', { class: 'sort-label', text: t('排序：') }),
  ]);
  const sortTabs = SORT_MODES.map((m) => {
    const tab = el('button', {
      class: `sort-tab${m.key === sortMode ? ' active' : ''}`,
      dataset: { tip: m.hint() },
      onClick: () => {
        sortMode = m.key;
        audio.ui('toggle');
        for (const t of sortTabs) t.classList.toggle('active', t.dataset.sort === sortMode);
        paint();
      },
    }, [m.label()]);
    tab.dataset.sort = m.key;
    sortBar.append(tab);
    return tab;
  });
  sortBar.append(sortHint);

  const grid = el('div', { class: 'card-grid' });
  body.append(statsPanel, sortBar, grid);

  /**
   * 填网格的唯一入口：走 src/ui/codex.js 的 fillCardGrid()。
   * 「这一局带着 / 以前拿过 / 没见过」三种状态、分组标题、没拿过的压暗，
   * 卡组正片、展开的图鉴、标题页那一页图鉴**共用同一份实现**
   * （以前图鉴自己抄了一遍「排序后逐张 append」，于是漏了分组标题）。
   */
  const fillGrid = (container, cards) => fillCardGrid(container, cards, { sortMode, deckIds: d.deck });

  function paint() {
    // 卡组里同一张牌只画一张（角标写 ×N）—— 20 张的卡组里四张撞击画四遍没意义
    const seen = new Set();
    const cards = [];
    for (const id of d.deck) {
      if (seen.has(id) || !CARD_BY_ID[id]) continue;
      seen.add(id);
      cards.push(CARD_BY_ID[id]);
    }
    fillGrid(grid, cards);
    sortHint.textContent = SORT_MODES.find((m) => m.key === sortMode)?.hint() ?? '';
  }
  paint();

  const codex = el('details', { style: { marginTop: '14px' } }, [
    el('summary', { style: { cursor: 'pointer', padding: '6px 0', fontWeight: '700' } }, [
      el('span', { text: t('卡牌图鉴') }),
      el('span', { style: { opacity: '.75', fontWeight: '400' }, text: t('（已收集 {got} / {total} 种，点开可以逐个看详情）', { got: cardCodexProgress(d.deck).got, total: CARDS.length }) }),
    ]),
  ]);
  const codexGrid = el('div', { class: 'card-grid', style: { marginTop: '10px' } });
  codex.append(codexGrid);
  // 图鉴也跟着排序走：不然「按威力排序」只排上半页，图鉴还是乱的
  codex.addEventListener('toggle', () => {
    if (!codex.open) return;
    fillGrid(codexGrid, CARDS);
  });
  body.append(codex);

  return modal({ title: t('卡组一览'), wide: true, body });
}

// ============================================================
// 手持栏满了：丢掉一件（用户要的规则）
// ============================================================
/**
 * 拿不下新道具时弹的选择框。
 *
 * 什么时候弹：`game.awaitingOverflow = { id, text }` —— 奖励结算、开箱、掉落都会设它
 * （见 game.js 的 giveItem / takeRewardCard / startChest）。地图页每次渲染时看一眼，
 * 有就弹出来，处理完清掉。
 *
 * 三个出路都给：丢掉手上的某一件（换新的）、或者干脆不要新的那件。
 * 「卖给商人」不在这个框里 —— 卖掉要钱货两清，得去商店（那里有正式的一栏）。
 */
export function showHeldOverflow(game) {
  const pending = game.awaitingOverflow;
  if (!pending) return null;
  const fresh = ITEMS[pending.id];
  const entries = heldEntries(game.data.held ?? []);

  const body = el('div', {});
  body.append(el('p', {
    text: t('手上已经拿满了（{n} / {max}），「{name}」放不下 —— 丢掉一件就能拿它。', {
      n: game.data.held.length, max: game.heldMax(), name: fresh?.name ?? pending.id,
    }),
  }));
  body.append(el('div', { class: 'held-slot-row' }, [
    el('span', { class: 'held-hint', text: t('新拿到的：') }),
    el('img', { class: 'held-slot-art', src: itemArtUrl(pending.id), alt: fresh?.name ?? '', draggable: false }),
    el('span', { text: `${fresh?.name ?? pending.id} —— ${t(fresh?.desc ?? '')}` }),
  ]));

  const list = el('div', { class: 'shop-list' });
  const close = () => m.close();
  for (const { id, item, n } of entries) {
    list.append(el('div', { class: 'shop-item held-item' }, [
      el('h4', {}, [
        el('img', { class: 'held-art', src: itemArtUrl(id), alt: item.name, draggable: false }),
        el('span', { text: n > 1 ? `${item.name} ×${n}` : item.name }),
      ]),
      el('p', { text: t(item.desc) }),
      el('div', { class: 'row' }, [
        el('button', {
          class: 'btn btn-sm btn-primary',
          onClick: () => {
            game.dropItem(id);
            const got = game.giveItem(pending.id, 1);
            game.awaitingOverflow = null;
            audio.useItem();
            toast(got.stored ? t('丢掉「{a}」，收下「{b}」。', { a: item.name, b: fresh?.name ?? pending.id }) : t('换手失败，栏位还是满的。'), got.stored ? 'good' : 'bad');
            close();
            renderHud(game);
          },
        }, [t('丢掉这件，换新的')]),
      ]),
    ]));
  }
  body.append(list);

  const m = modal({
    title: t('手持栏满了'),
    body,
    foot: [
      el('button', {
        class: 'btn btn-ghost',
        onClick: () => {
          game.awaitingOverflow = null;
          toast(t('没有收下「{name}」。', { name: fresh?.name ?? pending.id }));
          close();
        },
      }, [t('不要这件新的')]),
    ],
  });
  return m;
}

// ============================================================
// 手持道具（这一版把「背包」换成了它，见 content/items.json 的 _comment）
// ============================================================
/**
 * 一件道具的**作用**，一句一行；没有可说的效果 → null。
 * 说法的唯一来源是 core/itemtext.js（商店货架 / 掉落窗口 / 图鉴都从那里取）。
 */
function heldEffectBox(item) {
  const lines = item.kind === 'hold' ? holdLines(item) : [useLine(item)].filter(Boolean);
  if (!lines.length) return null;
  const box = el('div', { class: 'shop-eff' });
  for (const line of lines) box.append(el('span', { class: 'shop-eff-line', text: line }));
  return box;
}

export function showItems(game) {
  const wrap = el('div', {});
  const body = el('div', {});
  wrap.append(body);
  const inBattle = game.phase === 'battle';

  const paint = () => {
    clear(body);
    const held = game.data.held ?? [];
    const max = game.heldMax();
    const entries = heldEntries(held);
    const mods = game.heldMods();

    // ① 栏位：一排格子，一眼看出还剩几个位置
    const slots = el('div', { class: 'held-slots' });
    for (let i = 0; i < max; i++) {
      const id = held[i];
      const item = id ? ITEMS[id] : null;
      slots.append(el('div', { class: `held-slot${item ? '' : ' empty'}`, dataset: item ? { tip: `${item.name}：${item.desc}` } : null }, [
        item ? el('img', { class: 'held-slot-art', src: itemArtUrl(id), alt: item.name, draggable: false }) : el('span', { class: 'held-slot-plus', text: '+' }),
      ]));
    }
    body.append(el('div', { class: 'held-head' }, [
      el('div', { class: 'held-count', text: t('手持栏 {n} / {max}', { n: held.length, max }) }),
      el('span', { class: 'held-hint', text: t('每打赢一个首领 +1 个栏位。拿满了再捡到东西，会让你丢掉一件。') }),
    ]));
    body.append(slots);

    // ② 持有效果汇总：把所有在手上的东西合成一张表给玩家看（省得自己一件件加）
    const active = Object.entries(mods).filter(([, v]) => v && (v.n > 0));
    if (active.length) {
      const list = el('div', { class: 'held-active' });
      for (const [key, v] of active) {
        list.append(el('span', {
          class: 'held-chip',
          dataset: { tip: t('这一条由 {n} 件道具提供。', { n: v.n }) },
        }, [modLabel(key, v)]));
      }
      body.append(el('div', { class: 'help-card', style: { marginTop: '10px' } }, [
        el('h4', { text: t('现在生效的持有效果') }),
        list,
      ]));
    }

    // ③ 每一件：使用（只有 use 型、且只在战斗外）/ 丢掉
    if (!entries.length) {
      body.append(el('p', { text: t('手上什么都没有。宝箱、商人、还有打赢之后偶尔掉落都会给你补货。') }));
    } else {
      const list = el('div', { class: 'shop-list' });
      for (const { id, item, n } of entries) {
        const eff = itemUseEffect(item);
        const hpFull = game.data.hp >= game.data.maxHp;
        const heals = !!(eff?.healPct || eff?.healFlat || eff?.healFull);
        /**
         * 「能不能用」的两个条件，都写在这一行里，不散到界面各处：
         *   · `eff` 为空 = 持有型（拿着就生效，没有「使用」这个动作）→ 禁用；
         *   · `inBattle` = **战斗中一律禁用**（用户点名：战斗中嗑药太 imba）→ 禁用；
         *   · 回血类而血已满 → 禁用（吃了浪费）。
         *
         * ⚠ 第一版把 inBattle 写反了（`inBattle ? false : …`），结果是**战斗里按钮照样能点** ——
         * 好在引擎那一层也拦着（useItem 里再判一次相位），所以只是按钮可点、点了报错。
         * diag-items 的「战斗中按钮必须是禁用的」那条断言把它抓出来了。
         */
        const blocked = !eff || inBattle || (heals && hpFull);
        const blockTip = !eff
          ? t('这类道具拿在手上就一直生效，不需要使用。')
          : (inBattle ? t('战斗中不能使用道具 —— 先打完这一场。') : t('HP 已经满了，吃了也是浪费。'));
        list.append(el('div', { class: 'shop-item held-item' }, [
          el('h4', {}, [
            el('img', { class: 'held-art', src: itemArtUrl(id), alt: item.name, draggable: false }),
            el('span', { text: n > 1 ? `${item.name} ×${n}` : item.name }),
            el('span', { class: `held-kind ${item.kind}`, text: item.kind === 'hold' ? t('持有') : t('可用') }),
          ]),
          el('p', { text: t(item.desc) }),
          /**
           * 它到底干什么：一句一行（和商店货架、掉落窗口、图鉴同一份说法）。
           * 以前这一栏只有风味描述 —— 玩家拿着一件东西，要打开图鉴才知道效果。
           */
          heldEffectBox(item),
          el('div', { class: 'row' }, [
            eff
              ? el('button', {
                  class: 'btn btn-sm btn-primary',
                  disabled: blocked,
                  dataset: { tip: blocked ? blockTip : t('战斗外使用，用掉就没了。') },
                  onClick: () => {
                    const res = game.useItem(id);
                    if (res?.ok) { audio.useItem(); toast(res.text, 'good'); paint(); renderHud(game); }
                    else toast(res?.text ?? t('现在用不了。'), 'bad');
                  },
                }, [t('使用')])
              : el('span', { class: 'price', dataset: { tip: blockTip } }, [t('持有中')]),
            el('button', {
              class: 'btn btn-sm btn-ghost',
              dataset: { tip: t('丢掉这一件（不可撤销）。') },
              onClick: () => { game.dropItem(id); paint(); renderHud(game); },
            }, [t('丢掉')]),
          ]),
        ]));
      }
      body.append(list);
    }

    body.append(el('div', { class: 'help-card', style: { marginTop: '12px' } }, [
      el('h4', { text: t('手持道具怎么用') }),
      el('ul', {}, [
        el('li', { text: t('手里最多 3 件，每打赢一个首领 +1 件。拿满了再捡到东西，会让你丢掉一件。') }),
        el('li', { text: t('「持有」的那类拿在手上就一直生效（右边那排小字就是它们加起来的效果）。') }),
        el('li', { text: t('「可用」的那类**只能在战斗外使用** —— 战斗中不能嗑药，回血得靠卡牌和营地。') }),
        el('li', { text: t('不要的可以在这里丢掉，也可以到商人那里卖掉换金币。') }),
      ]),
    ]));
  };
  paint();
  return modal({ title: t('手持道具'), body: wrap, wide: true });
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
      el('h4', { text: t('怎么玩') }),
      el('ul', {}, [
        el('li', { text: t('在分叉地图上选择前进路线：战斗 / 事件 / 宝箱 / 商店 / 营地 / 首领。') }),
        el('li', { text: t('战斗胜利后可以拿卡、拿金币、拿道具。击败章节首领进入下一章。') }),
        el('li', { text: t('HP 在战斗之间保留，降到 0 这一局就灰溜溜地回家了。') }),
        el('li', { text: t('{stages} 章都走完就算通关，看看你能走多远。', { stages }) }),
      ]),
    ]),
    el('div', { class: 'help-card' }, [
      el('h4', { text: t('战斗规则') }),
      el('ul', {}, [
        el('li', { html: t('每回合 AP 回满，由<code>敏捷</code>决定：AP = {base} + 敏捷 ÷ {per}（上限 {max}）。', { base: BALANCE.apBase, per: BALANCE.apPerAgi, max: BALANCE.apMax }) }),
        el('li', { html: t('伤害 = 攻击 × <b>威力%</b> × {K} ÷ ({K} + 对方防御)，最低 {min} 点；先扣<code>护盾</code>。', { K: BALANCE.armorK, min: BALANCE.minDamage }) }),
        el('li', { html: t('<b>威力是攻击力的百分比</b>：卡面写「威力 110」就是打出 1.1 倍攻击。费用买的就是这个倍率 —— 1 费约 95~140%、2 费约 200~260%、3 费约 310~420%、4 费约 430~560%。<b>每点 AP 买到的威力随费用上升</b>，所以把 AP 花在贵牌上永远比连打 0 费牌划算（0 费牌只有 25~45%，它卖的是附加效果和「不花 AP」）。') }),
        el('li', { html: t('卡面上写的伤害数字是<b>按你当前攻击力实时算的</b>：战斗外按本章普通怪的防御估，战斗中按当前这只敌人的防御。') }),
        el('li', { html: t('每回合抽牌数、出牌上限也看<code>敏捷</code>：抽牌 = {dBase} + 敏捷 ÷ {dPer}（上限 {dMax}），出牌上限 = {pBase} + 敏捷 ÷ {pPer}（上限 {pMax}）。这三项在你战斗界面的底栏写着当前数值。', { dBase: BALANCE.drawBase, dPer: BALANCE.drawPerAgi, dMax: BALANCE.drawMax, pBase: BALANCE.playBase, pPer: BALANCE.playPerAgi, pMax: BALANCE.playMax }) }),
        el('li', { html: t('抽上来的牌比手牌上限（{base} + 敏捷 ÷ {per}，上限 {max}）多时，<b>只抽到手牌满为止</b>，剩下的留在牌堆顶 —— 不会凭空丢掉。', { base: BALANCE.handBase, per: BALANCE.handPerAgi, max: BALANCE.handMax }) }),
        el('li', { html: t('<code>幸运</code>影响暴击率与闪避率，暴击伤害 ×{mult}。', { mult: BALANCE.luckCritMult }) }),
        el('li', { html: t('打出去的牌进<code>弃牌区</code>；标着<code>销毁</code>的卡一场战斗只能用一次（进销毁区，不会洗回来）。') }),
        el('li', { html: t('牌堆抽空、还要再抽的时候，<code>弃牌区</code>才会洗回牌堆 —— 所以牌组薄的时候同一张牌一轮里能被打上好几次（这是<code>花了钱删卡</code>换来的构筑），但每回合能打几张仍然卡死在出牌上限。') }),
        el('li', { text: t('护盾在持有者自己的回合开始时清空，所以它其实是「这一轮的减伤」。') }),
        el('li', { html: t('每次进入新回合会有一条<code>回合光带</code>扫过屏幕，写着「第 N 回合」和这一侧的正 / 背面立绘。<b>它不挡操作</b> —— 光带还在飘的时候你已经可以出牌了。') }),
      ]),
    ]),
    el('div', { class: 'help-card' }, [
      el('h4', { text: t('道具与背包') }),
      el('ul', {}, [
        el('li', { html: t('按 <code>I</code> 打开背包。药水（好伤药 {small} / 厉害伤药 {big}）留在背包里，想喝就点「使用」——<b>不占出牌次数</b>，战斗中随时能用。', { small: pct(0.25), big: pct(0.5) }) }),
        el('li', { html: t('护符与活力药这类「本局 +N」的道具，<b>拿到手就自动生效</b>，不会留在背包里。') }),
        el('li', { text: t('来源：宝箱、事件、商店（铁匠铺一定有护符、药草摊一定有药），以及首领奖励。') }),
      ]),
    ]),
    el('div', { class: 'help-card' }, [
      el('h4', { text: t('成长与续航') }),
      el('ul', {}, [
        el('li', { text: t('每场战斗胜利都会永久提升属性（精英与首领给得更多），这是跟得上后续章节的关键。') }),
        el('li', { text: t('走到首领节点时会先自动恢复 {pct} 生命。', { pct: pct(BALANCE.preBossHealPct) }) }),
        el('li', { text: BALANCE.fullHealAfterBoss ? t('打完章节首领完全回血，然后进入下一章。') : t('打完章节首领后进入下一章。') }),
        el('li', { text: t('每场战斗胜利后自动回复最大生命的 {after}；绿洲营地回复 {rest}。', { after: pct(BALANCE.healAfterBattlePct), rest: pct(BALANCE.restHealPct) }) }),
        el('li', { text: t('回复类卡牌里，羽栖 / 急救 / 水流环 / 睡觉按最大生命的百分比回，文柚果 / 寄生种子 / 生命水滴是固定值 —— 前期固定值更顶用，后期百分比更顶用。') }),
        el('li', { text: t('护盾类卡牌（变硬、铁壁、守住）的量会随你的防御成长。') }),
      ]),
    ]),
    el('div', { class: 'help-card' }, [
      el('h4', { text: t('状态效果') }),
      el('ul', {}, [
        el('li', {}, [el('span', { class: 'help-ico ico-poison' }), t('中毒：回合开始流失「最大生命的 {pct} × 层数」，然后层数 -1。', { pct: pct(BALANCE.statusPct.poison) })]),
        el('li', {}, [el('span', { class: 'help-ico ico-skull' }), t('剧毒：回合开始流失「最大生命的 {pct} × 层数」，然后层数 <b>+1</b> —— 不衰减，越拖越痛。', { pct: pct(BALANCE.statusPct.toxic) })]),
        el('li', {}, [el('span', { class: 'help-ico ico-flame' }), t('灼伤：回合开始流失「最大生命的 {pct} × 层数」，层数不减少。', { pct: pct(BALANCE.statusPct.burn) })]),
        el('li', {}, [el('span', { class: 'help-ico ico-temperature_down' }), t('虚弱：攻击力降低 25%。挂上之后那一方要打完整整一个回合才掉 1 层，所以「1 层」= 削弱对方一个回合。')]),
        el('li', {}, [el('span', { class: 'help-ico ico-heart_break_02' }), t('出血：对方每次受到攻击额外流失「最大生命的 {pct} × 层数」—— 连击牌越多越疼。', { pct: pct(BALANCE.statusPct.bleed) })]),
        el('li', {}, [el('span', { class: 'help-ico ico-shield_02' }), t('护盾：先于 HP 承受伤害，回合开始时清空（「广域防守」给的那一份不会清）。')]),
        el('li', { html: t('持续伤害按<b>最大生命的百分比</b>结算，所以它打血厚的敌人最划算 —— 打首领时上毒比硬拼攻击力更省事。') }),
        el('li', { html: t('「毒爆」这类<code>引爆</code>牌能把对手身上的持续伤害一次性爆成伤害并清空，是毒流的收尾手段。') }),
        el('li', { html: t('属性被削有下限：攻击 / 防御最多削到基础值的 <b>{pct}</b>（后期敌人防御只有十几点，固定值削弱两下就顶到底，所以稀有牌改用百分比削弱）；<b>敏捷与幸运只削到一半</b> —— 敏捷一个人管着 AP、抽牌、出牌上限三件事，削太深等于直接没收回合。', { pct: pct(typeof BALANCE.debuffFloorPct === 'object' ? BALANCE.debuffFloorPct.atk : BALANCE.debuffFloorPct) }) }),
        el('li', { text: t('「白雾」清自己所有属性下降，「焕然一新」「月光」连负面状态一起清 —— 被削弱得难受时找这几张。') }),
      ]),
    ]),
    el('div', { class: 'help-card' }, [
      el('h4', { text: t('卡组') }),
      el('ul', {}, [
        el('li', { text: t('带进战斗的就是你拥有的全部卡牌 —— 不能挑着不带，也不能只带两张。') }),
        el('li', { html: t('想让卡组更精：去商店买<code>卡牌移除服务</code>删掉不要的牌，同一家店里越删越贵（最多删到剩 3 张）。') }),
        el('li', { html: t('想换牌：营地的<code>冥想</code>能把一张牌换成随机的高稀有度牌（只能二选一，不能又休息又冥想）。') }),
        el('li', { text: t('卡组越薄 → 越容易每回合抽到关键牌；越厚 → 每回合能打出的总量上限更高，但抽得散。') }),
        el('li', { text: t('卡组一览里可以排序、点开单卡看详情，每种卡带了几张会标成 ×N，还能展开卡牌图鉴看收集进度。') }),
      ]),
    ]),
    el('div', { class: 'help-card' }, [
      el('h4', { text: t('快捷键') }),
      el('ul', {}, [
        el('li', { html: t('<code>1</code> ~ <code>9</code> 打出手牌中第 N 张。') }),
        el('li', { html: t('<code>空格</code> 结束回合。') }),
        el('li', { html: t('<code>D</code> 打开卡组一览（只读：能排序、看详情、看图鉴）。') }),
        el('li', { html: t('<code>I</code> 打开背包（喝药在这里）。') }),
        el('li', { html: t('<code>E</code> 打开敌人图鉴（打之前先看看对面会什么）。') }),
        el('li', { html: t('<code>C</code> 打开卡牌图鉴（看卡牌的收集进度）。') }),
        el('li', { html: t('<code>H</code> 或 <code>?</code> 打开这一页。') }),
        el('li', { html: t('<code>Esc</code> 关闭弹窗（叠了好几层时只关最上面那层）。') }),
      ]),
    ]),
    el('div', { class: 'help-card' }, [
      el('h4', { text: t('关于素材') }),
      el('ul', {}, [
        el('li', { text: t('宝可梦精灵图与表情头像来自 PMDCollab/SpriteCollab（各作者署名见仓库 credits.txt）。') }),
        el('li', { text: t('回合切换立绘来自 Generation 9 Pack（正面 / 背面图）。') }),
        el('li', { text: t('界面图标、面板、音效、粒子来自 Kenney 素材包与 Game-Icon-Pack（都是 CC0）。') }),
        el('li', { text: t('BGM 来自「音楽の卵」(ontama-m.com) 与「龍的交響楽」(d-symphony.com)：两家都允许免费使用（含商用）、无需报告；后者唯一的要求是在名单里标注「龍的交響楽」—— 标题页的「曲子库」里列出了每首曲子的出处与链接。') }),
        el('li', { text: t('宝可梦译名以 52poke 神奇宝贝百科为准。') }),
        el('li', { text: t('非商业同人练习作品。') }),
      ]),
    ]),
  ]);
  return modal({ title: t('沙漠精灵 · 玩法说明'), body, wide: true });
}

// ============================================================
// 设置
// ============================================================
export function showSettings() {
  const body = el('div', {});
  const musicState = () => {
    const key = music.nowPlaying();
    return key ? t('正在播放：{name}', { name: BGM_NAMES[key] ?? key }) : t('（未播放）');
  };

  body.append(
    /**
     * 语言切换放在设置的**第一行**：它是最常被找的一项（看不懂界面的人第一件事就是找它）。
     * 标题页上还有一份（同一套按钮），两份都调同一个 changeLanguage()。
     */
    el('div', { class: 'setting-row' }, [
      el('label', { text: t('语言 / Language / 言語') }),
      el('div', { class: 'lang-switch' }, LANGS.map((l) => el('button', {
        class: `lang-btn${l.id === currentLang() ? ' on' : ''}`,
        onClick: () => {
          audio.ui('click');
          // 换语言会重画界面（弹窗会被关掉），所以要在切换前先关掉这一层
          document.querySelector('.modal-backdrop')?.remove();
          changeLanguage(l.id);
          toast(t('语言已切换：{name}', { name: l.name }), 'good');
        },
      }, [l.name]))),
    ]),
    el('div', { class: 'setting-row' }, [
      el('label', { text: t('音效音量') }),
      el('input', {
        type: 'range', min: '0', max: '100', value: String(Math.round(audio.sfxVolume * 100)),
        onInput: (e) => audio.setSfxVolume(Number(e.target.value) / 100),
      }),
    ]),
    el('div', { class: 'setting-row' }, [
      el('label', { text: t('BGM 音量') }),
      el('input', {
        type: 'range', min: '0', max: '100', value: String(Math.round(audio.musicVolume * 100)),
        onInput: (e) => audio.setMusicVolume(Number(e.target.value) / 100),
      }),
    ]),
    el('div', { class: 'setting-row' }, [
      el('label', {}, [
        t('当前曲目'),
        el('br'),
        el('span', { class: 'setting-hint', text: t('想听别的曲子？标题页的「曲子库」里，听过的都能点着试听。') }),
      ]),
      el('span', { class: 'setting-value', id: 'setting-now-playing', text: musicState() }),
    ]),
    el('div', { class: 'setting-row' }, [
      el('label', { text: t('声音开关（音效 + BGM）') }),
      el('button', {
        class: 'btn btn-sm',
        onClick: (e) => {
          const on = audio.toggle();
          e.currentTarget.textContent = on ? t('已开启') : t('已静音');
          body.querySelector('#setting-now-playing').textContent = musicState();
        },
      }, [audio.enabled ? t('已开启') : t('已静音')]),
    ]),
    /**
     * 专家模式：卡面上直接标出「威力 / 实际伤害 / 护盾（吃自己的防御）/ 抽牌 / 每 AP 多少伤害」。
     * 默认关闭 —— 这些数字对新手是噪音，对算牌的人是刚需（用户要求）。
     * 开关存 localStorage（本机偏好，和音量 / 战斗速度一类），改完通知订阅者重画界面，
     * 否则关掉设置面板之后屏幕上的卡面还是旧的。
     */
    el('div', { class: 'setting-row' }, [
      el('label', {}, [
        t('专家模式：卡面显示详细数值'),
        el('br'),
        el('span', { class: 'setting-hint', text: t('打开后卡面上会多一行小字：威力%、实际伤害、护盾（含防御加成）、抽牌、每点 AP 的效率。') }),
      ]),
      el('button', {
        class: 'btn btn-sm',
        onClick: (e) => {
          const on = setExpertEnabled(!expertEnabled());
          e.currentTarget.textContent = on ? t('已开启') : t('已关闭');
          toast(on ? t('专家模式已开启：卡面会显示详细数值。') : t('专家模式已关闭。'), 'good');
        },
      }, [expertEnabled() ? t('已开启') : t('已关闭')]),
    ]),
    el('div', { class: 'setting-row' }, [
      el('label', { text: t('战斗演出速度') }),
      // 必须给对应的 option 加 selected，否则界面显示的选择和实际速度会对不上。
      el('select', {
        style: { minHeight: '36px', borderRadius: '8px', padding: '4px 8px', background: '#241610', color: '#f7ecd6', border: '1px solid rgba(232,207,162,.3)' },
        onChange: (e) => {
          const v = e.target.value;
          try { localStorage.setItem(BATTLE_SPEED_KEY, v); } catch { /* 忽略 */ }
          toast(t('战斗演出速度：{label}（下场战斗生效）', { label: t(SPEED_OPTIONS.find((o) => o.key === v)?.label ?? v) }), 'good');
        },
      }, SPEED_OPTIONS.map((o) => el('option', {
        value: o.key,
        text: t(o.label),
        selected: o.key === loadBattleSpeed(),
      }))),
    ]),
    el('div', { class: 'setting-row' }, [
      el('label', { text: t('导出存档') }),
      el('button', {
        class: 'btn btn-sm',
        onClick: () => {
          const data = save.readRun();
          if (!data) return toast(t('当前没有进行中的存档。'), 'bad');
          save.exportFile(data);
          toast(t('已导出 oasis-save.json'), 'good');
        },
      }, [t('导出 JSON')]),
    ]),
    el('div', { class: 'setting-row' }, [
      el('label', { text: t('清空存档') }),
      el('button', {
        class: 'btn btn-sm btn-danger',
        onClick: () => { save.clearRun(); toast(t('存档已清空。'), 'good'); },
      }, [t('删除进度')]),
    ]),
    /**
     * 这里以前还有一个「切换 BGM（试听）」下拉框：它把 41 首曲子的名字
     * （连上游的日文原名）全列了出来 —— 一进设置就被剧透干净，而且和
     * 「玩过什么就收什么」的思路正相反。现在挪去标题页的**曲子库**了：
     * 听过的才显示名字、才能试听。
     */
    el('div', { class: 'setting-row' }, [
      el('label', { text: t('BGM 出处') }),
      el('span', {
        class: 'setting-value',
        text: t('免费素材：{a}（{aSite}）与 {b}（{bSite}）—— 前者个人/法人均可免费使用、无需报告、可商用；后者同样免费，只要求在名单里标注「{b}」。出处与链接在标题页的「曲子库」里。', {
          a: BGM_CREDITS.ontama?.name ?? 'ontama', aSite: BGM_CREDITS.ontama?.site ?? '',
          b: BGM_CREDITS.dsymphony?.name ?? 'd-symphony', bSite: BGM_CREDITS.dsymphony?.site ?? '',
        }),
      }),
    ]),
  );

  return modal({ title: t('设置'), body });
}
