(function() {
  'use strict';
  const EchoCalc = window.EchoCalc;

  // DOM 选择器快捷方式
const $ = (id) => document.getElementById(id);
const $$ = (sel) => document.querySelectorAll(sel);

// 状态中心：记录当前各模块关键共享计算值
const State = {
  bsa: null,
  bmi: null,
  hr: null,
  lvot_sv: null,
  lvot_csa: null,
  lvot_vti: null,
  rap: null,
  pasp: null,
  lastCalculations: {}
};

// 预设临床典型病例（一键填入演示与公式核对）
const DEMO_CASES = {
  normal: {
    title: '健康成年人 (正常参考值)',
    data: {
      height: 172, weight: 68, hr: 72,
      ld: 2.0, lvti: 20,
      v2: 1.2, v1: 0.8,
      ivs: 9, lvidd: 46, pw: 8, lvids: 28,
      edv: 110, esv: 40,
      e: 75, a: 60, es: 9.5, el: 12.0, dtr: 2.1, dpasp: 22,
      lav: 42, rav: 35,
      tr: 2.1, ivc: 16, collapse: 'yes', tapse: 22,
      eda: 18, esa: 9, rvs: 13
    }
  },
  severe_as: {
    title: '重度主动脉瓣狭窄 (高压差型)',
    data: {
      height: 168, weight: 65, hr: 68,
      ld: 2.0, lvti: 19,
      avti: 80, avmax: 4.4, mg: 52, lvmax: 1.0, stj: 2.8,
      v2: 4.4, v1: 1.0,
      ivs: 14, lvidd: 44, pw: 13, lvids: 26,
      edv: 105, esv: 35,
      e: 95, a: 80, es: 5.0, el: 6.5, dpasp: 38,
      lav: 58,
      tr: 2.9, ivc: 19, collapse: 'yes', tapse: 18
    }
  },
  mr_pisa: {
    title: '原发性二尖瓣重度反流 (PISA定量)',
    data: {
      height: 175, weight: 75, hr: 78,
      ld: 2.0, lvti: 20,
      radius: 0.95, alias: 40, regv: 5.0, regvti: 145,
      md: 3.2, mavti: 20, lesion: 'mr',
      ivs: 10, lvidd: 62, pw: 10, lvids: 38,
      edv: 170, esv: 62,
      dt: 24, // dP/dt: 1333
      e: 120, a: 60, es: 7.0, el: 9.0, dtr: 3.1, dpasp: 45,
      lav: 78,
      tr: 3.1, ivc: 22, collapse: 'no', tapse: 19
    }
  },
  ph_rv: {
    title: '肺动脉高压与右室负荷',
    data: {
      height: 160, weight: 58, hr: 84,
      ld: 1.9, lvti: 16,
      tr: 3.8, ivc: 23, collapse: 'no', vent: false, tapse: 14, act: 85, prend: 2.2, rvti: 12, phsigns: 'yes',
      eda: 28, esa: 20, rvs: 8.5,
      rav: 65, lav: 38
    }
  }
};

// 报告模板初始文本
const DEFAULT_REPORT_TEMPLATE = `经胸超声心动图检查报告 (TTE)
检查时间：{DATE}    心律/心率：{HR} bpm    BSA：{BSA} m²    BMI：{BMI} kg/m²

【左心室结构与功能】
- 舒张末内径 (LVIDd)：{LVIDd} mm；收缩末内径 (LVIDs)：{LVIDs} mm
- 室间隔厚度 (IVSd)：{IVSd} mm；左室后壁厚度 (PWd)：{PWd} mm
- 相对室壁厚度 (RWT)：{RWT}；左室质量指数 (LVMi)：{LVMi} g/m²；构型：{GEOMETRY}
- 左室射血分数 (LVEF)：{LVEF}%；EDVi：{EDVi} mL/m²；ESVi：{ESVi} mL/m²
- 每搏量 (SV)：{SV} mL；心排量 (CO)：{CO} L/min；CI：{CI} L/min/m²

【舒张功能与左房】
- E峰：{E} cm/s；A峰：{A} cm/s；E/A：{EA}
- 平均 E/e'：{EE}；左房容积指数 (LAVI)：{LAVI} mL/m²
- 舒张功能提示：{DIASTOLIC_SUMMARY}

【瓣膜血流动力学】
- 主动脉瓣 (AV)：AVA {AVA} cm²；DVI {DVI}；AVAi {AVAi} cm²/m²；跨瓣峰值 ΔP {AV_DP} mmHg
- 二尖瓣 (MV)：PHT法 MVA {MVA} cm²；反流 EROA {EROA} cm²；反流量 RVol {RVOL} mL

【右心与肺循环】
- 三尖瓣反流峰速 (TR Vmax)：{TRV} m/s；估测 RAP：{RAP} mmHg；估测 PASP：{PASP} mmHg
- TAPSE/PASP：{TAPSE_PASP}；右室 FAC：{FAC}%；右室三尖瓣环 S'：{RVS} cm/s
- 肺高压超声概率：{PH_PROB}

【检查结论与提示】
1. {CONCLUSION_1}
2. {CONCLUSION_2}
3. {CONCLUSION_3}`;

function getInputValue(id) {
  const el = $(`c-${id}`);
  if (!el) return null;
  const val = el.value.trim();
  if (val === '') return null;
  const n = Number(val);
  return Number.isFinite(n) ? n : null;
}

function setInputValue(id, val) {
  const el = $(`c-${id}`);
  if (el) {
    el.value = (val !== null && val !== undefined) ? val : '';
  }
}

// 主计算流程
function updateAllCalculations() {
  // 1. 基础信息
  const h = getInputValue('height');
  const w = getInputValue('weight');
  const hr = getInputValue('hr');
  const basicRes = EchoCalc.calcBasic(h, w, hr);
  State.bsa = basicRes.bsa;
  State.bmi = basicRes.bmi;
  State.hr = basicRes.hr;
  $('out-basic').textContent = basicRes.text;
  updateBadge('badge-bsa', State.bsa ? `${EchoCalc.fmt(State.bsa, 2)} m²` : '未计算');

  // 2. LVOT 搏出量与心排量
  const ld = getInputValue('ld');
  const lvti = getInputValue('lvti');
  const flowRes = EchoCalc.calcFlow(ld, lvti, State.hr, State.bsa);
  State.lvot_sv = flowRes.sv;
  State.lvot_csa = flowRes.area;
  State.lvot_vti = lvti;
  $('out-flow').textContent = flowRes.text;
  updateBadge('badge-sv', State.lvot_sv ? `${EchoCalc.fmt(State.lvot_sv, 1)} mL` : '未计算');

  // 3. Qp/Qs 肺体循环血流比
  const rd = getInputValue('rd');
  const rvti = getInputValue('rvti');
  const shuntRes = EchoCalc.calcShunt(rd, rvti, State.lvot_sv);
  $('out-shunt').textContent = shuntRes.text;

  // 4. 伯努利简便/修正压差
  const v2 = getInputValue('v2');
  const v1 = getInputValue('v1');
  const bernRes = EchoCalc.calcBernoulli(v2, v1);
  $('out-bernoulli').textContent = bernRes.text;
  if (bernRes.error) $('out-bernoulli').classList.add('error');
  else $('out-bernoulli').classList.remove('error');

  // 5. 主动脉瓣口面积 AVA
  const avti = getInputValue('avti');
  const avmax = getInputValue('avmax');
  const lvmax = getInputValue('lvmax');
  const stj = getInputValue('stj');
  const avaRes = EchoCalc.calcAVA(State.lvot_sv, State.lvot_vti, avti, State.bsa, avmax, lvmax, stj);
  $('out-ava').textContent = avaRes.text;

  // 6. 二尖瓣口面积 MVA
  const pht = getInputValue('pht');
  const mvti = getInputValue('mvti');
  const mvaRes = EchoCalc.calcMVA(pht, mvti, State.lvot_sv);
  $('out-mva').textContent = mvaRes.text;

  // 7. PISA
  const pisa_r = getInputValue('radius');
  const pisa_va = getInputValue('alias');
  const pisa_v = getInputValue('regv');
  const pisa_vti = getInputValue('regvti');
  const pisaRes = EchoCalc.calcPISA(pisa_r, pisa_va, pisa_v, pisa_vti);
  $('out-pisa').textContent = pisaRes.text;

  // 8. 容积法
  const md = getInputValue('md');
  const mavti = getInputValue('mavti');
  const lesion = $('lesion') ? $('lesion').value : 'mr';
  const volRes = EchoCalc.calcVolumetric(md, mavti, State.lvot_sv, lesion);
  $('out-volume').textContent = volRes.text;
  if (volRes.error) $('out-volume').classList.add('error');
  else $('out-volume').classList.remove('error');

  // 9. 左室质量、RWT、FS
  const ivs = getInputValue('ivs');
  const lvidd = getInputValue('lvidd');
  const pw = getInputValue('pw');
  const lvids = getInputValue('lvids');
  const massRes = EchoCalc.calcLVMass(ivs, lvidd, pw, lvids, State.bsa);
  $('out-mass').textContent = massRes.text;
  if (massRes.error) $('out-mass').classList.add('error');
  else $('out-mass').classList.remove('error');

  // 10. 左室射血分数 LVEF
  const edv = getInputValue('edv');
  const esv = getInputValue('esv');
  const efRes = EchoCalc.calcEF(edv, esv, State.bsa);
  $('out-ef').textContent = efRes.text;
  if (efRes.error) $('out-ef').classList.add('error');
  else $('out-ef').classList.remove('error');

  // 11. MR dP/dt
  const dt = getInputValue('dt');
  const dpdtRes = EchoCalc.calcDPDT(dt);
  $('out-dpdt').textContent = dpdtRes.text;

  // 12. 舒张功能
  const e = getInputValue('e');
  const a = getInputValue('a');
  const es = getInputValue('es');
  const el = getInputValue('el');
  const dtr = getInputValue('dtr');
  const dpasp = getInputValue('dpasp');
  const lavi = getInputValue('lavi');
  const lasr = getInputValue('lasr');
  const sd = getInputValue('sd');
  const ivrt = getInputValue('ivrt');
  const diasConfirmed = $('diasOK') ? $('diasOK').checked : false;
  const diasRes = EchoCalc.calcDiastolic(e, a, es, el, dtr, dpasp, lavi, lasr, sd, ivrt, diasConfirmed);
  $('out-dias').textContent = diasRes.text;

  // 13. 心房容积指数
  const lav = getInputValue('lav');
  const rav = getInputValue('rav');
  const atrialRes = EchoCalc.calcAtrial(lav, rav, State.bsa);
  $('out-atrial').textContent = atrialRes.text;

  // 14. 右心压力与 PH 概率
  const tr = getInputValue('tr');
  const ivc = getInputValue('ivc');
  const isVent = $('vent') ? $('vent').checked : false;
  const collapse = $('collapse') ? $('collapse').value : '';
  const tapse = getInputValue('tapse');
  const act = getInputValue('act');
  const prend = getInputValue('prend');
  const rv_rvti = getInputValue('rv_rvti') ?? rvti;
  const phsigns = $('phsigns') ? $('phsigns').value : '';
  const rhRes = EchoCalc.calcRightHeart(tr, ivc, isVent, collapse, tapse, act, prend, rv_rvti, phsigns);
  State.rap = rhRes.rap;
  State.pasp = rhRes.pasp;
  $('out-pressure').textContent = rhRes.text;

  // 15. 右室 FAC 与收缩功能
  const eda = getInputValue('eda');
  const esa = getInputValue('esa');
  const rvs = getInputValue('rvs');
  const rvRes = EchoCalc.calcRVFunction(eda, esa, rvs);
  $('out-rvcalc').textContent = rvRes.text;
  if (rvRes.error) $('out-rvcalc').classList.add('error');
  else $('out-rvcalc').classList.remove('error');

  // 保存当前完整计算结果供报告模板填充
  State.lastCalculations = {
    basic: basicRes,
    flow: flowRes,
    shunt: shuntRes,
    bern: bernRes,
    ava: avaRes,
    mva: mvaRes,
    pisa: pisaRes,
    vol: volRes,
    mass: massRes,
    ef: efRes,
    dpdt: dpdtRes,
    dias: diasRes,
    atrial: atrialRes,
    rh: rhRes,
    rv: rvRes,
    inputs: {
      h, w, hr, ld, lvti, rd, rvti, v2, v1, avti, avmax, lvmax, stj,
      pht, mvti, pisa_r, pisa_va, pisa_v, pisa_vti, md, mavti,
      ivs, lvidd, pw, lvids, edv, esv, dt, e, a, es, el, dtr, dpasp,
      lavi, lasr, sd, ivrt, lav, rav, tr, ivc, tapse, act, prend, eda, esa, rvs
    }
  };

  // 自动刷新报告预览（如果用户未锁定手动修改）
  if (State.autoSyncReport) {
    generateReport();
  }
}

function updateBadge(id, text) {
  const el = $(id);
  if (el) el.textContent = text;
}

// 报告自动生成器
function generateReport() {
  const c = State.lastCalculations;
  if (!c || !c.inputs) return;
  const inp = c.inputs;

  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const replaceMap = {
    '{DATE}': dateStr,
    '{HR}': inp.hr ? `${inp.hr}` : '____',
    '{BSA}': State.bsa ? EchoCalc.fmt(State.bsa, 2) : '____',
    '{BMI}': State.bmi ? EchoCalc.fmt(State.bmi, 1) : '____',
    '{LVIDd}': inp.lvidd ? `${inp.lvidd}` : '____',
    '{LVIDs}': inp.lvids ? `${inp.lvids}` : '____',
    '{IVSd}': inp.ivs ? `${inp.ivs}` : '____',
    '{PWd}': inp.pw ? `${inp.pw}` : '____',
    '{RWT}': c.mass?.rwt ? EchoCalc.fmt(c.mass.rwt, 2) : '____',
    '{LVMi}': c.mass?.lvmi ? EchoCalc.fmt(c.mass.lvmi, 1) : '____',
    '{GEOMETRY}': c.mass?.geometry || '____',
    '{LVEF}': c.ef?.ef ? EchoCalc.fmt(c.ef.ef, 1) : '____',
    '{EDVi}': c.ef?.edvi ? EchoCalc.fmt(c.ef.edvi, 1) : '____',
    '{ESVi}': c.ef?.esvi ? EchoCalc.fmt(c.ef.esvi, 1) : '____',
    '{SV}': c.flow?.sv ? EchoCalc.fmt(c.flow.sv, 1) : '____',
    '{CO}': c.flow?.co ? EchoCalc.fmt(c.flow.co, 2) : '____',
    '{CI}': c.flow?.ci ? EchoCalc.fmt(c.flow.ci, 2) : '____',
    '{E}': inp.e ? `${inp.e}` : '____',
    '{A}': inp.a ? `${inp.a}` : '____',
    '{EA}': c.dias?.ea ? EchoCalc.fmt(c.dias.ea, 2) : '____',
    '{EE}': c.dias?.ee ? EchoCalc.fmt(c.dias.ee, 1) : '____',
    '{LAVI}': c.atrial?.lavi ? EchoCalc.fmt(c.atrial.lavi, 1) : (inp.lavi ? `${inp.lavi}` : '____'),
    '{DIASTOLIC_SUMMARY}': c.dias?.text?.includes('。') ? c.dias.text.split('。')[1] : '待结合临床评估',
    '{AVA}': c.ava?.ava ? EchoCalc.fmt(c.ava.ava, 2) : '____',
    '{DVI}': c.ava?.dvi ? EchoCalc.fmt(c.ava.dvi, 2) : '____',
    '{AVAi}': c.ava?.avai ? EchoCalc.fmt(c.ava.avai, 2) : '____',
    '{AV_DP}': c.bern?.dp ? EchoCalc.fmt(c.bern.dp, 1) : '____',
    '{MVA}': c.mva?.mva_pht ? EchoCalc.fmt(c.mva.mva_pht, 2) : '____',
    '{EROA}': c.pisa?.eroa ? EchoCalc.fmt(c.pisa.eroa, 2) : '____',
    '{RVOL}': c.pisa?.rvol ? EchoCalc.fmt(c.pisa.rvol, 1) : '____',
    '{TRV}': inp.tr ? `${inp.tr}` : '____',
    '{RAP}': State.rap !== null ? `${State.rap}` : '____',
    '{PASP}': State.pasp !== null ? EchoCalc.fmt(State.pasp, 1) : '____',
    '{TAPSE_PASP}': (inp.tapse && State.pasp) ? EchoCalc.fmt(inp.tapse / State.pasp, 2) : '____',
    '{FAC}': c.rv?.fac ? EchoCalc.fmt(c.rv.fac, 1) : '____',
    '{RVS}': inp.rvs ? `${inp.rvs}` : '____',
    '{PH_PROB}': c.rh?.text?.includes('PH 超声概率') ? c.rh.text.split('PH 超声概率: ')[1]?.split(' ｜ ')[0] : '未评估',
    '{CONCLUSION_1}': getAutoConclusion(1, c),
    '{CONCLUSION_2}': getAutoConclusion(2, c),
    '{CONCLUSION_3}': getAutoConclusion(3, c)
  };

  let report = DEFAULT_REPORT_TEMPLATE;
  for (const [key, val] of Object.entries(replaceMap)) {
    report = report.replaceAll(key, val);
  }

  $('reportText').value = report;
}

function getAutoConclusion(rank, c) {
  const list = [];
  if (c.ava?.ava && c.ava.ava < 1.0) list.push('主动脉瓣重度狭窄 (血流动力学显著)');
  if (c.pisa?.eroa && c.pisa.eroa >= 0.4) list.push('二尖瓣重度反流 (PISA定量重度)');
  if (c.mass?.geometry && c.mass.geometry !== '正常构型') list.push(`左心室构型异常：${c.mass.geometry}`);
  if (c.ef?.ef && c.ef.ef < 50) list.push(`左心室收缩功能减退 (LVEF ${EchoCalc.fmt(c.ef.ef, 0)}%)`);
  if (State.pasp && State.pasp >= 35) list.push(`估测肺动脉收缩压升高 (PASP ≈ ${EchoCalc.fmt(State.pasp, 0)} mmHg)`);
  if (c.rv?.fac && c.rv.fac < 35) list.push(`右心室收缩功能受损 (FAC ${EchoCalc.fmt(c.rv.fac, 0)}%)`);

  if (list.length === 0) {
    if (rank === 1) return '心内各房室腔大小及室壁厚度在正常参考范围内。';
    if (rank === 2) return '静息状态下各瓣膜未见明显器质性病变及明显血流动力学异常。';
    return '左心室整体收缩与舒张功能未见明确异常。';
  }

  return list[rank - 1] || '请结合临床综合判断，定期超声心动图随访。';
}

// 载入预设病例
function loadDemoCase(key) {
  const caseItem = DEMO_CASES[key];
  if (!caseItem) return;

  // 清空现有输入
  clearAllInputs();

  // 填入数据
  for (const [id, val] of Object.entries(caseItem.data)) {
    if (id === 'collapse') {
      const el = $('collapse');
      if (el) el.value = val;
    } else if (id === 'phsigns') {
      const el = $('phsigns');
      if (el) el.value = val;
    } else if (id === 'lesion') {
      const el = $('lesion');
      if (el) el.value = val;
    } else if (id === 'vent') {
      const el = $('vent');
      if (el) el.checked = !!val;
    } else {
      setInputValue(id, val);
    }
  }

  // 默认勾选舒张功能确认项
  const diasOK = $('diasOK');
  if (diasOK) diasOK.checked = true;

  updateAllCalculations();
  generateReport();

  // 提示用户
  const toast = $('toast');
  if (toast) {
    toast.textContent = `已载入病例：${caseItem.title}`;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2500);
  }
}

// 清空全部输入
function clearAllInputs() {
  $$('#calcApp input[type="number"]').forEach(input => {
    input.value = '';
    input.removeAttribute('aria-invalid');
  });
  $$('#calcApp select').forEach(select => {
    select.selectedIndex = 0;
  });
  $$('#calcApp input[type="checkbox"]').forEach(check => {
    check.checked = false;
  });
  updateAllCalculations();
  generateReport();

  const toast = $('toast');
  if (toast) {
    toast.textContent = '已清空全部输入与计算结果';
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2000);
  }
}

