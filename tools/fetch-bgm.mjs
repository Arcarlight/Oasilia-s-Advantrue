// Download the game's BGM into assets/audio/bgm.
//
// Two upstreams (content/bgm.json -> sources):
//   ontama     音楽の卵 (ontama-m.com). The track list names the *mp3*; the ogg
//              sits next to it either as <reading>.ogg or inside a zip named
//              after the reading, so the mp3 -> ogg-url mapping is scraped once
//              and cached in tools/bgm-ogg-map.json.
//   dsymphony  龍的交響楽 (d-symphony.com). The ogg url is derivable from the
//              file name (msc/DS-<n>o.ogg), no scraping needed.
//
// Both upstreams publish their files with LOOPSTART/LOOPLENGTH vorbis comments,
// so the loop span is read straight out of the file and recorded in the
// manifest; src/core/bgm.js turns that into a sample-exact WebAudio loop.
// Nothing is re-encoded or re-cut here — the stored ogg is the published file.
//
// Every key lands at assets/audio/bgm/<key>.ogg, which is what the generated
// BGM_FILES table in src/core/bgm.js expects.
//
// Usage:
//   node tools/fetch-bgm.mjs                  download what is missing
//   node tools/fetch-bgm.mjs --force          re-download everything
//   node tools/fetch-bgm.mjs --resolve        only refresh the scraped url map
//   node tools/fetch-bgm.mjs --check          download nothing, just report
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'assets', 'audio', 'bgm');
const MAP_PATH = path.join(ROOT, 'tools', 'bgm-ogg-map.json');
const CONF_PATH = path.join(ROOT, 'content', 'bgm.json');
const PROXY = process.env.HTTPS_PROXY || process.env.HTTP_PROXY || '';
/** ffmpeg decodes each track once so the loop comments can be validated */
const FFMPEG = process.env.FFMPEG || 'D:\\FormatFact\\FormatFactory\\ffmpeg.exe';

const args = new Set(process.argv.slice(2));
const FORCE = args.has('--force');
const RESOLVE = args.has('--resolve');
const CHECK = args.has('--check');

const ONTAMA_SITE = 'https://ontama-m.com/';
/** Category pages that list mp3 + ogg download pairs */
const ONTAMA_PAGES = [
  'ongaku_new.html',
  'ongaku_piano1.html', 'ongaku_piano2.html', 'ongaku_piano3.html',
  'ongaku_akarui.html', 'ongaku_kawaii.html', 'ongaku_uptempo.html',
  'ongaku_unique.html', 'ongaku_kurai.html', 'ongaku_soudai.html',
  'ongaku_orgel.html', 'ongaku_guitar.html', 'ongaku_others.html',
  'ongaku_rpg_theme.html', 'ongaku_rpg_prologue.html', 'ongaku_rpg_machi.html',
  'ongaku_rpg_renkin.html', 'ongaku_rpg_field.html', 'ongaku_rpg_dungeon.html',
  'ongaku_rpg_battle.html', 'ongaku_rpg_boss.html', 'ongaku_rpg_chara.html',
  'ongaku_rpg_others.html',
  'ongaku_c_piano.html', 'ongaku_c_orchestra.html', 'ongaku_c_orgel.html',
  'ongaku_c_others.html',
];

const log = (s) => console.log(s);

/**
 * fetch() that honours a configured proxy.
 *
 * There is no `undici` in this checkout (no node_modules at all) and no global
 * ProxyAgent, so the proxy is applied the way Node itself supports it: the
 * caller runs with NODE_USE_ENV_PROXY=1 and this function simply passes the
 * request through. Without a proxy configured it is a plain fetch.
 */
async function get(url, { binary = false } = {}) {
  if (PROXY && !process.env.NODE_USE_ENV_PROXY) {
    log('  ! HTTPS_PROXY is set but NODE_USE_ENV_PROXY=1 is missing — node fetch would go direct. Re-run with: $env:NODE_USE_ENV_PROXY=1');
  }
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return binary ? Buffer.from(await r.arrayBuffer()) : r.text();
}

