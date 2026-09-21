// 双主角收益对照：通关率 + 「这一局到底拿到了多少东西」。
//
// 为什么单独一个脚本：
//   用户要的是「阿特拉斯的通关率**略低于**欧亚西莉亚，但他这边更容易拿到道具、卡牌收益更好」——
//   这是一个**两个方向同时拧**的要求（难度往上、补偿也往上），只看通关率没法判断补偿有没有生效。
//   所以这里除了通关率，还量三件玩家能直接感觉到的事：
//     · 一局掉到几件道具（以及「背包满了被迫丢」的次数 —— 补偿不能变成骚扰）；
//     · 一局拿到几张卡、什么稀有度（实际装进卡组的那张，不是「抽到了什么选项」）；
//     · 一局赚到多少金币（金币=商店里的道具与卡，属于同一条「收益」链路）。
//
// 低噪声：把 Math.random 换成一个**固定种子的 PRNG**，并且每位主角都从同一个种子重来 ——
//   两次运行的结果可以逐位复现，两位主角也吃到同一串运气。不然 7% 上下的通关率
//   在 700 局里的标准差就有 1 个百分点，调数值时根本看不出自己是拧对了还是拧反了。
//
// 用法：
//   node tools/probe-hero-rewards.mjs                 两位主角各 2000 局
//   node tools/probe-hero-rewards.mjs 4000           各 4000 局
//   node tools/probe-hero-rewards.mjs 2000 atlas     只跑阿特拉斯
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

