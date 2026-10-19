# 结节掩膜评估工具

安装评估依赖：`python -m pip install -r evaluation/requirements.txt`。

清单为 JSON 数组，每行对应一个结节；预测和参考掩膜必须处于相同栅格，保存为 `[z,y,x]` 顺序的三维 NumPy `.npy` 二值数组：

```json
[{"case_id":"case-001-nodule-01","patient_id":"patient-001","nodule_type":"solid","diameter_mm":8.2,"spacing_zyx_mm":[1.0,0.7,0.7],"prediction":"pred/case-001.npy","reference":"reference/case-001.npy"}]
```

执行 `python evaluation/evaluate_masks.py evaluation/manifest.json --output evaluation/report.json`。输出逐结节 Dice、按物理间距计算的 HD95（毫米）、体积相对误差和空掩膜标记，并汇总总体及结节类型、直径、层间距的中位数、四分位数、结节数和患者数。直径组为 `<6 mm`、`6–<10 mm`、`≥10 mm` 和未提供；层间距组为 `≤1 mm`、`>1–3 mm`、`>3 mm`。体积误差以参考体积为分母；空参考不计算该值但会计数。此工具不负责患者级数据拆分、交互成本、失败类型判定或配对置信区间；报告前仍须冻结拆分并补充这些记录，同患者结节不能视作独立患者样本。
