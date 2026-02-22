# Chrome Extension 架构设计文档

## 1. Manifest V3 配置

### 1.1 manifest.json 结构

```json
{
  "manifest_version": 3,
  "name": "Proxy Manager",
  "version": "1.0.0",
  "description": "本地代理管理工具",
  "icons": {
    "16": "icons/icon16.png",
    "32": "icons/icon32.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  },
  "permissions": [
    "proxy",
    "storage",
    "alarms"
  ],
  "host_permissions": [
    "http://127.0.0.1:8765/*"
  ],
  "background": {
    "service_worker": "background.js",
    "type": "module"
  },
  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "32": "icons/icon32.png"
    },
    "default_title": "Proxy Manager"
  },
  "options_page": "options.html"
}
```

### 1.2 权限说明

| 权限 | 用途 | 必要性 |
|------|------|--------|
| proxy | 控制浏览器代理设置 | 必需 |
| storage | 存储配置和状态 | 必需 |
| alarms | 定时任务（状态同步、测速） | 必需 |
| host_permissions | 访问本地 Agent API | 必需 |

## 2. Service Worker 设计

### 2.1 核心职责

1. **代理控制**
   - 设置和管理浏览器代理
   - 监听代理状态变化
   - 处理代理错误

2. **API 通信**
   - 与本地 Agent 通信
   - 请求重试和错误处理
   - 连接状态监控

3. **状态管理**
   - 维护全局状态
   - 同步状态到 storage
   - 广播状态变化

4. **定时任务**
   - 定期同步状态
   - 自动测速
   - 健康检查

### 2.2 Service Worker 架构

```javascript
// background.js 模块结构

// 1. 状态管理模块
import { StateManager } from './modules/state.js';

// 2. API 客户端模块
import { AgentAPI } from './modules/api.js';

// 3. 代理控制模块
import { ProxyController } from './modules/proxy.js';

// 4. 定时任务模块
import { TaskScheduler } from './modules/scheduler.js';

// 5. 消息处理模块
import { MessageHandler } from './modules/message.js';

// 初始化
const state = new StateManager();
const api = new AgentAPI('http://127.0.0.1:8765');
const proxy = new ProxyController();
const scheduler = new TaskScheduler();
const message = new MessageHandler();

// Service Worker 生命周期
chrome.runtime.onInstalled.addListener(handleInstall);
chrome.runtime.onStartup.addListener(handleStartup);
chrome.alarms.onAlarm.addListener(handleAlarm);
chrome.runtime.onMessage.addListener(handleMessage);
```

### 2.3 状态管理设计

```javascript
// modules/state.js

class StateManager {
  constructor() {
    this.state = {
      // 连接状态
      connected: false,
      lastConnectTime: null,
      connectError: null,
      
      // 代理状态
      proxyEnabled: false,
      currentGroup: 'GLOBAL',
      currentProxy: null,
      
      // 节点列表
      proxies: {},
      groups: [],
      
      // 测速状态
      testing: false,
      lastTestTime: null,
      
      // 订阅状态
      subscriptions: [],
      
      // 流量统计
      traffic: {
        upload: 0,
        download: 0,
        uploadSpeed: 0,
        downloadSpeed: 0
      },
      
      // 更新时间
      lastUpdate: null
    };
  }
  
  // 获取状态
  getState() {
    return { ...this.state };
  }
  
  // 更新状态
  setState(updates) {
    this.state = { ...this.state, ...updates };
    this.state.lastUpdate = Date.now();
    this.persist();
    this.broadcast();
  }
  
  // 持久化到 storage
  async persist() {
    await chrome.storage.local.set({ state: this.state });
  }
  
  // 从 storage 恢复
  async restore() {
    const result = await chrome.storage.local.get('state');
    if (result.state) {
      this.state = result.state;
    }
  }
  
  // 广播状态变化
  broadcast() {
    chrome.runtime.sendMessage({
      type: 'STATE_UPDATE',
      state: this.state
    });
  }
}
```

### 2.4 API 客户端设计

