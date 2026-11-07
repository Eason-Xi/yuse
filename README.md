# 余色

一段友情怎样破裂，又怎样补上。一张实时流动的宣纸，大约十二分钟。

物理学里，“补色”还有一个名字叫“余色”：留下来的颜色，就是补得上的颜色。

## 怎么看

在线观看：<https://eason-xi.github.io/yuse/>

用新版 Chrome、Edge 或 Safari 打开，需要 WebGL2。建议戴上耳机，把灯调暗。中途会让你盯住一个字二十秒。

## 怎么做的

| 文件 | 内容 |
| --- | --- |
| `src/shaders.js` | 流体、Kubelka–Munk 减色混合、加色发光、龟裂与撕裂 |
| `src/engine.js` | WebGL2 模拟和渲染 |
| `src/text.js` | 竖排文字，字直接画进纸里 |
| `src/audio.js` | 实时合成的声音，没有音频文件 |
| `src/story.js` | 剧本和导演 |
| `tools/capture-server.js` | 逐帧录制成片用的本地服务 |

## 构建

```bash
pip3 install fonttools brotli
python3 build.py
```

`build.py` 把源码和字体子集内联成单文件 `index.html`，需要下面三款字体放在 `~/Library/Fonts`，文件名分别是 `zhuque.ttf`、`wenkai.ttf`、`mashan.ttf`。

## 出处

- 字体：朱雀仿宋、霞鹜文楷、马善政楷书，均为 SIL Open Font License。
- “丹青初则炳，久则渝”，扬雄《法言·君子》。
- “风雨急而不辍其音，霜雪零而不渝其色”，刘孝标《广绝交论》。
- 洗、揭、补、全，是中国书画修复的四道工序。
- 远看一致，近看有别，是文物修复的可识别原则。

丹和青是虚构的。
