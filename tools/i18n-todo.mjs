// 多语言待翻清单的**分片工具**（一次写完三件事，省得三个脚本各写一半）。
//
// 为什么需要它：`node tools/build-i18n.mjs` 会算出「哪些中文串还没翻」，
// 但那份清单只告诉你**数量**（ja 3261/3467），拿不到具体是哪 206 条。
// 批量补翻译（尤其是分给多个写手时）需要三样东西：**清单**、**分片**、**合并回去**。
//
// 用法：
//   node tools/i18n-todo.mjs list          # 把待翻的中文串写成 content/i18n/_todo.json，并打印数量
//   node tools/i18n-todo.mjs slice 0 30    # 打印第 0~29 条（写手读这个，不用把整份塞进提示里）
//   node tools/i18n-todo.mjs merge         # 把 content/i18n/parts/*.json 合并进 ja.json / en.json
//
// 分片文件格式（写手产出）：
//   { "橙橙果": { "ja": "オレンのみ", "en": "Oran Berry" }, ... }
// 合并时会检查：每一条都翻到了、占位符 {x} 两边一致、日 / 英都不为空。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const I18N = path.join(ROOT, 'content', 'i18n');
const TODO = path.join(I18N, '_todo.json');
const PARTS = path.join(I18N, 'parts');
const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

/** 收集当前**所有可见的中文串**：直接问 build-i18n（它才是唯一权威） */
async function allStrings() {
  const { collectStrings } = await import('./build-i18n.mjs').catch(() => ({}));
  if (collectStrings) return collectStrings();
  return null;
}

const cmd = process.argv[2] ?? 'list';

if (cmd === 'list') {
  /**
   * 权威清单来自 `content/i18n/_report.json` 的 `missing`（build-i18n 生成的，
   * 那里**不会截断** —— 它就是为了给工具链读的）。两种语言缺的合起来去重，
   * 所以一条中文串只要有一种语言没翻就会被列出来。
   */
  const report = readJson(path.join(I18N, '_report.json'));
  const ja = new Set(report.missing?.ja ?? []);
  const en = new Set(report.missing?.en ?? []);
  const todo = [...new Set([...ja, ...en])];
  fs.writeFileSync(TODO, JSON.stringify(todo, null, 2) + '\n', 'utf8');
  console.log(`待翻 ${todo.length} 条（ja 缺 ${ja.size} · en 缺 ${en.size}）→ content/i18n/_todo.json（全表 ${report.neededTotal} 条可见文案）`);
} else if (cmd === 'slice') {
  const from = Number(process.argv[3] ?? 0);
  const to = Number(process.argv[4] ?? from + 20);
  const todo = readJson(TODO);
  const part = todo.slice(from, to);
  console.log(JSON.stringify(part, null, 1));
  console.error(`-- 第 ${from}~${to - 1} 条，共 ${part.length} 条 / 全表 ${todo.length} 条 --`);
} else if (cmd === 'merge') {
  const files = fs.existsSync(PARTS) ? fs.readdirSync(PARTS).filter((f) => f.endsWith('.json')).sort() : [];
  if (!files.length) { console.error('content/i18n/parts/ 里没有分片'); process.exit(1); }
  const todo = fs.existsSync(TODO) ? new Set(readJson(TODO)) : null;
  const table = {};
  const problems = [];
  for (const f of files) {
    const part = readJson(path.join(PARTS, f));
    for (const [zh, tr] of Object.entries(part)) {
      const ja = String(tr?.ja ?? '').trim();
      const en = String(tr?.en ?? '').trim();
      if (!ja || !en) { problems.push(`${f}: 「${zh}」缺 ${!ja ? 'ja' : 'en'}`); continue; }
      const holes = (s) => (String(s).match(/\{(\w+)\}/g) ?? []).sort().join(',');
      if (holes(zh) !== holes(ja) || holes(zh) !== holes(en)) {
        problems.push(`${f}: 「${zh}」的占位符对不上（zh ${holes(zh) || '无'} / ja ${holes(ja) || '无'} / en ${holes(en) || '无'}）`);
        continue;
      }
      if (table[zh] && (table[zh].ja !== ja || table[zh].en !== en)) {
        problems.push(`${f}: 「${zh}」在两个分片里译得不一样`);
        continue;
      }
      table[zh] = { ja, en };
    }
  }
  if (todo) {
    const miss = [...todo].filter((zh) => !table[zh]);
    if (miss.length) problems.push(`还差 ${miss.length} 条没翻：${miss.slice(0, 8).join(' ｜ ')}…`);
  }
  if (problems.length) {
    console.error(`合并失败，${problems.length} 个问题：`);
    for (const p of problems.slice(0, 30)) console.error('  ✗ ' + p);
    process.exit(1);
  }
  for (const lg of ['ja', 'en']) {
    const file = path.join(I18N, `${lg}.json`);
    const dict = readJson(file);
    let added = 0;
    for (const [zh, tr] of Object.entries(table)) if (!dict[zh]) { dict[zh] = tr[lg]; added += 1; }
    const sorted = {};
    for (const k of Object.keys(dict).sort()) sorted[k] = dict[k];
    fs.writeFileSync(file, JSON.stringify(sorted, null, 2) + '\n', 'utf8');
    console.log(`${lg}: 新增 ${added} 条，共 ${Object.keys(sorted).length} 条`);
  }
  console.log(`合并完成：${Object.keys(table).length} 条（来自 ${files.length} 个分片）`);
} else {
  console.error('用法：list | slice <from> <to> | merge');
  process.exit(1);
}
