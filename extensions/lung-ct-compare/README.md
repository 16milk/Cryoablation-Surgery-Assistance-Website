# @ohif/extension-lung-ct-compare

Registers the `lungCtCompare` hanging protocol: two CT stack viewports (first two CT series in the study) and a bottom 3D viewport on the first series.

## URL query (optional)

After `StudyInstanceUIDs`, you may pass series-level UIDs to pre-select stacks:

`...?StudyInstanceUIDs=1.2.3&baselineSeriesUID=1.2.3.4&compareSeriesUID=1.2.3.5`

Values are **SeriesInstanceUID** (DICOM), not displaySetInstanceUID.

## 数据源 / 「request failed」

若出现 **Data Source Connection Error** 或检查列表无数据，多半是 **QIDO 请求失败**（默认 `ohif` 指向公网 AWS）。排查步骤、推荐 URL 格式与本地启动命令见同级 **`modes/lung-ct-compare/README.md`**（内含「每次本地验证」命令块）。

## 布局偏好

在面板中切换「布局」后，会保存到 `localStorage` 键 **`ohif.lungCtCompare.layoutPreference`**（`3d` 或 `2up`）。下次进入模式且 `lungCtCompare` 协议就绪后会自动套用；URL 查询参数 **`compareLayout`** 优先级更高。
