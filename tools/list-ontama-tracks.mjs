// 列出 ontama-m（音楽の卵）各分类的曲目与 mp3 直链，方便挑曲。
// 页面是 Shift_JIS，所以用 node:https 取原始字节再手动解码。
// 用法: node tools/list-ontama-tracks.mjs
import https from 'node:https';
import { TextDecoder } from 'node:util';

const PAGES = {
  rpg_outdoor: 'ongaku_rpg_soto.html',
  rpg_town: 'ongaku_rpg_machi.html',
  rpg_battle: 'ongaku_rpg_battle.html',
  rpg_event: 'ongaku_rpg_event.html',
  rpg_theme: 'ongaku_rpg_theme.html',
  piano_calm: 'ongaku_piano2.html',
  orchestra: 'ongaku_c_orchestra.html',
};

function get(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { 'user-agent': 'Mozilla/5.0 (oasis-game asset fetch)' } }, (res) => {
        if (res.statusCode !== 200) { reject(new Error(`HTTP ${res.statusCode}`)); res.resume(); return; }
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks)));
      })
      .on('error', reject);
  });
}

const dec = new TextDecoder('shift_jis');
const clean = (s) => s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const TR_RE = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
const TD_RE = /<td[^>]*>([\s\S]*?)<\/td>/g;
const MP3_RE = /href="(\.\/midi\/data\/mp3_file\/[^"]+\.mp3)"/;

for (const [key, page] of Object.entries(PAGES)) {
  let html;
  try {
    html = dec.decode(await get(`https://ontama-m.com/${page}`));
  } catch (err) {
    console.log(`ERR ${key}: ${err.message}`);
    continue;
  }
  const items = [];
  for (const tr of html.matchAll(TR_RE)) {
    const mp3 = MP3_RE.exec(tr[1]);
    if (!mp3) continue;
    const tds = [...tr[1].matchAll(TD_RE)].map((t) => clean(t[1])).filter(Boolean);
    if (!tds.length) continue;
    const name = tds[0];
    const dur = tds.find((t) => /^\d+:\d\d$/.test(t)) ?? '';
    const file = mp3[1].replace(/^\.\//, '');
    if (!name || name.length > 40) continue;
    items.push({ name, dur, file });
  }
  console.log(`=== ${key}  (${items.length} tracks) ===`);
  for (const it of items) {
    console.log(`  ${it.name.padEnd(22)} | ${it.dur.padStart(5)} | ${it.file}`);
  }
  console.log('');
}
