// 给**素材还不齐**的物种抓精灵图与表情头像（PMDCollab/SpriteCollab）。
//
// 为什么要一个按物种表跑的版本：`tools/fetch_sprites.ps1` 把 96 只写死在脚本里，
// 加新物种就得手工往那个列表里补一行（本作扩到 112 只时漏过）。这里直接读
// `content/species.json`：**已有的跳过、缺的才下**，所以随时可以重跑。
//
//   node tools/fetch-sprites.mjs                 # 全部物种（只补缺的）
//   node tools/fetch-sprites.mjs carbink dedenne # 只处理这几只
//
// 本机直连 GitHub 不通，要走代理：
//   $env:NODE_USE_ENV_PROXY=1; $env:HTTPS_PROXY="http://127.0.0.1:7897"; node tools/fetch-sprites.mjs
//
// 抓完记得：`node tools/build-sprite-meta.mjs`（重算 assets/data/sprites.json），
// 回合立绘另走 `tools/import-gen9.mjs`（从 Generation 9 Pack 的 rar 里裁）。
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const species = JSON.parse(await fs.readFile(path.join(ROOT, 'content/species.json'), 'utf8')).species;
const only = process.argv.slice(2);

const BASE = 'https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master';
const ANIMS = ['Idle', 'Attack', 'Hurt'];
const EMOTIONS = ['Normal', 'Happy', 'Joyous', 'Inspired', 'Determined', 'Angry',
  'Sad', 'Pain', 'Worried', 'Surprised', 'Shouting', 'Stunned', 'Dizzy', 'Sigh', 'Crying', 'Teary-Eyed'];

const dl = async (url, dst) => {
  try { const st = await fs.stat(dst); if (st.size > 100) return 'skip'; } catch { /* 没有就下 */ }
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`${r.status}`);
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length < 100) throw new Error('太小');
      await fs.writeFile(dst, buf);
      return 'ok';
    } catch (e) {
      if (attempt === 2) { console.log(`    FAIL ${path.basename(path.dirname(dst))}/${path.basename(dst)} : ${e.message}`); return 'fail'; }
      await new Promise((r) => setTimeout(r, 400));
    }
  }
  return 'fail';
};

let ok = 0; let skip = 0; let fail = 0;
const targets = Object.entries(species).filter(([slug]) => !only.length || only.includes(slug));
console.log(`要处理 ${targets.length} 只（并发 6）`);

/**
 * 并发抓：一只 19 个文件（3 张精灵表 + 16 张头像），70 多只就是 1300 多个请求，
 * 串行要跑很久。每个物种内部仍然按顺序（别把同一个目录写乱），物种之间并发。
 */
const queue = [...targets];
const worker = async () => {
  while (queue.length) {
    const [slug, s] = queue.shift();
    const dex = String(s.dex);
    const spriteDir = path.join(ROOT, 'assets/pokemon', slug);
    const portraitDir = path.join(ROOT, 'assets/portraits', slug);
    await fs.mkdir(spriteDir, { recursive: true });
    await fs.mkdir(portraitDir, { recursive: true });
    for (const a of ANIMS) {
      const r = await dl(`${BASE}/sprite/${dex}/${a}-Anim.png`, path.join(spriteDir, `${a}.png`));
      if (r === 'ok') ok += 1; else if (r === 'skip') skip += 1; else fail += 1;
    }
    // 表情不全没关系：portraits.js 会退回静帧 / 占位，不会裂图
    for (const e of EMOTIONS) {
      const r = await dl(`${BASE}/portrait/${dex}/${e}.png`, path.join(portraitDir, `${e}.png`));
      if (r === 'ok') ok += 1; else if (r === 'skip') skip += 1; else fail += 1;
    }
    console.log(`  ${slug.padEnd(12)} 完成`);
  }
};
await Promise.all(Array.from({ length: 6 }, worker));
console.log(`素材：下载 ${ok}｜已有 ${skip}｜失败 ${fail}`);
