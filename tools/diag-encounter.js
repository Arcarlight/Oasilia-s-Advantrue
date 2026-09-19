// 诊断：遭遇演出（地图 → 战斗的过场）到底演成什么样了（?dgenc=1）
//
// 用户的要求原话（两轮）：
//   「我方背影的贴图从右方非线性划到左边，同时敌人的正面图非线性从左滑到右，
//     同时一条黑色的带主题色的横线跟随正面图将屏幕遮盖，双双停留一小会，
//     随后滑出屏幕进入战斗。」
//   「敌人出现的时候可以在其立绘旁边写名字（大号）和野生、强敌等标注。」
//   「停留的时候可以进行资源预加载。这样是否能防止战斗中因为音效加载较慢而出现的
//     音效播放较慢的情况？」
//   「我所希望的是这样错开的，并且我表示的立绘是放在表示回合数旁边的那个立绘，
//     而不是精灵图。我希望黑幕能遮挡住整个屏幕。」
//
// 这份诊断就是逐条把这些变成能失败的断言 —— 尤其是几个光看截图看不出来的点：
//   ① 黑幕必须**从第一个采样点起**就是满屏且不透明（「遮挡住整个屏幕」）
//   ② 两只立绘必须**错开**：一个在视口上半、一个在下半，垂直间距够大
//   ③ 用的是**回合立绘**（gen9 正/背面图）而不是 PMD 行走图
//   ④ 「跟随正面图」：横线的右端必须和敌人立绘的中线贴着（差几像素就看得出来没跟着）
//   ⑤ 「非线性」：前半段走完的路程必须明显超过一半（线性的话正好是一半）
//   ⑥ 预载：停留结束时这批音效必须**已经解码好**（而不是「排上了队」）
//
// 采样是在外面看着 DOM 记时间线，而不是往被测量的代码里插桩 —— 那样测的是插桩后的东西。
//
// 由 tools/diag2.mjs 通过 ?dgenc=1 加载（真实时间：rt）。
// ?dgenc=shot&at=hold|in-mid 把演出钉在某一帧不动，给 tools/shot.mjs 截图用；
// ?dgenc=cold 只量「26 个战斗音效冷启动要多久」（音效慢半拍那条反馈的正题）。
(async () => {
  const log = (...a) => console.log('[d2]', ...a);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const fails = [];
  const ok = (cond, label, detail = '') => {
    if (cond) log(`  ✓ ${label}${detail ? ` — ${detail}` : ''}`);
    else { fails.push(label); log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`); }
  };
  const until = async (fn, ms = 12000) => {
    const t0 = performance.now();
    while (performance.now() - t0 < ms) { if (fn()) return true; await wait(60); }
    return false;
  };

  const params = new URLSearchParams(location.search);

  try {
    const game = window.__oasis;
    const ui = window.__oasisUI;
    const { audio, BATTLE_SFX, ENCOUNTER_SFX } = await import('../src/core/audio.js');
    const { liveAnimCount, createAnim, DIR } = await import('../src/core/sprites.js');
    const { turnArt } = await import('../src/core/gen9.js');
    const { TIERS } = await import('../src/data/enemies.js');
    const enc = await import('../src/ui/encounter.js');
    const { encounterDebug } = enc;

    game.newRun(20240607);
    await wait(400);
    audio.unlock();
    await wait(300);

    // ---- 冷启动量一次：这 26 个音效「什么都不预热」时要等多久 ----
    // 这就是「音效慢半拍」的原始成本：play() 是 fetch → decodeAudioData → start，
    // 所以每个音效第一次响都要先付这笔钱。遭遇演出在停留阶段把它付掉了。
    // 本地服务器没有网络延迟，量到的是**解码**那部分的底噪；
    // 想量真实的网络成本就对线上站点跑：?dgenc=cold（加 D2_PROXY）
    if (params.get('dgenc') === 'cold') {
      const names = [...BATTLE_SFX, ...ENCOUNTER_SFX];
      const t0 = performance.now();
      await audio.warm(names);
      const ms = performance.now() - t0;
      const done = await audio.warmed();
      log(`冷启动预载 ${names.length} 个音效：耗时 ${ms.toFixed(0)}ms（其中 ${done.length} 个解码成功）`);
      log(`  平均每个 ${(ms / names.length).toFixed(1)}ms —— 这就是「第一击的音效慢半拍」的量级`);
      log(`  本地服务器没有网络往返，所以这个数只是下限；真实网络还要加上 RTT 与下载时间`);
      log('ENC_DONE');
      return;
    }

    // ---- 截图模式：把演出钉在某一帧，别的什么都不做 ----
    const at = params.get('at');
    if (params.get('dgenc') === 'shot') {
      encounterDebug.freeze = at || 'hold';
      // ?p=0.25 可以把「划入」那一帧钉在任意进度上（默认 0.55）
      const p = Number(params.get('p'));
      if (at === 'in-mid' && Number.isFinite(p)) encounterDebug.freezeP = Math.min(1, Math.max(0, p));
      log(`截图模式：把演出钉在 ${encounterDebug.freeze} 这一帧${encounterDebug.freezeP != null ? `（进度 ${encounterDebug.freezeP}）` : ''}`);
      // 顺手守一下「舞台上只能有一屏」：标题是异步取精灵的，
      // 曾经因为「先 clear 再 await 再 append」把后渲染的地图压在底下过（同屏出现两屏）
      const stage = [...document.getElementById('stage').children].map((c) => c.className);
      ok(stage.length === 1, '舞台上只有一屏（没有把标题和地图叠在一起）', stage.join(' | ') || '（空）');
      game.startBattle('elite', 0, 'map');
      await until(() => !!document.querySelector('.encounter'));
      await wait(500);
      log('ENC_DONE');
      return;
    }

    log('=== 一、演出本体 ===');
    ok(enc.encounterMode() === 'always', '?dgenc 会把演出调成 always（诊断是直接 startBattle，没有 battleEntry=map）', enc.encounterMode());
    // 开关的语义单独测一遍（截图的那些脚本都靠它不被过场打乱）
    enc.setEncounterMode('map');
    ok(enc.wantsEncounter('map') === true && enc.wantsEncounter('direct') === false,
      '默认只有 battleEntry=map 的战斗才演（?scene=/冒烟/其余诊断都是 direct，不会被过场打乱）');
    enc.setEncounterMode('never');
    ok(enc.wantsEncounter('map') === false, '?enc=0 关得掉（连地图上撞见的也不演）');
    enc.setEncounterMode('always');

    // 真实玩法走的是 game.goToNode → enterNode → startBattle(kind, retry, 'map')，
    // 这条路必须把 entry 传成 'map'，否则过场在真实玩法里永远不会放。
    // 这里只截参数、不真的开打（把 startBattle 临时换掉）。
    {
      const real = game.startBattle;
      let entry = null;
      game.startBattle = (kind, retry, e) => { entry = e; return null; };
      game.enterNode({ type: 'battle' });
      game.enterNode({ type: 'elite' });
      game.startBattle = real;
      ok(entry === 'map', 'enterNode 把「从地图走进来的」标成 map（真实玩法走的就是这条路）', `entry=${entry}`);
    }

    // 动画定时器的计数先自证一下（下面的泄漏断言全靠它）
    const n0u = liveAnimCount();
    const tmpCanvas = await createAnim(game.data.slug, { anim: 'Idle', dir: DIR.DOWN });
    const n1u = liveAnimCount();
    tmpCanvas.destroy();
    tmpCanvas.destroy();   // 再调一次不能把计数减穿（战斗界面会重复调）
    const n2u = liveAnimCount();
    ok(n1u === n0u + 1 && n2u === n0u,
      'createAnim / destroy 的动画计数是准的，且 destroy 幂等', `${n0u} → ${n1u} → ${n2u}`);

    // 来回切屏不该积累游离动画（动画是 setInterval 推的，摘出 DOM 不会自己停）
    const nChurn0 = liveAnimCount();
    for (const ph of ['title', 'map', 'title', 'map']) {
      game.phase = ph;
      ui.forceRerender();
      await wait(260);
    }
    const nChurn1 = liveAnimCount();
    ok(nChurn1 <= nChurn0 + 1,
      '标题 ↔ 地图来回切两轮，不会积累游离的动画定时器',
      `${nChurn0} → ${nChurn1}`);

    const warmBefore = (await audio.warmed()).length;
    ok(warmBefore === 0, '演出前没有任何音效被预载过（后面全靠这场演出）', `已解码 ${warmBefore} 个`);

    // ---- 采样：把「谁在哪 / 黑幕多大 / 预载好了几个」按时间记下来 ----
    const liveBefore = liveAnimCount();
    const domBefore = document.querySelectorAll('canvas.anim').length;
    const samples = [];
    let sampling = true;
    const t0 = performance.now();
    const box = (node) => {
      if (!node) return null;
      const r = node.getBoundingClientRect();
      return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, w: r.width, h: r.height, cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
    };
    const sampler = (async () => {
      while (sampling) {
        const root = document.querySelector('.encounter');
        if (!root) { if (samples.length) break; }
        else {
          const curtain = root.querySelector('.enc-curtain');
          const line = root.querySelector('.enc-line-main');
          const lineCount = root.querySelectorAll('.enc-line').length;
          const enemyArt = root.querySelector('.enc-enemy .enc-art');
          const playerArt = root.querySelector('.enc-player .enc-art');
          const plate = root.querySelector('.enc-plate');
          if (curtain && line) {
            const c = box(curtain);
            const l = box(line);
            const e = box(enemyArt);
            const p = box(playerArt);
            const pl = box(plate);
            const nm = box(root.querySelector('.enc-name'));
            const neonBox = box(root.querySelector('.enc-neon'));
            const neon = [...root.querySelectorAll('.enc-neon-i')].map(box);
            samples.push({
              t: Math.round(performance.now() - t0),
              phase: root.dataset.phase ?? '',
              curtainLeft: c.left, curtainW: c.w, curtainH: c.h,
              curtainOpacity: parseFloat(getComputedStyle(curtain).opacity),
              lineW: l.w, lineLeft: l.left, lineRight: l.right, lineTop: l.top + l.h / 2, lineCount,
              enemy: e, player: p,
              plate: pl, name: nm, neonBox,
              neonBottom: neon.length ? Math.max(...neon.map((n) => n.top + n.h)) : null,
              neonLeft: neon.length ? Math.min(...neon.map((n) => n.left)) : null,
              // 4 份霓虹灯各自的右边缘：进场时它们的**间距**是拉开的（从右往左一份份落定）
              neonRights: neon.map((n) => Math.round(n.right)),
              warm: (await audio.warmed()).length,
            });
          }
        }
        await wait(20);
      }
    })();

    // 从这里开始就走**真实玩法的开关**（mode = 'map'），
    // 而不是靠 ?dgenc 强制打开 —— 测的必须是线上真正走的那条路。
    enc.setEncounterMode('map');
    game.startBattle('elite', 0, 'map');
    const enemyName = game.battle?.enemy?.name;
    const enemyTier = game.battle?.enemy?.tier;
    const enemySlug = game.battle?.enemy?.slug;
    await wait(60);
    ok(game.battleEntry === 'map', '这一场的 battleEntry = map', String(game.battleEntry));

    // 立绘 + 名字标注（趁演出还在场的时候查）
    const root = document.querySelector('.encounter');
    ok(!!root, '遭遇演出的容器挂上了');
    if (root) {
      const nameEl = root.querySelector('.enc-name');
      const neonEls = [...root.querySelectorAll('.enc-neon-i')];
      const eImg = root.querySelector('.enc-enemy .enc-art');
      const pImg = root.querySelector('.enc-player .enc-art');
      ok(nameEl?.textContent === enemyName, '敌人立绘下面写着大号名字', `「${nameEl?.textContent}」 vs 敌人 ${enemyName}`);
      // 霓虹灯档位：同一个词用超大空心字横向错开叠 4 份
      ok(neonEls.length === 4 && neonEls.every((n) => n.textContent === (TIERS[enemyTier]?.name ?? '')),
        '档位标注是**霓虹灯**：同一个词叠 4 份（野生 / 较强 / 精英 / 首领，和敌人数据一致）',
        `${neonEls.length} 份，内容「${neonEls[0]?.textContent}」 vs TIERS.${enemyTier}.name`);
      if (neonEls.length === 4) {
        const cs = getComputedStyle(neonEls[0]);
        const stroke = cs.webkitTextStrokeWidth || cs.getPropertyValue('-webkit-text-stroke-width');
        const fill = cs.color;
        ok(parseFloat(stroke) > 0 && /rgba?\([^)]*,\s*0\)|transparent/.test(fill),
          '霓虹灯是**空心**的（字身透明 + 描边）', `描边 ${stroke}，字身填色 ${fill}`);
        ok(parseFloat(cs.opacity) < 0.9, '霓虹灯是**半透明**的', `不透明度 ${cs.opacity}`);
        const fs = parseFloat(cs.fontSize);
        const nameFs = parseFloat(getComputedStyle(nameEl).fontSize);
        ok(fs >= nameFs * 1.5, '霓虹灯用的是**超大字号**（明显大于名字）', `霓虹 ${fs}px vs 名字 ${nameFs}px`);
        // 横向错开：4 份的右边缘必须各不相同
        const rights = neonEls.map((n) => Math.round(n.getBoundingClientRect().right));
        ok(new Set(rights).size === 4, '4 份**横向错开**（右边缘各不相同）', rights.join(' / '));
      }
      // 名字的位置要**等停稳了**再量：此刻敌人还在屏幕外往里滑，名牌是跟着它走的
      ok(root.querySelector('.enc-tier') === null, '旧的档位胶囊已经换掉了（不再是那个小圆角标签）');
      // 「叠在所有元素（除了背景）之上」：名牌必须是 .encounter 的直接子节点，
      // 而且层级要高过两只立绘 —— 塞在立绘那一组里的话它永远压不过 z-index 更高的我方
      {
        const plateEl = root.querySelector('.enc-plate');
        const pWrap = root.querySelector('.enc-player');
        const eWrap = root.querySelector('.enc-enemy');
        const z = (n) => Number(getComputedStyle(n).zIndex) || 0;
        ok(plateEl?.parentElement === root,
          '名牌是 .encounter 的直接子节点（不是塞在敌人立绘那一组里）',
          `父节点 ${plateEl?.parentElement?.className}`);
        ok(z(plateEl) > z(pWrap) && z(plateEl) > z(eWrap),
          '名牌整块**叠在所有元素之上**（层级高于两只立绘，只低于背景黑幕）',
          `名牌 ${z(plateEl)} > 我方 ${z(pWrap)} / 敌人 ${z(eWrap)}，黑幕 ${z(root.querySelector('.enc-curtain'))}`);
        // 霓虹灯在**名字之下**，名字压在它正中（用户：「霓虹灯叠在名字之下，名字放中间」）
        const neonEl = root.querySelector('.enc-neon');
        ok(z(nameEl) > z(neonEl),
          '**霓虹灯在名字之下**（名字压在霓虹灯上面）',
          `名字 ${z(nameEl)} > 霓虹灯 ${z(neonEl)}`);
      }
      // 「立绘而不是精灵图」：用的是 Generation 9 的正面/背面图（回合数旁边那种）
      const eWant = turnArt(enemySlug, 'front');
      const pWant = turnArt(game.data.slug, 'back');
      ok(!!eImg && eImg.tagName === 'IMG' && eImg.getAttribute('src') === eWant?.url,
        '敌人用的是**正面立绘**（gen9 front，不是 PMD 行走图）', `src=${String(eImg?.getAttribute('src')).slice(-42)}`);
      ok(!!pImg && pImg.tagName === 'IMG' && pImg.getAttribute('src') === pWant?.url,
        '我方用的是**背面立绘**（gen9 back）', `src=${String(pImg?.getAttribute('src')).slice(-42)}`);
      ok(root.querySelectorAll('canvas').length === 0,
        '这一屏里没有行走图 canvas（立绘和精灵图是两套素材，别混用）');
      // 名字用的是粗体那一套字体（卡名 / 商店名 / 怪名同族）
      ok(!!nameEl && getComputedStyle(nameEl).fontFamily.includes('Oasis Bold'),
        '大号名字用的是粗体字体', getComputedStyle(nameEl).fontFamily.split(',')[0]);
      // 立绘得真的加载出来了（宽高非 0；naturalWidth 非 0 才说明图真在）
      const pRect = box(pImg);
      const eRect = box(eImg);
      log(`  立绘渲染尺寸：我方背影 ${Math.round(pRect?.w ?? 0)}×${Math.round(pRect?.h ?? 0)}px · 敌人正面图 ${Math.round(eRect?.w ?? 0)}×${Math.round(eRect?.h ?? 0)}px（视口 ${window.innerWidth}×${window.innerHeight}）`);
      ok(pRect && pRect.h >= window.innerHeight * 0.2, '我方背影有存在感（不是兜底的迷你图）', `高 ${Math.round(pRect?.h ?? 0)}px`);
      ok(eRect && eRect.h >= window.innerHeight * 0.16, '敌人正面图有存在感', `高 ${Math.round(eRect?.h ?? 0)}px`);
    }

    // 等演出走完、战斗界面挂上
    const mounted = await until(() => ui.battleScreen?.mounted === true, 20000);
    // 挂载是在「黑幕盖满」那一刻发生的 —— 后面还有停留和退场，所以还要等黑幕真的被摘掉
    const gone = await until(() => !document.querySelector('.encounter'), 10000);
    await wait(200);
    sampling = false;
    await sampler;
    const liveAfter = liveAnimCount();
    ok(mounted, '演出结束后战斗界面挂载完成（黑幕掀开时战斗画面已经就位）');
    ok(gone, '演出收场了（黑幕层从 DOM 上摘掉了）');
    ok(samples.length > 8, '采样到了足够的时间线', `${samples.length} 个采样点，覆盖 ${samples.at(-1)?.t ?? 0}ms`);

    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // ---- ① 黑幕：从第一个采样点起就满屏 + 不透明 ----
    const first = samples.find((s) => s.curtainW > 0);
    ok(!!first && first.curtainW >= vw - 3 && first.curtainH >= vh - 3 && first.curtainOpacity >= 0.99,
      '黑幕**从第一帧起**就盖住整个屏幕（不留任何一角给地图）',
      first ? `第一个采样点(${first.t}ms)：${Math.round(first.curtainW)}×${Math.round(first.curtainH)}，不透明度 ${first.curtainOpacity}` : '（没采到）');
    ok(samples.every((s) => s.curtainW >= vw - 3 && s.curtainH >= vh - 3),
      '整场演出里黑幕始终是满屏的（不会中途缩回去）',
      `共 ${samples.length} 个采样点`);

    // ---- ② 错开站位 ----
    // 阶段直接用演出自己写在 data-phase 上的标记来切分（靠「线多宽」猜会误判：
    // 补满阶段线也是一点点变宽的，和划入长得一样）
    const byPhase = (p) => samples.filter((s) => s.phase === p && s.enemy && s.player);
    const slide = byPhase('in');
    const hold = byPhase('hold');
    const exit = byPhase('out');
    log(`  阶段采样：划入 ${slide.length} 点 · 补满+停留 ${hold.length} 点 · 退场 ${exit.length} 点`);
    ok(slide.length >= 4 && hold.length >= 4 && exit.length >= 2, '三个阶段都被采到了');

    if (hold.length) {
      const h = hold[Math.floor(hold.length / 2)];
      const gap = h.player.cy - h.enemy.cy;
      ok(h.enemy.cy < vh * 0.5 && h.player.cy > vh * 0.5,
        '两只立绘**错开**站位：敌人正面图在上半屏、我方背影在下半屏',
        `敌人中线 ${Math.round(h.enemy.cy)}（${(h.enemy.cy / vh * 100).toFixed(0)}%）· 我方 ${Math.round(h.player.cy)}（${(h.player.cy / vh * 100).toFixed(0)}%）`);
      ok(gap >= vh * 0.25, '错开的幅度够大（两只不会挤在同一条水平线上）', `垂直间距 ${Math.round(gap)}px（视口高的 ${(gap / vh * 100).toFixed(0)}%）`);
      ok(h.enemy.cx > vw * 0.5 && h.player.cx < vw * 0.5,
        '水平方向也对角：敌人在右、我方在左',
        `${Math.round(h.player.cx)} / ${Math.round(h.enemy.cx)}（视口宽 ${vw}）`);
      // 名牌的位置：停在敌人立绘**下面**、屏幕右半边（用户指的那个位置）
      const ph = hold.find((s) => s.plate && s.neonBottom != null);
      ok(ph && ph.plate.top >= ph.enemy.top + ph.enemy.h * 0.8,
        '名牌挂在敌人立绘**下面**（用户指的位置）',
        `立绘底 ${Math.round(ph ? ph.enemy.top + ph.enemy.h : 0)} → 名牌顶 ${Math.round(ph?.plate?.top ?? 0)}`);
      // 「在右半边」看的是**中心**：霓虹灯放大之后整块会越过中线，
      // 拿左边当判据会误报（左边到 687，而视口一半是 705 —— 但它明明在右边）
      ok(ph && ph.plate.cx > vw * 0.5,
        '名牌落在屏幕右半边',
        `名牌 ${Math.round(ph?.plate?.left ?? 0)}~${Math.round(ph?.plate?.right ?? 0)}（中心 ${Math.round(ph?.plate?.cx ?? 0)} / 视口中线 ${Math.round(vw / 2)}）`);
      // 名字和霓虹灯**都居右**（用户要求）：两者共享同一条右边缘，
      // 而且名字仍然压在霓虹灯上（不是各占一边、也不是居中）
      if (ph && ph.name && ph.neonBox) {
        const dx = Math.abs(ph.name.right - ph.neonBox.right);
        const overlapX = Math.min(ph.name.right, ph.neonBox.right) - Math.max(ph.name.left, ph.neonBox.left);
        const overlapY = Math.min(ph.name.bottom, ph.neonBox.bottom) - Math.max(ph.name.top, ph.neonBox.top);
        ok(dx <= 3,
          '名字和霓虹灯**右对齐**（右边缘齐平）',
          `名字右 ${Math.round(ph.name.right)} / 霓虹灯右 ${Math.round(ph.neonBox.right)}，差 ${dx.toFixed(1)}px`);
        ok(overlapX > 0 && overlapY > 0,
          '名字仍然压在霓虹灯上（两块是叠着的，不是各占一边）',
          `重叠 ${Math.round(overlapX)}×${Math.round(overlapY)}px（霓虹灯 ${Math.round(ph.neonBox.w)}×${Math.round(ph.neonBox.h)} / 名字 ${Math.round(ph.name.w)}×${Math.round(ph.name.h)}）`);
      }
      // 立绘不许被视口切掉：站位是按视口百分比算的，窗口一矮就容易把下边那只顶出去
      const clipped = hold.filter((s) => [s.enemy, s.player].some((b) => b.top < -2 || b.top + b.h > vh + 2 || b.left < -2 || b.left + b.w > vw + 2));
      ok(clipped.length === 0,
        '停留时两只立绘都完整在视口内（没有被边缘切掉）',
        clipped.length ? `${clipped.length}/${hold.length} 个采样点越界` : `视口 ${vw}×${vh}`);
      // 名牌挂在右下、霓虹灯又是超大字号 —— 最容易顶出屏幕的就是它。
      // 上、下、左、右都要看：底边被切掉是最容易发生的（名牌是 bottom 锚定的）
      const plateOut = hold.filter((s) => (s.plate?.top ?? 0) < 0
        || (s.plate?.bottom ?? 0) > vh + 2
        || (s.neonLeft ?? 0) < -2
        || (s.name?.left ?? 0) < -2
        || (s.name?.right ?? 0) > vw + 2);
      ok(plateOut.length === 0,
        '名字 + 霓虹灯都完整落在视口内（超大空心字没有被屏幕切掉）',
        hold.length ? `名牌 ${Math.round(Math.min(...hold.map((s) => s.plate?.top ?? 0)))}~${Math.round(Math.max(...hold.map((s) => s.plate?.bottom ?? 0)))}px · 最左 ${Math.round(Math.min(...hold.map((s) => Math.min(s.neonLeft ?? 0, s.name?.left ?? 0))))}px · 最右 ${Math.round(Math.max(...hold.map((s) => s.name?.right ?? 0)))}px / 视口 ${vw}×${vh}` : '（没采到）');
    }

    // ---- ③ 「光带跟随正面图」：划入阶段里光带右端 == 敌人立绘中线 ----
    // 两个前提：
    //   · 补满阶段光带本来就要跑在敌人前面把它拉到屏幕另一头，那一段不算「跟随」；
    //   · 敌人还在屏幕外时它中线是负的，光带也在屏幕外，那一段没有可比性 ——
    //     从它踏进屏幕那一刻开始比才有意义。
    // 比的是**右端**（lineRight）而不是宽度：光带现在是一条从左边外面扫进来的定长带子，
    // 宽度 = 右端 - 左端，拿宽度当判据等于假设左端钉在屏幕边上（那正是被改掉的老行为）。
    const onScreen = slide.filter((s) => s.enemy.cx > 2);
    const gaps = onScreen.map((s) => Math.abs(s.lineRight - s.enemy.cx));
    const worst = gaps.length ? Math.max(...gaps) : 999;
    ok(gaps.length > 3 && worst <= 3,
      '光带的右端始终贴着敌人立绘的中线（「跟随正面图」）',
      `进屏后 ${gaps.length} 个采样点，最大偏差 ${worst.toFixed(1)}px（取整误差，>3px 就是没跟着）`);
    // 线的高度也要跟着上边那只，而不是钉在屏幕正中
    const lineOffsets = hold.map((s) => Math.abs(s.lineTop - s.enemy.cy));
    const worstY = lineOffsets.length ? Math.max(...lineOffsets) : 999;
    ok(worstY <= 3, '光带的纵向位置跟着敌人立绘的中腰（不是屏幕正中）',
      `最大偏差 ${worstY.toFixed(1)}px；敌人中线 ${Math.round(hold[0]?.enemy?.cy ?? 0)} vs 屏幕正中 ${Math.round(vh / 2)}`);
    ok(hold.some((s) => s.lineW >= vw - 3), '光带最后铺满整幅宽度', `最宽 ${Math.round(Math.max(...samples.map((s) => s.lineW)))}px`);
    // 背景不是「光秃秃一条」：围着主线还有几条更细更暗的（用户提的）
    {
      const n = samples[0]?.lineCount ?? 0;
      ok(n >= 4, '背景那一组横线不止一条（围着主线还有几条更细更暗的）', `${n} 条`);
    }

    // ---- ③b 光带的进场：是一条**两头都在动**的带子从左边划进来 ----
    /**
     * 用户反馈：「线好像没有任何进场动画，敌人旁边的线可以向右划入」。
     * 老写法是「左端钉在屏幕最左边、宽度从 0 涨到敌人中线」—— 只有右端在动，
     * 而缓动是强 ease-out，看着就是刷一下铺满。现在是一条定长的光带整条往右扫：
     * 左端（尾巴）和右端（前沿）都在动，两端进入屏幕的时间也一前一后。
     */
    if (slide.length >= 4) {
      const sw = slide.filter((s) => s.lineRight > 2 && s.lineLeft > -2);
      const tailSeen = slide.filter((s) => s.lineLeft > 2);
      ok(tailSeen.length >= 2,
        '光带是**整条**从左边扫进来的：尾巴（左端）也进到屏幕里了（不是左端钉在屏幕边上）',
        `采到 ${tailSeen.length} 个「左端已在屏幕内」的点，最后左端 ${Math.round(slide.at(-1).lineLeft)}px`);
      const a = slide.find((s) => s.lineLeft > 2);
      const z = slide.at(-1);
      ok(a && z && z.lineLeft - a.lineLeft > vw * 0.08,
        '光带左端在划入阶段确实**往右走了**（看得到它在移动，而不是一瞬间出现）',
        a ? `左端 ${Math.round(a.lineLeft)} → ${Math.round(z.lineLeft)}px（${a.t}ms → ${z.t}ms）` : '（没采到）');
      // 划入阶段它该是「一条带子」，不该已经铺满
      ok(slide.every((s) => s.lineW <= vw * 0.45),
        '划入阶段光带还是一条带子（铺满是后面补满阶段的事）',
        `最宽 ${Math.round(Math.max(...slide.map((s) => s.lineW)))}px / 视口 ${vw}`);
      ok(sw.length >= 3, '光带的端点都量到了', `${sw.length} 个采样点`);
    }

    // ---- ④ 「非线性」：前半段时间里走完的路程要明显超过一半 ----
    if (slide.length >= 4) {
      const a = slide[0];
      const z = slide.at(-1);
      const dist = a.player.left - z.player.left;            // 往左走，正数
      const tMid = (a.t + z.t) / 2;
      const mid = slide.reduce((best, s) => (Math.abs(s.t - tMid) < Math.abs(best.t - tMid) ? s : best), a);
      const frac = dist > 1 ? (a.player.left - mid.player.left) / dist : -1;
      ok(frac >= 0.6,
        '我方背影是**非线性**划入（前半段时间走完 >60% 路程；匀速的话正好 50%）',
        `前半段走了 ${(frac * 100).toFixed(0)}%，用时 ${mid.t - a.t}ms / 全程 ${z.t - a.t}ms`);
      ok(dist > 40, '我方背影确实横穿了屏幕（不是原地不动）', `位移 ${dist.toFixed(0)}px`);
    }

    // ---- ④b 名牌（名字 + 霓虹灯）的进场：从屏幕右边外面划进来 ----
    /**
     * 用户反馈：「名字和霓虹灯好像没有任何进场动画，都可以从右划入」。
     * 老写法是 28px 位移 + 淡入 —— 霓虹灯一个字就 300px 宽，28px 根本看不见。
     * 现在整块从屏幕右侧外滑到位，这里按「起点在屏幕外 + 一路往左走 + 最后落在原位」三段验。
     */
    {
      const ps = slide.filter((s) => s.plate);
      const firstPlate = ps[0];
      const lastPlate = ps.at(-1);
      ok(!!firstPlate && firstPlate.plate.left >= vw - 2,
        '名牌一开始在**屏幕右边外面**（不是已经在自己的位置上淡进来）',
        firstPlate ? `第一个采样点：名牌左边缘 ${Math.round(firstPlate.plate.left)}px / 视口 ${vw}px` : '（没采到）');
      ok(ps.some((s) => s.plate.left > vw * 0.5 && s.plate.left < vw - 2),
        '中途能看到它压在屏幕右半边上（真的在「划」而不是瞬移）',
        ps.length ? `采到 ${ps.filter((s) => s.plate.left > vw * 0.5 && s.plate.left < vw - 2).length} 个「半路上」的点` : '（没采到）');
      // 一路往左：不能来回抖
      let back = 0;
      for (let i = 1; i < ps.length; i++) if (ps[i].plate.left > ps[i - 1].plate.left + 1.5) back += 1;
      ok(back === 0, '名牌在进场里**一路往左**（单调，没有来回抖）', `回退采样点 ${back} 个 / 共 ${ps.length} 个`);
      // 收尾：划完之后要正好落在自己的位置（右边距回到 CSS 的 4%，这里只要求贴到屏幕内）
      const hp = hold.find((s) => s.plate);
      ok(hp && hp.plate.right <= vw + 2 && hp.plate.right > vw * 0.85,
        '划完之后名牌停在自己的位置上（右对齐在屏幕右侧）',
        hp ? `停稳时名牌 ${Math.round(hp.plate.left)}~${Math.round(hp.plate.right)}px（视口 ${vw}）` : '（没采到）');
      // 名字比霓虹灯晚一点起步：两个都是从右边进来的，所以「还没到位」的那一个
      // 会**更靠右**（离起点更近）—— 中途应当采到「名字的右边缘在霓虹灯右边」的点。
      const lagged = ps.filter((s) => s.name && s.neonBox && s.name.right > s.neonBox.right + 4);
      ok(lagged.length >= 1, '名字比霓虹灯**晚一点**到位（灯管先到、名字再落上去）',
        `采到 ${lagged.length} 个「名字还在后面追」的点，最大差 ${lagged.length ? Math.round(Math.max(...lagged.map((s) => s.name.right - s.neonBox.right))) : 0}px`);
    }

    // ---- ④c 霓虹灯的 4 份：进场时是**从右往左一份份拉开**的 ----
    /**
     * 用户：「霓虹灯之间最好也错开，做出那种从右往左逐渐拉开的感觉」。
     * 静态时 4 份的右边缘相差 0.07em（约字号的 7%）；进场时每一份比右边那份多留一段距离，
     * 所以**进场中途的间距明显更大**，落定时才收拢回 0.07em —— 这就是「拉开」。
     */
    {
      const spreadOf = (s) => (s.neonRights?.length === 4
        ? Math.max(...s.neonRights) - Math.min(...s.neonRights) : null);
      const rest = hold.map(spreadOf).filter((x) => x != null);
      const restSpread = rest.length ? Math.round(rest.reduce((a, b) => a + b, 0) / rest.length) : 0;
      const flying = slide.map((s) => ({ t: s.t, spread: spreadOf(s), rights: s.neonRights })).filter((x) => x.spread != null);
      const widest = flying.reduce((best, s) => (best && best.spread >= s.spread ? best : s), null);
      ok(restSpread > 0 && widest && widest.spread > restSpread * 1.8,
        '进场中途霓虹灯的 4 份**间距被拉开**（从右往左一份份落定），落定后收拢',
        `中途最宽 ${widest ? Math.round(widest.spread) : '?'}px vs 落定后 ${restSpread}px（${(widest && restSpread ? (widest.spread / restSpread).toFixed(1) : '?')} 倍）`);
      // 拉开的方向必须对：右边那份（--i: 0）离终点更近 = 它的「多留距离」更小
      // 拿「当前右边缘 - 落定时的右边缘」当落后量，越靠左的应该越落后。
      // 拿「拉开得最开」的那一帧来判断先后：那时候四份的差别最大，最好分辨
      const target = hold.find((s) => s.neonRights)?.neonRights ?? null;
      const mid = widest;
      if (target && mid) {
        const behind = mid.rights.map((r, i) => r - target[i]);   // 相对落点还差多少
        // 越靠左（下标越大）应该越落后 → 这个数组应当是**递增**的
        const ordered = behind.every((v, i) => i === 0 || v >= behind[i - 1] - 2);
        ok(ordered, '最右边那份最先到位，往左的依次落后（「从右往左」拉开，不是反的）',
          `各份还差 ${behind.map((v) => Math.round(v)).join(' / ')}px（下标 0 是最靠右那份）`);
      }
      // 落定后必须收拢回静态的错开量（不然就不是霓虹灯，而是糊成一片 / 一直散着）
      const lastFlying = flying.at(-1);
      ok(lastFlying && Math.abs(lastFlying.spread - restSpread) <= 6,
        '划入结束那一刻 4 份已经收拢回静态间距（收成霓虹灯）',
        `结束时 ${lastFlying ? Math.round(lastFlying.spread) : '?'}px vs 静态 ${restSpread}px`);
    }

    // ---- ⑤ 「双双停留一小会」：停留期间两只都不许动 ----
    if (hold.length >= 3) {
      const drift = (get) => {
        const v = hold.map(get).filter((x) => x != null);
        return Math.max(...v) - Math.min(...v);
      };
      ok(drift((s) => s.player.left) <= 1 && drift((s) => s.enemy.left) <= 1,
        '停留期间两只立绘一动不动（真的在「停」）',
        `我方漂移 ${drift((s) => s.player.left).toFixed(1)}px，敌方 ${drift((s) => s.enemy.left).toFixed(1)}px，停留 ${hold.at(-1).t - hold[0].t}ms`);
      ok(drift((s) => s.plate?.left) <= 1, '停留期间名牌也不动', `名牌漂移 ${drift((s) => s.plate?.left).toFixed(1)}px`);
    }

    // ---- ⑤b 退场：名牌跟着黑幕出，但和黑幕**错开**（不是焊在一起） ----
    /**
     * 用户先说「出场就跟随着黑幕出就可以」，看完又说「离开的和黑幕错开一点，
     * 不要完全跟着走可能好一点」。所以判据是**两条同时成立**：
     *   ① 方向一致（都在往右走，名牌不回头）；
     *   ② 中途必须**明显拉开**（名牌比黑幕快，先一步出画）。
     */
    if (exit.length >= 2) {
      const base = hold.at(-1)?.plate?.left ?? 0;
      const d = exit.map((s) => ({
        t: s.t,
        plate: s.plate.left - base,          // 名牌相对停留时的位移
        curtain: s.curtainLeft,              // 黑幕的位移（黑幕从 0 起走）
        gap: (s.plate.left - base) - s.curtainLeft,
      }));
      const maxGap = Math.max(...d.map((s) => Math.abs(s.gap)));
      ok(maxGap > 40,
        '退场时名牌和黑幕**错开**（名牌跑得更快，先一步出画 —— 不是和幕布焊在一起）',
        `中途最大错开 ${Math.round(maxGap)}px（末帧：名牌 ${Math.round(d.at(-1).plate)}px / 黑幕 ${Math.round(d.at(-1).curtain)}px）`);
      const sameDir = d.every((s, i) => i === 0 || s.plate >= d[i - 1].plate - 1);
      ok(sameDir, '名牌一路往右（和黑幕同向，只是快慢不同）', `末帧位移 ${Math.round(d.at(-1).plate)}px`);
      ok(d.at(-1).plate > 40, '退场确实把名牌带走了（位移够大）', `位移 ${Math.round(d.at(-1).plate)}px`);
      // 光带在黑幕里（子节点），所以它跟着黑幕走是构造上成立的；这里顺手量一下
      ok(exit.every((s) => Math.abs((s.lineRight - s.curtainLeft) - (hold.at(-1)?.lineRight ?? 0)) <= 3),
        '那组光带在黑幕里，跟着黑幕一起退场（它不需要和黑幕错开）', `退出时右端 ${Math.round(exit.at(-1).lineRight)}px`);
    }


    // ---- ⑥ 预载：这是「音效慢半拍」那条反馈的正题 ----
    const warmAtHoldEnd = hold.at(-1)?.warm ?? -1;
    const need = BATTLE_SFX.length;
    ok(warmAtHoldEnd >= need,
      `停留结束时 ${need} 个战斗音效**已经解码好**了（不是「排上了队」）`,
      `已解码 ${warmAtHoldEnd} 个（演出刚开始时 ${samples[0]?.warm ?? 0} 个 —— 是从 0 起的）`);
    // 预载是并行发的，不能把入场动画拖慢
    const slideMs = slide.length >= 2 ? slide.at(-1).t - slide[0].t : -1;
    ok(slideMs > 0 && slideMs <= 900,
      '划入没有被并行的预载拖慢（2.9 MB 的音效在后台下载）', `划入实测 ${slideMs}ms`);

    // ---- 收场 ----
    ok(document.querySelectorAll('.encounter').length === 0, '演出结束后黑幕层被摘掉了（不会挡着战斗界面）');
    ok(!!document.querySelector('.battle-screen'), '战斗界面在场上');
    // 泄漏：演出前后各数一次「活着但不在 DOM 里的动画」——它们就是没人管的孤儿。
    // （元素摘出 DOM 不会停掉 setInterval，所以这种漏一定要显式 destroy。）
    const domAfter = document.querySelectorAll('canvas.anim').length;
    const orphansBefore = liveBefore - domBefore;
    const orphansAfter = liveAfter - domAfter;
    ok(orphansAfter <= orphansBefore,
      '演出没有新增游离的动画定时器（活着但不在 DOM 里的数量没有变多）',
      `孤儿 ${orphansBefore} → ${orphansAfter}；活 ${liveBefore} → ${liveAfter} 个 / DOM 里 ${domBefore} → ${domAfter} 个`);

    // ---- 二、反向测试：战斗里实际响过的音效，必须都在预载表里 ----
    log('=== 二、战斗音效覆盖（反向测试）===');
    const bs = ui.battleScreen;
    const b = game.battle;
    let guard = 0;
    while (!b.over && guard++ < 2) {
      let plays = 0;
      while (!b.over && plays++ < 6) {
        const hand = b.hand('player').filter((c) => b.canPlay(c.uid));
        if (!hand.length) break;
        await bs.playCard(hand[0].uid);
      }
      if (b.over) break;
      await bs.onEndTurn();
    }
    const playedNames = audio.playedNames();
    const allowed = new Set([...BATTLE_SFX, ...ENCOUNTER_SFX]);
    const leaks = playedNames.filter((n) => !allowed.has(n));
    log(`  这一场实际响过 ${playedNames.length} 种音效：${playedNames.join(', ')}`);
    ok(playedNames.length >= 5, '确实打出了足够多的音效事件', `${playedNames.length} 种`);
    ok(leaks.length === 0,
      '战斗里响过的音效全部在预载表 BATTLE_SFX 里（谁加了新音效却忘了登记，这里会红）',
      leaks.length ? `漏登记：${leaks.join(', ')}` : '全覆盖');

    // ---- 三、再打一场：确认第二场也干净 ----
    log('=== 三、再打一场（动画定时器泄漏）===');
    const live1 = liveAnimCount();
    game.startBattle('elite', 0, 'map');
    await until(() => ui.battleScreen?.mounted === true, 20000);
    await until(() => !document.querySelector('.encounter'), 10000);
    await wait(400);
    const live2 = liveAnimCount();
    ok(live2 <= live1,
      '第二场遭遇演出没有留下游离的动画定时器',
      `第一场后 ${live1} 个，第二场后 ${live2} 个`);

    if (fails.length) log(`ENC_ERRORS=[${fails.join(' | ')}]`);
    else log('遭遇演出自检：通过 ✓');
    log('ENC_DONE');
  } catch (e) {
    log('FATAL ' + e.message + ' | ' + e.stack);
    log('ENC_DONE');
  }
})();
