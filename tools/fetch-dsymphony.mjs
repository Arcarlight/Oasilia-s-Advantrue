// List the downloadable tracks on a 龍的交響楽 (d-symphony.com) material page.
//
// Why this exists: the track list is only published as an HTML page full of
// mid/mp3/ogg buttons (http://d-symphony.com/mt_00.html is "all 151 tracks";
// mt_01..mt_19 are the by-mood / by-genre / by-scene views). It is the pick-list
// when choosing a track for a scene, and it also prints the terms of use so the
// licence can be re-checked before adding anything new.
//
// The download URL of a track is `<DS number>o.ogg` under https://d-symphony.com/msc/,
// which is what content/bgm.json records and tools/fetch-bgm.mjs downloads:
//   node tools/fetch-dsymphony.mjs --grep 砂漠      # pick candidates
//   -> content/bgm.json: { "source": "dsymphony", "file": "DS-145o.ogg", ... }
//   -> node tools/fetch-bgm.mjs && node tools/build-content.mjs
//
// Usage:
//   node tools/fetch-dsymphony.mjs                 # the all-tracks page
//   node tools/fetch-dsymphony.mjs mt_15.html      # one category page
//   node tools/fetch-dsymphony.mjs mt_00.html 砂漠  # only rows containing a word
import https from 'node:https';

const UA = 'Mozilla/5.0 (compatible; oasis-asset-picker)';
const SITE = 'https://d-symphony.com/';

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'user-agent': UA } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        resolve(get(new URL(res.headers.location, url).href));
        return;
      }
      if (res.statusCode !== 200) { reject(new Error(`HTTP ${res.statusCode} for ${url}`)); return; }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    }).on('error', reject);
  });
}

const [page = 'mt_00.html', grep = ''] = process.argv.slice(2);
const html = await get(SITE + page);

// Each track block is: title line, then a "1:24(midi,ogg),3:25(mp3)/2025年" line, then
// a comment line starting with ◇, then three download buttons whose *entire* content is
// an <img> (so no text survives tag stripping). That is why the ogg links are first
// replaced by a marker: after stripping, the marker sits where the buttons were, and the
// line above it is the comment, the line above that is the duration, and the one above
// that is the title. The category pages only list a subset, so the walk-back is capped.
const MARK = '\u0000OGG\u0001';
const stripped = html
  .replace(/<script[\s\S]*?<\/script>/g, '')
  .replace(/<a\b[^>]*href="msc\/(DS-\d+[a-z_]*)\.ogg"[^>]*>[\s\S]*?<\/a>/g, `${MARK}$1`)
  .replace(/<[^>]+>/g, '\n')
  .split('\n')
  .map((s) => s.trim())
  .filter(Boolean);

const rows = [];
for (const line of stripped) {
  const at = line.indexOf(MARK);
  if (at < 0) continue;
  const file = `${line.slice(at + MARK.length).trim()}.ogg`;
  const i = stripped.indexOf(line);
  let title = '';
  for (let k = i - 1; k >= Math.max(0, i - 5); k--) {
    const l = stripped[k];
    if (!l || /^\d+:\d+/.test(l) || /^[◇（(]|^tags|^関連曲|^#|^msc\//.test(l)) continue;
    if (line.includes(MARK) && l.includes(MARK)) continue;
    title = l;
    break;
  }
  rows.push({ file, title, url: `${SITE}msc/${file}` });
}

const shown = grep ? rows.filter((r) => (r.title + r.file).includes(grep)) : rows;
console.log(`page ${page}: ${rows.length} track(s) with an ogg button` + (grep ? `, ${shown.length} matching "${grep}"` : ''));
for (const r of shown) console.log(`  ${r.file.padEnd(14)} ${r.title}`);

// The terms of use are on the front page; print the one requirement every time.
try {
  const home = await get(SITE);
  const rule = /スタッフクレジット等に[\s\S]{0,400}?ご報告・許可は不要/.exec(home);
  console.log('\n利用規約（要点）:');
  console.log('  ' + (rule ? rule[0].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    : 'スタッフクレジット等に「龍的交響楽」の表記、または URL（http://d-symphony.com/）へのリンクをお願いいたします。'));
} catch { /* 拿不到首页也不影响列曲 */ }
