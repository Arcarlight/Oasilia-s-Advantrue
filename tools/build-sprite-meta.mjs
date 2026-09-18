// 生成精灵元数据：从本地缓存的 SpriteCollab AnimData.xml 读取精确帧尺寸，
// 并校验本地精灵图能否被帧尺寸整除。
//
// 物种清单来自 content/species.json（内容管线的唯一数据源），不再是手写表：
// 加物种只需要在 species.json 里加一行，然后跑 tools/fetch-content.ps1（它会调本脚本）。
// 用法: node tools/build-sprite-meta.mjs
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '..');
const DIR = path.join(ROOT, 'assets', 'pokemon');
const OUT = path.join(ROOT, 'assets', 'data');

// 物种 slug -> 全国图鉴编号（来自 content/species.json）
const speciesJson = JSON.parse(await fs.readFile(path.join(ROOT, 'content', 'species.json'), 'utf8'));
const DEX = Object.fromEntries(Object.entries(speciesJson.species).map(([slug, s]) => [slug, String(s.dex)]));

// 兜底：主角（不一定出现在敌人表里）也要有元数据，否则玩家精灵会画不出来
const { BALANCE } = await import('../src/data/balance.js');
if (!DEX[BALANCE.player.species]) {
  DEX[BALANCE.player.species] = String(BALANCE.player.dex);
  console.warn('species.json 里没有主角 ' + BALANCE.player.species + '，已自动补上（建议把它写进 content/species.json）');
}

// 反过来提醒：磁盘上有精灵图、但物种表里没有的目录（通常是忘了登记）
for (const entry of await fs.readdir(DIR)) {
  const st = await fs.stat(path.join(DIR, entry)).catch(() => null);
  if (st?.isDirectory() && !DEX[entry]) {
    console.warn('assets/pokemon/' + entry + ' 有精灵图但 content/species.json 里没登记，会被跳过');
  }
}

function parsePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG');
  let off = 8;
  let width = 0, height = 0;
  while (off + 8 <= buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') { width = data.readUInt32BE(0); height = data.readUInt32BE(4); }
    off += 12 + len;
    if (type === 'IEND') break;
  }
  return { width, height };
}

// 极简 XML 提取：读出每个 <Anim> 的 Name / FrameWidth / FrameHeight
function parseAnimData(xml) {
  const out = {};
  const re = /<Anim>([\s\S]*?)<\/Anim>/g;
  let m;
  while ((m = re.exec(xml))) {
    const body = m[1];
    const name = (/<Name>([^<]+)<\/Name>/.exec(body) || [])[1];
    const fw = Number((/<FrameWidth>(\d+)<\/FrameWidth>/.exec(body) || [])[1]);
    const fh = Number((/<FrameHeight>(\d+)<\/FrameHeight>/.exec(body) || [])[1]);
    if (name && fw && fh) out[name] = { fw, fh };
  }
  return out;
}

async function loadAnimData(dexId) {
  const file = path.join(ROOT, 'tools', 'animdata-cache', dexId + '.xml');
  return parseAnimData(await fs.readFile(file, 'utf8'));
}

await fs.mkdir(OUT, { recursive: true });
const meta = {};
let count = 0, warns = 0;

for (const slug of Object.keys(DEX)) {
  const dir = path.join(DIR, slug);
  const st = await fs.stat(dir).catch(() => null);
  if (!st?.isDirectory()) { console.warn('skip (no dir):', slug); continue; }

  let anims = {};
  try {
    anims = await loadAnimData(DEX[slug]);
  } catch (err) {
    console.warn('animdata load failed ' + slug + ': ' + err.message);
    warns++;
  }

  meta[slug] = { dex: DEX[slug], anims: {} };
  for (const file of await fs.readdir(dir)) {
    if (!file.endsWith('.png')) continue;
    const name = path.basename(file, '.png');
    const { width, height } = parsePng(await fs.readFile(path.join(dir, file)));
    let fw = anims[name]?.fw ?? width;
    let fh = anims[name]?.fh ?? height;
    if (width % fw !== 0 || height % fh !== 0) {
      console.warn('size mismatch ' + slug + '/' + name + ': animdata ' + fw + 'x' + fh + ' vs image ' + width + 'x' + height + ' -> single frame');
      fw = width; fh = height; warns++;
    }
    const cols = Math.round(width / fw);
    const rows = Math.round(height / fh);
    meta[slug].anims[name] = { fw, fh, cols, rows, frames: cols * rows };
    count++;
  }
}

await fs.writeFile(path.join(OUT, 'sprites.json'), JSON.stringify(meta, null, 1), 'utf8');
console.log('sprites metadata: ' + Object.keys(meta).length + ' species / ' + count + ' anims, warnings ' + warns);
console.log(JSON.stringify(meta.flygon));
