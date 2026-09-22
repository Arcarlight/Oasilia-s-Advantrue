#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""量「背景花纹是不是真的在滚」（3.0.7）。

为什么不能看 computed style：这条滚动动画跑在合成层上（will-change + translate3d），
主线程读到的 transform 一直停在起点 —— 冒烟测试里那条「两帧一样」的误报就是这么来的。
所以这里**逐像素比两张截图**：
  · 花纹动 vs 花纹停   → 应当差很多（图案整体平移了 N 个像素）
  · 花纹停 vs 花纹停   → 只差天气粒子（沙粒在飘），作为对照基线
  · 花纹动(t) vs 花纹动(t+Δ) → 应当也有可观的差（真的在滚，不是只挪了一次）

用法：python tools/measure-decor-motion.py <A.png> <B.png>
"""
import sys
from PIL import Image, ImageChops

a_path, b_path = sys.argv[1], sys.argv[2]
A = Image.open(a_path).convert('L')
B = Image.open(b_path).convert('L')
if A.size != B.size:
    print('两张图尺寸不一样，没法逐像素比')
    sys.exit(1)
W, H = A.size

FIELD = (0, int(0.145 * H), W, int(0.735 * H))       # 战场（HUD 之下、手牌之上）
diff = ImageChops.difference(A.crop(FIELD), B.crop(FIELD))
data = list(diff.getdata())
mean = sum(data) / len(data)
# 「有多少像素变了」比平均差更能说明问题：图案平移会让大量像素变化
changed = sum(1 for v in data if v > 6) / len(data)

# 同一个区域在两张图里的相关系数（平移之后相关性会掉下来）
box = (int(0.05 * W), int(0.18 * H), int(0.60 * W), int(0.34 * H))
pa = list(A.crop(box).getdata())
pb = list(B.crop(box).getdata())
n = len(pa)
ma, mb = sum(pa) / n, sum(pb) / n
cov = sum((x - ma) * (y - mb) for x, y in zip(pa, pb)) / n
va = sum((x - ma) ** 2 for x in pa) / n
vb = sum((y - mb) ** 2 for y in pb) / n
corr = cov / ((va * vb) ** 0.5) if va and vb else 1.0

print(f'{a_path}  vs  {b_path}')
print(f'  战场逐像素平均差 {mean:5.2f}   变化的像素占比 {changed * 100:5.1f}%   上与左那一块的相关系数 {corr:.3f}')
