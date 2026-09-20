// 按 assets/img/map/ 里实际有哪些图，生成 style.css 里的 `.map-deco-*` 区块。
//
// 为什么要有这一步：地图上的装饰物是**用类名**引用的（`.map-deco-treePine`），
// 而不是 `<img src>` —— 单文件包（oasis-game.html）是在 file:// 下打开的，
// 那里 `<img src="assets/...">` 会被当成跨源请求拦掉，而 CSS 里的 url() 会被打包器内联成 data URI。
// 所以「有哪些装饰物」必须落成 CSS 类，这里就从目录扫出来生成，免得手写一份清单再走散。
//
//   node tools/build-map-decor.mjs
//
// 区块夹在 `/* GENERATED-MAP-DECOR */` 与 `/* END GENERATED-MAP-DECOR */` 之间，可重复运行。
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'assets', 'img', 'map');
const CSS = path.join(ROOT, 'src', 'ui', 'style.css');
const START = '/* GENERATED-MAP-DECOR */';
const END = '/* END GENERATED-MAP-DECOR */';

const files = (await fs.readdir(DIR).catch(() => [])).filter((f) => f.endsWith('.png')).sort();
if (!files.length) {
  console.error(`assets/img/map 里没有图 —— 先跑 node tools/copy-kenney.mjs`);
  process.exit(1);
}

const block = [
  START,
  '/* 地图装饰物（Kenney 制图包）。由 tools/build-map-decor.mjs 从 assets/img/map/ 生成，别手改。',
  '   统一用 background-image 而不是 <img>：单文件包（file://）会拦掉 <img src>，',
  '   而 CSS 里的 url() 会被打包器内联成 data URI。 */',
  ...files.map((f) => {
    const name = path.basename(f, '.png');
    return `.map-deco-${name} { background-image: url(../../assets/img/map/${f}); }`;
  }),
  END,
].join('\n');

const css = await fs.readFile(CSS, 'utf8');
const re = new RegExp(`${START.replace(/[*/]/g, (c) => `\\${c}`)}[\\s\\S]*?${END.replace(/[*/]/g, (c) => `\\${c}`)}`);
const next = re.test(css) ? css.replace(re, block) : `${css.trimEnd()}\n\n${block}\n`;
await fs.writeFile(CSS, next, 'utf8');
console.log(`地图装饰：${files.length} 个类写进 style.css（${files.map((f) => path.basename(f, '.png')).join(' ')}）`);
