// 回归测试：**牌堆守恒** —— 玩家报告「只有一张羽栖，战斗里却抽出了两张」。
//
// 引擎里每张牌是一个 entry 对象，`uid` 在整场战斗内唯一（`buildDeck` 用「下标-id」生成）。
// 任何一张牌在**任意时刻**都只能待在下面几个地方之一：
//   draw（牌堆）/ hand（手牌）/ discard（弃牌堆）/ exhaust（销毁堆）/ 「正在打出、还没归位」
// 一旦某个 uid 同时出现在两处、或者四堆总数对不上开局卡组，玩家就会看到「凭空多了一张」。
//
// 关于「在途」：`playCard()` 会先把牌从手牌拿走、跑完效果、最后才推进弃牌堆。
// 如果这张牌自己有「抽 N 张」的效果，那它在抽牌的那一刻确实是**哪一堆都不在**的 ——
// 这是正常的，所以不变量写的是 `四堆总数 + 在途张数 = 开局卡组张数`。
// （第一版测试忘了这一条，于是把正常行为误报成了 bug。）
//
// 用法：node tools/test-deck-integrity.mjs
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '..');
const imp = (rel) => import(pathToFileURL(path.join(ROOT, rel)).href);
globalThis.localStorage = {
  _m: new Map(),
  getItem(k) { return this._m.get(k) ?? null; },
  setItem(k, v) { this._m.set(k, String(v)); },
  removeItem(k) { this._m.delete(k); },
};

const { Game } = await imp('src/core/game.js');
const { CARD_BY_ID, CARDS } = await imp('src/data/cards.js');

let pass = 0;
let fail = 0;
const ok = (cond, label, extra = '') => {
  if (cond) { pass += 1; console.log(`  ✓ ${label}${extra ? ' — ' + extra : ''}`); }
  else { fail += 1; console.log(`  ✗ ${label}${extra ? ' — ' + extra : ''}`); }
};

const PILES = ['draw', 'hand', 'discard', 'exhaust'];
const countBy = (ids) => ids.reduce((m, id) => m.set(id, (m.get(id) ?? 0) + 1), new Map());

/**
 * 给一场战斗装上守恒检查器。返回的 `problems` 会一直累加，
 * 每打一张牌、每抽一次牌都会被查一遍（抽牌是最容易出重复的地方）。
 */
function watch(battle, deck) {
  const deckSize = deck.length;
  const base = countBy(deck);
  const problems = [];
  let inFlight = 0;

  const origPlay = battle.playCard.bind(battle);
  const origDraw = battle.drawCards.bind(battle);

  const check = (where) => {
    const where_ = new Map();
    for (const p of PILES) {
      for (const e of battle.decks.player[p]) {
        if (!where_.has(e.uid)) where_.set(e.uid, []);
        where_.get(e.uid).push(p);
      }
    }
    const dup = [...where_].filter(([, w]) => w.length > 1);
    if (dup.length) {
      problems.push(`${where}：同一个 uid 出现在多处 ${dup.map(([u, w]) => `${u}@${w.join('+')}`).join(',')}`);
    }
    const total = PILES.reduce((n, p) => n + battle.decks.player[p].length, 0);
    if (total + inFlight !== deckSize) {
      problems.push(`${where}：四堆 ${total} + 在途 ${inFlight} ≠ 开局 ${deckSize}`);
    }
    const handIds = countBy(battle.hand('player').map((c) => c.id));
    for (const [id, n] of handIds) {
      if (n > (base.get(id) ?? 0)) {
        problems.push(`${where}：手牌里 ${id} 有 ${n} 张，开局卡组里只有 ${base.get(id) ?? 0} 张`);
      }
    }
  };

  battle.playCard = (uid, opts) => {
    inFlight += 1;
    try { return origPlay(uid, opts); } finally { inFlight -= 1; check('打牌后'); }
  };
  battle.drawCards = (key, n) => {
    const out = origDraw(key, n);
    if (key === 'player') check('抽牌后');
    return out;
  };

  check('开局');
  return {
    problems,
    check,
    maxHandOf: (id) => Math.max(0, battle.hand('player').filter((c) => c.id === id).length),
  };
}

