/**
 * TTE 心超速查 · 核心计算单元测试套件
 * 覆盖全部 15 组计算器、边界值、异常值校验及 ASE/ESC 指南判断分支
 */

const EchoCalc = require('./calc.js');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, testName, details = '') {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ [PASS] ${testName}`);
  } else {
    failedTests++;
    console.error(`  ✗ [FAIL] ${testName} - ${details}`);
  }
}

function assertClose(actual, expected, tolerance = 0.05, testName) {
  const diff = Math.abs(actual - expected);
  assert(diff <= tolerance, testName, `Expected ≈ ${expected}, got ${actual} (diff: ${diff.toFixed(4)})`);
}

console.log('====================================================');
console.log('开始执行 TTE 心超计算器全量数学与临床逻辑测试');
console.log('====================================================\n');

// 1. 基础信息 & BSA & BMI
console.log('--- 测试组 1: BSA 与基础信息 (calcBasic) ---');
{
  const r1 = EchoCalc.calcBasic(170, 65, 75);
  // Mosteller: sqrt(170 * 65 / 3600) = sqrt(3.0694) ≈ 1.752
  assertClose(r1.bsa, 1.752, 0.01, 'BSA 计算正常值 (170cm, 65kg)');
  assertClose(r1.bmi, 22.49, 0.05, 'BMI 计算正常值');
  assert(r1.hr === 75, '心率保留正确');
  assert(r1.text.includes('BSA: 1.75 m²'), '文案展示包含正确 BSA');

  // 空值或负值测试
  const r2 = EchoCalc.calcBasic('', null, undefined);
  assert(r2.bsa === null && r2.bmi === null, '空输入时输出 null');
  assert(r2.text === '等待输入身高体重', '空输入时提示文案');

  const r3 = EchoCalc.calcBasic(-170, 65, 75);
  assert(r3.bsa === null, '负数身高无效过滤');
}

// 2. LVOT · SV 与 CO
console.log('\n--- 测试组 2: LVOT 每搏量与心排量 (calcFlow) ---');
{
  // ld = 2.0cm -> csa = π * 1 = 3.1416 cm2; lvti = 20cm -> sv = 62.83 mL
  const r1 = EchoCalc.calcFlow(2.0, 20, 70, 1.75);
  assertClose(r1.area, 3.1416, 0.01, 'LVOT CSA 面积计算');
  assertClose(r1.sv, 62.83, 0.1, '每搏量 SV 计算');
  assertClose(r1.co, 4.398, 0.05, '心排量 CO (SV*HR/1000)');
  assertClose(r1.svi, 35.9, 0.1, '每搏量指数 SVi (SV/BSA)');
  assertClose(r1.ci, 2.51, 0.05, '心脏指数 CI (CO/BSA)');
  assert(!r1.text.includes('低流量提示'), 'SVi ≥ 35 不提示低流量');

  // 低流量提示测试
  const r2 = EchoCalc.calcFlow(1.8, 15, 60, 2.0);
  assert(r2.svi < 35, 'SVi < 35 mL/m² 计算正确');
  assert(r2.text.includes('低流量提示'), 'SVi < 35 正确触发低流量提示');
}

// 3. Qp/Qs 肺体循环比
console.log('\n--- 测试组 3: Qp/Qs 肺体循环比 (calcShunt) ---');
{
  // rd = 2.0, rvti = 20 -> Qp = 3.1416 * 20 = 62.83; Qs = 62.83 -> ratio = 1.0
  const r1 = EchoCalc.calcShunt(2.0, 20, 62.83);
  assertClose(r1.ratio, 1.0, 0.05, '平衡状态 Qp/Qs = 1.0');
  assert(r1.text.includes('平衡分流'), '平衡分流文案');

  // 左向右分流 (ASD/VSD)
  const r2 = EchoCalc.calcShunt(2.8, 25, 60);
  assert(r2.ratio > 1.5, '左向右分流 Qp/Qs > 1.5 计算');
  assert(r2.text.includes('明显左向右分流'), '明显左向右分流提示');
}

// 4. 伯努利压差
console.log('\n--- 测试组 4: 伯努利方程压差 (calcBernoulli) ---');
{
  // 简便法: 4 * 4^2 = 64
  const r1 = EchoCalc.calcBernoulli(4.0, 0);
  assertClose(r1.dp, 64, 0.01, '简便法 ΔP = 4*V2^2');
  assert(r1.text.includes('简便法: 4×4²'), '简便法文案');

  // 修正法: 4 * (4^2 - 1^2) = 4 * 15 = 60
  const r2 = EchoCalc.calcBernoulli(4.0, 1.0);
  assertClose(r2.dp, 60, 0.01, '修正法 ΔP = 4*(V2^2 - V1^2)');
  assert(r2.text.includes('修正法: 4×[4² - 1²]'), '修正法文案');

  // 异常：V1 > V2
  const r3 = EchoCalc.calcBernoulli(2.0, 3.0);
  assert(r3.error === true, 'V1 > V2 错误标记捕获');
  assert(r3.text.includes('近端速度 V₁ 不能大于远端速度 V₂'), 'V1 > V2 错误提示文案');
}

// 5. 主动脉瓣口面积 AVA
console.log('\n--- 测试组 5: 主动脉瓣口面积 AVA (calcAVA) ---');
{
  // sv = 60 mL, avti = 80 cm -> ava = 0.75 cm2 (重度狭窄)
  // lvti = 20, avti = 80 -> dvi = 0.25
  const r1 = EchoCalc.calcAVA(60, 20, 80, 1.75, 4.5, 1.0, 2.8);
  assertClose(r1.ava, 0.75, 0.02, 'AVA = SV / AV_VTI');
  assertClose(r1.dvi, 0.25, 0.02, 'DVI = LVOT_VTI / AV_VTI');
  assertClose(r1.avai, 0.428, 0.02, 'AVAi = AVA / BSA');
  assert(r1.text.includes('重度狭窄'), 'AVA < 1.0 判定为重度狭窄');

  // 中度狭窄: AVA 1.2
  const r2 = EchoCalc.calcAVA(60, 20, 50, 1.75, 3.2, 1.0, null);
  assertClose(r2.ava, 1.2, 0.02, 'AVA 中度狭窄计算');
  assert(r2.text.includes('中度狭窄'), 'AVA 1.0-1.5 判定为中度狭窄');
}

// 6. 二尖瓣口面积 MVA
console.log('\n--- 测试组 6: 二尖瓣口面积 MVA (calcMVA) ---');
{
  // PHT = 220 ms -> MVA = 220/220 = 1.0 cm2
  const r1 = EchoCalc.calcMVA(220, 50, 60);
  assertClose(r1.mva_pht, 1.0, 0.01, 'PHT 220ms -> MVA = 1.0 cm²');
  assert(r1.text.includes('非常严重狭窄 (≤1.0)'), 'MVA ≤ 1.0 判定严重狭窄');

  // PHT = 150 ms -> MVA = 1.47 cm2
  const r2 = EchoCalc.calcMVA(150, 50, 60);
  assertClose(r2.mva_pht, 1.466, 0.02, 'PHT 150ms 面积计算');
  assert(r2.text.includes('临床显著狭窄 (≤1.5)'), 'MVA 1.0-1.5 判定显著狭窄');
  assertClose(r2.mva_cont, 1.2, 0.02, '连续方程 MVA = SV / MV_VTI');
}

// 7. PISA 反流定量
console.log('\n--- 测试组 7: PISA 反流定量 (calcPISA) ---');
{
  // r = 0.9 cm, va = 40 cm/s -> Flow = 2 * π * 0.81 * 40 = 203.57 mL/s
  // regv = 5.0 m/s -> eroa = 203.57 / 500 = 0.407 cm2 (重度)
  // regvti = 150 cm -> rvol = 0.407 * 150 = 61.07 mL (重度)
  const r1 = EchoCalc.calcPISA(0.9, 40, 5.0, 150);
  assertClose(r1.flow, 203.57, 0.5, 'PISA 峰值流量计算');
  assertClose(r1.eroa, 0.407, 0.02, 'EROA 计算');
  assertClose(r1.rvol, 61.07, 0.5, 'RVol 反流容积计算');
  assert(r1.text.includes('重度反流 (EROA ≥ 0.40 cm²)'), 'EROA ≥ 0.40 重度提示');
  assert(r1.text.includes('重度 (≥60mL)'), 'RVol ≥ 60mL 重度提示');

  // 轻度反流
  const r2 = EchoCalc.calcPISA(0.5, 40, 5.0, 80);
  assert(r2.eroa < 0.20, '轻度反流 EROA < 0.20');
  assert(r2.text.includes('轻度反流'), '轻度反流提示');
}

// 8. 容积法反流量 / 反流分数
console.log('\n--- 测试组 8: 容积法反流量 / 反流分数 (calcVolumetric) ---');
{
  // md = 3.0 cm -> csa = 7.068 cm2; mavti = 18 -> msv = 127.23 mL
  // sv = 60 mL -> 孤立 MR: rvol = 127.23 - 60 = 67.23 mL; rf = 67.23 / 127.23 = 52.8%
  const r1 = EchoCalc.calcVolumetric(3.0, 18, 60, 'mr');
  assertClose(r1.rvol, 67.23, 0.5, '容积法 MR RVol 计算');
  assertClose(r1.rf, 52.8, 0.5, '容积法 MR 反流分数 RF 计算');
  assert(r1.text.includes('重度 (RF ≥ 50%)'), 'RF ≥ 50% 重度反流提示');

  // 孤立 AR: 主动脉总搏出量(LVOT SV)大于二尖瓣前向流入(msv)
  // sv = 100 mL, msv = 50 mL -> rvol = 50, rf = 50%
  const r2 = EchoCalc.calcVolumetric(2.0, 15.915, 100, 'ar');
  assertClose(r2.rvol, 50, 0.5, '容积法 AR RVol 计算');
  assertClose(r2.rf, 50, 0.5, '容积法 AR RF 计算');

  // 异常：负反流量
  const r3 = EchoCalc.calcVolumetric(2.0, 10, 80, 'mr');
  assert(r3.error === true, 'MR 负反流被识别并标记错误');
  assert(r3.text.includes('计算得到负反流量'), '负反流量提示文案');
}

// 9. 左室质量 (LV Mass)、RWT 与 FS
console.log('\n--- 测试组 9: 左室质量、RWT 与 FS (calcLVMass) ---');
{
  // Devereux: 0.8 * 1.04 * [((9+46+8)/10)^3 - (46/10)^3] + 0.6
  // (6.3)^3 = 250.047; (4.6)^3 = 97.336; diff = 152.711; * 0.832 = 127.05 + 0.6 = 127.65 g
  const r1 = EchoCalc.calcLVMass(9, 46, 8, 28, 1.75, true);
  assertClose(r1.mass, 127.65, 0.5, 'Devereux 左室质量计算');
  assertClose(r1.rwt, 0.348, 0.02, 'RWT = 2*PWd/LVIDd');
  assertClose(r1.lvmi, 72.9, 0.5, 'LVMi = Mass/BSA');
  assertClose(r1.fs, 39.13, 0.5, 'FS = (LVIDd-LVIDs)/LVIDd * 100');
  assert(r1.geometry === '正常构型', '正常构型判定 (RWT ≤ 0.42, LVMi 正常)');

  // 向心性肥厚: RWT > 0.42 且 LVMi > 115
  const r2 = EchoCalc.calcLVMass(14, 48, 13, null, 1.6, true);
  assert(r2.rwt > 0.42, 'RWT > 0.42 增厚');
  assert(r2.geometry === '向心性肥厚', '向心性肥厚构型判定');

  // 离心性肥厚: RWT ≤ 0.42 且 LVMi > 115
  const r3 = EchoCalc.calcLVMass(11, 65, 11, null, 1.75, true);
  assert(r3.rwt <= 0.42, 'RWT ≤ 0.42');
  assert(r3.geometry === '离心性肥厚', '离心性肥厚构型判定');

  // 向心性重构: RWT > 0.42 且 LVMi 正常
  const r4 = EchoCalc.calcLVMass(11, 40, 11, null, 1.8, true);
  assert(r4.rwt > 0.42, 'RWT > 0.42');
  assert(r4.geometry === '向心性重构', '向心性重构构型判定');

  // 异常：LVIDs > LVIDd
  const r5 = EchoCalc.calcLVMass(10, 45, 10, 50, 1.75);
  assert(r5.error === true, 'LVIDs > LVIDd 捕获');
}

// 10. 左室射血分数 LVEF
console.log('\n--- 测试组 10: 左室射血分数 LVEF (calcEF) ---');
{
  // EDV = 120, ESV = 45 -> EF = 75 / 120 = 62.5%
  const r1 = EchoCalc.calcEF(120, 45, 1.75);
  assertClose(r1.ef, 62.5, 0.1, 'LVEF 计算');
  assertClose(r1.edvi, 68.57, 0.1, 'EDVi 计算');
  assertClose(r1.esvi, 25.71, 0.1, 'ESVi 计算');
  assert(r1.text.includes('EF保留 (≥50%)'), 'HFpEF 提示');

  // HFrEF: EF ≤ 40%
  const r2 = EchoCalc.calcEF(150, 100, 1.75);
  assertClose(r2.ef, 33.33, 0.1, '减低 LVEF 计算');
  assert(r2.text.includes('EF显著减低 (≤40%)'), 'HFrEF 提示');

  // 异常：ESV > EDV
  const r3 = EchoCalc.calcEF(80, 100, 1.75);
  assert(r3.error === true, 'ESV > EDV 错误捕获');
}

// 11. MR 频谱 dP/dt
console.log('\n--- 测试组 11: MR 频谱 dP/dt (calcDPDT) ---');
{
  // Δt = 25 ms -> dP/dt = 32000 / 25 = 1280 mmHg/s
  const r1 = EchoCalc.calcDPDT(25);
  assertClose(r1.dpdt, 1280, 1, 'dP/dt = 32000/25');
  assert(r1.text.includes('收缩力正常/良好 (>1200)'), '正常收缩力判定');

  // 减低: Δt = 35 ms -> dP/dt = 914.3 mmHg/s
  const r2 = EchoCalc.calcDPDT(35);
  assert(r2.dpdt < 1000, '减低 dP/dt');
  assert(r2.text.includes('收缩力明显减低 (<1000)'), '减低收缩力判定');
}

// 12. 舒张功能 ASE 2025 算法分支
console.log('\n--- 测试组 12: 舒张功能 ASE 2025 (calcDiastolic) ---');
{
  // 分支 A: 未确认勾选
  const r0 = EchoCalc.calcDiastolic(80, 60, 9, 11, 2.0, 25, 28, 30, 1.2, 80, false);
  assert(r0.text.includes('请勾选下方确认符合 ASE 2025 窦性心律算法适用条件'), '未确认勾选提示');

  // 分支 B: 0项异常 -> 舒张功能正常
  // e' 间隔 9 (正常 >6), 侧壁 12 (正常 >7); E=75, e'_mean=10.5 -> E/e' = 7.14 (<14); PASP=25 (<35)
  const r1 = EchoCalc.calcDiastolic(75, 60, 9, 12, 2.1, 25, 28, 30, 1.2, 80, true);
  assert(r1.text.includes('左房压正常，舒张功能正常'), '0项异常判定为舒张功能正常');

  // 分支 C: 3项异常，E/A ≥ 2 -> Ⅲ 级减退
  // e' 间隔 4 (≤6), 侧壁 5 (≤7); E=110, e'_mean=4.5 -> E/e'=24.4 (≥14); PASP=42 (≥35); A=50 -> E/A=2.2 (≥2)
  const r2 = EchoCalc.calcDiastolic(110, 50, 4, 5, 3.2, 42, 45, 15, 0.5, 65, true);
  assert(r2.text.includes('支持 Ⅲ 级舒张功能减退，左房压升高'), '3项异常且 E/A ≥ 2 判定为 Ⅲ 级');

  // 分支 D: 3项异常，E/A < 2 -> Ⅱ 级减退
  const r3 = EchoCalc.calcDiastolic(80, 65, 4, 5, 3.2, 42, 45, 15, 0.5, 65, true);
  assert(r3.text.includes('支持 Ⅱ 级舒张功能减退，左房压升高'), '3项异常且 E/A < 2 判定为 Ⅱ 级');

  // 分支 E: 仅 e' 降低，且 E/A ≤ 0.8 -> Ⅰ 级减退
  // e' 间隔 5 (≤6), 侧壁 6 (≤7); E=50, A=70 (E/A = 0.71 ≤ 0.8); E/e'=50/5.5 = 9.09 (<14); PASP=26 (<35)
  const r4 = EchoCalc.calcDiastolic(50, 70, 5, 6, 2.2, 26, 28, 25, 1.1, 90, true);
  assert(r4.text.includes('支持 Ⅰ 级舒张功能减退，左房压正常'), '松弛受损且 E/A ≤ 0.8 判定为 Ⅰ 级');
}

// 13. 心房容积指数
console.log('\n--- 测试组 13: 心房容积指数 (calcAtrial) ---');
{
  // lav = 45 mL, bsa = 1.75 m2 -> lavi = 25.7 mL/m2 (正常 16-34)
  // rav = 35 mL -> ravi = 20.0 mL/m2 (正常 <30)
  const r1 = EchoCalc.calcAtrial(45, 35, 1.75);
  assertClose(r1.lavi, 25.71, 0.1, 'LAVI 计算');
  assertClose(r1.ravi, 20.0, 0.1, 'RAVI 计算');
  assert(r1.text.includes('LAVI: 25.7 mL/m² [正常 (16-34)]'), 'LAVI 正常分级');
  assert(r1.text.includes('RAVI: 20 mL/m² [右房容积正常 (<30)]'), 'RAVI 正常分级');

  // 重度增大: lav = 90 mL -> lavi = 51.4 mL/m2 (>48)
  const r2 = EchoCalc.calcAtrial(90, 60, 1.75);
  assert(r2.text.includes('重度扩大 (>48)'), 'LAVI 重度扩大判定');
  assert(r2.text.includes('右房容积增大 (≥30)'), 'RAVI 增大判定');
}

// 14. 右心压力与 PH 概率
console.log('\n--- 测试组 14: 右心压力与 PH 概率 (calcRightHeart) ---');
{
  // TR = 2.5 m/s, IVC = 16 mm, collapse = yes -> RAP = 3 mmHg
  // PASP = 4 * 2.5^2 + 3 = 25 + 3 = 28 mmHg
  // TAPSE = 22 -> TAPSE/PASP = 22 / 28 = 0.786 (>0.55 偶联良好)
  const r1 = EchoCalc.calcRightHeart(2.5, 16, false, 'yes', 22, 120, 1.2, 18, 'no');
  assert(r1.rap === 3, 'IVC ≤ 21mm & 塌陷 > 50% -> RAP = 3 mmHg');
  assertClose(r1.pasp, 28, 0.5, 'PASP 估测');
  assert(r1.text.includes('偶联良好'), 'TAPSE/PASP > 0.55 偶联良好');
  assert(r1.text.includes('PH 超声概率: 低'), 'TR ≤ 2.8 且无支持征象 -> 低概率');

  // 高危组: IVC = 24 mm, collapse = no -> RAP = 15 mmHg
  // TR = 3.8 m/s -> PASP = 4 * 14.44 + 15 = 72.76 mmHg
  const r2 = EchoCalc.calcRightHeart(3.8, 24, false, 'no', 14, 80, 2.4, 12, 'yes');
  assert(r2.rap === 15, 'IVC > 21mm & 塌陷 ≤ 50% -> RAP = 15 mmHg');
  assert(r2.text.includes('PH 超声概率: 高'), 'TR > 3.4 m/s -> 高概率');
  assert(r2.text.includes('重度失偶联'), 'TAPSE/PASP < 0.36 重度失偶联');

  // 偶联受损组 (0.36 - 0.55)
  // TR = 2.8 m/s, RAP = 3 -> PASP = 34.36; TAPSE = 16 -> 16 / 34.36 = 0.465
  const r4 = EchoCalc.calcRightHeart(2.8, 16, false, 'yes', 16, 120, 1.2, 18, 'no');
  assert(r4.text.includes('偶联受损'), 'TAPSE/PASP 0.36-0.55 偶联受损');

  // 机械通气组
  const r3 = EchoCalc.calcRightHeart(3.0, 20, true, 'yes', 18, 100, 1.5, 15, '');
  assert(r3.text.includes('机械通气: 不适用常规 IVC 塌陷法估测 RAP'), '机械通气提示');
}

// 15. 右室 FAC 与收缩功能
console.log('\n--- 测试组 15: 右室 FAC 与收缩功能 (calcRVFunction) ---');
{
  // EDA = 20, ESA = 11 -> FAC = (20-11)/20 * 100 = 45% (>35% 正常)
  // S' = 12 cm/s (>9.5 正常)
  const r1 = EchoCalc.calcRVFunction(20, 11, 12);
  assertClose(r1.fac, 45, 0.1, 'RV FAC 计算');
  assert(r1.text.includes('正常 (>35%)'), 'FAC 正常判定');
  assert(r1.text.includes('三尖瓣环 S′: 12 cm/s [正常 (>9.5)]'), 'S\' 正常判定');

  // 异常: ESA > EDA
  const r2 = EchoCalc.calcRVFunction(15, 18, 10);
  assert(r2.error === true, 'ESA > EDA 异常捕获');

  // 减低
  const r3 = EchoCalc.calcRVFunction(20, 15, 8);
  assertClose(r3.fac, 25, 0.1, '减低 FAC 25%');
  assert(r3.text.includes('中重度异常 (≤29%)'), 'FAC 减低分级');
  assert(r3.text.includes('减低 (≤9.5)'), 'S\' 减低分级');
}

console.log('\n====================================================');
console.log(`测试完成! 总计测试项: ${totalTests}, 通过: ${passedTests}, 失败: ${failedTests}`);
console.log('====================================================');

if (failedTests > 0) {
  process.exit(1);
} else {
  console.log('ALL UNIT TESTS PASSED WITH 100% SUCCESS RATE!');
}
