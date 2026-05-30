# MedView 本地功能说明

本文档记录在 OHIF Viewer 基础上新增的两项定制功能：

1. **界面样式改造（MedView 品牌化）**
2. **「添加数据」本地上传 + SQLite DICOM 后端**

---

## 一、界面样式改造

为让界面区别于原始开源项目（OHIF Viewer），对主题与品牌做了如下调整：

| 项目 | 原始 OHIF | 改造后（MedView） |
|------|-----------|-------------------|
| 主题色 | 蓝色系 | 深灰蓝 + 翡翠绿（医疗风格） |
| 品牌标识 | OHIF Logo | `MedView` 文字 / Logo |
| 主界面背景 | 纯黑 | 深灰蓝 `#020617` |
| 主操作按钮 | 蓝色文字链接 | 绿色圆角实心按钮 |
| 列表文案 | Study List / 检查列表 | 数据列表 |

### 涉及的文件

- `platform/ui-next/src/tailwind.css` — 主题 CSS 变量（亮/暗色）
- `platform/ui/tailwind.config.js` — 调色板（primary / secondary / actions 等）
- `platform/ui-next/src/components/Header/Header.tsx` — 顶栏品牌标识（MedView 文字回退）
- `platform/ui-next/src/components/NavBar/NavBar.tsx` — 顶栏边框 / 阴影
- `platform/ui/src/components/StudyListFilter/StudyListFilter.tsx` — 列表头部与按钮样式
- `platform/app/src/routes/WorkList/WorkList.tsx` — 主界面背景色
- `platform/i18n/src/locales/{zh,en-US}/StudyList.json` — 文案与 `AddData` 翻译

> 品牌名称、Logo 图片等可在 `platform/app/public/config/local_sqlite.js` 的 `whiteLabeling.createLogoComponentFn` 中进一步自定义。

---

## 二、「添加数据」功能与 SQLite 后端

### 功能概述

主界面数据列表左上角新增绿色 **「添加数据」** 按钮，点击后弹出上传对话框，支持从本地选择 **单个 DICOM 文件** 或 **整个文件夹** 上传。上传的影像会保存到后端，并在列表中显示，可直接打开查看。

数据通过 **DICOMweb（STOW-RS）** 协议上传，因此复用了 OHIF 既有的上传组件，无需额外前端逻辑。

### 后端架构

后端是一个独立的轻量 Node 服务，位于 `server/` 目录：

```
浏览器（OHIF 前端）
    │  QIDO / WADO / STOW (DICOMweb)
    ▼
server/ (Express)
    ├── SQLite (node:sqlite)  → 存储 study / series / instance 元数据
    └── 文件系统               → 存储原始 .dcm 文件
```

- **元数据存储**：使用 Node.js 内置的 `node:sqlite` 模块（无需编译原生依赖），数据库文件 `server/data/medview.db`
- **文件存储**：原始 DICOM 文件按 `study/series/sop.dcm` 层级保存在 `server/data/dicom/`

### 数据库结构

| 表 | 说明 |
|----|------|
| `studies` | 检查级元数据（患者、检查日期、描述、模态、实例数等） |
| `series` | 序列级元数据 |
| `instances` | 实例级元数据 + DICOM 文件路径 + QIDO JSON |

### API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/dicomweb/studies` | QIDO：查询所有检查 |
| `GET` | `/dicomweb/studies/:studyUID/series` | QIDO：查询序列 |
| `GET` | `/dicomweb/studies/:studyUID/metadata` | WADO：检查级元数据 |
| `GET` | `/dicomweb/studies/:studyUID/series/:seriesUID/metadata` | WADO：序列级元数据 |
| `GET` | `/dicomweb/.../instances/:instanceUID` | WADO：检索 DICOM 实例 |
| `GET` | `/dicomweb/.../instances/:instanceUID/frames/:frame` | WADO：检索像素帧 |
| `POST` | `/dicomweb/studies` | STOW：上传 DICOM（前端上传走此接口） |
| `POST` | `/api/upload` | REST 备用上传接口（multipart 表单） |
| `GET` | `/api/health` | 健康检查，返回检查数量 |

> 后端默认监听 **5100** 端口（避开 macOS 上常被占用的 5000 端口）。

### 涉及的文件

- `server/index.js` — Express 服务与 DICOMweb / REST 路由
- `server/db.js` — SQLite 初始化与增删查
- `server/dicomUtils.js` — DICOM 解析、元数据提取、QIDO 行构造
- `server/package.json` — 依赖（express / cors / multer / dcmjs）
- `platform/app/public/config/local_sqlite.js` — 前端数据源配置（指向本地后端）
- `rsbuild.config.ts`、`platform/app/.webpack/webpack.pwa.js` — 开发代理（`/dicomweb`、`/api` → `:5100`）

---

## 三、启动方式

### 方式一：一键启动（推荐）

在项目根目录执行：

```bash
yarn dev:local
```

该脚本（`.scripts/dev-local.sh`）会自动安装后端依赖（首次）、启动 SQLite 后端，并以本地数据源配置启动前端。

### 方式二：前后端分别启动

```bash
# 终端 1 —— 后端
yarn server:install   # 仅首次需要
yarn server:start

# 终端 2 —— 前端
cd platform/app && yarn dev:local
```

### 访问地址

- 前端：http://localhost:3000
- 后端：http://localhost:5100

---

## 四、使用流程

1. 启动服务（见上）。
2. 浏览器打开前端主界面。
3. 点击左上角绿色 **「添加数据」** 按钮。
4. 选择本地 DICOM 文件或文件夹，开始上传。
5. 上传完成后列表自动刷新，点击对应检查即可查看影像。

---

## 五、相关 npm 脚本

| 脚本 | 作用 |
|------|------|
| `yarn dev:local` | 一键启动后端 + 前端（本地数据库模式） |
| `yarn server:install` | 安装后端依赖 |
| `yarn server:start` | 启动后端 |
| `yarn server:dev` | 以 watch 模式启动后端 |

---

## 六、环境要求

- **Node.js ≥ 22.5.0**（后端依赖内置 `node:sqlite` 模块）
- 数据目录 `server/data/`（`dicom/` 与 `*.db` 已在 `server/.gitignore` 中忽略，不会提交上传的影像与数据库）
