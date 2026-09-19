// 诊断：一章里敌人打掉的血，到底是哪些牌打出来的？（按卡牌拆开算）
//
// 起因：首领的「每点攻击的杀伤力」比精英高 1.68 倍，导致
// 「攻击力逐档递增」和「每回合压力达标」两个目标互相打架 ——
// 要给首领凑出和精英一样的攻击力，它的压力就得飙到 30%+。
// 这一份把伤害来源按牌拆开，看清楚多出来的那一截到底是什么。
//
// 用法: node tools/probe-enemy-damage.mjs [章节] [档位] [场数]
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '..');
const imp = (rel) => import(pathToFileURL(path.join(ROOT, rel)).href);
globalThis.localStorage = { _m: new Map(), getItem: () => null, setItem: () => {}, removeItem: () => {} };

const { Game } = await imp('src/core/game.js');
const { STAGE_BIOME } = await imp('src/data/balance.js');
const { STARTER_DECK, rollCard, CARD_BY_ID } = await imp('src/data/cards.js');

const stage = Number(process.argv[2] ?? 5);
const tier = process.argv[3] ?? 'boss';
const runs = Number(process.argv[4] ?? 12);
const kind = tier === 'mob' || tier === 'normal' ? 'normal' : tier;
const GROWTH = [
  { atk: 12, def: 12, maxHp: 200, agi: 10, luck: 5, deck: 10 },
  { atk: 22, def: 19, maxHp: 270, agi: 15, luck: 9, deck: 16 },
  { atk: 32, def: 27, maxHp: 330, agi: 19, luck: 12, deck: 21 },
  { atk: 42, def: 33, maxHp: 380, agi: 22, luck: 14, deck: 26 },
  { atk: 50, def: 39, maxHp: 430, agi: 24, luck: 16, deck: 30 },
  { atk: 57, def: 44, maxHp: 470, agi: 24, luck: 18, deck: 34 },
][stage];
const buildDeck = (size) => {
  const out = STARTER_DECK.slice(0, size);
  let g = 0;
  while (out.length < size && g++ < 200) out.push(rollCard(0.12, []).id);
  return out;
};
function autoPlay(b, sink) {
  let g = 0;
  while (!b.over && g++ < 24) {
    const hand = b.hand('player').filter((c) => b.canPlay(c.uid));
    if (!hand.length) break;
    const best = hand.map((c) => ({ c, s: b.scoreCard('player', c.card) })).sort((a, x) => x.s - a.s)[0];
    if (best.s <= 0) break;
    if (!b.playCard(best.c.uid).ok) break;
    for (const ev of b.takeEvents()) sink?.(ev);
  }
}

const byCard = new Map();
const byKind = { hit: 0, dot: 0, detonate: 0, crit: 0 };
let turns = 0, n = 0, atkSum = 0, hpSum = 0;
for (let i = 0; i < runs * 10 && n < runs; i++) {
  const game = new Game({ seed: 555000 + i * 17 });
  game.newRun();
  Object.assign(game.data, { ...GROWTH, hp: GROWTH.maxHp, stage });
  game.data.map.biome = STAGE_BIOME[stage];
  game.data.deck = buildDeck(GROWTH.deck);
  game.data.battleDeck = null;
  game.startBattle(kind, 4);
  const b = game.battle;
  if (b.enemy.tier !== tier) continue;
  n += 1;
  // FORCE_ATK：把三档的攻击力都钉成同一个数，用来单独比较**卡组本身的杀伤力**
  if (process.env.FORCE_ATK) b.enemy.atk = Number(process.env.FORCE_ATK);
  atkSum += b.enemy.atk;
  hpSum += b.enemy.maxHp;
  let cur = '(开场)';
  let t = 0;
  const sink = (ev) => {
    if (ev.type === 'playCard' && ev.side === 'enemy') cur = CARD_BY_ID[ev.id]?.name ?? ev.id;
    if ((ev.type === 'damage' || ev.type === 'trueDamage') && ev.side === 'player') {
      byCard.set(cur, (byCard.get(cur) ?? 0) + ev.amount);
      if (ev.type === 'trueDamage') byKind.dot += ev.amount;
      else byKind.hit += ev.amount;
      if (ev.crit) byKind.crit += ev.amount;
    }
  };
  while (!b.over && t < 8) {
    if (b.active === 'player') { t += 1; autoPlay(b, sink); }
    for (const ev of b.takeEvents()) sink(ev);
    if (t >= 8) break;
    b.endTurn();
    for (const ev of b.takeEvents()) sink(ev);
  }
  turns += t;
}
const total = [...byCard.values()].reduce((a, c) => a + c, 0);
console.log(`第 ${stage + 1} 章 ${tier}：平均 攻击 ${(atkSum / n).toFixed(0)} / 血 ${(hpSum / n).toFixed(0)}，${n} 场`);
console.log(`  每回合打掉 ${(total / turns).toFixed(0)} 点（占玩家最大生命 ${(total / turns / GROWTH.maxHp * 100).toFixed(1)}%）`);
console.log(`  其中：普通命中 ${(byKind.hit / total * 100).toFixed(0)}% · 持续伤害 ${(byKind.dot / total * 100).toFixed(0)}% · 暴击部分占 ${(byKind.crit / total * 100).toFixed(0)}%`);
console.log('  按牌拆开（前 12）：');
for (const [name, dmg] of [...byCard.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12)) {
  const c = Object.values(CARD_BY_ID).find((x) => x.name === name);
  const power = (c?.effects ?? []).filter((e) => e.kind === 'damage').reduce((s, e) => s + e.power * (e.hits ?? 1), 0);
  const extra = (c?.effects ?? []).filter((e) => ['status', 'detonate'].includes(e.kind)).map((e) => e.status ?? 'detonate').join(',');
  console.log(`    ${String(name).padEnd(12)} ${String(Math.round(dmg)).padStart(6)} 点（${(dmg / total * 100).toFixed(0)}%）威力 ${power}% ${extra ? '附加:' + extra : ''}`);
}
