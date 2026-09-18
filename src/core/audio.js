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

const buffers = new Map();
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

  play(name, { volume = 1, rate = 1, detune = 0 } = {}) {
    if (!this.enabled) return;
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
  cardPlay() { this.play('cardSlide2', { volume: 0.5 }); },
  cardDraw() { this.play('cardSlide', { volume: 0.32, rate: 1.15 }); },
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
