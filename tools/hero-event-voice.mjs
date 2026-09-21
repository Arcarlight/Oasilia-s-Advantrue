// 给**公共事件**生成「阿特拉斯版」文案（不覆盖原来的那一份）。
//
// 用户的原话：「不是，没让你改公共事件，让你给公共事件写一个暴飞龙版，而不是覆盖原来的。」
//
// 做法：
//   ① 原版（欧亚西莉亚那一份）一个字都不动 —— 它是 `text` / `label` / `hint` / 结果文案本身；
//   ② 阿特拉斯那一份挂在 `heroText` / `heroLabel` / `heroHint`（`{ atlas: '…' }`）下面；
//   ③ 素材来自 content/events/_voice.json —— 那是重写过的「中性口吻」台词表
//      （deepseek-v4-pro 写的：去掉萌系语气词、保留意思与画面感，NPC 的台词原样不动）。
//      生成时**只把主角自己那几句换掉**，旁白与 NPC 的话不动 ——
//      这样阿特拉斯版读起来和他一样沉稳，而欧亚西莉亚版仍然俏皮。
//
// 用法：node tools/hero-event-voice.mjs [--write]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'content', 'events');
const VOICE = path.join(DIR, '_voice.json');
const WRITE = process.argv.includes('--write');
const HERO = 'atlas';

const voice = JSON.parse(fs.readFileSync(VOICE, 'utf8'));
const { _comment, ...MAP } = voice;   // _comment 是人读的说明，不参与替换

/** 把一段文案里「主角说的那几句」换成中性台词；没得换就返回原样 */
function atlasVersion(s) {
  if (typeof s !== 'string' || !s) return s;
  let out = s;
  for (const [from, to] of Object.entries(MAP)) {
    if (typeof to !== 'string' || !to || to === from) continue;
    if (out.includes(from)) out = out.split(from).join(to);
  }
  return out;
}

/** 递归处理事件里的文案节点：正文 / 选项的 label、hint、text / 结果块（含 branch / if） */
function patchNode(obj, field, put) {
  if (!obj || typeof obj !== 'object') return;
  const cur = obj[field];
  if (typeof cur === 'string' && cur) {
    const next = atlasVersion(cur);
    if (next !== cur) put(obj, field, next);
  }
}
function walkBlocks(block, put) {
  if (Array.isArray(block)) { for (const b of block) walkBlocks(b, put); return; }
  if (!block || typeof block !== 'object') return;
  patchNode(block, 'text', put);
  if (block.effects) walkBlocks(block.effects, put);
  if (block.branch) for (const b of block.branch) walkBlocks(b, put);
  if (block.if) { walkBlocks(block.then, put); walkBlocks(block.else, put); }
}

let events = 0; let texts = 0; let labels = 0; let hints = 0; let results = 0;
const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.json') && !f.startsWith('_')).sort();
for (const f of files) {
  const p = path.join(DIR, f);
  const arr = JSON.parse(fs.readFileSync(p, 'utf8'));
  let touched = false;
  for (const ev of arr) {
    // 专属事件（hero / heroNot）不动：它们本来就是按某一位主角写的
    if (ev.hero || ev.heroNot) continue;
    const putHead = (o, field, next) => { o.heroText = { ...(o.heroText ?? {}), [HERO]: next }; texts += 1; };
    patchNode(ev, 'text', putHead);
    for (const opt of ev.options ?? []) {
      patchNode(opt, 'label', (o, field, next) => { o.heroLabel = { ...(o.heroLabel ?? {}), [HERO]: next }; labels += 1; });
      patchNode(opt, 'hint', (o, field, next) => { o.heroHint = { ...(o.heroHint ?? {}), [HERO]: next }; hints += 1; });
      patchNode(opt, 'text', (o, field, next) => { o.heroText = { ...(o.heroText ?? {}), [HERO]: next }; results += 1; });
      walkBlocks(opt.effects, (o, field, next) => { o.heroText = { ...(o.heroText ?? {}), [HERO]: next }; results += 1; });
    }
    if (ev.heroText) touched = true;
    else if ((ev.options ?? []).some((o) => o.heroText || o.heroLabel || o.heroHint)) touched = true;
  }
  if (touched) {
    events += 1;
    if (WRITE) fs.writeFileSync(p, JSON.stringify(arr, null, 2) + '\n', 'utf8');
    console.log(`  ${f}：写入了阿特拉斯版`);
  }
}
console.log(`\n共 ${events} 个文件有改动 · 正文 ${texts} · 选项标签 ${labels} · 提示 ${hints} · 结果文案 ${results}`);
console.log(WRITE ? '✓ 已写入 content/events/*.json' : '（dry run：加 --write 才写文件）');
