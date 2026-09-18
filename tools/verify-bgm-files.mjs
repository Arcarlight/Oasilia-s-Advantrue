// 逐个解码校验 BGM 文件，并分析「循环接缝」是否真的无缝。
//
//   node tools/verify-bgm-files.mjs            # 校验 content/bgm.json 里的全部曲目
//   node tools/verify-bgm-files.mjs title boss # 只校验指定的 key
//
// 除了「能不能解码 / 多长」，还会算三个接缝指标（对 ogg 和还留着的 mp3 各算一遍，
// 方便对照）：
//   head/tail 首尾的静音长度（ms）—— 编码器补的静音会让循环处出现一小段空白
//   seam/step 循环点上的采样跳变幅度，除以全曲平均相邻采样差
//             （真正无缝的素材这个比值很小，说明末采样接回首采样是连续的）
import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '..');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const TEST = path.join(ROOT, 'bgm-decode-test.html');
const PORT = process.env.PORT || 5123;

const conf = JSON.parse(await fs.readFile(path.join(ROOT, 'content', 'bgm.json'), 'utf8'));
const allKeys = Object.keys(conf.tracks);
const want = process.argv.slice(2).filter((a) => !a.startsWith('-'));
const keys = want.length ? want.filter((k) => allKeys.includes(k)) : allKeys;
if (!keys.length) {
  console.error('没有匹配的曲目 key');
  process.exit(1);
}

await fs.writeFile(TEST, `<!DOCTYPE html>
<html><body><script>
const KEYS = ${JSON.stringify(keys)};
const log = (...a) => console.log('[bd]', ...a);

const QUIET = 1e-3;   // -60 dBFS 以下当作静音

// 接缝分析：首尾的静音长度 + 循环点上的采样跳变
function seam(x, rate) {
  const n = x.length;
  const scan = Math.min(Math.floor(n * 0.02), rate * 3);   // 最多往头尾看 3 秒
  let head = 0;
  while (head < scan && Math.abs(x[head]) < QUIET) head++;
  let tail = 0;
  while (tail < scan && Math.abs(x[n - 1 - tail]) < QUIET) tail++;
  let sum = 0, cnt = 0;
  for (let i = 0; i + 1 < n; i += 7) { sum += Math.abs(x[i + 1] - x[i]); cnt++; }
  const step = cnt ? sum / cnt : 0;
  const jump = Math.abs(x[n - 1] - x[0]);
  const rmsAt = (from) => {
    const len = Math.min(Math.floor(rate * 0.1), n);
    let s = 0;
    for (let i = 0; i < len; i++) { const v = x[Math.min(n - 1, from + i)]; s += v * v; }
    return Math.sqrt(s / len);
  };
  return {
    headMs: +(head / rate * 1000).toFixed(1),
    tailMs: +(tail / rate * 1000).toFixed(1),
    rmsHead: +rmsAt(head).toFixed(4),          // 开头 100ms（跳过静音）的电平
    rmsTail: +rmsAt(Math.max(0, n - Math.floor(rate * 0.1))).toFixed(4),
    lastAbs: +Math.abs(x[n - 1]).toFixed(4),
    ratio: step > 0 ? +(jump / step).toFixed(2) : 0,
  };
}

(async () => {
  const AC = window.AudioContext || window.webkitAudioContext;
  const ctx = new AC();
  for (const key of KEYS) {
    const line = { key };
    for (const ext of ['ogg', 'mp3']) {
      const url = 'assets/audio/bgm/' + key + '.' + ext;
      try {
        const res = await fetch(url);
        if (!res.ok) { line[ext] = null; continue; }
        const ab = await res.arrayBuffer();
        const kb = Math.round(ab.byteLength / 1024);   // decodeAudioData 会把 ab 摘走，先量
        const buf = await ctx.decodeAudioData(ab);
        const s = seam(buf.getChannelData(0), buf.sampleRate);
        line[ext] = { sec: +buf.duration.toFixed(1), kb, ch: buf.numberOfChannels, hz: buf.sampleRate, ...s };
      } catch (e) {
        line[ext] = { error: String(e.message || e).slice(0, 60) };
      }
    }
    log(JSON.stringify(line));
  }
  log('BD_DONE');
})();
</script></body></html>`, 'utf8');