```javascript
// modules/api.js

class AgentAPI {
  constructor(baseURL) {
    this.baseURL = baseURL;
    this.timeout = 5000;
    this.maxRetries = 3;
  }
  
  // 通用请求方法
  async request(method, path, data = null) {
    const url = `${this.baseURL}${path}`;
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };
    
    if (data) {
      options.body = JSON.stringify(data);
    }
    
    // 重试逻辑
    for (let i = 0; i < this.maxRetries; i++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);
        
        const response = await fetch(url, {
          ...options,
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.code !== 0) {
          throw new Error(result.message);
        }
        
        return result.data;
      } catch (error) {
        if (i === this.maxRetries - 1) {
          throw error;
        }
        await this.delay(Math.pow(2, i) * 1000);
      }
    }
  }
  
  // 延迟函数
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  // API 方法
  async getStatus() {
    return this.request('GET', '/api/v1/status');
  }
  
  async getProxies() {
    return this.request('GET', '/api/v1/proxies');
  }
  
  async selectProxy(group, proxy) {
    return this.request('PUT', `/api/v1/proxies/${group}`, { name: proxy });
  }
  
  async testProxies(proxies = null) {
    return this.request('POST', '/api/v1/proxies/test', { proxies });
  }
  
  async getSubscriptions() {
    return this.request('GET', '/api/v1/subscriptions');
  }
  
  async updateSubscription(id) {
    return this.request('POST', `/api/v1/subscriptions/${id}/update`);
  }
  
  async getTraffic() {
    return this.request('GET', '/api/v1/traffic');
  }
}
```

### 2.5 代理控制设计

```javascript
// modules/proxy.js

class ProxyController {
  constructor() {
    this.proxyConfig = null;
  }
  
  // 启用代理
  async enable(proxyHost = '127.0.0.1', proxyPort = 7890) {
    const config = {
      mode: 'fixed_servers',
      rules: {
        singleProxy: {
          scheme: 'http',
          host: proxyHost,
          port: proxyPort
        },
        bypassList: [
          'localhost',
          '127.0.0.1',
          '<local>'
        ]
      }
    };
    
    return new Promise((resolve, reject) => {
      chrome.proxy.settings.set(
        { value: config, scope: 'regular' },
        () => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            this.proxyConfig = config;
            resolve();
          }
        }
      );
    });
  }
  
  // 禁用代理
  async disable() {
    const config = {
      mode: 'direct'
    };
    
    return new Promise((resolve, reject) => {
      chrome.proxy.settings.set(
        { value: config, scope: 'regular' },
        () => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            this.proxyConfig = null;
            resolve();
          }
        }
      );
    });
  }
  
  // 获取当前代理设置
  async getSettings() {
    return new Promise((resolve, reject) => {
      chrome.proxy.settings.get(
        { incognito: false },
        (config) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(config);
          }
        }
      );
    });
  }
  
  // 检查代理是否启用
  async isEnabled() {
    const settings = await this.getSettings();
    return settings.value.mode === 'fixed_servers';
  }
}
```

### 2.6 定时任务设计

```javascript
// modules/scheduler.js

class TaskScheduler {
  constructor() {
    this.tasks = {
      'sync-status': { interval: 10, handler: this.syncStatus },
      'sync-traffic': { interval: 5, handler: this.syncTraffic },
      'health-check': { interval: 30, handler: this.healthCheck }
    };
  }
  
  // 启动所有任务
  start() {
    for (const [name, task] of Object.entries(this.tasks)) {
      chrome.alarms.create(name, {
        periodInMinutes: task.interval / 60
      });
    }
  }
  
  // 停止所有任务
  stop() {
    chrome.alarms.clearAll();
  }
  
  // 处理定时任务
  async handle(alarm) {
    const task = this.tasks[alarm.name];
    if (task) {
      try {
        await task.handler();
      } catch (error) {
        console.error(`Task ${alarm.name} failed:`, error);
      }
    }
  }
  
  // 同步状态
  async syncStatus() {
    const proxies = await api.getProxies();
    state.setState({ proxies: proxies.proxies });
  }
  
  // 同步流量
  async syncTraffic() {
    const traffic = await api.getTraffic();
    state.setState({ traffic });
  }
  
  // 健康检查
  async healthCheck() {
    try {
      const status = await api.getStatus();
      state.setState({
        connected: true,
        connectError: null,
        lastConnectTime: Date.now()
      });
    } catch (error) {
      state.setState({
        connected: false,
        connectError: error.message
      });
    }
  }
}
```

