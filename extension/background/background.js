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
let reconnectTimer = null;

async function initialize() {
  if (initialized) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    state = new StateManager();
    api = new MihomoAPI();
    proxy = new ProxyController();
    messageHandler = new MessageHandler(state, api, proxy);

    await state.restore();
    initialized = true;
  })();

  return initPromise;
}

// 自动重连：断连后每 30 秒尝试一次
function startReconnect() {
  stopReconnect();
  reconnectTimer = setInterval(async () => {
    if (!initialized || !state) return;
    if (state.getState().connected) {
      stopReconnect();
      return;
    }
    try {
      await messageHandler.handle(
        { type: 'CONNECT' }, null,
        () => {}
      );
      if (state.getState().connected) {
        stopReconnect();
      }
    } catch {}
  }, 30000);
}

function stopReconnect() {
  if (reconnectTimer) {
    clearInterval(reconnectTimer);
    reconnectTimer = null;
  }
}

// 安装
chrome.runtime.onInstalled.addListener(async (details) => {
  const { config } = await chrome.storage.local.get('config');
  if (!config) {
    await chrome.storage.local.set({
      config: { mihomoAPI: 'http://127.0.0.1:9097', secret: '' }
    });
  }
  await initialize();

  // 已有配置（含 secret），自动尝试连接
  const saved = config || (await chrome.storage.local.get('config')).config;
  if (saved && saved.secret) {
    try {
      await messageHandler.handle(
        { type: 'CONNECT' }, null,
        () => {}
      );
    } catch {}
    if (!state.getState().connected) startReconnect();
  }
});

// 浏览器启动
chrome.runtime.onStartup.addListener(async () => {
  await initialize();
  // 启动时也尝试自动连接
  const { config } = await chrome.storage.local.get('config');
  if (config && config.secret) {
    try {
      await messageHandler.handle(
        { type: 'CONNECT' }, null,
        () => {}
      );
    } catch {}
    if (!state.getState().connected) startReconnect();
  }
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
  stopReconnect();
  if (state) await state.persist();
});
