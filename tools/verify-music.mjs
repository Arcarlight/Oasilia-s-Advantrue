// 验证 BGM 播放链路：走的是 WebAudio 的 AudioBuffer 无缝循环，还是退回了 <audio> 元素。
// 用法: node tools/verify-music.mjs   （需要 tools/serve.mjs 在 5123 端口跑着）
import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '..');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const TEST = path.join(ROOT, 'music-test.html');
const PORT = process.env.PORT || 5123;

await fs.writeFile(TEST, `<!DOCTYPE html>
<html><body><div id="stage"></div>
<script type="module">
import { audio } from '/src/core/audio.js';
import { music } from '/src/core/bgm.js';
const log = (...a) => console.log('[mt]', ...a);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (name, ok, info = '') => { results.push({ name, ok, info }); log((ok ? 'PASS ' : 'FAIL ') + name + (info ? ' | ' + info : '')); };
const until = async (fn, ms = 10000) => {
  const t0 = performance.now();
  while (performance.now() - t0 < ms) { if (fn()) return true; await wait(60); }
  return false;
};

try {
  music.debug = true;
  audio.enabled = true;
  audio.setMusicVolume(0.5);
  audio.unlock();
  await wait(400);

  check('AudioContext 已 running', audio.ctx && audio.ctx.state === 'running', 'state=' + (audio.ctx ? audio.ctx.state : 'none'));
  check('music 接进了 WebAudio', music.status().backend === 'webaudio', JSON.stringify(music.status().backend));

  audio.playBgm('title', { restart: true });
  const got = await until(() => music._live.has('title'));
  check('title 解码并开播', got, 'status=' + JSON.stringify(music.status()));

  const live = music._live.get('title');
  check('BufferSource loop=true（无缝循环）', !!live && live.src.loop === true);
  check('循环段末尾正好落在文件末尾（说明采样率换算对了）',
    !!live && live.src.buffer && Math.abs(live.src.loopEnd - live.src.buffer.duration) < 0.6 && live.src.loopStart > 1,
    live && live.src.buffer
      ? ('loopStart=' + live.src.loopStart.toFixed(2) + 's loopEnd=' + live.src.loopEnd.toFixed(2) + 's 文件时长=' + live.src.buffer.duration.toFixed(2) + 's 缓冲采样率=' + live.src.buffer.sampleRate)
      : '');
  check('读到了循环点元数据', !!music._loopMeta && music._loopMeta.size > 0,
    'meta=' + JSON.stringify([...music._loopMeta.entries()].slice(0, 2)));
  check('同一时刻只有 1 个音源', music.status().sources === 1, 'sources=' + music.status().sources);
  check('走的是 ogg 素材', /\.ogg$/.test(music.status().file || ''), music.status().file);

  // 淡入：GainNode 应该从 0 平滑推到 music.volume(0.5)
  const g0 = live.gain.gain.value;
  await wait(1200);
  const g1 = live.gain.gain.value;
  check('淡入把音量推到设定值', Math.abs(g1 - 0.5) < 0.02, 'gain ' + g0.toFixed(3) + ' -> ' + g1.toFixed(3));

  // 真的出声了：在总线上挂个分析器量 RMS
  const an = audio.ctx.createAnalyser();
  an.fftSize = 2048;
  audio.master.connect(an);
  await wait(400);
  const td = new Float32Array(an.fftSize);
  an.getFloatTimeDomainData(td);
  let sq = 0;
  for (const v of td) sq += v * v;
  const rms = Math.sqrt(sq / td.length);
  check('总线真的有信号（不是只有节点在）', rms > 0.001, 'rms=' + rms.toFixed(4));

  // 无缝循环的硬证据：离线渲染一个 loop=true 的直流缓冲，循环点必须没有空白帧
  const off = new OfflineAudioContext(1, 44100 * 0.5, 44100);
  const dc = off.createBuffer(1, 4410, 44100);
  dc.getChannelData(0).fill(0.5);
  const s2 = off.createBufferSource();
  s2.buffer = dc;
  s2.loop = true;
  s2.connect(off.destination);
  s2.start(0);
  const rendered = await off.startRendering();
  const rc = rendered.getChannelData(0);
  let minAbs = 1;
  for (let i = 0; i < rc.length; i++) minAbs = Math.min(minAbs, Math.abs(rc[i]));
  check('循环接缝处没有插入静音帧（离线渲染验证）', minAbs > 0.49, '接缝处最小振幅 ' + minAbs.toFixed(4) + '（1.0 = 完全没有空隙）');

  // 音乐音量改动要落到正在响的 GainNode 上
  audio.setMusicVolume(0.25);
  await wait(150);
  check('改音量实时生效', Math.abs(live.gain.gain.value - 0.25) < 0.02, 'gain=' + live.gain.gain.value.toFixed(3));
  audio.setMusicVolume(0.5);
  await wait(120);

  // 切歌：旧音源要被淡出停掉，只剩新的一个
  const oldSrc = live.src;
  let oldEnded = false;
  // 用 addEventListener：bgm.js 内部会写 src.onended 做清理，别互相覆盖
  oldSrc.addEventListener('ended', () => { oldEnded = true; });
  audio.playBgm('battle_forest');
  const got2 = await until(() => music._live.has('battle_forest'));
  await wait(1400);
  check('切歌后播放新曲', got2 && music.status().key === 'battle_forest', 'key=' + music.status().key);
  check('旧音源已经停掉', oldEnded, 'onended=' + oldEnded);
  check('切歌后仍然只有 1 个音源', music.status().sources === 1, 'sources=' + music.status().sources);

  // 同一首重放（restart）：换一个新的音源，不是叠一层
  const srcA = music._live.get('battle_forest').src;
  audio.playBgm('battle_forest', { restart: true });
  await until(() => music._live.has('battle_forest') && music._live.get('battle_forest').src !== srcA);
  await wait(300);
  const srcB = music._live.get('battle_forest').src;
  check('restart 换新音源而不是叠加', srcB !== srcA && music.status().sources === 1, 'sources=' + music.status().sources);

  // 帧内循环：等一个循环周期太久，这里只确认音源在跑（currentTime 前进、没有 ended）
  const t0 = audio.ctx.currentTime;
  await wait(700);
  check('音源持续推进', audio.ctx.currentTime - t0 > 0.4 && !music._live.get('battle_forest').src._ended, 'dt=' + (audio.ctx.currentTime - t0).toFixed(2));

  // <audio> 兜底通道仍然可用（没有 WebAudio / 解码失败时走它）
  const elOk = music._playElement('victory', { restart: true });
  await wait(300);
  const el = music._els.get('victory');
  check('兜底 <audio> 通道可用且挂了 loop', elOk && !!el && el.loop === true && !el.paused, el ? 'paused=' + el.paused + ' loop=' + el.loop : 'no el');
  el.pause();

  // 设置里的「声音开关」：关掉要真的停，打开要接着放（不能切个场景才有声音）
  music.setEnabled(false);
  await wait(150);
  check('关掉声音后音源停掉', music._live.size === 0 && music.nowPlaying() === null, 'live=' + music._live.size);
  music.setEnabled(true);
  const resumed = await until(() => music._live.has('battle_forest'));
  check('重新打开声音后接着放同一首', resumed && music.nowPlaying() === 'battle_forest', 'key=' + music.nowPlaying());

  music.stop(false);
  await wait(200);
  check('stop 清干净了音源', music._live.size === 0 && music.nowPlaying() === null, 'live=' + music._live.size);

  log('MT_RESULT ' + JSON.stringify(results.map((r) => (r.ok ? 'PASS' : 'FAIL') + ':' + r.name)));
  log('MT_DONE');
} catch (e) {
  log('FATAL ' + e.message + ' | ' + e.stack);
  log('MT_DONE');
}
</script></body></html>`, 'utf8');

