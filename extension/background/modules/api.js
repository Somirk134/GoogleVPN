// Agent API 客户端模块

export class AgentAPI {
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
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        
        if (result.code !== 0) {
          throw new Error(result.message || 'Unknown error');
        }
        
        return result.data;
      } catch (error) {
        console.error(`Request failed (attempt ${i + 1}/${this.maxRetries}):`, error);
        
        if (i === this.maxRetries - 1) {
          throw error;
        }
        
        // 指数退避
        await this.delay(Math.pow(2, i) * 1000);
      }
    }
  }
  
  // 延迟函数
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  // API 方法
  
  // 获取系统状态
  async getStatus() {
    return this.request('GET', '/api/v1/status');
  }
  
  // 获取所有代理
  async getProxies() {
    return this.request('GET', '/api/v1/proxies');
  }
  
  // 获取指定代理组
  async getGroup(group) {
    return this.request('GET', `/api/v1/proxies/${group}`);
  }
  
  // 切换代理节点
  async selectProxy(group, proxy) {
    return this.request('PUT', `/api/v1/proxies/${group}`, { name: proxy });
  }
  
  // 批量测速
  async testProxies(proxies = null) {
    return this.request('POST', '/api/v1/proxies/test', { proxies });
  }
  
  // 获取节点延迟
  async getDelay(proxy) {
    return this.request('GET', `/api/v1/proxies/${proxy}/delay`);
  }
  
  // 获取订阅列表
  async getSubscriptions() {
    return this.request('GET', '/api/v1/subscriptions');
  }
  
  // 添加订阅
  async addSubscription(subscription) {
    return this.request('POST', '/api/v1/subscriptions', subscription);
  }
  
  // 更新订阅
  async updateSubscription(id) {
    return this.request('POST', `/api/v1/subscriptions/${id}/update`);
  }
  
  // 删除订阅
  async deleteSubscription(id) {
    return this.request('DELETE', `/api/v1/subscriptions/${id}`);
  }
  
  // 获取流量统计
  async getTraffic() {
    return this.request('GET', '/api/v1/traffic');
  }
  
  // 获取配置
  async getConfig() {
    return this.request('GET', '/api/v1/config');
  }
  
  // 更新配置
  async updateConfig(config) {
    return this.request('PATCH', '/api/v1/config', config);
  }
}
