// 消息处理模块 — 直连 mihomo 版

export class MessageHandler {
  constructor(state, api, proxy) {
    this.state = state;
    this.api = api;
    this.proxy = proxy;

    this.handlers = {
      'GET_STATE': () => this.getState(),
      'CONNECT': () => this.connect(),
      'TOGGLE_PROXY': (d) => this.toggleProxy(d),
      'SELECT_PROXY': (d) => this.selectProxy(d),
      'TEST_GROUP_DELAY': (d) => this.testGroupDelay(d),
      'SYNC_PROXIES': () => this.getProxies(),
      'GET_PROXIES': () => this.getProxies(),
      'GET_TRAFFIC': () => this.getTraffic(),
    };
  }

  async handle(message, sender, sendResponse) {
    const handler = this.handlers[message.type];
    if (!handler) {
      sendResponse({ success: false, error: 'Unknown message type' });
      return;
    }
    try {
      const result = await handler(message.data);
      sendResponse({ success: true, data: result });
    } catch (error) {
      console.error(`Message handler error (${message.type}):`, error);
      sendResponse({ success: false, error: error.message });
    }
  }

  async getState() {
    return this.state.getState();
  }

  // 连接 mihomo 并拉取代理列表
  async connect() {
    // 读取用户配置
    const { config } = await chrome.storage.local.get('config');
    if (config) {
      this.api.updateConfig(
        config.mihomoAPI || 'http://127.0.0.1:9097',
        config.secret || ''
      );
    }

    // 测试连接
    const version = await this.api.getVersion();
    this.state.setState({ mihomoVersion: version.version, connected: true, connectError: null });

    // 拉取代理数据
    await this.syncProxies();

    return { version: version.version };
  }

  // 同步代理列表 — 从 mihomo 拉取最新数据，延迟优先读 history 缓存
  async syncProxies() {
    const data = await this.api.getProxies();
    const proxies = data.proxies || {};

    // 从 history 提取缓存延迟（和 Clash Verge 显示一致）
    for (const proxy of Object.values(proxies)) {
      if (proxy.history && proxy.history.length > 0) {
        const last = proxy.history[proxy.history.length - 1];
        proxy.delay = last.delay > 0 ? last.delay : 0;
      }
    }

    this.state.setState({ proxies, connected: true });
  }

  async toggleProxy(data) {
    const { enabled } = data;
    if (enabled) {
      // 读取代理端口
      const configs = await this.api.getConfigs();
      const port = configs['mixed-port'] || configs['port'] || 7890;
      await this.proxy.enable('127.0.0.1', port);
    } else {
      await this.proxy.disable();
    }
    this.state.setState({ proxyEnabled: enabled });
    this.state.persist();
    return { enabled };
  }

  async selectProxy(data) {
    const { group, proxy } = data;
    await this.api.selectProxy(group, proxy);
    // 刷新代理数据
    await this.syncProxies();
    this.state.setState({ currentGroup: group, currentProxy: proxy });
    this.state.persist();
    return { group, proxy };
  }

  // 刷新延迟 — 只读取 Clash Verge 已缓存的 history 数据，不触发新测速
  async testGroupDelay() {
    this.state.setState({ testing: true });
    try {
      await this.syncProxies();
      const proxies = this.state.getState().proxies || {};
      // 收集所有有延迟的节点
      const delays = {};
      for (const [name, p] of Object.entries(proxies)) {
        if (p.delay && p.delay > 0) delays[name] = p.delay;
      }
      this.state.setState({ testing: false });
      return delays;
    } catch (error) {
      this.state.setState({ testing: false });
      throw error;
    }
  }

  async getProxies() {
    await this.syncProxies();
    return this.state.getState().proxies;
  }

  async getTraffic() {
    const data = await this.api.getTraffic();
    const traffic = {
      upload: data.uploadTotal || 0,
      download: data.downloadTotal || 0,
      connections: (data.connections || []).length,
    };
    this.state.setState({ traffic });
    return traffic;
  }
}
