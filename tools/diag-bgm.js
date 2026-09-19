// 诊断：按地图切 BGM 到底有没有生效（?dgbgm=1）
//
// 起因（用户反馈）：「每个地图强敌都是一个 bgm 太重复了」。
// 地图曲、战斗曲早就是按地图分的，只有强敌曲是全场一首 `elite` ——
// 现在每一章都有 `elite_<biome>`，这份诊断逐章开局核对。
//
// 由 tools/diag2.mjs 通过 ?dgbgm=1 加载。
(async () => {
  const log = (...a) => console.log('[d2]', ...a);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const fails = [];
  const ok = (cond, label, detail = '') => {
    if (cond) log(`  ✓ ${label}${detail ? ` — ${detail}` : ''}`);
    else { fails.push(label); log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`); }
  };
  // 解码是异步的：等一下再读状态，否则会看到「还在解码」的中间态
  const until = async (fn, ms = 8000) => {
    const t0 = performance.now();
    while (performance.now() - t0 < ms) { if (fn()) return true; await wait(80); }
    return false;
  };
  try {
    const game = window.__oasis;
    const ui = window.__oasisUI;
    const { audio } = await import('../src/core/audio.js');
    const bgm = await import('../src/core/bgm.js');
    const { STAGE_BIOME } = await import('../src/data/balance.js');
    const { generateMap } = await import('../src/data/mapgen.js');
    const music = bgm.music;
    music.debug = true;
    audio.unlock();
    await wait(600);

    log('BGM_FILES 键（' + Object.keys(bgm.BGM_FILES).length + '）: ' + Object.keys(bgm.BGM_FILES).join(','));
    ok(!!bgm.BGM_FILES.elite, '通用强敌曲 elite 还在（作为兜底）', bgm.BGM_FILES.elite);
    for (const b of STAGE_BIOME) {
      ok(!!bgm.BGM_FILES[`elite_${b}`], `地图 ${b} 有专属强敌曲 elite_${b}`, bgm.BGM_FILES[`elite_${b}`] ?? '（缺）');
    }
    ok(bgm.bgmKeyFor('elite', 'night', 'elite') === 'elite_night', 'bgmKeyFor 会优先选地图专属强敌曲');
    ok(bgm.bgmKeyFor('elite', 'nope', 'elite') === 'elite', '地图没有专属曲时退回通用 elite');

    game.newRun(1234);
    await wait(400);
    log('地图阶段 nowPlaying = ' + music.nowPlaying());

    game.startBattle('normal', 0);
    await until(() => music.status().sources > 0);
    await wait(300);
    log('战斗阶段 nowPlaying = ' + music.nowPlaying() + '，battleKind=' + game.battleKind);
    const st = music.status();
    log('  通道 = ' + st.backend + '（应为 webaudio，即 ogg 的 AudioBuffer 无缝循环），loop = ' + st.loop + '，音源数 = ' + st.sources);

    // 逐章开局：地图曲 / 普通战斗曲 / 强敌曲都必须跟着地图走
    for (let stage = 0; stage < STAGE_BIOME.length; stage++) {
      const biome = STAGE_BIOME[stage];
      game.data.stage = stage;
      game.data.map = generateMap(stage, game.rng);
      game.data.nodeId = null;
      game.phase = 'map';
      ui.forceRerender();
      await wait(900);
      ok(music.nowPlaying() === `map_${biome}`, `第 ${stage + 1} 章地图曲 = map_${biome}`, music.nowPlaying());

      game.startBattle('normal', 0);
      await wait(900);
      ok(music.nowPlaying() === `battle_${biome}`, `第 ${stage + 1} 章战斗曲 = battle_${biome}`, music.nowPlaying());

      game.startBattle('elite', 0);
      await wait(900);
      ok(music.nowPlaying() === `elite_${biome}`, `第 ${stage + 1} 章强敌曲 = elite_${biome}（原来是全场一首 elite）`,
        `${music.nowPlaying()}｜敌人 ${game.battle?.enemy?.name ?? '?'}`);
    }

    // 终章（第 6 章 = stage 5）的首领应该换成 boss_final
    game.data.stage = 5;
    game.data.map = generateMap(5, game.rng);
    game.data.nodeId = null;
    game.startBattle('boss', 0);
    await wait(1200);
    ok(music.nowPlaying() === 'boss_final', '终章首领用 boss_final', `${music.nowPlaying()}｜敌人 ${game.battle?.enemy?.name ?? '?'}`);

    if (fails.length) log(`BGM_ERRORS=[${fails.join(' | ')}]`);
    else log('BGM 按地图切换自检：通过 ✓');
    log('BGM_DONE');
  } catch (e) {
    log('FATAL ' + e.message + ' | ' + e.stack);
    log('BGM_DONE');
  }
})();
