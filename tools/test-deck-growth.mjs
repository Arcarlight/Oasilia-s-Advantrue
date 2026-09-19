// 回归测试：**一次操作只会给一张牌**。
//
// 接的是「只有一张羽栖，战斗里却抽出两张」这条反馈。
// tools/test-deck-integrity.mjs 已经证明了战斗引擎内部不会凭空复制牌，
// 所以剩下的可能是「某个操作一次性往卡组里塞了两张同名卡」——
// 玩家在卡组页看到「羽栖 ×2」却以为「我明明只有一张」，就会报成战斗 bug。
//
// 做法：跑很多整局，把每个「玩家操作」包起来，统计这次操作里 addCard 被调了几次。
// 同一次操作里同一个 id 出现两次 = 违规。
//
// 用法：node tools/test-deck-growth.mjs [局数]
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

const RUNS = Number(process.argv[2] ?? 150);
let pass = 0;
let fail = 0;
const ok = (cond, label, extra = '') => {
  if (cond) { pass += 1; console.log(`  ✓ ${label}${extra ? ' — ' + extra : ''}`); }
  else { fail += 1; console.log(`  ✗ ${label}${extra ? ' — ' + extra : ''}`); }
};

/** 每次「玩家操作」里 addCard 的流水 */
function instrument(game) {
  const log = [];
  // 用栈而不是一个槽位：`takeRewardCard` 在首领奖励里会顺手调 `nextStage()`，
  // 两个都是被包过的操作 —— 内层结束时如果把槽位清空，外层就记录不到自己的加牌了。
  // 加牌统一记到**最外层**那一帧，这样一次玩家操作的收益会完整地滚到一起。
  const stack = [];
  const rawAdd = game.addCard.bind(game);
  const rawRemove = game.removeCard.bind(game);
  game.addCard = (id) => { if (stack.length) { stack[0].added.push(id); } return rawAdd(id); };
  game.removeCard = (id) => { if (stack.length) { stack[0].removed.push(id); } return rawRemove(id); };

  const wrap = (name, fn) => (...args) => {
    const before = game.data.deck.length;
    const frame = { added: [], removed: [] };
    stack.unshift(frame);
    try {
      return fn(...args);
    } finally {
      stack.shift();
      log.push({
        action: name,
        added: frame.added.slice(),
        removed: frame.removed.slice(),
        // 换牌（营地冥想）是「去掉一张 + 加一张」，长度不变但确实换了；
        // 所以对账要写成 加 - 减 = 长度变化，不能只看加了几张
        delta: game.data.deck.length - before,
      });
    }
  };

  game.goToNode = wrap('goToNode', game.goToNode.bind(game));
  game.takeRewardCard = wrap('takeRewardCard', game.takeRewardCard.bind(game));
  game.buy = wrap('buy', game.buy.bind(game));
  game.chooseEventOption = wrap('chooseEventOption', game.chooseEventOption.bind(game));
  game.restUpgrade = wrap('restUpgrade', game.restUpgrade.bind(game));
  game.nextStage = wrap('nextStage', game.nextStage.bind(game));
  return log;
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
  return b.winner === 'player';
}
function drink(game, threshold) {
  let used = 0;
  while (game.data.hp / game.data.maxHp < threshold && used++ < 5) {
    const items = game.data.items ?? {};
    if (items.potion_big) game.useItem('potion_big');
    else if (items.potion_small) game.useItem('potion_small');
    else break;
  }
}

const violations = [];
const bigGrants = [];
const multiIdActions = [];
const roostSources = [];

