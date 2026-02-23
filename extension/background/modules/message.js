// 消息处理模块

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
      'TEST_NODE_DELAY': (d) => this.testNodeDelay(d),
      'GET_TRAFFIC': () => this.getTraffic(),
    };
  }

  async handle(message, _sender, sendResponse) {
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
    const { config } = await chrome.storage.local.get('config');

    // 还没配置 secret，跳过连接，不报错
    if (!config || !config.secret) {
      console.log('CONNECT: skipped — no secret configured yet');
      this.state.setState({ connected: false, connectError: null });
      return { needConfig: true };
    }

    console.log('CONNECT: config =', JSON.stringify(config));
    this.api.updateConfig(
      config.mihomoAPI || 'http://127.0.0.1:9097',
      config.secret
    );

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

  // 刷新延迟 — 对当前组触发真实测速，再同步最新数据
  async testGroupDelay(data) {
    this.state.setState({ testing: true });
    try {
      const group = (data && data.group) || this.state.getState().currentGroup;
      if (group) {
        // 调用 mihomo 接口触发组内所有节点的真实延迟测试
        try {
          await this.api.testGroupDelay(group);
        } catch {
          // 部分节点超时会导致整体返回错误，忽略后继续读取结果
        }
      }
      // 测速完成后重新拉取最新数据（包含刚测的延迟）
      await this.syncProxies();
      const proxies = this.state.getState().proxies || {};
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

  // 单节点测速
  async testNodeDelay(data) {
    const { name } = data;
    try {
      const result = await this.api.testDelay(name);
      const delay = result.delay || 0;
      // 更新 state 中该节点的延迟
      const proxies = this.state.getState().proxies;
      if (proxies[name]) {
        proxies[name].delay = delay;
        this.state.setState({ proxies });
      }
      return { name, delay };
    } catch {
      // 超时或失败
      const proxies = this.state.getState().proxies;
      if (proxies[name]) {
        proxies[name].delay = 0;
        this.state.setState({ proxies });
      }
      return { name, delay: 0 };
    }
  }

  async getTraffic() {
    const data = await this.api.getTraffic();
    // connections 数组里每个都是活跃连接（mihomo /connections 只返回 alive 的）
    // uploadTotal / downloadTotal 是累计流量
    const conns = data.connections || [];
    const traffic = {
      upload: data.uploadTotal || 0,
      download: data.downloadTotal || 0,
      connections: conns.length,
      // 实时速率：汇总所有活跃连接的 speed
      uploadSpeed: conns.reduce((s, c) => s + (c.upload || 0), 0),
      downloadSpeed: conns.reduce((s, c) => s + (c.download || 0), 0),
    };
    this.state.setState({ traffic });
    return traffic;
  }
}
