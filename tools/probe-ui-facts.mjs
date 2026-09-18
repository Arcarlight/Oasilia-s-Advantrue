// 一次性排查：把「UI 文案里写到的每个数字」从代码里现查一遍，方便逐条对账。
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const imp = (rel) => import(pathToFileURL(path.join(ROOT, rel)).href);
globalThis.localStorage = { _m: new Map(), getItem(k) { return this._m.get(k) ?? null; }, setItem() {}, removeItem() {} };

const { BALANCE } = await imp('src/data/balance.js');
const { stageCount } = await imp('src/data/mapgen.js');
const { CARDS } = await imp('src/data/cards.js');

console.log('=== 章节数 ===');
console.log('  stageCount() =', stageCount());

console.log('\n=== BALANCE 里和续航/成长有关的项 ===');
for (const k of Object.keys(BALANCE)) {
  const v = BALANCE[k];
  if (/heal|Heal|rest|Rest|boss|Boss|potion|drop|crit|Crit|stage|Stage|growth|card|Card|cap|debuff|dodge|speed/.test(k)) {
    console.log(`  ${k} = ${JSON.stringify(v)}`);
  }
}
console.log('\n=== 全部 BALANCE 键 ===');
console.log('  ' + Object.keys(BALANCE).join(', '));

console.log('\n=== 回复类卡牌的实际效果 ===');
for (const c of CARDS.filter((c) => c.effects.some((e) => e.kind === 'heal'))) {
  const h = c.effects.find((e) => e.kind === 'heal');
  console.log(`  ${c.name.padEnd(6)} ${JSON.stringify(h)}  ｜文案：${c.text}`);
}

console.log('\n=== 护盾类卡牌 ===');
for (const c of CARDS.filter((c) => c.effects.some((e) => e.kind === 'shield')).slice(0, 6)) {
  const s = c.effects.find((e) => e.kind === 'shield');
  console.log(`  ${c.name.padEnd(6)} ${JSON.stringify(s)}  ｜文案：${c.text}`);
}

console.log('\n=== 状态定义 ===');
const { STATUS_INFO } = await imp('src/core/battle.js');
for (const [k, v] of Object.entries(STATUS_INFO)) console.log(`  ${k.padEnd(8)} ${JSON.stringify(v)}`);
