// Popup UI 主逻辑

import { formatBytes } from '../utils/format.js';

class PopupApp {
  constructor() {
    this.state = null;
    this.init();
  }
  
  async init() {
    console.log('Popup: Initializing...');
    
    // 加载状态
    await this.loadState();
    
    // 绑定事件
    this.bindEvents();
    
    // 渲染 UI
    this.render();
    
    // 监听状态更新
    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === 'STATE_UPDATE') {
        this.state = message.state;
        this.render();
      }
    });
    
    console.log('Popup: Initialized');
  }
  
  async loadState() {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_STATE'
      });
      
      if (response.success) {
        this.state = response.data;
      } else {
        console.error('Failed to load state:', response.error);
        this.showError('无法加载状态');
      }
    } catch (error) {
      console.error('Failed to load state:', error);
      this.showError('无法连接到后台服务');
    }
  }
  
  bindEvents() {
    // 切换代理
    document.getElementById('toggleProxy').addEventListener('click', () => {
      this.toggleProxy();
    });
    
    // 测速
    document.getElementById('testAll').addEventListener('click', () => {
      this.testAll();
    });
    
    // 代理组切换
    document.getElementById('groupSelect').addEventListener('change', (e) => {
      this.selectGroup(e.target.value);
    });
    
    // 设置
    document.getElementById('settings').addEventListener('click', () => {
      chrome.runtime.openOptionsPage();
    });
  }
  
  render() {
    if (!this.state) return;
    
    // 渲染状态指示器
    this.renderStatus();
    
    // 渲染代理组
    this.renderGroups();
    
    // 渲染节点列表
    this.renderProxies();
    
    // 渲染流量统计
    this.renderTraffic();
  }
  
  renderStatus() {
    const indicator = document.getElementById('statusIndicator');
    const text = document.getElementById('statusText');
    const toggleBtn = document.getElementById('toggleProxy');
    
    if (this.state.connected) {
      indicator.className = 'status-indicator connected';
      text.textContent = '已连接';
    } else {
      indicator.className = 'status-indicator disconnected';
      text.textContent = this.state.connectError || '未连接';
    }
    
    if (this.state.proxyEnabled) {
      toggleBtn.textContent = '禁用代理';
      toggleBtn.className = 'btn-toggle active';
    } else {
      toggleBtn.textContent = '启用代理';
      toggleBtn.className = 'btn-toggle';
    }
  }
  
  renderGroups() {
    const select = document.getElementById('groupSelect');
    select.innerHTML = '';
    
    const proxies = this.state.proxies || {};
    const groups = Object.keys(proxies).filter(name => {
      const proxy = proxies[name];
      return proxy.type === 'Selector' || proxy.type === 'URLTest' || proxy.type === 'Fallback';
    });
    
    if (groups.length === 0) {
      groups.push('GLOBAL');
    }
    
    groups.forEach(group => {
      const option = document.createElement('option');
      option.value = group;
      option.textContent = group;
      option.selected = group === this.state.currentGroup;
      select.appendChild(option);
    });
  }
  
  renderProxies() {
    const container = document.getElementById('proxyList');
    container.innerHTML = '';
    
    const proxies = this.state.proxies || {};
    const group = proxies[this.state.currentGroup];
    
    if (!group || !group.all || group.all.length === 0) {
      container.innerHTML = '<div class="empty-state"><p>暂无节点</p></div>';
      return;
    }
    
    group.all.forEach(proxyName => {
      const proxy = proxies[proxyName];
      if (!proxy) return;
      
      const item = this.createProxyItem(
        proxy,
        proxy.name === group.now,
        () => this.selectProxy(proxyName)
      );
      container.appendChild(item);
    });
  }
  
  createProxyItem(proxy, selected, onClick) {
    const item = document.createElement('div');
    item.className = `proxy-item ${selected ? 'selected' : ''}`;
    
    const info = document.createElement('div');
    info.className = 'proxy-info';
    
    const name = document.createElement('div');
    name.className = 'proxy-name';
    name.textContent = proxy.name;
    
    const type = document.createElement('div');
    type.className = 'proxy-type';
    type.textContent = proxy.type || 'Unknown';
    
    info.appendChild(name);
    info.appendChild(type);
    
    const delay = document.createElement('div');
    delay.className = 'proxy-delay';
    if (proxy.delay && proxy.delay > 0) {
      delay.textContent = `${proxy.delay}ms`;
      delay.className += this.getDelayClass(proxy.delay);
    } else {
      delay.textContent = '-';
    }
    
    item.appendChild(info);
    item.appendChild(delay);
    
    item.addEventListener('click', onClick);
    
    return item;
  }
  
  getDelayClass(delay) {
    if (delay < 100) return ' delay-good';
    if (delay < 300) return ' delay-medium';
    return ' delay-bad';
  }
  
  renderTraffic() {
    const upload = document.getElementById('upload');
    const download = document.getElementById('download');
    
    const traffic = this.state.traffic || { upload: 0, download: 0 };
    
    upload.textContent = formatBytes(traffic.upload);
    download.textContent = formatBytes(traffic.download);
  }
  
  async toggleProxy() {
    const enabled = !this.state.proxyEnabled;
    
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'TOGGLE_PROXY',
        data: { enabled }
      });
      
      if (response.success) {
        console.log('Proxy toggled:', enabled);
      } else {
        this.showError(response.error);
      }
    } catch (error) {
      console.error('Failed to toggle proxy:', error);
      this.showError('操作失败');
    }
  }
  
  async selectProxy(proxy) {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'SELECT_PROXY',
        data: {
          group: this.state.currentGroup,
          proxy: proxy
        }
      });
      
      if (response.success) {
        console.log('Proxy selected:', proxy);
      } else {
        this.showError(response.error);
      }
    } catch (error) {
      console.error('Failed to select proxy:', error);
      this.showError('切换失败');
    }
  }
  
  selectGroup(group) {
    this.state.currentGroup = group;
    this.render();
  }
  
  async testAll() {
    const testBtn = document.getElementById('testAll');
    testBtn.disabled = true;
    testBtn.textContent = '测速中...';
    
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'TEST_PROXIES',
        data: { proxies: null }
      });
      
      if (response.success) {
        console.log('Speed test completed');
      } else {
        this.showError(response.error);
      }
    } catch (error) {
      console.error('Speed test failed:', error);
      this.showError('测速失败');
    } finally {
      testBtn.disabled = false;
      testBtn.textContent = '测速';
    }
  }
  
  showError(message) {
    // 简单的错误提示
    alert(message);
  }
}

// 初始化
new PopupApp();
