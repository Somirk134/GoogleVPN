// 设置页面

import { formatBytes, formatSpeed, fetchSSEOnce, niceNum, drawTrafficChart } from '../shared/utils.js';

class OptionsApp {
  constructor() {
    this.commonPorts = [9097, 9090, 9098, 9099, 7893, 19090, 36925, 59090, 29090, 39090, 49090];
    this.wizardStep = 1;
    this.totalSteps = 4;
    // 流量图表数据
    this.chartData = { up: [], down: [] };
    this.maxChartPoints = 60; // 60秒数据
    this.trafficStream = null;
    this.trafficInterval = null;
    this.init();
  }

  async init() {
    await this.initTheme();
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

    // 主题切换
    document.getElementById('themeToggle').addEventListener('click', () => this.toggleTheme());
  }

  // === 主题 ===
  async initTheme() {
    try {
      const result = await chrome.storage.local.get('pmTheme');
      const theme = result.pmTheme || 'light';
      this.applyTheme(theme);
    } catch {
      this.applyTheme('light');
    }
  }

  async toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    this.applyTheme(next);
    try {
      await chrome.storage.local.set({ pmTheme: next });
    } catch {}
  }

  applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const icon = document.getElementById('themeIcon');
    const label = document.querySelector('.theme-label');
    if (!icon || !label) return;
    if (theme === 'dark') {
      icon.innerHTML = '<path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>';
      label.textContent = '暗色主题';
    } else {
      icon.innerHTML = '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>';
      label.textContent = '亮色主题';
    }
  }

  switchTab(tab) {
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    document.querySelector(`.nav-item[data-tab="${tab}"]`).classList.add('active');
    document.getElementById(`tab-${tab}`).classList.add('active');
    this.onTabSwitch(tab);
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

  // === 流量统计 ===

  // 当切换到流量 tab 时启动实时流，离开时停止
  onTabSwitch(tab) {
    if (tab === 'traffic') {
      this.startTrafficStream();
      this.refreshConnectionStats();
      // 每2秒刷新连接数和累计流量
      this.trafficInterval = setInterval(() => this.refreshConnectionStats(), 2000);
    } else {
      this.stopTrafficStream();
      if (this.trafficInterval) { clearInterval(this.trafficInterval); this.trafficInterval = null; }
    }
  }

  async startTrafficStream() {
    this.stopTrafficStream();
    const { config } = await chrome.storage.local.get('config');
    if (!config || !config.mihomoAPI) return;

    const url = `${config.mihomoAPI}/traffic`;
    const headers = {};
    if (config.secret) headers['Authorization'] = `Bearer ${config.secret}`;

    try {
      const resp = await fetch(url, { headers });
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      this.trafficStream = reader;

      let buffer = '';
      const read = async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            // mihomo /traffic 每秒输出一行 JSON: {"up":123,"down":456}
            const lines = buffer.split('\n');
            buffer = lines.pop(); // 保留不完整的行
            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed) continue;
              try {
                const data = JSON.parse(trimmed);
                this.onTrafficData(data);
              } catch {}
            }
          }
        } catch (e) {
          // stream closed
        }
      };
      read();
    } catch {}
  }

  stopTrafficStream() {
    if (this.trafficStream) {
      try { this.trafficStream.cancel(); } catch {}
      this.trafficStream = null;
    }
  }

  onTrafficData(data) {
    const up = data.up || 0;
    const down = data.down || 0;

    // 更新速率显示
    document.getElementById('statUpSpeed').textContent = formatSpeed(up);
    document.getElementById('statDownSpeed').textContent = formatSpeed(down);

    // 推入图表数据
    this.chartData.up.push(up);
    this.chartData.down.push(down);
    if (this.chartData.up.length > this.maxChartPoints) {
      this.chartData.up.shift();
      this.chartData.down.shift();
    }

    this.drawChart();
  }

  async refreshConnectionStats() {
    try {
      const resp = await chrome.runtime.sendMessage({ type: 'GET_TRAFFIC' });
      if (resp && resp.success) {
        const d = resp.data;
        document.getElementById('statUpload').textContent = formatBytes(d.upload || 0);
        document.getElementById('statDownload').textContent = formatBytes(d.download || 0);
        document.getElementById('statConnections').textContent = d.connections || 0;
      }
    } catch {}

    // 内核占用 — 通过 mihomo /memory 获取
    try {
      const { config } = await chrome.storage.local.get('config');
      if (config && config.mihomoAPI) {
        const headers = {};
        if (config.secret) headers['Authorization'] = `Bearer ${config.secret}`;
        const mem = await fetchSSEOnce(`${config.mihomoAPI}/memory`, headers, 2000);
        if (mem && mem.inuse != null) {
          document.getElementById('statMemory').textContent = formatBytes(mem.inuse);
        }
      }
    } catch {}
  }

  drawChart() {
    const canvas = document.getElementById('trafficChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

    drawTrafficChart(ctx, {
      width: w, height: h,
      upData: this.chartData.up,
      downData: this.chartData.down,
      maxPoints: this.maxChartPoints,
      padTop: 20, padRight: 12, padBottom: 24, padLeft: 56,
      showGrid: true, showLabels: true,
      isDark,
    });
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
