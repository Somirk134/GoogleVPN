# 🎯 从这里开始

欢迎！这是你的本地代理管理系统项目。

## ⚡ 3 分钟快速开始

### 1️⃣ 准备图标（必需！）

Extension 需要图标才能加载。最简单的方法：

1. 找 4 张任意图片
2. 用画图工具调整大小：16x16, 32x32, 48x48, 128x128
3. 保存为 PNG 格式
4. 重命名为 icon16.png, icon32.png, icon48.png, icon128.png
5. 放到 `extension/icons/` 目录

**或者**使用在线工具：https://www.favicon-generator.org/

### 2️⃣ 配置 Go 代理

```cmd
go env -w GOPROXY=https://goproxy.cn,direct
go mod download
```

### 3️⃣ 启动 Agent

```cmd
go run ./cmd/agent
```

### 4️⃣ 加载 Extension

1. 打开 Chrome
2. 访问 `chrome://extensions/`
3. 开启"开发者模式"
4. 点击"加载已解压的扩展程序"
5. 选择 `extension` 文件夹

### 5️⃣ 测试

点击浏览器工具栏的扩展图标，应该能看到界面！

---

## 📚 重要文档

### 新手必读

1. **[QUICK_START.md](QUICK_START.md)** ⭐ 详细的启动步骤
2. **[PROJECT_STATUS.md](PROJECT_STATUS.md)** ⭐ 当前项目状态
3. **[README_DEV.md](README_DEV.md)** ⭐ 开发指南

### 设计文档（在 doc/ 目录）

- **[doc/README.md](doc/README.md)** - 文档总览
- **[doc/ARCHITECTURE.md](doc/ARCHITECTURE.md)** - 系统架构
- **[doc/API_SPECIFICATION.md](doc/API_SPECIFICATION.md)** - API 规范
- **[doc/CHROME_EXTENSION_DESIGN.md](doc/CHROME_EXTENSION_DESIGN.md)** - Extension 设计
- **[doc/MVP_DEVELOPMENT_PLAN.md](doc/MVP_DEVELOPMENT_PLAN.md)** - 开发计划

---

## 🎯 当前状态

✅ **阶段 0 完成** - 项目搭建
- 所有设计文档已完成
- Go 基础框架已搭建
- Chrome Extension 基础框架已搭建
- 可以运行和测试

❌ **待实现** - 核心功能
- Core 进程管理
- API 服务
- 代理控制
- 测速功能
- 订阅管理

---

## 🚀 下一步做什么？

### 选项 A: 快速体验（推荐新手）

1. 按照上面的 3 分钟快速开始
2. 看到 Extension 界面
3. 了解项目结构
4. 阅读设计文档

### 选项 B: 开始开发（推荐开发者）

按照 MVP 计划，下一步是**阶段 1: Core 进程管理**

需要实现：
1. `internal/core/manager.go` - 进程管理器
2. `internal/core/client.go` - Core API 客户端  
3. `internal/core/health.go` - 健康检查

详细说明：[doc/MVP_DEVELOPMENT_PLAN.md](doc/MVP_DEVELOPMENT_PLAN.md)

---

## 📁 项目结构

```
proxy-manager/
├── cmd/agent/              # Agent 主程序 ✅
├── internal/               # 内部包 ✅
│   ├── config/            # 配置管理 ✅
│   └── logger/            # 日志系统 ✅
├── core/                   # Clash Core ✅
│   ├── verge-mihomo.exe   # 内核程序 ✅
│   └── config/            # Core 配置 ✅
├── extension/              # Chrome Extension ✅
│   ├── manifest.json      # 扩展配置 ✅
│   ├── background/        # Service Worker ✅
│   ├── popup/             # Popup UI ✅
│   ├── options/           # 设置页面 ✅
│   ├── utils/             # 工具函数 ✅
│   └── icons/             # 图标 ⚠️ 需要准备
└── doc/                    # 设计文档 ✅
```

---

## ❓ 常见问题

### Q: go mod download 失败？
**A**: 配置 Go 代理：
```cmd
go env -w GOPROXY=https://goproxy.cn,direct
```

### Q: Extension 无法加载？
**A**: 检查 `extension/icons/` 目录是否有图标文件

### Q: Popup 显示"未连接"？
**A**: 确保 Agent 正在运行（`go run ./cmd/agent`）

### Q: 从哪里开始开发？
**A**: 阅读 [doc/MVP_DEVELOPMENT_PLAN.md](doc/MVP_DEVELOPMENT_PLAN.md)，从阶段 1 开始

---

## 💡 提示

- 🎨 **图标很重要** - Extension 没有图标无法加载
- 🌐 **配置代理** - 国内下载 Go 依赖需要代理
- 📖 **先读文档** - 所有设计细节都在文档中
- 🐛 **查看日志** - 遇到问题先看 `logs/agent.log` 和浏览器控制台

---

## 🎉 准备好了吗？

1. ✅ 准备图标
2. ✅ 配置 Go 代理
3. ✅ 启动 Agent
4. ✅ 加载 Extension
5. ✅ 开始开发！

**祝你开发顺利！** 🚀

---

**记住：浏览器插件是最终目标！** 所有后端功能都是为了让插件能正常工作。
