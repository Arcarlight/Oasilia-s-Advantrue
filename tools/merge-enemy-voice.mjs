// 把 content/voice-parts/p*.json（写手分头产出的口吻台词）合并成 content/enemy-voice.json，
// 并把中 → 日 / 英的对齐结果补进 content/i18n/{ja,en}.json。
//
// 用法：
//   node tools/merge-enemy-voice.mjs            # 校验 + 写入
//   node tools/merge-enemy-voice.mjs --check    # 只校验，不写
//
// 为什么要有这一步：193 只 ×3 句是分头写的，**没人替它们对账** ——
// 少一只、多一只、抄了出场台词、混进现实动物或开发口气，在界面上都看不出来。
// 所以这里逐条卡住，另外交给 check-content.mjs 复查（那条是最终的硬闸）。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PARTS = path.join(ROOT, 'content', 'voice-parts');
const OUT = path.join(ROOT, 'content', 'enemy-voice.json');
const CHECK = process.argv.includes('--check');
const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

const enemies = readJson(path.join(ROOT, 'content', 'enemies.json')).enemies;
const byId = new Map();
for (const e of enemies) { if (!byId.has(e.slug)) byId.set(e.slug, e); }

const problems = [];
const warns = [];
const err = (m) => problems.push(m);
const warn = (m) => warns.push(m);

// ---- 1. 收齐分片 ----
/**
 * **先读已有的 content/enemy-voice.json 当地基，再用分片覆盖。**
 * 所以这个脚本是**增量**的：以后新加一只宝可梦，只要写一个新分片（甚至只往
 * enemy-voice.json 里加 3 句）就能跑，不必把 193 只的分片都留着 ——
 * content/voice-parts/ 是写作时的中间产物（.gitignore 里）。
 */
const merged = new Map();
if (fs.existsSync(OUT)) {
  const base = readJson(OUT).voice ?? {};
  const jaDict = readJson(path.join(ROOT, 'content', 'i18n', 'ja.json'));
  const enDict = readJson(path.join(ROOT, 'content', 'i18n', 'en.json'));
  for (const [id, list] of Object.entries(base)) {
    if (!byId.has(id)) { warn(`enemy-voice.json 里的「${id}」不在 roster 里（改名了？）`); continue; }
    merged.set(id, {
      file: '（已有）',
      voice: { zh: list, ja: list.map((s) => jaDict[s] ?? ''), en: list.map((s) => enDict[s] ?? '') },
    });
  }
}
const fromParts = new Set();
if (fs.existsSync(PARTS)) {
  const files = fs.readdirSync(PARTS).filter((f) => /^p\d+\.json$/.test(f)).sort();
  for (const f of files) {
    const part = readJson(path.join(PARTS, f));
    if (!Array.isArray(part.enemies)) { err(`${f} 里没有 enemies 数组`); continue; }
    for (const item of part.enemies) {
      const id = item?.id;
      if (!id) { err(`${f} 里有一条没有 id`); continue; }
      if (!byId.has(id)) { err(`${f} 里的 id「${id}」不在 roster 里`); continue; }
      if (fromParts.has(id)) { err(`id「${id}」在分片里出现了两次`); continue; }
      fromParts.add(id);
      merged.set(id, { file: f, voice: item.voice ?? {} });
    }
  }
  if (files.length) console.log(`分片 ${files.length} 个 · 覆盖 ${fromParts.size} 只（其余沿用 content/enemy-voice.json）`);
}

const missing = [...byId.keys()].filter((id) => !merged.has(id));
if (missing.length) err(`有 ${missing.length} 只没有口吻台词：${missing.join(', ')}`);