function startBattleWith(deck, seed) {
  const game = new Game({ seed });
  game.newRun();
  game.data.deck = deck.slice();
  game.data.battleDeck = null;
  game.startBattle('normal', 0);
  return game.battle;
}

/** 打一整场：每回合把能打的都打掉，然后结束回合 */
function playOut(b, turns = 24) {
  let n = 0;
  for (let t = 0; t < turns && !b.over; t++) {
    for (let g = 0; g < 40; g++) {
      const hand = b.hand('player').filter((c) => b.canPlay(c.uid));
      if (!hand.length) break;
      b.playCard(hand[0].uid);
      b.takeEvents();
    }
    if (b.over) break;
    b.endTurn();
    b.takeEvents();
    n += 1;
  }
  return n;
}

console.log('\n① 最小复现：卡组里只有 1 张「羽栖」，逐次抽 / 打 / 结束回合');
{
  const deck = ['roost', 'tackle', 'tackle', 'harden', 'bite', 'bite'];
  const b = startBattleWith(deck, 777);
  const w = watch(b, deck);
  let roostMax = 0;
  const origCheck = w.check;
  // 每打一张牌后顺手记一下「手里最多同时有几张羽栖」
  const origPlay = b.playCard.bind(b);
  b.playCard = (uid, opts) => { const r = origPlay(uid, opts); roostMax = Math.max(roostMax, w.maxHandOf('roost')); return r; };
  playOut(b, 24);
  origCheck('收尾');
  roostMax = Math.max(roostMax, w.maxHandOf('roost'));

  ok(!w.problems.length, '整场战斗里牌堆守恒始终成立（没有凭空多出来的牌）', w.problems.slice(0, 3).join(' ｜ '));
  ok(roostMax <= 1, '「羽栖」在手里最多同时只有 1 张（卡组里本来就 1 张）',
    `实测最多同时 ${roostMax} 张；终局 我方 HP ${Math.round(b.player.hp)} / 敌方 HP ${Math.round(b.enemy.hp)}`);
}

console.log('\n② 极端卡组：2 张牌、0 费抽牌，一回合内反复抽回来（这是允许的轮换）');
{
  const deck = ['bullet_punch', 'quick_attack'];
  const b = startBattleWith(deck, 99);
  const w = watch(b, deck);
  let maxAny = 0;
  const origPlay = b.playCard.bind(b);
  b.playCard = (uid, opts) => {
    const r = origPlay(uid, opts);
    for (const id of deck) maxAny = Math.max(maxAny, w.maxHandOf(id));
    return r;
  };
  playOut(b, 20);
  w.check('收尾');
  ok(!w.problems.length, '2 张卡组反复轮换时也不会凭空多牌', w.problems.slice(0, 3).join(' ｜ '));
  ok(maxAny <= 1, '轮换 = 同一张牌来回跑，不是被复制成两份', `手里同名最多同时 ${maxAny} 张`);
}

console.log('\n③ 全卡池扫一遍：每种卡单独放进小卡组打一遍');
{
  const bad = [];
  for (const card of CARDS) {
    // 填充牌必须和被测的卡不同名，否则「手里 2 张」是卡组本身就带了 2 张
    // （第一版就踩了这个：测到「变硬」时填充牌也叫 harden，于是误报）
    const fillers = ['tackle', 'harden', 'bite'].filter((id) => id !== card.id).slice(0, 2);
    const deck = [card.id, ...fillers].filter((id) => CARD_BY_ID[id]);
    const b = startBattleWith(deck, 1234);
    const w = watch(b, deck);
    let maxSame = 0;
    const origPlay = b.playCard.bind(b);
    b.playCard = (uid, opts) => { const r = origPlay(uid, opts); maxSame = Math.max(maxSame, w.maxHandOf(card.id)); return r; };
    playOut(b, 12);
    w.check('收尾');
    maxSame = Math.max(maxSame, w.maxHandOf(card.id));
    if (w.problems.length) { bad.push(`「${card.name}」：${w.problems[0]}`); break; }
    if (maxSame > 1) { bad.push(`「${card.name}」手里同时出现 ${maxSame} 张（卡组里只有 1 张）`); break; }
  }
  ok(!bad.length, `全部 ${CARDS.length} 种卡各跑一遍，都没有出现重复`, bad.slice(0, 3).join(' ｜ '));
}