// 注意：这里不能用 --virtual-time-budget —— 虚拟时间会把 setTimeout 瞬间跑完，
// 而音量淡入和 AudioContext.currentTime 走的是真实音频时钟，断言会全部失真。
// 改成「页面打印 MT_DONE 就杀掉浏览器」。
const args = [
  '--headless=new', '--disable-gpu', '--window-size=900,700',
  '--enable-logging=stderr', '--v=0',
  '--no-first-run', '--no-default-browser-check',
  '--autoplay-policy=no-user-gesture-required',
  '--user-data-dir=' + path.join(ROOT, 'tools', '.edge-mt'),
  `http://127.0.0.1:${PORT}/music-test.html`,
];
const child = spawn(EDGE, args, { stdio: ['ignore', 'pipe', 'pipe'] });
let out = '';
const hard = setTimeout(() => child.kill(), 120000);
child.stderr.on('data', (d) => {
  out += d.toString();
  if (/MT_DONE/.test(out)) setTimeout(() => child.kill(), 400);
});
await new Promise((r) => child.on('close', r));
clearTimeout(hard);

for (const l of out.split(/\r?\n/)) {
  if (/\[mt\]|\[music\]/.test(l)) console.log('  ' + l.replace(/^.*INFO:CONSOLE:\d+\]\s*/, '').slice(0, 300));
}

const res = /MT_RESULT (\[.*\])/.exec(out);
if (!res) {
  console.log('  (没有拿到结果，服务器在跑吗？)');
} else {
  const list = JSON.parse(res[1].replace(/\\"/g, '"'));
  const fail = list.filter((s) => s.startsWith('FAIL'));
  console.log('');
  console.log(`MUSIC_${fail.length ? 'FAIL' : 'OK'}  ${list.length - fail.length}/${list.length} 项通过`);
}
if (!/MT_DONE/.test(out)) console.log('  (测试没跑完)');

await fs.rm(TEST, { force: true });
await fs.rm(path.join(ROOT, 'tools', '.edge-mt'), { recursive: true, force: true });
