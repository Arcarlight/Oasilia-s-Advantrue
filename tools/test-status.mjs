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

const { Battle, effectiveDef, debuffFloor } = await imp('src/core/battle.js');
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
  // 下限按项配置（防御 25%）：直接用引擎那个 helper 读，别在这儿再抄一遍配置结构
  const floorMod = -Math.max(0, Math.round(b.player.def * (1 - debuffFloor('def'))));
  b.player.defMod = floorMod;
  b.recalcDerived();
  const defAtFloor = effectiveDef(b.player);
  b.resolveCard('enemy', CARD_BY_ID.crunch);
  const buff = pick(b.takeEvents(), 'buff')[0];
  const texts = b.log.map((l) => l.text).join(' | ');
  check('已经在下降下限上', b.player.defMod === floorMod, 'defMod=' + b.player.defMod);
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

// ---- 6) 持续伤害按**最大生命的百分比**结算（用户反馈「上毒只扣个位数」）----
// 这一条是这次改动的核心：固定值的毒在后期（敌人血量上千）等于没有。
{
  const pct = BALANCE.statusPct;
  // 一个「血厚」的敌人：中毒 3 层每回合应该掉 最大生命 × 0.8% × 层数
  const b = makeBattle({ enemy: { maxHp: 1000, hp: 1000 } });
  b.rng = () => 0.999;
  b.enemy.poison = 3;
  const before = b.enemy.hp;
  b.tickStatuses('enemy');
  const tick = before - b.enemy.hp;
  const want = Math.round((1000 * pct.poison + 1) * 3);
  check('中毒伤害 = 最大生命 × 百分比 × 层数（1000 血 → 3 层）', tick === want && tick > 20,
    `实际 ${tick}，期望 ${want}（旧的固定值只有 3 点）`);
  check('中毒层数 -1', b.enemy.poison === 2, 'poison=' + b.enemy.poison);

  // 剧毒层数**不减反增**，而且血越厚掉得越多
  const b2 = makeBattle({ enemy: { maxHp: 2000, hp: 2000 } });
  b2.rng = () => 0.999;
  b2.enemy.toxic = 2;
  const t1 = b2.enemy.hp;
  b2.tickStatuses('enemy');
  const d1 = t1 - b2.enemy.hp;
  check('剧毒结算后层数 +1（不衰减）', b2.enemy.toxic === 3, 'toxic=' + b2.enemy.toxic);
  const t2 = b2.enemy.hp;
  b2.tickStatuses('enemy');
  const d2 = t2 - b2.enemy.hp;
  check('剧毒越拖越痛（第二回合掉得比第一回合多）', d2 > d1, `${d1} → ${d2}`);
  // 同层数、不同血量：血越厚掉得越多（这就是「毒在后期依然有用」的关键）
  const b3 = makeBattle({ enemy: { maxHp: 1000, hp: 1000 } });
  b3.rng = () => 0.999;
  b3.enemy.toxic = 2;
  const t3 = b3.enemy.hp;
  b3.tickStatuses('enemy');
  const d3 = t3 - b3.enemy.hp;
  check('同一层数下，血越厚的目标掉得越多', d1 > d3, `2000 血 2 层 ${d1} vs 1000 血 2 层 ${d3}`);

  // 出血按「每次受到攻击」结算
  const def = { def: 0, defMod: 0, bleed: 3, maxHp: 1000, hp: 1000 };
  const atk = { atk: 30, atkMod: 0, weak: 0, strength: 0 };
  const { computeHit } = await imp('src/core/battle.js');
  const withBleed = computeHit(atk, def, 100);
  const withoutBleed = computeHit(atk, { ...def, bleed: 0 }, 100);
  check('出血按最大生命百分比加成每一次命中', withBleed - withoutBleed === Math.round((1000 * pct.bleed + 1) * 3),
    `${withBleed} vs ${withoutBleed}`);
}

// ---- 7) 引爆：把持续伤害一次性爆掉并清空 ----
{
  const b = makeBattle({ enemy: { maxHp: 1000, hp: 1000 } });
  b.rng = () => 0.999;
  b.enemy.poison = 3;
  b.enemy.burn = 2;
  const before = b.enemy.hp;
  b.resolveCard('player', CARD_BY_ID.venom_burst);
  const evs = b.takeEvents();
  const det = pick(evs, 'detonate')[0];
  const lost = before - b.enemy.hp;
  check('引爆真的扣了血', lost > 0, `扣了 ${lost}`);
  check('引爆后持续伤害被清空', b.enemy.poison === 0 && b.enemy.burn === 0,
    `poison=${b.enemy.poison} burn=${b.enemy.burn}`);
  check('引爆伤害随层数放大', !!det && det.stacks === 5, JSON.stringify(det));
}

