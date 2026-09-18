// 解析已缓存的 d-symphony 素材页，找出目标曲目的 mp3/ogg 链接。
// 页面由 tools/fetch-dsymphony-page.ps1 缓存到 tools/dsymphony-cache/。
// 用法: node tools/parse-dsymphony.mjs [关键词]
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '..');
const KEY = process.argv[2] ?? 'Freezing Edge';

const dir = path.join(ROOT, 'tools', 'dsymphony-cache');
const files = await fs.readdir(dir).catch(() => []);
if (!files.length) {
  console.log('缓存目录为空，先跑 & tools/fetch-dsymphony-page.ps1');
  process.exit(1);
}

for (const file of files) {
  const html = await fs.readFile(path.join(dir, file), 'utf8');
  console.log(`=== ${file} (${html.length} 字节) ===`);

  // 页面把每首曲子的所有下载链接集中在一个区块里，
  // 所以先切出「含关键词的窗口」，再把窗口里的 mp3/ogg 全抓出来。
  const idx = html.indexOf(KEY);
  if (idx < 0) { console.log('  没有找到关键词'); continue; }

  // 往前找到这一段落的起点（上一个 <div 或 <tr），往后找终点
  const back = Math.max(html.lastIndexOf('<tr', idx), html.lastIndexOf('<div', idx), idx - 1200);
  const fwd = Math.min(
    [html.indexOf('</tr>', idx), html.indexOf('</div>', idx)].filter((x) => x > 0).concat([idx + 1500]).reduce((a, b) => Math.min(a, b)),
  );
  const window = html.slice(back > 0 ? back : 0, fwd > 0 ? fwd : idx + 1500);
  const plain = window.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  console.log('  描述: ' + plain.slice(0, 260));

  const links = [...new Set([...window.matchAll(/href="([^"]+\.(?:mp3|ogg|mid))"/gi)].map((m) => m[1]))];
  console.log('  音频链接:');
  for (const l of links) console.log('     ' + l);
  if (!links.length) {
    // 关键词可能出现在注释/标签里，扩大到整页找同名文件
    const all = [...new Set([...html.matchAll(/href="([^"]+\.(?:mp3|ogg))"/gi)].map((m) => m[1]))];
    console.log(`  该窗口没抓到链接（整页共 ${all.length} 个音频链接，示例 ${all.slice(0, 5).join(', ')}）`);
  }
  console.log('');
}

// 顺带看看页面里关于授权的说明
const html = await fs.readFile(path.join(dir, files[0]), 'utf8');
const text = html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
console.log('=== 授权相关文字 ===');
let found = false;
for (const kw of ['利用規約', '規約', '商用', '著作', 'クレジット', 'リンク']) {
  const i = text.indexOf(kw);
  if (i >= 0) { console.log(`【${kw}】` + text.slice(i, i + 260)); found = true; }
}
if (!found) console.log('（这一页没有直接的授权说明，链接：' + [...new Set([...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]))].filter((l) => /html$/.test(l)).slice(0, 15).join(', ') + '）');