for (let i = 0; i < RUNS; i++) {
  const game = new Game({ seed: 900000 + i * 733 });
  game.newRun();
  const log = instrument(game);
  let guard = 0;
  while (guard++ < 500) {
    if (game.phase === 'map') {
      const opts = game.availableNodes();
      if (!opts.length) { game.nextStage(); continue; }
      const node = opts[Math.floor(Math.random() * opts.length)];
      if (node.type !== 'event') drink(game, 0.7);
      game.goToNode(node.id);
      continue;
    }
    if (game.phase === 'battle') {
      if (!fight(game)) break;
      game.finishBattle();
      continue;
    }
    if (game.phase === 'reward') {
      const choices = game.reward?.cardChoices ?? [];
      game.takeRewardCard(choices.length ? choices[0].id : null);
      continue;
    }
    if (game.phase === 'event') {
      game.chooseEventOption(Math.floor(Math.random() * game.event.options.length));
      game.leaveEvent();
      continue;
    }
    if (game.phase === 'chest') { game.leaveChest(); continue; }
    if (game.phase === 'rest') {
      if (game.data.hp / game.data.maxHp < 0.7) game.restHeal();
      else game.restUpgrade([...game.data.deck].sort((a, b) => (CARD_BY_ID[a]?.ap ?? 9) - (CARD_BY_ID[b]?.ap ?? 9))[0]);
      game.leaveRest();
      continue;
    }
    if (game.phase === 'shop') {
      const stock = game.shop.stock.map((s, idx) => ({ s, idx })).filter((x) => !game.shop.soldOut.includes(x.idx));
      const t = stock.sort((a, b) => b.s.price - a.s.price)[0];
      if (t && game.data.gold >= t.s.price) {
        game.buy(t.idx);
        if (game.pendingRemove) game.refundRemove?.();
      }
      game.leaveShop();
      continue;
    }
    break;
  }

  for (const step of log) {
    // ① 一次操作里同一个 id 加了两遍 —— 这才是「凭空多一张」
    const seen = new Set();
    for (const id of step.added) {
      if (seen.has(id)) {
        violations.push(`第${i}局 ${step.action}：同一张卡 ${CARD_BY_ID[id]?.name ?? id} 一次加了 2 份`);
      }
      seen.add(id);
    }
    if (step.added.length > 1) bigGrants.push(`第${i}局 ${step.action} 一次给了 ${step.added.length} 张`);
    // ② 一次玩家操作最多给一张牌。
    //    注意不能写成「加 - 减 = 长度变化」：营地冥想是直接 `data.deck.splice()` 换牌的，
    //    不经过 removeCard，所以减号那一侧本来就记不到（第一版就是这么误报的）。
    //    真正的性质只有一条 —— **一次操作不会给出两张牌**。
    if (step.added.length > 1) {
      multiIdActions.push(`第${i}局 ${step.action}：一次加了 ${step.added.length} 张`);
    }
    if (step.added.includes('roost')) roostSources.push(step.action);
  }
}

console.log(`\n① ${RUNS} 局全流程，逐操作检查「有没有一次给两张同名卡」`);
ok(!violations.length, '没有任何一次操作会给同一张卡加 2 份', violations.slice(0, 3).join(' ｜ '));
ok(!multiIdActions.length, '没有任何一次玩家操作会一次给出两张牌', multiIdActions.slice(0, 3).join(' ｜ '));

console.log('\n② 顺带统计：一次操作最多给几张牌');
const byAction = new Map();
for (const s of bigGrants) byAction.set(s.split(' ')[1], (byAction.get(s.split(' ')[1]) ?? 0) + 1);
ok(!bigGrants.length, `一次给 ≥2 张的操作共 ${bigGrants.length} 次`,
  bigGrants.length ? [...byAction].map(([a, n]) => `${a}×${n}`).join(' ') : '（没有）');

console.log('\n③ 顺带记录：「羽栖」都是从哪些操作来的（方便对着玩家的描述核对）');
if (roostSources.length) {
  const c = new Map();
  for (const a of roostSources) c.set(a, (c.get(a) ?? 0) + 1);
  console.log(`  · ${[...c].map(([a, n]) => `${a}×${n}`).join('  ')}`);
} else {
  console.log(`  · 这 ${RUNS} 局里没有出现过「羽栖」`);
}

