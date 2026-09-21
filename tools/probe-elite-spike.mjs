// 诊断：**一章里精英怪的一回合爆发有多高**（用户报「最后一关的精英怪 400 伤害/回合把人推死」）。
//
// 背景：敌人的伤害 = 攻击 × (威力 + 力量) ÷ 100 × 减伤。精英的牌组里有「过热」这种
// **打伤害顺便加 120% 力量**的牌（牌组里可能有两三张），一旦抽到并打出来，后面每一张牌
// 的威力都 +120%（上限 +200%），于是同一回合里的第二、三张牌伤害翻倍。
// 玩家在终章的血量大约 470，被这么打一下就是「一回合掉 400」。
//
// 这一份把**每一回合敌人打出的伤害**都记下来，报：
//   · 每回合平均 / 中位数 / 最高；
//   · 有多少比例的回合超过「玩家最大生命的 50% / 70%」；
//   · 赢的那一局玩家用了几个回合（也就是「先手够不够快」）；
//   · 被打死的局里，敌人是哪一只（用户遇到的是水晶灯火灵）。
//
// 用法: node tools/probe-elite-spike.mjs [章节] [档位] [场数] [hero]
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
const tier = process.argv[3] ?? 'elite';
const runs = Number(process.argv[4] ?? 200);
const HERO = process.argv[5] && !process.argv[5].startsWith('--') ? process.argv[5] : null;
const NODE = Number((process.argv.find((a) => a.startsWith('--node=')) ?? '--node=8').slice(7));

/**
 * 「这一章的玩家大致长什么样」——和 tools/probe-enemy-damage.mjs 用同一套曲线
 * （那是按「每章该有的成长」推的），再叠上主角自己的初始值与地图长度差异。
 */
const GROWTH = [
  { atk: 12, def: 12, maxHp: 200, agi: 10, luck: 5, deck: 10 },
  { atk: 22, def: 19, maxHp: 270, agi: 15, luck: 9, deck: 16 },
  { atk: 32, def: 27, maxHp: 330, agi: 19, luck: 12, deck: 21 },
  { atk: 42, def: 33, maxHp: 380, agi: 22, luck: 14, deck: 26 },
  { atk: 50, def: 39, maxHp: 430, agi: 24, luck: 16, deck: 30 },
  { atk: 57, def: 44, maxHp: 470, agi: 24, luck: 18, deck: 34 },
][stage];

function autoPlay(b) {
  let g = 0;
  while (!b.over && g++ < 24) {
    const hand = b.hand('player').filter((c) => b.canPlay(c.uid));
    if (!hand.length) break;
    const best = hand.map((c) => ({ c, s: b.scoreCard('player', c.card) })).sort((a, x) => x.s - a.s)[0];
    if (best.s <= 0) break;
    if (!b.playCard(best.c.uid).ok) break;
    b.takeEvents();
  }
}

const perTurn = [];            // 敌人每回合打出的伤害
const deaths = new Map();      // 玩家死在哪只手里
let wins = 0; let losses = 0; let turnToKill = [];
let over30 = 0; let over50 = 0; let over70 = 0; let turns = 0;
let guard = 0;
for (let i = 0; guard < runs * 12 && (wins + losses) < runs; i += 1) {
  guard += 1;
  const game = new Game({ seed: 700000 + i * 37 });
  game.newRun(undefined, HERO ? { hero: HERO } : {});
  Object.assign(game.data, { ...GROWTH, hp: GROWTH.maxHp, stage });
  game.data.map.biome = STAGE_BIOME[stage];
  game.data.deck = [...STARTER_DECK, ...Array.from({ length: GROWTH.deck - STARTER_DECK.length }, () => rollCard(0.12, [], null, game.data.hero).id)];
  game.data.battleDeck = null;
  game.startBattle(tier === 'boss' ? 'boss' : tier === 'normal' ? 'normal' : 'elite', NODE);
  const b = game.battle;
  if (b.enemy.tier !== tier) continue;
  // NOGREEDY=1：把精英的「贪心出牌」关掉，用来量**这个 AI 改了多少压力**
  if (process.env.NOGREEDY) b._eliteGreedy = false;
  const maxHp = GROWTH.maxHp;
  let turnDmg = 0; let t = 0;
  const sink = (ev) => {
    if ((ev.type === 'damage' || ev.type === 'trueDamage') && ev.side === 'player') turnDmg += ev.amount;
  };
  while (!b.over && t < 12) {
    if (b.active === 'player') { t += 1; autoPlay(b); }
    for (const ev of b.takeEvents()) sink(ev);
    if (b.over || t >= 12) break;
    turnDmg = 0;
    b.endTurn();
    for (const ev of b.takeEvents()) sink(ev);
    perTurn.push(turnDmg);
    turns += 1;
    if (turnDmg > maxHp * 0.3) over30 += 1;
    if (turnDmg > maxHp * 0.5) over50 += 1;
    if (turnDmg > maxHp * 0.7) over70 += 1;
  }
  if (b.winner === 'player') { wins += 1; turnToKill.push(t); } else {
    losses += 1;
    const k = `${b.enemy.name}`;
    deaths.set(k, (deaths.get(k) ?? 0) + 1);
  }
}

const avg = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
const sorted = [...perTurn].sort((a, b) => a - b);
const pct = (p) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] ?? 0;
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)] ?? 0; };

console.log(`第 ${stage + 1} 章 ${tier}（主角 ${HERO ?? 'oasilia'}，章内深度 ${NODE}）：${wins + losses} 场`);
console.log(`  玩家参考面板：攻 ${GROWTH.atk} / 防 ${GROWTH.def} / 血 ${GROWTH.maxHp} / 敏 ${GROWTH.agi}`);
console.log(`  胜负：赢 ${wins}（${((wins / Math.max(1, wins + losses)) * 100).toFixed(1)}%）· 输 ${losses}`);
console.log(`  打赢需要 ${median(turnToKill)} 个回合（中位数）`);
console.log(`  敌人每回合伤害：平均 ${avg(perTurn).toFixed(0)} · 中位 ${pct(0.5)} · p75 ${pct(0.75)} · p90 ${pct(0.9)} · p99 ${pct(0.99)} · 最高 ${sorted[sorted.length - 1] ?? 0}`);
console.log(`  其中占玩家最大生命：平均 ${(avg(perTurn) / GROWTH.maxHp * 100).toFixed(1)}% · 超过 30% 的回合 ${over30}/${turns}（${(over30 / Math.max(1, turns) * 100).toFixed(1)}%）· 超过 50% 的 ${over50}· 超过 70% 的 ${over70}`);
console.log('  玩家死在哪只手里（前 6）：' + [...deaths.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => `${k}×${v}`).join('  '));

/** 顺手把「力量叠加」这件事量一下：环境里力量最高的那只怪是多少 */
console.log('  —— 牌组里带「力量」的牌（敌人给玩家制造爆发的主因）——');
for (const id of ['overheat', 'howl', 'swords_dance', 'blood_price', 'last_stand']) {
  const c = CARD_BY_ID[id];
  if (!c) continue;
  const st = (c.effects ?? []).filter((e) => e.kind === 'strength').reduce((s, e) => s + e.n, 0);
  if (st) console.log(`    ${c.name}（${c.ap} 费 ${c.rarity}）力量 +${st}${c.exhaust ? ' · 使用后销毁' : ''}`);
}
