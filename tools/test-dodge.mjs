// 回归测试：带伤害的牌被闪开时，附加的状态/降属性**不能**生效；而纯变化牌照常生效。
// 用法: node tools/test-dodge.mjs
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '..');
const imp = (rel) => import(pathToFileURL(path.join(ROOT, rel)).href);
globalThis.localStorage = { _m: new Map(), getItem: () => null, setItem: () => {}, removeItem: () => {} };

const { Battle } = await imp('src/core/battle.js');
const { CARD_BY_ID } = await imp('src/data/cards.js');

function makeBattle() {
  const b = new Battle({
    seed: 1,
    player: { name: '欧亚西莉亚', slug: 'flygon', hp: 300, maxHp: 300, atk: 20, def: 12, agi: 10, luck: 5 },
    deck: ['tackle'],
    enemy: { id: 't', slug: 'sandslash', name: '测试对手', maxHp: 400, atk: 20, def: 8, agi: 10, tier: 'mob', deck: ['tackle'] },
  });
  b.takeEvents();
  b.log.length = 0;
  return b;
}

let pass = 0, fail = 0;
const check = (name, ok, extra = '') => {
  if (ok) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (extra ? ' → ' + extra : '')); }
};

// ---- 1) 咬碎（伤害 + 对手防御 -2）被完全闪开：降防御不该生效 ----
{
  const b = makeBattle();
  b.rng = () => 0;                     // 闪避判定必定成功（0 < 闪避率）
  b.resolveCard('enemy', CARD_BY_ID.crunch);
  const logs = b.log.map((l) => l.text);
  check('被闪开时玩家防御没被降', b.player.defMod === 0, 'defMod=' + b.player.defMod);
  check('日志里有闪避、没有降防御', logs.some((t) => t.includes('闪开')) && !logs.some((t) => t.includes('防御 -')), JSON.stringify(logs));
}

// ---- 2) 同一张牌命中时，降防御照常生效 ----
{
  const b = makeBattle();
  b.rng = () => 0.999;                 // 必定不闪避、不暴击
  b.resolveCard('enemy', CARD_BY_ID.crunch);
  check('命中时降防御正常生效', b.player.defMod === -2, 'defMod=' + b.player.defMod);
}

// ---- 3) 多段攻击（二连踢）只要有一段命中，附加效果就该生效 ----
{
  const b = makeBattle();
  b.resolveCard('enemy', CARD_BY_ID.double_kick);   // 纯伤害，无附加，跑通即可
  check('多段攻击正常结算', b.player.hp < 300, 'hp=' + b.player.hp);
}

// ---- 4) 纯变化牌（刺耳声，没有伤害）即使在「必定闪避」的 rng 下也要生效 ----
{
  const b = makeBattle();
  b.rng = () => 0;
  b.resolveCard('enemy', CARD_BY_ID.screech);
  check('纯变化牌不受闪避影响', b.player.defMod === -5, 'defMod=' + b.player.defMod);
}

// ---- 5) 火焰牙（伤害 + 灼伤）被闪开时不该挂灼伤 ----
{
  const b = makeBattle();
  b.rng = () => 0;
  b.resolveCard('enemy', CARD_BY_ID.fire_fang);
  check('被闪开时不挂灼伤', b.player.burn === 0, 'burn=' + b.player.burn);
}

// ---- 6) 玩家打敌人也一样：敌人闪开时不该被降属性 ----
{
  const b = makeBattle();
  b.rng = () => 0;
  b.resolveCard('player', CARD_BY_ID.rock_throw);
  check('敌人闪开时也没被降防御', b.enemy.defMod === 0, 'defMod=' + b.enemy.defMod);
}

console.log(`\n闪避与附加效果的回归测试：通过 ${pass}，失败 ${fail}`);
process.exit(fail ? 1 : 0);
