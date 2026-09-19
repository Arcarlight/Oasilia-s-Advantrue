// 弹窗类界面：卡组 / 出战卡牌、背包、帮助、设置

import { el, clear, modal, toast } from './dom.js';
import { SORT_MODES } from './cardtext.js';
import { audio } from '../core/audio.js';
import { music } from '../core/bgm.js';
import { BALANCE, apFromAgi, drawFromAgi, handFromAgi, playsFromAgi, critChance, dodgeChance, SPEED_OPTIONS, BATTLE_SPEED_KEY, loadBattleSpeed } from '../data/balance.js';
// itemEffect / inventoryEntries：道具有没有「主动使用」的效果、背包里哪些真的还有 ——
// 背包界面和引擎共用这两份判断，别在界面里自己抄一遍数据模型的规则
// （抄漏过一次：判断写的是 `item.heal` 而数据字段叫 `healPct`，整个背包一个按钮都没有）
import { itemEffect, inventoryEntries } from '../core/game.js';
import { CARD_BY_ID, CARDS, ITEMS } from '../data/cards.js';
// 说明页里「一共几章」也从地图生成器现问，别再手写（曾经写成「三章」，而实际是 6 章）
import { stageCount } from '../data/mapgen.js';
import { save } from '../core/save.js';
import { BGM_NAMES } from '../core/bgm.js';
import { t, LANGS, currentLang } from '../core/i18n.js';
import { changeLanguage } from './langswitch.js';
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
      body.append(el('p', { text: t('背包是空的。地图上的宝箱和商店会给你补货。') }));
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
            toast(res?.text ?? t('现在用不了。'), 'bad');
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
                  dataset: blocked ? { tip: t('HP 已经满了，喝了也是浪费 —— 受伤之后再来。') } : null,
                  onClick: use,
                }, [blocked ? t('HP 已满') : t('使用')])
              : el('span', { class: 'price', dataset: { tip: t('这类道具拿到手就已经生效了，不需要使用。') } }, [t('已生效')]),
          ]),
        ]));
      }
      body.append(list);
    }
    body.append(el('div', { class: 'help-card', style: { marginTop: '12px' } }, [
      el('h4', { text: t('道具怎么用') }),
      el('ul', {}, [
        el('li', { text: t('药水留在背包里，想什么时候喝就点「使用」——不占出牌次数，战斗中也随时能用（按 I 打开背包）。') }),
        el('li', { html: t('护符 / 活力药这类「本局 +N」的道具，<b>拿到手就自动生效</b>了，不会留在背包里。') }),
      ]),
    ]));
    body.append(el('div', { class: 'help-card', style: { marginTop: '12px' } }, [
      el('h4', { text: t('地图上的回血方式') }),
      el('ul', {}, [
        // 数字全部现算：这几条以前写死成 35% / 4%，和 BALANCE 里的 40% / 12% 早就对不上了
        el('li', { text: t('绿洲营地：回复最大生命的 {pct}%（营地还可以把一张卡换成更强的卡）。', { pct: Math.round(BALANCE.restHealPct * 100) }) }),
        el('li', { text: t('卡牌：羽栖、文柚果、急救等回复类卡牌，战斗中随时可用。') }),
        el('li', { text: t('事件：不少选项能直接回血，或者提升最大生命。') }),
        el('li', { text: t('每场战斗胜利后自动回复最大生命的 {pct}%。', { pct: Math.round(BALANCE.healAfterBattlePct * 100) }) }),
        el('li', { text: t('走到首领节点前会先自动回复 {pct}% 生命。', { pct: Math.round(BALANCE.preBossHealPct * 100) }) }),
      ]),
    ]));
  };
  paint();
  return modal({ title: t('背包与补给'), body: wrap, wide: true });
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
        el('li', { text: t('BGM 来自「音楽の卵」(ontama-m.com)：个人/法人均可免费使用、无需报告、无需署名、可商用。') }),
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
  const nowPlaying = el('span', { style: { opacity: '.7', fontSize: '12px' }, text: t('（未播放）') });
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
      el('label', {}, [t('当前曲目'), el('br'), nowPlaying]),
      el('button', {
        class: 'btn btn-sm',
        onClick: () => { nowPlaying.textContent = musicState(); },
      }, [t('刷新')]),
    ]),
    el('div', { class: 'setting-row' }, [
      el('label', { text: t('声音开关（音效 + BGM）') }),
      el('button', {
        class: 'btn btn-sm',
        onClick: (e) => {
          const on = audio.toggle();
          e.currentTarget.textContent = on ? t('已开启') : t('已静音');
          nowPlaying.textContent = musicState();
        },
      }, [audio.enabled ? t('已开启') : t('已静音')]),
    ]),
    el('div', { class: 'setting-row' }, [
      el('label', { text: t('战斗演出速度') }),
      // 注意：<select> 上写 value 属性是没用的（属性不会选中 option），
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
      el('label', { text: t('切换 BGM（试听）') }),
      el('select', {
        style: { minHeight: '36px', borderRadius: '8px', padding: '4px 8px', background: '#241610', color: '#f7ecd6', border: '1px solid rgba(232,207,162,.3)' },
        onChange: (e) => { audio.playBgm(e.target.value, { restart: true }); nowPlaying.textContent = musicState(); },
      }, Object.entries(BGM_NAMES).map(([k, name]) => el('option', { value: k, text: `${name}（${k}）` }))),
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
    el('div', { class: 'setting-row' }, [
      el('label', { text: t('BGM 出处') }),
      el('span', { style: { fontSize: '12px', opacity: '.75', textAlign: 'right' }, text: t('音楽の卵 (ontama-m.com)：免费使用、无需报告、可商用') }),
    ]),
  );

  // 打开时顺手刷新一下当前曲目
  setTimeout(() => { nowPlaying.textContent = musicState(); }, 0);

  return modal({ title: t('设置'), body });
}
