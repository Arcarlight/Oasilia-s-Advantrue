// 给「口吻台词」（它可能会这么说）的写作简报：把一只敌人的身份、已有的出场台词、
// 招牌招、招式池一次打出来，写手照着写就不会和出场台词撞车、也不会写错这只的脾气。
//
// 用法：
//   node tools/voice-brief.mjs sandshrew,gible        # 指定的几只
//   node tools/voice-brief.mjs --all                  # 全部 193 只
//   node tools/voice-brief.mjs --missing              # content/enemy-voice.json 里还缺的
//
// 只读，不改任何文件。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));

const enemies = read('content/enemies.json');
const species = read('content/species.json').species;
const biomes = read('content/biomes.json');
const intros = read('content/enemy-intro.json').intro ?? {};
const cards = read('content/cards.json').cards ?? [];
const cardById = new Map(cards.map((c) => [c.id, c]));
const poolOf = (deck) => (enemies.movePools?.[deck] ?? (Array.isArray(deck) ? deck : []));

const arg = process.argv[2] ?? '--all';
const have = fs.existsSync(path.join(ROOT, 'content', 'enemy-voice.json'))
  ? read('content/enemy-voice.json').voice ?? {}
  : {};

let list;
if (arg === '--all') list = enemies.enemies;
else if (arg === '--missing') list = enemies.enemies.filter((e) => !have[e.slug]?.length);
else {
  const want = new Set(arg.split(',').map((s) => s.trim()).filter(Boolean));
  list = enemies.enemies.filter((e) => want.has(e.slug) || want.has(e.id));
  const found = new Set(list.flatMap((e) => [e.slug, e.id]));
  const unknown = [...want].filter((w) => !found.has(w));
  if (unknown.length) console.error(`⚠ 找不到这些 id：${unknown.join(', ')}`);
}

const biomeName = (key) => biomes[key]?.name ?? biomes.biomes?.[key]?.name ?? key;
const tierName = (key) => enemies.tiers?.[key]?.name ?? key;

for (const e of list) {
  const sp = species[e.slug] ?? {};
  const pool = poolOf(e.deck).map((id) => cardById.get(id)?.name).filter(Boolean);
  const sig = (e.signature ?? []).map((id) => cardById.get(id)?.name).filter(Boolean);
  console.log(`### ${e.slug}`);
  console.log(`名字：${sp.name ?? e.slug}（${sp.en ?? ''}）｜档位：${tierName(e.tier)}｜地图：${biomeName(e.biome)}｜属性：${(sp.types ?? []).join('/')}`);
  if (e.bossTitle) console.log(`称号：${e.bossTitle}`);
  if (intros[e.slug]) console.log(`图鉴简介：${intros[e.slug]}`);
  console.log(`出场台词（打照面时它说的，口吻台词**不许和它们重复**）：`);
  for (const l of e.lines ?? []) console.log(`  - ${l}`);
  if (sig.length) console.log(`招牌招（开打时一定在它手上）：${sig.join(' / ')}`);
  console.log(`招式池（${pool.length} 张）：${pool.slice(0, 10).join(' / ')}${pool.length > 10 ? ' …' : ''}`);
  console.log('');
}
console.log(`-- 共 ${list.length} 只 --`);