console.log('\n④ 整局模拟：一副正常卡组打到分出胜负');
{
  const deck = [
    'tackle', 'tackle', 'bite', 'bite', 'harden', 'roost', 'double_kick',
    'bullet_punch', 'quick_attack', 'iron_defense', 'dragon_breath',
  ].filter((id) => CARD_BY_ID[id]);
  const b = startBattleWith(deck, 20240607);
  const w = watch(b, deck);
  const turns = playOut(b, 40);
  w.check('收尾');
  ok(!w.problems.length, `整局 ${turns} 回合打下来，牌堆守恒始终成立`,
    w.problems.slice(0, 3).join(' ｜ ') || `终局 我方 ${Math.round(b.player.hp)} / 敌方 ${Math.round(b.enemy.hp)}`);
}

console.log('\n⑤ 存档往返：写盘 → 读回 → 卡组张数与每种卡的份数都不许变');
{
  const { save } = await imp('src/core/save.js');
  const game = new Game({ seed: 555 });
  game.newRun();
  game.data.phase = undefined;
  const before = game.data.deck.slice();
  save.writeRun(game.data);
  const game2 = new Game({ seed: 1 });
  const okLoad = game2.loadFromData(save.readRun());
  const after = game2.data?.deck ?? [];
  ok(okLoad && after.length === before.length, '存档往返之后卡组张数不变', `${before.length} → ${after.length}`);
  const c1 = countBy(before);
  const c2 = countBy(after);
  const diff = [...c1].filter(([id, n]) => (c2.get(id) ?? 0) !== n);
  ok(!diff.length, '每种卡在存档往返之后份数也不变',
    diff.map(([id, n]) => `${id} ${n}→${c2.get(id) ?? 0}`).join(',') || `共 ${c1.size} 种`);

  // 反复存档 / 读档 20 次，份数不能被慢慢放大
  let cur = before.slice();
  for (let i = 0; i < 20; i++) {
    const g = new Game({ seed: i + 1 });
    if (!g.loadFromData(save.readRun())) break;
    save.writeRun(g.data);
    cur = g.data.deck.slice();
  }
  ok(cur.length === before.length, '连续存档 / 读档 20 次之后卡组张数依然不变', `${before.length} → ${cur.length}`);
}

