// 量「削弱对手属性」这一类牌的性价比。
//
// 用户报的（这一版第三次报到同一类牌）：「现在还是有一些卡牌非常强力，例如 1 费减少对方 35%
// 属性的撒娇等等卡牌，这类的能不能调一下？」
//
// 为什么不能靠模拟器（simulate-run.mjs）量：换一张牌就换了洗牌顺序，噪声比效果还大；
// 而且贪心 AI 给削弱牌的分数很低（它看不见「对手打不动我」这件事），于是塞进卡组里
// 永远是负收益。真人会**第一回合先挂削弱再输出**。所以这里跟 probe-power-cards.mjs 同一套办法：
//   ① 同一条种子 → 同一场敌人、同一副牌、同一串运气，只有「挂不挂那张削弱牌」这一个差别；
//   ② 强制第一回合先打出它（剩下的行动点继续按贪心输出），所以量到的是**净收益**
//      （少挨的打 − 少打出去的输出）；
//   ③ 每回合把玩家的血回满：这样每场都固定跑满 6 个回合，「挨了多少打」不会因为
//      「谁先死」而截断（不然一张牌强到能救命时，样本反而更短、数字更小）。
//
// 用法: node tools/probe-debuff-cards.mjs [回合数] [局数]
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '..');
const imp = (rel) => import(pathToFileURL(path.join(ROOT, rel)).href);
globalThis.localStorage = { _m: new Map(), getItem: () => null, setItem: () => {}, removeItem: () => {} };

const { Game } = await imp('src/core/game.js');
const { CARD_BY_ID, CARDS } = await imp('src/data/cards.js');

const TURNS = Number(process.argv[2] ?? 6);
const RUNS = Number(process.argv[3] ?? 80);
/** 第 5 章的标准面板（和 probe-power-cards / sweep-curve 用同一套） */
const P = { atk: 50, def: 39, maxHp: 430, agi: 24, luck: 0 };

/** 基准攻击牌：1 费、纯伤害 —— 一张「便宜的中档牌」，用它当行动点的去处 */
const ATTACK = CARDS.find((c) => !c.enemyOnly && c.ap === 1 && (c.effects ?? []).length === 1
  && c.effects[0].kind === 'damage' && c.effects[0].power === 90)
  ?? CARDS.find((c) => !c.enemyOnly && c.ap === 1 && (c.effects ?? []).length === 1 && c.effects[0].kind === 'damage');
if (!ATTACK) { console.error('找不到 1 费纯伤害牌'); process.exit(1); }

/**
 * 考察对象：玩家拿得到的、**按百分比削弱对手**的牌，外加几张「花同样 AP 的参照牌」。
 * 参照牌的意义是把数字变成判断：同样是 1 费，别的牌能买到的收益是多少。
 */
const TARGETS = [
  // ① 用户点名的这一类
  { id: 'charm', tag: '削弱' },
  { id: 'scary_face', tag: '削弱' },
  { id: 'metal_sound', tag: '削弱' },
  { id: 'weaken_bind', tag: '削弱' },
  { id: 'crush_grip', tag: '削弱' },
  { id: 'corrode', tag: '削弱' },
  { id: 'breaking_swipe', tag: '削弱' },
  // ② 参照：同样是 1~2 费，别的牌买到的收益（判定的标尺）
  { id: 'harden', tag: '参照·1费防护' },
  { id: 'double_kick', tag: '参照·1费攻击' },
  { id: 'howl', tag: '参照·1费强化' },
  { id: 'swords_dance', tag: '参照·2费强化' },
];

const put = (b, id, n = 1) => {
  for (let i = 0; i < n; i += 1) b.decks.player.hand.push({ uid: `${id}-${i}-${Math.random()}`, id, card: CARD_BY_ID[id] });
};

/**
 * 调数值时用：`--pct=charm:-0.18,breaking_swipe:-0.15`
 * 临时把某张牌的百分比改掉再量一遍（**只在内存里改，不写任何文件**）——
 * 先扫出「改成多少才落回参照牌那条线」，再把定下来的数字写进 content/cards.json。
 */
{
  const spec = (process.argv.find((a) => a.startsWith('--pct=')) ?? '').slice(6);
  for (const pair of spec.split(',').filter(Boolean)) {
    const [id, v] = pair.split(':');
    const c = CARD_BY_ID[id];
    if (!c) { console.error(`没有这张牌：${id}`); process.exit(1); }
    let hit = 0;
    for (const e of c.effects ?? []) if (e.kind === 'buff' && e.pct != null) { e.pct = Number(v); hit += 1; }
    if (!hit) { console.error(`${id} 上没有百分比效果`); process.exit(1); }
  }
}

