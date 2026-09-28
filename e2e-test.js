(function() {
  'use strict';

  const frame = document.getElementById('appFrame');
  const resultsDiv = document.getElementById('results');

  let passed = 0;
  let failed = 0;
  const logs = [];

  function log(msg, isPass) {
    if (isPass) {
      passed++;
      logs.push(`<div class="pass">✓ [PASS] ${msg}</div>`);
      console.log(`[PASS] ${msg}`);
    } else {
      failed++;
      logs.push(`<div class="fail">✗ [FAIL] ${msg}</div>`);
      console.error(`[FAIL] ${msg}`);
    }
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async function runAllTests() {
    console.log('等待应用页面加载完成...');
    await sleep(800);

    const doc = frame.contentDocument || frame.contentWindow.document;
    const win = frame.contentWindow;

    const $ = (id) => doc.getElementById(id);
    const $$ = (sel) => doc.querySelectorAll(sel);

    function triggerInput(el, val) {
      el.value = val;
      el.dispatchEvent(new win.Event('input', { bubbles: true }));
      el.dispatchEvent(new win.Event('change', { bubbles: true }));
    }

    try {
      console.log('--- 1. 初始页面加载与默认状态测试 ---');
      log('主页面容器 #calcApp 存在', !!$('calcApp'));
      log('默认预设已加载 (健康成年人)，身高为 172', $('c-height')?.value === '172');
      log('全域 BSA 徽章正常显示', $('badge-bsa')?.textContent.includes('m²'));
      log('LVOT 每搏量徽章正常显示', $('badge-sv')?.textContent.includes('mL'));
      log('基础信息输出正常', $('out-basic')?.textContent.includes('BSA: 1.8 m²'));
      log('左室射血分数输出正常', $('out-ef')?.textContent.includes('LVEF: 63.6%'));
      log('报告生成器正常填充文本', $('reportText')?.value.includes('经胸超声心动图检查报告'));

      console.log('--- 2. 预设病例加载与响应测试 ---');
      // 测试 Severe AS 预设
      const asBtn = doc.querySelector('[data-preset="severe_as"]');
      asBtn.click();
      await sleep(150);
      log('点击重度 AS 预设后，AV VTI 填入 80', $('c-avti')?.value === '80');
      log('点击重度 AS 预设后，AVA 输出包含 "重度狭窄"', $('out-ava')?.textContent.includes('重度狭窄'));
      log('重度 AS 预设后，压差输出包含更新值', $('out-bernoulli')?.textContent.includes('73.4 mmHg'));
      log('报告文本已自动同步包含 "主动脉瓣重度狭窄"', $('reportText')?.value.includes('主动脉瓣重度狭窄'));

      // 测试 MR PISA 预设
      const mrBtn = doc.querySelector('[data-preset="mr_pisa"]');
      mrBtn.click();
      await sleep(150);
      log('点击 MR PISA 预设后，PISA 半径填入 0.95', $('c-radius')?.value === '0.95');
      log('MR PISA 预设后，PISA 输出包含 "重度反流"', $('out-pisa')?.textContent.includes('重度反流'));
      log('MR PISA 预设后，容积法输出包含 "重度"', $('out-volume')?.textContent.includes('重度'));
      log('报告文本自动同步包含 "二尖瓣重度反流"', $('reportText')?.value.includes('二尖瓣重度反流'));

      // 测试 PH & RV 预设
      const phBtn = doc.querySelector('[data-preset="ph_rv"]');
      phBtn.click();
      await sleep(150);
      log('点击肺高压预设后，TR 峰速填入 3.8', $('c-tr')?.value === '3.8');
      log('肺高压预设后，PH 超声概率输出包含 "高"', $('out-pressure')?.textContent.includes('PH 超声概率: 高'));
      log('右室 FAC 输出已更新', $('out-rvcalc')?.textContent.includes('FAC'));

      // 测试 Normal 预设复位
      const normBtn = doc.querySelector('[data-preset="normal"]');
      normBtn.click();
      await sleep(150);
      log('恢复正常参考预设，身高恢复 172', $('c-height')?.value === '172');

      console.log('--- 3. 手动输入与跨卡片数据级联测试 ---');
      // 修改身高体重测试 BSA 级联
      triggerInput($('c-height'), '180');
      triggerInput($('c-weight'), '80');
      triggerInput($('c-hr'), '80');
      // Mosteller: sqrt(180 * 80 / 3600) = sqrt(4) = 2.0
      log('输入 180cm/80kg，BSA 正确计算为 2.00 m²', $('out-basic')?.textContent.includes('BSA: 2 m²'));
      log('顶部全域 BSA 徽章同步更新为 2 m²', $('badge-bsa')?.textContent.includes('2 m²'));

      // 修改 LVOT 内径与 VTI 测试 SV 级联
      triggerInput($('c-ld'), '2.0');
      triggerInput($('c-lvti'), '25');
      // SV = π * 1 * 25 = 78.54 mL
      log('输入 LVOT 直径 2.0, VTI 25，SV 计算为 78.5 mL', $('out-flow')?.textContent.includes('SV: 78.5 mL'));
      log('全域 SV 徽章同步更新为 78.5 mL', $('badge-sv')?.textContent.includes('78.5 mL'));

      // 验证 AVA 自动共享上方更新后的 SV (78.54 mL)
      triggerInput($('c-avti'), '78.54');
      // AVA = 78.54 / 78.54 = 1.0 cm²
      log('AVA 自动使用级联的 LVOT SV，计算得 AVA 1 cm²', $('out-ava')?.textContent.includes('AVA: 1 cm²'));

      // 验证伯努利修正法
      triggerInput($('c-v2'), '4.0');
      triggerInput($('c-v1'), '2.0');
      // ΔP = 4 * (16 - 4) = 48 mmHg
      log('伯努利方程修正法 4×(4² - 2²) = 48 mmHg', $('out-bernoulli')?.textContent.includes('48 mmHg'));

      // 验证二尖瓣 MVA
      triggerInput($('c-pht'), '110');
      // MVA = 220 / 110 = 2.0 cm²
      log('MVA PHT 法 220/110 = 2 cm²', $('out-mva')?.textContent.includes('PHT法 MVA: 2 cm²'));

      // 验证左室射血分数
      triggerInput($('c-edv'), '100');
      triggerInput($('c-esv'), '40');
      // EF = 60%
      log('LVEF (100-40)/100 = 60.0%', $('out-ef')?.textContent.includes('LVEF: 60%'));

      // 验证心房容积与 BSA 级联 (BSA=2.0)
      triggerInput($('c-lav'), '60');
      triggerInput($('c-rav'), '50');
      // LAVI = 60 / 2 = 30 mL/m², RAVI = 50 / 2 = 25 mL/m²
      log('LAVI = 60 / 2.0 = 30 mL/m²', $('out-atrial')?.textContent.includes('LAVI: 30 mL/m²'));
      log('RAVI = 50 / 2.0 = 25 mL/m²', $('out-atrial')?.textContent.includes('RAVI: 25 mL/m²'));

      console.log('--- 4. 边界异常值捕获与错误样式测试 ---');
      // 伯努利 V1 > V2
      triggerInput($('c-v1'), '5.0');
      triggerInput($('c-v2'), '3.0');
      log('伯努利 V1 > V2 触发错误提示', $('out-bernoulli')?.textContent.includes('近端速度 V₁ 不能大于远端速度 V₂'));
      log('伯努利错误卡片高亮错误样式 (.error)', $('out-bernoulli')?.classList.contains('error'));

      // 左室质量 LVIDs > LVIDd
      triggerInput($('c-lvids'), '55');
      triggerInput($('c-lvidd'), '45');
      log('左室测量 LVIDs > LVIDd 捕获错误', $('out-mass')?.textContent.includes('LVIDs (收缩末) 不能大于 LVIDd'));
      log('左室测量卡片高亮错误样式 (.error)', $('out-mass')?.classList.contains('error'));

      // 射血分数 ESV > EDV
      triggerInput($('c-esv'), '120');
      triggerInput($('c-edv'), '90');
      log('射血分数 ESV > EDV 捕获错误', $('out-ef')?.textContent.includes('ESV (收缩末容积) 不能大于 EDV'));
      log('射血分数卡片高亮错误样式 (.error)', $('out-ef')?.classList.contains('error'));

      // 右室 ESA > EDA
      triggerInput($('c-esa'), '25');
      triggerInput($('c-eda'), '20');
      log('右室面积 ESA > EDA 捕获错误', $('out-rvcalc')?.textContent.includes('ESA (收缩末面积) 不能大于 EDA'));
      log('右室卡片高亮错误样式 (.error)', $('out-rvcalc')?.classList.contains('error'));

      console.log('--- 5. 交互式控制功能测试 (清空、主题、搜索、报告) ---');
      // 测试深色模式切换
      const themeBtn = $('themeToggle');
      themeBtn.click();
      await sleep(100);
      log('点击深色模式按钮，html 元素获得 .dark 类', doc.documentElement.classList.contains('dark'));
      log('深色模式按钮文字更新为 "☀️ 浅色模式"', themeBtn.textContent.includes('浅色模式'));
      log('localStorage 保存了 echo_theme: dark', win.localStorage.getItem('echo_theme') === 'dark');

      // 切回浅色模式
      themeBtn.click();
      await sleep(100);
      log('再次点击切换，.dark 类成功移除', !doc.documentElement.classList.contains('dark'));
      log('按钮文字恢复为 "🌙 深色模式"', themeBtn.textContent.includes('深色模式'));

      // 测试卡片搜索过滤
      const searchInput = $('calcSearch');
      triggerInput(searchInput, 'PISA');
      await sleep(100);
      log('搜索 "PISA" 时，PISA 卡片正常显示', $('card-pisa')?.style.display !== 'none');
      log('搜索 "PISA" 时，非相关卡片如基础信息被隐藏', $('card-basic')?.style.display === 'none');

      // 清空搜索恢复全部卡片
      triggerInput(searchInput, '');
      await sleep(100);
      log('清空搜索后，全部卡片恢复可见', $('card-basic')?.style.display !== 'none');

      // 测试报告文本手动编辑与刷新重同步
      const reportText = $('reportText');
      reportText.value = '测试手动编辑文本内容';
      $('refreshReport').click();
      await sleep(100);
      log('点击 "重新同步计算数据" 按钮，报告恢复为包含计算结果的标准模板', reportText.value.includes('经胸超声心动图检查报告'));

      // 测试一键复制功能
      $('copyReport').click();
      await sleep(150);
      log('点击 "一键复制报告文本" 后，显示复制成功状态', $('copyStatus')?.textContent.includes('已成功复制') || $('copyStatus')?.textContent.includes('复制'));

      // 测试清空全部输入按钮
      const clearBtn = $('clearCalc');
      clearBtn.click();
      await sleep(200);

      // 验证清空后状态
      let allInputsEmpty = true;
      $$('#calcApp input[type="number"]').forEach(input => {
        if (input.value !== '') allInputsEmpty = false;
      });
      log('点击清空全部输入后，所有数字输入框清空为空字符串', allInputsEmpty);

      let allSelectsReset = true;
      $$('#calcApp select').forEach(select => {
        if (select.selectedIndex !== 0) allSelectsReset = false;
      });
      log('点击清空后，所有下拉菜单恢复第 1 项默认', allSelectsReset);

      log('全域 BSA 徽章重置为 "未计算"', $('badge-bsa')?.textContent === '未计算');
      log('全域 SV 徽章重置为 "未计算"', $('badge-sv')?.textContent === '未计算');
      log('输出卡片恢复 "等待输入" 占位提示', $('out-basic')?.textContent.includes('等待输入'));
      log('清空操作成功触发 Toast 悬浮提示', $('toast')?.classList.contains('show') || $('toast')?.textContent.includes('已清空'));

    } catch (err) {
      log(`测试发生未捕获异常: ${err.message}`, false);
      console.error(err);
    }

    const isAllPassed = failed === 0;
    const summaryHtml = `
      <div class="summary ${isAllPassed ? 'ok' : 'err'}">
        <h2>测试汇总结果：总计 ${passed + failed} 项，通过 ${passed} 项，失败 ${failed} 项</h2>
        <p>${isAllPassed ? '🎉 恭喜！全部输入、输出、按钮、联动与异常分支测试 100% 通过！' : '⚠️ 存在未通过项，请检查上述日志。'}</p>
      </div>
    `;

    resultsDiv.innerHTML = summaryHtml + logs.join('');
    console.log(`\n====================================================`);
    console.log(`E2E 测试完成: 通过 ${passed}, 失败 ${failed}`);
    console.log(`====================================================\n`);

    // 暴露状态到 window
    window.testComplete = true;
    window.testPassed = passed;
    window.testFailed = failed;
  }

  frame.addEventListener('load', () => {
    runAllTests();
  });
})();
