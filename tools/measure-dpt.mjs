// 统计「实际战斗中」双方每回合的真实伤害（考虑防御减伤、格挡、连击、卡组构成）
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '..');
const imp = (rel) => import(pathToFileURL(path.join(ROOT, rel)).href);
globalThis.localStorage = { _m: new Map(), getItem(k) { return this._m.get(k) ?? null; }, setItem(k, v) { this._m.set(k, String(v)); }, removeItem(k) { this._m.delete(k); } };

const { Game } = await imp('src/core/game.js');

const GROWTH = {
  0: { atk: 14, def: 12, maxHp: 220, agi: 10, luck: 5, deck: 10 },
  1: { atk: 24, def: 19, maxHp: 300, agi: 15, luck: 9, deck: 16 },
  2: { atk: 34, def: 27, maxHp: 380, agi: 19, luck: 12, deck: 21 },
};
const EXTRA = ['bite', 'rock_throw', 'double_kick', 'crunch', 'dragon_breath', 'rock_slide', 'earth_power', 'bulk_up', 'iron_defense', 'roost', 'dragon_claw', 'earthquake', 'superpower', 'dragon_darts', 'fire_fang', 'protect'];

function autoPlay(b, sink) {
  let g = 0;
  while (!b.over && g++ < 24) {
    const hand = b.hand('player').filter((c) => b.canPlay(c.uid));
    if (!hand.length) break;
    const best = hand.map((c) => ({ c, s: b.scoreCard('player', c.card) })).sort((a, x) => x.s - a.s)[0];
    if (best.s <= 0) break;
    if (!b.playCard(best.c.uid).ok) break;
    for (const ev of b.takeEvents()) sink(ev);
  }
}

const pad = (s, n) => String(s).padEnd(n);
console.log(pad('章节', 6) + pad('档位', 8) + pad('敌人HP', 8) + pad('敌人DPT', 9) + pad('玩家DPT', 9) + pad('玩家HP', 8) + pad('预计击杀回合', 13) + '预计存活回合');
for (let stage = 0; stage < 3; stage++) {
  for (const kind of ['normal', 'elite', 'boss']) {
    let eOut = 0, pOut = 0, pTurns = 0, eHp = 0, pMax = 0, n = 0;
    for (let i = 0; i < 60; i++) {
      const game = new Game({ seed: 33000 + stage * 911 + i * 53 });
      game.newRun();
      const g = GROWTH[stage];
      Object.assign(game.data, { atk: g.atk, def: g.def, maxHp: g.maxHp, hp: g.maxHp, agi: g.agi, luck: g.luck, stage });
      while (game.data.deck.length < g.deck) game.data.deck.push(EXTRA[Math.floor(Math.random() * EXTRA.length)]);
      game.data.battleDeck = null;
      game.startBattle(kind, 0);
      const b = game.battle;
      eHp += b.enemy.maxHp;
      pMax += b.player.maxHp;
      let guard = 0;
      const sink = (ev) => {
        if (ev.type === 'damage') {
          if (ev.side === 'enemy') pOut += ev.amount;
          else eOut += ev.amount;
        } else if (ev.type === 'trueDamage' && ev.side === 'player') eOut += ev.amount;
      };
      while (!b.over && guard++ < 60) {
        if (b.active === 'player') autoPlay(b, sink);
        b.endTurn();
        for (const ev of b.takeEvents()) sink(ev);
      }
      pTurns += b.turn;
      n++;
    }
    const avgE = eHp / n, avgP = pMax / n;
    const eDpt = eOut / pTurns, pDpt = pOut / pTurns;
    console.log(
      pad('第' + (stage + 1) + '章', 6) + pad(kind, 8) + pad(Math.round(avgE), 8) +
      pad(eDpt.toFixed(1), 9) + pad(pDpt.toFixed(1), 9) + pad(Math.round(avgP), 8) +
      pad((avgE / pDpt).toFixed(1), 13) + (avgP / eDpt).toFixed(1),
    );
  }
}
