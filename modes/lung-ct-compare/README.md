# @ohif/mode-lung-ct-compare

Mode route name: `lung-ct-compare`（URL 第一段）。使用 `@ohif/extension-lung-ct-compare` 中的 hanging protocol `lungCtCompare`。

工作列表里的模式显示名来自 **`Modes:Lung Nodule CT Compare`**（`platform/i18n` 下 `Modes.json`，例如英文 **Lung Nodule CT Compare**、中文 **肺结节 CT 对比**）。

### 侧栏快捷操作（扩展面板）

- **交换左右序列**：对调基准侧 / 对比侧并刷新视口。  
- **复制分享链接**：生成含 `StudyInstanceUIDs`、`baselineSeriesUID`、`compareSeriesUID`、`compareLayout` 的当前页 URL（需地址栏已有 Study、且两侧序列已选）。  
- **清除布局记忆**：删除 `localStorage` 中的 `ohif.lungCtCompare.layoutPreference`。  

模式是否可选（检查列表里 CT 提示）使用 **`LungCtCompare:modeValidationOk` / `modeValidationFail`**。

---

## 每次本地验证时请执行（复制即用）

在项目根目录或 `platform/app` 下启动 Viewer（端口以终端输出为准，常见为 **3000** 或由环境变量指定）：

```bash
cd platform/app
yarn dev
```

可选：使用**同源静态 DICOM**（不依赖外网 AWS），适合无外网或排查「请求失败」：

```bash
cd platform/app
cross-env APP_CONFIG=config/dicomweb_relative.js yarn dev
```

（若未安装 `cross-env`，可先 `cd platform/app` 后在该目录用 `export APP_CONFIG=config/dicomweb_relative.js` 再 `yarn dev`。）

Playwright E2E（需先安装浏览器：`npx playwright install`）：

```bash
cd /path/to/Viewers
npx playwright test tests/LungCtCompare.spec.ts --project=chromium
```

---

## URL 写法（数据源段勿省略）

OHIF 路由形如：`/{mode}/{数据源名}?查询参数`。数据源名必须与 `app-config` 里注册的 `sourceName` 一致（如 `ohif`、`dicomweb`、`e2e`）。

推荐显式写出数据源，避免用到错误的 active 数据源：

- 默认配置（`config/default.js`，默认数据源 **ohif** → 公网 AWS CloudFront）：

  `http://localhost:<端口>/lung-ct-compare/ohif?StudyInstanceUIDs=<StudyUID>`

- 若使用 **dicomweb_relative** 配置启动：

  `http://localhost:<端口>/lung-ct-compare/dicomweb?StudyInstanceUIDs=<StudyUID>`

工作列表首页指定数据源：

`http://localhost:<端口>/?datasources=ohif`

（查询参数为 **`datasources`**，注意末尾 **s**。）

可选：按序列预选（值为 **SeriesInstanceUID**）：

`/lung-ct-compare/ohif?StudyInstanceUIDs=<studyUid>&baselineSeriesUID=<seriesA>&compareSeriesUID=<seriesB>`

### 布局（双阶段 Hanging Protocol）

- **左侧「肺结节 CT 对比」面板 →「布局」**：在「双窗 + 底部三维」与「仅双窗对比」之间切换（内部调用默认扩展的 `setHangingProtocol`，stage id 分别为 `lungCtCompare3d` / `lungCtCompare2Up`）。所选布局会写入浏览器 **`localStorage`** 键 `ohif.lungCtCompare.layoutPreference`（`3d` / `2up`），下次进入本模式且在 **`lungCtCompare` 协议就绪后**自动套用（优先级低于 URL 里的 `compareLayout`）。
- **可选查询参数 `compareLayout`**（首次进入时在协议就绪后自动套用一次）：
  - `compareLayout=3d` → 三格布局（含底部 volume）
  - `compareLayout=2up` → 仅左右双栈

示例：`.../lung-ct-compare/ohif?StudyInstanceUIDs=<StudyUID>&compareLayout=2up`

- **OHIF 内置参数 `stageid`**（与 Mode 路由一致，等价指定阶段）：  
  `stageid=lungCtCompare3d` 或 `stageid=lungCtCompare2Up`。

---

## 「Error: request failed / Data Source Connection Error」排查

该提示表示当前数据源在执行 **QIDO（studies.search）** 等请求时失败，常见原因如下。

1. **默认 `ohif` 数据源走公网**  
   `default.js` 中 `ohif` 指向 `https://d14fa38qiwhyfd.cloudfront.net/dicomweb`。若网络受限、DNS 异常或防火墙拦截，会出现请求失败。  
   **处理**：换 VPN/网络；或改用本地/局域网 DICOMweb（Orthanc、DCM4CHEE）；或使用上面的 **`APP_CONFIG=config/dicomweb_relative.js`** + 路由 **`/lung-ct-compare/dicomweb`**（需 dev server 能访问 `/dicomweb` 静态数据）。

2. **URL 未带数据源段**  
   仅用 `/lung-ct-compare?StudyInstanceUIDs=...` 时依赖 ExtensionManager 的 **active** 数据源；若与预期不一致，可能连错源。  
   **处理**：始终使用 **`/lung-ct-compare/<数据源名>?...`**。

3. **Study UID 在当前数据源中不存在**  
   会表现为检查列表空或跳转到 not-found，而非 necessarily 弹「数据源」框；但若校验请求失败也可能报错。  
   **处理**：确认 UID 与所选数据源一致（同一服务器上的 Study）。

4. **浏览器控制台 Network**  
   查看失败的请求 URL、HTTP 状态码（401/403/CORS/failed）。把失败请求的完整 URL 与配置里的 `qidoRoot`/`wadoRoot` 对照。

---

## 相关代码位置

- 数据源包装与错误弹窗：`platform/app/src/routes/DataSourceWrapper.tsx`
- 模式路由生成：`platform/app/src/routes/buildModeRoutes.tsx`（路径 `{mode.routeName}/{sourceName}`）
