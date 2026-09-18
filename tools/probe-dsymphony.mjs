// 探查 d-symphony.com 的页面结构与下载入口。
// 用法: node tools/probe-dsymphony.mjs [url...]
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

const urls = process.argv.slice(2);
if (!urls.length) urls.push('https://d-symphony.com/');

for (const url of urls) {
  let r;
  try {
    r = await get(url);
  } catch (e) {
    console.log(`ERR ${url}: ${e.message}`);
    continue;
  }
  if (r.status !== 200) { console.log(`${url} -> HTTP ${r.status}`); continue; }
  const html = r.body.toString('utf8');
  console.log(`=== ${url}  (${html.length} 字节) ===`);
  const links = [...new Set([...html.matchAll(/href=["']([^"']+)["']/g)].map((m) => m[1]))];
  console.log('链接:');
  for (const l of links.slice(0, 40)) console.log('   ' + l);
  const text = html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  console.log('正文片段: ' + text.slice(0, 900));
  console.log('');
}
