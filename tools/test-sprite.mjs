// 精灵图 / 帧尺寸回归测试：**行走图会不会「一格里两只」**。
//
// 起因（用户反馈）：「赤面龙、电龙之类有很多宝可梦行走图有问题。」
// 量出来的根因：`assets/data/sprites.json` 里的帧宽是猜的 —— SpriteCollab 的 AnimData
// 缓存（tools/animdata-cache/<图鉴号>.xml）只覆盖了当年的 95 个物种，本作扩到 112 只时
// 新加的 17 只没有缓存，`build-sprite-meta.mjs` 走了「猜帧尺寸」的兜底，
// 而猜出来的值把**两帧当成一帧**（实测 16 个物种、31 个动画中招：
// 赤面龙 Idle 96×64 → 真正的 48×64、电龙 Attack 128×88 → 64×88），画面上就是两只并排跳。
//
// 这个错误**与图片尺寸完全自洽**（fw × cols 恒等于图片宽），所以尺寸校验报不出来 ——
// 这里改成盯「帧尺寸的来源」：凡是要被画出来的物种（敌人表 + 主角）都必须
// ① 有 AnimData 缓存、② 元数据里的每个动画都标着 src=animdata、③ 图片本身在。
//
//   node tools/test-sprite.mjs
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => fs.readFile(path.join(ROOT, p));

const { ENEMIES } = await import('../src/data/enemies.js');
const { BALANCE } = await import('../src/data/balance.js');
const species = JSON.parse(await rd('content/species.json')).species;
const meta = JSON.parse(await rd('assets/data/sprites.json'));

const fails = [];
const ok = (cond, label, detail = '') => {
  console.log(`  ${cond ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`);
  if (!cond) fails.push(label);
};

/** 要被画出来的物种：敌人表里的每一只 + 主角 */
const used = [...new Set([...ENEMIES.map((e) => e.slug), BALANCE.player.species])].sort();
const dexOf = (slug) => {
  if (species[slug]) return String(species[slug].dex).padStart(4, '0');
  if (slug === BALANCE.player.species) return String(BALANCE.player.dex).padStart(4, '0');
  return null;
};
const ANIMS = ['Idle', 'Attack', 'Hurt'];

/**
 * 「帧尺寸是猜的」检测器。
 * 单独写成函数是为了**哨兵自检**：下面会喂一份故意改坏的元数据，验证它真的会报出来
 * （否则这条测试可能只是「永远通过」的样子货）。
 */
function findGuessed(metaObj, slugs) {
  const bad = [];
  for (const slug of slugs) {
    for (const a of ANIMS) {
      const v = metaObj[slug]?.anims?.[a];
      if (v && v.src !== 'animdata') bad.push(`${slug}/${a}(${v.src})`);
    }
  }
  return bad;
}

console.log('精灵图回归测试：');

// ---------- ① 帧尺寸来源（这次报告的病根） ----------
{
  const guessed = findGuessed(meta, used);
  ok(guessed.length === 0, `${used.length} 个会被画出来的物种，帧尺寸全部来自 AnimData（不是猜的）`,
    guessed.slice(0, 8).join('、') + (guessed.length > 8 ? ` …共 ${guessed.length}` : ''));

  // 哨兵自检：故意改坏一份，检测器必须报出来
  const broken = JSON.parse(JSON.stringify(meta));
  broken[used[0]].anims.Idle = { ...broken[used[0]].anims.Idle, src: 'inferred' };
  ok(findGuessed(broken, used).length === 1, '哨兵自检：把帧尺寸标成「猜的」时，上面那条会报出来',
    `${used[0]}/Idle`);

  const missing = [];
  for (const slug of used) {
    const dex = dexOf(slug);
    if (!dex) { missing.push(`${slug}(没有图鉴号)`); continue; }
    if (!(await fs.stat(path.join(ROOT, 'tools', 'animdata-cache', dex + '.xml')).catch(() => null))) {
      missing.push(`${slug}(${dex})`);
    }
  }
  ok(missing.length === 0, `${used.length} 个物种都有 AnimData 缓存（缺了就一定会猜）`,
    missing.slice(0, 8).join('、') + (missing.length > 8 ? ` …共 ${missing.length}` : ''));
}

