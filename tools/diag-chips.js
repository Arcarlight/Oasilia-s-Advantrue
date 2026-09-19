// 诊断：负面状态胶囊的「附加 / 变化 / 消除」三个方向真的有动画吗（?dgchips=1）
//
// 背景：状态胶囊原来是每次 refreshSide 都 clear() + 重新 append —— 节点每次都是新的，
// 所以「附加」只能凭空出现、「消除」直接凭空消失，而且想补 CSS 入场动画也没法补
// （动画挂在新建的节点上，每刷一次都会重播，多段攻击时会闪成一片）。
// 现在改成按状态名对齐（见 battle-view.js 的 syncStatusChips），这份诊断验的就是它：
//
//   ① 新挂上的状态：胶囊播入场动画（chipIn），而且是**新节点**
//   ② 同样的数值再刷一次：节点是同一个、动画不重播（这是「不会满屏乱闪」的证据）
//   ③ 层数变化：还是同一个节点，数字滑一下 + 弹一颗 Δ 角标 + 胶囊弹一下
//   ④ 层数归零（毒自己衰减完）：胶囊播退场动画，播完真的从 DOM 上摘掉
//   ⑤ 真打一张「白雾」：净化事件既打日志、又把要清掉的胶囊当着面化掉
//   ⑥ 真打一张「剧毒爆发」：引爆同一套（以前这两条事件连日志都是丢的）
//
// 用法：node tools/diag2.mjs "http://127.0.0.1:5123/?dgchips=1" rt
//       node tools/diag2.mjs "http://127.0.0.1:5123/?dgchips=shot" rt   （定格截图）

