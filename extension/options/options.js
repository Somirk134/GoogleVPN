// 设置页面逻辑

class OptionsApp {
  constructor() {
    this.init();
  }
  
  async init() {
    console.log('Options: Initializing...');
    
    // 加载配置
    await this.loadConfig();
    
    // 加载订阅列表
    await this.loadSubscriptions();
    
    // 绑定事件
    this.bindEvents();
    
    // 检查是否是欢迎页面
    const params = new URLSearchParams(window.location.search);
    if (params.get('welcome') === 'true') {
      this.showWelcome();
    }
    
    console.log('Options: Initialized');
  }
  
  async loadConfig() {
    const { config } = await chrome.storage.local.get('config');
    
    if (config) {
      document.getElementById('agentURL').value = config.agentURL || 'http://127.0.0.1:8765';
      document.getElementById('autoConnect').checked = config.autoConnect !== false;
    }
  }
  
  async loadSubscriptions() {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_STATE'
      });
      
      if (response.success && response.data.connected) {
        // 从 Agent 获取订阅列表
        await this.fetchSubscriptions();
      } else {
        document.getElementById('subscriptionList').innerHTML = 
          '<p class="empty-hint">请先连接到 Agent 服务</p>';
      }
    } catch (error) {
      console.error('Failed to load subscriptions:', error);
    }
  }
  
  async fetchSubscriptions() {
    // TODO: 实现从 Agent 获取订阅列表
    document.getElementById('subscriptionList').innerHTML = 
      '<p class="empty-hint">暂无订阅</p>';
  }
  
  bindEvents() {
    // 测试连接
    document.getElementById('testConnection').addEventListener('click', () => {
      this.testConnection();
    });
    
    // 添加订阅
    document.getElementById('addSubscription').addEventListener('click', () => {
      this.addSubscription();
    });
    
    // 保存设置
    document.getElementById('saveSettings').addEventListener('click', () => {
      this.saveSettings();
    });
  }
  
  async testConnection() {
    const btn = document.getElementById('testConnection');
    const status = document.getElementById('connectionStatus');
    
    btn.disabled = true;
    btn.textContent = '测试中...';
    status.textContent = '';
    
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'CONNECT_AGENT'
      });
      
      if (response.success) {
        status.textContent = '✓ 连接成功';
        status.style.color = '#4caf50';
      } else {
        status.textContent = '✗ 连接失败: ' + response.error;
        status.style.color = '#f44336';
      }
    } catch (error) {
      status.textContent = '✗ 连接失败: ' + error.message;
      status.style.color = '#f44336';
    } finally {
      btn.disabled = false;
      btn.textContent = '测试连接';
    }
  }
  
  async addSubscription() {
    const name = document.getElementById('subName').value.trim();
    const url = document.getElementById('subURL').value.trim();
    
    if (!name || !url) {
      alert('请填写订阅名称和地址');
      return;
    }
    
    if (!url.startsWith('https://') && !url.startsWith('http://')) {
      alert('订阅地址必须以 http:// 或 https:// 开头');
      return;
    }
    
    // TODO: 实现添加订阅
    alert('添加订阅功能将在后续版本实现');
  }
  
  async saveSettings() {
    const config = {
      agentURL: document.getElementById('agentURL').value.trim(),
      autoConnect: document.getElementById('autoConnect').checked,
      testInterval: 300
    };
    
    await chrome.storage.local.set({ config });
    
    alert('设置已保存');
  }
  
  showWelcome() {
    alert('欢迎使用 Proxy Manager!\n\n请确保已启动 Agent 服务，然后点击"测试连接"按钮。');
  }
}

// 初始化
new OptionsApp();