console.log('\n⑥ 牌的流向：打出去进**弃牌区**；牌堆抽空才洗回来；手牌满了不丢牌');
{
  // 用户点名的规则：「卡打出去以后会进入弃牌区而不是再放入卡组，
  // 直到卡组抽光以后才会让弃牌区回到卡组」。
  // 这条以前是「打出去塞回牌堆最底端」，而且手牌满时**静默把抽到的牌丢进弃牌堆** ——
  // 玩家看到的就是「我什么都没干，牌怎么莫名其妙进了弃牌区」。这三条都钉在这里。
  const deck = ['tackle', 'tackle', 'tackle', 'bite', 'harden', 'roost'];
  const b = startBattleWith(deck, 2024);

  // ① 打一张普通牌 → 进弃牌区，牌堆张数不变
  const drawBefore = b.decks.player.draw.length;
  const discardBefore = b.decks.player.discard.length;
  const first = b.hand('player').find((c) => b.canPlay(c.uid));
  const firstId = first.id;
  b.playCard(first.uid);
  b.takeEvents();
  ok(b.decks.player.discard.some((e) => e.uid === first.uid),
    '打出去的牌进了**弃牌区**', `打出「${firstId}」uid=${first.uid}，弃牌 ${discardBefore} → ${b.decks.player.discard.length}`);
  ok(!b.decks.player.draw.some((e) => e.uid === first.uid),
    '打出去的牌**没有**被塞回牌堆（旧规则是塞回最底端）');
  ok(b.decks.player.draw.length === drawBefore,
    '牌堆张数不受出牌影响', `${drawBefore} → ${b.decks.player.draw.length}`);

  // ② 把手牌打空 + 牌堆抽空，再抽牌 → 弃牌区必须洗回牌堆
  const b2 = startBattleWith(deck, 2024);
  // 直接把牌堆清空（模拟「抽光了」），弃牌区留着几张
  b2.decks.player.draw = [];
  b2.decks.player.hand = [];
  const seedCards = deck.map((id, i) => ({ uid: `seed-${i}`, id, card: CARD_BY_ID[id] }));
  b2.decks.player.discard = seedCards;
  b2.takeEvents();               // 丢掉开局那批事件，只看这次抽牌发了什么
  b2.drawCards('player', 3);
  const evs = b2.takeEvents();
  ok(b2.decks.player.hand.length === 3 && b2.decks.player.draw.length === 3 && b2.decks.player.discard.length === 0,
    '牌堆抽空后再抽 → 弃牌区洗回牌堆，接着抽得到',
    `手牌 ${b2.decks.player.hand.length} / 牌堆 ${b2.decks.player.draw.length} / 弃牌 ${b2.decks.player.discard.length}（弃牌区原本 6 张）`);
  ok(evs.some((e) => e.type === 'reshuffle'), '发了一个「洗牌」事件（界面会提示）', evs.map((e) => e.type).join(','));

  // ③ 手牌满时抽牌：**不许**把牌丢进弃牌区，也不许白洗一次牌
  const b3 = startBattleWith(deck, 2024);
  const max = b3.player.handMax;
  b3.decks.player.hand = deck.map((id, i) => ({ uid: `h-${i}`, id, card: CARD_BY_ID[id] }));
  b3.decks.player.draw = [{ uid: 'd-0', id: deck[0], card: CARD_BY_ID[deck[0]] }];
  b3.decks.player.discard = [];
  const totalBefore = b3.decks.player.hand.length + b3.decks.player.draw.length + b3.decks.player.discard.length;
  b3.drawCards('player', 3);
  const totalAfter = b3.decks.player.hand.length + b3.decks.player.draw.length + b3.decks.player.discard.length;
  ok(b3.decks.player.hand.length === max && b3.decks.player.discard.length === 0,
    `手牌已经到上限（${max}）时抽牌不会把牌丢进弃牌区`,
    `手牌 ${b3.decks.player.hand.length} / 牌堆 ${b3.decks.player.draw.length} / 弃牌 ${b3.decks.player.discard.length}`);
  ok(totalAfter === totalBefore, '牌一张都没少（三堆总数不变）', `${totalBefore} → ${totalAfter}`);
}

console.log('\n⑦ 哨兵自检：故意把同一张牌塞进两堆，checkPileIntegrity 必须报出来');
{
  const deck = ['roost', 'tackle', 'harden'];
  const b = startBattleWith(deck, 42);
  // 先确认正常情况下哨兵不响（不然「没报警」这个结论没有意义）
  const clean = b.checkPileIntegrity('自检-正常');
  // 再故意制造重复：把手里的一张牌再往弃牌堆塞一份（开战后牌堆可能已经被抽空了，
  // 所以从手牌拿，不能假设 draw 里还有牌）
  const dup = b.decks.player.hand[0] ?? b.decks.player.draw[0];
  b.decks.player.discard.push(dup);
  const caught = !b.checkPileIntegrity('自检-故意重复');
  ok(clean, '正常情况下哨兵不响（不会误报）');
  ok(caught, '故意制造重复时哨兵会响 —— 检具本身是有效的',
    `拿「${dup?.card?.name ?? dup?.id}」uid=${dup?.uid} 同时放进 hand 和 discard`);
}

console.log(`\n牌堆守恒回归测试：通过 ${pass}，失败 ${fail}`);
if (fail) process.exitCode = 1;
