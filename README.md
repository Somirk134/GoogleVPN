# Proxy Manager

Chrome 浏览器代理控制扩展，直连本地 Clash Verge / Mihomo。

## 功能

- 控制浏览器是否使用代理（开/关）
- 查看和切换代理节点
- 一键测速，显示节点延迟
- 节点信息、延迟数据全部从 Clash/Mihomo 实时获取

## 使用前提

本地已安装并运行 [Clash Verge](https://github.com/clash-verge-rev/clash-verge-rev) 或其他 mihomo 内核客户端。

订阅管理、规则配置等由 Clash Verge 负责，本扩展只做浏览器代理控制。

## 安装

1. 打开 Chrome，进入 `chrome://extensions/`
2. 开启「开发者模式」
3. 点击「加载已解压的扩展程序」，选择 `extension/` 目录

## 配置

1. 点击扩展图标 → 左下角「参数设置」
2. 填写 Mihomo API 地址（默认 `http://127.0.0.1:9090`）
3. 如有 Secret，填入对应字段
4. 点击「测试连接」验证
5. 保存设置

## 项目结构

```
extension/
├── background/          # Service Worker
│   ├── background.js    # 入口
│   └── modules/
│       ├── api.js       # Mihomo API 客户端
│       ├── message.js   # 消息处理
│       ├── proxy.js     # 浏览器代理控制
│       └── state.js     # 状态管理
├── popup/               # 弹窗 UI
├── options/             # 设置页面
├── icons/               # 图标
├── utils/               # 工具函数
└── manifest.json
```
