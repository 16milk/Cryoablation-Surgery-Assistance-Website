# MedView DICOM 本地后端

为 MedView（基于 OHIF Viewer）提供的轻量本地后端：使用 **SQLite** 存储 DICOM 元数据，文件系统存储原始 `.dcm` 文件，并对前端暴露 **DICOMweb（QIDO / WADO / STOW）** 接口。

> 完整功能说明见 `docs/medview-本地功能说明.md`。

## 运行

```bash
yarn install   # 首次
yarn start     # 启动，默认端口 5100
yarn dev       # watch 模式
```

可通过环境变量 `PORT` 修改端口：`PORT=6000 yarn start`。

## 目录结构

```
server/
├── index.js        # Express 服务 + DICOMweb / REST 路由
├── db.js           # SQLite 初始化与查询（node:sqlite）
├── dicomUtils.js   # DICOM 解析与元数据提取
└── data/
    ├── medview.db  # SQLite 数据库（git 忽略）
    └── dicom/      # 原始 DICOM 文件（git 忽略）
```

## 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/dicomweb/studies` | 查询所有检查（QIDO） |
| `GET` | `/dicomweb/studies/:studyUID/series` | 查询序列（QIDO） |
| `GET` | `/dicomweb/studies/:studyUID/metadata` | 检查级元数据（WADO） |
| `GET` | `/dicomweb/studies/:studyUID/series/:seriesUID/metadata` | 序列级元数据（WADO） |
| `GET` | `/dicomweb/.../instances/:instanceUID` | 检索实例（WADO） |
| `GET` | `/dicomweb/.../instances/:instanceUID/frames/:frame` | 检索像素帧（WADO） |
| `POST` | `/dicomweb/studies` | 上传 DICOM（STOW，前端上传） |
| `POST` | `/api/upload` | REST 备用上传（multipart） |
| `GET` | `/api/health` | 健康检查 |

## 环境要求

- Node.js ≥ 22.5.0（依赖内置 `node:sqlite`）
