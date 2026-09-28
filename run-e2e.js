const { spawn } = require('child_process');
const http = require('http');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9222;
const TEST_URL = 'http://localhost:8089/e2e-test.html';

function getJSON(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('启动 Headless Edge 浏览器用于真实 DOM 与交互测试...');
  const edge = spawn(EDGE_PATH, [
    '--headless',
    `--remote-debugging-port=${PORT}`,
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    'about:blank'
  ]);

  edge.stderr.on('data', () => {}); // silence stderr

  let wsUrl = null;
  for (let i = 0; i < 20; i++) {
    try {
      const list = await getJSON(`http://127.0.0.1:${PORT}/json/list`);
      if (list && list.length > 0 && list[0].webSocketDebuggerUrl) {
        wsUrl = list[0].webSocketDebuggerUrl;
        break;
      }
    } catch (e) {
      await sleep(250);
    }
  }

  if (!wsUrl) {
    console.error('无法连接到 Edge 调试端口');
    edge.kill();
    process.exit(1);
  }

  console.log('已连接到 Headless Edge CDP，正在打开测试页面:', TEST_URL);
  const ws = new WebSocket(wsUrl);

  let idCounter = 1;
  const pending = new Map();

  function send(method, params = {}) {
    return new Promise((resolve) => {
      const id = idCounter++;
      pending.set(id, resolve);
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const resolve = pending.get(msg.id);
      pending.delete(msg.id);
      resolve(msg.result);
    }
    if (msg.method === 'Runtime.consoleAPICalled') {
      const text = msg.params.args.map(a => a.value || '').join(' ');
      if (text.includes('[PASS]') || text.includes('[FAIL]') || text.includes('测试')) {
        console.log(text);
      }
    }
  };

  await new Promise(resolve => ws.onopen = resolve);

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Page.navigate', { url: TEST_URL });

  // 等待测试完成 (window.testComplete === true)
  let complete = false;
  for (let i = 0; i < 60; i++) {
    await sleep(300);
    const evalRes = await send('Runtime.evaluate', {
      expression: '({ done: window.testComplete, passed: window.testPassed, failed: window.testFailed, text: document.getElementById("results") ? document.getElementById("results").innerText : "" })',
      returnByValue: true
    });

    if (evalRes && evalRes.result && evalRes.result.value && evalRes.result.value.done) {
      const res = evalRes.result.value;
      console.log('\n====================================================');
      console.log(res.text);
      console.log('====================================================');
      complete = true;
      edge.kill();
      if (res.failed > 0) {
        process.exit(1);
      } else {
        console.log('\n>>> 恭喜！全部 E2E 交互功能测试 100% 通过！');
        process.exit(0);
      }
    }
  }

  if (!complete) {
    console.error('测试超时未能完成');
    edge.kill();
    process.exit(1);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
