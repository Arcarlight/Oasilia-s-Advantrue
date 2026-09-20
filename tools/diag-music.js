// 曲子库诊断（?dgmusic=1）：
//   node tools/diag2.mjs "http://127.0.0.1:5123/?dgmusic=1" rt
//   node tools/diag2.mjs "http://127.0.0.1:5123/?dgmusic=shot" rt        # 留屏截图
//
// 起因（用户要求）：「UI 里现在的选择试听音乐也没有更改。你可以在主界面加一个音乐室，
// 只显示听过的，其余的用 ？？？表示，并移除设置里的音乐试听。」
// 所以这里量四件事：
//   ① 标题页多了第 4 个入口，且带着「听过几首 / 共几首」的进度；
//   ② 一首都没听过时，每一行都是「？？？」（曲名与出处都不能漏出来），而且是**锁着**的；
//   ③ 在游戏里听到一首之后，那一行亮出来、能点（点下去真的切到那首曲子）；
//   ④ 设置里那个「切换 BGM（试听）」下拉框没了。
//
// 另外量一张账：10 张地图的图 / 战斗 / 强敌三首歌**两两不同**（以前 desert 借通用曲、
// 后四张图各自借 canyon/forest/cliff/night，进不同地图会听到同一首）。
(async () => {
  const log = (...a) => console.log('[d2] [music]', ...a);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const fails = [];
  const ok = (cond, label, detail = '') => {
    if (cond) log(`  ✓ ${label}${detail ? ` — ${detail}` : ''}`);
    else { fails.push(label); log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`); }
  };
  const q = (s, root) => (root ?? document)?.querySelector?.(s) ?? null;
  const qa = (s, root) => {
    const r = root ?? document;
    return r?.querySelectorAll ? [...r.querySelectorAll(s)] : [];
  };
  const click = (node) => { node?.dispatchEvent(new MouseEvent('click', { bubbles: true })); };
  const btnByText = (text, root = document) => qa('button', root).find((b) => b.textContent.includes(text));
  const topModal = () => qa('.modal-backdrop').pop() ?? null;
  const closeTop = () => click(q('.modal-head button', topModal()));

  try {
    const game = window.__oasis;
    const ui = window.__oasisUI;
    const { save } = await import('/src/core/save.js');
    const { audio } = await import('/src/core/audio.js');
    const { music, BGM_FILES, BGM_NAMES, BGM_ROOMS } = await import('/src/core/bgm.js');
    const { BIOMES } = await import('/src/data/balance.js');
    const params = new URLSearchParams(location.search);

    const META_KEY = 'oasis_desert_spirit_meta_v1';
    const KEYS = Object.keys(BGM_FILES);

    // 从「什么都没听过」的一台机器开始：这一页全靠跨局记录
    localStorage.removeItem(META_KEY);
    localStorage.removeItem('oasis_desert_spirit_save_v1');
    game.phase = 'title';
    ui.current = null;
    ui.forceRerender();
    await wait(500);

    // ---------- ① 标题页入口 ----------
    log('① 标题页入口');
    const entries = qa('.title-codex .title-codex-btn');
    ok(entries.length === 4, '标题页有 4 个入口（记录 / 卡牌 / 敌人 / 曲子库）', `实际 ${entries.length}`);
    const labels = entries.map((b) => q('.title-codex-label', b)?.textContent);
    ok(labels[3] === '曲子库', '第 4 个入口是「曲子库」', labels.join(' / '));
    ok(q('.title-codex-sub', entries[3])?.textContent === `0/${KEYS.length}`,
      '入口上带着进度（新档 0 首）', q('.title-codex-sub', entries[3])?.textContent);

    // 截图模式：把曲子库摆出来就收工（截图脚本用虚拟时间，跑不了下面那串 await）
    if (params.get('dgmusic') === 'shot') {
      // 先「听过」几首，否则截图里全是 ？？？，看不出这一页长什么样
      for (const k of ['title', 'map_desert', 'battle_desert', 'elite_night', 'boss_final']) save.noteBgm(k);
      ui.current = null;
      ui.forceRerender();
      await wait(400);
      click(qa('.title-codex .title-codex-btn')[3]);
      await wait(400);
      log(`（截图模式：曲子库，${qa('.mr-row').length} 行，其中锁着 ${qa('.mr-row.locked').length} 行）`);
      log('MUSIC_DONE');
      return;
    }

    // ---------- ② 一首都没听过：全是 ？？？ ----------
    log('② 没听过 = ？？？');
    click(entries[3]);
    await wait(300);
    let modal = topModal();
    ok(!!modal, '点「曲子库」会打开一页');
    ok(q('.modal-head h3', modal)?.textContent.includes('曲子库'), '标题是曲子库');

    const rows = qa('.mr-row', modal);
    ok(rows.length === KEYS.length, `把 ${KEYS.length} 首全排出来（锁着的也占位）`, `实际 ${rows.length} 行`);
    const locked = qa('.mr-row.locked', modal);
    ok(locked.length === KEYS.length, '一首都没听过时每一行都是锁着的', `${locked.length} / ${rows.length}`);
    // 锁着的行：**曲名与出处不能漏**（那是「这一首是什么」），但场景名要留着 ——
    // 场景是玩家自己走过的地方，全藏起来的话一屏全是 ？？？，看不出还有什么可收。
    const titleOf = (k) => (BGM_NAMES[k] ?? '').split(' · ').slice(1).join(' · ');
    const leaked = rows.filter((r) => {
      const cell = q('.mr-title', r)?.textContent ?? '';
      return KEYS.some((k) => { const n = titleOf(k); return n && n.length > 1 && cell.includes(n); });
    });
    ok(leaked.length === 0, '锁着的行里查不到任何曲名 / 上游原名', `漏出 ${leaked.length} 行`);
    ok(locked.every((r) => q('.mr-title', r)?.textContent === '？？？'), '锁着的行曲名写着 ？？？');
    ok(locked.every((r) => (q('.mr-scene', r)?.textContent ?? '').length > 0 && q('.mr-scene', r).textContent !== '？？？'),
      '锁着的行仍然写着场景（第一章 流沙之海 这种）', q('.mr-scene', locked[0])?.textContent);
    ok(qa('.mr-row.locked .mr-lock', modal).length === KEYS.length, '锁着的行右边写的是「还没听到」');
    // 锁定行不能有试听按钮（有按钮才可能被点到）
    ok(qa('.mr-row.locked button', modal).length === 0, '锁着的行上没有试听按钮');
    // 分组：地图 / 战斗 / 强敌这些组标题要在
    const groupTitles = qa('.mr-group-title', modal).map((n) => n.textContent);
    ok(groupTitles.length >= 5 && groupTitles.some((s) => s.includes('地图')), '按场景分了组', groupTitles.join(' / '));
    const credits = q('.mr-credits', modal)?.textContent ?? '';
    ok(credits.includes('音楽の卵') && credits.includes('龍的交響楽'), '写着两家素材站的出处');
    ok(credits.includes('ontama-m.com') && credits.includes('d-symphony.com'), '两家都给了链接（授权要求标注站名或链接）');
    closeTop();
    await wait(250);

    // ---------- ③ 听过一首之后 ----------
    log('③ 听过一首之后那一行亮出来');
    save.noteBgm('map_forest');
    ui.current = null;
    ui.forceRerender();
    await wait(400);
    click(qa('.title-codex .title-codex-btn')[3]);
    await wait(300);
    modal = topModal();
    const unlocked = qa('.mr-row:not(.locked)', modal);
    ok(unlocked.length === 1, '只有听过的那一首亮出来', `${unlocked.length} 行`);
    const rowText = unlocked[0]?.textContent ?? '';
    ok(rowText.includes(BGM_NAMES.map_forest.split(' · ')[1]), '亮出来的那行写着曲名（场景 · 上游原名）', rowText.trim().slice(0, 40));
    ok(!!btnByText('试听', unlocked[0]), '亮出来的那行有「试听」按钮');
    ok(q('.title-codex-sub', qa('.title-codex .title-codex-btn')[3])?.textContent === `1/${KEYS.length}`,
      '关掉之后标题页上的进度也变成 1', '(试听前)');

    // 点试听：真的切到那首曲子（music.current 就是播放中的 key）。
    // ⚠ 无头浏览器里 AudioContext 一直是 suspended、audio.unlock() 也没被人碰过
    // （真实玩家是「点一下屏幕」触发的），那样 playBgm() 只会把曲子排队、不放。
    // 这里显式解锁一次 —— 量的是「点下去有没有切歌」，不是「无头里能不能出声」。
    audio.unlock();
    if (audio.ctx?.state === 'suspended') { try { await audio.ctx.resume(); } catch { /* 忽略 */ } }
    await wait(300);
    const before = music.nowPlaying();
    click(btnByText('试听', unlocked[0]));
    await wait(900);
    ok(music.nowPlaying() === 'map_forest', '点「试听」会把曲子切到那一首',
      `${before ?? '(无)'} -> ${music.nowPlaying()}（AudioContext ${audio.ctx?.state ?? '无'}）`);
    ok(!!q('.mr-row.playing', topModal()), '正在试听的那一行有高亮');
    ok(!!btnByText('重放', topModal()), '再点一次变成「重放」');

    // 关掉音乐室：BGM 要还给当前场景（不然回到地图还在放试听的曲子）
    closeTop();
    await wait(600);
    ok(music.nowPlaying() === 'title', '关掉曲子库之后 BGM 回到当前场景（标题页 = title）',
      String(music.nowPlaying()));

    // 跨局记录里存的是 key 而不是曲名（切语言时曲名会改写）
    const heard = save.readMeta().heardBgm ?? [];
    ok(heard.includes('map_forest') && heard.every((k) => k in BGM_FILES),
      '记的是 BGM 的 key（不是曲名）', JSON.stringify(heard));

    // ---------- ④ 设置里没有试听下拉框了 ----------
    log('④ 设置里的试听下拉框已撤');
    click(btnByText('设置'));
    await wait(300);
    modal = topModal();
    ok(!!modal, '设置能打开');
    const selects = qa('.setting-row select', modal);
    const optText = selects.flatMap((s) => qa('option', s).map((o) => o.textContent)).join(' ');
    ok(!optText.includes('（map') && !optText.includes('（battle') && !optText.includes('（title'),
      '设置里再也没有列出 BGM 的试听下拉框', `${selects.length} 个下拉框（都是战斗速度这类）`);
    ok(qa('.setting-row', modal).some((r) => r.textContent.includes('曲子库')), '设置里改成一句「去曲子库听」的提示');
    closeTop();
    await wait(200);

    // ---------- ⑤ 十张地图三首歌两两不同 ----------
    log('⑤ 十张地图的曲子互不重复');
    const dup = [];
    for (const slot of ['map', 'battle', 'elite']) {
      const used = new Map();
      for (const b of Object.keys(BIOMES)) {
        const key = `${slot}_${b}`;
        if (!(key in BGM_FILES)) continue;
        const file = BGM_FILES[key];
        if (used.has(file)) dup.push(`${key} 与 ${used.get(file)} 用了同一个文件 ${file}`);
        else used.set(file, key);
      }
      log(`  ${slot}: ${used.size} 张地图各一首`);
    }
    ok(dup.length === 0, '地图 / 战斗 / 强敌三组里都不存在两张地图放同一首', dup.slice(0, 3).join('; ') || '无');
    // 兜底曲不该和任何地图专属曲撞车（撞了就等于那张地图在放兜底曲）
    const fallbacks = ['map', 'battle', 'elite'].filter((k) => {
      const users = Object.entries(BGM_FILES).filter(([kk, v]) => v === BGM_FILES[k] && kk !== k);
      return users.length > 0;
    });
    ok(fallbacks.length === 0, '通用兜底曲（map / battle / elite / boss）不再被任何地图顶掉或共用',
      fallbacks.join(', ') || '无');
    // 每首曲子都要有分组（漏一个就会在界面上凭空消失）
    const noRoom = KEYS.filter((k) => !BGM_ROOMS[k]);
    ok(noRoom.length === 0, '每一首曲子都登记了音乐室分组', noRoom.join(', ') || '无');

    if (fails.length) log(`MUSIC_ERRORS=[${fails.join(' | ')}]`);
    else log('曲子库自检：通过 ✓');
    log('MUSIC_DONE');
  } catch (e) {
    log('MUSIC_FATAL ' + (e && e.stack ? e.stack.split('\n').slice(0, 6).join(' | ') : e));
    log('MUSIC_DONE');
  }
})();
