# windlively · 清欢小院

个人主页站：一方像素小院的外观，装着六个小工具、手记与作品。主标语「人间有味是清欢」。

## 技术栈

- Angular 22（standalone / signals / zoneless）+ TypeScript 6
- 样式：SCSS；设计规范见 `DESIGN.md`，可交互设计稿在 `design-preview/`
- 测试：Vitest（`npm test`）

## 开发

```bash
npm install          # 依赖（.npmrc 打开 legacy-peer-deps，绕开 npm 10 + jsdom 可选 peer 的崩溃）
npm start            # ng serve，带 proxy.conf.json（/starry → 后端 8899）
npm run build        # 产物在 dist/windlively
npm test
```

## 内容与资源同步

```bash
npm run sync:content   # 博客文章 + GitHub/Gitee 仓库快照 → public/content/*.json
npm run sync:activity  # 近一年 GitHub 贡献日历快照（依赖已登录的 gh CLI）→ public/content/activity.json
npm run sync:monaco    # monaco-editor 运行时代码 → public/monaco/（npm install 的 postinstall 会自动执行）
```

快照数据在前端按「实时接口 → 本地缓存 → 构建快照」三级回退使用，页面标注数据来源与截止时间。

## 目录

```
src/app/features/home/     首页：左栏画框（小猫）、问候区 + 右上角小景、活跃日历条、图标页签、四个面板
src/app/features/home/yard/  小景 canvas 组件（小猫精灵、溪流+垂柳、活跃日历）
src/app/features/tools/    六个工具页（OCR / 图片工具 / JSON 预览 / 单位转换 / Monaco / 实验室）与共享外壳
src/app/shared/ui/         图标、页签、拖拽区、复制按钮、灯箱、JSON 树、toast 等工具页组件
src/app/core/              内容快照服务（读取/缓存/实时升级）
scripts/                   copy-monaco / sync-content / sync-activity
design-preview/            设计稿与验收截图（实施的事实来源；构建产物不进仓库）
public/content/            内容快照（构建时生成、随仓库提交）
public/monaco/             Monaco 资源（npm install 时生成，不入库）
```

## 备注

- 路由使用 hash 模式（`withHashLocation`），静态托管（GitHub Pages / Gitee / nginx）均可直达。
- OCR 后端契约保持 `POST /starry/ocr/general-basic|handwriting`（`FormData.image` 为 DataURL、携带凭据、响应 `{ success, data, msg? }`），路径前缀不随品牌改名。
- 活跃足迹为 GitHub 贡献日历口径（含提交、Issue、PR 等），快照缺省时页面会明确提示并保留 GitHub 入口。
