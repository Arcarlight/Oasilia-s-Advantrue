// 扫一遍 src/**/*.js：哪些「含中文的字符串字面量」**没有走 t()**。
//
// 这一类 bug 的后果是「界面永久停在中文，而多语言覆盖率还显示 100%」——
// 因为 tools/build-i18n.mjs 只收 `t('字面量')` 这一种写法，写在对象里的裸字符串
// （`{ map: '地图 · 一章一曲' }`）根本进不了待翻清单。
// 曲子库第一版就是这么漏的（用户截图指出「音乐库这些文本完全没有本地化」）。
//
// 用法：node tools/audit-ui-strings.mjs [--todo]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');
const CJK = /[\u3400-\u9fff\u3040-\u30ff]/;

const files = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.js')) files.push(p);
  }
})(SRC);

let hits = 0;
for (const f of files) {
  const rel = path.relative(ROOT, f).replace(/\\/g, '/');
  const lines = fs.readFileSync(f, 'utf8').split(/\r?\n/);
  lines.forEach((line, i) => {
    const code = line.replace(/\/\/.*$/, '');          // 去掉行尾注释
    if (!CJK.test(code)) return;
    if (/\bt\(/.test(code)) return;                    // 走了 t()
    if (/^\s*[*/]/.test(code)) return;                 // 注释块
    // 只报告「字符串字面量」里的中文（键名、正则、模板里的都不算）
    const m = /'[^']*[\u3400-\u9fff\u3040-\u30ff][^']*'|"[^"]*[\u3400-\u9fff\u3040-\u30ff][^"]*"/.exec(code);
    if (!m) return;
    hits++;
    console.log(`${rel}:${i + 1}  ${line.trim().slice(0, 100)}`);
  });
}
console.log(`\n共 ${hits} 处「含中文但没走 t()」的字符串字面量`);
