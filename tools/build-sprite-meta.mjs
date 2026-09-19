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

/**
 * 极简 XML 提取：读出每个 <Anim> 的 Name / FrameWidth / FrameHeight / CopyOf。
 *
 * **必须处理 `<CopyOf>`**：SpriteCollab 里有一批动画不写自己的帧尺寸，而是写
 * `<CopyOf>Walk</CopyOf>`（「和 Walk 一样」），一共 112 条。以前这里忽略了这个标签，
 * 于是那些动画的 fw/fh 读出来是 undefined → 走「整张图当一帧」的兜底 →
 * 界面上把一整张精灵表当成一个立绘画出来。
 * 实测踩到的就是**大针蜂的 Idle**（`<CopyOf>Walk</CopyOf>`，32×48），
 * 战斗中它显示成一堆小蜜蜂铺满屏幕（玩家反馈「大针蜂的行走图有问题」）。
 *
 * CopyOf 可能指向**后面**才定义的动画，所以先全读出来、再统一解析一遍。
 */
function parseAnimData(xml) {
  const raw = {};
  const re = /<Anim>([\s\S]*?)<\/Anim>/g;
  let m;
  while ((m = re.exec(xml))) {
    const body = m[1];
    const name = (/<Name>([^<]+)<\/Name>/.exec(body) || [])[1];
    if (!name) continue;
    const fw = Number((/<FrameWidth>(\d+)<\/FrameWidth>/.exec(body) || [])[1]);
    const fh = Number((/<FrameHeight>(\d+)<\/FrameHeight>/.exec(body) || [])[1]);
    const copyOf = (/<CopyOf>([^<]+)<\/CopyOf>/.exec(body) || [])[1];
    raw[name] = { fw: fw || null, fh: fh || null, copyOf: copyOf ?? null };
  }
  // 解析 CopyOf（带环路保护：上游数据里理论上不该有环，但不能让脚本因此挂死）
  const resolve = (name, depth = 0) => {
    const a = raw[name];
    if (!a || depth > 6) return null;
    if (a.fw && a.fh) return { fw: a.fw, fh: a.fh };
    if (a.copyOf) return resolve(a.copyOf, depth + 1);
    return null;
  };
  const out = {};
  for (const name of Object.keys(raw)) {
    const r = resolve(name);
    if (r) out[name] = r;
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
  const files = (await fs.readdir(dir)).filter((f) => f.endsWith('.png'));
  /** 先把这个物种所有图的尺寸读出来，兜底推断要用到彼此 */
  const sizes = {};
  for (const file of files) {
    sizes[path.basename(file, '.png')] = parsePng(await fs.readFile(path.join(dir, file)));
  }
  /**
   * 兜底推断：AnimData 里查不到帧尺寸时，**不要**直接把整张图当成一帧
   * （那是一整张精灵表，画出来就是「一堆小精灵铺满屏幕」）。
   * 用同一物种里别的动画推：PMD 的精灵表永远是 8 行（8 个朝向），
   * 于是 fh = 高 ÷ 8，fw = 宽 ÷ 列数 —— 列数取「同一物种别的动画的帧宽」能整除的那个。
   */
  const inferCell = (name, width, height) => {
    if (height % 8 !== 0) return null;
    const fh = height / 8;
    // 优先用帧高相同的那个动画的帧宽（大针蜂的 Idle 就是「和 Walk 一样」）
    const peers = Object.entries(anims).filter(([n]) => n !== name);
    const sameHeight = peers.find(([, a]) => a.fh === fh && width % a.fw === 0);
    if (sameHeight) return { fw: sameHeight[1].fw, fh };
    const anyFits = peers.find(([, a]) => width % a.fw === 0 && width / a.fw >= 2 && width / a.fw <= 16);
    if (anyFits) return { fw: anyFits[1].fw, fh };
    // 实在没有参照：取能整除、且列数落在 2~16 的最大帧宽（帧越大越不容易切错行）
    for (let w = Math.min(width, fh * 2); w >= 8; w--) {
      if (width % w === 0 && width / w >= 2 && width / w <= 16) return { fw: w, fh };
    }
    return null;
  };

  for (const file of files) {
    const name = path.basename(file, '.png');
    const { width, height } = sizes[name];
    let fw = anims[name]?.fw ?? 0;
    let fh = anims[name]?.fh ?? 0;
    if (!fw || !fh || width % fw !== 0 || height % fh !== 0) {
      const inferred = inferCell(name, width, height);
      if (inferred) {
        if (fw && fh) {
          console.warn('size mismatch ' + slug + '/' + name + ': animdata ' + fw + 'x' + fh
            + ' vs image ' + width + 'x' + height + ' -> 推断为 ' + inferred.fw + 'x' + inferred.fh);
        } else {
          console.warn('no frame size ' + slug + '/' + name + '（AnimData 里只有 CopyOf？）-> 推断为 '
            + inferred.fw + 'x' + inferred.fh);
        }
        fw = inferred.fw; fh = inferred.fh;
        warns++;
      } else {
        console.warn('size mismatch ' + slug + '/' + name + ': ' + fw + 'x' + fh
          + ' vs image ' + width + 'x' + height + ' -> 无法推断，整张图当一帧');
        fw = width; fh = height; warns++;
      }
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
