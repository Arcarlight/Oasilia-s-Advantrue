// 本地静态服务器：这个游戏用 ES module + fetch + <audio>，必须走 http 协议
// （直接双击 index.html 会被浏览器拦掉模块和音频，双击 oasis-game.html 则可以但没有声音）。
//
// 用法：
//   node tools/serve.mjs             # 默认 5123（占用时自动换一个空闲端口）
//   node tools/serve.mjs 6000        # 指定端口
//   node tools/serve.mjs --no-open   # 不要自动打开浏览器
//
// 关键点：所有路径都以**脚本所在目录**为基准算，所以在哪个目录下敲这条命令都行
// （以前有人在家目录里执行 `node tools/serve.mjs` 会报 MODULE_NOT_FOUND，
//  那是 shell 的工作目录不对，不是脚本的问题——所以干脆做了一键启动脚本 start.cmd）。
import http from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '..');
const args = process.argv.slice(2);
const NO_OPEN = args.includes('--no-open') || process.env.OASIS_NO_OPEN === '1';
const portArg = args.find((a) => /^\d+$/.test(a));
let PORT = Number(portArg ?? process.env.PORT ?? 5123);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  // 标签页图标（assets/img/flygon_ico.ico）：不写这条会被当成 application/octet-stream，
  // 有的浏览器就干脆不显示图标了
  '.ico': 'image/x-icon',
  '.ogg': 'audio/ogg',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.woff2': 'font/woff2',
  '.otf': 'font/otf',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
};

// 先自检一下素材在不在，缺了就直说（比打开页面看到空白强）
const need = ['index.html', 'src/main.js', 'assets/data/sprites.json', 'assets/audio/bgm'];
const missing = [];
for (const rel of need) {
  const ok = await fs.stat(path.join(ROOT, rel)).catch(() => null);
  if (!ok) missing.push(rel);
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    let rel = decodeURIComponent(url.pathname);
    if (rel === '/' || rel === '') rel = '/index.html';
    const target = path.join(ROOT, rel);
    if (!target.startsWith(ROOT)) {
      res.writeHead(403).end('forbidden');
      return;
    }
    const stat = await fs.stat(target).catch(() => null);
    if (!stat || stat.isDirectory()) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('404 not found: ' + rel);
      return;
    }
    const ext = path.extname(target).toLowerCase();
    const type = MIME[ext] ?? 'application/octet-stream';
    const data = await fs.readFile(target);
    res.writeHead(200, {
      'content-type': type,
      'cache-control': 'no-cache',
      'content-length': data.length,
    });
    res.end(data);
  } catch (err) {
    res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' }).end('500 ' + err.message);
  }
});

/** 端口被占用时自动往后找，不要直接崩掉 */
function listen(port, triesLeft = 10) {
  return new Promise((resolve, reject) => {
    const onError = (err) => {
      if (err.code === 'EADDRINUSE' && triesLeft > 0) {
        console.log(`  端口 ${port} 被占用了，换 ${port + 1} 试试…`);
        server.removeListener('listening', onListening);
        resolve(listen(port + 1, triesLeft - 1));
        return;
      }
      reject(err);
    };
    const onListening = () => {
      server.removeListener('error', onError);
      resolve(port);
    };
    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(port, '127.0.0.1');
  });
}

function openBrowser(url) {
  if (NO_OPEN) return;
  try {
    if (process.platform === 'win32') spawn('cmd', ['/c', 'start', '', url], { detached: true, stdio: 'ignore' }).unref();
    else if (process.platform === 'darwin') spawn('open', [url], { detached: true, stdio: 'ignore' }).unref();
    else spawn('xdg-open', [url], { detached: true, stdio: 'ignore' }).unref();
  } catch { /* 打不开就算了，URL 已经打印出来了 */ }
}

try {
  PORT = await listen(PORT);
} catch (err) {
  console.error('\n启动失败：', err.message);
  console.error('（如果端口都被占用，可以换成 node tools/serve.mjs 7000）\n');
  process.exit(1);
}

const url = `http://127.0.0.1:${PORT}/`;
console.log('');
console.log('  ╭──────────────────────────────────────────────╮');
console.log('  │  Oasis · 沙漠蜻蜓卡牌 roguelike  ·  本地服务器  │');
console.log('  ╰──────────────────────────────────────────────╯');
console.log(`  游戏地址:  ${url}`);
console.log('  （这个命令行窗口要一直开着；按 Ctrl+C 关闭服务器）');
if (missing.length) {
  console.log('');
  console.log('  ⚠ 缺少这些文件，页面可能打不开或不完整：');
  for (const m of missing) console.log('    - ' + m);
  console.log('  （素材可以用 & tools/fetch-content.ps1 重新下载）');
}
console.log('');
openBrowser(url);

process.on('SIGINT', () => {
  console.log('\n服务器已关闭。');
  process.exit(0);
});
