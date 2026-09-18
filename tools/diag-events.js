// 诊断：把事件池里「每个事件的每个选项」都跑一遍，打印结果文案与状态变化。
// 用途：① 内容管线迁移后核对行为没变 ② 新写事件时快速自检
// 由 tools/diag2.mjs 通过 ?dgev=1 加载。
(async () => {
  const log = (...a) => console.log('[d2]', ...a);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const snap = (g) => ({
    hp: g.data.hp, maxHp: g.data.maxHp, gold: g.data.gold,
    atk: g.data.atk, def: g.data.def, agi: g.data.agi, luck: g.data.luck,
    deck: g.data.deck.slice(), items: JSON.stringify(g.data.items),
  });
  const delta = (a, b) => {
    const parts = [];
    for (const k of ['hp', 'maxHp', 'gold', 'atk', 'def', 'agi', 'luck']) {
      const d = b[k] - a[k];
      if (d) parts.push(`${k}${d > 0 ? '+' : ''}${d}`);
    }
    const added = b.deck.filter((id, i) => b.deck.indexOf(id) === i && !a.deck.includes(id));
    const removed = a.deck.filter((id, i) => a.deck.indexOf(id) === i && !b.deck.includes(id));
    if (added.length) parts.push('card+' + added.join('/'));
    if (removed.length) parts.push('card-' + removed.join('/'));
    if (a.items !== b.items) parts.push(`items ${a.items}→${b.items}`);
    return parts.join(' ') || '(无变化)';
  };

  try {
    const game = window.__oasis;
    const mod = await import('../src/data/events.js');
    const EVENTS = mod.EVENTS;
    const errors = [];
    log(`事件池共 ${EVENTS.length} 个`);
    for (const ev of EVENTS) {
      for (const opt of ev.options) {
        // 每个选项跑 4 次（带随机分支的事件能看到多种结果），用不同种子
        const outs = [];
        for (let t = 0; t < 4; t++) {
          game.newRun(1000 + t * 7);
          game.data.hp = Math.max(60, Math.round(game.data.maxHp * 0.8));
          game.data.gold = 40;
          const before = snap(game);
          let res;
          try {
            res = opt.run(game);
          } catch (e) {
            errors.push(`${ev.id}/${opt.label}: ${e.message}`);
            continue;
          }
          if (!res || typeof res.text !== 'string') {
            errors.push(`${ev.id}/${opt.label}: run() 没返回 {text}`);
            continue;
          }
          if (/\{\w+\}/.test(res.text)) errors.push(`${ev.id}/${opt.label}: 文案里有没替换的变量 → ${res.text}`);
          outs.push(`[${res.tone}] ${res.text.replace(/\n/g, ' ⏎ ')} ⟨${delta(before, snap(game))}⟩`);
        }
        const uniq = [...new Set(outs)];
        log(`· ${ev.id}（${ev.name}${ev.biome ? ' · ' + ev.biome : ' · 通用'}）/${opt.label}`);
        for (const o of uniq) log('    ' + o);
      }
    }
    await wait(10);
    log('事件诊断：' + (errors.length ? '发现 ' + errors.length + ' 个问题' : '没有发现问题'));
    for (const e of errors) log('  ✗ ' + e);
    log('EV_DONE');
  } catch (e) {
    log('FATAL ' + e.message + ' | ' + e.stack);
    log('EV_DONE');
  }
})();
