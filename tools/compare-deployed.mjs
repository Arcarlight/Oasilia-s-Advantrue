// 线上站点 vs 本地工作区：把关键文件逐个取回来比 sha256。
// 比截图更硬的证据 —— 截图只能证明「看起来对」，哈希能证明「跑的就是这份代码」。
//
// 用法：$env:NODE_USE_ENV_PROXY="1"; $env:HTTPS_PROXY="http://127.0.0.1:7897"; node tools/compare-deployed.mjs
//
// 代理走 Node 24 自带的 NODE_USE_ENV_PROXY（这台机器直连 github.io 不通），
// 不用额外依赖：本仓库没有 node_modules，引 undici 会直接报错。
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.PAGES_URL ?? 'https://arcarlight.github.io/Oasilia-s-Advantrue/';
if (!process.env.NODE_USE_ENV_PROXY && !process.env.HTTPS_PROXY) {
  console.warn('提示：这台机器直连 github.io 不通，需要 NODE_USE_ENV_PROXY=1 + HTTPS_PROXY。');
}

const FILES = [
  'index.html',
  'src/main.js',
  'src/ui/battle-view.js',
  'src/ui/style.css',
  'src/ui/hud.js',
  'src/ui/overlays.js',
  'src/core/gen9.js',
  'src/data/gen9.js',
  'assets/gen9/flygon/back.png',
  'assets/gen9/flygon/front.png',
  'assets/gen9/sandile/front.png',
  'tools/diag-turnart.js',
];

const sha = (buf) => createHash('sha256').update(buf).digest('hex');

let bad = 0;
for (const rel of FILES) {
  const local = sha(await readFile(path.join(ROOT, rel)));
  let remote = null;
  try {
    const res = await fetch(BASE + rel, { cache: 'no-store' });
    if (res.ok) remote = sha(Buffer.from(await res.arrayBuffer()));
    else remote = `HTTP ${res.status}`;
  } catch (e) {
    remote = `ERR ${e.message}`;
  }
  const ok = local === remote;
  if (!ok) bad += 1;
  console.log(`${ok ? '一致 ✓' : '不一致 ✗'}  ${rel.padEnd(30)} 本地 ${local.slice(0, 12)}  线上 ${String(remote).slice(0, 12)}`);
}
console.log(bad ? `\n有 ${bad} 个文件不一致` : '\n全部一致：线上跑的就是本地这份代码');
process.exitCode = bad ? 1 : 0;
