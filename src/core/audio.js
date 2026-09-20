// 音效：两套素材混用
//   1) Kenney（assets/audio/sfx/*.ogg）—— 界面点击之类的轻量提示音
//   2) PANICPUMPKIN / pansound.com（assets/audio/pansound/*.wav）—— 战斗与事件的主要音效
//
// PANICPUMPKIN 的授权：免费、可商用、可加工；无需使用报告，署名可选；
// 但禁止直链（所以素材是下载到本地的）和单独再分发素材集。
// 见 https://www.pansound.com/panicpumpkin/music/kiyaku.html
//
// WebAudio 需要用户首次交互后才能启动 AudioContext，这是浏览器策略。

import { music } from './bgm.js';

const SFX = {
  click: 'ui_click.ogg',
  click2: 'ui_click2.ogg',
  hover: 'ui_hover.ogg',
  confirm: 'ui_confirm.ogg',
  error: 'ui_error.ogg',
  open: 'ui_open.ogg',
  close: 'ui_close.ogg',
  switch: 'ui_switch.ogg',
  toggle: 'ui_toggle.ogg',
  pluck: 'ui_pluck.ogg',
  question: 'ui_question.ogg',
  bong: 'ui_bong.ogg',
  glitch: 'ui_glitch.ogg',
  maximize: 'ui_maximize.ogg',
  cardPlace: 'card_place.ogg',
  cardSlide: 'card_slide.ogg',
  cardSlide2: 'card_slide2.ogg',
  chips: 'chips.ogg',
  dice: 'dice.ogg',
  shuffle: 'shuffle.ogg',
  scratch: 'scratch.ogg',
  glass: 'glass.ogg',
  drop: 'drop.ogg',
};

/** PANICPUMPKIN 的音效（wav） */
const PS = {
  ui_confirm: 'ui_confirm.wav',
  ui_confirm_big: 'ui_confirm_big.wav',
  ui_cancel: 'ui_cancel.wav',
  ui_cursor: 'ui_cursor.wav',
  ui_error: 'ui_error.wav',
  ui_open_menu: 'ui_open_menu.wav',
  hit_normal: 'hit_normal.wav',
  hit_hard: 'hit_hard.wav',
  hit_sword: 'hit_sword.wav',
  hit_miss: 'hit_miss.wav',
  enemy_down: 'enemy_down.wav',
  magic_fire: 'magic_fire.wav',
  magic_quake: 'magic_quake.wav',
  magic_rock: 'magic_rock.wav',
  magic_wind: 'magic_wind.wav',
  magic_bolt: 'magic_bolt.wav',
  magic_heal: 'magic_heal.wav',
  magic_shield: 'magic_shield.wav',
  buff_up: 'buff_up.wav',
  buff_down: 'buff_down.wav',
  status_poison: 'status_poison.wav',
  status_burn: 'status_burn.wav',
  status_dizzy: 'status_dizzy.wav',
  chest_open: 'chest_open.wav',
  item_rare: 'item_rare.wav',
  item_use: 'item_use.wav',
  coin: 'coin.wav',
  trap: 'trap.wav',
  heal_event: 'heal_event.wav',
  lucky: 'lucky.wav',
  surprise: 'surprise.wav',
};

/**
 * 战斗里会响的音效名。
 *
 * 为什么要专门列一份：`play(name)` 的链路是 **fetch → decodeAudioData → src.start()**，
 * 所以每一个音效**第一次响**都得先等一次网络往返 + 解码 —— 听感上就是
 * 「点下第一张攻击卡，挥剑声比动画慢半拍」。遭遇演出（src/ui/encounter.js）
 * 的停留阶段会拿那段时间把这批全部预热成 AudioBuffer，进战斗后第一击就是准点的。
 *
 * 这份表不靠人肉维护：tools/diag-encounter.js 会真打一场，把 audio 实际响过的名字
 * 全部记下来逐个比对 —— 谁往战斗里加了新音效却忘了写进来，诊断就会红。
 */
