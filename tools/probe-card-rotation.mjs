// 讲清「我只有一张羽栖，战斗里却抽出了两张」这件事的一次性排查脚本。
//
// 它做两件事：
//   ① 把一场战斗里「羽栖」每次出现时的 **uid** 打出来 —— 一张牌整场战斗只有一个 uid，
//      所以如果两次抽到的 uid 相同，那就是同一张牌在自己轮换（打出去洗回牌堆底端、
//      又被抽回来），**不是被复制成了两张**；
//   ② 顺手验证奖励保底 withSustainPity：既缺回血牌又缺解状态牌时，两条保底会不会互相覆盖。
//
// 用法：node tools/probe-card-rotation.mjs
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
const { CARD_BY_ID } = await imp('src/data/cards.js');
const PILES = ['draw', 'hand', 'discard', 'exhaust'];

// ---------------- ① 同一张羽栖被抽到两次时，uid 是不是同一个？ ----------------
console.log('\n=== ① 卡组里只有 1 张「羽栖」，它在同一场战斗里被抽到两次的痕迹 ===');
{
  const deck = ['roost', 'tackle', 'harden', 'bite'];
  const game = new Game({ seed: 2468 });
  game.newRun();
  game.data.deck = deck.slice();
  game.startBattle('normal', 0);
  const b = game.battle;

  console.log(`  开局：卡组 ${deck.map((id) => CARD_BY_ID[id].name).join('、')}（共 ${deck.length} 张）`);
  // 开战时已经抽过一轮了，所以「羽栖」可能已经在手牌里 —— 四堆都找一遍
  const where = PILES.find((p) => b.decks.player[p].some((e) => e.id === 'roost'));
  const entry = b.decks.player[where].find((e) => e.id === 'roost');
  console.log(`  「羽栖」这份牌现在在「${where}」里，uid = ${entry.uid}（整场战斗里这一张就这一个 uid）`);

  const trace = [];
  const uids = new Set();
  for (let turn = 0; turn < 12 && !b.over; turn++) {
    for (const e of b.hand('player').filter((c) => c.id === 'roost')) {
      trace.push(`第${b.turn}回合 抽到 羽栖(uid ${e.uid})`);
      uids.add(e.uid);
    }
    for (let g = 0; g < 20; g++) {
      const playable = b.hand('player').filter((c) => b.canPlay(c.uid));
      if (!playable.length) break;
      const pick = playable.find((c) => c.id === 'roost') ?? playable[0];
      const isRoost = pick.id === 'roost';
      b.playCard(pick.uid);
      b.takeEvents();
      if (isRoost) trace.push(`第${b.turn}回合 打出 羽栖(uid ${pick.uid}) → 洗回牌堆最底端（牌堆 ${b.decks.player.draw.length} 张）`);
    }
    if (b.over) break;
    b.endTurn();
    b.takeEvents();
    if (b.over) break;
  }

  const shown = trace.slice(0, 14);
  for (const t of shown) console.log('  ' + t);
  if (trace.length > shown.length) console.log(`  ……（另有 ${trace.length - shown.length} 条同类记录）`);
  console.log(`  → 全程出现的「羽栖」uid 集合 = {${[...uids].join(', ')}}`);
  console.log(uids.size <= 1
    ? '  → 结论：**始终是同一张牌**在自己轮换，不是被复制成了两张。'
    : `  → 结论：出现了 ${uids.size} 个不同 uid —— 这才是真的多了一份！`);
  console.log(`  → 注意牌堆只有 ${deck.length} 张：每回合抽 5 张就能把整副牌翻一遍，`);
  console.log('     所以小卡组里「同一张牌每回合都出现」是正常的。');
}

// ---------------- ② 奖励保底：后一次替换会不会把前一次覆盖掉？ ----------------
console.log('\n=== ② 奖励保底 withSustainPity：既没回血牌、也没解状态牌时 ===');
{
  const mk = (seed, stage) => {
    const g = new Game({ seed });
    g.newRun();
    g.data.stage = stage;
    g.data.deck = ['tackle', 'bite', 'harden', 'double_kick'];
    return g;
  };
  const kindsOf = (cards) => {
    const k = new Set();
    for (const c of cards) for (const e of c.effects ?? []) k.add(e.kind);
    return k;
  };

  const N = 200;
  let noHeal = 0;
  let noCleanse = 0;
  for (let i = 0; i < N; i++) {
    const k = kindsOf(mk(5000 + i, 1).withSustainPity([{ id: 'a' }, { id: 'b' }, { id: 'c' }]));
    if (!k.has('heal')) noHeal += 1;
    if (!k.has('cleanse')) noCleanse += 1;
  }
  console.log(`  ${N} 次奖励里：没有回血牌 ${noHeal} 次（承诺必出，应当 0）、没有解状态牌 ${noCleanse} 次（应当 0）`);
  console.log(noHeal === 0
    ? '  → 回血保底生效'
    : '  → **回血保底被后一次「解状态保底」挤掉了**（两条保底抢同一个槽位）');
}