(async () => {
  const log = (...a) => console.log('[d2] [chip]', ...a);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const fails = [];
  const ok = (cond, label, detail = '') => {
    if (cond) log(`  ✓ ${label}${detail ? ` — ${detail}` : ''}`);
    else { fails.push(label); log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`); }
  };

  /** 某个元素上正在跑的动画名 */
  const running = (node) => (node?.getAnimations?.() ?? [])
    .filter((a) => a.playState === 'running')
    .map((a) => a.animationName ?? a.id ?? '?');

  try {
    const game = window.__oasis;
    const ui = window.__oasisUI;
    const { CARD_BY_ID } = await import('../src/data/cards.js');
    const { STATUS_INFO } = await import('../src/core/battle.js');
    const SHOT = new URLSearchParams(location.search).get('dgchips') === 'shot';

    // 等 boot 的标题页收场（它的异步收尾会盖住界面）
    const t0 = Date.now();
    for (;;) {
      const screens = [...document.querySelectorAll('#stage > .screen')];
      if (screens.length === 1 && !screens[0].classList.contains('title-screen')) break;
      if (Date.now() - t0 > 6000) break;
      await wait(80);
    }

    game.newRun(913377);
    Object.assign(game.data, { atk: 55, def: 42, maxHp: 480, hp: 480, agi: 22, luck: 16 });
    game.startBattle('normal', 4);
    const bs = ui?.battleScreen;
    if (!bs) throw new Error('没拿到 battleScreen');
    bs.speedMul = 0.35;                           // 演出快一点，诊断别磨时间
    const b = game.battle;
    b.enemy.maxHp = 5000; b.enemy.hp = 5000;      // 只顶血量：别让它中途被打死
    b.player.hp = b.player.maxHp = 480;
    // 等开场演出真的跑完再动界面。
    // 只等 busy 落下是不够的：startBattle() 早就把 battleStart / turnStart 排进事件队列了，
    // 而界面还没开始演的时候 busy 就是 false —— 这时候手工摆的 disp 会被随后到来的
    // battleStart（captureDisp）整份冲掉，量出来全是假象。
    // 判据用「日志里已经有『遭遇 XX！』」：那说明界面确实把开场演到了日志那一步。
    const hasLog = (kw) => [...document.querySelectorAll('.battle-log p')].some((n) => n.textContent.includes(kw));
    for (let i = 0; i < 300 && (bs.busy || !hasLog('遭遇')); i++) await wait(50);
    await wait(400);                              // 再把 turnStart 那一段让过去
    const chipOf = (key, st) => document.querySelector(`.fighter-${key === 'player' ? 'player' : 'enemy'} .status-chip[data-st="${st}"]`);
    const chipsOf = (key) => [...document.querySelectorAll(`.fighter-${key === 'player' ? 'player' : 'enemy'} .status-chip`)];

    /**
     * 截图模式：只摆姿势，不跑那套自检。
     *
     * 分开走是有原因的：截图用的是 --virtual-time-budget，整份自检要跑掉好几秒虚拟时间，
     * 预算一到期浏览器就截当前这一帧 —— 之前就是这么拍到一张「自检跑了一半」的图。
     */
    if (SHOT) {
      // 四颗胶囊分别停在四种状态上：入场光晕 / 层数弹跳+Δ / 净化白光 / 安静待着
      for (const key of ['player', 'enemy']) {
        for (const st of ['poison', 'toxic', 'burn', 'weak', 'bleed']) bs.disp[key][st] = 0;
        bs.refreshSide(key);
      }
      bs.disp.enemy.toxic = 2;
      bs.disp.enemy.burn = 1;
      bs.disp.player.poison = 3;
      bs.disp.player.weak = 2;
      bs.refreshSide('player');
      bs.refreshSide('enemy');
      await wait(500);
      bs.disp.player.poison = 4;                  // 变层数 → 弹跳 + Δ 角标
      bs.refreshSide('player');
      bs.disp.player.bleed = 1;                   // 新挂上 → 入场光晕
      bs.refreshSide('player');
      bs.disp.player.bleed = 0;                   // 马上要被净化 → 白光
      bs.markPurge('player');
      // 定格动画：把时间轴推到动画中段再暂停（不然截到的是动画跑完之后的静止样子）
      for (const node of document.querySelectorAll('.status-chip, .status-val, .status-delta')) {
        for (const a of node.getAnimations?.() ?? []) {
          try { a.currentTime = 140; a.pause(); } catch { /* 定格失败不影响截图 */ }
        }
      }
      /**
       * Δ 角标要手工补一颗。
       *
       * 它本来由 popDelta() 生成、760ms 后自己摘掉；而截图跑的是虚拟时间 ——
       * 虚拟时钟几毫秒就把那 760ms 走完了，角标早就被摘掉了（CSS 动画我暂停了，setTimeout 暂停不了）。
       * 这里按同一套类名补一颗、同样停在动画中段，纯粹是给截图看的。
       */
      const poisonChip = chipOf('player', 'poison');
      if (poisonChip) {
        poisonChip.querySelectorAll('.status-delta').forEach((n) => n.remove());
        const badge = document.createElement('span');
        badge.className = 'status-delta up';
        badge.textContent = '+1';
        badge.style.color = STATUS_INFO.poison.color;
        poisonChip.append(badge);
        for (const a of badge.getAnimations?.() ?? []) {
          try { a.currentTime = 140; a.pause(); } catch { /* 同上 */ }
        }
      }
      log('胶囊状态已就位（截图模式）：' + chipsOf('player').map((n) => `${n.textContent.trim()}${n.classList.contains('purge') ? '[净化]' : ''}`).join(' / '));
      log('CHIP_DONE');
      return;
    }

    ok(!bs.busy && hasLog('遭遇'), '开场演出已经收尾（busy 落下 + 日志有「遭遇」）', `turn=${b.turn}`);


    // ---------- ① 附加：新节点 + 入场动画 ----------
    log('① 新挂上的状态要「长出来」，不是凭空出现');
    bs.disp.player.poison = 2;
    bs.disp.player.weak = 1;
    bs.refreshSide('player');
    const p1 = chipOf('player', 'poison');
    ok(!!p1, '挂上中毒 2 层 → 出现胶囊', p1 ? `「${p1.textContent.trim()}」` : '（没有）');
    ok(!!chipOf('player', 'weak'), '同一次刷新里两个状态各一颗胶囊', chipsOf('player').map((n) => n.textContent.trim()).join(' / '));
    ok(running(p1).includes('chipIn'), '胶囊正在播入场动画 chipIn', running(p1).join(',') || '（没有动画在跑）');
    ok(p1.classList.contains('enter'), '入场类名挂在节点上（动画名可查）', p1.className);
    ok(getComputedStyle(p1).getPropertyValue('--chip').trim() === STATUS_INFO.poison.color,
      '胶囊带上了状态主题色（入场光晕按它上色）', getComputedStyle(p1).getPropertyValue('--chip').trim());

    // ---------- ② 幂等：数值没变就不该重播 ----------
    log('② 数值没变时重复刷新：同一个节点、动画不重播');
    p1.__mark = 'same-node';
    await wait(420);                              // 等入场动画跑完
    ok(running(p1).length === 0, '入场动画已经跑完', running(p1).join(',') || '（干净）');
    bs.refreshSide('player');
    const p2 = chipOf('player', 'poison');
    ok(p2 && p2.__mark === 'same-node', '刷新后还是**同一个** DOM 节点（以前是每次重建）');
    ok(running(p2).length === 0, '刷新不会重播入场动画（多段攻击时不会闪成一片）', running(p2).join(',') || '（干净）');

    // ---------- ③ 层数变化 ----------
    log('③ 层数变化：数字滑一下 + Δ 角标 + 胶囊弹一下');
    bs.applyEventToDisp({ type: 'status', side: 'player', status: 'poison', value: 3 });
    bs.refreshSide('player');
    const p3 = chipOf('player', 'poison');
    ok(p3 === p2, '层数变化还是同一个节点（只是数字变了）');
    ok(p3.querySelector('.status-val')?.textContent === '中毒 3', '数字更新成新层数', p3.querySelector('.status-val')?.textContent);
    ok(running(p3).includes('chipTickUp'), '胶囊在播「涨层数」的弹跳 chipTickUp', running(p3).join(','));
    ok(running(p3.querySelector('.status-val')).some((n) => n.startsWith('valUp')), '数字在往上滑（valUp）', running(p3.querySelector('.status-val')).join(','));
    const badge = p3.querySelector('.status-delta');
    ok(badge?.textContent === '+1', '弹出 Δ 角标 +1', badge?.textContent ?? '（没有）');

    // 掉层：方向要反过来
    bs.applyEventToDisp({ type: 'status', side: 'player', status: 'poison', value: 1 });
    bs.refreshSide('player');
    ok(running(chipOf('player', 'poison')).includes('chipTickDown'), '掉层数时播 chipTickDown（方向读得出来）', running(chipOf('player', 'poison')).join(','));
    ok(chipOf('player', 'poison').querySelector('.status-delta')?.textContent === '−2', 'Δ 角标跟着变成 −2');

    // ---------- ④ 归零：退场动画 ----------
    log('④ 层数归零（毒自己衰减完）：退场动画放完才摘节点');
    bs.applyEventToDisp({ type: 'status', side: 'player', status: 'poison', value: 0 });
    bs.refreshSide('player');
    const p4 = chipOf('player', 'poison');
    ok(!!p4, '刚归零时节点还在（不然就没有退场动画可看）');
    ok(p4?.classList.contains('out'), '节点带上了退场类名 out', p4?.className);
    ok(running(p4).includes('chipOut'), '退场动画 chipOut 正在跑', running(p4).join(','));
    await wait(600);
    ok(!chipOf('player', 'poison'), '动画放完之后节点真的被摘掉了（不会留在 DOM 里堆着）');
    ok(chipOf('player', 'weak'), '同一侧另一个状态不受影响（只走该走的那颗）');

    // 退场途中又被挂上：节点要被「救回来」，而不是变成两颗
    log('④b 退场途中又中了同一种状态：救回同一颗胶囊');
    bs.disp.player.burn = 0; bs.refreshSide('player');
    bs.disp.player.burn = 2; bs.refreshSide('player');
    const b1 = chipOf('player', 'burn');
    bs.disp.player.burn = 0; bs.refreshSide('player');
    ok(b1.classList.contains('out'), '先让它开始退场');
    bs.disp.player.burn = 2; bs.refreshSide('player');
    const b2 = chipOf('player', 'burn');
    ok(b2 === b1 && !b2.classList.contains('out'), '又挂上同一种毒 → 同一颗胶囊被救回来（没有重复的胶囊）');
    ok(chipsOf('player').filter((n) => n.dataset.st === 'burn').length === 1, 'burn 胶囊只有一颗', String(chipsOf('player').filter((n) => n.dataset.st === 'burn').length));
    await wait(400);

    // ---------- ⑤ 真打「白雾」：净化 ----------
    log('⑤ 真打一张「白雾」：日志 + 胶囊化掉');
    for (const p of [...document.querySelectorAll('.battle-log p')]) p.remove();
    b.player.poison = 3;
    b.player.toxic = 2;
    b.player.atkMod = -6;
    bs.resyncDisp();
    bs.refreshSide('player');
    ok(chipsOf('player').length >= 2, '净化前身上挂着毒', chipsOf('player').map((n) => n.textContent.trim()).join(' / '));
    b.decks.player.hand.push({ uid: 'diag-mist', card: CARD_BY_ID.mist });
    b.player.ap = Math.max(b.player.ap, 9);
    b.player.playsLeft = Math.max(b.player.playsLeft ?? 0, 3);
    const beforeLogs = document.querySelectorAll('.battle-log p').length;
    let purgeSeen = 0;
    const probe = setInterval(() => {
      if ([...document.querySelectorAll('.fighter-player .status-chip')].some((n) => n.classList.contains('purge'))) purgeSeen += 1;
    }, 25);
    await bs.playCard('diag-mist');
    clearInterval(probe);
    const logs = [...document.querySelectorAll('.battle-log p')].map((n) => n.textContent);
    ok(logs.length > beforeLogs, '出牌后有新的日志行', `${beforeLogs} → ${logs.length}`);
    ok(logs.some((t) => t.includes('清除了身上的削弱')), '日志里有「清除了身上的削弱」这行字（以前这条事件界面完全没处理，日志是丢的）',
      logs.filter((t) => t.includes('清除')).join(' ｜ ') || '（没有）');
    ok(b.player.poison === 0 && b.player.toxic === 0, '引擎里的毒被清掉了', `poison=${b.player.poison} toxic=${b.player.toxic}`);
    const leaving = chipsOf('player').filter((n) => n.dataset.st === 'poison' || n.dataset.st === 'toxic');
    ok(leaving.length > 0 && leaving.every((n) => n.classList.contains('out')),
      '出牌回来的那一刻，毒胶囊正在化掉（带着退场动画，不是凭空消失）',
      leaving.map((n) => `${n.textContent.trim()}${n.classList.contains('out') ? '[化掉中]' : '[还挂着]'}`).join(' / ') || '（一个都没有）');
    await wait(450);
    ok(chipsOf('player').filter((n) => n.dataset.st === 'poison' || n.dataset.st === 'toxic').length === 0,
      '退场动画放完之后，这几颗毒胶囊从界面上消失了（以前引擎清了、胶囊还挂到回合结束）',
      chipsOf('player').map((n) => n.textContent.trim()).join(' / ') || '（空了）');
    ok(purgeSeen > 0, '清掉之前先亮过白光（.purge，玩家看得见消失的是哪几个）', `采样到 ${purgeSeen} 次`);
    const atkChip = [...document.querySelectorAll('.fighter-player .stat-chips span')].find((n) => n.textContent.startsWith('攻'));
    ok(atkChip && !atkChip.querySelector('b').classList.contains('down'), '属性下降也一起从面板上清掉了', atkChip?.textContent ?? '（没找到）');

    // ---------- ⑥ 真打「剧毒爆发」：引爆 ----------
    log('⑥ 真打一张「剧毒爆发」：引爆同一套');
    b.enemy.poison = 4;
    b.enemy.toxic = 1;
    bs.resyncDisp();
    bs.refreshSide('enemy');
    ok(chipsOf('enemy').length >= 2, '引爆前对手身上挂着毒', chipsOf('enemy').map((n) => n.textContent.trim()).join(' / '));
    b.decks.player.hand.push({ uid: 'diag-venom', card: CARD_BY_ID.venom_burst });
    b.player.ap = Math.max(b.player.ap, 9);
    b.player.playsLeft = Math.max(b.player.playsLeft ?? 0, 3);
    await bs.playCard('diag-venom');
    const logs2 = [...document.querySelectorAll('.battle-log p')].map((n) => n.textContent);
    ok(logs2.some((t) => t.includes('引爆了')), '日志里有「引爆了 N 层持续伤害」（以前同样被打丢）',
      logs2.filter((t) => t.includes('引爆')).join(' ｜ ') || '（没有）');
    ok(b.enemy.poison === 0 && b.enemy.toxic === 0, '引擎里的毒层数被清空', `poison=${b.enemy.poison} toxic=${b.enemy.toxic}`);
    await wait(450);
    ok(chipsOf('enemy').filter((n) => n.dataset.st === 'poison' || n.dataset.st === 'toxic').length === 0,
      '对手身上的胶囊也一起化掉了', chipsOf('enemy').map((n) => n.textContent.trim()).join(' / ') || '（空了）');

    // ---------- ⑦ 没有专属演出的日志不再丢 ----------
    log('⑦ 引擎挂了日志、界面没写演出的事件（额外出牌次数）也要留话');
    const before = document.querySelectorAll('.battle-log p').length;
    b.decks.player.hand.push({ uid: 'diag-read', card: CARD_BY_ID.mind_reader });
    b.player.ap = Math.max(b.player.ap, 9);
    b.player.playsLeft = Math.max(b.player.playsLeft ?? 0, 3);
    await bs.playCard('diag-read');
    const logs3 = [...document.querySelectorAll('.battle-log p')].slice(before).map((n) => n.textContent);
    ok(logs3.some((t) => t.includes('出牌机会')), '「读心」多出来的出牌次数进了日志（这类事件以前一行都不显示）',
      logs3.join(' ｜ ') || '（一行都没有）');

    // ---------- ⑧ 反向测试：判据本身有没有牙 ----------
    log('⑧ 反向测试：把「整排清掉重建」的老写法装回去，节点同一性判据必须失效');
    bs.disp.player.burn = 2;
    bs.refreshSide('player');
    const held = chipOf('player', 'burn');
    ok(!!held, '先给玩家挂一层灼伤，拿到节点引用', held?.textContent.trim() ?? '（没挂上）');
    const realSync = bs.syncStatusChips.bind(bs);
    bs.syncStatusChips = (statusEl) => { while (statusEl.firstChild) statusEl.removeChild(statusEl.firstChild); };
    bs.refreshSide('player');
    ok(held && !held.isConnected, '老写法下手里那颗节点确实被换掉了 —— 说明前面「同一个节点」的判据真的能抓到回归（不是自说自话）');
    bs.syncStatusChips = realSync;
    bs.refreshSide('player');
    const cur = chipOf('player', 'burn');
    bs.refreshSide('player');
    ok(cur && chipOf('player', 'burn') === cur, '换回新写法之后节点又稳定了（判据不是靠运气过的）');


    if (fails.length) log(`CHIP_ERRORS=[${fails.join(' | ')}]`);
    else log('状态胶囊动画自检：通过 ✓');
    log('CHIP_DONE');
  } catch (e) {
    log('CHIP_FATAL ' + (e && e.stack ? e.stack.split('\n').slice(0, 6).join(' | ') : e));
    log('CHIP_DONE');
  }
})();
