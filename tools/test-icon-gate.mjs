// 一次性反例测试：证明 check-icons.mjs 现在会「报错 + exit 1」。
// 做法：往 src 里临时塞一个不存在的 ico-* 类名 → 跑 check-icons → 必须 exit 1 →
// 用哈希校验把文件还原成**逐字节一致**的原文。
// 用完即删（不进仓库）。
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';

const TARGET = 'src/ui/dom.js';
const BOGUS = 'ico-f1bogus_check';

const hash = (b) => createHash('sha256').update(b).digest('hex');
const before = await fs.readFile(TARGET);
const beforeHash = hash(before);
console.log(`目标文件 ${TARGET}：${before.length} B，sha256=${beforeHash.slice(0, 16)}…`);

// 1) 基线：注入前必须是绿的
const base = spawnSync('node', ['tools/check-icons.mjs'], { encoding: 'utf8' });
console.log(`\n[注入前] exit=${base.status}`);
if (base.status !== 0) {
  console.log('基线就不是 0，先别测了：\n' + base.stdout);
  process.exit(1);
}

try {
  // 2) 注入一个不存在的类名
  await fs.writeFile(TARGET, before.toString('utf8') + `\n// 反例测试用（马上还原）：el('span', { class: '${BOGUS}' });\n`, 'utf8');
  const bad = spawnSync('node', ['tools/check-icons.mjs'], { encoding: 'utf8' });
  const lines = bad.stdout.split('\n').filter((l) => l.includes('❌') || l.includes(BOGUS) || l.includes('未通过'));
  console.log(`\n[注入后] exit=${bad.status}（必须是 1）`);
  for (const l of lines) console.log('   ' + l.trim());
  console.log(bad.status === 1 && lines.length ? '\n✅ 防线有效：报了错，并且 exit code = 1' : '\n❌ 防线无效');
} finally {
  // 3) 还原并逐字节校验
  await fs.writeFile(TARGET, before);
}

const after = await fs.readFile(TARGET);
console.log(`\n[还原] ${after.length} B，sha256=${hash(after).slice(0, 16)}…`);
console.log(beforeHash === hash(after) ? '✅ 与原文逐字节一致' : '❌ 还原不一致！');
const again = spawnSync('node', ['tools/check-icons.mjs'], { encoding: 'utf8' });
console.log(`[还原后] exit=${again.status}（应为 0）`);
