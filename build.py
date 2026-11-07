#!/usr/bin/env python3
"""把源码和字体子集内联成单个 HTML。字体均为 SIL OFL 授权。"""
import base64, io, os, re, sys
from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, 'src')
FONTS = os.path.expanduser('~/Library/Fonts')
ORDER = ['shaders.js', 'engine.js', 'text.js', 'audio.js', 'story.js', 'main.js']

js = '\n'.join(open(os.path.join(SRC, f), encoding='utf8').read() for f in ORDER)
tpl = open(os.path.join(SRC, 'template.html'), encoding='utf8').read()

# 只收进真正用到的字：去掉注释里的汉字
code = re.sub(r'//[^\n]*', '', js)
chars = set(c for c in code + tpl if ord(c) > 127)
chars |= set('0123456789:.,%¥ 第天：，。、？！…—～《》“”｜（）ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz')

def sub(fontfile, text):
    f = TTFont(os.path.join(FONTS, fontfile))
    o = subset.Options(); o.flavor = 'woff2'; o.layout_features = ['*']; o.hinting = False; o.desubroutinize = True
    s = subset.Subsetter(o); s.populate(text=''.join(sorted(text))); s.subset(f)
    b = io.BytesIO(); f.flavor = 'woff2'; f.save(b)
    return base64.b64encode(b.getvalue()).decode()

faces = []
for name, file, text in [
    ('YS Fang', 'zhuque.ttf', chars),
    ('YS Kai', 'wenkai.ttf', chars),
    ('YS Brush', 'mashan.ttf', set('余色调渝干洗揭补全在')),
]:
    data = sub(file, text)
    print(name, len(data) // 1024, 'KB')
    faces.append("@font-face{font-family:'%s';src:url(data:font/woff2;base64,%s) format('woff2');font-display:block}" % (name, data))

out = tpl.replace('/*__FONTS__*/', '\n'.join(faces)).replace('/*__JS__*/', js)
# yuse.html 给 Artifact 用（外壳由平台补），index.html 是可以直接部署的完整页面
open(os.path.join(ROOT, 'yuse.html'), 'w', encoding='utf8').write(out)
dst = os.path.join(ROOT, 'index.html')
open(dst, 'w', encoding='utf8').write('<!doctype html>\n<html lang="zh-CN">\n' + out + '</html>\n')
print('index.html', os.path.getsize(dst) // 1024, 'KB,', len(chars), 'chars')