// 复制报告到剪贴板
async function copyReportToClipboard() {
  const text = $('reportText').value;
  try {
    await navigator.clipboard.writeText(text);
    const status = $('copyStatus');
    status.textContent = '✓ 已成功复制报告到剪贴板！可以直接粘贴到病历系统。';
    status.classList.add('success');
    setTimeout(() => {
      status.textContent = '';
      status.classList.remove('success');
    }, 3000);
  } catch (err) {
    $('reportText').select();
    document.execCommand('copy');
    $('copyStatus').textContent = '✓ 报告已选中并复制！';
  }
}

// 初始化交互监听
function initApp() {
  State.autoSyncReport = true;

  // 实时监听输入并计算
  const mainCalcContainer = $('calcApp');
  if (mainCalcContainer) {
    mainCalcContainer.addEventListener('input', () => {
      updateAllCalculations();
    });
    mainCalcContainer.addEventListener('change', () => {
      updateAllCalculations();
    });
  }

  // 预设病例按钮
  $$('[data-preset]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const key = e.target.dataset.preset;
      loadDemoCase(key);
    });
  });

  // 清空按钮
  const clearBtn = $('clearCalc');
  if (clearBtn) clearBtn.addEventListener('click', clearAllInputs);

  // 报告生成与复制按钮
  const copyBtn = $('copyReport');
  if (copyBtn) copyBtn.addEventListener('click', copyReportToClipboard);

  const refreshReportBtn = $('refreshReport');
  if (refreshReportBtn) refreshReportBtn.addEventListener('click', () => {
    generateReport();
    const status = $('copyStatus');
    status.textContent = '✓ 报告已根据最新数据刷新！';
    setTimeout(() => { status.textContent = ''; }, 2000);
  });

  // 主题切换 (Dark / Light)
  const themeBtn = $('themeToggle');
  if (themeBtn) {
    const savedTheme = localStorage.getItem('echo_theme') || 'light';
    if (savedTheme === 'dark') document.documentElement.classList.add('dark');
    themeBtn.addEventListener('click', () => {
      const isDark = document.documentElement.classList.toggle('dark');
      localStorage.setItem('echo_theme', isDark ? 'dark' : 'light');
      themeBtn.textContent = isDark ? '☀️ 浅色模式' : '🌙 深色模式';
    });
    themeBtn.textContent = document.documentElement.classList.contains('dark') ? '☀️ 浅色模式' : '🌙 深色模式';
  }

  // 快捷搜索定位功能
  const searchInput = $('calcSearch');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase().trim();
      $$('.calc-card').forEach(card => {
        const text = card.textContent.toLowerCase();
        if (!q || text.includes(q)) {
          card.style.display = '';
        } else {
          card.style.display = 'none';
        }
      });
    });
  }

  // 首次运行：加载标准正常参考演示
  loadDemoCase('normal');
}

  // 页面加载完成后启动
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }
})();
