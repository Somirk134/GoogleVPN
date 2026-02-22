# Proxy Manager - 开发指南

## 🚀 快速开始

### 前置要求

- Go 1.22 或更高版本
- Chrome 浏览器
- Windows 操作系统

### 1. 安装 Go 依赖

```bash
# 下载依赖
go mod download

# 整理依赖
go mod tidy
```

### 2. 配置 Agent

首次运行会自动创建 `config.yaml`，或者手动复制：

```bash
copy configs\agent.yaml.example config.yaml
```

### 3. 运行 Agent

```bash
# 方式 1: 使用 Makefile
make run

# 方式 2: 直接运行
go run ./cmd/agent

# 方式 3: 构建后运行
make build
.\build\proxy-agent.exe
```

### 4. 加载 Chrome Extension

1. 打开 Chrome 浏览器
2. 访问 `chrome://extensions/`
3. 开启右上角的"开发者模式"
4. 点击"加载已解压的扩展程序"
5. 选择项目中的 `extension` 文件夹
6. 扩展加载成功！

### 5. 准备图标（重要！）

Extension 需要图标文件才能正常加载。请：

1. 进入 `extension/icons/` 目录
2. 准备以下尺寸的 PNG 图标：
   - icon16.png (16x16)
   - icon32.png (32x32)
   - icon48.png (48x48)
   - icon128.png (128x128)

临时方案：可以使用任意图片，用图片编辑工具调整到对应尺寸。

## 📁 项目结构

```
proxy-manager/
├── cmd/agent/          # Agent 主程序
├── internal/           # 内部包
│   ├── config/        # 配置管理
│   └── logger/        # 日志管理
├── core/              # Clash Core
│   ├── verge-mihomo.exe
│   └── config/config.yaml
├── extension/         # Chrome Extension
│   ├── manifest.json
│   ├── background/    # Service Worker
│   ├── popup/         # Popup UI
│   ├── options/       # 设置页面
│   └── utils/         # 工具函数
└── docs/              # 设计文档
```

## 🔧 开发流程

### 当前进度：阶段 0 完成 ✅

- [x] 项目结构搭建
- [x] Go 基础框架
- [x] Chrome Extension 基础框架
- [x] 配置文件
- [x] 日志系统

### 下一步：阶段 1 - Core 进程管理

需要实现：
1. Core 进程启动
2. Core 进程监控
3. Core 健康检查
4. Core 优雅关闭

## 🧪 测试

### 测试 Agent

```bash
# 运行 Agent
go run ./cmd/agent

# 应该看到类似输出：
# 2026-02-22T10:00:00.000+0800    INFO    Starting Proxy Manager Agent    {"version": "1.0.0"}
# 2026-02-22T10:00:00.001+0800    INFO    Application started successfully
```

### 测试 Extension

1. 加载扩展后，点击扩展图标
2. 应该看到 Popup 界面
3. 打开浏览器控制台（F12）
4. 切换到 Service Worker 查看日志
5. 应该看到：
   ```
   Proxy Manager: Service Worker loaded
   Proxy Manager: Initializing...
   ```

## 📝 开发注意事项

### Agent 开发

1. 所有新功能在 `internal/` 目录下创建对应包
2. 使用 `logger` 包记录日志
3. 使用 `config` 包读取配置
4. 错误处理要完善

### Extension 开发

1. Service Worker 是后台服务，不能使用 DOM API
2. Popup 每次打开都会重新加载
3. 使用 `chrome.storage.local` 持久化数据
4. 使用 `chrome.runtime.sendMessage` 与 Service Worker 通信

### 调试技巧

**Agent 调试：**
- 查看日志文件：`logs/agent.log`
- 使用 `log.Info()` 输出调试信息

**Extension 调试：**
- Service Worker: `chrome://extensions/` → 点击"Service Worker"
- Popup: 右键扩展图标 → 检查弹出内容
- Options: 右键设置页面 → 检查

## 🐛 常见问题

### 1. Agent 无法启动

**问题**: `Failed to load config`

**解决**: 确保 `config.yaml` 存在，或让程序自动创建

### 2. Extension 无法加载

**问题**: `Could not load icon`

**解决**: 在 `extension/icons/` 目录下添加图标文件

### 3. Extension 无法连接 Agent

**问题**: `Failed to connect to agent`

**解决**: 
1. 确保 Agent 正在运行
2. 检查 Agent 监听地址是否为 `127.0.0.1:8765`
3. 检查防火墙设置

### 4. Core 无法启动

**问题**: `Failed to start core process`

**解决**:
1. 确保 `core/verge-mihomo.exe` 存在
2. 确保 `core/config/config.yaml` 存在
3. 检查端口 7890 和 9090 是否被占用

## 📚 相关文档

- [系统架构设计](doc/ARCHITECTURE.md)
- [API 规范](doc/API_SPECIFICATION.md)
- [Chrome Extension 设计](doc/CHROME_EXTENSION_DESIGN.md)
- [MVP 开发规划](doc/MVP_DEVELOPMENT_PLAN.md)

## 🎯 下一步计划

按照 MVP 开发规划，接下来需要实现：

1. **阶段 1**: Core 进程管理（2-3天）
   - 实现 `internal/core/manager.go`
   - 实现进程启动、监控、重启
   - 实现健康检查

2. **阶段 2**: 基础 API 服务（2-3天）
   - 实现 `internal/api/` 包
   - 实现基础接口
   - 实现中间件

3. **阶段 3**: 完善 Extension（2-3天）
   - 完善 UI 交互
   - 实现节点切换
   - 实现状态同步

## 💡 提示

- 开发时建议使用 `make run` 运行 Agent，方便查看日志
- Extension 修改后需要在 `chrome://extensions/` 点击刷新按钮
- 遇到问题先查看日志文件和浏览器控制台

---

**当前版本**: v1.0.0  
**最后更新**: 2026-02-22
