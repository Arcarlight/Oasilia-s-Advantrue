// 全流程模拟：模拟一个「会喝药、会选路线、会拿卡」的普通玩家，从头走到通关或阵亡。
// 用法: node tools/simulate-run.mjs [局数]
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '..');
const imp = (rel) => import(pathToFileURL(path.join(ROOT, rel)).href);
globalThis.localStorage = {
  _m: new Map(),
  getItem(k) { return this._m.has(k) ? this._m.get(k) : null; },
  setItem(k, v) { this._m.set(k, String(v)); },
  removeItem(k) { this._m.delete(k); },
};

const { Game } = await imp('src/core/game.js');
const { CARD_BY_ID } = await imp('src/data/cards.js');
const { stageCount } = await imp('src/data/mapgen.js');
const ONLY_FIRST_STAGE = process.argv.includes('--stage1');

const TOTAL = Number(process.argv[2] ?? 400);

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

function fight(game) {
  const b = game.battle;
  let g = 0;
  while (!b.over && g++ < 200) {
    if (b.active === 'player') autoPlay(b);
    b.endTurn();
    b.takeEvents();
  }
  return { win: b.winner === 'player', turns: b.turn };
}

/** 喝药：血量低于阈值就喝，尽量把血拉满 */
function drink(game, threshold) {
  let used = 0;
  while (game.data.hp / game.data.maxHp < threshold && used++ < 5) {
    const items = game.data.items ?? {};
    if (items.potion_big) game.useItem('potion_big');
    else if (items.potion_small) game.useItem('potion_small');
    else break;
  }
}

function pickPath(game) {
  const opts = game.availableNodes();
  if (!opts.length) return null;
  const hpPct = game.data.hp / game.data.maxHp;
  const score = (n) => {
    switch (n.type) {
      case 'rest': return hpPct < 0.6 ? 120 : 45;
      case 'shop': return game.data.gold > 90 ? 65 : 25;
      case 'chest': return 72;
      case 'event': return hpPct > 0.5 ? 58 : 30;
      case 'elite': return hpPct > 0.9 ? 40 : 0;
      case 'boss': return 30;
      default: return 48;
    }
  };
  return opts.slice().sort((a, b) => score(b) - score(a))[0];
}

const stats = { win: 0, dead: 0, floors: [], stages: [], death: new Map(), stagesReached: [0, 0, 0] };

for (let i = 0; i < TOTAL; i++) {
  const game = new Game({ seed: 120000 + i * 271 });
  game.newRun();
  let guard = 0;
  while (guard++ < 400) {
    if (game.phase === 'map') {
      const node = pickPath(game);
      if (!node) { game.nextStage(); continue; }
      // 打普通怪/精英/首领前先尽量补血
      if (node.type === 'battle') drink(game, 0.65);
      if (node.type === 'elite') drink(game, 0.95);
      if (node.type === 'boss') drink(game, 0.98);
      game.goToNode(node.id);
      continue;
    }
    if (game.phase === 'battle') {
      const r = fight(game);
      if (!r.win) {
        stats.dead++;
        stats.floors.push(game.data.floor);
        stats.stages.push(game.data.stage);
        const key = `第${game.data.stage + 1}章 ${game.battle.enemy.name}`;
        stats.death.set(key, (stats.death.get(key) ?? 0) + 1);
        break;
      }
      game.finishBattle();
      continue;
    }
    if (game.phase === 'reward') {
      const choices = game.reward?.cardChoices ?? [];
      if (choices.length && game.data.deck.length < 26) {
        const rank = { common: 0, uncommon: 1, rare: 2, epic: 3 };
        const best = choices.slice().sort((a, b) => rank[b.rarity] - rank[a.rarity])[0];
        game.takeRewardCard(best.id);
      } else {
        game.takeRewardCard(null);
      }
      continue;
    }
    if (game.phase === 'event') {
      const ev = game.event;
      const idx = game.data.hp / game.data.maxHp < 0.45 ? ev.options.length - 1 : Math.floor(Math.random() * ev.options.length);
      game.chooseEventOption(idx);
      game.leaveEvent();
      continue;
    }
    if (game.phase === 'chest') { game.leaveChest(); continue; }
    if (game.phase === 'rest') {
      if (game.data.hp / game.data.maxHp < 0.75) game.restHeal();
      else if (game.data.deck.length > 12) {
        const weakest = [...game.data.deck].sort((a, b) => (CARD_BY_ID[a]?.ap ?? 9) - (CARD_BY_ID[b]?.ap ?? 9))[0];
        game.restUpgrade(weakest);
      } else game.restHeal();
      game.leaveRest();
      continue;
    }
    if (game.phase === 'shop') {
      const stock = game.shop.stock.map((s, idx) => ({ s, idx })).filter((x) => !game.shop.soldOut.includes(x.idx));
      const wantPotion = game.data.hp / game.data.maxHp < 0.7 || (game.data.items.potion_small ?? 0) + (game.data.items.potion_big ?? 0) < 1;
      const target = stock
        .filter((x) => (wantPotion ? x.s.kind === 'item' : x.s.kind === 'card'))
        .sort((a, b) => b.s.price - a.s.price)[0];
      if (target && game.data.gold >= target.s.price) {
        game.buy(target.idx);
        if (game.pendingRemove) {
          const weakest = [...game.data.deck].sort((a, b) => (CARD_BY_ID[a]?.ap ?? 9) - (CARD_BY_ID[b]?.ap ?? 9))[0];
          game.doRemove(weakest);
        }
      }
      game.leaveShop();
      continue;
    }
    if (game.phase === 'victory') {
      stats.win++;
      stats.stagesReached[2]++;
      stats.floors.push(40);
      stats.stages.push(game.data.stage);
      break;
    }
    if (game.phase === 'gameover') {
      stats.dead++;
      stats.floors.push(game.data.floor);
      stats.stages.push(game.data.stage);
      break;
    }
    break;
  }
}

const avg = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0).toFixed(2);
console.log(`\n=== 全流程模拟（${TOTAL} 局；会喝药、会挑路线）===`);
console.log(`  通关率      ${((stats.win / TOTAL) * 100).toFixed(1)}%`);
console.log(`  平均到第几章 ${avg(stats.stages.map((s) => s + 1))} / ${stageCount()}`);
console.log(`  平均步数     ${avg(stats.floors)}`);
const hist = {};
for (const f of stats.floors) { const b = Math.min(30, Math.floor(f / 3) * 3); hist[b] = (hist[b] ?? 0) + 1; }
console.log('  步数分布：' + Object.entries(hist).sort((a, b) => a[0] - b[0]).map(([k, v]) => `${k}-${Number(k) + 2}:${v}`).join(' '));
console.log('  死因：' + [...stats.death.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => `${k}×${v}`).join('  '));
