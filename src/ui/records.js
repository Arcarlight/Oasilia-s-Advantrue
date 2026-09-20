// 通关记录：跨局战绩一览（标题页 / 结算页的「通关记录」按钮进来）。
//
// ── 为什么记的是「id 与数字」，不是一段现成的文字 ─────────────────────
// 每一条记录里存的是：走到第几章、多少步、击败几只、整副卡牌的 **id**、
// 六张地图的 **key**、最后那只怪的 **id**。
// 名字一律现查 —— 卡名 / 地图名 / 物种名都是「切语言就地改写」的字段，
// 记下来就会冻在写下那一局时的语言里（玩家切成日语，老记录还留着中文名字）。

import { el, clear, modal, toast } from './dom.js';
import { cardEl } from './cards.js';
import { CARD_BY_ID } from '../data/cards.js';
import { ENEMY_BY_ID } from '../data/enemies.js';
import { BIOMES } from '../data/balance.js';
import { save, HISTORY_MAX } from '../core/save.js';
import { t, currentLang } from '../core/i18n.js';
import { stageCount } from '../data/mapgen.js';
import { audio } from '../core/audio.js';

/** 日期/时间按当前语言显示（免得为了「年月日」再翻一张表） */
const LOCALE = { zh: 'zh-CN', ja: 'ja-JP', en: 'en-US' };

