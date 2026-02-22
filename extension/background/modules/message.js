// 消息处理模块

export class MessageHandler {
  constructor(state, api, proxy, scheduler) {
    this.state = state;
    this.api = api;
    this.proxy = proxy;
    this.scheduler = scheduler;
    
    this.handlers = {
      'GET_STATE': this.getState.bind(this),
      'SELECT_PROXY': this.selectProxy.bind(this),
      'TOGGLE_PROXY': this.toggleProxy.bind(this),
      'TEST_PROXIES': this.testProxies.bind(this),
      'UPDATE_SUBSCRIPTION': this.updateSubscription.bind(this),
      'CONNECT_AGENT': this.connectAgent.bind(this)
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
        console.error(`Message handler error (${message.type}):`, error);
        sendResponse({ success: false, error: error.message });
      }
    } else {
      sendResponse({ success: false, error: 'Unknown message type' });
    }
  }
  
  // 获取状态
  async getState() {
    return this.state.getState();
  }
  
  // 选择代理
  async selectProxy(data) {
    const { group, proxy } = data;
    
    console.log(`Selecting proxy: ${group} -> ${proxy}`);
    
    // 调用 Agent API
    await this.api.selectProxy(group, proxy);
    
    // 更新状态
    this.state.setState({ 
      currentGroup: group,
      currentProxy: proxy 
    });
    
    return { success: true };
  }
  
  // 切换代理开关
  async toggleProxy(data) {
    const { enabled } = data;
    
    console.log(`Toggling proxy: ${enabled}`);
    
    if (enabled) {
      await this.proxy.enable();
    } else {
      await this.proxy.disable();
    }
    
    this.state.setState({ proxyEnabled: enabled });
    
    return { enabled };
  }
  
  // 测速
  async testProxies(data) {
    const { proxies } = data;
    
    console.log('Starting speed test');
    
    this.state.setState({ testing: true });
    
    try {
      const result = await this.api.testProxies(proxies);
      
      this.state.setState({
        testing: false,
        lastTestTime: Date.now()
      });
      
      // 更新节点延迟
      const currentProxies = this.state.getState().proxies;
      if (result.results) {
        result.results.forEach(r => {
          if (currentProxies[r.proxy]) {
            currentProxies[r.proxy].delay = r.delay;
          }
        });
        this.state.setState({ proxies: currentProxies });
      }
      
      return result;
    } catch (error) {
      this.state.setState({ testing: false });
      throw error;
    }
  }
  
  // 更新订阅
  async updateSubscription(data) {
    const { id } = data;
    
    console.log(`Updating subscription: ${id}`);
    
    return await this.api.updateSubscription(id);
  }
  
  // 连接 Agent
  async connectAgent() {
    console.log('Connecting to agent...');
    
    try {
      const status = await this.api.getStatus();
      
      this.state.setState({
        connected: true,
        connectError: null,
        lastConnectTime: Date.now()
      });
      
      // 同步代理列表
      const proxies = await this.api.getProxies();
      this.state.setState({
        proxies: proxies.proxies || {}
      });
      
      return { success: true };
    } catch (error) {
      this.state.setState({
        connected: false,
        connectError: error.message
      });
      throw error;
    }
  }
}
