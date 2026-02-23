// Mihomo REST API 客户端

export class MihomoAPI {
  constructor(baseURL = 'http://127.0.0.1:9097', secret = '') {
    this.baseURL = baseURL.replace(/\/+$/, '');
    this.secret = secret;
  }

  updateConfig(baseURL, secret) {
    this.baseURL = baseURL.replace(/\/+$/, '');
    this.secret = secret || '';
  }

  async request(method, path, data = null, timeout = 10000) {
    const headers = { 'Content-Type': 'application/json' };
    if (this.secret) {
      headers['Authorization'] = `Bearer ${this.secret}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const opts = { method, headers, signal: controller.signal };
      if (data) opts.body = JSON.stringify(data);

      const resp = await fetch(`${this.baseURL}${path}`, opts);
      clearTimeout(timeoutId);

      if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        throw new Error(`HTTP ${resp.status}: ${text}`);
      }

      // 204 No Content
      if (resp.status === 204) return null;

      return await resp.json();
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    }
  }

  // === 状态 ===

  // 获取 mihomo 版本信息（用于连接测试）
  async getVersion() {
    return this.request('GET', '/version');
  }

  // 获取运行配置
  async getConfigs() {
    return this.request('GET', '/configs');
  }

  // === 代理 ===

  // 获取所有代理和代理组
  async getProxies() {
    return this.request('GET', '/proxies');
  }

  // 获取指定代理组详情
  async getGroup(name) {
    return this.request('GET', `/proxies/${encodeURIComponent(name)}`);
  }

  // 切换代理组的当前节点
  async selectProxy(group, proxy) {
    return this.request('PUT', `/proxies/${encodeURIComponent(group)}`, { name: proxy });
  }

  // 测试单个节点延迟
  async testDelay(proxy, url = 'http://www.gstatic.com/generate_204', timeout = 5000) {
    return this.request('GET',
      `/proxies/${encodeURIComponent(proxy)}/delay?url=${encodeURIComponent(url)}&timeout=${timeout}`,
      null, timeout + 3000);
  }

  // 批量测试代理组延迟（mihomo 内部并发）
  async testGroupDelay(group, url = 'http://www.gstatic.com/generate_204', timeout = 5000) {
    return this.request('GET',
      `/group/${encodeURIComponent(group)}/delay?url=${encodeURIComponent(url)}&timeout=${timeout}`,
      null, timeout + 5000);
  }

  // === 流量 ===

  // 获取实时流量（单次快照，非 WebSocket）
  async getTraffic() {
    // mihomo 的 /traffic 是 SSE 流，我们用 /connections 获取总量
    return this.request('GET', '/connections');
  }
}
