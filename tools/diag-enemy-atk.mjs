// 诊断：同一章里「杂兵」和「较强」的实际每回合输出差多少？
//
// 起因（玩家反馈）：「较强的怪攻击力巨高无比」（大嘴雀 攻 122 / 刺甲贝 攻 127，
// 意图提示甚至写着「下回合最多 623 伤害，会被打倒」）。
//
// 怀疑点：血量和攻击力是拿**混合池**（一场普通战斗从「杂兵 + 较强」里随机抽一只）
// 量出来的平均伤害反推的，而两个池子的卡组强度差得很远 ——
// 平均值对了，个体就可能一个像挠痒、一个能秒人。
//
// 用法: node tools/diag-enemy-atk.mjs [章节 0-5]
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '..');
const imp = (rel) => import(pathToFileURL(path.join(ROOT, rel)).href);
globalThis.localStorage = { _m: new Map(), getItem: () => null, setItem: () => {}, removeItem: () => {} };

const { Game } = await imp('src/core/game.js');
const { BALANCE, STAGE_BIOME } = await imp('src/data/balance.js');
const { STARTER_DECK, rollCard } = await imp('src/data/cards.js');

const GROWTH = [
  { atk: 12, def: 12, maxHp: 200, agi: 10, luck: 5, deck: 10 },
  { atk: 22, def: 19, maxHp: 270, agi: 15, luck: 9, deck: 16 },
  { atk: 32, def: 27, maxHp: 330, agi: 19, luck: 12, deck: 21 },
  { atk: 42, def: 33, maxHp: 380, agi: 22, luck: 14, deck: 26 },
  { atk: 50, def: 39, maxHp: 430, agi: 24, luck: 16, deck: 30 },
  { atk: 57, def: 44, maxHp: 470, agi: 24, luck: 18, deck: 34 },
];
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

const N = Number(process.argv[3] ?? 60);
const STAGES = process.argv[2] ? [Number(process.argv[2])] : [0, 1, 2, 3, 4, 5];
const pad = (s, n) => String(s).padEnd(n);

console.log('每一档敌人「实际每回合打掉玩家多少血」（只统计该档自己的战斗）');
console.log(pad('章节', 6) + pad('档位', 8) + pad('敌攻', 6) + pad('每回合伤害', 11) + pad('占玩家HP', 10) + pad('最凶的一回合', 13) + pad('意图上界', 10) + '样本');
for (const stage of STAGES) {
  const g = GROWTH[stage];
  for (const tier of ['mob', 'normal', 'elite', 'boss']) {
    const kind = tier === 'mob' || tier === 'normal' ? 'normal' : tier;
    let dmg = 0, turns = 0, worst = 0, threat = 0, samples = 0, atk = 0;
    for (let i = 0; i < N * 6 && samples < N; i++) {
      const game = new Game({ seed: 90000 + stage * 733 + i * 29 });
      game.newRun();
      Object.assign(game.data, { ...g, hp: g.maxHp, stage });
      game.data.map.biome = STAGE_BIOME[stage];
      game.data.deck = buildDeck(g.deck);
      game.data.battleDeck = null;
      game.startBattle(kind, 4);
      const b = game.battle;
      if (b.enemy.tier !== tier) continue;          // 只要这一档的
      samples += 1;
      atk = b.enemy.atk;
      threat += b.predictEnemyThreat().damage;
      let t = 0, runDmg = 0, runWorst = 0;
      const sink = (ev) => {
        if ((ev.type === 'damage' || ev.type === 'trueDamage') && ev.side === 'player') { dmg += ev.amount; runDmg += ev.amount; }
      };
      while (!b.over && t < 6) {
        if (b.active === 'player') { t += 1; autoPlay(b, sink); }
        for (const ev of b.takeEvents()) sink(ev);
        runWorst = Math.max(runWorst, runDmg);      // 累计值 -> 每回合里最狠的那一段
        runDmg = 0;
        if (t >= 6) break;
        b.endTurn();
        for (const ev of b.takeEvents()) sink(ev);
      }
      turns += t;
      worst = Math.max(worst, runWorst);
    }
    const perTurn = dmg / Math.max(1, turns);
    console.log(
      pad('第' + (stage + 1) + '章', 6) + pad(tier, 8) + pad(atk, 6) +
      pad(perTurn.toFixed(0), 11) + pad((perTurn / g.maxHp * 100).toFixed(1) + '%', 10) +
      pad(worst + '（' + (worst / g.maxHp * 100).toFixed(0) + '%）', 13) +
      pad((threat / Math.max(1, samples)).toFixed(0), 10) + samples,
    );
  }
}
console.log('');
console.log('说明：攻击力是「以较强档 11% 每回合压力为锚、按档位系数缓慢递增」推出来的，');
console.log('     档位之间的真实强度差来自卡组（招式包分两档 + 专属招式）与血量 ——');
console.log('     把三档攻击力钉成同一个数时会看到：杂兵 ≈ 较强 × 0.7 ≈ 精英 × 0.55 ≈ 首领 × 0.4。');
console.log('     「意图上界」= 战斗界面那行「下回合最多 N 伤害」预估（按抽得最顺的一手算）');
