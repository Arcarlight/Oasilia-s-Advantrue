// 诊断脚本：实际打一场，逐事件记录 HP 变化、血条宽度、头像是否加载。
// 由 tools/diagnose.mjs 启动的页面通过 ?diag=1 加载（需要真实页面里的 HUD 节点）。
(async () => {
  const log = (...a) => console.log('[dg]', ...a);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  const errors = [];
  window.addEventListener('error', (e) => errors.push('window: ' + e.message));
  window.addEventListener('unhandledrejection', (e) => errors.push('reject: ' + (e.reason && e.reason.message)));

  try {
    const game = window.__oasis;
    const ui = window.__oasisUI;
    if (!game || !ui) { log('FATAL 游戏没启动'); log('DG_DONE'); return; }

    game.newRun(4242);
    await wait(600);

    // --- 1) HUD 头像 ---
    const face = document.getElementById('hud-portrait');
    const img = face && face.querySelector('img');
    if (img) {
      const r = img.getBoundingClientRect();
      const cs = getComputedStyle(img);
      const fr = face.getBoundingClientRect();
      const fcs = getComputedStyle(face);
      log('HUD 头像 img: natural=' + img.naturalWidth + 'x' + img.naturalHeight + ' rect=' + r.width.toFixed(0) + 'x' + r.height.toFixed(0));
      log('  img computed: width=' + cs.width + ' height=' + cs.height + ' display=' + cs.display + ' visibility=' + cs.visibility + ' opacity=' + cs.opacity);
      log('  img offsetParent=' + (img.offsetParent ? img.offsetParent.className || img.offsetParent.tagName : 'null') + ' clientRect=' + img.clientWidth + 'x' + img.clientHeight);
      log('  父容器 .hud-portrait: rect=' + fr.width.toFixed(0) + 'x' + fr.height.toFixed(0) + ' display=' + fcs.display + ' overflow=' + fcs.overflow);
      log('  #hud 可见? ' + !document.getElementById('hud').classList.contains('hidden'));
      let chain = [];
      let up = img.parentElement;
      while (up && up !== document.documentElement) {
        const c = getComputedStyle(up);
        const rr = up.getBoundingClientRect();
        chain.push((up.id || up.className || up.tagName) + '[d=' + c.display + ',' + rr.width.toFixed(0) + 'x' + rr.height.toFixed(0) + ']');
        up = up.parentElement;
      }
      log('  祖先链: ' + chain.join(' <- '));
      log('  视口 ' + window.innerWidth + 'x' + window.innerHeight + '，命中 620px 断点? ' + window.matchMedia('(max-width: 620px)').matches);
      log('  img outerHTML=' + img.outerHTML.slice(0, 200));
      log('  img style.width=' + img.style.width + ' style.height=' + img.style.height + ' attr=' + img.getAttribute('width') + 'x' + img.getAttribute('height'));
      log('  img 位置 left=' + r.left.toFixed(0) + ' top=' + r.top.toFixed(0) + ' 命中测试到的元素=' + (document.elementFromPoint(1020 / 2, fr.top + fr.height / 2) || {}).tagName);
      // 现场插一张同样 class 的图，看是不是 CSS 的问题
      const probe = document.createElement('img');
      probe.className = 'portrait';
      probe.src = img.src;
      face.parentElement.append(probe);
      await wait(400);
      const pr = probe.getBoundingClientRect();
      log('  现场插入的对照图 rect=' + pr.width.toFixed(0) + 'x' + pr.height.toFixed(0) + ' natural=' + probe.naturalWidth);
      log('  对照图 style.width=' + probe.style.width + '（应为空）');
      probe.remove();
      // 强制重排后重新测量原来那张
      void img.offsetHeight;
      const r2 = img.getBoundingClientRect();
      log('  重排后原图 rect=' + r2.width.toFixed(0) + 'x' + r2.height.toFixed(0) + ' offsetW=' + img.offsetWidth);
      const pc = getComputedStyle(img.parentElement);
      log('  直系父类名=' + img.parentElement.className + ' display=' + pc.display + ' w=' + img.parentElement.getBoundingClientRect().width);
      log('  是不是同一个元素？ ' + (img.parentElement === face) + '，face.children=' + face.children.length);
    } else {
      log('HUD 头像: 没有 img 元素！innerHTML=' + (face ? face.innerHTML.slice(0, 150) : 'no node'));
    }

    // --- 2) 进战斗 ---
    const node = game.availableNodes().find((n) => n.type === 'battle') || game.availableNodes()[0];
    game.goToNode(node.id);
    await wait(1500);
    log('进战斗后捕获到的错误 = ' + JSON.stringify(errors));
    // 字体：确认自定义字体真的生效了
    try {
      const nameEl = document.getElementById('hud-name');
      log('字体: hud-name computed = ' + getComputedStyle(nameEl).fontFamily);
      log('  字体加载状态 = ' + [...document.fonts].map((f) => f.family + ':' + f.status).join(', '));
      log('  document.fonts.check = ' + document.fonts.check('16px "LXGW Neo XiHei Plus"'));
    } catch (e) { log('字体检查失败 ' + e.message); }

    const b = game.battle;
    const bs = ui.battleScreen;
    log('战斗: 玩家 HP', b.player.hp + '/' + b.player.maxHp, '| 敌人', b.enemy.name, b.enemy.hp + '/' + b.enemy.maxHp, '| battleScreen=' + !!bs);

    const readBars = () => {
      const pFill = document.querySelector('.fighter-player .bar-hp i');
      const eFill = document.querySelector('.fighter-enemy .bar-hp i');
      const pText = document.querySelector('.fighter-player .bar-hp b');
      const eText = document.querySelector('.fighter-enemy .bar-hp b');
      return {
        pw: pFill ? pFill.style.width : '?',
        ew: eFill ? eFill.style.width : '?',
        pt: pText ? pText.textContent : '?',
        et: eText ? eText.textContent : '?',
      };
    };
    log('开局血条: 玩家 ' + readBars().pt + ' (' + readBars().pw + ') | 敌人 ' + readBars().et + ' (' + readBars().ew + ')');

    for (const side of ['player', 'enemy']) {
      const box = document.querySelector(side === 'player' ? '.fighter-player .fighter-face' : '.fighter-enemy .fighter-face');
      const fi = box && box.querySelector('img');
      log(side + ' 头像: ' + (fi ? 'natural=' + fi.naturalWidth + ' 显示=' + fi.getBoundingClientRect().width.toFixed(0) : '没有 img'));
    }

    // --- 3) 打几个回合，逐步核对引擎数值 vs DOM 显示 ---
    let mismatch = 0;
    let checks = 0;
    for (let round = 0; round < 5 && !b.over; round++) {
      let guard = 0;
      while (!b.over && guard++ < 12) {
        const hand = b.hand('player').filter((c) => b.canPlay(c.uid));
        if (!hand.length) break;
        // 走真实的 UI 出牌路径，并等演出整个跑完再判定（演出途中读数没意义）
        if (bs) {
          const p = bs.playCard(hand[0].uid);
          if (p && typeof p.then === 'function') await p;
        } else {
          b.playCard(hand[0].uid);
        }
        await wait(150);
        const bars = readBars();
        const domP = String(bars.pt).split('/')[0].trim();
        const domE = String(bars.et).split('/')[0].trim();
        const okP = String(Math.max(0, b.player.hp)) === domP;
        const okE = String(Math.max(0, b.enemy.hp)) === domE;
        checks++;
        // 战斗刚结束的话界面已经切到结算页了，这时候读不到血条，不算不一致
        if ((!okP || !okE) && !b.over && !(bs && bs.destroyed)) {
          mismatch++;
          log('  !! 演出结束后仍不一致：引擎 p=' + b.player.hp + ' e=' + b.enemy.hp +
              ' | DOM 玩家 "' + bars.pt + '" 敌人 "' + bars.et + '" | busy=' + (bs ? bs.busy : '?'));
        }
      }
      log('  回合 ' + (round + 1) + ' 末：引擎 p=' + b.player.hp + ' e=' + b.enemy.hp + ' | DOM 玩家 "' + readBars().pt + '" 敌人 "' + readBars().et + '"');
      if (!b.over) {
        // 走真实的 UI 结束回合路径并等演出跑完（演出现在放慢了，等待也要跟着变长）
        if (bs) {
          const t = bs.onEndTurn();
          if (t && typeof t.then === 'function') await t;
        } else {
          b.endTurn();
          await wait(1400);
        }
      }
    }
    log('核对 ' + checks + ' 次，不一致 ' + mismatch + ' 次');
    log('战斗结束 winner=' + b.winner);

    // --- 4) 事件页面：点选项后会不会卡住 ---
    game.phase = 'map';
    ui.current = null;
    ui.forceRerender();
    await wait(500);
    game.startEvent();
    await wait(700);

    const title = document.querySelector('.scene-screen .panel-title');
    const opts = document.querySelectorAll('.scene-screen .option');
    log('事件界面: 标题=' + (title ? title.textContent : '?') + ' 选项数=' + opts.length);
    if (opts.length) {
      opts[0].click();
      await wait(800);
      const resultBox = document.querySelector('.result-box');
      const buttons = [...document.querySelectorAll('.scene-screen button')].map((x) => x.textContent.trim().slice(0, 14));
      log('点选项后: result-box=' + (resultBox && !resultBox.classList.contains('hidden') ? resultBox.textContent.slice(0, 34) : '无/隐藏') + ' | 按钮=' + JSON.stringify(buttons));
      const cont = [...document.querySelectorAll('.scene-screen button')].find((x) => x.textContent.includes('继续'));
      if (!cont) {
        log('!!! 没有「继续前进」按钮 → 会卡在事件页');
      } else {
        cont.click();
        await wait(800);
        log('点继续后: phase=' + game.phase + ' 地图节点数=' + document.querySelectorAll('.map-node').length + ' 屏幕数=' + document.querySelectorAll('.screen').length);
      }
    }


    // --- 5) 战斗日志位置与可见性 ---
    window.__oasisAuto({ scene: 'battle' });
    await wait(1500);
    const logEl = document.querySelector('.battle-log');
    if (logEl) {
      const r = logEl.getBoundingClientRect();
      log('战斗日志: 高=' + r.height.toFixed(0) + ' 顶=' + r.top.toFixed(0) + ' 底=' + r.bottom.toFixed(0) +
          ' 视口高=' + window.innerHeight + ' 距底=' + (window.innerHeight - r.bottom).toFixed(0) +
          ' 条目=' + logEl.children.length + ' 可滚动=' + (logEl.scrollHeight > logEl.clientHeight));
      // 手牌区和底栏的位置
      const hand = document.querySelector('.hand');
      const bar = document.querySelector('.battle-bar');
      if (hand) { const hr = hand.getBoundingClientRect(); log('  手牌区: 顶=' + hr.top.toFixed(0) + ' 底=' + hr.bottom.toFixed(0)); }
      if (bar) { const br = bar.getBoundingClientRect(); log('  底栏(AP/结束回合): 顶=' + br.top.toFixed(0) + ' 底=' + br.bottom.toFixed(0)); }
      // 日志里现在有几条
      const texts = [...logEl.children].map((p) => p.textContent.slice(0, 18));
      log('  日志内容: ' + JSON.stringify(texts.slice(-6)));
      // 日志是否盖住了玩家角色卡
      const pc = document.querySelector('.fighter-player .fighter-card');
      if (pc) {
        const pr = pc.getBoundingClientRect();
        log('  玩家角色卡: 顶=' + pr.top.toFixed(0) + ' 底=' + pr.bottom.toFixed(0) + ' 与日志重叠? ' + (pr.bottom > r.top && pr.top < r.bottom));
      }
      const pl = document.querySelector('.fighter-player .fighter-body canvas');
      if (pl) {
        const lr = pl.getBoundingClientRect();
        const overlap = lr.right > r.left && lr.left < r.right && lr.bottom > r.top && lr.top < r.bottom;
        log('  玩家精灵: x=' + lr.left.toFixed(0) + '~' + lr.right.toFixed(0) + ' y=' + lr.top.toFixed(0) + '~' + lr.bottom.toFixed(0) + ' 与日志矩形重叠? ' + overlap);
      }
    }
    log('ERRORS=' + JSON.stringify(errors));
    log('DG_DONE');
  } catch (e) {
    log('FATAL ' + e.message + ' | ' + e.stack);
    log('DG_DONE');
  }
})();
