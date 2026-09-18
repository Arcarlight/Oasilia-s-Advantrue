// 诊断：敌人的牌组组成 + 打到后面还有没有牌可打。
// 用法: node tools/diag-enemydeck.mjs [章节 0-5] [场数] [boss|elite|normal]
//
// 逐回合打印敌人 AP / 出牌 / 手牌 / 牌堆 / 销毁堆，用来确认它不会「打到后面只会放铁壁」
// （那个 bug 的成因：牌组只有 9 张、它每回合抽 8 张，池子里带销毁的伤害牌两回合就被掏空）。
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '..');
const imp = (rel) => import(pathToFileURL(path.join(ROOT, rel)).href);
globalThis.localStorage = { _m: new Map(), getItem: () => null, setItem: () => {}, removeItem: () => {} };

const { Game } = await imp('src/core/game.js');

const stage = Number(process.argv[2] ?? 5);
const runs = Number(process.argv[3] ?? 3);
const kind = process.argv[4] ?? 'boss';
// 按章节的玩家画像（与 measure-balance.mjs 一致），敌人强度才有意义
const GROWTH = [
  { atk: 12, def: 12, maxHp: 200, agi: 10, luck: 5 },
  { atk: 22, def: 19, maxHp: 270, agi: 15, luck: 9 },
  { atk: 32, def: 27, maxHp: 330, agi: 19, luck: 12 },
  { atk: 42, def: 33, maxHp: 380, agi: 22, luck: 14 },
  { atk: 50, def: 39, maxHp: 430, agi: 24, luck: 16 },
  { atk: 57, def: 44, maxHp: 470, agi: 24, luck: 18 },
][Math.min(5, Math.max(0, stage))];

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

for (let i = 0; i < runs; i++) {
  const game = new Game({ seed: 4242 + i * 91 });
  game.newRun();
  Object.assign(game.data, { ...GROWTH, hp: GROWTH.maxHp, stage });
  game.data.deck = ['tackle', 'bite', 'crunch', 'dragon_claw', 'rock_slide', 'iron_defense', 'roost', 'protect', 'bulk_up', 'earthquake', 'dragon_rush', 'superpower'];
  game.data.battleDeck = null;
  game.startBattle(kind, 0);
  const b = game.battle;
  const decks = b.decks.enemy.draw;
  const count = {};
  for (const e of decks) count[e.card.name] = (count[e.card.name] ?? 0) + 1;
  const power = decks.reduce((s, e) => s + (e.card.effects ?? []).filter((f) => f.kind === 'damage').reduce((x, f) => x + f.power * (f.hits ?? 1), 0), 0);
  // 伤害牌 / 非伤害牌各占多少
  const dmgN = decks.filter((e) => (e.card.effects ?? []).some((f) => f.kind === 'damage')).length;
  console.log(`\n=== 第${stage + 1}章 ${kind}：${b.enemy.name} | 牌组 ${decks.length} 张（伤害 ${dmgN} / 非伤害 ${decks.length - dmgN}）| 总威力 ${power} ===`);
  console.log('  初始牌组：' + Object.entries(count).map(([k, v]) => `${k}×${v}`).join(' '));
  let turn = 0;
  let utilityOnlyTurns = 0;
  while (!b.over && turn++ < 20) {
    if (b.active === 'player') autoPlay(b);
    if (b.over) break;
    b.endTurn();
    const evs = b.takeEvents();
    const e = b.enemy;
    const plays = evs.filter((ev) => ev.type === 'playCard' && ev.side === 'enemy');
    if (plays.length) {
      // 这一回合敌人放的牌里，有没有一张带伤害的
      const anyDamage = plays.some((ev) => {
        const card = b.decks.enemy.exhaust.concat(b.decks.enemy.discard, b.decks.enemy.hand, b.decks.enemy.draw)
          .map((c) => c.card).find((c) => c.id === ev.id);
        return card && (card.effects ?? []).some((f) => f.kind === 'damage');
      });
      if (!anyDamage) utilityOnlyTurns++;
    }
    console.log(
      `  回合${String(b.turn).padStart(2)} 玩家HP ${String(Math.max(0, b.player.hp)).padStart(3)} | ` +
      `敌 HP ${String(Math.max(0, e.hp)).padStart(4)} 盾 ${String(e.shield).padStart(3)} AP ${e.ap}/${e.apMax} | ` +
      `出牌 ${plays.length} 张 · 手牌 ${b.decks.enemy.hand.length} 牌堆 ${b.decks.enemy.draw.length} 销毁 ${b.decks.enemy.exhaust.length} 弃牌 ${b.decks.enemy.discard.length}`
    );
  }
  console.log(`  结果：${b.over ? (b.winner === 'player' ? '玩家胜' : '玩家败') : '超时'}，共 ${b.turn} 回合；「一张伤害牌都没放」的回合数 = ${utilityOnlyTurns}`);
}