export const BATTLE_SFX = [
  // 出牌 / 抽牌 / 洗牌（cardPlace = 卡牌落桌那一下，出牌音效就是它）
  'cardPlace', 'cardSlide', 'cardSlide2', 'shuffle',
  // 命中与闪避
  'hit_normal', 'hit_hard', 'hit_sword', 'hit_miss', 'enemy_down',
  // 属性招式
  'magic_fire', 'magic_quake', 'magic_rock', 'magic_wind', 'magic_bolt',
  'magic_heal', 'magic_shield', 'buff_up', 'buff_down',
  // 状态
  'status_poison', 'status_burn', 'status_dizzy',
  // 界面（战斗里也会响：点不动、结束回合、胜利、失败、销毁碎裂）
  'glass', 'click2', 'ui_cancel', 'ui_confirm_big', 'ui_error',
];

/** 遭遇演出自己用的音效：划入的风声 + 横线张开的那一下 */
export const ENCOUNTER_SFX = ['magic_wind', 'maximize'];

const buffers = new Map();
/** 本次会话真正播放过的音效名（诊断用：和 BATTLE_SFX 对一遍，看有没有漏预载的） */
const played = new Set();
let ctx = null;
let master = null;
let musicGain = null;
let sfxGain = null;
let unlocked = false;

/** 某个名字对应哪个目录下的哪个文件 */
function fileOf(name) {
  if (SFX[name]) return { dir: 'sfx', file: SFX[name] };
  if (PS[name]) return { dir: 'pansound', file: PS[name] };
  return null;
}

