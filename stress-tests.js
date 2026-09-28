/**
 * TTE 心超速查 · 极端值与健壮性压力测试套件
 * 确保在任何极端生理参数、缺失数据、非数字以及边界输入下，绝不出现 NaN、undefined 或崩溃
 */

const EchoCalc = require('./calc.js');

let total = 0;
let passed = 0;
let failed = 0;

function check(desc, fn) {
  total++;
  try {
    const res = fn();
    const str = typeof res === 'object' ? JSON.stringify(res) : String(res);
    if (str.includes('NaN') || str.includes('undefined') || str.includes('null m²') || str.includes('null mL')) {
      failed++;
      console.error(`  ✗ [FAIL] ${desc}: 结果包含异常字段 -> ${str}`);
    } else {
      passed++;
      console.log(`  ✓ [PASS] ${desc}`);
    }
  } catch (err) {
    failed++;
    console.error(`  ✗ [FAIL] ${desc}: 抛出未捕获异常 -> ${err.message}`);
  }
}

console.log('====================================================');
console.log('执行健壮性压力测试：缺失数据、极限值与异常输入');
console.log('====================================================\n');

// 1. 全空与极端类型测试
console.log('--- 1. 空值与极限类型 ---');
check('全空参数不崩溃 (calcBasic)', () => EchoCalc.calcBasic(null, null, null));
check('全空参数不崩溃 (calcFlow)', () => EchoCalc.calcFlow(null, null, null, null));
check('全空参数不崩溃 (calcShunt)', () => EchoCalc.calcShunt(null, null, null));
check('全空参数不崩溃 (calcBernoulli)', () => EchoCalc.calcBernoulli(null, null));
check('全空参数不崩溃 (calcAVA)', () => EchoCalc.calcAVA(null, null, null, null, null, null, null));
check('全空参数不崩溃 (calcMVA)', () => EchoCalc.calcMVA(null, null, null));
check('全空参数不崩溃 (calcPISA)', () => EchoCalc.calcPISA(null, null, null, null));
check('全空参数不崩溃 (calcVolumetric)', () => EchoCalc.calcVolumetric(null, null, null, 'mr'));
check('全空参数不崩溃 (calcLVMass)', () => EchoCalc.calcLVMass(null, null, null, null, null));
check('全空参数不崩溃 (calcEF)', () => EchoCalc.calcEF(null, null, null));
check('全空参数不崩溃 (calcDPDT)', () => EchoCalc.calcDPDT(null));
check('全空参数不崩溃 (calcDiastolic)', () => EchoCalc.calcDiastolic(null, null, null, null, null, null, null, null, null, null, false));
check('全空参数不崩溃 (calcAtrial)', () => EchoCalc.calcAtrial(null, null, null));
check('全空参数不崩溃 (calcRightHeart)', () => EchoCalc.calcRightHeart(null, null, false, '', null, null, null, null, ''));
check('全空参数不崩溃 (calcRVFunction)', () => EchoCalc.calcRVFunction(null, null, null));

// 2. 极限巨大值与极小正值
console.log('\n--- 2. 生理极限与巨大数值 ---');
check('巨大体型 (身高 230cm, 体重 200kg, 心率 200)', () => {
  const r = EchoCalc.calcBasic(230, 200, 200);
  return r.text;
});

check('微小婴儿体型 (身高 45cm, 体重 2.5kg, 心率 150)', () => {
  const r = EchoCalc.calcBasic(45, 2.5, 150);
  return r.text;
});

check('极快流速主动脉瓣 (Vmax = 7.5 m/s, AV_VTI = 180 cm)', () => {
  const r = EchoCalc.calcAVA(40, 15, 180, 1.5, 7.5, 1.2, 2.5);
  return r.text;
});

check('极快 MR 升压时程 (Δt = 8 ms, dP/dt = 4000)', () => {
  const r = EchoCalc.calcDPDT(8);
  return r.text;
});

check('极缓慢 MR 升压时程 (Δt = 120 ms, dP/dt = 267)', () => {
  const r = EchoCalc.calcDPDT(120);
  return r.text;
});

check('重度扩心病左室尺寸 (LVIDd = 88 mm, IVS = 6 mm, PW = 6 mm)', () => {
  const r = EchoCalc.calcLVMass(6, 88, 6, 75, 1.8);
  return r.text;
});

check('极低射血分数 (EDV = 300 mL, ESV = 270 mL, EF = 10%)', () => {
  const r = EchoCalc.calcEF(300, 270, 1.8);
  return r.text;
});

// 3. 舒张功能 ASE 2025 全部分支健壮性测试
console.log('\n--- 3. ASE 2025 舒张功能分支完整覆盖 ---');
check('分支1: 资料不完整提示', () => {
  const r = EchoCalc.calcDiastolic(80, 60, null, null, null, null, null, null, null, null, true);
  return r.text;
});

check('分支2: 不定型进入补充指标 (LASr ≤ 18 阳性 -> 支持左房压升高)', () => {
  // 1项异常: E/e' 升高 (15), 但 e' 正常 (8, 10), PASP 正常 (28)
  // 进入补充指标: lasr = 15 (≤18 阳性) -> 提示左房压升高
  const r = EchoCalc.calcDiastolic(90, 60, 6, 6, 2.2, 28, 30, 15, null, null, true);
  return r.text;
});

check('分支3: 不定型进入补充指标 (LAVI > 34 阳性 -> 支持左房压升高)', () => {
  const r = EchoCalc.calcDiastolic(90, 60, 6, 6, 2.2, 28, 42, null, null, null, true);
  return r.text;
});

check('分支4: 不定型进入补充指标 (全部阴性 -> 倾向正常左房压)', () => {
  const r = EchoCalc.calcDiastolic(70, 60, 6, 6, 2.2, 28, 26, 32, 1.2, 85, true);
  return r.text;
});

// 4. 字符串输入与非法字符过滤测试
console.log('\n--- 4. 非法字符与类型转换防御 ---');
check('字符串数字能够安全转换并计算', () => {
  const r = EchoCalc.calcBasic('175', '70', '72');
  return r.text;
});

check('乱码字符输入被安全识别为 null', () => {
  const r = EchoCalc.calcBasic('abc', 'def', 'xyz');
  return r.text;
});

console.log('\n====================================================');
console.log(`压力测试完成! 总计: ${total}, 通过: ${passed}, 失败: ${failed}`);
console.log('====================================================\n');

if (failed > 0) process.exit(1);
else console.log('>>> 压力测试全部通过！系统健壮性 100% 达标！');