/** 打一场：`first` = 第一回合必须先打出去的那张牌（null = 不挂） */
function trial(seed, first) {
  const game = new Game({ seed });
  game.newRun(undefined, { hero: 'oasilia' });
  Object.assign(game.data, { ...P, hp: P.maxHp, stage: 4 });
  // 整副都是同一张便宜攻击牌：手上永远有活干，洗牌顺序也不参与比较
  game.data.deck = Array.from({ length: 14 }, () => ATTACK.id);
  game.data.battleDeck = null;
  const b = game.startBattle('elite', 0, 'direct');
  /** 敌人血量给成天文数字：这一场固定跑满 TURNS 个回合，谁都不会提前倒下 */
  b.enemy.maxHp = 999999; b.enemy.hp = 999999;

  let taken = 0;
  let dealt = 0;
  const drain = () => {
    for (const ev of b.takeEvents()) {
      if (ev.type !== 'damage' && ev.type !== 'trueDamage') continue;
      if (ev.side === 'player') taken += ev.amount;
      else if (ev.side === 'enemy') dealt += ev.amount;
    }
  };
  for (let t = 0; t < TURNS; t += 1) {
    if (t === 0 && first) put(b, first, 1);
    let guard = 0;
    while (!b.over && guard++ < 40) {
      const hand = b.hand('player').filter((c) => b.canPlay(c.uid));
      if (!hand.length) break;
      const forced = (t === 0 && first) ? hand.find((c) => c.id === first) : null;
      const chosen = forced ?? hand.map((c) => ({ c, s: b.scoreCard('player', c.card) })).sort((a, x) => x.s - a.s)[0].c;
      if (!b.playCard(chosen.uid).ok) break;
      drain();
    }
    drain();
    if (t === TURNS - 1) break;
    b.endTurn();
    drain();
    // 每回合回满：固定跑满 TURNS 个回合，「挨了多少打」不被「谁先死」截断
    b.player.hp = b.player.maxHp;
  }
  return { taken, dealt };
}

const seeds = Array.from({ length: RUNS }, (_, i) => 90000 + i * 313 + 7);
const sum = (first) => {
  let taken = 0; let dealt = 0;
  for (const s of seeds) { const r = trial(s, first); taken += r.taken; dealt += r.dealt; }
  return { taken: taken / RUNS, dealt: dealt / RUNS };
};

const base = sum(null);
const rows = TARGETS.map((t) => ({ ...t, card: CARD_BY_ID[t.id], ...sum(t.id) }));

console.log(`\n=== 削弱类卡牌的实测价值（第 5 章面板 攻${P.atk}/防${P.def}/HP${P.maxHp}/敏${P.agi}，`
  + `对手：真正的第 5 章精英，${RUNS} 条种子 × ${TURNS} 回合）===`);
console.log(`基准（第一回合不挂任何牌，行动点全用在「${ATTACK.name}」上）`
  + `：挨打 ${base.taken.toFixed(0)} · 输出 ${base.dealt.toFixed(0)}\n`);
console.log('  卡名            费 稀有度   效果                          挨打   承受变化    输出   输出变化   评价');
/**
 * 出线判定：一条 1~2 费的削弱牌，**一次出牌**应该买到的量级——
 * 参照牌（同样一次出牌）实测是「1 费永久强化 +21% 输出」「2 费 +28% 输出」，
 * 所以「少挨 25% 以上」或者「多打 30% 以上」就算超出这条线，
 * 直接在表里标出来（下一批调数值时不用再回头翻参照牌那几个数）。
 */
const LINE = { taken: -0.25, dealt: 0.30 };
for (const r of rows) {
  const dt = r.taken / base.taken - 1;
  const dd = r.dealt / base.dealt - 1;
  const eff = (r.card.effects ?? []).map((e) => {
    if (e.kind === 'buff') return `${e.stat === 'atk' ? '攻' : e.stat === 'def' ? '防' : e.stat === 'agi' ? '敏' : e.stat}${e.amount != null ? e.amount : e.pct * 100 + '%'}`;
    if (e.kind === 'damage') return `伤${e.power}${e.hits ? '×' + e.hits : ''}`;
    if (e.kind === 'shield') return `盾${e.amount}`;
    if (e.kind === 'strength') return `力+${e.n}%`;
    if (e.kind === 'grantBuff') return `威+${e.n}%`;
    if (e.kind === 'draw') return `抽${e.n}`;
    return e.kind;
  }).join(' ');
  const pct = (x) => `${x >= 0 ? '+' : ''}${(x * 100).toFixed(1)}%`.padStart(8);
  const over = (dt < LINE.taken || dd > LINE.dealt) ? '⚠ 出线' : '';
  console.log(`  ${String(r.card.name).padEnd(12)} ${String(r.card.ap).padStart(2)} ${String(r.card.rarity).padEnd(8)} `
    + `${eff.padEnd(28)} ${r.taken.toFixed(0).padStart(5)} ${pct(dt)} ${r.dealt.toFixed(0).padStart(7)} ${pct(dd)}   ${r.tag} ${over}`);
}
console.log(`\n（「承受变化」= 同样的打法下少挨了多少打；「输出变化」= 多打了多少。
  参照牌告诉你「1~2 费应该买到多少」：1 费的${CARD_BY_ID.harden.name} / ${CARD_BY_ID.double_kick.name} / ${CARD_BY_ID.howl.name}
  就是这一档的水位线 —— 「⚠ 出线」= 少挨 ${-LINE.taken * 100}% 以上、或多打 ${LINE.dealt * 100}% 以上。）`);
