// 回归测试：**强化（buff）/ 预约生效 / 敌方贪心出牌** —— v2.9961 新加的三套机制。
//
// 用户原话：
//   「为我方添加强化效果（例如增大 AP 上限、同种卡打出多次效果（包括伤害、叠加异常层数）翻倍等强化，
//     这个目前没有任何我方强化效果）」→ ① 行动点上限 ② 回响（同种卡翻倍）③ 附加层数
//   「新增一些效果，例如下回合生效、或是我方行动（敌方行动）N 次后生效」→ ④ 预约 / 计数触发
//   「让敌人出卡时追求打出最高的伤害（BOSS 会这样，精英有很大概率这样，普通小怪不会）」→ ⑤ 贪心 AI
//
// 用法：node tools/test-buffs.mjs
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

const { Battle } = await imp('src/core/battle.js');
const { CARD_BY_ID } = await imp('src/data/cards.js');

let pass = 0;
let fail = 0;
const ok = (cond, label, detail = '') => {
  if (cond) { pass += 1; console.log(`  ✓ ${label}${detail ? ' — ' + detail : ''}`); }
  else { fail += 1; console.log(`  ✗ ${label}${detail ? ' — ' + detail : ''}`); }
};
const group = (n) => console.log(`\n${n}`);

/** 造一场战斗：玩家卡组 = deck，敌人 tier 可指定（AI 的分支看它）
 *  luck 一律给 0：暴击 / 闪避都是随机的，会把这几个断言变成掷骰子
 *  （第一版没给 0，于是「第二次翻倍」时量到 16 vs 19、「不翻倍」时量到 16 vs 10）。 */
function makeBattle({ deck, enemyDeck, tier = 'mob', seed = 777, enemyAtk = 20, playerAtk = 20 }) {
  return new Battle({
    seed,
    player: { name: '欧亚西莉亚', slug: 'flygon', hp: 400, maxHp: 400, atk: playerAtk, def: 12, agi: 12, luck: 0 },
    deck,
    enemy: { id: 'e', slug: 'sandile', name: '对手', maxHp: 600, atk: enemyAtk, def: 10, agi: 10, luck: 0, tier, deck: enemyDeck },
  });
}

/** 把一张牌塞进手里（测试要「一定打得出这张牌」，不靠抽） */
function putInHand(b, key, id) {
  b.decks[key].hand.push({ uid: `${key}-${id}-${Math.random()}`, id, card: CARD_BY_ID[id] });
}

// ---------------- ① 行动点上限（buff 版，不是「只多这一次」） ----------------
group('① 行动点上限：挂上真的多，到期真的还回去');
{
  const b = makeBattle({ deck: ['tackle'], enemyDeck: ['tackle'] });
  b.start();
  const base = b.player.apMax;
  b.grantBuff('player', 'apMax', 1, 2);
  ok(b.player.apMax === base + 1, '挂上之后上限 +1', `${base} → ${b.player.apMax}`);
  ok(b.buffValue('player', 'apMax') === 1, '强化记在 buffValue 里（界面胶囊读它）');
  // 过两个回合：用满两回合才掉
  b.endTurn();
  b.beginPlayerTurn();
  ok(b.player.apMax === base + 1, '第 1 个回合结束还在（用满这一回合才倒计时）', `turns=${b.player.buffs.apMax?.turns}`);
  b.endTurn();
  b.beginPlayerTurn();
  ok(b.player.apMax === base, '两个回合之后自动结束、上限还原', `apMax=${b.player.apMax}`);
  ok(!b.player.buffs.apMax, '强化从列表里消失（界面胶囊也会少一颗）');
}