### 2.7 消息处理设计

```javascript
// modules/message.js

class MessageHandler {
  constructor() {
    this.handlers = {
      'GET_STATE': this.getState,
      'SELECT_PROXY': this.selectProxy,
      'TOGGLE_PROXY': this.toggleProxy,
      'TEST_PROXIES': this.testProxies,
      'UPDATE_SUBSCRIPTION': this.updateSubscription
    };
  }
  
  // 处理消息
  async handle(message, sender, sendResponse) {
    const handler = this.handlers[message.type];
    if (handler) {
      try {
        const result = await handler(message.data);
        sendResponse({ success: true, data: result });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
    } else {
      sendResponse({ success: false, error: 'Unknown message type' });
    }
    return true; // 保持消息通道开启
  }
  
  // 获取状态
  async getState() {
    return state.getState();
  }
  
  // 选择代理
  async selectProxy(data) {
    const { group, proxy } = data;
    await api.selectProxy(group, proxy);
    state.setState({ currentProxy: proxy });
    return { success: true };
  }
  
  // 切换代理开关
  async toggleProxy(data) {
    const { enabled } = data;
    if (enabled) {
      await proxy.enable();
    } else {
      await proxy.disable();
    }
    state.setState({ proxyEnabled: enabled });
    return { enabled };
  }
  
  // 测速
  async testProxies(data) {
    const { proxies } = data;
    state.setState({ testing: true });
    try {
      const result = await api.testProxies(proxies);
      state.setState({
        testing: false,
        lastTestTime: Date.now()
      });
      return result;
    } catch (error) {
      state.setState({ testing: false });
      throw error;
    }
  }
  
  // 更新订阅
  async updateSubscription(data) {
    const { id } = data;
    return api.updateSubscription(id);
  }
}
```

## 3. Popup UI 设计

### 3.1 页面结构

```html
<!-- popup.html -->
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Proxy Manager</title>
  <link rel="stylesheet" href="styles/popup.css">
</head>
<body>
  <div id="app">
    <!-- 头部 -->
    <header class="header">
      <div class="status">
        <span class="status-indicator" id="statusIndicator"></span>
        <span class="status-text" id="statusText">未连接</span>
      </div>
      <div class="actions">
        <button id="toggleProxy" class="btn-toggle">启用代理</button>
        <button id="testAll" class="btn-test">测速</button>
      </div>
    </header>
    
    <!-- 代理组选择 -->
    <section class="group-selector">
      <label>代理组:</label>
      <select id="groupSelect">
        <option value="GLOBAL">GLOBAL</option>
      </select>
    </section>
    
    <!-- 节点列表 -->
    <section class="proxy-list">
      <div id="proxyList"></div>
    </section>
    
    <!-- 流量统计 -->
    <footer class="footer">
      <div class="traffic">
        <span>↑ <span id="upload">0 B</span></span>
        <span>↓ <span id="download">0 B</span></span>
      </div>
      <button id="settings" class="btn-settings">设置</button>
    </footer>
  </div>
  
  <script type="module" src="popup.js"></script>
</body>
</html>
```

### 3.2 UI 组件设计

