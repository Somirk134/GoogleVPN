// Proxy Manager - Service Worker
// 这是扩展的后台服务，负责代理控制和与 Agent 通信

import { StateManager } from './modules/state.js';
import { AgentAPI } from './modules/api.js';
import { ProxyController } from './modules/proxy.js';
import { TaskScheduler } from './modules/scheduler.js';
import { MessageHandler } from './modules/message.js';

// 全局实例
let state = null;
let api = null;
let proxy = null;
let scheduler = null;
let messageHandler = null;

// 初始化
async function initialize() {
  console.log('Proxy Manager: Initializing...');
  
  // 创建实例
  state = new StateManager();
  api = new AgentAPI('http://127.0.0.1:8765');
  proxy = new ProxyController();
  scheduler = new TaskScheduler(state, api, proxy);
  messageHandler = new MessageHandler(state, api, proxy, scheduler);
  
  // 恢复状态
  await state.restore();
  
  console.log('Proxy Manager: Initialized');
}

// 扩展安装
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('Proxy Manager: Extension installed/updated', details.reason);
  
  if (details.reason === 'install') {
    // 首次安装
    await handleInstall();
  } else if (details.reason === 'update') {
    // 更新
    await handleUpdate(details.previousVersion);
  }
  
  await initialize();
});

// 浏览器启动
chrome.runtime.onStartup.addListener(async () => {
  console.log('Proxy Manager: Browser started');
  await initialize();
  await handleStartup();
});

// 首次安装处理
async function handleInstall() {
  console.log('Proxy Manager: First time installation');
  
  // 初始化默认配置
  await chrome.storage.local.set({
    config: {
      agentURL: 'http://127.0.0.1:8765',
      autoConnect: true,
      testInterval: 300,
    },
    state: {
      connected: false,
      proxyEnabled: false,
      currentGroup: 'GLOBAL',
      currentProxy: null,
      proxies: {},
      traffic: {
        upload: 0,
        download: 0,
        uploadSpeed: 0,
        downloadSpeed: 0
      }
    }
  });
  
  // 打开欢迎页面
  chrome.tabs.create({
    url: 'options/options.html?welcome=true'
  });
}

// 更新处理
async function handleUpdate(previousVersion) {
  console.log('Proxy Manager: Updated from', previousVersion);
  // 可以在这里处理版本迁移
}

// 启动处理
async function handleStartup() {
  console.log('Proxy Manager: Starting up...');
  
  // 获取配置
  const { config } = await chrome.storage.local.get('config');
  
  if (config && config.autoConnect) {
    // 自动连接 Agent
    try {
      await connectToAgent();
    } catch (error) {
      console.error('Proxy Manager: Failed to connect to agent:', error);
      state.setState({
        connected: false,
        connectError: error.message
      });
    }
  }
  
  // 启动定时任务
  scheduler.start();
  
  console.log('Proxy Manager: Startup complete');
}

// 连接到 Agent
async function connectToAgent() {
  console.log('Proxy Manager: Connecting to agent...');
  
  try {
    // 检查 Agent 状态
    const status = await api.getStatus();
    console.log('Proxy Manager: Agent status:', status);
    
    // 更新状态
    state.setState({
      connected: true,
      connectError: null,
      lastConnectTime: Date.now()
    });
    
    // 同步代理列表
    const proxies = await api.getProxies();
    state.setState({
      proxies: proxies.proxies || {}
    });
    
    console.log('Proxy Manager: Connected to agent successfully');
  } catch (error) {
    console.error('Proxy Manager: Connection failed:', error);
    throw error;
  }
}

// 消息处理
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  messageHandler.handle(message, sender, sendResponse);
  return true; // 保持消息通道开启
});

// 定时任务处理
chrome.alarms.onAlarm.addListener(async (alarm) => {
  await scheduler.handle(alarm);
});

// 扩展挂起前
chrome.runtime.onSuspend.addListener(async () => {
  console.log('Proxy Manager: Extension suspending');
  
  // 停止定时任务
  scheduler.stop();
  
  // 保存状态
  await state.persist();
  
  console.log('Proxy Manager: Cleanup complete');
});

console.log('Proxy Manager: Service Worker loaded');
