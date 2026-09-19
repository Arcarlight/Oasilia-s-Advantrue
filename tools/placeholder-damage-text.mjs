// 把卡面文案里的伤害数字换成 {d} / {d2} 占位符。
//
// 为什么必须换：伤害公式改成「威力 × 攻击力」之后，一张牌打多少**取决于玩家的攻击力**，
// 卡面上印死的「造成 6 点伤害」从第 2 章起就是错的。
// 现在占位符由 UI 按当前攻击/防御实时算（src/ui/cardtext.js 的 resolveCardText），
// 卡面、详情页、商店、排序全都读同一份推导结果 —— 不会再出现「文案和引擎两套数」。
//
// 用法: node tools/placeholder-damage-text.mjs [--write]
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const file = path.join(root, 'content', 'cards.json');
const data = JSON.parse(fs.readFileSync(file, 'utf8'));
const WRITE = process.argv.includes('--write');

const rows = [];
for (const c of data.cards) {
  const before = c.text;
  let text = before;
  const dmgEffs = (c.effects ?? []).filter((e) => e.kind === 'damage');
  if (dmgEffs.length) {
    // 「改为造成 N 点」是斩杀分支，先换成 {d2}，免得被下一条规则吃掉
    text = text.replace(/改为造成\s*\d+\s*点/g, '改为造成 {d2} 点');
    text = text.replace(/造成\s*\d+\s*点伤害/g, (m) => (m.includes('{d2}') ? m : '造成 {d} 点伤害'));
    // 「造成 N 点」（不带「伤害」，例如流沙类文案）
    text = text.replace(/造成\s*\d+\s*点(?![伤害])/g, '造成 {d} 点');
  }
  if (text !== before) rows.push({ id: c.id, name: c.name, before, after: text });
  if (WRITE) c.text = text;
}

for (const r of rows) {
  console.log(`${r.id}\n  旧: ${r.before}\n  新: ${r.after}`);
}
console.log(`\n${rows.length} 张卡的文案已改为占位符${WRITE ? '（已写回）' : '（未写文件）'}`);

if (WRITE) fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf8');
