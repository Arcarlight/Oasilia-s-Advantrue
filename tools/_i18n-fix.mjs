import fs from 'node:fs';
const ROOT = 'D:\\ToolsSoftware\\DSH_GameTsukuru\\';
const outPath = ROOT + 'tools/_i18n-out/lines-3.json';
const inPath = ROOT + 'tools/_i18n-in/lines-3.json';

const outRaw = fs.readFileSync(outPath, 'utf8');
const out = JSON.parse(outRaw);
const inZh = JSON.parse(fs.readFileSync(inPath, 'utf8')).map(o => o.zh);

const inSet = new Set(inZh);
const kept = {}, dropped = [];
// keep only keys present in the input, in input order (mirrors the input file order)
for (const k of inZh) {
  if (Object.prototype.hasOwnProperty.call(out, k)) kept[k] = out[k];
  else console.log('WARN: input key has no translation: ' + k);
}
for (const k of Object.keys(out)) if (!inSet.has(k)) dropped.push(k);

console.log('dropped(' + dropped.length + '):');
dropped.forEach(k => console.log('  - ' + k));

console.log('backup: ' + outPath.replace(/\.json$/, '.pre-audit.json'));
fs.writeFileSync(outPath.replace(/\.json$/, '.pre-audit.json'), outRaw, 'utf8');
fs.writeFileSync(outPath, JSON.stringify(kept, null, 2) + '\n', 'utf8');
console.log('written keys=' + Object.keys(kept).length);
