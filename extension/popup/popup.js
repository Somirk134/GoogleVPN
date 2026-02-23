// Popup UI — 直连 mihomo 版

import { formatBytes } from '../utils/format.js';

class PopupApp {
  constructor() {
    this.state = null;
    this.isTesting = false;
    this.ipVisible = true;
    this.ipData = null;
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
    this.render();

    // 自动检测 IP（不管代理开没开）
    this.fetchIP();

    chrome.runtime.onMessage.addListener((msg) => {
      if (msg.type === 'STATE_UPDATE') {
        this.state = msg.state;
        if (!this.isTesting) this.render();
      }
    });

    // 拉延迟 + 流量
    if (this.state.connected) {
      this.runSpeedTest(true);
      this.refreshTraffic();
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
    const ipEl = document.getElementById('ipAddress');
    const btn = document.getElementById('ipToggle');
    const eyeIcon = document.getElementById('eyeIcon');

    if (this.ipVisible) {
      ipEl.classList.remove('masked');
      btn.classList.remove('masked');
      // 正常眼睛
      eyeIcon.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
    } else {
      ipEl.classList.add('masked');
      btn.classList.add('masked');
      // 划线眼睛
      eyeIcon.innerHTML = '<path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>';
    }
  }

  async fetchIP() {
    const ipEl = document.getElementById('ipAddress');
    const locEl = document.getElementById('ipLocation');
    const refreshBtn = document.getElementById('ipRefresh');

    ipEl.textContent = '检测中...';
    locEl.textContent = '';
    refreshBtn.classList.add('spinning');

    this.ipData = null;

    try {
      const resp = await fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(5000) });
      const data = await resp.json();
      this.ipData = {
        ip: data.ip,
        location: [data.city, data.region, data.country_name].filter(Boolean).join(', ')
      };
    } catch {
      try {
        const resp = await fetch('https://api.ipify.org?format=json', { signal: AbortSignal.timeout(5000) });
        const data = await resp.json();
        this.ipData = { ip: data.ip, location: '' };
      } catch {
        this.ipData = { ip: '检测失败', location: '' };
      }
    }

    refreshBtn.classList.remove('spinning');
    ipEl.textContent = this.ipData.ip;
    locEl.textContent = this.ipData.location;

    // 保持当前可见性状态
    if (!this.ipVisible) {
      ipEl.classList.add('masked');
    }
  }

  // === 流量刷新 ===
  async refreshTraffic() {
    try {
      const resp = await this.sendMessage('GET_TRAFFIC');
      if (resp && resp.success) {
        this.state.traffic = resp.data;
        this.renderTraffic();
      }
    } catch {}
  }

  // === 测速 ===
  async runSpeedTest(isAuto) {
    const btn = document.getElementById('testAll');
    btn.disabled = true;
    btn.textContent = '刷新中...';
    this.isTesting = true;

    document.querySelectorAll('.latency').forEach(el => {
      el.innerHTML = '<span class="spin-loader"></span>';
      el.className = 'latency testing';
    });

    try {
      // 只读取 Clash Verge 缓存的延迟数据，不触发新测速
      const resp = await this.sendMessage('TEST_GROUP_DELAY');
      if (!resp || !resp.success) {
        if (!isAuto) this.showToast(resp ? resp.error : '刷新失败');
      }
    } catch (e) {
      if (!isAuto) this.showToast('刷新失败: ' + e.message);
    } finally {
      this.isTesting = false;
      btn.disabled = false;
      btn.textContent = '刷新延迟';
      const resp = await this.sendMessage('GET_STATE');
      if (resp && resp.success) this.state = resp.data;
      this.render();
    }
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
        // 切换节点后自动重新检测 IP
        setTimeout(() => this.fetchIP(), 500);
      }
    } catch { this.showToast('切换失败'); }
  }

  // === 渲染 ===
  render() {
    if (!this.state) return;
    this.renderStatus();
    this.renderGroups();
    if (!this.isTesting) this.renderProxies();
    this.renderTraffic();
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
      delay.className += proxy.delay < 100 ? ' good' : proxy.delay < 300 ? ' warning' : ' bad';
    } else {
      delay.textContent = '-';
    }
    status.appendChild(delay);

    item.appendChild(info);
    item.appendChild(status);
    item.addEventListener('click', onClick);
    return item;
  }

  renderTraffic() {
    const t = this.state.traffic || {};
    const up = document.getElementById('upload');
    const down = document.getElementById('download');
    const conn = document.getElementById('connections');
    if (up) up.textContent = formatBytes(t.upload || 0);
    if (down) down.textContent = formatBytes(t.download || 0);
    if (conn) conn.textContent = t.connections || 0;
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
