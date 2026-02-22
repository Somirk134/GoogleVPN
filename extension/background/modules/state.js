// 状态管理模块

export class StateManager {
  constructor() {
    this.state = this.getDefaultState();
  }
  
  // 获取默认状态
  getDefaultState() {
    return {
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
    
    // 持久化
    this.persist();
    
    // 广播状态变化
    this.broadcast();
  }
  
  // 持久化到 storage
  async persist() {
    try {
      await chrome.storage.local.set({ 
        state: this.state,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('Failed to persist state:', error);
    }
  }
  
  // 从 storage 恢复
  async restore() {
    try {
      const result = await chrome.storage.local.get(['state', 'timestamp']);
      
      if (result.state) {
        this.state = result.state;
        console.log('State restored from', new Date(result.timestamp));
      } else {
        console.log('No saved state found, using defaults');
        this.state = this.getDefaultState();
      }
    } catch (error) {
      console.error('Failed to restore state:', error);
      this.state = this.getDefaultState();
    }
  }
  
  // 广播状态变化
  broadcast() {
    try {
      chrome.runtime.sendMessage({
        type: 'STATE_UPDATE',
        state: this.state
      }).catch(() => {
        // Popup 可能未打开，忽略错误
      });
    } catch (error) {
      // 忽略广播错误
    }
  }
}