```javascript
// popup.js

import { UIComponents } from './components/ui.js';
import { formatBytes, formatDelay } from './utils/format.js';

class PopupApp {
  constructor() {
    this.state = null;
    this.components = new UIComponents();
    this.init();
  }
  
  async init() {
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
  }
  
  async loadState() {
    const response = await chrome.runtime.sendMessage({
      type: 'GET_STATE'
    });
    if (response.success) {
      this.state = response.data;
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
      text.textContent = '未连接';
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
    
    const groups = Object.keys(this.state.proxies || {})
      .filter(name => this.state.proxies[name].type === 'Selector');
    
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
    
    const group = this.state.proxies[this.state.currentGroup];
    if (!group) return;
    
    group.all.forEach(proxyName => {
      const proxy = this.state.proxies[proxyName];
      if (!proxy) return;
      
      const item = this.components.createProxyItem(
        proxy,
        proxy.name === group.now,
        () => this.selectProxy(proxyName)
      );
      container.appendChild(item);
    });
  }
  
  renderTraffic() {
    const upload = document.getElementById('upload');
    const download = document.getElementById('download');
    
    upload.textContent = formatBytes(this.state.traffic.upload);
    download.textContent = formatBytes(this.state.traffic.download);
  }
  
  async toggleProxy() {
    const enabled = !this.state.proxyEnabled;
    await chrome.runtime.sendMessage({
      type: 'TOGGLE_PROXY',
      data: { enabled }
    });
  }
  
  async selectProxy(proxy) {
    await chrome.runtime.sendMessage({
      type: 'SELECT_PROXY',
      data: {
        group: this.state.currentGroup,
        proxy
      }
    });
  }
  
  async selectGroup(group) {
    this.state.currentGroup = group;
    this.render();
  }
  
  async testAll() {
    const testBtn = document.getElementById('testAll');
    testBtn.disabled = true;
    testBtn.textContent = '测速中...';
    
    try {
      await chrome.runtime.sendMessage({
        type: 'TEST_PROXIES',
        data: { proxies: null }
      });
    } finally {
      testBtn.disabled = false;
      testBtn.textContent = '测速';
    }
  }
}

// 初始化
new PopupApp();
```

### 3.3 UI 组件库

```javascript
// components/ui.js

export class UIComponents {
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
    type.textContent = proxy.type;
    
    info.appendChild(name);
    info.appendChild(type);
    
    const delay = document.createElement('div');
    delay.className = 'proxy-delay';
    if (proxy.delay > 0) {
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
}
```

## 4. 状态管理方式

### 4.1 状态流转

```
Service Worker (主状态)
    ↓ (持久化)
Chrome Storage
    ↓ (读取)
Popup UI (本地状态)
    ↓ (用户操作)
Service Worker (更新状态)
```

### 4.2 状态同步策略

1. **Service Worker → Storage**
   - 状态变化时立即持久化
   - 使用 chrome.storage.local

2. **Service Worker → Popup**
   - 通过 chrome.runtime.sendMessage 广播
   - Popup 监听 STATE_UPDATE 消息

3. **Popup → Service Worker**
   - 通过 chrome.runtime.sendMessage 发送操作
   - Service Worker 处理后更新状态

## 5. 错误处理设计

### 5.1 API 错误处理

```javascript
class ErrorHandler {
  static handle(error, context) {
    console.error(`[${context}]`, error);
    
    // 分类处理
    if (error.name === 'AbortError') {
      return { type: 'timeout', message: '请求超时' };
    }
    
    if (error.message.includes('Failed to fetch')) {
      return { type: 'network', message: 'Agent 未启动或无法连接' };
    }
    
    return { type: 'unknown', message: error.message };
  }
  
  static notify(error) {
    // 显示通知
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: '代理管理器',
      message: error.message
    });
  }
}
```

### 5.2 UI 错误显示

```javascript
class ErrorDisplay {
  static show(container, error) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = error.message;
    container.appendChild(errorDiv);
    
    setTimeout(() => {
      errorDiv.remove();
    }, 3000);
  }
}
```

## 6. 性能优化

### 6.1 减少 API 调用

- 使用本地缓存
- 合并多个请求
- 避免重复请求

### 6.2 UI 渲染优化

- 虚拟滚动（节点列表很长时）
- 防抖和节流
- 增量更新

### 6.3 内存管理

- 及时清理事件监听器
- 避免内存泄漏
- 限制缓存大小

## 7. 安全考虑

### 7.1 CSP 配置

```json
{
  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self'"
  }
}
```

### 7.2 数据验证

- 验证 API 响应格式
- 过滤恶意内容
- 防止 XSS 攻击

## 8. 调试支持

### 8.1 日志系统

```javascript
class Logger {
  static debug(message, data) {
    if (DEBUG_MODE) {
      console.log(`[DEBUG] ${message}`, data);
    }
  }
  
  static error(message, error) {
    console.error(`[ERROR] ${message}`, error);
  }
}
```

### 8.2 开发者工具

- Service Worker 调试
- Storage 查看
- 网络请求监控
