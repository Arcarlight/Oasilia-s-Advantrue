// 诊断：按地图切 BGM 到底有没有生效。
// 由 tools/diag2.mjs 通过 ?dgbgm=1 加载。
(async () => {
  const log = (...a) => console.log('[d2]', ...a);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  // 解码是异步的：等一下再读状态，否则会看到「还在解码」的中间态
  const until = async (fn, ms = 8000) => {
    const t0 = performance.now();
    while (performance.now() - t0 < ms) { if (fn()) return true; await wait(80); }
    return false;
  };
  try {
    const game = window.__oasis;
    const ui = window.__oasisUI;
    const { audio } = await import('/src/core/audio.js');
    const bgm = await import('/src/core/bgm.js');
    const music = bgm.music;
    music.debug = true;
    audio.unlock();
    await wait(600);

    log('BGM_FILES 键（' + Object.keys(bgm.BGM_FILES).length + '）: ' + Object.keys(bgm.BGM_FILES).join(','));
    log('bgmKeyFor(battle, desert) = ' + bgm.bgmKeyFor('battle', 'desert'));
    log('bgmKeyFor(map, forest) = ' + bgm.bgmKeyFor('map', 'forest'));
    log('audio.unlocked? ' + (audio.ctx ? audio.ctx.state : 'no ctx'));

    game.newRun(1234);
    await wait(400);
    log('地图阶段 nowPlaying = ' + music.nowPlaying());

    game.startBattle('normal', 0);
    await until(() => music.status().sources > 0);
    await wait(300);
    log('战斗阶段 nowPlaying = ' + music.nowPlaying() + '，battleKind=' + game.battleKind);
    log('  status = ' + JSON.stringify(music.status()));
    const st = music.status();
    log('  通道 = ' + st.backend + '（应为 webaudio，即 ogg 的 AudioBuffer 无缝循环），loop = ' + st.loop + '，音源数 = ' + st.sources);

    // 换一张地图再打一次，确认是「按地图」而不是固定曲
    game.data.stage = 3;
    const { generateMap } = await import('/src/data/mapgen.js');
    game.data.map = generateMap(3, game.rng);
    game.data.nodeId = null;
    game.phase = 'map';
    ui.forceRerender();
    await wait(1200);
    log('第四章地图 nowPlaying = ' + music.nowPlaying() + '（应为 map_tide）');
    game.startBattle('normal', 0);
    await wait(1200);
    log('第四章战斗 nowPlaying = ' + music.nowPlaying() + '（应为 battle_tide）');

    // 终章（第 6 章 = stage 5）的首领应该换成 boss_final
    game.data.stage = 5;
    game.data.map = generateMap(5, game.rng);
    game.data.nodeId = null;
    game.startBattle('boss', 0);
    await wait(1500);
    log('终章首领 nowPlaying = ' + music.nowPlaying() + '（第 6 章应为 boss_final），敌人=' + (game.battle?.enemy?.name ?? '?'));
    log('BGM_DONE');
  } catch (e) {
    log('FATAL ' + e.message + ' | ' + e.stack);
    log('BGM_DONE');
  }
})();