// ---------------------------------------------------------------- ontama map
/** The site is Shift_JIS; only ASCII hrefs are read out of it */
async function scrapeOntama() {
  const map = {};
  for (const page of ONTAMA_PAGES) {
    let html;
    try {
      const bytes = await get(ONTAMA_SITE + page, { binary: true });
      html = new TextDecoder('shift_jis').decode(bytes);
    } catch (e) {
      log(`  scrape failed: ${page} (${e.message})`);
      continue;
    }
    let rows = 0;
    let found = 0;
    for (const row of html.match(/<tr>[\s\S]*?<\/tr>/g) ?? []) {
      rows++;
      const m = row.match(/href="([^"]*mp3_file\/[^"]+\.mp3)"/);
      const o = row.match(/href="([^"]*ogg_file\/[^"]+\.(?:ogg|zip))"/);
      if (!m || !o) continue;
      const mp3 = m[1].split('/').pop();
      if (!(mp3 in map)) found++;
      map[mp3] = o[1].replace(/^\.\//, '');
    }
    log(`  scraped ${page.padEnd(26)} rows=${String(rows).padEnd(4)} new=${String(found).padEnd(3)} map=${Object.keys(map).length}`);
  }
  return map;
}

// ------------------------------------------------------------------ download
/** pull the single .ogg entry out of a zip buffer */
async function oggFromZip(buf) {
  // Minimal zip walker: the archives contain one stored/deflated .ogg entry.
  // (Avoids a dependency; entry names are Shift_JIS Japanese titles, so we
  // never match on the name.)
  const { inflateRawSync } = await import('node:zlib');
  const EOCD = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (EOCD < 0) throw new Error('zip: no end-of-central-directory');
  const count = buf.readUInt16LE(EOCD + 10);
  const cdOff = buf.readUInt32LE(EOCD + 16);
  let p = cdOff;
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) break;
    const method = buf.readUInt16LE(p + 10);
    const size = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOff = buf.readUInt32LE(p + 42);
    const name = buf.subarray(p + 46, p + 46 + nameLen).toString('latin1');
    p += 46 + nameLen + extraLen + commentLen;
    if (!/\.ogg$/i.test(name)) continue;
    const lNameLen = buf.readUInt16LE(localOff + 26);
    const lExtraLen = buf.readUInt16LE(localOff + 28);
    const dataOff = localOff + 30 + lNameLen + lExtraLen;
    const data = buf.subarray(dataOff, dataOff + size);
    return method === 0 ? data : inflateRawSync(data);
  }
  throw new Error('zip: no .ogg entry');
}

async function downloadOgg(track, key, map) {
  if (track.source === 'dsymphony') {
    const conf = await readConf();
    return get(conf.dsBaseUrl + track.file, { binary: true });
  }
  const rel = map[track.file];
  if (!rel) throw new Error(`no ogg url known for ${track.file} (run --resolve)`);
  const buf = await get(ONTAMA_SITE + rel, { binary: true });
  return /\.zip$/i.test(rel) ? oggFromZip(buf) : buf;
}

async function readConf() {
  return JSON.parse(await fs.readFile(CONF_PATH, 'utf8'));
}

/**
 * Exact decoded length in seconds. Counts PCM samples rather than scraping
 * "Duration:" out of ffmpeg's stderr: the loop bookkeeping below compares this
 * against the loop comments, and ffmpeg's printed duration is rounded to 10ms.
 */
function measure(file, rate = 22050) {
  try {
    const pcm = execFileSync(FFMPEG, [
      '-v', 'error', '-i', file, '-ac', '1', '-ar', String(rate), '-f', 's16le', '-',
    ], { maxBuffer: 1 << 30, stdio: ['ignore', 'pipe', 'ignore'] });
    return pcm.length / 2 / rate;
  } catch {
    return null;
  }
}

/**
 * Read LOOPSTART / LOOPLENGTH out of the vorbis comment header.
 *
 * Both upstreams publish them and src/core/bgm.js relies on the span ending at
 * end-of-file (the opening plays once, then it jumps back to the loop head).
 * They are read straight out of the file — the ogg we store is byte-for-byte the
 * published one — but they are *validated* against the decoded length here and
 * dropped when they do not hold up: 音楽の卵 rewrites a file now and then and the
 * old comment can survive the swap (battle_storm.ogg ships a LOOPLENGTH that
 * claims 15 minutes of music in a 2-minute file). A bad pair is worse than none,
 * because a loop end past EOF makes the track end in the middle of the music.
 */
function readLoopComments(file, seconds, tol = 0.6) {
  const buf = fsSync.readFileSync(file);
  const head = buf.subarray(0, Math.min(buf.length, 65536)).toString('latin1');
  // The two comments are not necessarily adjacent nor in order: battle_storm.ogg
  // writes LOOPLENGTH *before* LOOPSTART (and only LOOPLENGTH's label is legible —
  // LOOPSTART's is a single 0x12 byte), so match them independently.
  const st = /LOOPSTART=(\d+)/.exec(head);
  const ln = /LOOPLENGTH=(\d+)/.exec(head);
  if (!st || !ln) return { present: false, start: null, length: null };
  const start = Number(st[1]);
  const length = Number(ln[1]);
  if (!(length > 0)) return { present: true, start: null, length: null };
  if (seconds == null) return { present: true, start, length };
  // Same rate resolution as the runtime: whichever rate lands the span end at EOF.
  const total = start + length;
  const rate = Math.abs(total / 44100 - seconds) <= Math.abs(total / 22050 - seconds) ? 44100 : 22050;
  const end = total / rate;
  if (!(end > start / rate) || Math.abs(end - seconds) > tol) {
    return { present: true, start: null, length: null, bad: true, claimedEnd: Number(end.toFixed(2)), seconds };
  }
  return { present: true, start, length };
}