// ---- 8) 百分比削弱：后期敌人防御只有十几点，固定值两下就顶到底 ----
{
  const b = makeBattle({ enemy: { def: 11 } });
  b.rng = () => 0.999;
  b.resolveCard('player', CARD_BY_ID.corrode);
  check('腐蚀按基础防御的 30% 削弱', b.enemy.defMod === -3, 'defMod=' + b.enemy.defMod + '（11 × 30% ≈ 3）');
  const b2 = makeBattle({ enemy: { def: 11 } });
  b2.rng = () => 0.999;
  // 下限 25%：def 11 最低只能削到 3 点（-8）
  for (let i = 0; i < 10; i++) b2.resolveCard('player', CARD_BY_ID.corrode);
  check('削弱下限是基础值的 25%（不是一半）', effectiveDef(b2.enemy) === 3,
    `防御 ${effectiveDef(b2.enemy)}（下限 ${Math.round(11 * debuffFloor('def'))}）`);

  // 敏捷单独一档：它管着 AP / 抽牌 / 出牌上限三件事，不能削到和防御一样深
  const b3 = makeBattle({ player: { agi: 10 } });
  b3.rng = () => 0.999;
  for (let i = 0; i < 10; i++) b3.resolveCard('enemy', CARD_BY_ID.scary_face);
  const floorAgi = Math.round(10 * debuffFloor('agi'));
  check('敏捷的下限比攻防浅（不被削成「没有回合」）',
    b3.player.agi + b3.player.agiMod >= floorAgi && floorAgi > Math.round(10 * debuffFloor('def')),
    `敏捷 ${b3.player.agi + b3.player.agiMod}（攻防类下限 ${Math.round(10 * debuffFloor('def'))}，敏捷下限 ${floorAgi}）`);
}

// ---- 9) 净化 / 引爆要报出「清掉了哪几个状态」 ----
// 界面靠这份名单把对应的状态胶囊化掉；只给一个数字的话，引擎已经清零、
// 界面上的胶囊还挂着（要等回合收尾 resyncDisp 才掉），玩家打完「白雾」看不到任何反馈。
{
  const b = makeBattle();
  b.rng = () => 0.999;
  b.player.poison = 3;
  b.player.toxic = 2;
  b.player.burn = 1;
  b.player.atkMod = -6;
  b.resolveCard('player', CARD_BY_ID.mist);
  const cl = pick(b.takeEvents(), 'cleanse')[0];
  check('净化事件带上了被清掉的状态名单',
    !!cl && Array.isArray(cl.statuses) && cl.statuses.join(',') === 'poison,toxic,burn',
    JSON.stringify(cl?.statuses));
  check('名单和引擎状态对得上（层数真的清零了）',
    b.player.poison === 0 && b.player.toxic === 0 && b.player.burn === 0,
    `poison=${b.player.poison} toxic=${b.player.toxic} burn=${b.player.burn}`);
  check('属性下降清完之后剩多少也一并报出来（界面面板要跟着回正）',
    !!cl?.mods && cl.mods.atk === 0, JSON.stringify(cl?.mods));

  // 身上干净的时候：名单是空的，别谎报
  const b2 = makeBattle();
  b2.rng = () => 0.999;
  b2.resolveCard('player', CARD_BY_ID.mist);
  const cl2 = pick(b2.takeEvents(), 'cleanse')[0];
  check('身上没有可清的东西时名单为空', !!cl2 && cl2.statuses.length === 0 && cl2.removed === 0,
    JSON.stringify(cl2?.statuses));

  // 引爆同一套：炸掉的毒要报出来
  const b3 = makeBattle({ enemy: { maxHp: 1000, hp: 1000 } });
  b3.rng = () => 0.999;
  b3.enemy.poison = 3;
  b3.enemy.burn = 2;
  b3.enemy.weak = 1;                   // 虚弱不在引爆范围内，不能报进去
  b3.resolveCard('player', CARD_BY_ID.venom_burst);
  const det = pick(b3.takeEvents(), 'detonate')[0];
  check('引爆事件带上了被炸掉的状态名单',
    !!det && det.statuses.join(',') === 'poison,burn', JSON.stringify(det?.statuses));
  check('引爆不碰虚弱（名单里没有它）', b3.enemy.weak === 1, 'weak=' + b3.enemy.weak);
}

console.log('');
console.log(`状态与护盾的回归测试：通过 ${pass}，失败 ${fail}`);
if (fail) process.exitCode = 1;