/** 固定种子 PRNG（mulberry32）：每次运行、每位主角都从同一个种子开始 */
function mulberry32(a) {
  return function rand() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const SEED = 0xC0FFEE;

const { Game } = await imp('src/core/game.js');
const { CARD_BY_ID } = await imp('src/data/cards.js');
const { ITEMS } = await imp('src/data/items.js');
const { stageCount } = await imp('src/data/mapgen.js');

const TOTAL = Number(process.argv[2] ?? 2000);
const ONLY = (process.argv.slice(2).find((a) => !a.startsWith('--') && !/^\d+$/.test(a)) ?? '').trim() || null;
const HEROES = ONLY ? [ONLY] : ['oasilia', 'atlas'];

/**
 * 调数值时用：`ATLAS_HP=1.25 ATLAS_ATK=1.2 ATLAS_PER=0.02 node tools/probe-hero-rewards.mjs 2000 atlas`
 * 临时改某位主角的难度倍率（**只在内存里，不写任何文件**）—— 先扫出「通关率落在哪儿」，
 * 再把定下来的数字写进 content/heroes.json。收益那一侧不走这里：它是数据的一部分，
 * 改 JSON + `node tools/build-content.mjs` 才是真跑一遍那条路（顺便过一遍体检）。
 */
const { HERO_BY_ID } = await imp('src/data/heroes.js');
for (const id of HEROES) {
  const P = id.toUpperCase();
  const e = HERO_BY_ID[id]?.map?.enemy;
  if (e) {
    if (process.env[`${P}_HP`]) e.hp = Number(process.env[`${P}_HP`]);
    if (process.env[`${P}_ATK`]) e.atk = Number(process.env[`${P}_ATK`]);
    if (process.env[`${P}_PER`]) e.perStage = Number(process.env[`${P}_PER`]);
  }
  if (process.env[`${P}_DROP`]) {
    const h = HERO_BY_ID[id];
    h.rewards = { ...(h.rewards ?? {}), itemDropMul: Number(process.env[`${P}_DROP`]) };
  }
}

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

const RANK = ['common', 'uncommon', 'rare', 'epic'];

/**
 * 背包满了怎么办：**换掉手上最差的那件**（新件稀有度更高，或者手上连一件回血的都没有）。
 *
 * 这一步不能省。模拟器（simulate-run.mjs）压根不管 `awaitingOverflow`，于是掉落一旦
 * 超过背包容量就**静静消失** —— 那样量出来的结论会是「给阿特拉斯加倍掉落没用」，
 * 而真相只是模拟器把多出来的东西扔了。这里按一个正常玩家的做法结算：
 * 值得换就换，不值得就谢过不要。两种结果分开计数（换 = 收下，不要 = 白掉）。
 */
const itemScore = (id) => RANK.indexOf(ITEMS[id]?.rarity ?? 'common');
const isHealer = (id) => !!(ITEMS[id]?.use?.healPct || ITEMS[id]?.use?.healFull);
function resolveOverflow(game) {
  const pending = game.awaitingOverflow;
  if (!pending) return 'none';
  const held = game.data.held ?? [];
  const worst = held.slice().sort((a, b) => itemScore(a) - itemScore(b))[0];
  const want = !!worst && (itemScore(pending.id) > itemScore(worst) || (isHealer(pending.id) && !held.some(isHealer)));
  if (want) {
    game.dropItem(worst);
    game.giveItem(pending.id, 1);
  }
  game.awaitingOverflow = null;
  return want ? 'swap' : 'skip';
}

/** 跑一位主角，返回这一批局的汇总 */
function runHero(hero, n) {
  Math.random = mulberry32(SEED);   // 每位主角同一串运气
  const s = {
    hero, n, win: 0, battles: 0, drops: 0, kept: 0, overflow: 0, lost: 0,
    cards: 0, rarity: { common: 0, uncommon: 0, rare: 0, epic: 0 },
    gold: 0, stages: 0, floors: 0, heldEnd: 0, healsUsed: 0,
  };
  for (let i = 0; i < n; i++) {
    const game = new Game({ seed: 120000 + i * 271 });
    game.newRun(undefined, { hero });
    let guard = 0;
    while (guard++ < 400) {
      if (game.awaitingOverflow) {
        const r = resolveOverflow(game);
        if (r === 'swap') s.kept += 1;
        else if (r === 'skip') s.lost += 1;
        continue;
      }
      if (game.phase === 'map') {
        const node = pickPath(game);
        if (!node) { game.nextStage(); continue; }
        if (node.type === 'battle') drink(game, 0.65);
        if (node.type === 'elite') drink(game, 0.95);
        if (node.type === 'boss') drink(game, 0.98);
        game.goToNode(node.id);
        continue;
      }
      if (game.phase === 'battle') {
        s.battles += 1;
        const r = fight(game);
        if (!r.win) break;
        const before = game.data.gold;
        const reward = game.finishBattle();
        s.gold += game.data.gold - before;
        if (reward?.itemDrop) {
          s.drops += 1;
          if (reward.itemDrop.stored) s.kept += 1;
          if (reward.itemDrop.overflow) s.overflow += 1;
        }
        continue;
      }
      if (game.phase === 'reward') {
        const choices = game.reward?.cardChoices ?? [];
        if (choices.length && game.data.deck.length < 26) {
          const best = choices.slice().sort((a, b) => RANK.indexOf(b.rarity) - RANK.indexOf(a.rarity))[0];
          s.cards += 1;
          s.rarity[best.rarity] = (s.rarity[best.rarity] ?? 0) + 1;
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
        const stock = game.shop.stock.map((x, idx) => ({ s: x, idx })).filter((x) => !game.shop.soldOut.includes(x.idx));
        const heldHeal = (game.data.held ?? []).some((id) => ITEMS[id]?.use?.healPct);
        const wantPotion = game.data.hp / game.data.maxHp < 0.7 || !heldHeal;
        const roomForItem = (game.data.held ?? []).length < game.heldMax();
        const target = stock
          .filter((x) => ((wantPotion && roomForItem) ? x.s.kind === 'item' : x.s.kind === 'card'))
          .sort((a, b) => b.s.price - a.s.price)[0];
        if (target && game.data.gold >= target.s.price) {
          game.buy(target.idx);
          if (game.pendingRemove) game.doRemove(game.data.deck[0]);
        }
        game.leaveShop();
        continue;
      }
      if (game.phase === 'victory') { s.win += 1; break; }
      if (game.phase === 'gameover') break;
      break;
    }
    s.stages += game.data.stage + 1;
    s.floors += game.data.floor;
    s.heldEnd += (game.data.held ?? []).length;
  }
  return s;
}

const rows = HEROES.map((h) => runHero(h, TOTAL));
const f1 = (x) => (x / TOTAL).toFixed(2);
console.log(`\n=== 双主角收益对照（每位 ${TOTAL} 局 · 固定随机种子 · 会喝药会挑路线）===`);
console.log('主角            通关率   平均章  场数/局  掉落/局  收下/局  溢出/局  白掉/局   卡/局   普通 / 精良 / 稀有 / 史诗          金币/局  手上道具');
for (const s of rows) {
  const per = (k) => (s[k] / TOTAL).toFixed(2).padStart(6);
  const r = RANK.map((x) => `${((s.rarity[x] ?? 0) / Math.max(1, s.cards) * 100).toFixed(0)}%`.padStart(5)).join(' /');
  console.log(`${s.hero.padEnd(14)} ${`${(s.win / TOTAL * 100).toFixed(1)}%`.padStart(6)}`
    + `   ${(s.stages / TOTAL).toFixed(2).padStart(5)}`
    + `  ${per('battles')}  ${per('drops')}  ${per('kept')}`
    + `  ${(s.overflow / TOTAL).toFixed(2).padStart(6)}`
    + `  ${(s.lost / TOTAL).toFixed(2).padStart(6)}`
    + `  ${per('cards')}   ${r}`
    + `  ${(s.gold / TOTAL).toFixed(0).padStart(6)}  ${f1(s.heldEnd)}`);
}
console.log(`\n（掉落/局 = 一局里「掉了东西」的次数；收下/局 = 真的进背包的次数（含背包满时换掉一件）；` +
  `溢出/局 = 背包满弹出「丢掉一件 / 不要」的次数；白掉/局 = 弹出后玩家选了不要；
  金币/局 = 只有战斗奖励金币，不含章节通关奖励；正片共 ${stageCount()} 章）`);