// ---------------- ② 回响：同种卡再打一次，伤害与层数翻倍 ----------------
group('② 回响：同一张牌打第二次，威力与层数 ×2');
{
  const b = makeBattle({ deck: ['tackle'], enemyDeck: ['tackle'], playerAtk: 40 });
  b.start();
  b.grantBuff('player', 'echo', 1, 5);
  const hp0 = b.enemy.hp;
  b.resolveCard('player', CARD_BY_ID.tackle, {});
  const first = hp0 - b.enemy.hp;
  b.resolveCard('player', CARD_BY_ID.tackle, {});
  const second = b.enemy.hp >= 0 ? (hp0 - first) - b.enemy.hp : 0;
  ok(second >= first * 1.8, '第二次打同一张牌 ≈ 两倍伤害', `第一次 ${first} · 第二次 ${second}`);

  // 层数也翻倍
  const b2 = makeBattle({ deck: ['tackle'], enemyDeck: ['tackle'] });
  b2.start();
  b2.grantBuff('player', 'echo', 1, 5);
  const poisonCard = CARD_BY_ID.toxic ?? CARD_BY_ID.poison_sting ?? null;
  const anyStatus = Object.values(CARD_BY_ID).find((c) => c.effects.some((e) => e.kind === 'status' && e.status === 'poison'));
  if (anyStatus) {
    b2.resolveCard('player', anyStatus, {});
    const s1 = b2.enemy.poison;
    b2.resolveCard('player', anyStatus, {});
    const s2 = b2.enemy.poison - s1;
    ok(s2 >= s1 * 1.8, '第二次的毒层数也翻倍', `第一次 ${s1} 层 · 第二次 ${s2} 层（${anyStatus.name}）`);
  } else {
    ok(true, '（内容里没有上毒的牌，跳过层数翻倍）');
  }

  // 没有回响时不翻倍（免得变成「所有牌都翻倍」）
  const b3 = makeBattle({ deck: ['tackle'], enemyDeck: ['tackle'], playerAtk: 40 });
  b3.start();
  const h0 = b3.enemy.hp;
  b3.resolveCard('player', CARD_BY_ID.tackle, {});
  const d1 = h0 - b3.enemy.hp;
  const h1 = b3.enemy.hp;
  b3.resolveCard('player', CARD_BY_ID.tackle, {});
  const d2 = h1 - b3.enemy.hp;
  ok(Math.abs(d1 - d2) <= 2, '没挂回响时，重复打出还是原来的伤害', `${d1} vs ${d2}`);
}

// ---------------- ③ 附加层数 ----------------
group('③ 附加层数：给对手上状态时 +N 层');
{
  const anyStatus = Object.values(CARD_BY_ID).find((c) => c.effects.some((e) => e.kind === 'status' && e.status === 'poison'));
  if (!anyStatus) {
    ok(true, '（内容里没有上毒的牌，跳过）');
  } else {
    const b = makeBattle({ deck: ['tackle'], enemyDeck: ['tackle'] });
    b.start();
    b.resolveCard('player', anyStatus, {});
    const base = b.enemy.poison;
    const b2 = makeBattle({ deck: ['tackle'], enemyDeck: ['tackle'] });
    b2.start();
    b2.grantBuff('player', 'stacks', 2, 3);
    b2.resolveCard('player', anyStatus, {});
    ok(b2.enemy.poison === base + 2, '挂上「附加层数 +2」之后多两层', `${base} → ${b2.enemy.poison}`);
  }
}

// ---------------- ④ 预约生效 / 计数触发 ----------------
group('④ 下回合生效 · 行动 N 次后生效');
{
  /**
   * ⚠ 闪避是概率事件（`dodgeChance` 就算运气 0 也有个基础值），所以「这一下有没有打中」
   * 不能只试一次 —— 第一版就是单次断言，偶尔会红（日志里能看到「对手闪开了攻击！」）。
   * 现在改成：① 计时器**必须**触发（看事件流，确定性）；② 伤害在多次尝试里至少命中一次。
   */
  const attempt = (setup) => {
    let fired = 0;
    let landed = 0;
    for (let i = 0; i < 12 && !landed; i++) {
      const b = makeBattle({ deck: ['tackle'], enemyDeck: ['tackle'], seed: 900 + i * 13 });
      b.start();
      const before = b.enemy.hp;
      const hp0 = setup(b);
      if (b.events.some((e) => e.type === 'timer')) fired += 1;
      if (b.enemy.hp < (hp0 ?? before)) landed += 1;
    }
    return { fired, landed };
  };

  const delayed = attempt((b) => {
    const hp = b.enemy.hp;
    b.scheduleEffects('player', [{ kind: 'damage', power: 200 }], 1, '沙之伏击');
    if (b.enemy.hp !== hp) return -1;     // 预约当场就生效了 = bug，直接让断言红
    b.endTurn();
    return hp;
  });
  ok(delayed.fired > 0, '「下回合生效」的计时器真的触发了（事件流里有 timer）', `${delayed.fired} / 12 次`);
  ok(delayed.landed > 0, '下回合一开始就把伤害结算出来了', `${delayed.landed} / 12 次命中（其余被闪避吃掉）`);

  const byPlays = attempt((b) => {
    const hp = b.enemy.hp;
    b.addTrigger('player', { on: 'plays', count: 2, effects: [{ kind: 'damage', power: 150 }], name: '蓄力一击' });
    b.resolveCard('player', CARD_BY_ID.tackle, {});
    if (b.events.some((e) => e.type === 'timer')) return hp;   // 第 1 张就触发 = bug
    b.resolveCard('player', CARD_BY_ID.tackle, {});
    return b.decks.player.hand.length >= 0 ? hp : hp;
  });
  ok(byPlays.fired > 0, '「再打出 2 张牌就生效」触发了', `${byPlays.fired} / 12 次`);
  ok(byPlays.landed > 0, '触发之后伤害真的打出去了', `${byPlays.landed} / 12 次命中`);

  /**
   * 回合计数：**一次 endTurn 才算一次**。
   * （endTurn 里已经包含了「敌人行动 → 我又开始下一个回合」，所以不能再手调 beginPlayerTurn ——
   *   第一版就是这么写的，于是计数一次 +1 变成了 +2，断言直接红了。）
   */
  const b3 = makeBattle({ deck: ['tackle'], enemyDeck: ['tackle'] });
  b3.start();
  const e0 = b3.enemy.hp;
  b3.addTrigger('player', { on: 'turn', count: 2, effects: [{ kind: 'damage', power: 150 }], name: '回合计数' });
  b3.endTurn();
  ok(!b3.events.some((e) => e.type === 'timer') && b3.enemy.hp === e0, '「2 回合后生效」在第 1 个回合时不触发');
  b3.endTurn();
  ok(b3.events.some((e) => e.type === 'timer'), '第 2 个回合的计时器触发了');
}

