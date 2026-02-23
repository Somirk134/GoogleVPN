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
    this.ipData = null;
    // 迷你流量图数据
    this.chartData = { up: [], down: [] };
    this.maxChartPoints = 30;
    this.trafficReader = null;
    this.init();
  }

  async init() {
    let connectOk = false;
    try {
      const cr = await this.sendMessage('CONNECT');
      connectOk = cr && cr.success;
    } catch (e) {}

    const resp = await this.sendMessage('GET_STATE');
    this.state = (resp && resp.success) ? resp.data : this.defaultState();

    // 未连接 → 直接打开设置页
    if (!connectOk && !this.state.connected) {
      chrome.runtime.openOptionsPage();
      window.close();
      return;
    }

    this.bindEvents();

    // 连接成功但代理未启用 → 自动启用
    if (this.state.connected && !this.state.proxyEnabled) {
      await this.sendMessage('TOGGLE_PROXY', { enabled: true });
      const updated = await this.sendMessage('GET_STATE');
      if (updated && updated.success) this.state = updated.data;
    }

    this.render();

    // 自动检测 IP（不管代理开没开）
    this.fetchIP();

    chrome.runtime.onMessage.addListener((msg) => {
      if (msg.type === 'STATE_UPDATE') {
        this.state = msg.state;
        if (!this.isTesting) this.render();
      }
    });

    // 拉延迟
    if (this.state.connected) {
      this.runSpeedTest(true);
      this.startTrafficStream();
    }
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

  bindEvents() {
    document.getElementById('toggleProxy').addEventListener('click', () => this.toggleProxy());
    document.getElementById('testAll').addEventListener('click', () => this.runSpeedTest(false));
    document.getElementById('groupSelect').addEventListener('change', (e) => {
      this.state.currentGroup = e.target.value;
      this.render();
    });
    document.getElementById('settings').addEventListener('click', () => chrome.runtime.openOptionsPage());
    document.getElementById('ipToggle').addEventListener('click', () => this.toggleIPVisibility());
    document.getElementById('ipRefresh').addEventListener('click', () => this.fetchIP());
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
    const ipEl = document.getElementById('ipAddress');
    const countryEl = document.getElementById('ipCountry');
    const locEl = document.getElementById('ipLocation');
    const orgEl = document.getElementById('ipOrg');
    const tzEl = document.getElementById('ipTimezone');
    const asnEl = document.getElementById('ipASN');
    const refreshBtn = document.getElementById('ipRefresh');

    ipEl.textContent = '检测中...';
    countryEl.textContent = '-';
    locEl.textContent = '-';
    orgEl.textContent = '-';
    tzEl.textContent = '-';
    asnEl.textContent = '-';
    refreshBtn.classList.add('spinning');

    this.ipData = null;

    // 从 popup 直接 fetch，加 cache-busting 防止切换节点后拿到缓存的旧 IP
    const nocache = `_t=${Date.now()}`;
    const apis = [
      {
        url: `http://ip-api.com/json/?fields=query,country,countryCode,regionName,city,timezone,isp,org,as&${nocache}`,
        parse: (d) => ({
          ip: d.query || '-',
          country: d.country || '-',
          countryCode: d.countryCode || '',
          location: [d.city, d.regionName].filter(Boolean).join(', ') || '-',
          org: d.org || d.isp || '-',
          timezone: d.timezone || '-',
          asn: d.as ? d.as.split(' ')[0] : '-',
        })
      },
      {
        url: `https://ipwho.is/?${nocache}`,
        parse: (d) => ({
          ip: d.ip || '-',
          country: d.country || '-',
          countryCode: d.country_code || '',
          location: [d.city, d.region].filter(Boolean).join(', ') || '-',
          org: (d.connection && (d.connection.org || d.connection.isp)) || '-',
          timezone: (d.timezone && d.timezone.id) || '-',
          asn: (d.connection && d.connection.asn) ? `AS${d.connection.asn}` : '-',
        })
      },
      {
        url: `https://ipapi.co/json/?${nocache}`,
        parse: (d) => ({
          ip: d.ip || '-',
          country: d.country_name || '-',
          countryCode: d.country_code || '',
          location: [d.city, d.region].filter(Boolean).join(', ') || '-',
          org: d.org || '-',
          timezone: d.timezone || '-',
          asn: d.asn || '-',
        })
      }
    ];

    const fetchOpts = {
      signal: AbortSignal.timeout(6000),
      cache: 'no-store',
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

    refreshBtn.classList.remove('spinning');

    const flag = this.ipData.countryCode ? this.countryFlag(this.ipData.countryCode) + ' ' : '';

    ipEl.textContent = this.ipData.ip;
    countryEl.textContent = flag + this.ipData.country;
    locEl.textContent = this.ipData.location;
    orgEl.textContent = this.ipData.org;
    tzEl.textContent = this.ipData.timezone;
    asnEl.textContent = this.ipData.asn;

    if (!this.ipVisible) {
      document.getElementById('ipDetailList').classList.add('masked');
    }
  }

  // 国家代码 → 国旗 emoji（regional indicator symbols）
  countryFlag(code) {
    if (!code || code.length !== 2) return '';
    const base = 0x1F1E6 - 65; // 'A' = 65
    return String.fromCodePoint(base + code.charCodeAt(0), base + code.charCodeAt(1));
  }

  // === 测速 ===
  async runSpeedTest(isAuto) {
    const btn = document.getElementById('testAll');
    btn.disabled = true;
    btn.textContent = '刷新中...';
    this.isTesting = true;

    // 收集当前组内所有普通节点名
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

    // 所有节点先显示 loading
    nodeNames.forEach(name => {
      const el = document.querySelector(`.proxy-item[data-name="${CSS.escape(name)}"] .latency`);
      if (el) {
        el.innerHTML = '<span class="spin-loader"></span>';
        el.className = 'latency testing';
      }
    });

    // 并发测速，每个节点独立返回后立刻更新 UI
    const promises = nodeNames.map(name =>
      this.sendMessage('TEST_NODE_DELAY', { name }).then(resp => {
        const delay = (resp && resp.success && resp.data) ? resp.data.delay : 0;
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
        // 同步到本地 state
        if (this.state.proxies[name]) {
          this.state.proxies[name].delay = delay;
        }
      }).catch(() => {
        const el = document.querySelector(`.proxy-item[data-name="${CSS.escape(name)}"] .latency`);
        if (el) {
          el.textContent = 'timeout';
          el.className = 'latency timeout';
        }
      })
    );

    await Promise.allSettled(promises);

    this.isTesting = false;
    btn.disabled = false;
    btn.textContent = '刷新延迟';
  }

  // === 代理控制 ===
  async toggleProxy() {
    const enabled = !this.state.proxyEnabled;
    try {
      const resp = await this.sendMessage('TOGGLE_PROXY', { enabled });
      if (!resp || !resp.success) this.showToast(resp ? resp.error : '操作失败');
      else {
        // 切换代理后自动重新检测 IP
        this.fetchIP();
      }
    } catch (e) {
      this.showToast('操作失败: ' + e.message);
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
        // 切换节点后等连接建立再检测 IP
        setTimeout(() => this.fetchIP(), 1500);
      }
    } catch { this.showToast('切换失败'); }
  }

  // === 渲染 ===
  render() {
    if (!this.state) return;
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
      text.textContent = this.state.mihomoVersion ? `v${this.state.mihomoVersion}` : '在线';
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
    select.innerHTML = '';
    const proxies = this.state.proxies || {};

    // 只显示用户在 Clash 里配置的代理组，过滤掉 GLOBAL 和内置组
    const builtIn = new Set(['GLOBAL', 'DIRECT', 'REJECT']);
    const groups = Object.keys(proxies).filter(name => {
      if (builtIn.has(name)) return false;
      const p = proxies[name];
      return p && (p.type === 'Selector' || p.type === 'URLTest' || p.type === 'Fallback');
    });

    if (groups.length === 0) {
      // 没有用户配置的组，提示去 Clash 配置
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = '请在 Clash 中配置代理组';
      select.appendChild(opt);
      return;
    }

    // 如果当前选中的组不在列表里，自动选第一个
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
    container.innerHTML = '';
    const proxies = this.state.proxies || {};
    const group = proxies[this.state.currentGroup];

    if (!group || !group.all || group.all.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="empty-icon">📭</div><div class="empty-text">暂无节点，请确认 Clash 已启动</div></div>';
      return;
    }

    const skipNodes = new Set(['DIRECT', 'REJECT']);

    group.all.forEach(name => {
      if (skipNodes.has(name)) return;
      const proxy = proxies[name];
      if (!proxy) return;

      // 如果这个"节点"其实是一个代理组，点击时跳转到那个组
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
    name.textContent = isGroup ? `📁 ${proxy.name}` : proxy.name;
    name.title = proxy.name;
    const type = document.createElement('span');

    if (isGroup) {
      // 子组显示当前选中的节点名
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
      // 绿 0-200ms，黄 200-1000ms，红 >1000ms
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
              try {
                const data = JSON.parse(t);
                this.onTrafficTick(data);
              } catch {}
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

    document.getElementById('miniUpSpeed').textContent = formatSpeed(up);
    document.getElementById('miniDownSpeed').textContent = formatSpeed(down);

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

    // 下载（橙色）
    this.drawMiniLine(ctx, this.chartData.down, maxVal, h, stepX, offset, '#fb923c', 0.2);
    // 上传（蓝色）
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
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    // fill
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