// ---------- ② 图片本体与切分 ----------
{
  const missingPng = [];
  const dimMismatch = [];
  let checked = 0;
  for (const slug of used) {
    for (const a of ANIMS) {
      const p = path.join(ROOT, 'assets', 'pokemon', slug, a + '.png');
      const buf = await fs.readFile(p).catch(() => null);
      if (!buf) { missingPng.push(`${slug}/${a}`); continue; }
      const w = buf.readUInt32BE(16); const h = buf.readUInt32BE(20);
      const v = meta[slug]?.anims?.[a];
      if (!v) { dimMismatch.push(`${slug}/${a}(元数据缺失)`); continue; }
      checked += 1;
      if (v.fw * v.cols !== w || v.fh * v.rows !== h || v.frames !== v.cols * v.rows) {
        dimMismatch.push(`${slug}/${a}：元数据 ${v.fw}×${v.fh}×${v.cols}×${v.rows} vs 图片 ${w}×${h}`);
      }
    }
  }
  ok(missingPng.length === 0, `${used.length} 个物种的 ${ANIMS.join('/')} 图片都在`,
    missingPng.join('、') || `${checked} 张`);
  ok(dimMismatch.length === 0, '每张精灵表的帧网格都能整除图片尺寸',
    dimMismatch.slice(0, 4).join('、') || `${checked} 张都对得上`);
}

// ---------- ③ 切得出来（不是「整张图当一帧」） ----------
{
  const thin = [];
  for (const slug of used) {
    const v = meta[slug]?.anims?.Idle;
    if (!v) { thin.push(`${slug}(没有 Idle)`); continue; }
    // PMD 的精灵表永远是 8 行朝向；Idle 只有 1 帧 = 「整张图当一帧」那种兜底
    if (v.rows !== 8 || v.frames < 8) thin.push(`${slug}(Idle ${v.cols}×${v.rows}=${v.frames} 帧)`);
  }
  ok(thin.length === 0, '每只的 Idle 都是 8 行朝向、至少 8 帧', thin.slice(0, 6).join('、') || '');
}

// ---------- ④ 战斗里用得到的另外两套素材 ----------
{
  const noArt = [];
  for (const slug of used) {
    if (slug === BALANCE.player.species) continue;
    const front = await fs.stat(path.join(ROOT, 'assets', 'gen9', slug, 'front.png')).catch(() => null);
    const back = await fs.stat(path.join(ROOT, 'assets', 'gen9', slug, 'back.png')).catch(() => null);
    if (!front || !back) noArt.push(slug);
  }
  ok(noArt.length === 0, '每只敌人都有回合立绘（正 / 背面）', noArt.slice(0, 8).join('、') || '');

  const noPortrait = [];
  for (const slug of used) {
    if (!(await fs.stat(path.join(ROOT, 'assets', 'portraits', slug, 'Normal.png')).catch(() => null))) noPortrait.push(slug);
  }
  ok(noPortrait.length === 0, '每只都有表情头像（Normal 至少要有，其它表情可缺）', noPortrait.slice(0, 8).join('、') || '');
}

// ---------- ⑤ 「整张表被当成一帧」的正面判据：行数必须是 8 ----------
/**
 * PMD 的精灵表**永远是 8 行**（8 个朝向，官方格式规定的）。所以「行数 = 8」是切分正确的硬标志：
 * 帧尺寸一旦猜错，行数几乎必然不是 8（要么 1 行 = 整张图当一帧，要么别的值）。
 *
 * （早先这里写的是「帧宽不许超过表宽一半」，那条判据对真正的 bug 是**瞎的** ——
 *   赤面龙的坏数据是 96 = 288/3，本来就不到一半；唯一被它逮住的 arcanine/Idle
 *   反倒是合法的单列精灵表。判据要能抓住真问题，不能只是看起来合理。）
 */
{
  const wrongRows = [];
  for (const slug of used) {
    for (const a of ANIMS) {
      const v = meta[slug]?.anims?.[a];
      if (v && v.rows !== 8) wrongRows.push(`${slug}/${a}: ${v.cols}×${v.rows}`);
    }
  }
  ok(wrongRows.length === 0, `${used.length} 个物种的 Idle/Attack/Hurt 都是 8 行朝向`,
    wrongRows.slice(0, 6).join('、') || '330 张表都对');
}

// ---------- ⑥ 帧数不能是 1（那就是「整张图当一帧」） ----------
{
  const single = [];
  for (const slug of used) {
    for (const a of ANIMS) {
      const v = meta[slug]?.anims?.[a];
      if (v && v.cols < 1) single.push(`${slug}/${a}`);
    }
  }
  const noIdleFrames = used.filter((s) => (meta[s]?.anims?.Idle?.cols ?? 0) < 1);
  ok(single.length === 0 && noIdleFrames.length === 0, '没有「一列都切不出来」的表',
    [...single, ...noIdleFrames].slice(0, 6).join('、') || '');
}

if (fails.length) {
  console.error(`\n精灵图回归测试：失败 ${fails.length} 条`);
  for (const f of fails) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log('\n精灵图回归测试：全部通过');