export const audio = {
  enabled: true,
  sfxVolume: 0.6,
  musicVolume: 0.32,
  pendingTrack: null,

  get ctx() { return ctx; },
  get master() { return master; },
  get musicGain() { return musicGain; },

  init() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 1;
    master.connect(ctx.destination);
    sfxGain = ctx.createGain();
    sfxGain.gain.value = this.sfxVolume;
    sfxGain.connect(master);
    musicGain = ctx.createGain();
    musicGain.gain.value = this.musicVolume;
    musicGain.connect(master);
    // BGM 也接进同一个 AudioContext：bgm.js 会把 ogg 解成 AudioBuffer 用 loop=true
    // 播放（采样精确的无缝循环），音量由 music.volume 自己的 GainNode 管；
    // musicGain 这条总线留给环境音（风声），跟着音乐音量一起调。
    music.attach(ctx, master);
  },

  unlock() {
    this.init();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();
    unlocked = true;
    this.startAmbience();
    music.setVolume(this.musicVolume);
    // 解锁后如果已经排队了某首曲子，就补播
    if (this.pendingTrack) {
      const t = this.pendingTrack;
      this.pendingTrack = null;
      music.play(t);
    }
  },

  /**
   * 场景 BGM。首次交互前调用会先排队，等解锁后自动补播。
   * @param {string} key bgm.js 里 BGM_FILES 的键
   */
  playBgm(key, opts = {}) {
    if (!this.enabled || !key) return;
    music.setVolume(this.musicVolume);
    if (!unlocked) { this.pendingTrack = key; return; }
    music.play(key, opts);
  },

  stopBgm() {
    music.stop();
  },

  /**
   * 「回到当前场景该放的那首曲子」的钩子，由 ui.js 在初始化时挂上来。
   *
   * 为什么不直接调 ui.render()：ui.js -> screens.js -> music-room.js 已经是一条链，
   * 音乐室再反向 import ui.js 就成了环（ESM 能跑，但谁先初始化会变成运气问题）。
   * 音乐室关掉时调它，重新走一遍 render 里那段「按 phase 选曲」的逻辑 ——
   * 否则在地图上开音乐室试听、关掉之后，地图上还在放那首试听的曲子。
   */
  onSceneBgm: null,
  resumeSceneBgm() {
    try { this.onSceneBgm?.(); } catch { /* 钩子出错不该让弹窗关不掉 */ }
  },

  async load(name) {
    this.init();
    if (!ctx) return null;
    if (buffers.has(name)) return buffers.get(name);
    const found = fileOf(name);
    if (!found) return null;
    const p = fetch(`assets/audio/${found.dir}/${found.file}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.arrayBuffer();
      })
      .then((ab) => ctx.decodeAudioData(ab))
      // 用 file:// 双击打开时浏览器会拦掉本地音频请求；此时静默降级成无声，
      // 不影响游戏本体（想听音效就用 tools/serve.mjs 起本地服务器）
      .catch(() => null);
    buffers.set(name, p);
    return p;
  },

  /**
   * 预载一批音效（只加载 + 解码，**不播放**）。
   *
   * 单个音效失败也算「处理完」——load() 内部已经 catch 成 null，
   * 这里再兜一层，免得一个坏文件把整批预载卡住。
   * 返回的 Promise 兑现时，这一批已经能立刻播了（或已确认放不出来）。
   */
  warm(names = []) {
    return Promise.all([].concat(names).map((n) => this.load(n).catch(() => null)));
  },

  /** 已经**解码好**（可以立刻播）的音效名。诊断用：验证预载真的完成了，而不只是排上了队 */
  async warmed() {
    const out = [];
    for (const [name, p] of buffers) {
      const buf = await p.catch(() => null);
      if (buf) out.push(name);
    }
    return out;
  },

  /** 本次会话真正播放过的音效名 */
  playedNames() { return [...played]; },

  play(name, { volume = 1, rate = 1, detune = 0 } = {}) {
    if (!this.enabled) return;
    played.add(name);
    this.init();
    if (!ctx || !unlocked) return;
    this.load(name).then((buf) => {
      if (!buf || !this.enabled) return;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.playbackRate.value = rate;
      if (detune) src.detune.value = detune;
      const g = ctx.createGain();
      g.gain.value = volume;
      src.connect(g);
      g.connect(sfxGain);
      src.start();
    });
  },

  // ---- 语义化音效 ----
  ui(name = 'click') { this.play(name, { volume: 0.7 }); },

  /** 攻击命中：power 0~1 决定用普通音还是重击音 */
  /**
   * 出牌音效：按卡牌类型挑，让「撞击」和「地震」听起来不一样
   */

  cardSound(card) {
    if (!card) return this.cardPlay();
    const id = card.id;
    if (['harden', 'iron_defense', 'protect', 'endure'].includes(id)) return this.shieldUp();
    if (['roost', 'potion_berry', 'first_aid'].includes(id)) return this.heal();
    if (id === 'toxic') return this.poison();
    if (['fire_fang', 'heat_wave'].includes(id)) return this.flame();
    if (['earthquake', 'fissure'].includes(id)) return this.quake();
    if (['rock_throw', 'rock_slide', 'rock_blast'].includes(id)) return this.rock();
    if (['sandstorm', 'sand_attack'].includes(id)) return this.wind();
    if (['focus_energy', 'dragon_dance', 'bulk_up', 'screech'].includes(id)) return this.buffUp();
    if (['bug_buzz', 'u_turn', 'quick_attack'].includes(id)) return this.cardPlay();
    const hasDamage = card.effects?.some((e) => e.kind === 'damage');
    return hasDamage ? this.attackCard() : this.cardPlay();
  },

  hit(power = 1) {
    const name = power > 0.75 ? 'hit_hard' : 'hit_normal';
    this.play(name, { volume: 0.42 + power * 0.28 });
  },
  /** 物理攻击（卡牌是「攻击」类） */
  attackCard() { this.play('hit_sword', { volume: 0.45 }); },
  /** 属性/法术类卡牌 */
  castCard() { this.play('magic_bolt', { volume: 0.35 }); },
  /** 地震 / 落石这类地面招式 */
  quake() { this.play('magic_quake', { volume: 0.42 }); },
  rock() { this.play('magic_rock', { volume: 0.42 }); },
  flame() { this.play('magic_fire', { volume: 0.38 }); },
  wind() { this.play('magic_wind', { volume: 0.38 }); },
  hurt() { this.play('hit_normal', { volume: 0.5, rate: 0.9 }); },
  miss() { this.play('hit_miss', { volume: 0.5 }); },
  down() { this.play('enemy_down', { volume: 0.6 }); },
  shieldUp() { this.play('magic_shield', { volume: 0.45 }); },
  heal() { this.play('magic_heal', { volume: 0.5 }); },
  buffUp() { this.play('buff_up', { volume: 0.5 }); },
  buffDown() { this.play('buff_down', { volume: 0.45 }); },
  poison() { this.play('status_poison', { volume: 0.45 }); },
  burn() { this.play('status_burn', { volume: 0.45 }); },
  dizzy() { this.play('status_dizzy', { volume: 0.45 }); },
  chest() { this.play('chest_open', { volume: 0.6 }); },
  rare() { this.play('item_rare', { volume: 0.6 }); },
  useItem() { this.play('item_use', { volume: 0.55 }); },
  /**
   * 出牌：卡牌**拍在桌上**的那一下（Kenney 制图/桌游包的 cardPlace）。
   *
   * 以前用的是 cardSlide2（滑牌声）—— 那是「把牌推过去」的声音，音量还只有 0.5，
   * 压在命中音效（0.4~0.6）底下基本听不见，玩家的感受就是「出牌没音效」。
   * 现在换成落桌声 + 单独混一层很轻的滑牌，既有「啪」又有「刷」。
   */
  cardPlay() {
    // 音量按**实测**定：这两个文件本身比战斗音效低 5~7 dB（cardPlace −10.6 / hit_sword −5.0 dBFS），
    // 所以这里给得比别的音效高一点，混起来才是同一个量级（见 tools/diag-cardsound.js）。
    this.play('cardPlace', { volume: 0.75 });
    this.play('cardSlide2', { volume: 0.34 });
  },
  /** 抽到一张牌：滑牌声（音量提到 0.6 —— 原来那 0.32 实测几乎听不见） */
  cardDraw() { this.play('cardSlide', { volume: 0.6, rate: 1.08 }); },
  /**
   * 发一批牌：按张数放 1~3 声滑牌，间隔 70ms。
   * 引擎的 `draw` 事件是**一批一次**（`cards` 里是这一批抽到的牌），
   * 一次抽 7 张只响一声会显得很假，连响几下才像在发牌；超过 3 张就不再叠加，免得糊成噪音。
   */
  dealCards(n = 1) {
    const times = Math.max(1, Math.min(3, n));
    for (let i = 0; i < times; i += 1) {
      if (i === 0) this.cardDraw();
      else setTimeout(() => this.cardDraw(), i * 70);
    }
  },
  shuffle() { this.play('shuffle', { volume: 0.5 }); },
  win() { this.play('ui_confirm_big', { volume: 0.7 }); },
  lose() { this.play('ui_error', { volume: 0.6, rate: 0.85 }); },
  coin() { this.play('coin', { volume: 0.5 }); },
  reveal() { this.play('lucky', { volume: 0.5 }); },
  bad() { this.play('ui_cancel', { volume: 0.6 }); },
  /** 删卡（商店的卡牌移除服务）：洗牌声 + 确认音，玩家能听出「这张牌真的没了」 */
  removeCard() { this.play('shuffle', { volume: 0.5 }); this.play('ui_confirm', { volume: 0.65 }); },
  move() { this.play('ui_cursor', { volume: 0.5 }); },
  trap() { this.play('trap', { volume: 0.55 }); },
  surprise() { this.play('surprise', { volume: 0.5 }); },

  // ---- 环境音：用噪声做一个很轻的沙漠风声 ----
  startAmbience() {
    if (!ctx || this._amb) return;
    const noise = ctx.createBufferSource();
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      d[i] = last * 3.5;
    }
    noise.buffer = buf;
    noise.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 420;
    const g = ctx.createGain();
    g.gain.value = 0.0;
    noise.connect(lp);
    lp.connect(g);
    g.connect(musicGain);
    noise.start();
    g.gain.linearRampToValueAtTime(0.18, ctx.currentTime + 3);
    this._amb = { noise, g };
  },

  setSfxVolume(v) {
    this.sfxVolume = v;
    if (sfxGain) sfxGain.gain.value = v;
  },
  setMusicVolume(v) {
    this.musicVolume = v;
    if (musicGain) musicGain.gain.value = v;
    music.setVolume(v);
  },
  toggle() {
    this.enabled = !this.enabled;
    if (master) master.gain.value = this.enabled ? 1 : 0;
    music.setEnabled(this.enabled);
    if (this.enabled && this.pendingTrack) {
      const t = this.pendingTrack;
      this.pendingTrack = null;
      this.playBgm(t);
    }
    return this.enabled;
  },

  /** 调试用：看看两套音效各加载了什么 */
  status() {
    return {
      unlocked,
      ctxState: ctx ? ctx.state : 'none',
      kenney: Object.keys(SFX).length,
      pansound: Object.keys(PS).length,
      cached: buffers.size,
    };
  },
};
