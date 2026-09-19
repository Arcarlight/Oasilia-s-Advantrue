// 通用 DOM 小工具

/** 建 DOM：el('div', {class:'x', text:'hi'}, [child1, child2]) */
export function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else if (k === 'style' && typeof v === 'object') {
      // 注意：CSS 自定义属性（--sky-1 之类）不能用 node.style.xxx 赋值、也不吃 Object.assign，
      // 只能 setProperty。以前这里就是 Object.assign(node.style, v)，于是所有 --xxx 被静默丢掉，
      // 战斗界面永远用 CSS 里的沙漠兜底色——新加的地图在战斗里看不出任何区别。
      for (const [sk, sv] of Object.entries(v)) {
        if (sk.startsWith('--')) node.style.setProperty(sk, sv);
        else node.style[sk] = sv;
      }
    }
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else node.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of [].concat(children)) {
    if (c == null || c === false) continue;
    node.append(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return node;
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function clear(node) {
  /**
   * 顺手把里面的行走图动画停掉。
   *
   * 精灵动画是靠 setInterval 一帧帧画的，**元素从 DOM 上摘掉不会停掉那个定时器** ——
   * 以前每次切屏都会把屏幕上的动画留在后台接着跑（标题页的沙漠蜻蜓、战斗里的立绘…），
   * 一局下来能积十几个。这种泄漏眼睛看不出来，所以统一在这里收口：
   * 凡是经过 clear() 被换掉的界面，里面的动画一定跟着停。
   * （数量可以用 sprites.js 的 liveAnimCount() 量出来，见 tools/diag-encounter.js。）
   */
  for (const c of node.querySelectorAll?.('canvas.anim') ?? []) c.destroy?.();
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 在屏幕坐标飘一个字（伤害数字等） */
export function floatText(x, y, text, cls = 'float-dmg') {
  const layer = document.getElementById('float-layer');
  const n = el('div', { class: `float-text ${cls}`, text });
  n.style.left = `${x}px`;
  n.style.top = `${y}px`;
  layer.append(n);
  setTimeout(() => n.remove(), 1100);
}

/** 在某个元素上方飘字 */
export function floatAt(target, text, cls = 'float-dmg', offsetY = 0) {
  const r = target.getBoundingClientRect();
  floatText(r.left + r.width / 2, r.top + r.height * 0.25 + offsetY, text, cls);
}

let toastTimer = null;
export function toast(text, tone = '') {
  const node = document.getElementById('toast');
  node.textContent = text;
  node.className = `toast ${tone}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => node.classList.add('hidden'), 2200);
}

/** 弹窗 */
export function modal({ title, body, foot, wide = false, onClose }) {
  const root = document.getElementById('modal-root');
  const backdrop = el('div', { class: 'modal-backdrop' }, []);
  const box = el('div', { class: 'modal panel', style: wide ? { width: 'min(1100px, 97vw)' } : {} }, [
    el('div', { class: 'modal-head' }, [
      el('h3', { text: title ?? '' }),
      el('button', { class: 'btn btn-ghost btn-sm', onClick: () => close() }, ['关闭']),
    ]),
    el('div', { class: 'modal-body' }, [body]),
    foot ? el('div', { class: 'modal-foot' }, [].concat(foot)) : null,
  ]);
  backdrop.append(box);
  backdrop.addEventListener('mousedown', (e) => { if (e.target === backdrop) close(); });
  root.append(backdrop);

  function close() {
    backdrop.remove();
    document.removeEventListener('keydown', onKey);
    onClose?.();
  }
  // 弹窗可以叠着开（卡组页 → 卡牌详情），Esc 只关最上面那一层：
  // 以前每层都各绑一个 keydown，按一下 Esc 会把底下的卡组页一起关掉。
  function onKey(e) {
    if (e.key !== 'Escape') return;
    if (backdrop !== root.lastElementChild) return;
    close();
  }
  document.addEventListener('keydown', onKey);
  return { close, box, backdrop };
}

/** 把数组按行打散成 SVG 路径用的点（地图连线用） */
export function nodeCenter(node, width, height) {
  const padX = 0.1;
  return {
    x: (padX + node.x * (1 - padX * 2)) * width,
    y: node.y * height,
  };
}

/** 简单确定性噪声：让沙尘粒子每次位置一致 */
export function seeded(n) {
  const x = Math.sin(n * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}
