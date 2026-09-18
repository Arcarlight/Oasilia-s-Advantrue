// 诊断：背包里的道具到底能不能用（?dgitems=1）
//
// 起因（玩家反馈）：「背包系统到现在都没有作用，道具都写着已生效，像好伤药那种完全没法用」。
// 根因是界面自己判断「能不能用」，写的是 `item.heal`，而药水的字段叫 `healPct` ——
// 七件道具全部落到「已生效」那一支，一个「使用」按钮都没有。
//
// 这里按真实指针把背包走一遍：
//   ① 有药水时，那一行必须有可点的「使用」按钮；
//   ② 点下去血真的回、数量真的减、有可见提示；
//   ③ 血满时按钮禁用并写明「HP 已满」；
//   ④ 数量为 0 的条目（开局自带 potion_big: 0）不该出现在背包里；
//   ⑤ 护符类拿到就生效，不该残留在背包里。
//
// 用法：node tools/diag2.mjs "http://127.0.0.1:5123/?dgitems=1" rt

(async () => {
  const log = (...a) => console.log('[d2] [it]', ...a);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const fails = [];
  const ok = (cond, label, detail = '') => {
    if (cond) log(`  ✓ ${label}${detail ? ` — ${detail}` : ''}`);
    else { fails.push(label); log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`); }
  };
  const hitAt = (x, y) => {
    const n = document.elementFromPoint(x, y);
    if (!n) return '(空)';
    return `${n.tagName.toLowerCase()}${typeof n.className === 'string' && n.className ? '.' + n.className.trim().split(/\s+/).join('.') : ''}`;
  };
  /** 真实指针序列（不是 element.click()：后者绕过命中测试） */
  const realClick = (node) => {
    node.scrollIntoView({ block: 'center', inline: 'nearest' });
    const r = node.getBoundingClientRect();
    const x = Math.round(r.left + r.width / 2);
    const y = Math.round(r.top + r.height / 2);
    const top = document.elementFromPoint(x, y);
    const hitSelf = !!top && (top === node || node.contains(top));
    const opts = { bubbles: true, cancelable: true, composed: true, clientX: x, clientY: y, button: 0, buttons: 1 };
    for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
      const ev = type.startsWith('pointer')
        ? new PointerEvent(type, { ...opts, pointerId: 1, pointerType: 'mouse', isPrimary: true })
        : new MouseEvent(type, opts);
      (top ?? node).dispatchEvent(ev);
    }
    return { x, y, hitSelf, top };
  };
  /** 背包里某一件道具所在的那一行 */
  const rowOf = (name) => [...document.querySelectorAll('.modal-backdrop .shop-item')]
    .find((row) => row.querySelector('h4')?.textContent.includes(name)) ?? null;

  try {
    const game = window.__oasis;
    const { showItems } = await import('../src/ui/overlays.js');

    game.newRun(20250101);
    // 等 boot 的标题页收场，免得它的异步收尾把界面盖住（diag-remove 里踩过这个坑）
    const t0 = Date.now();
    for (;;) {
      const screens = [...document.querySelectorAll('#stage > .screen')];
      if (screens.length === 1 && !screens[0].classList.contains('title-screen')) break;
      if (Date.now() - t0 > 6000) break;
      await wait(80);
    }
    game.phase = 'map';
    document.querySelector('.modal-backdrop')?.remove();

    // 开局自带 { potion_small: 2, potion_big: 0 }
    log(`  开局背包 = ${JSON.stringify(game.data.items)}`);
    showItems(game);
    await wait(300);

    // 截图模式：把背包留在屏幕上给 shot.mjs 拍
    if (new URLSearchParams(location.search).get('dgitems') === 'shot') {
      log('背包已打开（截图模式）');
      log('IT_DONE');
      return;
    }

    // ---- ④ ×0 的条目不该列出来 ----
    const rows = [...document.querySelectorAll('.modal-backdrop .shop-item')];
    const names = rows.map((r) => r.querySelector('h4')?.textContent?.trim() ?? '');
    log(`  背包列出 = [${names.join(' | ')}]`);
    ok(!names.some((n) => /厉害伤药/.test(n)), '×0 的「厉害伤药」没有列出来', names.join('、'));
    ok(names.some((n) => /好伤药/.test(n)), '好伤药 ×2 列出来了');

    // ---- ① 每一行都必须是「能点的使用按钮」，不能是「已生效」 ----
    const allRows = [...document.querySelectorAll('.modal-backdrop .shop-item')];
    const stuck = allRows.filter((r) => !r.querySelector('button'));
    const labels = allRows.map((r) => r.querySelector('button')?.textContent?.trim() ?? '(没有按钮)');
    ok(stuck.length === 0, '每一件列出来的道具都有可点的按钮（不再出现「已生效」的死行）',
      `按钮：${labels.join(' / ')}`);

    // ---- ② 真实指针点「使用」 ----
    game.data.hp = Math.max(1, Math.floor(game.data.maxHp * 0.4));
    document.querySelector('.modal-backdrop')?.remove();
    showItems(game);
    await wait(250);
    const row = rowOf('好伤药');
    const btn = row?.querySelector('button');
    ok(!!btn && !btn.disabled, '受伤时「好伤药」的使用按钮是可点的', btn ? `文案「${btn.textContent.trim()}」` : '（没有按钮）');
    if (btn) {
      const beforeHp = game.data.hp;
      const beforeN = game.data.items.potion_small;
      const c = realClick(btn);
      ok(c.hitSelf, '按钮中心没有被别的东西盖住（真实命中测试）', `命中 = ${hitAt(c.x, c.y)}`);
      await wait(350);
      log(`  点完：HP ${beforeHp} → ${game.data.hp}，好伤药 ${beforeN} → ${game.data.items.potion_small}`);
      ok(game.data.hp > beforeHp, '点一下真的回血了');
      ok(game.data.items.potion_small === beforeN - 1, '数量真的减了 1');
      const toastEl = document.getElementById('toast');
      ok(/使用/.test(toastEl?.textContent ?? '') && !toastEl.classList.contains('hidden'),
        '屏幕上有「使用…」的提示', `toast = 「${toastEl?.textContent ?? ''}」`);
      // 背包重画之后那一行还在（paint 之后不能整块消失）
      ok(!!rowOf('好伤药'), '用完一瓶之后这一行还在（数量变了而已）');
    }

    // ---- ③ 血满时禁用 ----
    document.querySelector('.modal-backdrop')?.remove();
    game.data.hp = game.data.maxHp;
    showItems(game);
    await wait(250);
    const btn2 = rowOf('好伤药')?.querySelector('button');
    ok(!!btn2 && btn2.disabled, 'HP 满时按钮禁用', btn2 ? `文案「${btn2.textContent.trim()}」` : '（没有按钮）');
    ok(btn2?.textContent?.includes('已满'), '并且写明是「HP 已满」而不是含糊地不给点');

    // ---- ⑤ 护符拿到就生效、不留背包 ----
    document.querySelector('.modal-backdrop')?.remove();
    const atkBefore = game.data.atk;
    const got = game.giveItem('charm_atk', 1);
    log(`  买一枚锐爪护符：攻击 ${atkBefore} → ${game.data.atk}，返回值 ${JSON.stringify(got)}`);
    ok(game.data.atk === atkBefore + 4, '锐爪护符拿到手攻击就 +4');
    showItems(game);
    await wait(250);
    const names2 = [...document.querySelectorAll('.modal-backdrop .shop-item h4')].map((h) => h.textContent.trim());
    ok(!names2.some((n) => /锐爪护符/.test(n)), '已生效的护符不会残留在背包里', names2.join('、'));
    ok([...document.querySelectorAll('.modal-backdrop .shop-item')].every((r) => r.querySelector('button')),
      '剩下的每一行仍然都能点');

    document.querySelector('.modal-backdrop')?.remove();
    if (fails.length) log(`IT_ERRORS=[${fails.join(' | ')}]`);
    else log('背包道具自检：通过 ✓');
    log('IT_DONE');
  } catch (e) {
    log('IT_FATAL ' + (e && e.stack ? e.stack.split('\n').slice(0, 5).join(' | ') : e));
    log('IT_DONE');
  }
})();
