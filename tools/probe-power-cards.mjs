// 诊断：**「本场战斗威力 +N%」到底让输出涨了多少**（用户报「百分比加威力的卡太强大，拿到就是碾压」）。
//
// 为什么要这样量：直接拿模拟器测「往卡组里塞一张」是量不出来的 ——
// ① 换一张牌就换了洗牌顺序，噪声比效果还大；② 模拟器的贪心 AI 给强化牌的分很低
// （scoreCard 里 strength 最多 +8 分），它**根本不会去用**这些牌，于是测出来永远是负收益。
// 真人玩家会「先挂强化、再全力输出」，所以这里**强制**第一回合先打出那张强化牌，
// 之后按贪心输出，比 6 个回合的总伤害。
//
// 用法: node tools/probe-power-cards.mjs [每回合的牌数] [回合数]
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '..');
const imp = (rel) => import(pathToFileURL(path.join(ROOT, rel)).href);
globalThis.localStorage = { _m: new Map(), getItem: () => null, setItem: () => {}, removeItem: () => {} };

const { Battle } = await imp('src/core/battle.js');
const { BALANCE } = await imp('src/data/balance.js');
const { CARD_BY_ID } = await imp('src/data/cards.js');

const TURNS = Number(process.argv[2] ?? 6);
/** 第 5 章的标准面板 */
const P = { atk: 50, def: 39, maxHp: 430, agi: 24, luck: 0 };

/** 一张「基准攻击牌」：2 费、威力 190（费用曲线上的中档牌） */
const ATTACK = Object.values(CARD_BY_ID).find((c) => !c.enemyOnly && c.ap === 2 && c.rarity === 'uncommon'
  && (c.effects ?? []).length === 1 && c.effects[0].kind === 'damage' && c.effects[0].power === 190);
if (!ATTACK) { console.error('找不到 2 费 190 威力的纯伤害牌'); process.exit(1); }

const BOOSTS = Object.values(CARD_BY_ID).filter((c) => !c.enemyOnly
  && (c.effects ?? []).some((e) => e.kind === 'strength' || (e.kind === 'grantBuff' && e.buff === 'power')));
BOOSTS.sort((a, b) => a.ap - b.ap);

function makeBattle(deck) {
  return new Battle({
    seed: 20240901,
    player: { name: 'P', slug: 'flygon', hp: P.maxHp, maxHp: P.maxHp, atk: P.atk, def: P.def, agi: P.agi, luck: 0 },
    deck,
    enemy: { id: 'e', slug: 'sandile', name: 'E', maxHp: 99999, atk: 1, def: 13, agi: 5, luck: 0, tier: 'mob', deck: ['harden'] },
  });
}
const put = (b, id, n = 1) => { for (let i = 0; i < n; i += 1) b.decks.player.hand.push({ uid: `${id}-${i}-${Math.random()}`, id, card: CARD_BY_ID[id] }); };

/** 打 TURNS 个回合：`first` 是必须在第 1 回合先打出去的那张强化牌（null = 不挂） */
function totalDamage(first) {
  const deck = Array.from({ length: 30 }, () => ATTACK.id);
  const b = makeBattle(deck);
  b.start();
  b.takeEvents();
  let dealt = 0;
  for (let t = 0; t < TURNS; t += 1) {
    // 手上一定够牌：直接塞满（每回合都把强化牌 + 攻击牌放进手里）
    put(b, ATTACK.id, 6);
    b.player.ap = 20;                    // 行动点不设限：量的是「牌的性价比」，不是 AP 预算
    b.player.playsLeft = 20;
    if (t === 0 && first) put(b, first, 1);
    let guard = 0;
    while (!b.over && guard++ < 30) {
      const hand = b.hand('player').filter((c) => b.canPlay(c.uid));
      if (!hand.length) break;
      // 第 1 回合先把强化牌打掉，其余按贪心
      const pick = (t === 0 && first) ? hand.find((c) => c.id === first) : null;
      const chosen = pick ?? hand.map((c) => ({ c, s: b.scoreCard('player', c.card) })).sort((a, x) => x.s - a.s)[0].c;
      if (!b.playCard(chosen.uid).ok) break;
      for (const ev of b.takeEvents()) {
        if ((ev.type === 'damage' || ev.type === 'trueDamage') && ev.side === 'enemy') dealt += ev.amount;
      }
    }
    b.takeEvents();
    if (t < TURNS - 1) { b.endTurn(); b.takeEvents(); b.player.hp = b.player.maxHp; }
  }
  return dealt;
}

const base = totalDamage(null);
console.log(`第 5 章面板（攻 ${P.atk} / 防 ${P.def} / 敏 ${P.agi}），基准牌「${ATTACK.name}」（2 费 威力 190）`);
console.log(`${TURNS} 个回合的总伤害：不挂强化 = ${base}`);
console.log('');
console.log('  卡名            费用 稀有度 效果                      总伤害    相对基准   每 AP 多打');
for (const card of BOOSTS) {
  const d = totalDamage(card.id);
  const eff = (card.effects ?? []).map((e) => (e.kind === 'strength'
    ? `力量+${e.n}%（永久）`
    : `威力+${e.n}%（${e.turns ?? 3} 回合）`)).join(' + ');
  console.log(`  ${String(card.name).padEnd(12)} ${String(card.ap).padStart(2)}费 ${String(card.rarity).padEnd(8)} ${eff.padEnd(22)} ${String(d).padStart(6)}   ${((d / base - 1) * 100 >= 0 ? '+' : '') + ((d / base - 1) * 100).toFixed(0)}%   ${((d - base) / Math.max(1, card.ap)).toFixed(0)}`);
}
console.log('');
console.log('对照：一张 2 费 190 威力的普通攻击牌，打出去大约相当于总伤害 +' +
  ((ATTACK.effects[0].power * P.atk / 100 * (BALANCE.armorK / (BALANCE.armorK + 13))) / base * 100).toFixed(1) + '%');
