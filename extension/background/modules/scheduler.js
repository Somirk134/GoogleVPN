// 定时任务调度模块

export class TaskScheduler {
  constructor(state, api, proxy) {
    this.state = state;
    this.api = api;
    this.proxy = proxy;
    
    this.tasks = {
      'sync-status': { interval: 10, handler: this.syncStatus.bind(this) },
      'sync-traffic': { interval: 5, handler: this.syncTraffic.bind(this) },
      'health-check': { interval: 30, handler: this.healthCheck.bind(this) }
    };
  }
  
  // 启动所有任务
  start() {
    console.log('Starting scheduler tasks');
    
    for (const [name, task] of Object.entries(this.tasks)) {
      chrome.alarms.create(name, {
        periodInMinutes: task.interval / 60
      });
      console.log(`Task scheduled: ${name} (every ${task.interval}s)`);
    }
  }
  
  // 停止所有任务
  stop() {
    console.log('Stopping scheduler tasks');
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
    try {
      const proxies = await this.api.getProxies();
      this.state.setState({ 
        proxies: proxies.proxies || {}
      });
    } catch (error) {
      console.error('Failed to sync status:', error);
    }
  }
  
  // 同步流量
  async syncTraffic() {
    try {
      const traffic = await this.api.getTraffic();
      this.state.setState({ traffic });
    } catch (error) {
      // 流量统计失败不影响主要功能，只记录日志
      console.debug('Failed to sync traffic:', error);
    }
  }
  
  // 健康检查
  async healthCheck() {
    try {
      const status = await this.api.getStatus();
      
      this.state.setState({
        connected: true,
        connectError: null,
        lastConnectTime: Date.now()
      });
    } catch (error) {
      console.error('Health check failed:', error);
      
      this.state.setState({
        connected: false,
        connectError: error.message
      });
    }
  }
}
