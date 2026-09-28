# TTE 心超速查 · 临床计算套件 (Echocardiography Calculator Suite)

![Version](https://img.shields.io/badge/version-1.0.0-red.svg)
![Standard](https://img.shields.io/badge/standard-ASE%202025%20%7C%20ESC%202025-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

> 基于 **ASE 2025**（美国超声心动图学会）、**ESC/EACTS 2025**（欧洲心脏病学会）最新指南标准规范构建的高精度、全自动化、可真实交互计算的成人经胸超声心动图 (TTE) 临床辅助计算系统。

---

## 🌟 核心特性

1. **跨卡片全域数据级联**：
   - 基础信息输入身高、体重即刻生成体表面积（BSA），自动透传至下游所有指数化参数（SVi、CI、AVAi、LVMi、EDVi、ESVi、LAVI、RAVI）。
   - LVOT 内径与 VTI 测定后，即时计算每搏量（SV），自动注入主动脉瓣狭窄连续方程、二尖瓣反流容积法与 Qp/Qs 肺体循环比中，无需重复录入。
2. **涵盖 15 组核心临床定量模块**：
   - **基础与血流**：BSA / BMI、LVOT SV / CO / CI / SVi、Qp/Qs 肺体分流比、伯努利压差（含简便法与修正法）。
   - **瓣膜病变**：连续性方程 AVA / DVI / AVAi / ELI、PHT 法 MVA 与连续方程 MVA、PISA 法 EROA / RVol、容积法反流量与反流分数。
   - **形态构型与收缩**：Devereux 公式左室质量（LVMi / RWT 与 4 种几何构型自动判定）、双平面 Simpson 容积法 LVEF、二尖瓣反流频谱 $dP/dt$。
   - **舒张功能与双房**：完整实现 **ASE 2025** 窦性心律分级决策树（结合首轮与次轮补充指标 LASr、LAVI、PV S/D、IVRT）、LAVI / RAVI。
   - **右心系统**：IVC 估测 RAP、PASP、TAPSE/PASP 偶联指数、PADP、经验 PVR、ESC/ERS 2022 PH 概率分级、RV FAC 与三尖瓣环 $S'$。
3. **中文心超报告智能生成**：
   - 上方各卡片数据实时回填至规范的中文超声心动图结构化报告中，支持手动编辑并一键复制到剪贴板。
4. **4 组典型病例一键演示**：
   - 健康成年人参考、重度主动脉瓣狭窄 (Severe AS)、二尖瓣重度反流 (PISA 定量)、肺高压与右室负荷。

---

## 📖 参考指南与规范

- **ASE 2025**：*Recommendations for the Evaluation of Left Ventricular Diastolic Function and HFpEF* (Figure 3)
- **ASE 2025**：*Guidelines for the Echocardiographic Assessment of the Right Heart in Adults and Pulmonary Hypertension* (Table 1)
- **ESC/EACTS 2025**：*Guidelines for the Management of Valvular Heart Disease*
- **ESC/ERS 2022**：*Guidelines for the Diagnosis and Treatment of Pulmonary Hypertension*
- **ASE/EACVI 2015/2017**：*Recommendations for Cardiac Chamber Quantification & Native Valvular Regurgitation*

---

## 💻 本地运行

该项目为零外部依赖的纯原生前端架构（Vanilla HTML + CSS + JS），支持任意现代浏览器：

1. **直接双击运行**：
   在文件管理器中直接双击 `index.html` 即可在本地完全离线使用。
2. **轻量本地服务运行**：
   ```bash
   # Python
   python -m http.server 8080
   
   # 或 Node.js
   npx serve .
   ```

---

## 🛡️ 临床声明

本工具仅用于医学教育、培训辅助与临床测量速查，不能替代医师的独立专业临床判断。具体诊疗方案请结合患者完整病史、体征及多声窗超声图像综合决策。
