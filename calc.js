(function(global) {
  'use strict';
  const EchoCalc = {
  // 辅助验证
  valid(...args) {
    return args.every(v => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v)));
  },

  num(val) {
    return val === null || val === undefined || val === '' ? null : Number(val);
  },

  fmt(n, d = 2) {
    return Number.isFinite(n) ? Number(n.toFixed(d)).toString() : '—';
  },

  /**
   * 1. 基础信息 & BSA & BMI
   * @param {number} height 身高 (cm)
   * @param {number} weight 体重 (kg)
   * @param {number} hr 心率 (次/min)
   */
  calcBasic(height, weight, hr) {
    const h = this.num(height);
    const w = this.num(weight);
    const r = this.num(hr);

    let bsa = null;
    let bmi = null;

    if (this.valid(h, w) && h > 0 && w > 0) {
      bsa = Math.sqrt((h * w) / 3600); // Mosteller 公式
      bmi = w / Math.pow(h / 100, 2);
    }

    return {
      bsa,
      bmi,
      hr: r,
      text: bsa ? `BSA: ${this.fmt(bsa, 2)} m² ｜ BMI: ${this.fmt(bmi, 1)} kg/m²` : '等待输入身高体重'
    };
  },

  /**
   * 2. LVOT · 每搏量 (SV) 与心排量 (CO)
   * @param {number} ld LVOT 直径 (cm)
   * @param {number} lvti LVOT VTI (cm)
   * @param {number} hr 心率 (次/min)
   * @param {number} bsa 体表面积 (m²)
   */
  calcFlow(ld, lvti, hr, bsa) {
    const d = this.num(ld);
    const vti = this.num(lvti);
    const r = this.num(hr);
    const b = this.num(bsa);

    let area = null;
    let sv = null;
    let co = null;
    let svi = null;
    let ci = null;

    if (this.valid(d)) {
      area = (Math.PI * Math.pow(d, 2)) / 4;
    }

    if (this.valid(area, vti)) {
      sv = area * vti; // mL
    }

    if (this.valid(sv, r)) {
      co = (sv * r) / 1000; // L/min
    }

    if (this.valid(sv, b) && b > 0) {
      svi = sv / b; // mL/m²
    }

    if (this.valid(co, b) && b > 0) {
      ci = co / b; // L/min/m²
    }

    const items = [];
    if (area !== null) items.push(`CSA: ${this.fmt(area, 2)} cm²`);
    if (sv !== null) items.push(`SV: ${this.fmt(sv, 1)} mL`);
    if (co !== null) items.push(`CO: ${this.fmt(co, 2)} L/min`);
    if (svi !== null) items.push(`SVi: ${this.fmt(svi, 1)} mL/m²${svi < 35 ? ' (低流量提示)' : ''}`);
    if (ci !== null) items.push(`CI: ${this.fmt(ci, 2)} L/min/m²`);

    return {
      area,
      sv,
      co,
      svi,
      ci,
      text: items.length > 0 ? items.join(' ｜ ') : '等待输入 LVOT 直径与 VTI'
    };
  },

  /**
   * 3. Qp/Qs · 肺体循环血流比
   * @param {number} rd RVOT 直径 (cm)
   * @param {number} rvti RVOT VTI (cm)
   * @param {number} sv_lvot 体循环 SV (mL, 来自 LVOT)
   */
  calcShunt(rd, rvti, sv_lvot) {
    const d = this.num(rd);
    const vti = this.num(rvti);
    const qs = this.num(sv_lvot);

    let qp = null;
    let ratio = null;

    if (this.valid(d, vti)) {
      qp = (Math.PI * Math.pow(d, 2) / 4) * vti;
    }

    if (this.valid(qp, qs) && qs > 0) {
      ratio = qp / qs;
    }

    let summary = '等待输入 RVOT 及 LVOT 数据';
    if (ratio !== null) {
      let desc = '平衡分流';
      if (ratio > 1.5) desc = '明显左向右分流 (Qp/Qs > 1.5)';
      else if (ratio > 1.2) desc = '轻度左向右分流';
      else if (ratio < 0.8) desc = '右向左分流';
      summary = `Qp: ${this.fmt(qp, 1)} mL ｜ Qs: ${this.fmt(qs, 1)} mL ｜ Qp/Qs: ${this.fmt(ratio, 2)} (${desc})`;
    } else if (qp !== null) {
      summary = `RVOT 搏出量 (Qp): ${this.fmt(qp, 1)} mL (需上方提供 LVOT 每搏量计算 Qs)`;
    }

    return { qp, qs, ratio, text: summary };
  },

  /**
   * 4. 简便 / 修正伯努利方程
   * @param {number} v2 远端峰速 V2 (m/s)
   * @param {number} v1 近端峰速 V1 (m/s, 可选，默认 0)
   */
  calcBernoulli(v2, v1) {
    const vel2 = this.num(v2);
    const vel1 = this.num(v1) ?? 0;

    if (!this.valid(vel2)) return { dp: null, text: '等待输入峰速 V₂' };
    if (vel1 > vel2) {
      return { dp: null, error: true, text: '近端速度 V₁ 不能大于远端速度 V₂，请核对取样位置' };
    }

    const dp = 4 * (Math.pow(vel2, 2) - Math.pow(vel1, 2));
    const isModified = vel1 > 0;
    return {
      dp,
      text: `峰值压差 ΔP: ${this.fmt(dp, 1)} mmHg ${isModified ? `(修正法: 4×[${vel2}² - ${vel1}²])` : `(简便法: 4×${vel2}²)`}`
    };
  },

  /**
   * 5. 主动脉瓣口面积 AVA (连续性方程 & 峰速法 & ELI)
   */
  calcAVA(sv_lvot, lvti, avti, bsa, avmax, lvmax, stj) {
    const sv = this.num(sv_lvot);
    const vti_l = this.num(lvti);
    const vti_a = this.num(avti);
    const b = this.num(bsa);
    const v_max_a = this.num(avmax);
    const v_max_l = this.num(lvmax);
    const d_stj = this.num(stj);

    let ava = null;
    let dvi = null;
    let avai = null;
    let eli = null;
    let ava_peak = null;

    if (this.valid(sv, vti_a) && vti_a > 0) {
      ava = sv / vti_a;
    }

    if (this.valid(vti_l, vti_a) && vti_a > 0) {
      dvi = vti_l / vti_a;
    }

    if (this.valid(ava, b) && b > 0) {
      avai = ava / b;
    }

    if (this.valid(ava, d_stj, b) && b > 0) {
      const aa = (Math.PI * Math.pow(d_stj, 2)) / 4;
      if (aa > ava) {
        eli = (ava * aa) / (aa - ava) / b;
      }
    }

    if (this.valid(v_max_a, v_max_l) && v_max_a > 0 && this.valid(sv, vti_l) && vti_l > 0) {
      const csa = sv / vti_l;
      ava_peak = (csa * v_max_l) / v_max_a;
    }

    const items = [];
    if (ava !== null) {
      let grade = '正常 / 轻度';
      if (ava < 1.0) grade = '重度狭窄 (AVA < 1.0)';
      else if (ava <= 1.5) grade = '中度狭窄 (1.0–1.5)';
      items.push(`AVA: ${this.fmt(ava, 2)} cm² [${grade}]`);
    }
    if (dvi !== null) {
      let dviNote = dvi < 0.25 ? '重度狭窄 (<0.25)' : dvi <= 0.5 ? '中度狭窄' : '轻度/正常 (>0.50)';
      items.push(`DVI: ${this.fmt(dvi, 2)} [${dviNote}]`);
    }
    if (avai !== null) items.push(`AVAi: ${this.fmt(avai, 2)} cm²/m²`);
    if (eli !== null) items.push(`ELI: ${this.fmt(eli, 2)} cm²/m²`);
    if (ava_peak !== null) items.push(`峰速法AVA: ${this.fmt(ava_peak, 2)} cm²`);

    return {
      ava,
      dvi,
      avai,
      eli,
      ava_peak,
      text: items.length > 0 ? items.join(' ｜ ') : '等待输入主动脉瓣 VTI 及 LVOT 数据'
    };
  },

  /**
   * 6. 二尖瓣口面积 MVA (PHT 法与连续性方程)
   */
  calcMVA(pht, mvti, sv_lvot) {
    const p = this.num(pht);
    const vti = this.num(mvti);
    const sv = this.num(sv_lvot);

    let mva_pht = null;
    let mva_cont = null;

    if (this.valid(p) && p > 0) {
      mva_pht = 220 / p;
    }

    if (this.valid(sv, vti) && vti > 0) {
      mva_cont = sv / vti;
    }

    const items = [];
    if (mva_pht !== null) {
      let grade = mva_pht <= 1.0 ? '非常严重狭窄 (≤1.0)' : mva_pht <= 1.5 ? '临床显著狭窄 (≤1.5)' : '轻度狭窄';
      items.push(`PHT法 MVA: ${this.fmt(mva_pht, 2)} cm² [${grade}]`);
    }
    if (mva_cont !== null) {
      items.push(`连续方程 MVA: ${this.fmt(mva_cont, 2)} cm²`);
    }

    return {
      mva_pht,
      mva_cont,
      text: items.length > 0 ? items.join(' ｜ ') : '等待输入 PHT (压力降半时间)'
    };
  },

  /**
   * 7. PISA · 有效反流口面积 (EROA) 与反流量 (RVol)
   * @param {number} radius PISA 半径 (cm)
   * @param {number} alias 混叠速度 Va (cm/s)
   * @param {number} regv 反流峰速 (m/s)
   * @param {number} regvti 反流 VTI (cm, 可选)
   */
  calcPISA(radius, alias, regv, regvti) {
    const r = this.num(radius);
    const va = this.num(alias);
    const v = this.num(regv);
    const vti = this.num(regvti);

    if (!this.valid(r, va, v) || v <= 0) {
      return { eroa: null, rvol: null, text: '等待输入 PISA 半径、混叠速度与反流峰速' };
    }

    const flow = 2 * Math.PI * Math.pow(r, 2) * va; // mL/s
    const eroa = flow / (v * 100); // cm²
    let rvol = null;
    if (this.valid(vti)) {
      rvol = eroa * vti; // mL
    }

    let grade = '评估中';
    if (eroa >= 0.40) grade = '重度反流 (EROA ≥ 0.40 cm²)';
    else if (eroa >= 0.20) grade = '中度反流 (0.20–0.39 cm²)';
    else grade = '轻度反流 (< 0.20 cm²)';

    const items = [
      `峰值流量: ${this.fmt(flow, 1)} mL/s`,
      `EROA: ${this.fmt(eroa, 2)} cm² [${grade}]`
    ];
    if (rvol !== null) {
      let rvolGrade = rvol >= 60 ? '重度 (≥60mL)' : rvol >= 30 ? '中度 (30-59mL)' : '轻度 (<30mL)';
      items.push(`RVol: ${this.fmt(rvol, 1)} mL [${rvolGrade}]`);
    }

    return { flow, eroa, rvol, text: items.join(' ｜ ') };
  },

  /**
   * 8. 容积法反流量 / 反流分数 (MR / AR)
   */
  calcVolumetric(md, mavti, sv_lvot, lesion = 'mr') {
    const d = this.num(md);
    const vti = this.num(mavti);
    const sv = this.num(sv_lvot);

    if (!this.valid(d, vti, sv)) {
      return { rvol: null, rf: null, text: '等待输入二尖瓣环数据与 LVOT 每搏量' };
    }

    const msv = (Math.PI * Math.pow(d, 2) / 4) * vti; // 二尖瓣流入容积
    let rvol = 0;
    let den = 0;

    if (lesion === 'ar') {
      // 孤立 AR: 主动脉瓣前向容积(LVOT SV)大于二尖瓣前向容积(msv)
      rvol = sv - msv;
      den = sv;
    } else {
      // 孤立 MR: 二尖瓣前向总容积(msv)大于主动脉前向净容积(LVOT SV)
      rvol = msv - sv;
      den = msv;
    }

    if (rvol < 0) {
      return {
        rvol: null,
        rf: null,
        error: true,
        text: '计算得到负反流量，请核对病变类型 (孤立MR/AR)、瓣环内径与 VTI'
      };
    }

    const rf = den > 0 ? (rvol / den) * 100 : 0;
    let grade = rf >= 50 ? '重度 (RF ≥ 50%)' : rf >= 30 ? '中度 (30–49%)' : '轻度 (<30%)';

    return {
      rvol,
      rf,
      text: `RVol: ${this.fmt(rvol, 1)} mL ｜ 反流分数 RF: ${this.fmt(rf, 1)}% [${grade}]`
    };
  },

  /**
   * 9. 左室质量 (LV Mass)、相对室壁厚度 (RWT) 与短轴缩短率 (FS)
   * Devereux 修正公式: 0.8 × 1.04 × [((IVS + LVIDd + PW)/10)³ - (LVIDd/10)³] + 0.6
   */
  calcLVMass(ivs, lvidd, pw, lvids, bsa, isMale = true) {
    const s = this.num(ivs);
    const d = this.num(lvidd);
    const p = this.num(pw);
    const ls = this.num(lvids);
    const b = this.num(bsa);

    if (!this.valid(s, d, p)) {
      return { mass: null, rwt: null, lvmi: null, fs: null, text: '等待输入 IVSd、LVIDd 与 PWd' };
    }

    const mass = 0.8 * 1.04 * (Math.pow((s + d + p) / 10, 3) - Math.pow(d / 10, 3)) + 0.6;
    const rwt = (2 * p) / d;
    let lvmi = null;
    if (this.valid(b) && b > 0) {
      lvmi = mass / b;
    }

    let fs = null;
    if (this.valid(ls)) {
      if (ls > d) {
        return { error: true, text: 'LVIDs (收缩末) 不能大于 LVIDd (舒张末)' };
      }
      fs = ((d - ls) / d) * 100;
    }

    // 几何构型判定
    let geometry = '';
    if (lvmi !== null) {
      const isHypertrophy = isMale ? lvmi > 115 : lvmi > 95;
      const isIncreasedRWT = rwt > 0.42;

      if (!isHypertrophy && !isIncreasedRWT) geometry = '正常构型';
      else if (!isHypertrophy && isIncreasedRWT) geometry = '向心性重构';
      else if (isHypertrophy && !isIncreasedRWT) geometry = '离心性肥厚';
      else geometry = '向心性肥厚';
    }

    const items = [
      `LV质量: ${this.fmt(mass, 1)} g`,
      `RWT: ${this.fmt(rwt, 2)}`
    ];
    if (lvmi !== null) items.push(`LVMi: ${this.fmt(lvmi, 1)} g/m² [${geometry}]`);
    if (fs !== null) items.push(`FS: ${this.fmt(fs, 1)}%`);

    return { mass, rwt, lvmi, fs, geometry, text: items.join(' ｜ ') };
  },

  /**
   * 10. 左室射血分数 (LVEF) 与容积指数 (EDVi/ESVi)
   */
  calcEF(edv, esv, bsa) {
    const ed = this.num(edv);
    const es = this.num(esv);
    const b = this.num(bsa);

    if (!this.valid(ed, es)) {
      return { ef: null, text: '等待输入 EDV 与 ESV' };
    }
    if (es > ed) {
      return { ef: null, error: true, text: 'ESV (收缩末容积) 不能大于 EDV (舒张末容积)' };
    }

    const ef = ((ed - es) / ed) * 100;
    let edvi = null;
    let esvi = null;
    if (this.valid(b) && b > 0) {
      edvi = ed / b;
      esvi = es / b;
    }

    let hfType = '';
    if (ef >= 50) hfType = 'EF保留 (≥50%)';
    else if (ef >= 41) hfType = 'EF轻度降低 (41–49%)';
    else hfType = 'EF显著减低 (≤40%)';

    const items = [`LVEF: ${this.fmt(ef, 1)}% [${hfType}]`];
    if (edvi !== null) items.push(`EDVi: ${this.fmt(edvi, 1)} mL/m²`);
    if (esvi !== null) items.push(`ESVi: ${this.fmt(esvi, 1)} mL/m²`);

    return { ef, edvi, esvi, text: items.join(' ｜ ') };
  },

  /**
   * 11. MR 频谱 dP/dt
   * dP/dt = 32000 / Δt (ms)
   */
  calcDPDT(dt) {
    const t = this.num(dt);
    if (!this.valid(t) || t <= 0) {
      return { dpdt: null, text: '等待输入 1→3 m/s 升速时间 (ms)' };
    }
    const dpdt = 32000 / t;
    let evalText = dpdt > 1200 ? '收缩力正常/良好 (>1200)' : dpdt >= 1000 ? '临界可疑 (1000–1200)' : '收缩力明显减低 (<1000)';
    return {
      dpdt,
      text: `dP/dt: ${this.fmt(dpdt, 0)} mmHg/s [${evalText}]`
    };
  },

  /**
   * 12. 舒张功能 · ASE 2025 流程辅助
   */
  calcDiastolic(e, a, es, el, dtr, dpasp, lavi, lasr, pv_sd, ivrt, isConfirmed) {
    const eVal = this.num(e);
    const aVal = this.num(a);
    const esVal = this.num(es);
    const elVal = this.num(el);
    const trVal = this.num(dtr);
    const paspVal = this.num(dpasp);
    const laviVal = this.num(lavi);
    const lasrVal = this.num(lasr);
    const sdVal = this.num(pv_sd);
    const ivrtVal = this.num(ivrt);

    const parts = [];
    const ea = this.valid(eVal, aVal) && aVal > 0 ? eVal / aVal : null;
    const ep = this.valid(esVal, elVal) ? (esVal + elVal) / 2 : null;
    const ee = this.valid(eVal, ep) && ep > 0 ? eVal / ep : null;

    if (ea !== null) parts.push(`E/A: ${this.fmt(ea, 2)}`);
    if (ee !== null) parts.push(`平均 E/e′: ${this.fmt(ee, 1)}`);

    if (!isConfirmed) {
      return {
        ea,
        ee,
        text: (parts.length ? parts.join(' ｜ ') + '。' : '') + '请勾选下方确认符合 ASE 2025 窦性心律算法适用条件。'
      };
    }

    if (!this.valid(eVal, esVal, elVal) || (!this.valid(paspVal) && !this.valid(trVal))) {
      return {
        ea,
        ee,
        text: (parts.length ? parts.join(' ｜ ') + '。' : '') + '首轮资料不完整：需 E 峰、两侧 e′ 以及 PASP 或 TR 峰速。'
      };
    }

    // 核心三大异常条件
    const reduced = esVal <= 6 || elVal <= 7 || ep <= 6.5; // e' 降低
    const raised = ee >= 14;                                // E/e' 升高
    const ph = this.valid(paspVal) ? paspVal >= 35 : trVal >= 2.8; // 肺高压征象

    const count = [reduced, raised, ph].filter(Boolean).length;
    let result = '';

    if (count === 0) {
      result = '左房压正常，舒张功能正常 (ASE 2025 普通算法)';
    } else if (count === 3) {
      if (ea === null) result = '支持左房压升高；需补充 A 峰明确分级';
      else if (ea >= 2) result = '支持 Ⅲ 级舒张功能减退，左房压升高';
      else result = '支持 Ⅱ 级舒张功能减退，左房压升高';
    } else if (count === 1 && reduced && ea !== null && ea <= 0.8) {
      result = '支持 Ⅰ 级舒张功能减退，左房压正常';
    } else {
      // 补充指标考察
      const supp = [
        this.valid(lasrVal) ? lasrVal <= 18 : null,
        this.valid(laviVal) ? laviVal > 34 : null,
        this.valid(sdVal) ? sdVal <= 0.67 : null
      ];

      if (supp.some(x => x === true) || (this.valid(ivrtVal) && ivrtVal <= 70)) {
        if (ea === null) result = '补充指标支持左房压升高，需补充 A 峰分级';
        else if (ea >= 2) result = '补充指标支持 Ⅲ 级舒张功能减退，左房压升高';
        else result = '补充指标支持 Ⅱ 级舒张功能减退，左房压升高';
      } else if (supp.every(x => x === false) || (this.valid(ivrtVal) && supp.every(x => x === null) && ivrtVal > 70)) {
        result = '补充指标倾向左房压正常；结合松弛及临床判断，有症状建议舒张负荷评估';
      } else {
        result = '需补充可靠的 LASr、LAVI、肺静脉 S/D 或 IVRT；现有数据不足以明确分级';
      }
    }

    return {
      ea,
      ee,
      text: `${parts.join(' ｜ ')}。${result}。`
    };
  },

  /**
   * 13. 心房容积指数 (LAVI / RAVI)
   */
  calcAtrial(lav, rav, bsa) {
    const l = this.num(lav);
    const r = this.num(rav);
    const b = this.num(bsa);

    if (!this.valid(b) || b <= 0) {
      return { lavi: null, ravi: null, text: '需在第 1 栏输入身高体重获得 BSA' };
    }

    const items = [];
    let lavi = null;
    let ravi = null;

    if (this.valid(l)) {
      lavi = l / b;
      let grade = lavi > 48 ? '重度扩大 (>48)' : lavi >= 42 ? '中度扩大 (42-48)' : lavi >= 35 ? '轻度扩大 (35-41)' : '正常 (16-34)';
      items.push(`LAVI: ${this.fmt(lavi, 1)} mL/m² [${grade}]`);
    }

    if (this.valid(r)) {
      ravi = r / b;
      let rGrade = ravi >= 30 ? '右房容积增大 (≥30)' : '右房容积正常 (<30)';
      items.push(`RAVI: ${this.fmt(ravi, 1)} mL/m² [${rGrade}]`);
    }

    return {
      lavi,
      ravi,
      text: items.length > 0 ? items.join(' ｜ ') : '等待输入左房 / 右房容积 (mL)'
    };
  },

  /**
   * 14. 右心压力与 PH 概率 (ESC/ERS 2022)
   */
  calcRightHeart(tr, ivc, isVent, collapse, tapse, act, prend, rvti, phsigns) {
    const v_tr = this.num(tr);
    const d_ivc = this.num(ivc);
    const v_tapse = this.num(tapse);
    const v_act = this.num(act);
    const v_prend = this.num(prend);
    const v_rvti = this.num(rvti);

    const notes = [];
    let rap = null;
    let pasp = null;

    if (isVent) {
      notes.push('机械通气: 不适用常规 IVC 塌陷法估测 RAP');
    } else if (this.valid(d_ivc) && collapse) {
      if (d_ivc <= 21 && collapse === 'yes') rap = 3;
      else if (d_ivc > 21 && collapse === 'no') rap = 15;
      else rap = 8;
      notes.push(`RAP 估算: ${rap} mmHg`);
    }

    if (this.valid(v_tr, rap)) {
      pasp = 4 * Math.pow(v_tr, 2) + rap;
      notes.push(`PASP ≈ ${this.fmt(pasp, 1)} mmHg (无 RVOT/PV 狭窄时)`);
    }

    if (this.valid(pasp, v_tapse) && pasp > 0) {
      const coupling = v_tapse / pasp;
      const status = coupling < 0.36 ? '重度失偶联 (<0.36)' : coupling < 0.55 ? '偶联受损 (<0.55)' : '偶联良好 (>0.55)';
      notes.push(`TAPSE/PASP: ${this.fmt(coupling, 2)} [${status}]`);
    }

    if (this.valid(v_prend, rap)) {
      const padp = 4 * Math.pow(v_prend, 2) + rap;
      notes.push(`PADP ≈ ${this.fmt(padp, 1)} mmHg`);
    }

    if (this.valid(v_tr, v_rvti) && v_rvti > 0) {
      const pvr = (10 * v_tr) / v_rvti + 0.16;
      notes.push(`经验 PVR ≈ ${this.fmt(pvr, 2)} WU`);
    }

    if (this.valid(v_tr)) {
      let phProb = '待补充其他征象';
      if (v_tr > 3.4) {
        phProb = '高';
      } else if (phsigns) {
        if (v_tr > 2.8) {
          phProb = phsigns === 'yes' ? '高' : '中';
        } else {
          phProb = phsigns === 'yes' ? '中' : '低';
        }
      }
      notes.push(`PH 超声概率: ${phProb}`);
    }

    return {
      rap,
      pasp,
      text: notes.length > 0 ? notes.join(' ｜ ') : '等待输入 TR 峰速与下腔静脉 (IVC) 数据'
    };
  },

  /**
   * 15. 右室 FAC 与收缩功能
   */
  calcRVFunction(eda, esa, rvs) {
    const a_ed = this.num(eda);
    const a_es = this.num(esa);
    const s_prime = this.num(rvs);

    const items = [];
    let fac = null;

    if (this.valid(a_ed, a_es)) {
      if (a_es > a_ed) {
        return { error: true, text: 'ESA (收缩末面积) 不能大于 EDA (舒张末面积)' };
      }
      fac = ((a_ed - a_es) / a_ed) * 100;
      let facGrade = fac > 35 ? '正常 (>35%)' : fac >= 29 ? '轻度异常 (29-35%)' : '中重度异常 (≤29%)';
      items.push(`RV FAC: ${this.fmt(fac, 1)}% [${facGrade}]`);
    }

    if (this.valid(s_prime)) {
      let sGrade = s_prime > 9.5 ? '正常 (>9.5)' : '减低 (≤9.5)';
      items.push(`三尖瓣环 S′: ${this.fmt(s_prime, 1)} cm/s [${sGrade}]`);
    }

    return {
      fac,
      rvs: s_prime,
      text: items.length > 0 ? items.join(' ｜ ') : '等待输入 RV 舒张末/收缩末面积或 S′'
    };
  }
};

  if (typeof global !== 'undefined') {
    global.EchoCalc = EchoCalc;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = EchoCalc;
  }
})(typeof window !== 'undefined' ? window : this);
