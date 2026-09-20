// Regenerate tools/kit-cards.json: the attack cards that the per-type enemy pools use.
//
// These are exactly the cards tools/rescale-kit-cards.mjs is allowed to rescale, so the
// list has to come from the pools themselves rather than being maintained by hand.
//
// Usage: node tools/collect-kit-cards.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TYPE_MOVES } from './build-enemy-kits.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cards = new Set();
for (const perAp of Object.values(TYPE_MOVES)) {
  for (const list of Object.values(perAp)) for (const id of list) cards.add(id);
}
const out = {
  note: '由 node tools/collect-kit-cards.mjs 生成；不要手改。这些是属性敌人池用到的攻击牌，tools/rescale-kit-cards.mjs 只会压这些牌的威力。',
  count: cards.size,
  cards: [...cards].sort(),
};
fs.writeFileSync(path.join(ROOT, 'tools', 'kit-cards.json'), JSON.stringify(out, null, 2) + '\n', 'utf8');
console.log(`kit-cards.json: ${cards.size} 张`);
