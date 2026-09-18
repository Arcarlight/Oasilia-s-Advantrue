// 回归测试：敌方挂虚弱 / 降属性到底有没有真的生效。
// 用法: node tools/test-status.mjs
//
// 盯住三件事（都出过问题）：
//   1) 伤害被**护盾全额挡下**时，附加的状态 / 降属性**照样生效**（护盾不等于闪避）；
//   2) 1 层**虚弱**必须真的削弱整一回合（以前在回合开始就扣层，等于完全没效果）；
//   3) 属性下降撞到**削弱下限**时，事件与日志要报「实际变化量」（0），不能报 -2。
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '..');
const imp = (rel) => import(pathToFileURL(path.join(ROOT, rel)).href);
globalThis.localStorage = { _m: new Map(), getItem: () => null, setItem: () => {}, removeItem: () => {} };

const { Battle, effectiveDef } = await imp('src/core/battle.js');
const { CARD_BY_ID } = await imp('src/data/cards.js');
const { BALANCE } = await imp('src/data/balance.js');

function makeBattle(over = {}) {
  const b = new Battle({
    seed: 7,
    player: { name: '欧亚西莉亚', slug: 'flygon', hp: 300, maxHp: 300, atk: 20, def: 12, agi: 10, luck: 5, ...over.player },
    deck: ['tackle'],
    enemy: { id: 't', slug: 'sandslash', name: '测试对手', maxHp: 400, atk: 20, def: 8, agi: 10, tier: 'mob', deck: ['tackle'], ...over.enemy },
  });
  b.takeEvents();
  b.log.length = 0;
  b.active = 'player';   // 不跑 start() 时手动把行动方设成玩家，endTurn() 才会真的走流程
  return b;
}

let pass = 0, fail = 0;
const check = (name, ok, extra = '') => {
  if (ok) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (extra ? ' → ' + extra : '')); }
};
/** takeEvents() 会把队列清空，所以一次取完再按类型挑 */
const pick = (evs, type) => evs.filter((e) => e.type === type);

// ---- 1) 护盾把伤害全额挡下时，附加的降防御照样生效 ----
{
  const b = makeBattle();
  b.rng = () => 0.999;                 // 必定不闪避、不暴击
  b.player.shield = 999;               // 咬碎的伤害会被护盾全额吃掉
  b.resolveCard('enemy', CARD_BY_ID.crunch);
  const evs = b.takeEvents();
  const dmg = pick(evs, 'damage')[0];
  const buff = pick(evs, 'buff')[0];
  check('伤害确实被护盾全挡了', !!dmg && dmg.amount === 0 && dmg.absorbed > 0, JSON.stringify(dmg));
  check('护盾挡下 ≠ 闪避：降防御照样生效', b.player.defMod === -2, 'defMod=' + b.player.defMod);
  check('事件里报了这次降防御', !!buff && buff.amount === -2, JSON.stringify(buff));
}

// ---- 2) 真被闪开时才跳过（对照组，防止上面的改动把这条规则弄丢）----
{
  const b = makeBattle();
  b.rng = () => 0;                     // 必定闪避
  b.resolveCard('enemy', CARD_BY_ID.crunch);
  check('闪开时降防御不生效（对照组）', b.player.defMod === 0, 'defMod=' + b.player.defMod);
}

// ---- 3) 1 层虚弱必须削弱整一回合，回合结束才掉层 ----
{
  const b = makeBattle();
  b.rng = () => 0.999;
  // 敌人用扬沙（伤害 + 我方虚弱 1 层）
  b.resolveCard('enemy', CARD_BY_ID.mob_sand);
  check('挂上了 1 层虚弱', b.player.weak === 1, 'weak=' + b.player.weak);

  // 玩家这回合打一张撞击：伤害应该只有无虚弱时的 75% 左右
  b.resolveCard('player', CARD_BY_ID.tackle);
  const weakDmg = pick(b.takeEvents(), 'damage').at(-1).amount;
  const b2 = makeBattle();
  b2.rng = () => 0.999;
  b2.resolveCard('player', CARD_BY_ID.tackle);
  const plainDmg = pick(b2.takeEvents(), 'damage').at(-1).amount;
  check('虚弱中的攻击更弱（约 75%）', weakDmg < plainDmg, `${weakDmg} vs ${plainDmg}`);
  check('虚弱在玩家出手时还挂着（不是一开场就掉）', b.player.weak === 1, 'weak=' + b.player.weak);

  // 玩家结束回合 → 虚弱才减 1 层
  b.endTurn();
  check('玩家回合结束后虚弱减 1 层', b.player.weak === 0, 'weak=' + b.player.weak);
}

// ---- 4) 降属性撞到下限：事件报实际变化量，不报「-2」----
{
  const b = makeBattle();
  b.rng = () => 0.999;
  const floorPct = BALANCE.debuffFloorPct ?? 0.5;
  // 把防御压到下限（基础 12 → 下限 6）
  b.player.defMod = -Math.ceil(b.player.def * (1 - floorPct));
  b.recalcDerived();
  const defAtFloor = effectiveDef(b.player);
  b.resolveCard('enemy', CARD_BY_ID.crunch);
  const buff = pick(b.takeEvents(), 'buff')[0];
  const texts = b.log.map((l) => l.text).join(' | ');
  check('已经在下降下限上', b.player.defMod === -Math.ceil(b.player.def * (1 - floorPct)), 'defMod=' + b.player.defMod);
  check('事件报的是 0（实际变化量）而不是 -2', !!buff && buff.amount === 0 && buff.clamped === true, JSON.stringify(buff));
  check('日志说清了「已经降到底」而不是「防御 -2」',
    texts.includes('已经降到底') && !texts.includes('防御 -2'), texts);
  check('防御数值确实没动', effectiveDef(b.player) === defAtFloor, `${effectiveDef(b.player)} vs ${defAtFloor}`);
}

// ---- 5) 没到下限时照常降 ----
{
  const b = makeBattle();
  b.rng = () => 0.999;
  b.resolveCard('enemy', CARD_BY_ID.crunch);
  const buff = pick(b.takeEvents(), 'buff')[0];
  check('没到下限时正常降 2 点', !!buff && buff.amount === -2 && buff.clamped === false, JSON.stringify(buff));
}

console.log('');
console.log(`状态与护盾的回归测试：通过 ${pass}，失败 ${fail}`);
if (fail) process.exitCode = 1;
