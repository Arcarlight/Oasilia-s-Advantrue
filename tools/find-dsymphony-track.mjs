// 从 d-symphony 的素材页里找出 Freezing Edge 的确切文件链接，并抓取授权条款。
// 用法: node tools/find-dsymphony-track.mjs
import https from 'node:https';

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'user-agent': 'Mozilla/5.0 (compatible; asset-check)' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        resolve(get(new URL(res.headers.location, url).href));
        return;
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks) }));
    }).on('error', reject);
  });
}

const r = await get('https://d-symphony.com/mt_00.html');
const html = r.body.toString('utf8');

// 找到含 Freezing Edge 的那一行，把周围的链接都抽出来
const idx = html.indexOf('Freezing Edge');
if (idx < 0) { console.log('没找到 Freezing Edge'); process.exit(1); }
const start = Math.max(0, html.lastIndexOf('<tr', idx));
const end = html.indexOf('</tr>', idx);
const row = html.slice(start, end > 0 ? end : idx + 2000);
console.log('=== 含 Freezing Edge 的表格行（去标签）===');
const clean = row.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
console.log(clean.slice(0, 400));
console.log('\n=== 这一行里的链接 ===');
const rowLinks = [...row.matchAll(/href=["']([^"']+)["']/g)].map((m) => m[1]);
for (const l of rowLinks) console.log('   ' + l);

console.log('\n=== 授权 / 规约相关文字 ===');
const allLinks = [...new Set([...html.matchAll(/href=["']([^"']+)["']/g)].map((m) => m[1]))];
const ruleLinks = allLinks.filter((l) => /kiyaku|rule|license|about|policy|riyou/i.test(l));
console.log('规约类链接: ' + (ruleLinks.join(', ') || '（本页没有）'));
console.log('其他页面链接: ' + allLinks.filter((l) => /\.html$/i.test(l)).slice(0, 20).join(', '));

const text = html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
for (const kw of ['利用規約', '規約', 'フリー', '著作', 'クレジット', '商用']) {
  const i = text.indexOf(kw);
  if (i >= 0) console.log(`\n【${kw}】` + text.slice(i, i + 320));
}
