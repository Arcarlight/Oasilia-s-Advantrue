// 回合切换立绘：Generation 9 Pack 里每只宝可梦的正面 / 背面图。
//
// 和 assets/pokemon 的 PMD 行走图是两套东西：
//   · 行走图（sprites.js）—— 战斗场地上的动态姿态，一张图是整张帧表；
//   · 立绘（这里）      —— 单张静态图，用在回合切换时「由大变小」落到回合数旁边。
//
// 素材的原始画布是正面 192²、背面 288²，导入时已经按可见内容裁到包围盒
// （见 tools/import-gen9.mjs），所以这里只关心宽高比，不用再算偏移。
//
// 单文件构建（oasis-game.html）会把图内联成 window.__OASIS_GEN9__，
// 和精灵图 / 头像走同一套约定。

import { GEN9_ART } from '../data/gen9.js';

/**
 * 「图案高度 ÷ 原画布高度」在这 168 张里的中位数。
 * 用它当基准来判断一只宝可梦在原画布里算大还是算小 ——
 * 这样立绘的大小会跟着物种本身走（大岩蛇比刺尾虫占地方），
 * 而不是每只都撑满同一个框、看起来一样大。
 */
const MEDIAN_FILL = 0.51;
/** 大小差异的上下限：最大的一只大约是最小那只的 1.7 倍高，差别看得出来但不至于离谱 */
const FILL_MIN = 0.72;
const FILL_MAX = 1.24;

const BASE = 'assets/gen9/';

/**
 * 「由大变小」的起始倍数。
 * 放在这里（而不是只写在 CSS 的 var 兜底里）是为了让它有唯一出处：
 * 战斗界面按它写 --tart-from，诊断脚本也按它核对「起始帧确实是落定帧的 2.6 倍」。
 */
export const ART_FROM_SCALE = 2.6;

/** 取立绘图 URL；单文件构建下是内联的 data URI */
export function artUrl(slug, kind) {
  const inlined = typeof window !== 'undefined' && window.__OASIS_GEN9__
    ? window.__OASIS_GEN9__
    : null;
  if (inlined) return inlined[`${slug}/${kind}`] ?? null;
  return slug ? `${BASE}${slug}/${kind}.png` : null;
}

/**
 * 解析出「画这一侧要用的立绘」。
 * @param {string} slug 物种 slug
 * @param {'front'|'back'} kind 正面 / 背面
 * @returns {{url:string, w:number, h:number, ar:number, scale:number}|null}
 *   ar = 宽高比；scale = 相对基准的大小系数（0.72 ~ 1.24）。素材缺失时返回 null，
 *   调用方直接跳过演出（宁可这一回合不画，也不要出破图）。
 */
export function turnArt(slug, kind = 'front') {
  const art = GEN9_ART[slug]?.[kind];
  if (!art) return null;
  const url = artUrl(slug, kind);
  if (!url) return null;
  const fill = art.box.h / art.canvas.h;
  const scale = Math.min(FILL_MAX, Math.max(FILL_MIN, fill / MEDIAN_FILL));
  return {
    slug,
    kind,
    url,
    w: art.w,
    h: art.h,
    ar: art.w / art.h,
    scale,
  };
}

/**
 * 按可用高度算出真正要写进 <img> 的像素尺寸。
 * 单独抽出来是为了让诊断脚本能直接核对（不用去量 DOM）：
 * 「瘦高的怪按高度撑满、扁宽的怪被最大宽度卡住」这条规则就在这里。
 *
 * @param {{ar:number, scale:number}} art
 * @param {number} slotH 立绘位的高度（CSS 变量 --tart-h 的实际像素值）
 * @param {number} maxAspect 最宽允许到几倍的 slotH（防止大岩蛇横向铺满一条）
 */
export function fitArt(art, slotH, maxAspect = 2) {
  const maxW = slotH * maxAspect;
  let h = slotH * art.scale;
  let w = h * art.ar;
  if (w > maxW) {
    w = maxW;
    h = maxW / art.ar;
  }
  return { w: Math.round(w), h: Math.round(h) };
}
