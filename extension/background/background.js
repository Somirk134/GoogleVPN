// Proxy Manager - Service Worker

import { StateManager } from './modules/state.js';
import { MihomoAPI } from './modules/api.js';
import { ProxyController } from './modules/proxy.js';
import { MessageHandler } from './modules/message.js';

let state = null;
let api = null;
let proxy = null;
let messageHandler = null;
let initialized = false;
let initPromise = null;

async function initialize() {
  if (initialized) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    console.log('Proxy Manager: Initializing...');

    state = new StateManager();
    api = new MihomoAPI(); // config 在 CONNECT 时从 storage 读取
    proxy = new ProxyController();
    messageHandler = new MessageHandler(state, api, proxy);

    await state.restore();
    initialized = true;
    console.log('Proxy Manager: Initialized');
  })();

  return initPromise;
}

// 安装
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('Proxy Manager: Installed/updated', details.reason);
  // 仅在完全没有 config 时写入默认值，避免覆盖用户已保存的配置
  const { config } = await chrome.storage.local.get('config');
  if (!config) {
    await chrome.storage.local.set({
      config: { mihomoAPI: 'http://127.0.0.1:9097', secret: '' }
    });
  }
  await initialize();

  // 如果已有配置（含 secret），自动尝试连接
  if (config && config.secret) {
    try {
      await messageHandler.handle(
        { type: 'CONNECT' }, null,
        (resp) => console.log('Auto-connect result:', resp?.success ? 'OK' : resp?.error)
      );
    } catch {}
  }
});

// 浏览器启动
chrome.runtime.onStartup.addListener(async () => {
  console.log('Proxy Manager: Browser started');
  await initialize();
});

// 消息处理
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  initialize().then(() => {
    messageHandler.handle(message, sender, sendResponse);
  }).catch(error => {
    sendResponse({ success: false, error: 'Init failed: ' + error.message });
  });
  return true;
});

// 挂起前保存状态
chrome.runtime.onSuspend.addListener(async () => {
  if (state) await state.persist();
});

console.log('Proxy Manager: Service Worker loaded');