function fmtTime(at) {
  try {
    const d = new Date(at);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString(LOCALE[currentLang()] ?? 'zh-CN', {
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return '';
  }
}

/** 这一台机器上记着的战绩（最新的在前） */
export function runRecords() {
  return save.readMeta().history ?? [];
}

/** 标题页按钮上的那个数字 */
export function runCount() {
  const meta = save.readMeta();
  return (meta.runs ?? 0) + (meta.wins ?? 0);
}

/**
 * 汇总数字。
 *
 * 前四项是**终身累计**（这几颗计数器从最早的版本就在写，包含这个功能上线之前的局），
 * 「最快通关」只能从明细里算（所以它只覆盖最近 HISTORY_MAX 局，界面上也这么写）。
 */
export function recordsSummary(meta = save.readMeta()) {
  const history = meta.history ?? [];
  const wins = history.filter((r) => r.win);
  return {
    runs: (meta.runs ?? 0) + (meta.wins ?? 0),
    wins: meta.wins ?? 0,
    kills: meta.kills ?? 0,
    bestStage: Math.max(meta.bestStage ?? 0, ...history.map((r) => r.stage ?? 0), 0),
    fastest: wins.length ? Math.min(...wins.map((r) => r.steps ?? 0)) : 0,
    listed: history.length,
  };
}

// ============================================================
// 记录页
// ============================================================
export function showRecords() {
  const body = el('div', {});
  const paint = () => {
    clear(body);
    const meta = save.readMeta();
    const history = meta.history ?? [];
    const s = recordsSummary(meta);

    body.append(el('div', { class: 'run-stats rec-stats' }, [
      statBox(t('总场次'), s.runs),
      statBox(t('通关次数'), s.wins),
      statBox(t('最远章节'), s.bestStage ? t('第 {n} 章', { n: s.bestStage }) : t('—')),
      statBox(t('累计击败'), s.kills),
      statBox(t('最快通关'), s.fastest ? t('{n} 步', { n: s.fastest }) : t('—')),
    ]));

    if (!history.length) {
      body.append(el('p', {
        class: 'rec-empty',
        text: t('还没有记录。打完一局（通关或者被打回家）就会记在这里。'),
      }));
      body.append(helpCard());
      return;
    }

    const list = el('div', { class: 'rec-list' });
    for (const entry of history) list.append(recordRow(entry));
    body.append(list);

    body.append(el('div', { class: 'rec-foot' }, [
      el('span', {
        class: 'rec-note',
        text: t('明细最多留最近 {n} 局（只存在这台机器上，换浏览器就没了）。', { n: HISTORY_MAX }),
      }),
      clearButton(paint),
    ]));
  };

  function clearButton(repaint) {
    let armed = false;
    const btn = el('button', { class: 'btn btn-sm btn-danger' }, [t('清空记录')]);
    btn.addEventListener('click', () => {
      // 两步确认：清记录是不可撤销的，顺手点一下就没了太亏
      if (!armed) {
        armed = true;
        btn.textContent = t('再点一次确认清空');
        setTimeout(() => { armed = false; btn.textContent = t('清空记录'); }, 4000);
        return;
      }
      save.clearHistory();
      toast(t('通关记录已清空（图鉴收集进度没动）。'), 'good');
      audio.ui('click2');
      repaint();
    });
    return btn;
  }

  paint();
  return modal({ title: t('通关记录'), wide: true, body });
}

function statBox(label, value) {
  return el('div', { class: 'run-stat' }, [el('b', { text: String(value) }), el('span', { text: label })]);
}

function helpCard() {
  return el('div', { class: 'help-card', style: { marginTop: '12px' } }, [
    el('h4', { text: t('记录里都记了什么') }),
    el('ul', {}, [
      el('li', { text: t('每一局：走到第几章、多少步、击败几只、最后对上谁、走过哪几张地图。') }),
      el('li', { text: t('点「看卡组」能翻出那一局最后带着的那副牌。') }),
      el('li', { text: t('记录只存在这台机器上，和存档一样。') }),
    ]),
  ]);
}

function recordRow(entry) {
  const foe = entry.foe ? ENEMY_BY_ID[entry.foe] : null;
  const biomes = (entry.biomes ?? []).filter((k) => BIOMES[k]);

  const main = el('div', { class: 'rec-main' }, [
    // 「第 N 章」用现成的文案，别再拼一个新句子（少一条要翻的话）
    el('div', { class: 'rec-title' }, [
      el('span', { text: t('第 {n} 章', { n: entry.stage ?? 1 }) }),
      el('span', { class: 'rec-dot', text: '·' }),
      el('span', { text: t('{n} 步', { n: entry.steps ?? 0 }) }),
      el('span', { class: 'rec-dot', text: '·' }),
      el('span', { text: t('击败 {n}', { n: entry.kills ?? 0 }) }),
      foe ? el('span', { class: 'rec-dot', text: '·' }) : null,
      foe ? el('span', { text: t('最后一战：{name}', { name: foe.name }) }) : null,
    ]),
    biomes.length
      ? el('div', { class: 'rec-biomes' }, biomes.map((k) => el('span', {
          class: 'rec-biome',
          dataset: { tip: BIOMES[k].desc },
        }, [
          el('span', { class: 'rec-biome-dot', style: { background: BIOMES[k].accent ?? '#f0b95c' } }),
          el('span', { text: BIOMES[k].name }),
        ])))
      : null,
    el('div', { class: 'rec-when' }, [
      el('span', { text: fmtTime(entry.at) }),
      entry.seed != null ? el('span', { class: 'rec-seed', text: t('种子 {n}', { n: entry.seed }) }) : null,
    ]),
  ]);

  return el('div', { class: `rec-row ${entry.win ? 'win' : 'down'}` }, [
    el('div', { class: 'rec-badge', text: entry.win ? t('通关') : t('止步') }),
    /**
     * 无尽模式那一局单独标一下：它没有「通关 / 止步」这回事 ——
     * 成绩就是「走到第几章」（见 game.js 的 runSummary.endless）。
     */
    entry.endless ? el('div', {
      class: 'rec-badge endless',
      dataset: { tip: t('无尽模式：没有终点，走到哪算哪。') },
    }, [t('无尽')]) : null,
    main,
    el('button', {
      class: 'btn btn-sm btn-ghost',
      onClick: () => { audio.ui('open'); showRunDetail(entry); },
    }, [t('看卡组')]),
  ]);
}

/** 一局记录的详情：最后的卡组 + 收尾时的面板 */
export function showRunDetail(entry) {
  const body = el('div', {});
  body.append(el('div', { class: 'run-stats rec-stats' }, [
    statBox(t('推进章节'), `${entry.stage ?? 1} / ${stageCount()}`),
    statBox(t('抵达步数'), entry.steps ?? 0),
    statBox(t('击败对手'), entry.kills ?? 0),
    statBox(t('战斗回合'), entry.turns ?? 0),
    statBox(t('最终攻击'), entry.atk ?? 0),
    statBox(t('最终防御'), entry.def ?? 0),
    statBox(t('最终敏捷'), entry.agi ?? 0),
    statBox(t('最终幸运'), entry.luck ?? 0),
    statBox(t('金币结余'), entry.gold ?? 0),
    statBox(t('生命'), `${entry.hp ?? 0} / ${entry.maxHp ?? 0}`),
  ]));

  const deck = (entry.deck ?? []).map((id) => CARD_BY_ID[id]).filter(Boolean);
  body.append(el('h4', { class: 'rec-deck-title', text: t('这一局最后带着的卡组（{n} 张）', { n: deck.length }) }));
  if (!deck.length) {
    body.append(el('p', { class: 'rec-empty', text: t('这一局没有记下卡组。') }));
  } else {
    // 同一张牌只画一张，右上角标 ×N
    const counts = new Map();
    for (const id of entry.deck) counts.set(id, (counts.get(id) ?? 0) + 1);
    const grid = el('div', { class: 'card-grid' });
    for (const [id, n] of counts) {
      const card = CARD_BY_ID[id];
      if (!card) continue;
      grid.append(cardEl(card, { size: 'sm', badges: n > 1 ? [`×${n}`] : [] }));
    }
    body.append(grid);
  }

  return modal({ title: t('这一局的记录'), wide: true, body });
}
