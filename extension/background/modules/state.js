// 状态管理模块（精简版）

export class StateManager {
  constructor() {
    this.state = this.getDefaultState();
  }

  getDefaultState() {
    return {
      connected: false,
      connectError: null,
      proxyEnabled: false,
      currentGroup: 'GLOBAL',
      currentProxy: null,
      proxies: {},       // mihomo 原始代理数据
      traffic: { upload: 0, download: 0, connections: 0 },
      testing: false,
      mihomoVersion: null,
    };
  }

  getState() {
    return { ...this.state };
  }

  setState(updates) {
    this.state = { ...this.state, ...updates };
    this.broadcast();
  }

  // 持久化（只存配置相关，不存运行时状态）
  async persist() {
    try {
      await chrome.storage.local.set({
        runtimeState: {
          proxyEnabled: this.state.proxyEnabled,
          currentGroup: this.state.currentGroup,
        }
      });
    } catch (e) {
      console.error('Failed to persist state:', e);
    }
  }

  async restore() {
    try {
      const { runtimeState } = await chrome.storage.local.get('runtimeState');
      if (runtimeState) {
        this.state.proxyEnabled = runtimeState.proxyEnabled || false;
        this.state.currentGroup = runtimeState.currentGroup || 'GLOBAL';
      }
    } catch (e) {
      console.error('Failed to restore state:', e);
    }
  }

  broadcast() {
    try {
      chrome.runtime.sendMessage({
        type: 'STATE_UPDATE',
        state: this.state
      }).catch(() => {});
    } catch (e) { /* popup may not be open */ }
  }
}
