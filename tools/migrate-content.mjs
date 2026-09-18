// 一次性迁移脚本：把现在写在 src/data/*.js 里的内容导出成 content/*.json。
//
// 为什么要有这一步：内容（卡牌 / 敌人 / 地图 / 招式池 / 物种表）以后统一放 content/，
// 由 tools/build-content.mjs 校验并生成 src/data/generated/*.js。
// 迁移时必须保证「生成出来的数据和手写的一模一样」，所以这里先把现状原样 dump 出来。
//
// 用法: node tools/migrate-content.mjs
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '..');
const OUT = path.join(ROOT, 'content');

const { CARDS, STARTER_DECK, STARTER_ITEMS, ITEMS } = await import('../src/data/cards.js');
const { TIERS, MOVE_POOLS, ENEMIES } = await import('../src/data/enemies.js');
const { BIOMES, BALANCE, RARITY } = await import('../src/data/balance.js');
const { EVENTS } = await import('../src/data/events.js');
const { CARD_ART } = await import('../src/ui/cards.js');
const { STAGE_BIOME } = await import('../src/data/mapgen.js').catch(() => ({ STAGE_BIOME: null }));

await fs.mkdir(OUT, { recursive: true });
await fs.mkdir(path.join(OUT, 'events'), { recursive: true });

const write = async (name, data) => {
  const p = path.join(OUT, name);
  await fs.writeFile(p, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log(`  写出 ${path.relative(ROOT, p)}（${Array.isArray(data) ? data.length + ' 项' : Object.keys(data).length + ' 个键'}）`);
};

// ---------- 卡牌：把 UI 层的 CARD_ART（图标/特效）一起合并进来，以后卡牌数据自带美术字段 ----------
const cards = CARDS.map((c) => {
  const art = CARD_ART[c.id] ?? {};
  return { ...c, ico: art.ico ?? 'ico-star', fx: art.fx ?? 'magic_1' };
});
await write('cards.json', { starterDeck: STARTER_DECK, starterItems: STARTER_ITEMS, items: ITEMS, cards });

// ---------- 物种表：从敌人清单反推（dex / slug / 中文名 / 英文名 / 属性） ----------
const species = {};
for (const e of ENEMIES) {
  species[e.slug] = { dex: e.dex, slug: e.slug, name: e.name, en: e.en, types: e.types };
}
await write('species.json', { species });

// ---------- 敌人 ----------
await write('enemies.json', {
  tiers: TIERS,
  movePools: MOVE_POOLS,
  enemies: ENEMIES.map((e) => ({
    id: e.id, slug: e.slug, tier: e.tier, biome: e.biome,
    deck: e.deck === MOVE_POOLS.weak ? 'weak'
      : e.deck === MOVE_POOLS.basic ? 'basic'
        : e.deck === MOVE_POOLS.strong ? 'strong'
          : e.deck === MOVE_POOLS.elite ? 'elite'
            : e.deck === MOVE_POOLS.boss ? 'boss' : e.deck,
    lines: e.lines,
    ...(e.bossTitle ? { bossTitle: e.bossTitle } : {}),
    ...(e.final ? { final: true } : {}),
  })),
});

// ---------- 地图 / 章节 ----------
await write('biomes.json', { stageOrder: STAGE_BIOME ?? ['desert', 'canyon', 'night'], biomes: BIOMES });

// ---------- 平衡表（只导出与章节数量相关的表，方便扩展章节时对照） ----------
await write('balance-stages.json', {
  enemyHp: BALANCE.enemyHp,
  enemyAtk: BALANCE.enemyAtk,
  playerPowerRef: BALANCE.playerPowerRef,
  stageClearGold: BALANCE.stageClearGold,
  _note: '这几张表的长度必须等于章节数；真正的数值仍然写在 src/data/balance.js 里。',
});

// ---------- 事件：函数没法 dump，这里输出清单当迁移核对表 ----------
const eventList = EVENTS.map((e) => ({
  id: e.id,
  name: e.name,
  biome: e.biome ?? null,
  options: e.options.map((o) => ({ label: o.label, hint: o.hint ?? null })),
}));
await write('events/_checklist.json', eventList);
console.log(`  事件清单：${eventList.length} 个（函数体需要手写成 events/*.json 的 DSL）`);

// ---------- 稀有度 ----------
await write('rarity.json', RARITY);
console.log('迁移 dump 完成');
