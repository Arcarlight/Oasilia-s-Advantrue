// 检查 file:// 下能不能加载本地音频（决定打包版是内联音频还是降级静音）。
import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '..');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const TEST = path.join(ROOT, 'tools', 'audio-probe.html');

await fs.writeFile(TEST, `<!DOCTYPE html><html><body><script>
(async () => {
  const log = (...a) => console.log('[probe]', ...a);
  const results = {};

  // 1) fetch 本地 ogg
  try {
    const r = await fetch('assets/audio/sfx/ui_click.ogg');
    results.fetchSfx = r.ok ? 'ok(' + r.status + ')' : 'fail(' + r.status + ')';
  } catch (e) { results.fetchSfx = 'throw:' + e.message.slice(0, 60); }

  // 2) fetch 本地 BGM ogg（WebAudio 通道要靠这个拿 arrayBuffer）
  try {
    const r = await fetch('assets/audio/bgm/title.ogg');
    results.fetchBgm = r.ok ? 'ok(' + r.status + ')' : 'fail(' + r.status + ')';
  } catch (e) { results.fetchBgm = 'throw:' + e.message.slice(0, 60); }

  // 3) Audio 元素加载 ogg（不受 CORS 限制的方式）
  results.audioElOgg = await new Promise((res) => {
    const a = new Audio('assets/audio/sfx/ui_click.ogg');
    a.oncanplaythrough = () => res('ok');
    a.onloadeddata = () => res('ok(loadeddata)');
    a.onerror = () => res('error');
    setTimeout(() => res('timeout'), 4000);
    a.load();
  });

  // 4) Audio 元素加载 BGM ogg（没有 WebAudio 时的兜底通道）
  results.audioElBgm = await new Promise((res) => {
    const a = new Audio('assets/audio/bgm/title.ogg');
    a.onloadeddata = () => res('ok(loadeddata)');
    a.oncanplaythrough = () => res('ok');
    a.onerror = () => res('error');
    setTimeout(() => res('timeout'), 6000);
    a.load();
  });

  // 5) XHR 本地 BGM ogg
  try {
    const buf = await new Promise((res, rej) => {
      const x = new XMLHttpRequest();
      x.open('GET', 'assets/audio/bgm/title.ogg');
      x.responseType = 'arraybuffer';
      x.onload = () => (x.status === 200 || x.status === 0 ? res(x.response) : rej(new Error('status ' + x.status)));
      x.onerror = () => rej(new Error('xhr error'));
      x.send();
    });
    results.xhrBgm = buf && buf.byteLength > 1000 ? 'ok(' + buf.byteLength + ')' : 'tiny';
  } catch (e) { results.xhrBgm = 'throw:' + e.message.slice(0, 60); }

  log(JSON.stringify(results));
  log('PROBE_DONE');
})();
</script></body></html>`, 'utf8');

const probeScript = path.join(ROOT, 'tools', 'smoke-script.js');
const saved = await fs.readFile(probeScript, 'utf8').catch(() => null);

const args = [
  '--headless=new', '--disable-gpu', '--window-size=800,600',
  '--virtual-time-budget=15000', '--enable-logging=stderr', '--v=0',
  '--no-first-run', '--no-default-browser-check',
  '--allow-file-access-from-files',
  '--autoplay-policy=no-user-gesture-required',
  '--user-data-dir=' + path.join(ROOT, 'tools', '.edge-probe'),
  'file:///' + TEST.replace(/\\/g, '/'),
];
const child = spawn(EDGE, args, { stdio: ['ignore', 'pipe', 'pipe'] });
let out = '';
child.stderr.on('data', (d) => { out += d.toString(); });
const code = await new Promise((r) => child.on('close', r));

for (const l of out.split(/\r?\n/)) {
  if (/\[probe\]/.test(l)) console.log('  ' + l.replace(/^.*INFO:CONSOLE:\d+\]\s*/, '').slice(0, 400));
}
if (!/PROBE_DONE/.test(out)) console.log('  (没有拿到结果)');

await fs.rm(TEST, { force: true });
await fs.rm(path.join(ROOT, 'tools', '.edge-probe'), { recursive: true, force: true });
if (saved != null) await fs.writeFile(probeScript, saved, 'utf8');
