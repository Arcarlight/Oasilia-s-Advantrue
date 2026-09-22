// 全流程模拟：模拟一个「会喝药、会选路线、会拿卡」的普通玩家，从头走到通关或阵亡。
// 用法: node tools/simulate-run.mjs [局数]
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '..');
const imp = (rel) => import(pathToFileURL(path.join(ROOT, rel)).href);
// 手持道具：模拟器要看「手上有哪些回血道具」，所以得知道每件道具的 use 效果
const { ITEMS } = await imp('src/data/items.js');
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
/** --endless：模拟无尽模式（成绩是「走到第几章」，不是通关率） */
const ENDLESS = process.argv.includes('--endless');

const TOTAL = Number(process.argv[2] ?? 400);
/**
 * `--hero=atlas`：用阿特拉斯那一套模拟（开局卡组 / 属性 / 两倍长的一章 / 两个首领 /
 * 更高的难度倍率全都跟着换）。不传就是欧亚西莉亚（本体基准）。
 */
const HERO = (process.argv.find((a) => a.startsWith('--hero=')) ?? '').slice(7) || null;

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

/**
 * 「喝药」：血量低于阈值就吃手上的回血道具。
 *
 * 手持道具时代只有一条规则要记：**使用型只能在战斗外用**（战斗中不能嗑，用户定的），
 * 所以这里只在战斗外调用（见下面的调用点）。回血从大到小挑：先把大补的吃掉。
 */