// ---------------------------------------------------------------------- main
const conf = await readConf();
await fs.mkdir(OUT, { recursive: true });

let map = {};
try {
  map = JSON.parse(await fs.readFile(MAP_PATH, 'utf8'));
  log(`ogg url map: ${MAP_PATH} (${Object.keys(map).length} entries)`);
} catch { /* resolve below */ }

const unknown = Object.values(conf.tracks)
  .filter((t) => t.source !== 'dsymphony')
  .map((t) => t.file)
  .filter((f) => !(f in map));
if (RESOLVE || unknown.length) {
  if (unknown.length) log(`resolving ${unknown.length} unknown track(s): ${unknown.join(', ')}`);
  log('scraping ontama-m category pages ...');
  const fresh = await scrapeOntama();
  map = { ...map, ...fresh };
  const sorted = {};
  for (const k of Object.keys(map).sort()) sorted[k] = map[k];
  await fs.writeFile(MAP_PATH, JSON.stringify(sorted, null, 2) + '\n', 'utf8');
  log(`ogg url map saved: ${MAP_PATH} (${Object.keys(map).length} entries)`);
}
if (RESOLVE) { log('resolve only, done.'); process.exit(0); }

const tracks = {};
let added = 0;
let skipped = 0;
let failed = 0;
let total = 0;
let noLoop = 0;
let badLoop = 0;

for (const [key, track] of Object.entries(conf.tracks)) {
  const dst = path.join(OUT, `${key}.ogg`);
  let size = 0;
  let exists = false;
  try { size = (await fs.stat(dst)).size; exists = size > 20000; } catch { /* missing */ }

  if (exists && !FORCE) {
    skipped++;
  } else if (CHECK) {
    log(`  x ${key.padEnd(15)} missing (check mode)`);
    failed++;
  } else {
    let done = false;
    for (let attempt = 1; attempt <= 3 && !done; attempt++) {
      try {
        const buf = await downloadOgg(track, key, map);
        if (buf.length < 20000) throw new Error(`file too small (${buf.length} bytes)`);
        if (buf.subarray(0, 4).toString('ascii') !== 'OggS') {
          throw new Error(`not an ogg stream (header=${buf.subarray(0, 4).toString('ascii')})`);
        }
        await fs.writeFile(dst, buf);
        size = buf.length;
        log(`  + ${key.padEnd(15)} ${String(Math.round(size / 1024)).padStart(6)} KB  <- ${track.file}`);
        added++;
        done = true;
      } catch (e) {
        if (attempt === 3) {
          log(`  ! ${key.padEnd(15)} ${track.file}: ${e.message}`);
          failed++;
        } else {
          log(`    . ${key} attempt ${attempt} failed (${e.message}), retrying`);
        }
      }
    }
  }
  if (!size) continue;
  total += size;
  const seconds = measure(dst);
  const loop = readLoopComments(dst, seconds);
  if (loop.bad) {
    badLoop++;
    log(`  ~ ${key.padEnd(15)} loop comment claims ${loop.claimedEnd}s in a ${loop.seconds}s file — dropped (whole-file loop)`);
  } else if (!loop.present) {
    noLoop++;
  }
  tracks[key] = {
    file: `${key}.ogg`,
    source: track.source,
    upstream: track.file,
    name: track.name,
    desc: track.desc,
    room: track.room,
    bytes: size,
    seconds: seconds == null ? undefined : Number(seconds.toFixed(2)),
    loopComment: loop.present,
    // 44100 is the rate these comments are written in (src/core/bgm.js re-derives
    // the rate at playback time by checking which one makes the span end at EOF).
    ...(loop.start != null ? { loopStart: loop.start, loopLength: loop.length, loopRate: 44100 } : {}),
  };
}

// ------------------------------------------------------------------ manifest
const sources = {};
for (const [id, s] of Object.entries(conf.sources)) {
  sources[id] = { name: s.name, site: s.site, url: s.url, license: s.license, ...(s.note ? { note: s.note } : {}) };
}
const manifest = {
  sources,
  loopNote: 'Both upstreams publish LOOPSTART/LOOPLENGTH vorbis comments; loopStart/loopLength is the span src/core/bgm.js loops (the opening plays once, then it jumps back to the loop head, sample-exact via a WebAudio AudioBuffer loop). The pair is validated against the decoded length and dropped when it does not hold up (loopComment=true with no numbers means the comment was stale). No audio file is re-encoded or re-cut: every <key>.ogg is byte-for-byte the published file.',
  downloadedBy: 'tools/fetch-bgm.mjs',
  tracks,
};
await fs.writeFile(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 4) + '\n', 'utf8');

log('');
log(`done: new=${added} skip=${skipped} fail=${failed} total=${(total / 1024 / 1024).toFixed(1)} MB`);
log(`loops: comment ok=${Object.values(tracks).filter((t) => t.loopStart != null).length} · no comment=${noLoop} · stale dropped=${badLoop}`);
if (failed) process.exit(1);
