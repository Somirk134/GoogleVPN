<p align="center">
  <img src="extension/icons/icon128.png" alt="Proxy Manager" width="96" height="96" />
</p>

<h1 align="center">Proxy Manager</h1>

<p align="center">
  <strong>轻量级 Chrome 代理管理扩展</strong><br/>
  直连本地 Clash Verge / Mihomo RESTful API，实现浏览器级别的代理控制、节点切换与状态监控
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Manifest-V3-blue?style=flat-square" alt="Manifest V3" />
  <img src="https://img.shields.io/badge/Version-2.0.0-green?style=flat-square" alt="Version" />
  <img src="https://img.shields.io/badge/License-MIT-yellow?style=flat-square" alt="License" />
  <img src="https://img.shields.io/badge/Dependencies-Zero-brightgreen?style=flat-square" alt="Zero Dependencies" />
</p>

<p align="center">
  <sub>本扩展不替代 Clash Verge，而是作为浏览器端的补充控制面板。<br/>订阅管理、规则配置、内核更新等仍由 Clash Verge 负责。</sub>
</p>

---

## ✨ 功能特性

| 功能 | 说明 |
|:---:|:---|
| 🔌 代理开关 | 一键启用/停用浏览器代理，基于 Chrome Proxy API，仅影响浏览器流量 |
| 🔀 节点切换 | 读取 Clash 代理组，支持 Selector / URLTest / Fallback，子组可点击跳转 |
| ⚡ 延迟显示 | 读取 mihomo 缓存的 history 延迟数据，与 Clash Verge 显示一致 |
| 🌍 IP 检测 | 多 API 轮询检测出口 IP，显示国家、地区、ISP、时区、ASN 等详细信息 |
| 📊 实时流量 | Popup 内嵌迷你流量图，设置页提供完整的实时速率图表与连接统计 |
| 🎨 亮暗主题 | 设置页支持亮色/暗色主题切换，状态持久化 |
| 🧭 新手引导 | 内置 4 步向导，引导用户完成首次配置 |
| 🔍 端口扫描 | 自动扫描常见端口，快速发现本地 mihomo 实例 |

---

## 📋 环境要求

- Chrome 或基于 Chromium 的浏览器（Edge、Arc、Brave 等）
- 本地运行 [Clash Verge Rev](https://github.com/clash-verge-rev/clash-verge-rev) 或其他 mihomo 内核客户端
- mihomo 外部控制（External Controller）已启用

---

## 🚀 安装

```
1. 克隆仓库
   git clone https://github.com/your-username/proxy-manager.git

2. 打开浏览器扩展管理页
   Chrome  → chrome://extensions/
   Edge    → edge://extensions/

3. 开启「开发者模式」

4. 点击「加载已解压的扩展程序」，选择项目中的 extension/ 目录
```

---

## ⚙️ 配置

1. 首次安装后会自动打开设置页，也可以点击 Popup 左下角「参数设置」进入
2. 填写 mihomo API 地址（默认 `http://127.0.0.1:9097`），或点击「扫描」自动检测
3. 如果设置了 Secret 密钥，填入对应字段
4. 点击「测试连接」确认连通后保存

> 💡 如果不清楚如何获取这些信息，设置页内置了「新手引导」，按步骤操作即可。

---

## 🏗️ 架构

```
┌─────────────┐     chrome.runtime.sendMessage     ┌──────────────────┐
│   Popup UI  │ ◄──────────────────────────────────► │  Service Worker  │
│  (popup.js) │                                      │ (background.js)  │
└──────┬──────┘                                      └────────┬─────────┘
       │                                                      │
       │  SSE /traffic (迷你图)                               │  REST API
       │  fetch IP APIs (直接)                                │
       ▼                                                      ▼
┌──────────────┐                                    ┌──────────────────┐
│  IP API 服务  │                                    │  mihomo (本地)    │
│  (多个备选)   │                                    │  127.0.0.1:9097  │
└──────────────┘                                    └──────────────────┘
```

- **Popup** 通过 Service Worker 中转与 mihomo 通信（节点切换、代理控制等）
- **流量数据** 通过 SSE 直连 mihomo `/traffic` 端点
- **IP 检测** 从 Popup 直接发起请求，经过 Chrome Proxy API，反映真实出口 IP

---

## 📁 项目结构

```
extension/
├── background/              # Service Worker
│   ├── background.js        # 入口，生命周期管理
│   └── modules/
│       ├── api.js           # Mihomo REST API 客户端
│       ├── message.js       # 消息路由与业务逻辑
│       ├── proxy.js         # Chrome Proxy API 控制
│       └── state.js         # 状态管理与持久化
├── popup/                   # 弹窗界面
│   ├── popup.html
│   ├── popup.js             # 节点列表、IP 检测、迷你流量图
│   └── styles/popup.css
├── options/                 # 设置页面
│   ├── options.html
│   ├── options.js           # 连接配置、向导、流量统计图表
│   └── styles/options.css
├── icons/                   # 扩展图标 (16/32/48/128)
└── manifest.json            # Manifest V3 配置
```

---

## 🛠️ 技术栈

| 类别 | 技术 |
|:---|:---|
| 扩展规范 | Chrome Extension Manifest V3 |
| 后端通信 | mihomo RESTful API + SSE（流量流） |
| 代理控制 | Chrome Proxy API（`chrome.proxy.settings`） |
| 数据存储 | Chrome Storage API（`chrome.storage.local`） |
| 图表渲染 | Canvas 2D — 零第三方依赖 |
| IP 检测 | ip-api.com / ipwho.is / ipapi.co / ipify.org |

---

## 🔐 权限说明

| 权限 | 用途 |
|:---|:---|
| `proxy` | 控制浏览器代理设置 |
| `storage` | 存储用户配置和运行状态 |
| `host_permissions` | 访问本地 mihomo API 和 IP 检测服务 |

> 🔒 本扩展不收集任何用户数据，所有通信仅发生在本地（mihomo）和 IP 检测 API 之间。

---

## 💻 开发

项目为纯前端 Chrome 扩展，无需构建工具，无第三方依赖。

```bash
# 克隆项目
git clone https://github.com/your-username/proxy-manager.git

# 在浏览器中加载 extension/ 目录即可开发
# 修改代码后在 chrome://extensions/ 点击刷新按钮
```

---

## ⚠️ 已知限制

- 仅控制浏览器代理，不影响系统级代理设置
- 延迟数据读取 mihomo 缓存，不主动触发测速（避免对节点造成额外负担）
- IP 检测依赖第三方 API，可能受到请求频率限制
- 需要 mihomo 外部控制处于开启状态

---

<p align="center">
  <sub>Made with ❤️ for a better browsing experience</sub><br/>
  <a href="LICENSE">MIT License</a>
</p>
