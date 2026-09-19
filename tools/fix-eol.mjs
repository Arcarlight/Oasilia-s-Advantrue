// 把工作区里被 git 弄成 CRLF 的文件还原成 LF。
//
// 为什么需要它：这台机器上 `core.autocrlf=true`（git 会把检出到工作区的行尾改成 CRLF），
// 而编辑器 / 本仓库的文件工具写的都是 LF。于是**任何一次**
// `git checkout -- <file>`、`git stash pop`、`git reset --hard` 之后，
// 那个文件在工作区里就是 CRLF，而索引（以及线上 GitHub Pages 发的字节）是 LF。
// 内容一个字都没变，但 tools/compare-deployed.mjs 是**逐字节**比 sha256 的，
// 会报一条假的「不一致」—— 2026-09-19 就为这个白查了一轮 CDN 缓存。
//
// 仓库里已经放了 `.gitattributes`（`* text=auto eol=lf`）从源头上关掉 CRLF 转换，
// 这个脚本是给「已经变成 CRLF 的文件」收尾用的。
//
// 用法：node tools/fix-eol.mjs <文件…>        # 也可以直接把 git status 里那几个 M 的文件丢进来
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const files = process.argv.slice(2);
if (!files.length) {
  console.log('用法: node tools/fix-eol.mjs <文件…>');
  process.exit(1);
}
let touched = 0;
for (const rel of files) {
  const p = path.join(ROOT, rel);
  const buf = await fs.readFile(p).catch(() => null);
  if (!buf) { console.log(`  ✗ ${rel} 读不到`); process.exitCode = 1; continue; }
  // 全程按 latin1 处理：只动 \r\n，绝不碰任何多字节内容（中文注释、emoji 都不会被破坏）
  const text = buf.toString('latin1');
  const crlf = (text.match(/\r\n/g) ?? []).length;
  if (!crlf) { console.log(`  · ${rel} 已经是 LF`); continue; }
  const fixed = Buffer.from(text.replace(/\r\n/g, '\n'), 'latin1');
  await fs.writeFile(p, fixed);
  touched += 1;
  console.log(`  ✓ ${rel}：CRLF ${crlf} 处 → LF（${buf.length} → ${fixed.length} 字节）`);
}
console.log(touched ? `修好 ${touched} 个文件（内容不变，只是行尾）` : '都不用改');