function drink(game, threshold) {
  let used = 0;
  while (game.data.hp / game.data.maxHp < threshold && used++ < 5) {
    const held = game.data.held ?? [];
    const healers = held
      .filter((id) => ITEMS[id]?.use?.healPct || ITEMS[id]?.use?.healFull)
      .sort((a, b) => (ITEMS[b].use.healPct ?? 1) - (ITEMS[a].use.healPct ?? 1));
    if (!healers.length) break;
    if (game.useItem(healers[0])?.ok !== true) break;
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
/** --ttk：按章累计「战力对照」（见战斗那一支的说明） */
const TTK = process.argv.includes('--ttk');
const ttk = new Map();

for (let i = 0; i < TOTAL; i++) {
  const game = new Game({ seed: 120000 + i * 271 });
  game.newRun(undefined, ENDLESS ? { endless: true, hero: HERO ?? undefined } : { hero: HERO ?? undefined });
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
      /**
       * `--ttk`：把每一场开打时的「这一章的战力对照」记下来。
       *
       * 用户报的是「阿特拉斯到后面 70 攻击三下把敌人秒了」——
       * 那是**章节越往后、战斗越短**的问题，通关率看不出来（他照样会因为消耗战死掉）。
       * 这里记四个数：玩家攻击、敌人血量、一张 200 威力牌的伤害、以及**打几下能打死**。
       * 200 是常用攻击牌的中间档（见 content/cards.json），拿它当尺子最直观。
       */
      if (TTK) {
        const st = game.data.stage ?? 0;
        const e = game.battle.enemy;
        const row = ttk.get(st) ?? { n: 0, atk: 0, ehp: 0, turns: 0, deck: 0 };
        const turns0 = game.battle.turn ?? 1;
        const r0 = fight(game);
        /**
         * ⚠ 真正该看的是**打了几个回合**，不是「血量 ÷ 攻击」——
         * 后者只算属性，看不见卡组：阿特拉斯那一局打了约两倍的仗，卡组比别人多七八张、
         * 而且奖励偏向稀有/史诗，实际每回合的伤害比属性算出来的高得多。
         * 第一版就是拿血量÷攻击当尺子，量出来两人的「几下打死」几乎一样，
         * 和玩家的「三下秒了」对不上 —— 换成回合数才对得上。
         */
        row.n += 1;
        row.atk += game.data.atk;
        row.ehp += (e.maxHp ?? e.hp);        // ⚠ 用 maxHp：打完之后 e.hp 已经是 0 了（第一版量出一列 0）
        row.turns += Math.max(1, (game.battle.turn ?? 1) + 1 - turns0);
        row.deck += game.data.deck.length;
        ttk.set(st, row);
        if (!r0.win) { stats.dead += 1; stats.floors.push(game.data.floor); stats.stages.push(game.data.stage); break; }
        game.finishBattle();
        continue;
      }
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
      /**
       * 手持道具时代：这一局「缺不缺续航」看两件事 ——
       *   · 血不满（<70%）；
       *   · 手上**一件能回血的都还没有**（use 型且 healPct / 血药那类）。
       * 以前读的是 `data.items.potion_small`（背包制的计数），现在道具是 `data.held` 数组。
       */
      const heldHeal = (game.data.held ?? []).some((id) => ITEMS[id]?.use?.healPct);
      const wantPotion = game.data.hp / game.data.maxHp < 0.7 || !heldHeal;
      // 手持栏满了就不再买道具（买了也放不下）
      const roomForItem = (game.data.held ?? []).length < game.heldMax();
      const target = stock
        .filter((x) => ((wantPotion && roomForItem) ? x.s.kind === 'item' : x.s.kind === 'card'))
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
/**
 * `--endless`：模拟**无尽模式**（标题页那个单独入口）。
 *
 * 无尽模式没有胜负，唯一的成绩是「走到第几章」—— 所以这里报的是**章节分布**
 * （中位数 / 最好的一次），而不是通关率。想对比正片就直接跑不带参数的这一条。
 */
if (ENDLESS) {
  const chapters = stats.stages.map((s) => s + 1).sort((a, b) => a - b);
  const median = chapters[Math.floor(chapters.length / 2)] ?? 0;
  const best = chapters[chapters.length - 1] ?? 0;
  const over6 = chapters.filter((c) => c > stageCount()).length;
  console.log(`\n=== 无尽模式模拟（${TOTAL} 局；会喝药、会挑路线）===`);
  console.log(`  走到第几章   中位数 ${median} · 平均 ${avg(chapters)} · 最远 ${best}`);
  console.log(`  走过正片(>${stageCount()} 章) ${over6} 局（${((over6 / TOTAL) * 100).toFixed(1)}%）`);
  const buckets = {};
  for (const c of chapters) { const b = Math.min(20, c); buckets[b] = (buckets[b] ?? 0) + 1; }
  console.log('  章节分布：' + Object.entries(buckets).sort((a, b) => a[0] - b[0])
    .map(([k, v]) => `${k}${Number(k) >= 20 ? '+' : ''}章:${v}`).join(' '));
  console.log('  死因：' + [...stats.death.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => `${k}×${v}`).join('  '));
  process.exit(0);
}

console.log(`\n=== 全流程模拟（${TOTAL} 局 · ${HERO ?? 'oasilia'}；会喝药、会挑路线）===`);
console.log(`  通关率      ${((stats.win / TOTAL) * 100).toFixed(1)}%`);
console.log(`  平均到第几章 ${avg(stats.stages.map((s) => s + 1))} / ${stageCount()}`);
console.log(`  平均步数     ${avg(stats.floors)}`);
const hist = {};
for (const f of stats.floors) { const b = Math.min(30, Math.floor(f / 3) * 3); hist[b] = (hist[b] ?? 0) + 1; }
console.log('  步数分布：' + Object.entries(hist).sort((a, b) => a[0] - b[0]).map(([k, v]) => `${k}-${Number(k) + 2}:${v}`).join(' '));
console.log('  死因：' + [...stats.death.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => `${k}×${v}`).join('  '));

if (TTK) {
  console.log('\n  每一章实际打一场要几个回合（含敌方回合；这才是「几下打死」的真身）');
  console.log('    章  样本   玩家攻击   敌人血量   卡组   平均回合');
  for (const st of [...ttk.keys()].sort((a, b) => a - b)) {
    const r = ttk.get(st);
    console.log('    ' + String(st + 1).padStart(2) + '  ' + String(r.n).padStart(5)
      + '   ' + (r.atk / r.n).toFixed(1).padStart(8)
      + '   ' + Math.round(r.ehp / r.n).toString().padStart(8)
      + '   ' + (r.deck / r.n).toFixed(1).padStart(4)
      + '   ' + (r.turns / r.n).toFixed(2).padStart(8));
  }
}