// ---- 2. 逐条规则 ----
const BAD_TONE = /以前|曾经|旧版|反馈|玩家|系统|更新|测试/;
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u;
const QUOTES = /[「」『』“”‘’"]/;
const table = {};   // zh -> { ja, en }
for (const [id, { file, voice }] of merged) {
  const def = byId.get(id);
  const zh = voice.zh ?? [];
  const ja = voice.ja ?? [];
  const en = voice.en ?? [];
  const at = (i) => `${file} 【${id}】第 ${i + 1} 句`;

  if (zh.length < 3) err(`${file} 【${id}】只有 ${zh.length} 句中文（要 3 句）`);
  if (ja.length !== zh.length) err(`${file} 【${id}】日文 ${ja.length} 句 / 中文 ${zh.length} 句，对不上`);
  if (en.length !== zh.length) err(`${file} 【${id}】英文 ${en.length} 句 / 中文 ${zh.length} 句，对不上`);

  const lines = new Set(def.lines ?? []);
  const seen = new Set();
  for (let i = 0; i < zh.length; i++) {
    const s = String(zh[i] ?? '').trim();
    if (!s) { err(`${at(i)} 是空的`); continue; }
    if (s.length < 8) warn(`${at(i)} 只有 ${s.length} 字（偏短）：${s}`);
    if (s.length > 34) err(`${at(i)} 有 ${s.length} 字（太长，框里会折行）：${s}`);
    if (QUOTES.test(s)) err(`${at(i)} 里带了引号（界面自己会套「」）：${s}`);
    if (/[\n\r]/.test(s)) err(`${at(i)} 里有换行`);
    if (/\*\*|\{|\}/.test(s)) err(`${at(i)} 里有 ** 或 {}：${s}`);
    if (EMOJI.test(s)) err(`${at(i)} 里有 emoji：${s}`);
    if (BAD_TONE.test(s)) err(`${at(i)} 里有开发口气/现代词：${s}`);
    if (lines.has(s)) err(`${at(i)} 和它的**出场台词**一字不差：${s}`);
    if (seen.has(s)) err(`${at(i)} 和这只的其它口吻台词重复：${s}`);
    seen.add(s);

    const j = String(ja[i] ?? '').trim();
    const e2 = String(en[i] ?? '').trim();
    if (!j) err(`${at(i)} 没有日文`);
    if (!e2) err(`${at(i)} 没有英文`);
    if (QUOTES.test(j)) err(`${at(i)} 的日文带了引号：${j}`);
    if (QUOTES.test(e2)) err(`${at(i)} 的英文带了引号：${e2}`);
    if (/[\n\r]/.test(j) || /[\n\r]/.test(e2)) err(`${at(i)} 的译文里有换行`);

    const prev = table[s];
    if (prev && (prev.ja !== j || prev.en !== e2)) {
      err(`中文「${s}」出现了两次，但日 / 英译文不一样（${id} vs 别处）`);
    } else if (!prev) {
      table[s] = { ja: j, en: e2 };
    }
  }
}

if (warns.length) {
  console.log(`提醒 ${warns.length} 条：`);
  for (const w of warns.slice(0, 20)) console.log('  · ' + w);
  if (warns.length > 20) console.log(`  · …还有 ${warns.length - 20} 条`);
}
if (problems.length) {
  console.error(`\n口吻台词对账失败，共 ${problems.length} 条：`);
  for (const p of problems.slice(0, 40)) console.error('  ✗ ' + p);
  if (problems.length > 40) console.error(`  ✗ …还有 ${problems.length - 40} 条`);
  process.exit(1);
}

console.log(`口吻台词：${merged.size} 只 · ${[...merged.values()].reduce((n, v) => n + (v.voice.zh?.length ?? 0), 0)} 句（其中分片新写的 ${fromParts.size} 只）`);

if (CHECK) { console.log('（--check：没有写文件）'); process.exit(0); }

// ---- 3. 写 content/enemy-voice.json ----
const voice = {};
for (const [id, { voice: v }] of [...merged].sort(([a], [b]) => (a < b ? -1 : 1))) voice[id] = v.zh.map((s) => String(s).trim());
fs.writeFileSync(OUT, JSON.stringify({
  note: '图鉴详情页「它可能会这么说」的口吻台词（每只 3 句，按击败次数轮换）。**新增宝可梦必须补这里**：'
    + '缺一条 tools/check-content.mjs 就会红。写的时候不许和 content/enemies.json 里的 lines（出场台词）重复，'
    + '也不许出现现实动物名与开发口气。由 tools/voice-brief.mjs 出简报、tools/merge-enemy-voice.mjs 合并。',
  voice,
}, null, 2) + '\n', 'utf8');
console.log('written: content/enemy-voice.json');

// ---- 4. 补进 i18n 字典（和 build-i18n.mjs 一样：排序写回、2 空格缩进、结尾换行）----
for (const lg of ['ja', 'en']) {
  const file = path.join(ROOT, 'content', 'i18n', `${lg}.json`);
  const dict = readJson(file);
  let added = 0;
  for (const [zh, tr] of Object.entries(table)) {
    const want = tr[lg];
    if (!dict[zh]) { dict[zh] = want; added += 1; }
    else if (dict[zh] !== want) warn(`${lg} 里「${zh}」已有别的译文，保留了原来的`);
  }
  const sorted = {};
  for (const k of Object.keys(dict).sort()) sorted[k] = dict[k];
  fs.writeFileSync(file, JSON.stringify(sorted, null, 2) + '\n', 'utf8');
  console.log(`written: content/i18n/${lg}.json（新增 ${added} 条，共 ${Object.keys(sorted).length} 条）`);
}
