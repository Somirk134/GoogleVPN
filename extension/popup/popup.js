// Popup UI

function formatSpeed(bytes) {
  if (!bytes || bytes === 0) return '0 B/s';
  const k = 1024;
  const sizes = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

class PopupApp {
  constructor() {
    this.state = null;
    this.isTesting = false;
    this.ipVisible = true;
    this.liteIpVisible = true;
    this.ipData = null;
    this.chartData = { up: [], down: [] };
    this.maxChartPoints = 30;
    this.trafficReader = null;
    this.mode = 'lite';
    this.litePanelOpen = false;
    this.sChartData = { up: [], down: [] };
    this.sMaxChartPoints = 30;
    this.init();
  }

  async init() {
    try {
      const { pmPopupMode } = await chrome.storage.local.get('pmPopupMode');
      if (pmPopupMode === 'full') this.mode = 'full';
    } catch {}

    this.showMode(this.mode);
    this.bindEvents();

    // 监听状态广播
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg.type === 'STATE_UPDATE') {
        this.state = msg.state;
        if (!this.isTesting) this.render();
      }
    });

    // 第一步：先看 background 是不是已经连上了
    const stateResp = await this.sendMessage('GET_STATE');
    this.state = (stateResp && stateResp.success) ? stateResp.data : this.defaultState();

    if (this.state.connected) {
      // 已连接，直接用
      await this.onConnected();
      return;
    }

    // 第二步：没连接，尝试 CONNECT
    let connectOk = false;
    let needConfig = false;
    try {
      const cr = await this.sendMessage('CONNECT');
      connectOk = cr && cr.success;
      needConfig = cr && cr.success && cr.data && cr.data.needConfig;
    } catch {}

    if (connectOk && !needConfig) {
      // 重新拿状态
      const updated = await this.sendMessage('GET_STATE');
      if (updated && updated.success) this.state = updated.data;
      await this.onConnected();
      return;
    }

    // 第三步：未配置或连不上，渲染未连接状态，打开设置页
    this.render();
    this.openSettings();
  }

  async onConnected() {
    // 自动启用代理
    if (!this.state.proxyEnabled) {
      try {
        await this.sendMessage('TOGGLE_PROXY', { enabled: true });
        const updated = await this.sendMessage('GET_STATE');
        if (updated && updated.success) this.state = updated.data;
      } catch {}
    }
    this.render();
    this.fetchIP();
    this.runSpeedTest(true);
    this.startTrafficStream();
  }

  defaultState() {
    return {
      connected: false, proxyEnabled: false,
      currentGroup: '', proxies: {},
      traffic: { upload: 0, download: 0, connections: 0 },
      testing: false,
    };
  }

  sendMessage(type, data = null) {
    return chrome.runtime.sendMessage({ type, data });
  }

  // === 模式切换 ===
  showMode(mode) {
    this.mode = mode;
    const lite = document.getElementById('liteMode');
    const full = document.getElementById('fullMode');
    const settings = document.getElementById('settingsMode');
    if (mode === 'full') {
      document.body.className = 'mode-full';
      lite.style.display = 'none';
      full.style.display = 'block';
      settings.style.display = 'none';
      settings.classList.remove('active');
    } else {
      document.body.className = '';
      lite.style.display = 'flex';
      full.style.display = 'none';
      settings.style.display = 'none';
      settings.classList.remove('active');
    }
    chrome.storage.local.set({ pmPopupMode: mode }).catch(() => {});
  }

  switchMode() {
    const next = this.mode === 'lite' ? 'full' : 'lite';
    chrome.storage.local.set({ pmPopupMode: next }).then(() => {
      window.close();
    }).catch(() => {});
  }

  openSettings() {
    document.getElementById('liteMode').style.display = 'none';
    document.getElementById('fullMode').style.display = 'none';
    const sv = document.getElementById('settingsMode');
    if (this.mode === 'full') {
      document.body.className = 'mode-full';
    }
    sv.style.display = 'flex';
    sv.classList.add('active');
    this.loadSettingsConfig();
  }

  closeSettings() {
    document.getElementById('settingsMode').style.display = 'none';
    document.getElementById('settingsMode').classList.remove('active');
    this.showMode(this.mode);
    this.render();
  }

  switchSettingsTab(tab) {
    document.querySelectorAll('.settings-nav-item').forEach(n => n.classList.remove('active'));
    document.querySelectorAll('.settings-tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`.settings-nav-item[data-stab="${tab}"]`).classList.add('active');
    document.getElementById(`stab-${tab}`).classList.add('active');
    if (tab === 'traffic') this.startSettingsTraffic();
    else this.stopSettingsTraffic();
  }

  async loadSettingsConfig() {
    try {
      const { config } = await chrome.storage.local.get('config');
      if (config) {
        document.getElementById('sAPIInput').value = config.mihomoAPI || '';
        document.getElementById('sSecretInput').value = config.secret || '';
      }
    } catch {}
    document.getElementById('sConnStatus').textContent = '';
  }

  // === 事件绑定 ===
  bindEvents() {
    // 模式切换
    document.getElementById('liteToFull').addEventListener('click', () => this.switchMode());
    document.getElementById('liteToFullLink').addEventListener('click', () => this.switchMode());
    document.getElementById('fullToLite').addEventListener('click', () => this.switchMode());

    // 轻量模式
    document.getElementById('powerSwitch').addEventListener('click', () => this.toggleProxy());
    document.getElementById('liteNodeCard').addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleLitePanel();
    });
    document.getElementById('liteEyeBtn').addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleLiteIP();
    });
    document.getElementById('liteSettings').addEventListener('click', () => this.openSettings());
    document.getElementById('liteTestAll').addEventListener('click', () => this.runSpeedTest(false));

    // IP 卡片点击弹出详情
    document.querySelector('.lite-ip-card').addEventListener('click', (e) => {
      if (e.target.closest('.lite-eye-btn')) return;
      this.toggleLiteIPPanel();
    });
    document.getElementById('liteIPRefresh').addEventListener('click', () => this.fetchIP());
    document.getElementById('liteGroupSelect').addEventListener('change', (e) => {
      this.state.currentGroup = e.target.value;
      this.renderLitePanel();
      this.renderLiteNode();
    });

    // 点击遮罩关闭面板
    document.getElementById('liteOverlay').addEventListener('click', () => {
      this.closeLitePanels();
    });

    // 完整模式
    document.getElementById('toggleProxy').addEventListener('click', () => this.toggleProxy());
    document.getElementById('testAll').addEventListener('click', () => this.runSpeedTest(false));
    document.getElementById('groupSelect').addEventListener('change', (e) => {
      this.state.currentGroup = e.target.value;
      this.render();
    });
    document.getElementById('settings').addEventListener('click', () => this.openSettings());
    document.getElementById('ipToggle').addEventListener('click', () => this.toggleIPVisibility());
    document.getElementById('ipRefresh').addEventListener('click', () => this.fetchIP());

    // 设置视图
    document.getElementById('settingsBack').addEventListener('click', () => this.closeSettings());
    document.querySelectorAll('.settings-nav-item').forEach(item => {
      item.addEventListener('click', () => this.switchSettingsTab(item.dataset.stab));
    });
    document.getElementById('sTestConn').addEventListener('click', () => this.settingsTestConnection());
    document.getElementById('sSaveSettings').addEventListener('click', () => this.settingsSave());
    document.getElementById('sAutoDetect').addEventListener('click', () => this.settingsAutoDetect());
  }

  toggleLitePanel() {
    const panel = document.getElementById('litePanel');
    const overlay = document.getElementById('liteOverlay');
    this.litePanelOpen = !this.litePanelOpen;
    if (this.litePanelOpen) {
      // 先关闭 IP 面板
      document.getElementById('liteIPPanel').classList.remove('open');
      this.renderLitePanel();
      panel.classList.add('open');
      overlay.classList.add('open');
    } else {
      panel.classList.remove('open');
      overlay.classList.remove('open');
    }
  }

  toggleLiteIPPanel() {
    const panel = document.getElementById('liteIPPanel');
    const overlay = document.getElementById('liteOverlay');
    const isOpen = panel.classList.contains('open');
    if (isOpen) {
      panel.classList.remove('open');
      overlay.classList.remove('open');
    } else {
      // 先关闭节点面板
      document.getElementById('litePanel').classList.remove('open');
      this.litePanelOpen = false;
      this.renderLiteIPDetail();
      panel.classList.add('open');
      overlay.classList.add('open');
    }
  }

  closeLitePanels() {
    document.getElementById('litePanel').classList.remove('open');
    document.getElementById('liteIPPanel').classList.remove('open');
    document.getElementById('liteOverlay').classList.remove('open');
    this.litePanelOpen = false;
  }

  renderLiteIPDetail() {
    if (!this.ipData) return;
    const flag = this.ipData.countryCode ? this.countryFlag(this.ipData.countryCode) + ' ' : '';
    document.getElementById('liteIPAddr').textContent = this.ipData.ip || '-';
    document.getElementById('liteIPCountry').textContent = flag + (this.ipData.country || '-');
    document.getElementById('liteIPLocation').textContent = this.ipData.location || '-';
    document.getElementById('liteIPOrg').textContent = this.ipData.org || '-';
    document.getElementById('liteIPTimezone').textContent = this.ipData.timezone || '-';
    document.getElementById('liteIPASN').textContent = this.ipData.asn || '-';
  }

  // === 设置视图方法 ===
  async settingsTestConnection() {
    const btn = document.getElementById('sTestConn');
    const status = document.getElementById('sConnStatus');
    const api = document.getElementById('sAPIInput').value.trim();
    const secret = document.getElementById('sSecretInput').value.trim();
    btn.disabled = true; btn.textContent = '测试中...';
    status.textContent = '';
    try {
      const headers = {};
      if (secret) headers['Authorization'] = `Bearer ${secret}`;
      const resp = await fetch(`${api}/version`, { headers, signal: AbortSignal.timeout(3000) });
      if (!resp.ok) {
        status.textContent = `连接失败: HTTP ${resp.status}`;
        status.style.color = '#f85149';
      } else {
        const data = await resp.json();
        status.textContent = `连接成功 — mihomo ${data.version || ''}`;
        status.style.color = '#3fb950';
      }
    } catch (e) {
      status.textContent = `连接失败: ${e.name === 'AbortError' ? '超时' : e.message}`;
      status.style.color = '#f85149';
    }
    btn.disabled = false; btn.textContent = '测试连接';
  }

  async settingsSave() {
    const api = document.getElementById('sAPIInput').value.trim();
    const secret = document.getElementById('sSecretInput').value.trim();
    const status = document.getElementById('sConnStatus');
    await chrome.storage.local.set({ config: { mihomoAPI: api, secret } });
    try {
      const cr = await this.sendMessage('CONNECT');
      if (cr && cr.success) {
        const updated = await this.sendMessage('GET_STATE');
        if (updated && updated.success) this.state = updated.data;
        status.textContent = '已保存并连接成功';
        status.style.color = '#3fb950';
      } else {
        status.textContent = '已保存，但连接失败';
        status.style.color = '#f5a623';
      }
    } catch {
      status.textContent = '已保存';
      status.style.color = '#3fb950';
    }
  }

  async settingsAutoDetect() {
    const btn = document.getElementById('sAutoDetect');
    const status = document.getElementById('sConnStatus');
    btn.disabled = true; btn.textContent = '扫描中...';
    status.textContent = '正在扫描常见端口...';
    status.style.color = '#8b949e';
    const secret = document.getElementById('sSecretInput').value.trim();
    const ports = [9097, 9090, 9098, 9099, 7893, 19090, 36925];
    const results = await Promise.all(ports.map(async (port) => {
      const url = `http://127.0.0.1:${port}`;
      try {
        const headers = {};
        if (secret) headers['Authorization'] = `Bearer ${secret}`;
        const resp = await fetch(`${url}/version`, { headers, signal: AbortSignal.timeout(2000) });
        if (!resp.ok) return null;
        const data = await resp.json();
        return { port, url, version: data.version };
      } catch { return null; }
    }));
    const found = results.filter(Boolean);
    if (found.length > 0) {
      document.getElementById('sAPIInput').value = found[0].url;
      status.textContent = `检测到 mihomo ${found[0].version} @ 端口 ${found[0].port}`;
      status.style.color = '#3fb950';
    } else {
      status.textContent = '未检测到 mihomo，请确认 Clash Verge 正在运行';
      status.style.color = '#f85149';
    }
    btn.disabled = false; btn.textContent = '扫描';
  }

  startSettingsTraffic() {
    this.stopSettingsTraffic();
    this._sTrafficInterval = setInterval(() => this.refreshSettingsTraffic(), 2000);
    this.refreshSettingsTraffic();
  }

  stopSettingsTraffic() {
    if (this._sTrafficInterval) { clearInterval(this._sTrafficInterval); this._sTrafficInterval = null; }
  }

  async refreshSettingsTraffic() {
    try {
      const resp = await this.sendMessage('GET_TRAFFIC');
      if (resp && resp.success) {
        const d = resp.data;
        const el = (id) => document.getElementById(id);
        el('sUpSpeed').textContent = formatSpeed(d.uploadSpeed || 0);
        el('sDownSpeed').textContent = formatSpeed(d.downloadSpeed || 0);
        el('sConnections').textContent = d.connections || 0;
        el('sUpload').textContent = this.formatBytes(d.upload || 0);
        el('sDownload').textContent = this.formatBytes(d.download || 0);
        // 收集图表数据
        this.sChartData.up.push(d.uploadSpeed || 0);
        this.sChartData.down.push(d.downloadSpeed || 0);
        if (this.sChartData.up.length > this.sMaxChartPoints) {
          this.sChartData.up.shift();
          this.sChartData.down.shift();
        }
        this.drawSettingsChart();
      }
    } catch {}
    // 内核占用
    try {
      const { config } = await chrome.storage.local.get('config');
      if (config && config.mihomoAPI) {
        const headers = {};
        if (config.secret) headers['Authorization'] = `Bearer ${config.secret}`;
        const resp = await fetch(`${config.mihomoAPI}/memory`, { headers, signal: AbortSignal.timeout(2000) });
        const reader = resp.body.getReader();
        const { value } = await reader.read();
        reader.cancel();
        const text = new TextDecoder().decode(value);
        const line = text.trim().split('\n')[0];
        if (line) {
          const mem = JSON.parse(line);
          document.getElementById('sMemory').textContent = this.formatBytes(mem.inuse || 0);
        }
      }
    } catch {}
  }

  drawSettingsChart() {
    const canvas = document.getElementById('sTrafficChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const w = rect.width || 300;
    const h = 120;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.height = h + 'px';
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    const padTop = 8, padBot = 4;
    const drawH = h - padTop - padBot;

    // 网格线
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      const y = padTop + (drawH / 4) * i;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }

    // 用固定长度数组，不足的前面补0
    const total = this.sMaxChartPoints;
    const upFull = new Array(total).fill(0);
    const downFull = new Array(total).fill(0);
    const upLen = this.sChartData.up.length;
    const downLen = this.sChartData.down.length;
    for (let i = 0; i < upLen; i++) upFull[total - upLen + i] = this.sChartData.up[i];
    for (let i = 0; i < downLen; i++) downFull[total - downLen + i] = this.sChartData.down[i];

    const allVals = [...upFull, ...downFull];
    const maxVal = Math.max(...allVals, 1024);
    const stepX = w / (total - 1);

    const toY = (v) => padTop + drawH - (v / maxVal) * drawH;

    // 下载（橙色）
    this._drawSmoothArea(ctx, downFull, stepX, toY, w, h, '#fb923c', 0.2);
    // 上传（蓝色）
    this._drawSmoothArea(ctx, upFull, stepX, toY, w, h, '#38bdf8', 0.15);

    // 右上角图例
    ctx.font = '10px -apple-system, sans-serif';
    ctx.fillStyle = '#38bdf8'; ctx.fillText('↑ 上传', w - 100, 14);
    ctx.fillStyle = '#fb923c'; ctx.fillText('↓ 下载', w - 46, 14);
  }

  _drawSmoothArea(ctx, data, stepX, toY, w, h, color, alpha) {
    const pts = data.length;
    if (pts < 2) return;

    // 画线
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    ctx.moveTo(0, toY(data[0]));
    for (let i = 1; i < pts; i++) {
      const x0 = (i - 1) * stepX, x1 = i * stepX;
      const y0 = toY(data[i - 1]), y1 = toY(data[i]);
      const cpx = (x0 + x1) / 2;
      ctx.bezierCurveTo(cpx, y0, cpx, y1, x1, y1);
    }
    ctx.stroke();

    // 填充渐变
    ctx.lineTo((pts - 1) * stepX, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    grad.addColorStop(0, `rgba(${r},${g},${b},${alpha})`);
    grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
    ctx.fillStyle = grad;
    ctx.fill();
  }

  formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  toggleLiteIP() {
    this.liteIpVisible = !this.liteIpVisible;
    const ipText = document.getElementById('liteIP');
    const icon = document.getElementById('liteEyeIcon');
    if (this.liteIpVisible) {
      ipText.classList.remove('blurred');
      icon.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
    } else {
      ipText.classList.add('blurred');
      icon.innerHTML = '<path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>';
    }
  }

  // === IP 检测 ===
  toggleIPVisibility() {
    this.ipVisible = !this.ipVisible;
    const list = document.getElementById('ipDetailList');
    const btn = document.getElementById('ipToggle');
    const eyeIcon = document.getElementById('eyeIcon');
    if (this.ipVisible) {
      list.classList.remove('masked');
      btn.classList.remove('masked');
      eyeIcon.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
    } else {
      list.classList.add('masked');
      btn.classList.add('masked');
      eyeIcon.innerHTML = '<path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>';
    }
  }

  async fetchIP() {
    // 轻量模式 IP 显示
    const liteIP = document.getElementById('liteIP');
    if (liteIP) liteIP.textContent = '检测中...';

    // 完整模式 IP 显示
    const ipEl = document.getElementById('ipAddress');
    const countryEl = document.getElementById('ipCountry');
    const locEl = document.getElementById('ipLocation');
    const orgEl = document.getElementById('ipOrg');
    const tzEl = document.getElementById('ipTimezone');
    const asnEl = document.getElementById('ipASN');
    const refreshBtn = document.getElementById('ipRefresh');

    if (ipEl) ipEl.textContent = '检测中...';
    if (countryEl) countryEl.textContent = '-';
    if (locEl) locEl.textContent = '-';
    if (orgEl) orgEl.textContent = '-';
    if (tzEl) tzEl.textContent = '-';
    if (asnEl) asnEl.textContent = '-';
    if (refreshBtn) refreshBtn.classList.add('spinning');

    this.ipData = null;

    const nocache = `_t=${Date.now()}`;
    const apis = [
      {
        url: `http://ip-api.com/json/?fields=query,country,countryCode,regionName,city,timezone,isp,org,as&${nocache}`,
        parse: (d) => ({
          ip: d.query || '-', country: d.country || '-', countryCode: d.countryCode || '',
          location: [d.city, d.regionName].filter(Boolean).join(', ') || '-',
          org: d.org || d.isp || '-', timezone: d.timezone || '-',
          asn: d.as ? d.as.split(' ')[0] : '-',
        })
      },
      {
        url: `https://ipwho.is/?${nocache}`,
        parse: (d) => ({
          ip: d.ip || '-', country: d.country || '-', countryCode: d.country_code || '',
          location: [d.city, d.region].filter(Boolean).join(', ') || '-',
          org: (d.connection && (d.connection.org || d.connection.isp)) || '-',
          timezone: (d.timezone && d.timezone.id) || '-',
          asn: (d.connection && d.connection.asn) ? `AS${d.connection.asn}` : '-',
        })
      },
      {
        url: `https://ipapi.co/json/?${nocache}`,
        parse: (d) => ({
          ip: d.ip || '-', country: d.country_name || '-', countryCode: d.country_code || '',
          location: [d.city, d.region].filter(Boolean).join(', ') || '-',
          org: d.org || '-', timezone: d.timezone || '-', asn: d.asn || '-',
        })
      }
    ];

    const fetchOpts = {
      signal: AbortSignal.timeout(6000), cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
    };

    for (const api of apis) {
      try {
        const resp = await fetch(api.url, fetchOpts);
        const data = await resp.json();
        const ip = data.ip || data.query;
        if (ip) {
          const result = api.parse(data);
          if (result.country !== '-' || result.org !== '-') {
            this.ipData = result;
            break;
          }
        }
      } catch {}
    }

    if (!this.ipData) {
      try {
        const resp = await fetch(`https://api.ipify.org?format=json&${nocache}`, {
          signal: AbortSignal.timeout(5000), cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' }
        });
        const data = await resp.json();
        this.ipData = { ip: data.ip, country: '-', countryCode: '', location: '-', org: '-', timezone: '-', asn: '-' };
      } catch {
        this.ipData = { ip: '检测失败', country: '-', countryCode: '', location: '-', org: '-', timezone: '-', asn: '-' };
      }
    }

    if (refreshBtn) refreshBtn.classList.remove('spinning');
    this.updateIPDisplay();
  }

  updateIPDisplay() {
    if (!this.ipData) return;
    const flag = this.ipData.countryCode ? this.countryFlag(this.ipData.countryCode) + ' ' : '';

    // 轻量模式
    const liteIP = document.getElementById('liteIP');
    if (liteIP) liteIP.textContent = this.ipData.ip;

    // 完整模式
    const ipEl = document.getElementById('ipAddress');
    if (ipEl) ipEl.textContent = this.ipData.ip;
    const countryEl = document.getElementById('ipCountry');
    if (countryEl) countryEl.textContent = flag + this.ipData.country;
    const locEl = document.getElementById('ipLocation');
    if (locEl) locEl.textContent = this.ipData.location;
    const orgEl = document.getElementById('ipOrg');
    if (orgEl) orgEl.textContent = this.ipData.org;
    const tzEl = document.getElementById('ipTimezone');
    if (tzEl) tzEl.textContent = this.ipData.timezone;
    const asnEl = document.getElementById('ipASN');
    if (asnEl) asnEl.textContent = this.ipData.asn;

    if (!this.ipVisible) {
      const list = document.getElementById('ipDetailList');
      if (list) list.classList.add('masked');
    }
    if (!this.liteIpVisible) {
      const liteIPEl = document.getElementById('liteIP');
      if (liteIPEl) liteIPEl.classList.add('blurred');
    }
  }

  countryFlag(code) {
    if (!code || code.length !== 2) return '';
    const base = 0x1F1E6 - 65;
    return String.fromCodePoint(base + code.charCodeAt(0), base + code.charCodeAt(1));
  }

  // 从节点名提取国家代码
  guessCountryCode(name) {
    const map = {
      '香港': 'HK', 'HK': 'HK', '日本': 'JP', 'JP': 'JP',
      '新加坡': 'SG', 'SG': 'SG', '美国': 'US', 'US': 'US',
      '台湾': 'TW', 'TW': 'TW', '韩国': 'KR', 'KR': 'KR',
      '英国': 'GB', 'GB': 'GB', 'UK': 'GB',
      '德国': 'DE', 'DE': 'DE', '法国': 'FR', 'FR': 'FR',
      '加拿大': 'CA', 'CA': 'CA', '澳大利亚': 'AU', 'AU': 'AU',
      '印度': 'IN', 'IN': 'IN', '俄罗斯': 'RU', 'RU': 'RU',
      '土耳其': 'TR', 'TR': 'TR', '巴西': 'BR', 'BR': 'BR',
      '荷兰': 'NL', 'NL': 'NL', '阿根廷': 'AR', 'AR': 'AR',
    };
    for (const [key, code] of Object.entries(map)) {
      if (name.includes(key)) return code;
    }
    return '--';
  }

  // === 测速 ===
  async runSpeedTest(isAuto) {
    const btn = document.getElementById('testAll');
    const liteBtn = document.getElementById('liteTestAll');
    if (btn) { btn.disabled = true; btn.textContent = '刷新中...'; }
    if (liteBtn) { liteBtn.disabled = true; liteBtn.textContent = '刷新中...'; liteBtn.classList.add('loading'); }
    this.isTesting = true;

    const proxies = this.state.proxies || {};
    const group = proxies[this.state.currentGroup];
    const skipNodes = new Set(['DIRECT', 'REJECT']);
    const nodeNames = [];
    if (group && group.all) {
      for (const name of group.all) {
        if (skipNodes.has(name)) continue;
        const p = proxies[name];
        if (!p) continue;
        const isSubGroup = p.type === 'Selector' || p.type === 'URLTest' || p.type === 'Fallback';
        if (isSubGroup) continue;
        nodeNames.push(name);
      }
    }

    // 完整模式：节点显示 loading
    nodeNames.forEach(name => {
      const el = document.querySelector(`.proxy-item[data-name="${CSS.escape(name)}"] .latency`);
      if (el) {
        el.innerHTML = '<span class="spin-loader"></span>';
        el.className = 'latency testing';
      }
    });

    // 用 TEST_GROUP_DELAY 一次性测完整个组（mihomo 内部并发）
    try {
      const resp = await this.sendMessage('TEST_GROUP_DELAY', { group: this.state.currentGroup });
      if (resp && resp.success && resp.data) {
        const delays = resp.data;
        for (const name of nodeNames) {
          const delay = delays[name] || 0;
          if (this.state.proxies[name]) {
            this.state.proxies[name].delay = delay;
          }
          const el = document.querySelector(`.proxy-item[data-name="${CSS.escape(name)}"] .latency`);
          if (el) {
            if (delay > 0) {
              el.textContent = `${delay}ms`;
              el.className = 'latency' + (delay <= 200 ? ' good' : delay <= 1000 ? ' medium' : ' bad');
            } else {
              el.textContent = 'timeout';
              el.className = 'latency timeout';
            }
          }
        }
      }
    } catch {}

    this.isTesting = false;
    this.renderLiteNode();
    if (btn) { btn.disabled = false; btn.textContent = '刷新延迟'; }
    if (liteBtn) { liteBtn.disabled = false; liteBtn.textContent = '刷新延迟'; liteBtn.classList.remove('loading'); }
    if (!isAuto) this.showToast(`延迟刷新完成，共 ${nodeNames.length} 个节点`, 'success');
    if (this.litePanelOpen) this.renderLitePanel();
  }

  // === 代理控制 ===
  async toggleProxy() {
    if (this._toggling) return;
    this._toggling = true;

    // 如果未连接，先尝试连接
    if (!this.state.connected) {
      try {
        const cr = await this.sendMessage('CONNECT');
        if (!cr || !cr.success) {
          this.showToast('连接失败，请检查设置');
          this._toggling = false;
          return;
        }
        const updated = await this.sendMessage('GET_STATE');
        if (updated && updated.success) this.state = updated.data;
      } catch {
        this.showToast('连接失败，请检查设置');
        this._toggling = false;
        return;
      }
    }

    const enabled = !this.state.proxyEnabled;

    // 乐观更新：立刻切换 UI
    this.state.proxyEnabled = enabled;
    this.render();

    // 后台执行实际操作
    try {
      const resp = await this.sendMessage('TOGGLE_PROXY', { enabled });
      if (!resp || !resp.success) {
        // 回滚
        this.state.proxyEnabled = !enabled;
        this.render();
        this.showToast(resp ? resp.error : '操作失败');
      } else {
        this.fetchIP();
        if (enabled) this.startTrafficStream();
      }
    } catch (e) {
      this.state.proxyEnabled = !enabled;
      this.render();
      this.showToast('操作失败: ' + e.message);
    } finally {
      this._toggling = false;
    }
  }

  async selectProxy(proxyName) {
    try {
      const resp = await this.sendMessage('SELECT_PROXY', {
        group: this.state.currentGroup, proxy: proxyName
      });
      if (!resp || !resp.success) {
        this.showToast(resp ? resp.error : '切换失败');
      } else {
        this.showToast(`已切换到 ${proxyName}`, 'success');
        setTimeout(() => this.fetchIP(), 1500);
      }
    } catch { this.showToast('切换失败'); }
  }

  // === 渲染 ===
  render() {
    if (!this.state) return;
    this.renderLite();
    this.renderFull();
  }

  // --- 轻量模式渲染 ---
  renderLite() {
    const sw = document.getElementById('powerSwitch');
    const txt = document.getElementById('powerText');
    const status = document.getElementById('liteStatus');
    if (!sw) return;

    if (this.state.proxyEnabled && this.state.connected) {
      sw.classList.add('active');
      txt.textContent = 'ON';
      status.textContent = this.state.mihomoVersion ? `已连接 ${this.state.mihomoVersion}` : '已连接';
    } else if (this.state.connected) {
      sw.classList.remove('active');
      txt.textContent = 'OFF';
      status.textContent = '代理已关闭';
    } else {
      sw.classList.remove('active');
      txt.textContent = 'OFF';
      status.textContent = '未连接';
    }

    this.renderLiteGroups();
    this.renderLiteNode();
  }

  renderLiteGroups() {
    const select = document.getElementById('liteGroupSelect');
    if (!select) return;
    select.innerHTML = '';
    const proxies = this.state.proxies || {};
    const builtIn = new Set(['GLOBAL', 'DIRECT', 'REJECT']);
    const groups = Object.keys(proxies).filter(name => {
      if (builtIn.has(name)) return false;
      const p = proxies[name];
      return p && (p.type === 'Selector' || p.type === 'URLTest' || p.type === 'Fallback');
    });

    if (groups.length === 0) {
      const opt = document.createElement('option');
      opt.textContent = '无代理组';
      select.appendChild(opt);
      return;
    }

    if (!groups.includes(this.state.currentGroup)) {
      this.state.currentGroup = groups[0];
    }

    groups.forEach(g => {
      const opt = document.createElement('option');
      opt.value = g;
      opt.textContent = g;
      opt.selected = g === this.state.currentGroup;
      select.appendChild(opt);
    });
  }

  renderLiteNode() {
    const proxies = this.state.proxies || {};
    const group = proxies[this.state.currentGroup];
    const nameEl = document.getElementById('liteNodeName');
    const pingEl = document.getElementById('liteNodePing');
    const countryEl = document.getElementById('liteCountry');
    if (!nameEl) return;

    if (!group || !group.now) {
      nameEl.textContent = '未选择节点';
      pingEl.textContent = '-';
      pingEl.className = 'lite-node-ping';
      countryEl.textContent = '--';
      return;
    }

    const current = proxies[group.now];
    nameEl.textContent = group.now;
    countryEl.textContent = this.guessCountryCode(group.now);

    if (current && current.delay && current.delay > 0) {
      pingEl.textContent = `${current.delay}ms`;
      pingEl.className = 'lite-node-ping ' + (current.delay <= 200 ? 'ping-green' : current.delay <= 1000 ? 'ping-yellow' : 'ping-red');
    } else {
      pingEl.textContent = current ? 'timeout' : '-';
      pingEl.className = 'lite-node-ping ping-gray';
    }
  }

  renderLitePanel() {
    const list = document.getElementById('liteNodeList');
    if (!list) return;
    list.innerHTML = '';
    const proxies = this.state.proxies || {};
    const group = proxies[this.state.currentGroup];
    if (!group || !group.all) return;

    const skipNodes = new Set(['DIRECT', 'REJECT']);

    group.all.forEach(name => {
      if (skipNodes.has(name)) return;
      const proxy = proxies[name];
      if (!proxy) return;
      const isSubGroup = proxy.type === 'Selector' || proxy.type === 'URLTest' || proxy.type === 'Fallback';
      if (isSubGroup) return;

      const item = document.createElement('div');
      item.className = 'lite-list-item' + (name === group.now ? ' active' : '');

      const left = document.createElement('div');
      left.className = 'lite-list-left';

      const cc = document.createElement('div');
      cc.className = 'lite-country';
      cc.textContent = this.guessCountryCode(name);

      const nm = document.createElement('div');
      nm.className = 'lite-list-name';
      nm.textContent = name;

      left.appendChild(cc);
      left.appendChild(nm);

      const ping = document.createElement('div');
      ping.className = 'lite-list-ping';
      if (proxy.delay && proxy.delay > 0) {
        ping.textContent = `${proxy.delay}ms`;
        ping.classList.add(proxy.delay <= 200 ? 'ping-green' : proxy.delay <= 1000 ? 'ping-yellow' : 'ping-red');
      } else {
        ping.textContent = 'timeout';
        ping.classList.add('ping-gray');
      }

      item.appendChild(left);
      item.appendChild(ping);

      item.addEventListener('click', () => {
        this.selectProxy(name);
        document.getElementById('litePanel').classList.remove('open');
        document.getElementById('liteOverlay').classList.remove('open');
        this.litePanelOpen = false;
      });

      list.appendChild(item);
    });
  }

  // --- 完整模式渲染 ---
  renderFull() {
    this.renderStatus();
    this.renderGroups();
    if (!this.isTesting) this.renderProxies();
  }

  renderStatus() {
    const indicator = document.getElementById('statusIndicator');
    const text = document.getElementById('statusText');
    const badge = document.getElementById('proxyStatusBadge');
    const toggleBtn = document.getElementById('toggleProxy');
    if (!indicator || !text || !badge || !toggleBtn) return;

    if (this.state.connected) {
      indicator.className = 'dot online';
      text.textContent = this.state.mihomoVersion ? `${this.state.mihomoVersion}` : '在线';
    } else {
      indicator.className = 'dot offline';
      text.textContent = this.state.connectError || '未连接';
    }

    if (this.state.proxyEnabled) {
      toggleBtn.innerHTML = '<span class="btn-icon">⏹</span> 停止代理';
      toggleBtn.className = 'btn btn-primary active';
      badge.className = 'badge badge-success';
      badge.textContent = '已启用';
    } else {
      toggleBtn.innerHTML = '<span class="btn-icon">▶</span> 启用代理';
      toggleBtn.className = 'btn btn-primary';
      badge.className = 'badge badge-disabled';
      badge.textContent = '未启用';
    }
  }

  renderGroups() {
    const select = document.getElementById('groupSelect');
    if (!select) return;
    select.innerHTML = '';
    const proxies = this.state.proxies || {};
    const builtIn = new Set(['GLOBAL', 'DIRECT', 'REJECT']);
    const groups = Object.keys(proxies).filter(name => {
      if (builtIn.has(name)) return false;
      const p = proxies[name];
      return p && (p.type === 'Selector' || p.type === 'URLTest' || p.type === 'Fallback');
    });

    if (groups.length === 0) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = '请在 Clash 中配置代理组';
      select.appendChild(opt);
      return;
    }

    if (!groups.includes(this.state.currentGroup)) {
      this.state.currentGroup = groups[0];
    }

    groups.forEach(g => {
      const opt = document.createElement('option');
      opt.value = g;
      opt.textContent = g;
      opt.selected = g === this.state.currentGroup;
      select.appendChild(opt);
    });
  }

  renderProxies() {
    const container = document.getElementById('proxyList');
    if (!container) return;
    container.innerHTML = '';
    const proxies = this.state.proxies || {};
    const group = proxies[this.state.currentGroup];

    if (!group || !group.all || group.all.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="empty-text">暂无节点</div></div>';
      return;
    }

    const skipNodes = new Set(['DIRECT', 'REJECT']);

    group.all.forEach(name => {
      if (skipNodes.has(name)) return;
      const proxy = proxies[name];
      if (!proxy) return;

      const isSubGroup = proxy.type === 'Selector' || proxy.type === 'URLTest' || proxy.type === 'Fallback';
      const onClick = isSubGroup
        ? () => {
            this.state.currentGroup = name;
            document.getElementById('groupSelect').value = name;
            this.render();
          }
        : () => this.selectProxy(name);

      container.appendChild(this.createProxyItem(proxy, name === group.now, onClick, isSubGroup));
    });
  }

  createProxyItem(proxy, selected, onClick, isGroup = false) {
    const item = document.createElement('div');
    item.className = `proxy-item${selected ? ' selected' : ''}${isGroup ? ' is-group' : ''}`;
    item.setAttribute('data-name', proxy.name);

    const info = document.createElement('div');
    info.className = 'node-info';
    const name = document.createElement('div');
    name.className = 'node-name';
    name.textContent = proxy.name;
    name.title = proxy.name;
    const type = document.createElement('span');

    if (isGroup) {
      type.className = 'node-type type-group';
      type.textContent = proxy.now || proxy.type;
    } else {
      const tc = { Shadowsocks:'type-ss', ShadowsocksR:'type-ss', VMess:'type-vmess', VLESS:'type-vless', Trojan:'type-trojan' }[proxy.type] || 'type-ss';
      type.className = `node-type ${tc}`;
      type.textContent = proxy.type || '?';
    }
    info.appendChild(name);
    info.appendChild(type);

    const status = document.createElement('div');
    status.className = 'node-status';
    const delay = document.createElement('span');
    delay.className = 'latency';
    if (isGroup) {
      delay.textContent = '→';
      delay.className += ' group-arrow';
    } else if (proxy.delay && proxy.delay > 0) {
      delay.textContent = `${proxy.delay}ms`;
      delay.className += proxy.delay <= 200 ? ' good' : proxy.delay <= 1000 ? ' medium' : ' bad';
    } else {
      delay.textContent = 'timeout';
      delay.className += ' timeout';
    }
    status.appendChild(delay);

    item.appendChild(info);
    item.appendChild(status);
    item.addEventListener('click', onClick);
    return item;
  }

  // === 实时流量迷你图 ===
  async startTrafficStream() {
    try {
      const { config } = await chrome.storage.local.get('config');
      if (!config || !config.mihomoAPI) return;

      const headers = {};
      if (config.secret) headers['Authorization'] = `Bearer ${config.secret}`;
      const resp = await fetch(`${config.mihomoAPI}/traffic`, { headers });
      const reader = resp.body.getReader();
      this.trafficReader = reader;
      const decoder = new TextDecoder();
      let buffer = '';

      const read = async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop();
            for (const line of lines) {
              const t = line.trim();
              if (!t) continue;
              try { this.onTrafficTick(JSON.parse(t)); } catch {}
            }
          }
        } catch {}
      };
      read();
    } catch {}
  }

  onTrafficTick(data) {
    const up = data.up || 0;
    const down = data.down || 0;

    const upEl = document.getElementById('miniUpSpeed');
    const downEl = document.getElementById('miniDownSpeed');
    if (upEl) upEl.textContent = formatSpeed(up);
    if (downEl) downEl.textContent = formatSpeed(down);

    this.chartData.up.push(up);
    this.chartData.down.push(down);
    if (this.chartData.up.length > this.maxChartPoints) {
      this.chartData.up.shift();
      this.chartData.down.shift();
    }
    this.drawMiniChart();
  }

  drawMiniChart() {
    const canvas = document.getElementById('miniTrafficChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const w = 178, h = 40;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    const allVals = [...this.chartData.up, ...this.chartData.down];
    const maxVal = Math.max(...allVals, 1024);
    const pts = this.chartData.up.length;
    if (pts < 2) return;

    const stepX = w / (this.maxChartPoints - 1);
    const offset = this.maxChartPoints - pts;

    this.drawMiniLine(ctx, this.chartData.down, maxVal, h, stepX, offset, '#fb923c', 0.2);
    this.drawMiniLine(ctx, this.chartData.up, maxVal, h, stepX, offset, '#38bdf8', 0.15);
  }

  drawMiniLine(ctx, data, maxVal, h, stepX, offset, color, alpha) {
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.2;
    ctx.lineJoin = 'round';
    for (let i = 0; i < data.length; i++) {
      const x = (offset + i) * stepX;
      const y = h - (data[i] / maxVal) * (h - 4) - 2;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.lineTo((offset + data.length - 1) * stepX, h);
    ctx.lineTo(offset * stepX, h);
    ctx.closePath();
    const r = parseInt(color.slice(1,3), 16);
    const g = parseInt(color.slice(3,5), 16);
    const b = parseInt(color.slice(5,7), 16);
    ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
    ctx.fill();
  }

  showToast(msg, type = 'error') {
    const existing = document.querySelector('.toast-msg');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.className = 'toast-msg';
    toast.textContent = msg;
    const bg = type === 'success' ? '#4caf50' : '#f44336';
    toast.style.cssText = `position:fixed;bottom:16px;left:50%;transform:translateX(-50%);background:${bg};color:white;padding:10px 20px;border-radius:8px;font-size:13px;z-index:9999;box-shadow:0 4px 12px rgba(0,0,0,0.3);`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
  }
}

new PopupApp();
