// 代理控制模块

export class ProxyController {
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
            console.error('Failed to enable proxy:', chrome.runtime.lastError);
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
            console.error('Failed to disable proxy:', chrome.runtime.lastError);
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
    try {
      const settings = await this.getSettings();
      return settings.value.mode === 'fixed_servers';
    } catch (error) {
      console.error('Failed to check proxy status:', error);
      return false;
    }
  }
}
