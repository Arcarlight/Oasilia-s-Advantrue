// 战斗界面改成两栏布局：左半边角色站位、右半边固定放日志，互不遮挡。
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '..');
const file = path.join(ROOT, 'src', 'ui', 'style.css');

let t = await fs.readFile(file, 'utf8');
const Q = String.fromCharCode(34); // 双引号

const reps = [
  [
`.battle-field {
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 2px;
  padding: 4px clamp(10px, 3vw, 40px) 0;
  /* 日志绝对定位在底部；角色区留一点下边距，等日志出现时不会盖住角色 */
  padding-bottom: 36px;
  overflow: hidden;
}`,
`.battle-field {
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
  /* 两栏布局：左半边放角色站位，右半边固定放战斗日志 —— 两者互不遮挡 */
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(230px, 0.95fr);
  grid-template-rows: minmax(0, 1fr) auto;
  grid-template-areas: ${Q}enemy log${Q} ${Q}player log${Q};
  column-gap: clamp(10px, 2vw, 26px);
  row-gap: 2px;
  padding: 6px clamp(10px, 3vw, 34px) 4px;
  overflow: hidden;
}`,
  ],
  [
`.fighter { position: relative; display: flex; align-items: flex-end; gap: 14px; flex: 0 0 auto; }`,
`.fighter { position: relative; display: flex; align-items: center; gap: 14px; min-width: 0; }
.fighter-enemy { grid-area: enemy; }
.fighter-player { grid-area: player; }`,
  ],
  [
`.battle-log {
  /* 贴在角色区底部（绝对定位），高度固定 —— 位置稳定、不会顶到底栏、也不会和角色重叠 */
  position: absolute;
  left: 0;
  right: 0;
  bottom: 4px;
  margin: 0 auto;
  /* 高度由内容决定（最多 5 行左右），不再固定占掉 148px */
  max-height: 132px;
  width: min(760px, 96%);`,
`.battle-log {
  /* 占右半边、贴底；高度由内容决定（最多约 5 行），空的时候自动隐藏 */
  grid-area: log;
  align-self: end;
  justify-self: stretch;
  max-height: 150px;
  width: 100%;`,
  ],
  [
`.battle-middle {
  display: flex; align-items: center; justify-content: space-between;
  gap: 12px; padding: 4px 0;
}`,
`.battle-middle {
  display: flex; align-items: center; justify-content: space-between;
  gap: 12px; padding: 4px 0;
  grid-column: 1;
}`,
  ],
];

let n = 0;
for (const [from, to] of reps) {
  if (t.includes(from)) { t = t.replace(from, to); n++; }
  else console.warn('未匹配:', from.split('\n')[0].slice(0, 46));
}
await fs.writeFile(file, t, 'utf8');
const o = (t.match(/\{/g) || []).length, c = (t.match(/\}/g) || []).length;
console.log(`style.css: ${n}/${reps.length} 处；大括号 ${o}/${c} ${o === c ? '平衡' : '不平衡!!'}`);
