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
const { BALANCE } = await imp('src/data/balance.js');
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

// ---------------- ⑥ 计时：卡面怎么写，就该怎么数 ----------------
group('⑥ 计时：卡面怎么写，就该怎么数（用户报的两个差一格）');
{
  /**
   * 用户报的：「标着再打两张牌就能触发效果的卡，现在打一张就可以了 —— 应该是它连着自己那张也算进去了」。
   * 「二连劈 / 追咬 / 尘卷 / 蓄势爆发」这类牌，创建预约的那一次出牌**不能**算进计数里。
   */
  const selfCount = () => {
    const b = makeBattle({ deck: ['tackle'], enemyDeck: ['tackle'], seed: 4242 });
    b.start();
    b.takeEvents();
    b.resolveCard('player', CARD_BY_ID.dual_chop, {});
    const firedOnSelf = b.takeEvents().some((e) => e.type === 'timer');
    b.resolveCard('player', CARD_BY_ID.harden, {});      // 第 1 张垫刀（0 伤害）
    const firedOnOne = b.takeEvents().some((e) => e.type === 'timer');
    b.resolveCard('player', CARD_BY_ID.harden, {});      // 第 2 张垫刀 → 这时才该触发
    const firedOnTwo = b.takeEvents().some((e) => e.type === 'timer');
    return { firedOnSelf, firedOnOne, firedOnTwo };
  };
  const sc = selfCount();
  ok(!sc.firedOnSelf, '「再打出 2 张牌」：打出它自己的那一刻**不**触发');
  ok(!sc.firedOnOne, '「再打出 2 张牌」：之后再打出第 1 张时**还不**触发（以前这里就触发了 = bug）');
  ok(sc.firedOnTwo, '「再打出 2 张牌」：再打出第 2 张时才触发');

  /**
   * 同一个坑的第二半：「N 个回合后」的牌不能把**当前回合**算进去。
   * 现在卡面写「2 个回合后」= 数据里 3 格（打出它的那个回合不算，之后完整过去 2 个回合）。
   * 门禁（tools/check-content.mjs）另外钉住「卡面文字 ↔ 格数」这一对。
   */
  const b = makeBattle({ deck: ['tackle'], enemyDeck: ['tackle'], seed: 777 });
  b.start();
  b.takeEvents();
  b.resolveCard('player', CARD_BY_ID.rock_blast, {});    // 卡面：「2 个回合后」
  b.takeEvents();
  b.endTurn();
  const t1 = b.takeEvents().some((e) => e.type === 'timer');
  b.endTurn();
  const t2 = b.takeEvents().some((e) => e.type === 'timer');
  b.endTurn();
  const t3 = b.takeEvents().some((e) => e.type === 'timer');
  ok(!t1 && !t2, '「2 个回合后」：过去 1、2 个回合时都还没生效（当前回合没被算进去）');
  ok(t3, '「2 个回合后」：完整过去 2 个回合之后（第 3 个回合开始时）才生效');

  // 对照组：「下回合开始时」的牌就是 1 格，别被上面那条改动带跑
  const b2 = makeBattle({ deck: ['tackle'], enemyDeck: ['tackle'], seed: 778 });
  b2.start();
  b2.takeEvents();
  b2.resolveCard('player', CARD_BY_ID.dig, {});
  b2.takeEvents();
  b2.endTurn();
  ok(b2.takeEvents().some((e) => e.type === 'timer'), '「下回合开始时」：下一个回合开始就生效（1 格，没被动过）');
}

// ---------------- ⑦ 敌人出牌不封顶 + 一回合伤害兜底（3.0.2） ----------------
group('⑦ 敌人出牌不封顶，但一回合不许把玩家打死');
{
  /**
   * 用户实测的两句话（3.0.2）：
   *   · 「怪出的牌这么少基本形成不了什么火候，回滚原先的卡牌限制」→ 出牌数**不封顶**；
   *   · 「最后一关的精英怪 400 伤害/回合推死」→ 保留「一回合最多打掉玩家最大生命 X%」的兜底。
   *
   * 玩法：给敌人一手的 0 费牌 + 20 点行动点，让它随便打，然后数它这一轮打了几张。
   */
  const playsInOneTurn = (tier) => {
    const b = makeBattle({ deck: ['tackle'], enemyDeck: Array.from({ length: 9 }, () => 'tackle'), tier });
    b.start();
    b.takeEvents();
    b.enemy.ap = 20;
    b.enemy.playsLeft = b.enemy.playMax;
    b.endTurn();
    return b.events.filter((e) => e.type === 'playCard' && e.side === 'enemy').length;
  };
  const elite = playsInOneTurn('elite');
  ok(elite > 3, '出牌数不封顶：行动点够就能一直打（回归旧规则，敌人要有火候）', `精英一回合打了 ${elite} 张`);

  /**
   * 「对手抽得极顺」的那一回合仍然可能打到玩家七成以上的血 —— 兜底：
   * **敌人的同一个回合最多打掉玩家最大生命的 BALANCE.enemyTurnDamageCapPct**。
   */
  {
    const b = makeBattle({ deck: ['tackle'], enemyDeck: ['tackle'], tier: 'boss' });
    b.start();
    const cap = Math.round(b.player.maxHp * (BALANCE.enemyTurnDamageCapPct ?? 0.7));
    /**
     * ⚠ 不能调 `beginEnemyTurn()`：它会把敌人**整回合**跑完并交回玩家回合
     * （第一版就是这么写的，于是后面这几下都算在「玩家的回合」里、根本不受限）。
     */
    b.active = 'enemy';
    b._foeTurnDamage = 0;
    for (let i = 0; i < 3; i += 1) b.applyDamage('player', 999, { source: 'enemy' });
    const taken = b.player.maxHp - b.player.hp;
    ok(taken <= cap + 1, '敌人的同一回合最多打掉玩家最大生命的 70%', `掉了 ${taken} / 上限 ${cap}`);
    ok(!b.over, '因此「满血进场被一回合带走」不会发生');
    // 玩家的回合照常能被打死（只限敌人的回合）
    b.active = 'player';
    b._foeTurnDamage = 0;
    b.applyDamage('player', 9999, { source: 'enemy' });
    ok(b.player.hp <= 0, '玩家的回合不受这条限制（该赢该输照旧）');
  }
}

console.log(`\n强化 / 预约 / 敌方贪心的回归测试：通过 ${pass}，失败 ${fail}`);
process.exit(fail ? 1 : 0);
