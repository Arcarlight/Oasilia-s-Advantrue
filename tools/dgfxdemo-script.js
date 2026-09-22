// 特效总览（截图 / 对着看用）：`?dgfxdemo=1`
//
// 为什么要有它：特效是**一闪而过**的，靠 shot.mjs 去赌「刚好拍到那一帧」十次能中一次；
// 而且战斗演出速度调慢之后（?dgplay=1&mul=8）前后加起来几十秒虚拟时间，
// 想同时看到「中毒的绿雾」「护盾的罩子」「电系的闪电」几乎不可能。
// 这个脚本把 Kenney 那套贴图按**战斗里的实际用法**摆成一格一格，
// 颜色、尺寸、混合模式全走 battle-fx.js 里那一套（不是另外写一份配色），
// 一格挂 60 秒不消失 —— 一张截图就能把整套看全。
//
// 用法：
//   node tools/shot.mjs "http://127.0.0.1:5123/oasis-game.html?dgfxdemo=1" tools/shots/fx-demo.png 5000
(async () => {
  const log = (...a) => console.log('[d2] [fx]', ...a);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  try {
    const game = window.__oasis;
    const ui = window.__oasisUI;
    const { burst, projectile, tintOf, statusLook } = await import('../src/ui/battle-fx.js');
    game.newRun(90210);
    await wait(300);
    const node = game.availableNodes().find((n) => n.type === 'battle') || game.availableNodes()[0];
    game.goToNode(node.id);
    await wait(2200);
    const bs = ui.battleScreen;
    if (!bs?.field) { log('FATAL 没进战斗'); return; }

    // 演出慢一点、别在截图前自己走完
    bs.speedMul = 6;

    /** 一条 = 一类用法：[说明, 贴图, 颜色, 额外参数] */
    const ROWS = [
      ['火 · 命中/弧光', 'flare_1', tintOf(['火']), {}],
      ['水 · 命中', 'dirt_2', tintOf(['水']), {}],
      ['草 · 治疗', 'star_04', '#9df0a8', {}],
      ['冰 · 治疗', 'star_08', '#e6ffe9', {}],
      ['电 · 直伤闪电', 'spark_04', tintOf(['电']), { klass: 'fx-impact' }],
      ['龙 · 会心', 'star_09', tintOf(['龙']), { klass: 'fx-impact-crit' }],
      ['毒 · 中毒', statusLook('poison').fx, statusLook('poison').color, {}],
      ['剧毒 · 中毒', statusLook('toxic').fx, statusLook('toxic').color, {}],
      ['灼伤', statusLook('burn').fx, statusLook('burn').color, {}],
      ['出血', statusLook('bleed').fx, statusLook('bleed').color, {}],
      ['虚弱', statusLook('weak').fx, statusLook('weak').color, {}],
      ['削弱（压暗）', 'smoke_1', '#6a4a6a', { blend: 'multiply' }],
      ['护盾罩子', 'magic_2', '#8ce4ff', {}],
      ['护盾光环', 'light_1', '#cdf3ff', { klass: 'fx-ring' }],
      ['净化光环', 'star_02', '#dff6ff', { klass: 'fx-ring' }],
      ['强化星芒', 'star_05', '#ffe06a', {}],
      ['敏捷月牙', 'twirl_01', '#9df0d8', {}],
      ['闪避残影', 'trace_06', '#cfe4ff', { klass: 'fx-ring' }],
      ['土块 A', 'dirt_1', '#d9b070', { klass: 'fx-impact' }],
      ['土块 B', 'dirt_2', '#c9a060', { klass: 'fx-impact' }],
      ['斩击', 'slash_1', '#ff8a7a', {}],
      ['小闪', 'star_01', '#ffe8b0', {}],
      ['星环', 'star_03', '#e8dcc0', {}],
      ['符文阵', 'magic_1', '#c08ade', {}],
    ];

    // 一整块盖在战场上，网格排布；每格里的特效挂在格子上（.fx-burst 是 50%/50% 居中的）
    const st = document.createElement('style');
    st.textContent = `
      .fx-demo { position: absolute; inset: 0; z-index: 8;
        display: grid; grid-template-columns: repeat(6, 1fr); grid-auto-rows: 1fr; }
      .fx-demo-cell { position: relative; outline: 1px dashed rgba(255,255,255,.14); }
      .fx-demo-cell > span { position: absolute; left: 3px; bottom: 2px; font-size: 11px;
        color: rgba(255,255,255,.75); text-shadow: 0 1px 0 #000; }
      /* 定格在「最亮」那一格上：截图要的是形状和颜色，不是动画进度 */
      .fx-demo-cell .fx-burst { animation: none !important; opacity: 1 !important; scale: 1 !important; }
      /* 飞行物冻在半路上（不然只能拍到它的起点，或者根本拍不到） */
      .fx-projectile { animation: none !important; opacity: 1 !important;
        translate: calc(var(--fx-dx, 0px) * .45) calc(var(--fx-dy, 0px) * .45); }`;
    document.head.append(st);

    const wrap = document.createElement('div');
    wrap.className = 'fx-demo';
    for (const [label, fx, color, opts] of ROWS) {
      const cell = document.createElement('div');
      cell.className = 'fx-demo-cell';
      const cap = document.createElement('span');
      cap.textContent = label;
      cell.append(cap);
      wrap.append(cell);
      /**
       * ⚠ ms 不是「挂 60 秒」而是**算过的**：截图用的是虚拟时间（shot.mjs 的
       * `--virtual-time-budget`，这里 6500ms），而 fxBurst 的关键帧在 25% 处最亮 ——
       * 取 26000ms 正好让 6500ms 落在 25%，一格一格都是「最亮的那一帧」。
       * 一开始写了 60000ms，结果截图那一刻才走到 11%（opacity 0.44、scale 0.7），
       * 满屏只有框和文字，特效全都淡得看不见。
       */
      const MS = 26000;
      burst(cell, fx, { size: 92, ms: MS, color, ...opts });
    }
    bs.field.append(wrap);
    /**
     * 打在控制台上的一行体检：**遮罩到底有没有挂上**。
     * 特效的形状全靠 `mask-image: var(--fx-img)`（见 style.css），而自定义属性里的 `url()`
     * 是**相对于用到它的那份样式表**解析的 —— 单文件包里 style.css 被内联进 html，
     * 基准就是页面本身，`assets/img/fx/…` 才找得到；要是哪天改成 <link> 引样式表，
     * 同一个路径会变成 /src/ui/assets/…（404，特效静默消失、连报错都没有）。
     */
    const probe = wrap.querySelector('.fx-burst');
    const cs = probe ? getComputedStyle(probe) : null;
    log('格数=' + ROWS.length,
      '｜ mask=' + (cs?.maskImage || cs?.webkitMaskImage || '(空！)').slice(0, 46),
      '｜ color=' + (cs?.backgroundColor ?? '-'),
      '｜ 动画面=' + (cs?.animationName ?? '-'));
    const shots = [...wrap.querySelectorAll('.fx-burst')];
    log('挂在格子里的特效数=' + shots.length);

    // 远隔类的飞行物：从敌方精灵飞向主角（冻在中途，不然截不到）
    const flying = projectile(bs.field, bs.enemyBody, bs.playerBody, 'trace_04', {
      size: 64, ms: 60000, color: tintOf(['电']),
    });
    log('飞行物=' + !!flying);

    // 行走图闪白：把动画**停在最白那一帧**（12% 那一格），不然只能靠运气截到
    const st2 = document.createElement('style');
    st2.textContent = '.fighter-body.demo-flash { animation: whiteFlash 620ms both;'
      + ' animation-delay: -0.09s; animation-play-state: paused; }';
    document.head.append(st2);
    bs.playerBody.classList.add('demo-flash');

    /**
     * 三种闪光**并排**看：护盾的白、属性提升的红、属性被削的蓝。
     *
     * 为什么单摆这一行：3.1.8 的红/蓝闪光在玩家那儿「还是白的」——
     * 原因是剪影是纯白起步（明度 97%、饱和度顶格），sepia+saturate 根本挤不出颜色。
     * 这种错只有把三种颜色摆在一起看才一眼认出来，所以让总览页常备这一行。
     */
    const { flashFilter, FLASH_UP, FLASH_DOWN } = await import('../src/ui/battle-fx.js');
    const idle = bs.playerIdleAnim;
    if (idle) {
      const strip = document.createElement('div');
      strip.className = 'fx-demo-flash';
      for (const [label, color] of [['护盾 · 白', null], ['提升 · 红', FLASH_UP], ['被削 · 蓝', FLASH_DOWN]]) {
        const cell = document.createElement('div');
        const cap = document.createElement('span');
        cap.textContent = label;
        // 把待机画布**拷一份**静态图（canvas 克隆不带位图，得自己 drawImage），再套闪光滤镜
        const copy = document.createElement('canvas');
        copy.width = idle.width;
        copy.height = idle.height;
        copy.getContext('2d').drawImage(idle, 0, 0);
        copy.style.cssText = 'width:' + idle.style.width + ';height:' + idle.style.height
          + ';image-rendering:pixelated;position:static;transform:none;filter:' + flashFilter(color) + ';';
        cell.append(copy, cap);
        strip.append(cell);
      }
      const st3 = document.createElement('style');
      st3.textContent = `
        .fx-demo-flash { position: absolute; left: 12px; top: 50%; transform: translateY(-50%);
          z-index: 9; display: flex; gap: 14px; align-items: flex-end; }
        .fx-demo-flash > div { position: relative; outline: 1px dashed rgba(255,255,255,.2);
          padding: 6px 8px 18px; }
        .fx-demo-flash span { position: absolute; left: 6px; bottom: 2px; font-size: 11px;
          color: rgba(255,255,255,.8); text-shadow: 0 1px 0 #000; }`;
      document.head.append(st3);
      bs.field.append(strip);
      log('闪光样本：' + ['白', '红', '蓝'].join('/') + '（flashFilter 已应用）');
    }
    log('FX_DEMO_DONE');
  } catch (e) {
    log('FATAL ' + (e?.message ?? e));
  }
})();