const args = [
  '--headless=new', '--disable-gpu', '--window-size=800,600',
  '--enable-logging=stderr', '--v=0',
  '--no-first-run', '--no-default-browser-check',
  '--autoplay-policy=no-user-gesture-required',
  '--user-data-dir=' + path.join(ROOT, 'tools', '.edge-bd'),
  `http://127.0.0.1:${PORT}/bgm-decode-test.html`,
];
const child = spawn(EDGE, args, { stdio: ['ignore', 'pipe', 'pipe'] });
let out = '';
const hard = setTimeout(() => child.kill(), 240000);
child.stderr.on('data', (d) => {
  out += d.toString();
  if (/BD_DONE/.test(out)) setTimeout(() => child.kill(), 400);
});
await new Promise((r) => child.on('close', r));
clearTimeout(hard);

const pad = (s, n) => String(s).padEnd(n);
console.log(pad('key', 15) + pad('格式', 6) + pad('时长', 8) + pad('大小', 9) + pad('头静音', 9) + pad('尾静音', 9) +
  pad('开头电平', 10) + pad('结尾电平', 10) + '接缝跳变');
let bad = 0, seamOk = 0, seamTotal = 0;
const agg = { ogg: { head: 0, tail: 0, sec: 0, kb: 0 }, mp3: { head: 0, tail: 0, sec: 0, kb: 0 } };
for (const l of out.split(/\r?\n/)) {
  const m = /\[bd\] (\{.*\})/.exec(l);
  if (!m) continue;
  const o = JSON.parse(m[1]);
  for (const ext of ['ogg', 'mp3']) {
    const d = o[ext];
    if (!d) continue;
    if (d.error) { console.log(pad(o.key, 15) + pad(ext, 6) + '解码失败: ' + d.error); bad++; continue; }
    console.log(
      pad(o.key, 15) + pad(ext, 6) + pad(d.sec + 's', 8) + pad(d.kb + 'KB', 9) +
      pad(d.headMs + 'ms', 9) + pad(d.tailMs + 'ms', 9) +
      pad(d.rmsHead, 10) + pad(d.rmsTail, 10) + d.ratio
    );
    const a = agg[ext];
    a.head += d.headMs; a.tail += d.tailMs; a.sec += d.sec; a.kb += d.kb;
    if (ext === 'ogg') {
      seamTotal++;
      // 判定：① 接缝处采样跳变小（说明末采样接回首采样是连续的）
      //       ② 首尾两侧都没有超过 250ms 的静音（循环素材不该有一端空着）
      if (d.ratio < 3 && d.headMs < 250 && d.tailMs < 250) seamOk++;
      else { bad++; console.log(pad('', 15) + '  ^ 不合格：ratio=' + d.ratio + ' head=' + d.headMs + 'ms tail=' + d.tailMs + 'ms'); }
    }
  }
}
const n = seamTotal || 1;
console.log('');
for (const ext of ['ogg', 'mp3']) {
  const a = agg[ext];
  const k = ext === 'ogg' ? seamTotal : seamTotal;
  console.log(`${ext}：平均时长 ${(a.sec / k).toFixed(1)}s · 总体积 ${(a.kb / 1024).toFixed(1)}MB · ` +
    `平均头部静音 ${(a.head / k).toFixed(1)}ms · 平均尾部静音 ${(a.tail / k).toFixed(1)}ms`);
}
console.log('');
console.log(`ogg 无缝检查：${seamOk}/${seamTotal} 通过（接缝跳变 < 3 倍平均步长，且首尾静音都 < 250ms）`);
console.log(bad === 0 ? 'BGM_OK' : `BGM_PROBLEM（${bad} 项）`);
if (!/BD_DONE/.test(out)) console.log('(没有跑完，检查 http://127.0.0.1:' + PORT + ' 上的服务器是否在跑)');

await fs.rm(TEST, { force: true });
await fs.rm(path.join(ROOT, 'tools', '.edge-bd'), { recursive: true, force: true });