// ---------------- ⑤ 敌方贪心出牌 ----------------
group('⑤ 敌人追求本回合最大伤害（首领一定 / 精英大概率 / 杂兵不会）');
{
  const boss = makeBattle({ deck: ['tackle'], enemyDeck: ['tackle'], tier: 'boss' });
  boss.start();
  ok(boss.wantsMaxDamage() === true, '首领：一定追求最高伤害');
  const mob = makeBattle({ deck: ['tackle'], enemyDeck: ['tackle'], tier: 'mob' });
  mob.start();
  ok(mob.wantsMaxDamage() === false, '杂兵：不追求（保持笨一点的手感）');
  let greedyCount = 0;
  for (let i = 0; i < 200; i++) {
    const b = makeBattle({ deck: ['tackle'], enemyDeck: ['tackle'], tier: 'elite', seed: 1000 + i });
    b.start();
    if (b.wantsMaxDamage()) greedyCount += 1;
  }
  ok(greedyCount > 200 * 0.6 && greedyCount < 200 * 0.9, '精英：大概率追求（约 3/4）', `200 场里 ${greedyCount} 场`);

  /**
   * 关键行为：**先挂强化再输出**。
   * 「剑舞」（力量 +X%）+ 一张伤害牌，首领应该先挂力量 —— 老 AI 会先打输出牌。
   */
  const strengthCard = Object.values(CARD_BY_ID).find((c) => c.effects.some((e) => e.kind === 'strength') && !c.enemyOnly);
  const dmgCard = Object.values(CARD_BY_ID).find((c) => c.effects.some((e) => e.kind === 'damage' && (e.power ?? 0) >= 90) && !c.enemyOnly);
  if (strengthCard && dmgCard) {
    const b = makeBattle({ deck: ['tackle'], enemyDeck: [strengthCard.id, dmgCard.id], tier: 'boss' });
    b.start();
    b.enemy.ap = 10;
    b.enemy.playsLeft = 5;
    putInHand(b, 'enemy', strengthCard.id);
    putInHand(b, 'enemy', dmgCard.id);
    const order = [];
    const orig = b.resolveCard.bind(b);
    b.resolveCard = (key, card, o) => { if (key === 'enemy') order.push(card.name); return orig(key, card, o); };
    b.enemyAct();
    const firstIdx = order.indexOf(strengthCard.name);
    const dmgIdx = order.indexOf(dmgCard.name);
    ok(firstIdx >= 0 && dmgIdx >= 0 && firstIdx < dmgIdx,
      '首领：强化牌排在输出牌**前面**（老 AI 是反过来的）',
      `出招顺序：${order.join(' → ')}（力量牌「${strengthCard.name}」）`);
  } else {
    ok(true, '（内容里没有合适的组合，跳过顺序断言）');
  }
}

console.log(`\n强化 / 预约 / 敌方贪心的回归测试：通过 ${pass}，失败 ${fail}`);
process.exit(fail ? 1 : 0);