// ---------------- ④ 奖励保底：两条保底不能互相覆盖 ----------------
// 这是查「只有一张羽栖却抽出两张」时**顺手挖出来的真 bug**：
// 既缺回血牌又缺解状态牌时（第 2 章起很常见），两条保底都替换「最后一个选项」，
// 于是后一条把前一条刚放好的牌顶掉了 —— 实测 200/200 次奖励里一张回血牌都没有，
// 也就是 README 里承诺的「必出一张回血牌」**一直是失效的**。
console.log('\n④ 奖励保底：既没有回血牌、也没有解状态牌时，两条都得生效');
{
  const mk = (seed, stage) => {
    const g = new Game({ seed });
    g.newRun();
    g.data.stage = stage;
    g.data.deck = ['tackle', 'bite', 'harden', 'double_kick'];   // 既无 heal 也无 cleanse
    return g;
  };
  const kindsOf = (cards) => {
    const k = new Set();
    for (const c of cards) for (const e of c.effects ?? []) k.add(e.kind);
    return k;
  };

  let noHeal = 0;
  let noCleanse = 0;
  let malformed = 0;
  const N = 200;
  for (let i = 0; i < N; i++) {
    const g = mk(5000 + i, 1);
    const picked = g.withSustainPity([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
    const k = kindsOf(picked);
    if (!k.has('heal')) noHeal += 1;
    if (!k.has('cleanse')) noCleanse += 1;
    if (picked.length !== 3 || new Set(picked.map((c) => c.id)).size !== 3) malformed += 1;
  }
  ok(noHeal === 0, '缺回血牌时奖励里必有一张回血牌（不再被后一条保底顶掉）', `${N} 次里缺 ${noHeal} 次`);
  ok(noCleanse === 0, '缺解状态牌时奖励里必有一张解状态牌', `${N} 次里缺 ${noCleanse} 次`);
  ok(malformed === 0, '两个保底各占一个槽位，选项不重复也不丢', `${malformed} 次异常`);

  // 第 1 章不该出解状态保底（README 里承诺的规则）。
  //
  // 这里必须用**固定的三个选项**来测，不能靠「随机抽出来的结果里有没有 cleanse」：
  // 卡池里有好几种解状态牌，随机抽本身就有几个百分点会抽中，
  // 断言「100 次里一次都不出现」等于在赌卡池大小 —— 卡池一扩就会假警报。
  // 现在直接喂三个已知卡，看保底**换进来**的是不是解状态牌。
  {
    const feed = () => [
      { ...CARD_BY_ID.tackle }, { ...CARD_BY_ID.bite }, { ...CARD_BY_ID.harden },
    ];
    const stage0 = kindsOf(mk(7000, 0).withSustainPity(feed()));
    const stage1 = kindsOf(mk(7001, 1).withSustainPity(feed()));
    ok(stage0.has('heal') && !stage0.has('cleanse'),
      '第 1 章只触发回血保底，不触发解状态保底', `第 1 章拿到 ${[...stage0].join('/')}；第 2 章拿到 ${[...stage1].join('/')}`);
    ok(stage1.has('heal') && stage1.has('cleanse'),
      '第 2 章起两条保底各占一个槽位，都在', `第 2 章拿到 ${[...stage1].join('/')}`);
  }

  // 保底只动末尾，前两个随机选项要保留
  let frontTouched = 0;
  for (let i = 0; i < 100; i++) {
    const g = mk(9000 + i, 1);
    g.data.deck = ['roost', 'tackle', 'harden', 'bite'];   // 已经有回血牌
    const picked = g.withSustainPity([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
    if (picked[0].id !== 'a' || picked[1].id !== 'b') frontTouched += 1;
  }
  ok(frontTouched === 0, '保底只动末尾的选项，前两个随机结果始终保留', `${frontTouched} 次被改动`);
}

console.log(`\n卡组增长回归测试：通过 ${pass}，失败 ${fail}`);
if (fail) process.exitCode = 1;
