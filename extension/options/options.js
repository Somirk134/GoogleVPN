// 设置页面 — 深色科技风 + 新手引导

class OptionsApp {
  constructor() {
    this.commonPorts = [9097, 9090, 9098, 9099, 7893, 19090, 36925, 59090, 29090, 39090, 49090];
    this.wizardStep = 1;
    this.totalSteps = 4;
    this.init();
  }

  async init() {
    await this.loadConfig();
    this.bindEvents();
    this.updateSidebarStatus();

    const params = new URLSearchParams(window.location.search);
    if (params.get('welcome') === 'true') {
      this.switchTab('guide');
      this.autoDetect();
    }
  }

  async loadConfig() {
    const { config } = await chrome.storage.local.get('config');
    if (config) {
      document.getElementById('mihomoAPI').value = config.mihomoAPI || 'http://127.0.0.1:9097';
      document.getElementById('secret').value = config.secret || '';
    }
  }

  bindEvents() {
    // Tab 切换
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', () => this.switchTab(item.dataset.tab));
    });

    // 连接设置
    document.getElementById('testConnection').addEventListener('click', () => this.testConnection());
    document.getElementById('autoDetect').addEventListener('click', () => this.autoDetect());
    document.getElementById('saveSettings').addEventListener('click', () => this.saveSettings());
    document.getElementById('goGuide').addEventListener('click', (e) => {
      e.preventDefault();
      this.switchTab('guide');
    });

    // 向导
    document.getElementById('wzPrev').addEventListener('click', () => this.wizardGo(-1));
    document.getElementById('wzNext').addEventListener('click', () => this.wizardGo(1));
    document.getElementById('guideTest').addEventListener('click', () => this.guideTestConnection());
  }

  switchTab(tab) {
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    document.querySelector(`.nav-item[data-tab="${tab}"]`).classList.add('active');
    document.getElementById(`tab-${tab}`).classList.add('active');
  }

  // === 向导 ===
  wizardGo(dir) {
    const next = this.wizardStep + dir;
    if (next < 1 || next > this.totalSteps) return;

    // 第3步 → 第4步时，自动保存配置
    if (this.wizardStep === 3 && dir === 1) {
      this.saveFromGuide();
    }

    this.wizardStep = next;
    this.renderWizard();
  }

  renderWizard() {
    const step = this.wizardStep;

    // 步骤指示器
    document.querySelectorAll('.wz-step').forEach(el => {
      const s = parseInt(el.dataset.step);
      el.classList.remove('active', 'done');
      if (s === step) el.classList.add('active');
      else if (s < step) el.classList.add('done');
    });

    // 连线
    document.querySelectorAll('.wz-line').forEach((el, i) => {
      el.classList.toggle('done', i + 1 < step);
    });

    // 页面
    document.querySelectorAll('.wz-page').forEach(p => p.classList.remove('active'));
    document.getElementById(`wz-page-${step}`).classList.add('active');

    // 按钮
    document.getElementById('wzPrev').disabled = step === 1;
    const nextBtn = document.getElementById('wzNext');
    if (step === this.totalSteps) {
      nextBtn.textContent = '完成';
      nextBtn.onclick = () => this.switchTab('connection');
    } else {
      nextBtn.textContent = '下一步';
      nextBtn.onclick = () => this.wizardGo(1);
    }
  }

  async saveFromGuide() {
    const api = document.getElementById('guideAPI').value.trim();
    const secret = document.getElementById('guideSecret').value.trim();
    if (api) {
      document.getElementById('mihomoAPI').value = api;
      document.getElementById('secret').value = secret;
      await this.saveSettings(true);
    }
  }

  async guideTestConnection() {
    const btn = document.getElementById('guideTest');
    const status = document.getElementById('guideTestStatus');
    btn.disabled = true;
    btn.textContent = '测试中...';
    status.textContent = '';

    const api = document.getElementById('guideAPI').value.trim();
    const secret = document.getElementById('guideSecret').value.trim();
    const result = await this.tryConnect(api, secret);

    if (result.version) {
      status.textContent = `✓ 连接成功 — mihomo ${result.version}`;
      status.style.color = '#22c55e';
    } else {
      status.textContent = `✗ 连接失败: ${result.error}`;
      status.style.color = '#ef4444';
    }

    btn.disabled = false;
    btn.textContent = '测试连接';
  }

  // === 连接 ===
  async tryConnect(url, secret = '') {
    try {
      const headers = {};
      if (secret) headers['Authorization'] = `Bearer ${secret}`;
      const controller = new AbortController();
      const tid = setTimeout(() => controller.abort(), 2000);
      const resp = await fetch(`${url}/version`, { headers, signal: controller.signal });
      clearTimeout(tid);
      if (!resp.ok) return { error: `HTTP ${resp.status}` };
      const data = await resp.json();
      return { version: data.version || 'unknown' };
    } catch (e) {
      return { error: e.name === 'AbortError' ? '超时' : e.message };
    }
  }

  async autoDetect() {
    const btn = document.getElementById('autoDetect');
    const status = document.getElementById('connectionStatus');
    btn.disabled = true;
    btn.textContent = '扫描中...';
    status.innerHTML = '<span style="color:#8892a8">正在扫描常见端口...</span>';

    const secret = document.getElementById('secret').value.trim();

    const results = await Promise.all(
      this.commonPorts.map(async (port) => {
        const url = `http://127.0.0.1:${port}`;
        const result = await this.tryConnect(url, secret);
        return { port, url, ...result };
      })
    );

    const found = results.filter(r => r.version);

    if (found.length > 0) {
      const best = found[0];
      document.getElementById('mihomoAPI').value = best.url;
      let msg = `✓ 检测到 mihomo ${best.version} @ 端口 ${best.port}`;
      if (found.length > 1) msg += `（共 ${found.length} 个实例）`;
      status.textContent = msg;
      status.style.color = '#22c55e';
      this.updateSidebarStatus(true, best.version);
    } else {
      const details = results.map(r => `${r.port}: ${r.error}`).join('\n');
      status.innerHTML = `<span style="color:#ef4444">✗ 未检测到 mihomo</span><br><br>` +
        `<details style="margin-top:4px"><summary style="cursor:pointer;color:#5a6478;font-size:12px">查看扫描详情</summary>` +
        `<pre style="font-size:11px;color:#5a6478;margin-top:8px;white-space:pre-wrap">${details}</pre></details>` +
        `<div style="margin-top:8px;color:#5a6478;font-size:12px">请确认 Clash Verge 正在运行，或去 <a href="#" onclick="document.querySelector('.nav-item[data-tab=guide]').click();return false" style="color:#3b82f6">新手引导</a> 查看如何获取正确的端口</div>`;
    }

    btn.disabled = false;
    btn.textContent = '扫描';
  }

  async testConnection() {
    const btn = document.getElementById('testConnection');
    const status = document.getElementById('connectionStatus');
    btn.disabled = true;
    btn.textContent = '测试中...';
    status.textContent = '';

    const apiURL = document.getElementById('mihomoAPI').value.trim();
    const secret = document.getElementById('secret').value.trim();
    const result = await this.tryConnect(apiURL, secret);

    if (result.version) {
      status.textContent = `✓ 连接成功 — mihomo ${result.version}`;
      status.style.color = '#22c55e';
      this.updateSidebarStatus(true, result.version);
    } else {
      status.textContent = `✗ 连接失败: ${result.error}`;
      status.style.color = '#ef4444';
      this.updateSidebarStatus(false);
    }

    btn.disabled = false;
    btn.textContent = '测试连接';
  }

  async saveSettings(silent = false) {
    const config = {
      mihomoAPI: document.getElementById('mihomoAPI').value.trim(),
      secret: document.getElementById('secret').value.trim(),
    };
    await chrome.storage.local.set({ config });

    try { await chrome.runtime.sendMessage({ type: 'CONNECT' }); } catch {}

    if (!silent) {
      const status = document.getElementById('connectionStatus');
      status.textContent = '✓ 设置已保存';
      status.style.color = '#22c55e';
      setTimeout(() => { status.textContent = ''; }, 2000);
    }
  }

  async updateSidebarStatus(connected, version) {
    const badge = document.getElementById('sidebarStatus');
    if (!badge) return;

    if (connected === undefined) {
      // 初始化时检测
      const apiURL = document.getElementById('mihomoAPI').value.trim();
      const secret = document.getElementById('secret').value.trim();
      const result = await this.tryConnect(apiURL, secret);
      connected = !!result.version;
      version = result.version;
    }

    const dot = badge.querySelector('.conn-dot');
    const text = badge.querySelector('.conn-text');
    if (connected) {
      dot.className = 'conn-dot online';
      text.textContent = `mihomo ${version}`;
    } else {
      dot.className = 'conn-dot offline';
      text.textContent = '未连接';
    }
  }
}

new OptionsApp();
