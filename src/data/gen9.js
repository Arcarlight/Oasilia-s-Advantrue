// 本文件由 tools/import-gen9.mjs 生成，请勿手改。
//
// 每只宝可梦的回合切换立绘：front = 正面（敌方用），back = 背面（我方用，和正作一样看自己人的后背）。
// front.png / back.png 已经**按可见内容裁到包围盒**，所以界面只要按 w/h 的宽高比缩放到目标框里就行，
// 不需要再算偏移；canvas/box 是裁切前的原始画布与包围盒，留给诊断脚本核对。

/** @type {Record<string, {front: Gen9Sprite, back: Gen9Sprite}>} */
export const GEN9_ART = {
  weedle: {
    front: { w: 60, h: 78, canvas: { w: 192, h: 192 }, box: { x: 68, y: 60, w: 56, h: 74 } },
    back: { w: 112, h: 118, canvas: { w: 288, h: 288 }, box: { x: 81, y: 81, w: 108, h: 114 } },
  },
  beedrill: {
    front: { w: 128, h: 122, canvas: { w: 192, h: 192 }, box: { x: 30, y: 38, w: 124, h: 118 } },
    back: { w: 184, h: 181, canvas: { w: 288, h: 288 }, box: { x: 60, y: 57, w: 180, h: 177 } },
  },
  pidgey: {
    front: { w: 78, h: 86, canvas: { w: 192, h: 192 }, box: { x: 62, y: 54, w: 74, h: 82 } },
    back: { w: 124, h: 124, canvas: { w: 288, h: 288 }, box: { x: 84, y: 78, w: 120, h: 120 } },
  },
  fearow: {
    front: { w: 168, h: 148, canvas: { w: 192, h: 192 }, box: { x: 6, y: 16, w: 164, h: 144 } },
    back: { w: 214, h: 235, canvas: { w: 288, h: 288 }, box: { x: 39, y: 30, w: 210, h: 231 } },
  },
  arbok: {
    front: { w: 126, h: 134, canvas: { w: 192, h: 192 }, box: { x: 20, y: 28, w: 122, h: 130 } },
    back: { w: 193, h: 202, canvas: { w: 288, h: 288 }, box: { x: 48, y: 45, w: 189, h: 198 } },
  },
  raichu: {
    front: { w: 130, h: 126, canvas: { w: 192, h: 192 }, box: { x: 20, y: 32, w: 126, h: 122 } },
    back: { w: 193, h: 199, canvas: { w: 288, h: 288 }, box: { x: 54, y: 48, w: 189, h: 195 } },
  },
  sandshrew: {
    front: { w: 74, h: 82, canvas: { w: 192, h: 192 }, box: { x: 64, y: 54, w: 70, h: 78 } },
    back: { w: 124, h: 118, canvas: { w: 288, h: 288 }, box: { x: 69, y: 84, w: 120, h: 114 } },
  },
  sandslash: {
    front: { w: 110, h: 102, canvas: { w: 192, h: 192 }, box: { x: 42, y: 44, w: 106, h: 98 } },
    back: { w: 160, h: 148, canvas: { w: 288, h: 288 }, box: { x: 69, y: 72, w: 156, h: 144 } },
  },
  oddish: {
    front: { w: 72, h: 74, canvas: { w: 192, h: 192 }, box: { x: 62, y: 64, w: 68, h: 70 } },
    back: { w: 118, h: 112, canvas: { w: 288, h: 288 }, box: { x: 87, y: 90, w: 114, h: 108 } },
  },
  gloom: {
    front: { w: 102, h: 94, canvas: { w: 192, h: 192 }, box: { x: 42, y: 52, w: 98, h: 90 } },
    back: { w: 148, h: 139, canvas: { w: 288, h: 288 }, box: { x: 72, y: 78, w: 144, h: 135 } },
  },
  vileplume: {
    front: { w: 116, h: 102, canvas: { w: 192, h: 192 }, box: { x: 32, y: 50, w: 112, h: 98 } },
    back: { w: 172, h: 148, canvas: { w: 288, h: 288 }, box: { x: 60, y: 75, w: 168, h: 144 } },
  },
  paras: {
    front: { w: 94, h: 78, canvas: { w: 192, h: 192 }, box: { x: 40, y: 54, w: 90, h: 74 } },
    back: { w: 145, h: 100, canvas: { w: 288, h: 288 }, box: { x: 75, y: 96, w: 141, h: 96 } },
  },
  parasect: {
    front: { w: 114, h: 118, canvas: { w: 192, h: 192 }, box: { x: 38, y: 40, w: 110, h: 114 } },
    back: { w: 184, h: 160, canvas: { w: 288, h: 288 }, box: { x: 54, y: 66, w: 180, h: 156 } },
  },
  arcanine: {
    front: { w: 144, h: 142, canvas: { w: 192, h: 192 }, box: { x: 26, y: 30, w: 140, h: 138 } },
    back: { w: 205, h: 208, canvas: { w: 288, h: 288 }, box: { x: 51, y: 57, w: 201, h: 204 } },
  },
  machop: {
    front: { w: 104, h: 104, canvas: { w: 192, h: 192 }, box: { x: 44, y: 46, w: 100, h: 100 } },
    back: { w: 157, h: 157, canvas: { w: 288, h: 288 }, box: { x: 66, y: 72, w: 153, h: 153 } },
  },
  machoke: {
    front: { w: 116, h: 142, canvas: { w: 192, h: 192 }, box: { x: 36, y: 26, w: 112, h: 138 } },
    back: { w: 175, h: 208, canvas: { w: 288, h: 288 }, box: { x: 60, y: 42, w: 171, h: 204 } },
  },
  machamp: {
    front: { w: 130, h: 140, canvas: { w: 192, h: 192 }, box: { x: 28, y: 30, w: 126, h: 136 } },
    back: { w: 205, h: 211, canvas: { w: 288, h: 288 }, box: { x: 51, y: 51, w: 201, h: 207 } },
  },
  bellsprout: {
    front: { w: 78, h: 92, canvas: { w: 192, h: 192 }, box: { x: 58, y: 52, w: 74, h: 88 } },
    back: { w: 130, h: 142, canvas: { w: 288, h: 288 }, box: { x: 75, y: 75, w: 126, h: 138 } },
  },
  tentacool: {
    front: { w: 104, h: 110, canvas: { w: 192, h: 192 }, box: { x: 46, y: 44, w: 100, h: 106 } },
    back: { w: 154, h: 163, canvas: { w: 288, h: 288 }, box: { x: 63, y: 66, w: 150, h: 159 } },
  },
  tentacruel: {
    front: { w: 146, h: 130, canvas: { w: 192, h: 192 }, box: { x: 4, y: 38, w: 142, h: 126 } },
    back: { w: 223, h: 190, canvas: { w: 288, h: 288 }, box: { x: 36, y: 51, w: 219, h: 186 } },
  },
  geodude: {
    front: { w: 116, h: 52, canvas: { w: 192, h: 192 }, box: { x: 42, y: 70, w: 112, h: 48 } },
    back: { w: 175, h: 88, canvas: { w: 288, h: 288 }, box: { x: 69, y: 105, w: 171, h: 84 } },
  },
  graveler: {
    front: { w: 138, h: 92, canvas: { w: 192, h: 192 }, box: { x: 26, y: 52, w: 134, h: 88 } },
    back: { w: 199, h: 130, canvas: { w: 288, h: 288 }, box: { x: 57, y: 78, w: 195, h: 126 } },
  },
  golem: {
    front: { w: 134, h: 118, canvas: { w: 192, h: 192 }, box: { x: 26, y: 44, w: 130, h: 114 } },
    back: { w: 202, h: 169, canvas: { w: 288, h: 288 }, box: { x: 45, y: 63, w: 198, h: 165 } },
  },
  magnemite: {
    front: { w: 74, h: 52, canvas: { w: 192, h: 192 }, box: { x: 62, y: 72, w: 70, h: 48 } },
    back: { w: 109, h: 76, canvas: { w: 288, h: 288 }, box: { x: 93, y: 108, w: 105, h: 72 } },
  },
  grimer: {
    front: { w: 110, h: 78, canvas: { w: 192, h: 192 }, box: { x: 38, y: 58, w: 106, h: 74 } },
    back: { w: 154, h: 121, canvas: { w: 288, h: 288 }, box: { x: 66, y: 87, w: 150, h: 117 } },
  },
  shellder: {
    front: { w: 76, h: 66, canvas: { w: 192, h: 192 }, box: { x: 60, y: 66, w: 72, h: 62 } },
    back: { w: 115, h: 85, canvas: { w: 288, h: 288 }, box: { x: 84, y: 105, w: 111, h: 81 } },
  },
  cloyster: {
    front: { w: 126, h: 128, canvas: { w: 192, h: 192 }, box: { x: 28, y: 30, w: 122, h: 124 } },
    back: { w: 181, h: 172, canvas: { w: 288, h: 288 }, box: { x: 57, y: 60, w: 177, h: 168 } },
  },
  gastly: {
    front: { w: 134, h: 114, canvas: { w: 192, h: 192 }, box: { x: 32, y: 42, w: 130, h: 110 } },
    back: { w: 184, h: 172, canvas: { w: 288, h: 288 }, box: { x: 42, y: 54, w: 180, h: 168 } },
  },
  gengar: {
    front: { w: 120, h: 116, canvas: { w: 192, h: 192 }, box: { x: 34, y: 40, w: 116, h: 112 } },
    back: { w: 169, h: 166, canvas: { w: 288, h: 288 }, box: { x: 63, y: 63, w: 165, h: 162 } },
  },
  onix: {
    front: { w: 148, h: 150, canvas: { w: 192, h: 192 }, box: { x: 26, y: 22, w: 144, h: 146 } },
    back: { w: 288, h: 214, canvas: { w: 288, h: 288 }, box: { x: 1, y: 39, w: 287, h: 210 } },
  },
  kingler: {
    front: { w: 158, h: 122, canvas: { w: 192, h: 192 }, box: { x: 22, y: 38, w: 154, h: 118 } },
    back: { w: 241, h: 190, canvas: { w: 288, h: 288 }, box: { x: 27, y: 48, w: 237, h: 186 } },
  },
  electrode: {
    front: { w: 92, h: 96, canvas: { w: 192, h: 192 }, box: { x: 52, y: 50, w: 88, h: 92 } },
    back: { w: 136, h: 142, canvas: { w: 288, h: 288 }, box: { x: 78, y: 75, w: 132, h: 138 } },
  },
  cubone: {
    front: { w: 86, h: 82, canvas: { w: 192, h: 192 }, box: { x: 44, y: 54, w: 82, h: 78 } },
    back: { w: 133, h: 121, canvas: { w: 288, h: 288 }, box: { x: 81, y: 84, w: 129, h: 117 } },
  },
  rhyhorn: {
    front: { w: 132, h: 112, canvas: { w: 192, h: 192 }, box: { x: 28, y: 42, w: 128, h: 108 } },
    back: { w: 211, h: 166, canvas: { w: 288, h: 288 }, box: { x: 51, y: 69, w: 207, h: 162 } },
  },
  rhydon: {
    front: { w: 150, h: 130, canvas: { w: 192, h: 192 }, box: { x: 20, y: 36, w: 146, h: 126 } },
    back: { w: 229, h: 190, canvas: { w: 288, h: 288 }, box: { x: 33, y: 51, w: 225, h: 186 } },
  },
  pinsir: {
    front: { w: 136, h: 126, canvas: { w: 192, h: 192 }, box: { x: 12, y: 30, w: 132, h: 122 } },
    back: { w: 211, h: 187, canvas: { w: 288, h: 288 }, box: { x: 42, y: 54, w: 207, h: 183 } },
  },
  gyarados: {
    front: { w: 166, h: 158, canvas: { w: 192, h: 192 }, box: { x: 10, y: 18, w: 162, h: 154 } },
    back: { w: 277, h: 235, canvas: { w: 288, h: 288 }, box: { x: 9, y: 21, w: 273, h: 231 } },
  },
  lapras: {
    front: { w: 140, h: 136, canvas: { w: 192, h: 192 }, box: { x: 34, y: 30, w: 136, h: 132 } },
    back: { w: 229, h: 217, canvas: { w: 288, h: 288 }, box: { x: 33, y: 36, w: 225, h: 213 } },
  },
  aerodactyl: {
    front: { w: 162, h: 122, canvas: { w: 192, h: 192 }, box: { x: 12, y: 34, w: 158, h: 118 } },
    back: { w: 241, h: 205, canvas: { w: 288, h: 288 }, box: { x: 27, y: 45, w: 237, h: 201 } },
  },
  ledian: {
    front: { w: 90, h: 110, canvas: { w: 192, h: 192 }, box: { x: 54, y: 42, w: 86, h: 106 } },
    back: { w: 124, h: 157, canvas: { w: 288, h: 288 }, box: { x: 84, y: 66, w: 120, h: 153 } },
  },
  ariados: {
    front: { w: 116, h: 102, canvas: { w: 192, h: 192 }, box: { x: 30, y: 46, w: 112, h: 98 } },
    back: { w: 172, h: 133, canvas: { w: 288, h: 288 }, box: { x: 48, y: 81, w: 168, h: 129 } },
  },
  mareep: {
    front: { w: 86, h: 82, canvas: { w: 192, h: 192 }, box: { x: 54, y: 64, w: 82, h: 78 } },
    back: { w: 130, h: 124, canvas: { w: 288, h: 288 }, box: { x: 78, y: 93, w: 126, h: 120 } },
  },
  ampharos: {
    front: { w: 114, h: 136, canvas: { w: 192, h: 192 }, box: { x: 48, y: 28, w: 110, h: 132 } },
    back: { w: 166, h: 193, canvas: { w: 288, h: 288 }, box: { x: 57, y: 48, w: 162, h: 189 } },
  },
  quagsire: {
    front: { w: 122, h: 108, canvas: { w: 192, h: 192 }, box: { x: 38, y: 50, w: 118, h: 104 } },
    back: { w: 190, h: 166, canvas: { w: 288, h: 288 }, box: { x: 51, y: 63, w: 186, h: 162 } },
  },
  unown: {
    front: { w: 40, h: 72, canvas: { w: 192, h: 192 }, box: { x: 78, y: 62, w: 36, h: 68 } },
    back: { w: 58, h: 106, canvas: { w: 288, h: 288 }, box: { x: 117, y: 93, w: 54, h: 102 } },
  },
  gligar: {
    front: { w: 122, h: 106, canvas: { w: 192, h: 192 }, box: { x: 36, y: 42, w: 118, h: 102 } },
    back: { w: 175, h: 169, canvas: { w: 288, h: 288 }, box: { x: 66, y: 60, w: 171, h: 165 } },
  },
  steelix: {
    front: { w: 166, h: 152, canvas: { w: 192, h: 192 }, box: { x: 10, y: 24, w: 162, h: 148 } },
    back: { w: 244, h: 241, canvas: { w: 288, h: 288 }, box: { x: 24, y: 27, w: 240, h: 237 } },
  },
  scizor: {
    front: { w: 140, h: 150, canvas: { w: 192, h: 192 }, box: { x: 30, y: 28, w: 136, h: 146 } },
    back: { w: 187, h: 226, canvas: { w: 288, h: 288 }, box: { x: 57, y: 33, w: 183, h: 222 } },
  },
  heracross: {
    front: { w: 120, h: 130, canvas: { w: 192, h: 192 }, box: { x: 40, y: 24, w: 116, h: 126 } },
    back: { w: 193, h: 199, canvas: { w: 288, h: 288 }, box: { x: 63, y: 33, w: 189, h: 195 } },
  },
  slugma: {
    front: { w: 72, h: 84, canvas: { w: 192, h: 192 }, box: { x: 70, y: 58, w: 68, h: 80 } },
    back: { w: 85, h: 130, canvas: { w: 288, h: 288 }, box: { x: 99, y: 72, w: 81, h: 126 } },
  },
  magcargo: {
    front: { w: 104, h: 116, canvas: { w: 192, h: 192 }, box: { x: 46, y: 40, w: 100, h: 112 } },
    back: { w: 139, h: 178, canvas: { w: 288, h: 288 }, box: { x: 72, y: 42, w: 135, h: 174 } },
  },
  remoraid: {
    front: { w: 76, h: 76, canvas: { w: 192, h: 192 }, box: { x: 60, y: 60, w: 72, h: 72 } },
    back: { w: 133, h: 145, canvas: { w: 288, h: 288 }, box: { x: 69, y: 87, w: 129, h: 141 } },
  },
  mantine: {
    front: { w: 150, h: 114, canvas: { w: 192, h: 192 }, box: { x: 24, y: 40, w: 146, h: 110 } },
    back: { w: 244, h: 157, canvas: { w: 288, h: 288 }, box: { x: 24, y: 63, w: 240, h: 153 } },
  },
  skarmory: {
    front: { w: 136, h: 140, canvas: { w: 192, h: 192 }, box: { x: 26, y: 28, w: 132, h: 136 } },
    back: { w: 241, h: 193, canvas: { w: 288, h: 288 }, box: { x: 27, y: 57, w: 237, h: 189 } },
  },
  kingdra: {
    front: { w: 112, h: 136, canvas: { w: 192, h: 192 }, box: { x: 42, y: 30, w: 108, h: 132 } },
    back: { w: 145, h: 211, canvas: { w: 288, h: 288 }, box: { x: 75, y: 42, w: 141, h: 207 } },
  },
  elekid: {
    front: { w: 90, h: 84, canvas: { w: 192, h: 192 }, box: { x: 48, y: 56, w: 86, h: 80 } },
    back: { w: 142, h: 124, canvas: { w: 288, h: 288 }, box: { x: 72, y: 75, w: 138, h: 120 } },
  },
  larvitar: {
    front: { w: 72, h: 92, canvas: { w: 192, h: 192 }, box: { x: 62, y: 56, w: 68, h: 88 } },
    back: { w: 97, h: 136, canvas: { w: 288, h: 288 }, box: { x: 87, y: 72, w: 93, h: 132 } },
  },
  pupitar: {
    front: { w: 76, h: 90, canvas: { w: 192, h: 192 }, box: { x: 56, y: 54, w: 72, h: 86 } },
    back: { w: 106, h: 139, canvas: { w: 288, h: 288 }, box: { x: 90, y: 72, w: 102, h: 135 } },
  },
  tyranitar: {
    front: { w: 158, h: 156, canvas: { w: 192, h: 192 }, box: { x: 20, y: 20, w: 154, h: 152 } },
    back: { w: 205, h: 235, canvas: { w: 288, h: 288 }, box: { x: 18, y: 30, w: 201, h: 231 } },
  },
  treecko: {
    front: { w: 86, h: 94, canvas: { w: 192, h: 192 }, box: { x: 54, y: 52, w: 82, h: 90 } },
    back: { w: 136, h: 142, canvas: { w: 288, h: 288 }, box: { x: 78, y: 75, w: 132, h: 138 } },
  },
  sceptile: {
    front: { w: 132, h: 146, canvas: { w: 192, h: 192 }, box: { x: 32, y: 24, w: 128, h: 142 } },
    back: { w: 199, h: 235, canvas: { w: 288, h: 288 }, box: { x: 45, y: 30, w: 195, h: 231 } },
  },
  marshtomp: {
    front: { w: 104, h: 116, canvas: { w: 192, h: 192 }, box: { x: 46, y: 40, w: 100, h: 112 } },
    back: { w: 145, h: 178, canvas: { w: 288, h: 288 }, box: { x: 78, y: 57, w: 141, h: 174 } },
  },
  beautifly: {
    front: { w: 120, h: 104, canvas: { w: 192, h: 192 }, box: { x: 38, y: 46, w: 116, h: 100 } },
    back: { w: 184, h: 169, canvas: { w: 288, h: 288 }, box: { x: 54, y: 60, w: 180, h: 165 } },
  },
  taillow: {
    front: { w: 84, h: 76, canvas: { w: 192, h: 192 }, box: { x: 56, y: 60, w: 80, h: 72 } },
    back: { w: 139, h: 106, canvas: { w: 288, h: 288 }, box: { x: 75, y: 90, w: 135, h: 102 } },
  },
  masquerain: {
    front: { w: 130, h: 120, canvas: { w: 192, h: 192 }, box: { x: 34, y: 38, w: 126, h: 116 } },
    back: { w: 172, h: 178, canvas: { w: 288, h: 288 }, box: { x: 60, y: 51, w: 168, h: 174 } },
  },
  shroomish: {
    front: { w: 82, h: 70, canvas: { w: 192, h: 192 }, box: { x: 54, y: 62, w: 78, h: 66 } },
    back: { w: 121, h: 103, canvas: { w: 288, h: 288 }, box: { x: 84, y: 93, w: 117, h: 99 } },
  },
  breloom: {
    front: { w: 96, h: 128, canvas: { w: 192, h: 192 }, box: { x: 50, y: 34, w: 92, h: 124 } },
    back: { w: 145, h: 187, canvas: { w: 288, h: 288 }, box: { x: 72, y: 57, w: 141, h: 183 } },
  },
  nincada: {
    front: { w: 106, h: 58, canvas: { w: 192, h: 192 }, box: { x: 46, y: 68, w: 102, h: 54 } },
    back: { w: 160, h: 91, canvas: { w: 288, h: 288 }, box: { x: 72, y: 99, w: 156, h: 87 } },
  },
  sableye: {
    front: { w: 88, h: 90, canvas: { w: 192, h: 192 }, box: { x: 54, y: 54, w: 84, h: 86 } },
    back: { w: 115, h: 130, canvas: { w: 288, h: 288 }, box: { x: 87, y: 84, w: 111, h: 126 } },
  },
  mawile: {
    front: { w: 118, h: 98, canvas: { w: 192, h: 192 }, box: { x: 40, y: 48, w: 114, h: 94 } },
    back: { w: 199, h: 145, canvas: { w: 288, h: 288 }, box: { x: 54, y: 72, w: 195, h: 141 } },
  },
  aron: {
    front: { w: 66, h: 66, canvas: { w: 192, h: 192 }, box: { x: 64, y: 64, w: 62, h: 62 } },
    back: { w: 100, h: 100, canvas: { w: 288, h: 288 }, box: { x: 96, y: 96, w: 96, h: 96 } },
  },
  lairon: {
    front: { w: 120, h: 102, canvas: { w: 192, h: 192 }, box: { x: 38, y: 46, w: 116, h: 98 } },
    back: { w: 181, h: 148, canvas: { w: 288, h: 288 }, box: { x: 57, y: 72, w: 177, h: 144 } },
  },
  aggron: {
    front: { w: 148, h: 148, canvas: { w: 192, h: 192 }, box: { x: 24, y: 24, w: 144, h: 144 } },
    back: { w: 193, h: 220, canvas: { w: 288, h: 288 }, box: { x: 45, y: 39, w: 189, h: 216 } },
  },
  electrike: {
    front: { w: 102, h: 74, canvas: { w: 192, h: 192 }, box: { x: 46, y: 62, w: 98, h: 70 } },
    back: { w: 142, h: 100, canvas: { w: 288, h: 288 }, box: { x: 72, y: 102, w: 138, h: 96 } },
  },
  manectric: {
    front: { w: 112, h: 138, canvas: { w: 192, h: 192 }, box: { x: 38, y: 30, w: 108, h: 134 } },
    back: { w: 169, h: 208, canvas: { w: 288, h: 288 }, box: { x: 63, y: 42, w: 165, h: 204 } },
  },
  swalot: {
    front: { w: 120, h: 122, canvas: { w: 192, h: 192 }, box: { x: 38, y: 38, w: 116, h: 118 } },
    back: { w: 169, h: 169, canvas: { w: 288, h: 288 }, box: { x: 54, y: 69, w: 165, h: 165 } },
  },
  numel: {
    front: { w: 90, h: 98, canvas: { w: 192, h: 192 }, box: { x: 54, y: 50, w: 86, h: 94 } },
    back: { w: 130, h: 160, canvas: { w: 288, h: 288 }, box: { x: 81, y: 69, w: 126, h: 156 } },
  },
  camerupt: {
    front: { w: 148, h: 124, canvas: { w: 192, h: 192 }, box: { x: 24, y: 38, w: 144, h: 120 } },
    back: { w: 235, h: 184, canvas: { w: 288, h: 288 }, box: { x: 27, y: 57, w: 231, h: 180 } },
  },
  torkoal: {
    front: { w: 128, h: 130, canvas: { w: 192, h: 192 }, box: { x: 36, y: 34, w: 124, h: 126 } },
    back: { w: 190, h: 193, canvas: { w: 288, h: 288 }, box: { x: 48, y: 51, w: 186, h: 189 } },
  },
  trapinch: {
    front: { w: 80, h: 88, canvas: { w: 192, h: 192 }, box: { x: 58, y: 54, w: 76, h: 84 } },
    back: { w: 121, h: 139, canvas: { w: 288, h: 288 }, box: { x: 84, y: 78, w: 117, h: 135 } },
  },
  flygon: {
    front: { w: 142, h: 142, canvas: { w: 192, h: 192 }, box: { x: 24, y: 28, w: 138, h: 138 } },
    back: { w: 226, h: 205, canvas: { w: 288, h: 288 }, box: { x: 33, y: 42, w: 222, h: 201 } },
  },
  cacnea: {
    front: { w: 112, h: 78, canvas: { w: 192, h: 192 }, box: { x: 38, y: 60, w: 108, h: 74 } },
    back: { w: 163, h: 115, canvas: { w: 288, h: 288 }, box: { x: 66, y: 90, w: 159, h: 111 } },
  },
  cacturne: {
    front: { w: 130, h: 144, canvas: { w: 192, h: 192 }, box: { x: 34, y: 26, w: 126, h: 140 } },
    back: { w: 196, h: 214, canvas: { w: 288, h: 288 }, box: { x: 45, y: 39, w: 192, h: 210 } },
  },
  swablu: {
    front: { w: 144, h: 76, canvas: { w: 192, h: 192 }, box: { x: 26, y: 60, w: 140, h: 72 } },
    back: { w: 211, h: 115, canvas: { w: 288, h: 288 }, box: { x: 39, y: 90, w: 207, h: 111 } },
  },
  lunatone: {
    front: { w: 86, h: 96, canvas: { w: 192, h: 192 }, box: { x: 56, y: 50, w: 82, h: 92 } },
    back: { w: 124, h: 142, canvas: { w: 288, h: 288 }, box: { x: 78, y: 75, w: 120, h: 138 } },
  },
  solrock: {
    front: { w: 132, h: 132, canvas: { w: 192, h: 192 }, box: { x: 32, y: 32, w: 128, h: 128 } },
    back: { w: 196, h: 196, canvas: { w: 288, h: 288 }, box: { x: 48, y: 48, w: 192, h: 192 } },
  },
  corphish: {
    front: { w: 100, h: 92, canvas: { w: 192, h: 192 }, box: { x: 40, y: 52, w: 96, h: 88 } },
    back: { w: 145, h: 136, canvas: { w: 288, h: 288 }, box: { x: 75, y: 78, w: 141, h: 132 } },
  },
  crawdaunt: {
    front: { w: 134, h: 124, canvas: { w: 192, h: 192 }, box: { x: 30, y: 36, w: 130, h: 120 } },
    back: { w: 208, h: 181, canvas: { w: 288, h: 288 }, box: { x: 45, y: 51, w: 204, h: 177 } },
  },
  baltoy: {
    front: { w: 78, h: 78, canvas: { w: 192, h: 192 }, box: { x: 62, y: 60, w: 74, h: 74 } },
    back: { w: 115, h: 115, canvas: { w: 288, h: 288 }, box: { x: 87, y: 90, w: 111, h: 111 } },
  },
  claydol: {
    front: { w: 118, h: 132, canvas: { w: 192, h: 192 }, box: { x: 36, y: 32, w: 114, h: 128 } },
    back: { w: 175, h: 196, canvas: { w: 288, h: 288 }, box: { x: 57, y: 48, w: 171, h: 192 } },
  },
  armaldo: {
    front: { w: 148, h: 138, canvas: { w: 192, h: 192 }, box: { x: 30, y: 28, w: 144, h: 134 } },
    back: { w: 205, h: 202, canvas: { w: 288, h: 288 }, box: { x: 36, y: 48, w: 201, h: 198 } },
  },
  shuppet: {
    front: { w: 74, h: 82, canvas: { w: 192, h: 192 }, box: { x: 62, y: 56, w: 70, h: 78 } },
    back: { w: 109, h: 127, canvas: { w: 288, h: 288 }, box: { x: 90, y: 78, w: 105, h: 123 } },
  },
  banette: {
    front: { w: 102, h: 106, canvas: { w: 192, h: 192 }, box: { x: 50, y: 44, w: 98, h: 102 } },
    back: { w: 151, h: 160, canvas: { w: 288, h: 288 }, box: { x: 60, y: 66, w: 147, h: 156 } },
  },
  duskull: {
    front: { w: 80, h: 86, canvas: { w: 192, h: 192 }, box: { x: 58, y: 56, w: 76, h: 82 } },
    back: { w: 115, h: 130, canvas: { w: 288, h: 288 }, box: { x: 87, y: 84, w: 111, h: 126 } },
  },
  glalie: {
    front: { w: 114, h: 116, canvas: { w: 192, h: 192 }, box: { x: 42, y: 40, w: 110, h: 112 } },
    back: { w: 178, h: 166, canvas: { w: 288, h: 288 }, box: { x: 66, y: 63, w: 174, h: 162 } },
  },
  huntail: {
    front: { w: 138, h: 136, canvas: { w: 192, h: 192 }, box: { x: 28, y: 30, w: 134, h: 132 } },
    back: { w: 187, h: 211, canvas: { w: 288, h: 288 }, box: { x: 54, y: 39, w: 183, h: 207 } },
  },
  salamence: {
    front: { w: 160, h: 146, canvas: { w: 192, h: 192 }, box: { x: 18, y: 24, w: 156, h: 142 } },
    back: { w: 253, h: 232, canvas: { w: 288, h: 288 }, box: { x: 21, y: 30, w: 249, h: 228 } },
  },
  beldum: {
    front: { w: 86, h: 72, canvas: { w: 192, h: 192 }, box: { x: 56, y: 62, w: 82, h: 68 } },
    back: { w: 127, h: 106, canvas: { w: 288, h: 288 }, box: { x: 87, y: 93, w: 123, h: 102 } },
  },
  metang: {
    front: { w: 152, h: 112, canvas: { w: 192, h: 192 }, box: { x: 22, y: 42, w: 148, h: 108 } },
    back: { w: 263, h: 142, canvas: { w: 288, h: 288 }, box: { x: 1, y: 66, w: 260, h: 138 } },
  },
  metagross: {
    front: { w: 158, h: 108, canvas: { w: 192, h: 192 }, box: { x: 18, y: 44, w: 154, h: 104 } },
    back: { w: 232, h: 160, canvas: { w: 288, h: 288 }, box: { x: 27, y: 66, w: 228, h: 156 } },
  },
  regirock: {
    front: { w: 150, h: 142, canvas: { w: 192, h: 192 }, box: { x: 22, y: 28, w: 146, h: 138 } },
    back: { w: 211, h: 208, canvas: { w: 288, h: 288 }, box: { x: 42, y: 42, w: 207, h: 204 } },
  },
  kyogre: {
    front: { w: 192, h: 118, canvas: { w: 192, h: 192 }, box: { x: 2, y: 38, w: 188, h: 114 } },
    back: { w: 288, h: 169, canvas: { w: 288, h: 288 }, box: { x: 1, y: 63, w: 287, h: 165 } },
  },
  staraptor: {
    front: { w: 114, h: 132, canvas: { w: 192, h: 192 }, box: { x: 40, y: 24, w: 110, h: 128 } },
    back: { w: 166, h: 187, canvas: { w: 288, h: 288 }, box: { x: 63, y: 51, w: 162, h: 183 } },
  },
  luxray: {
    front: { w: 136, h: 128, canvas: { w: 192, h: 192 }, box: { x: 30, y: 34, w: 132, h: 124 } },
    back: { w: 205, h: 202, canvas: { w: 288, h: 288 }, box: { x: 42, y: 45, w: 201, h: 198 } },
  },
  rampardos: {
    front: { w: 114, h: 160, canvas: { w: 192, h: 192 }, box: { x: 40, y: 18, w: 110, h: 156 } },
    back: { w: 181, h: 244, canvas: { w: 288, h: 288 }, box: { x: 57, y: 24, w: 177, h: 240 } },
  },
  bastiodon: {
    front: { w: 140, h: 118, canvas: { w: 192, h: 192 }, box: { x: 28, y: 40, w: 136, h: 114 } },
    back: { w: 208, h: 187, canvas: { w: 288, h: 288 }, box: { x: 42, y: 54, w: 204, h: 183 } },
  },
  shellos: {
    front: { w: 66, h: 78, canvas: { w: 192, h: 192 }, box: { x: 64, y: 56, w: 62, h: 74 } },
    back: { w: 100, h: 121, canvas: { w: 288, h: 288 }, box: { x: 96, y: 84, w: 96, h: 117 } },
  },
  gastrodon: {
    front: { w: 102, h: 112, canvas: { w: 192, h: 192 }, box: { x: 46, y: 42, w: 98, h: 108 } },
    back: { w: 145, h: 169, canvas: { w: 288, h: 288 }, box: { x: 72, y: 63, w: 141, h: 165 } },
  },
  drifblim: {
    front: { w: 124, h: 122, canvas: { w: 192, h: 192 }, box: { x: 36, y: 38, w: 120, h: 118 } },
    back: { w: 184, h: 184, canvas: { w: 288, h: 288 }, box: { x: 54, y: 54, w: 180, h: 180 } },
  },
  buneary: {
    front: { w: 68, h: 118, canvas: { w: 192, h: 192 }, box: { x: 64, y: 38, w: 64, h: 114 } },
    back: { w: 106, h: 175, canvas: { w: 288, h: 288 }, box: { x: 102, y: 48, w: 102, h: 171 } },
  },
  mismagius: {
    front: { w: 110, h: 134, canvas: { w: 192, h: 192 }, box: { x: 42, y: 30, w: 106, h: 130 } },
    back: { w: 151, h: 202, canvas: { w: 288, h: 288 }, box: { x: 69, y: 45, w: 147, h: 198 } },
  },
  bronzor: {
    front: { w: 66, h: 78, canvas: { w: 192, h: 192 }, box: { x: 66, y: 60, w: 62, h: 74 } },
    back: { w: 100, h: 118, canvas: { w: 288, h: 288 }, box: { x: 96, y: 84, w: 96, h: 114 } },
  },
  bronzong: {
    front: { w: 184, h: 120, canvas: { w: 192, h: 192 }, box: { x: 6, y: 38, w: 180, h: 116 } },
    back: { w: 274, h: 178, canvas: { w: 288, h: 288 }, box: { x: 9, y: 57, w: 270, h: 174 } },
  },
  spiritomb: {
    front: { w: 114, h: 108, canvas: { w: 192, h: 192 }, box: { x: 40, y: 44, w: 110, h: 104 } },
    back: { w: 166, h: 160, canvas: { w: 288, h: 288 }, box: { x: 63, y: 66, w: 162, h: 156 } },
  },
  gible: {
    front: { w: 94, h: 106, canvas: { w: 192, h: 192 }, box: { x: 50, y: 40, w: 90, h: 102 } },
    back: { w: 136, h: 148, canvas: { w: 288, h: 288 }, box: { x: 78, y: 72, w: 132, h: 144 } },
  },
  gabite: {
    front: { w: 134, h: 126, canvas: { w: 192, h: 192 }, box: { x: 30, y: 36, w: 130, h: 122 } },
    back: { w: 199, h: 184, canvas: { w: 288, h: 288 }, box: { x: 45, y: 54, w: 195, h: 180 } },
  },
  garchomp: {
    front: { w: 150, h: 156, canvas: { w: 192, h: 192 }, box: { x: 18, y: 20, w: 146, h: 152 } },
    back: { w: 232, h: 223, canvas: { w: 288, h: 288 }, box: { x: 30, y: 36, w: 228, h: 219 } },
  },
  hippopotas: {
    front: { w: 128, h: 84, canvas: { w: 192, h: 192 }, box: { x: 34, y: 56, w: 124, h: 80 } },
    back: { w: 172, h: 133, canvas: { w: 288, h: 288 }, box: { x: 60, y: 81, w: 168, h: 129 } },
  },
  hippowdon: {
    front: { w: 164, h: 126, canvas: { w: 192, h: 192 }, box: { x: 16, y: 36, w: 160, h: 122 } },
    back: { w: 277, h: 205, canvas: { w: 288, h: 288 }, box: { x: 6, y: 45, w: 273, h: 201 } },
  },
  toxicroak: {
    front: { w: 116, h: 120, canvas: { w: 192, h: 192 }, box: { x: 40, y: 38, w: 112, h: 116 } },
    back: { w: 172, h: 184, canvas: { w: 288, h: 288 }, box: { x: 60, y: 57, w: 168, h: 180 } },
  },
  carnivine: {
    front: { w: 160, h: 124, canvas: { w: 192, h: 192 }, box: { x: 18, y: 36, w: 156, h: 120 } },
    back: { w: 241, h: 178, canvas: { w: 288, h: 288 }, box: { x: 27, y: 57, w: 237, h: 174 } },
  },
  abomasnow: {
    front: { w: 164, h: 142, canvas: { w: 192, h: 192 }, box: { x: 16, y: 28, w: 160, h: 138 } },
    back: { w: 232, h: 211, canvas: { w: 288, h: 288 }, box: { x: 42, y: 39, w: 228, h: 207 } },
  },
  magnezone: {
    front: { w: 156, h: 116, canvas: { w: 192, h: 192 }, box: { x: 20, y: 40, w: 152, h: 112 } },
    back: { w: 229, h: 154, canvas: { w: 288, h: 288 }, box: { x: 24, y: 63, w: 225, h: 150 } },
  },
  rhyperior: {
    front: { w: 164, h: 140, canvas: { w: 192, h: 192 }, box: { x: 16, y: 30, w: 160, h: 136 } },
    back: { w: 274, h: 202, canvas: { w: 288, h: 288 }, box: { x: 9, y: 45, w: 270, h: 198 } },
  },
  tangrowth: {
    front: { w: 166, h: 134, canvas: { w: 192, h: 192 }, box: { x: 14, y: 30, w: 162, h: 130 } },
    back: { w: 247, h: 199, canvas: { w: 288, h: 288 }, box: { x: 24, y: 45, w: 243, h: 195 } },
  },
  electivire: {
    front: { w: 148, h: 146, canvas: { w: 192, h: 192 }, box: { x: 20, y: 26, w: 144, h: 142 } },
    back: { w: 229, h: 208, canvas: { w: 288, h: 288 }, box: { x: 33, y: 42, w: 225, h: 204 } },
  },
  gliscor: {
    front: { w: 150, h: 118, canvas: { w: 192, h: 192 }, box: { x: 24, y: 40, w: 146, h: 114 } },
    back: { w: 214, h: 190, canvas: { w: 288, h: 288 }, box: { x: 39, y: 51, w: 210, h: 186 } },
  },
  probopass: {
    front: { w: 126, h: 128, canvas: { w: 192, h: 192 }, box: { x: 34, y: 34, w: 122, h: 124 } },
    back: { w: 187, h: 187, canvas: { w: 288, h: 288 }, box: { x: 54, y: 51, w: 183, h: 183 } },
  },
  froslass: {
    front: { w: 68, h: 114, canvas: { w: 192, h: 192 }, box: { x: 66, y: 40, w: 64, h: 110 } },
    back: { w: 94, h: 160, canvas: { w: 288, h: 288 }, box: { x: 99, y: 66, w: 90, h: 156 } },
  },
  regigigas: {
    front: { w: 160, h: 140, canvas: { w: 192, h: 192 }, box: { x: 18, y: 28, w: 156, h: 136 } },
    back: { w: 250, h: 214, canvas: { w: 288, h: 288 }, box: { x: 21, y: 39, w: 246, h: 210 } },
  },
  darkrai: {
    front: { w: 148, h: 136, canvas: { w: 192, h: 192 }, box: { x: 20, y: 30, w: 144, h: 132 } },
    back: { w: 211, h: 193, canvas: { w: 288, h: 288 }, box: { x: 39, y: 51, w: 207, h: 189 } },
  },
  snivy: {
    front: { w: 84, h: 78, canvas: { w: 192, h: 192 }, box: { x: 56, y: 60, w: 80, h: 74 } },
    back: { w: 124, h: 118, canvas: { w: 288, h: 288 }, box: { x: 84, y: 87, w: 120, h: 114 } },
  },
  roggenrola: {
    front: { w: 44, h: 76, canvas: { w: 192, h: 192 }, box: { x: 76, y: 60, w: 40, h: 72 } },
    back: { w: 64, h: 109, canvas: { w: 288, h: 288 }, box: { x: 114, y: 90, w: 60, h: 105 } },
  },
  gigalith: {
    front: { w: 164, h: 156, canvas: { w: 192, h: 192 }, box: { x: 18, y: 16, w: 160, h: 152 } },
    back: { w: 229, h: 232, canvas: { w: 288, h: 288 }, box: { x: 24, y: 30, w: 225, h: 228 } },
  },
  woobat: {
    front: { w: 130, h: 76, canvas: { w: 192, h: 192 }, box: { x: 30, y: 58, w: 126, h: 72 } },
    back: { w: 178, h: 100, canvas: { w: 288, h: 288 }, box: { x: 57, y: 102, w: 174, h: 96 } },
  },
  drilbur: {
    front: { w: 110, h: 104, canvas: { w: 192, h: 192 }, box: { x: 40, y: 46, w: 106, h: 100 } },
    back: { w: 151, h: 133, canvas: { w: 288, h: 288 }, box: { x: 69, y: 81, w: 147, h: 129 } },
  },
  excadrill: {
    front: { w: 160, h: 130, canvas: { w: 192, h: 192 }, box: { x: 16, y: 28, w: 156, h: 126 } },
    back: { w: 238, h: 205, canvas: { w: 288, h: 288 }, box: { x: 12, y: 36, w: 234, h: 201 } },
  },
  seismitoad: {
    front: { w: 146, h: 134, canvas: { w: 192, h: 192 }, box: { x: 20, y: 36, w: 142, h: 130 } },
    back: { w: 208, h: 196, canvas: { w: 288, h: 288 }, box: { x: 54, y: 48, w: 204, h: 192 } },
  },
  throh: {
    front: { w: 142, h: 106, canvas: { w: 192, h: 192 }, box: { x: 24, y: 42, w: 138, h: 102 } },
    back: { w: 184, h: 157, canvas: { w: 288, h: 288 }, box: { x: 54, y: 66, w: 180, h: 153 } },
  },
  scolipede: {
    front: { w: 182, h: 168, canvas: { w: 192, h: 192 }, box: { x: 8, y: 14, w: 178, h: 164 } },
    back: { w: 274, h: 241, canvas: { w: 288, h: 288 }, box: { x: 9, y: 27, w: 270, h: 237 } },
  },
  sandile: {
    front: { w: 94, h: 56, canvas: { w: 192, h: 192 }, box: { x: 46, y: 70, w: 90, h: 52 } },
    back: { w: 166, h: 103, canvas: { w: 288, h: 288 }, box: { x: 57, y: 84, w: 162, h: 99 } },
  },
  darumaka: {
    front: { w: 80, h: 76, canvas: { w: 192, h: 192 }, box: { x: 58, y: 60, w: 76, h: 72 } },
    back: { w: 115, h: 112, canvas: { w: 288, h: 288 }, box: { x: 84, y: 87, w: 111, h: 108 } },
  },
  maractus: {
    front: { w: 120, h: 146, canvas: { w: 192, h: 192 }, box: { x: 38, y: 26, w: 116, h: 142 } },
    back: { w: 193, h: 217, canvas: { w: 288, h: 288 }, box: { x: 39, y: 33, w: 189, h: 213 } },
  },
  dwebble: {
    front: { w: 80, h: 70, canvas: { w: 192, h: 192 }, box: { x: 60, y: 62, w: 76, h: 66 } },
    back: { w: 121, h: 94, canvas: { w: 288, h: 288 }, box: { x: 84, y: 99, w: 117, h: 90 } },
  },
  yamask: {
    front: { w: 110, h: 80, canvas: { w: 192, h: 192 }, box: { x: 40, y: 56, w: 106, h: 76 } },
    back: { w: 157, h: 118, canvas: { w: 288, h: 288 }, box: { x: 60, y: 84, w: 153, h: 114 } },
  },
  cofagrigus: {
    front: { w: 186, h: 156, canvas: { w: 192, h: 192 }, box: { x: 6, y: 20, w: 182, h: 152 } },
    back: { w: 277, h: 223, canvas: { w: 288, h: 288 }, box: { x: 6, y: 21, w: 273, h: 219 } },
  },
  carracosta: {
    front: { w: 136, h: 122, canvas: { w: 192, h: 192 }, box: { x: 30, y: 38, w: 132, h: 118 } },
    back: { w: 205, h: 187, canvas: { w: 288, h: 288 }, box: { x: 42, y: 54, w: 201, h: 183 } },
  },
  archeops: {
    front: { w: 144, h: 172, canvas: { w: 192, h: 192 }, box: { x: 26, y: 12, w: 140, h: 168 } },
    back: { w: 226, h: 277, canvas: { w: 288, h: 288 }, box: { x: 42, y: 6, w: 222, h: 273 } },
  },
  zoroark: {
    front: { w: 140, h: 132, canvas: { w: 192, h: 192 }, box: { x: 30, y: 36, w: 136, h: 128 } },
    back: { w: 226, h: 199, canvas: { w: 288, h: 288 }, box: { x: 21, y: 42, w: 222, h: 195 } },
  },
  emolga: {
    front: { w: 114, h: 86, canvas: { w: 192, h: 192 }, box: { x: 50, y: 46, w: 110, h: 82 } },
    back: { w: 169, h: 127, canvas: { w: 288, h: 288 }, box: { x: 63, y: 81, w: 165, h: 123 } },
  },
  foongus: {
    front: { w: 64, h: 68, canvas: { w: 192, h: 192 }, box: { x: 66, y: 64, w: 60, h: 64 } },
    back: { w: 94, h: 100, canvas: { w: 288, h: 288 }, box: { x: 99, y: 96, w: 90, h: 96 } },
  },
  amoonguss: {
    front: { w: 120, h: 110, canvas: { w: 192, h: 192 }, box: { x: 32, y: 38, w: 116, h: 106 } },
    back: { w: 190, h: 169, canvas: { w: 288, h: 288 }, box: { x: 51, y: 63, w: 186, h: 165 } },
  },
  ferroseed: {
    front: { w: 64, h: 76, canvas: { w: 192, h: 192 }, box: { x: 66, y: 60, w: 60, h: 72 } },
    back: { w: 94, h: 112, canvas: { w: 288, h: 288 }, box: { x: 99, y: 90, w: 90, h: 108 } },
  },
  litwick: {
    front: { w: 58, h: 78, canvas: { w: 192, h: 192 }, box: { x: 70, y: 58, w: 54, h: 74 } },
    back: { w: 88, h: 115, canvas: { w: 288, h: 288 }, box: { x: 102, y: 87, w: 84, h: 111 } },
  },
  chandelure: {
    front: { w: 134, h: 132, canvas: { w: 192, h: 192 }, box: { x: 30, y: 32, w: 130, h: 128 } },
    back: { w: 199, h: 196, canvas: { w: 288, h: 288 }, box: { x: 45, y: 48, w: 195, h: 192 } },
  },
  stunfisk: {
    front: { w: 120, h: 88, canvas: { w: 192, h: 192 }, box: { x: 38, y: 54, w: 116, h: 84 } },
    back: { w: 217, h: 82, canvas: { w: 288, h: 288 }, box: { x: 39, y: 105, w: 213, h: 78 } },
  },
  druddigon: {
    front: { w: 166, h: 146, canvas: { w: 192, h: 192 }, box: { x: 12, y: 22, w: 162, h: 142 } },
    back: { w: 259, h: 223, canvas: { w: 288, h: 288 }, box: { x: 3, y: 18, w: 255, h: 219 } },
  },
  golett: {
    front: { w: 120, h: 116, canvas: { w: 192, h: 192 }, box: { x: 38, y: 42, w: 116, h: 112 } },
    back: { w: 172, h: 181, canvas: { w: 288, h: 288 }, box: { x: 60, y: 57, w: 168, h: 177 } },
  },
  rufflet: {
    front: { w: 64, h: 100, canvas: { w: 192, h: 192 }, box: { x: 66, y: 48, w: 60, h: 96 } },
    back: { w: 100, h: 151, canvas: { w: 288, h: 288 }, box: { x: 96, y: 69, w: 96, h: 147 } },
  },
  braviary: {
    front: { w: 180, h: 168, canvas: { w: 192, h: 192 }, box: { x: 6, y: 14, w: 176, h: 164 } },
    back: { w: 223, h: 283, canvas: { w: 288, h: 288 }, box: { x: 33, y: 3, w: 219, h: 279 } },
  },
  durant: {
    front: { w: 106, h: 66, canvas: { w: 192, h: 192 }, box: { x: 44, y: 66, w: 102, h: 62 } },
    back: { w: 160, h: 97, canvas: { w: 288, h: 288 }, box: { x: 66, y: 99, w: 156, h: 93 } },
  },
  kyurem: {
    front: { w: 192, h: 152, canvas: { w: 192, h: 192 }, box: { x: 2, y: 4, w: 188, h: 148 } },
    back: { w: 232, h: 208, canvas: { w: 288, h: 288 }, box: { x: 27, y: 18, w: 228, h: 204 } },
  },
  fletchling: {
    front: { w: 68, h: 82, canvas: { w: 192, h: 192 }, box: { x: 64, y: 56, w: 64, h: 78 } },
    back: { w: 103, h: 112, canvas: { w: 288, h: 288 }, box: { x: 93, y: 90, w: 99, h: 108 } },
  },
  talonflame: {
    front: { w: 184, h: 182, canvas: { w: 192, h: 192 }, box: { x: 6, y: 6, w: 180, h: 178 } },
    back: { w: 274, h: 277, canvas: { w: 288, h: 288 }, box: { x: 9, y: 6, w: 270, h: 273 } },
  },
  honedge: {
    front: { w: 98, h: 114, canvas: { w: 192, h: 192 }, box: { x: 48, y: 40, w: 94, h: 110 } },
    back: { w: 169, h: 169, canvas: { w: 288, h: 288 }, box: { x: 60, y: 60, w: 165, h: 165 } },
  },
  aegislash: {
    front: { w: 122, h: 150, canvas: { w: 192, h: 192 }, box: { x: 36, y: 22, w: 118, h: 146 } },
    back: { w: 163, h: 214, canvas: { w: 288, h: 288 }, box: { x: 63, y: 39, w: 159, h: 210 } },
  },
  heliolisk: {
    front: { w: 122, h: 144, canvas: { w: 192, h: 192 }, box: { x: 36, y: 26, w: 118, h: 140 } },
    back: { w: 178, h: 208, canvas: { w: 288, h: 288 }, box: { x: 57, y: 42, w: 174, h: 204 } },
  },
  tyrantrum: {
    front: { w: 188, h: 162, canvas: { w: 192, h: 192 }, box: { x: 4, y: 16, w: 184, h: 158 } },
    back: { w: 280, h: 229, canvas: { w: 288, h: 288 }, box: { x: 6, y: 30, w: 276, h: 225 } },
  },
  aurorus: {
    front: { w: 160, h: 176, canvas: { w: 192, h: 192 }, box: { x: 18, y: 10, w: 156, h: 172 } },
    back: { w: 220, h: 277, canvas: { w: 288, h: 288 }, box: { x: 36, y: 6, w: 216, h: 273 } },
  },
  hawlucha: {
    front: { w: 154, h: 124, canvas: { w: 192, h: 192 }, box: { x: 20, y: 36, w: 150, h: 120 } },
    back: { w: 235, h: 184, canvas: { w: 288, h: 288 }, box: { x: 27, y: 54, w: 231, h: 180 } },
  },
  dedenne: {
    front: { w: 96, h: 76, canvas: { w: 192, h: 192 }, box: { x: 50, y: 60, w: 92, h: 72 } },
    back: { w: 142, h: 109, canvas: { w: 288, h: 288 }, box: { x: 75, y: 90, w: 138, h: 105 } },
  },
  carbink: {
    front: { w: 78, h: 80, canvas: { w: 192, h: 192 }, box: { x: 58, y: 58, w: 74, h: 76 } },
    back: { w: 115, h: 118, canvas: { w: 288, h: 288 }, box: { x: 87, y: 87, w: 111, h: 114 } },
  },
  goomy: {
    front: { w: 56, h: 72, canvas: { w: 192, h: 192 }, box: { x: 70, y: 62, w: 52, h: 68 } },
    back: { w: 82, h: 106, canvas: { w: 288, h: 288 }, box: { x: 105, y: 93, w: 78, h: 102 } },
  },
  trevenant: {
    front: { w: 166, h: 174, canvas: { w: 192, h: 192 }, box: { x: 14, y: 10, w: 162, h: 170 } },
    back: { w: 244, h: 244, canvas: { w: 288, h: 288 }, box: { x: 24, y: 24, w: 240, h: 240 } },
  },
  pumpkaboo: {
    front: { w: 74, h: 74, canvas: { w: 192, h: 192 }, box: { x: 60, y: 60, w: 70, h: 70 } },
    back: { w: 109, h: 109, canvas: { w: 288, h: 288 }, box: { x: 90, y: 90, w: 105, h: 105 } },
  },
  bergmite: {
    front: { w: 76, h: 90, canvas: { w: 192, h: 192 }, box: { x: 60, y: 52, w: 72, h: 86 } },
    back: { w: 109, h: 133, canvas: { w: 288, h: 288 }, box: { x: 90, y: 78, w: 105, h: 129 } },
  },
  avalugg: {
    front: { w: 170, h: 130, canvas: { w: 192, h: 192 }, box: { x: 12, y: 32, w: 166, h: 126 } },
    back: { w: 265, h: 193, canvas: { w: 288, h: 288 }, box: { x: 12, y: 48, w: 261, h: 189 } },
  },
  noibat: {
    front: { w: 132, h: 118, canvas: { w: 192, h: 192 }, box: { x: 32, y: 38, w: 128, h: 114 } },
    back: { w: 184, h: 175, canvas: { w: 288, h: 288 }, box: { x: 54, y: 57, w: 180, h: 171 } },
  },
  zygarde: {
    front: { w: 148, h: 180, canvas: { w: 192, h: 192 }, box: { x: 24, y: 8, w: 144, h: 176 } },
    back: { w: 220, h: 268, canvas: { w: 288, h: 288 }, box: { x: 36, y: 12, w: 216, h: 264 } },
  },
  diancie: {
    front: { w: 86, h: 144, canvas: { w: 192, h: 192 }, box: { x: 54, y: 26, w: 82, h: 140 } },
    back: { w: 118, h: 199, canvas: { w: 288, h: 288 }, box: { x: 87, y: 45, w: 114, h: 195 } },
  },
  grubbin: {
    front: { w: 88, h: 52, canvas: { w: 192, h: 192 }, box: { x: 56, y: 72, w: 84, h: 48 } },
    back: { w: 112, h: 76, canvas: { w: 288, h: 288 }, box: { x: 93, y: 108, w: 108, h: 72 } },
  },
  vikavolt: {
    front: { w: 152, h: 126, canvas: { w: 192, h: 192 }, box: { x: 22, y: 36, w: 148, h: 122 } },
    back: { w: 226, h: 190, canvas: { w: 288, h: 288 }, box: { x: 33, y: 45, w: 222, h: 186 } },
  },
  rockruff: {
    front: { w: 86, h: 88, canvas: { w: 192, h: 192 }, box: { x: 56, y: 58, w: 82, h: 84 } },
    back: { w: 127, h: 130, canvas: { w: 288, h: 288 }, box: { x: 75, y: 87, w: 123, h: 126 } },
  },
  wishiwashi: {
    front: { w: 78, h: 50, canvas: { w: 192, h: 192 }, box: { x: 56, y: 82, w: 74, h: 46 } },
    back: { w: 118, h: 73, canvas: { w: 288, h: 288 }, box: { x: 78, y: 114, w: 114, h: 69 } },
  },
  mareanie: {
    front: { w: 114, h: 92, canvas: { w: 192, h: 192 }, box: { x: 36, y: 54, w: 110, h: 88 } },
    back: { w: 160, h: 142, canvas: { w: 288, h: 288 }, box: { x: 54, y: 78, w: 156, h: 138 } },
  },
  toxapex: {
    front: { w: 182, h: 150, canvas: { w: 192, h: 192 }, box: { x: 10, y: 24, w: 178, h: 146 } },
    back: { w: 271, h: 220, canvas: { w: 288, h: 288 }, box: { x: 9, y: 36, w: 267, h: 216 } },
  },
  mudbray: {
    front: { w: 96, h: 116, canvas: { w: 192, h: 192 }, box: { x: 48, y: 40, w: 92, h: 112 } },
    back: { w: 142, h: 172, canvas: { w: 288, h: 288 }, box: { x: 75, y: 60, w: 138, h: 168 } },
  },
  mudsdale: {
    front: { w: 152, h: 140, canvas: { w: 192, h: 192 }, box: { x: 20, y: 28, w: 148, h: 136 } },
    back: { w: 232, h: 205, canvas: { w: 288, h: 288 }, box: { x: 24, y: 45, w: 228, h: 201 } },
  },
  dewpider: {
    front: { w: 62, h: 86, canvas: { w: 192, h: 192 }, box: { x: 62, y: 56, w: 58, h: 82 } },
    back: { w: 85, h: 130, canvas: { w: 288, h: 288 }, box: { x: 99, y: 87, w: 81, h: 126 } },
  },
  fomantis: {
    front: { w: 60, h: 94, canvas: { w: 192, h: 192 }, box: { x: 68, y: 50, w: 56, h: 90 } },
    back: { w: 88, h: 139, canvas: { w: 288, h: 288 }, box: { x: 102, y: 75, w: 84, h: 135 } },
  },
  lurantis: {
    front: { w: 96, h: 140, canvas: { w: 192, h: 192 }, box: { x: 54, y: 26, w: 92, h: 136 } },
    back: { w: 112, h: 208, canvas: { w: 288, h: 288 }, box: { x: 90, y: 42, w: 108, h: 204 } },
  },
  morelull: {
    front: { w: 44, h: 104, canvas: { w: 192, h: 192 }, box: { x: 72, y: 42, w: 40, h: 100 } },
    back: { w: 64, h: 154, canvas: { w: 288, h: 288 }, box: { x: 105, y: 63, w: 60, h: 150 } },
  },
  sandygast: {
    front: { w: 112, h: 96, canvas: { w: 192, h: 192 }, box: { x: 42, y: 50, w: 108, h: 92 } },
    back: { w: 166, h: 142, canvas: { w: 288, h: 288 }, box: { x: 63, y: 75, w: 162, h: 138 } },
  },
  pyukumuku: {
    front: { w: 84, h: 58, canvas: { w: 192, h: 192 }, box: { x: 56, y: 68, w: 80, h: 54 } },
    back: { w: 124, h: 85, canvas: { w: 288, h: 288 }, box: { x: 84, y: 102, w: 120, h: 81 } },
  },
  minior: {
    front: { w: 78, h: 78, canvas: { w: 192, h: 192 }, box: { x: 52, y: 58, w: 74, h: 74 } },
    back: { w: 115, h: 115, canvas: { w: 288, h: 288 }, box: { x: 78, y: 87, w: 111, h: 111 } },
  },
  togedemaru: {
    front: { w: 84, h: 84, canvas: { w: 192, h: 192 }, box: { x: 56, y: 56, w: 80, h: 80 } },
    back: { w: 124, h: 124, canvas: { w: 288, h: 288 }, box: { x: 84, y: 84, w: 120, h: 120 } },
  },
  mimikyu: {
    front: { w: 82, h: 100, canvas: { w: 192, h: 192 }, box: { x: 56, y: 48, w: 78, h: 96 } },
    back: { w: 115, h: 157, canvas: { w: 288, h: 288 }, box: { x: 93, y: 72, w: 111, h: 153 } },
  },
  bruxish: {
    front: { w: 106, h: 76, canvas: { w: 192, h: 192 }, box: { x: 44, y: 60, w: 102, h: 72 } },
    back: { w: 160, h: 118, canvas: { w: 288, h: 288 }, box: { x: 66, y: 84, w: 156, h: 114 } },
  },
  dhelmise: {
    front: { w: 122, h: 164, canvas: { w: 192, h: 192 }, box: { x: 36, y: 20, w: 118, h: 160 } },
    back: { w: 181, h: 247, canvas: { w: 288, h: 288 }, box: { x: 51, y: 27, w: 177, h: 243 } },
  },
  zeraora: {
    front: { w: 148, h: 140, canvas: { w: 192, h: 192 }, box: { x: 26, y: 26, w: 144, h: 136 } },
    back: { w: 220, h: 208, canvas: { w: 288, h: 288 }, box: { x: 36, y: 42, w: 216, h: 204 } },
  },
  rookidee: {
    front: { w: 80, h: 78, canvas: { w: 192, h: 192 }, box: { x: 58, y: 62, w: 76, h: 74 } },
    back: { w: 142, h: 118, canvas: { w: 288, h: 288 }, box: { x: 75, y: 87, w: 138, h: 114 } },
  },
  corviknight: {
    front: { w: 106, h: 140, canvas: { w: 192, h: 192 }, box: { x: 48, y: 28, w: 102, h: 136 } },
    back: { w: 184, h: 199, canvas: { w: 288, h: 288 }, box: { x: 57, y: 45, w: 180, h: 195 } },
  },
  rolycoly: {
    front: { w: 94, h: 82, canvas: { w: 192, h: 192 }, box: { x: 52, y: 58, w: 90, h: 78 } },
    back: { w: 151, h: 118, canvas: { w: 288, h: 288 }, box: { x: 78, y: 90, w: 147, h: 114 } },
  },
  carkol: {
    front: { w: 98, h: 126, canvas: { w: 192, h: 192 }, box: { x: 50, y: 32, w: 94, h: 122 } },
    back: { w: 145, h: 181, canvas: { w: 288, h: 288 }, box: { x: 72, y: 54, w: 141, h: 177 } },
  },
  silicobra: {
    front: { w: 88, h: 84, canvas: { w: 192, h: 192 }, box: { x: 54, y: 56, w: 84, h: 80 } },
    back: { w: 139, h: 127, canvas: { w: 288, h: 288 }, box: { x: 75, y: 81, w: 135, h: 123 } },
  },
  sandaconda: {
    front: { w: 174, h: 112, canvas: { w: 192, h: 192 }, box: { x: 10, y: 42, w: 170, h: 108 } },
    back: { w: 244, h: 154, canvas: { w: 288, h: 288 }, box: { x: 24, y: 69, w: 240, h: 150 } },
  },
  sizzlipede: {
    front: { w: 116, h: 82, canvas: { w: 192, h: 192 }, box: { x: 40, y: 56, w: 112, h: 78 } },
    back: { w: 157, h: 121, canvas: { w: 288, h: 288 }, box: { x: 66, y: 84, w: 153, h: 117 } },
  },
  centiskorch: {
    front: { w: 180, h: 150, canvas: { w: 192, h: 192 }, box: { x: 8, y: 22, w: 176, h: 146 } },
    back: { w: 268, h: 226, canvas: { w: 288, h: 288 }, box: { x: 12, y: 33, w: 264, h: 222 } },
  },
  runerigus: {
    front: { w: 190, h: 118, canvas: { w: 192, h: 192 }, box: { x: 2, y: 38, w: 186, h: 114 } },
    back: { w: 271, h: 175, canvas: { w: 288, h: 288 }, box: { x: 9, y: 57, w: 267, h: 171 } },
  },
  falinks: {
    front: { w: 166, h: 110, canvas: { w: 192, h: 192 }, box: { x: 14, y: 42, w: 162, h: 106 } },
    back: { w: 223, h: 133, canvas: { w: 288, h: 288 }, box: { x: 33, y: 78, w: 219, h: 129 } },
  },
  pincurchin: {
    front: { w: 86, h: 80, canvas: { w: 192, h: 192 }, box: { x: 52, y: 60, w: 82, h: 76 } },
    back: { w: 133, h: 118, canvas: { w: 288, h: 288 }, box: { x: 78, y: 84, w: 129, h: 114 } },
  },
  stonjourner: {
    front: { w: 124, h: 158, canvas: { w: 192, h: 192 }, box: { x: 36, y: 18, w: 120, h: 154 } },
    back: { w: 184, h: 232, canvas: { w: 288, h: 288 }, box: { x: 54, y: 30, w: 180, h: 228 } },
  },
  nacli: {
    front: { w: 62, h: 58, canvas: { w: 192, h: 192 }, box: { x: 68, y: 68, w: 58, h: 54 } },
    back: { w: 121, h: 127, canvas: { w: 288, h: 288 }, box: { x: 84, y: 81, w: 117, h: 123 } },
  },
  naclstack: {
    front: { w: 102, h: 82, canvas: { w: 192, h: 192 }, box: { x: 48, y: 56, w: 98, h: 78 } },
    back: { w: 178, h: 157, canvas: { w: 288, h: 288 }, box: { x: 57, y: 66, w: 174, h: 153 } },
  },
};
