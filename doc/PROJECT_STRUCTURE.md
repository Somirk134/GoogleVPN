# 项目目录结构设计

## 1. 完整目录树

```
proxy-manager/
├── README.md
├── LICENSE
├── .gitignore
├── Makefile
│
├── agent/                          # Go 后端服务
│   ├── cmd/
│   │   └── agent/
│   │       └── main.go            # 程序入口
│   │
│   ├── internal/                  # 内部包（不对外暴露）
│   │   ├── api/                   # API 层
│   │   │   ├── handler/           # 请求处理器
│   │   │   │   ├── status.go
│   │   │   │   ├── proxy.go
│   │   │   │   ├── subscription.go
│   │   │   │   ├── config.go
│   │   │   │   ├── traffic.go
│   │   │   │   └── connection.go
│   │   │   ├── middleware/        # 中间件
│   │   │   │   ├── cors.go
│   │   │   │   ├── logger.go
│   │   │   │   ├── recovery.go
│   │   │   │   └── auth.go
│   │   │   ├── router.go          # 路由配置
│   │   │   └── server.go          # HTTP 服务器
│   │   │
│   │   ├── core/                  # Core 管理
│   │   │   ├── manager.go         # 进程管理器
│   │   │   ├── client.go          # Core API 客户端
│   │   │   ├── health.go          # 健康检查
│   │   │   └── config.go          # Core 配置
│   │   │
│   │   ├── proxy/                 # 代理控制
│   │   │   ├── controller.go     # 代理控制器
│   │   │   ├── group.go           # 代理组管理
│   │   │   ├── node.go            # 节点管理
│   │   │   └── speedtest.go       # 测速模块
│   │   │
│   │   ├── subscription/          # 订阅管理
│   │   │   ├── manager.go         # 订阅管理器
│   │   │   ├── parser.go          # 订阅解析
│   │   │   ├── updater.go         # 订阅更新
│   │   │   └── scheduler.go       # 更新调度
│   │   │
│   │   ├── config/                # 配置管理
│   │   │   ├── config.go          # 配置结构
│   │   │   ├── loader.go          # 配置加载
│   │   │   └── validator.go       # 配置验证
│   │   │
│   │   ├── storage/               # 数据存储
│   │   │   ├── storage.go         # 存储接口
│   │   │   ├── file.go            # 文件存储
│   │   │   └── cache.go           # 缓存管理
│   │   │
│   │   └── logger/                # 日志模块
│   │       ├── logger.go          # 日志接口
│   │       └── zap.go             # Zap 实现
│   │
│   ├── pkg/                       # 公共包（可对外暴露）
│   │   ├── models/                # 数据模型
│   │   │   ├── proxy.go
│   │   │   ├── subscription.go
│   │   │   ├── config.go
│   │   │   ├── traffic.go
│   │   │   └── response.go
│   │   ├── errors/                # 错误定义
│   │   │   └── errors.go
│   │   └── utils/                 # 工具函数
│   │       ├── http.go
│   │       ├── file.go
│   │       └── time.go
│   │
│   ├── configs/                   # 配置文件模板
│   │   ├── agent.yaml.example
│   │   └── core.yaml.example
│   │
│   ├── scripts/                   # 脚本文件
│   │   ├── build.sh
│   │   ├── install.sh
│   │   └── uninstall.sh
│   │
│   ├── test/                      # 测试文件
│   │   ├── api/
│   │   ├── core/
│   │   └── integration/
│   │
│   ├── go.mod
│   ├── go.sum
│   └── .air.toml                  # 热重载配置
│
├── extension/                     # Chrome 扩展
│   ├── manifest.json              # 扩展配置
│   │
│   ├── background/                # Service Worker
│   │   ├── background.js          # 主文件
│   │   └── modules/               # 模块
│   │       ├── state.js           # 状态管理
│   │       ├── api.js             # API 客户端
│   │       ├── proxy.js           # 代理控制
│   │       ├── scheduler.js       # 定时任务
│   │       └── message.js         # 消息处理
│   │
│   ├── popup/                     # Popup UI
│   │   ├── popup.html
│   │   ├── popup.js
│   │   ├── components/            # UI 组件
│   │   │   ├── ui.js
│   │   │   ├── proxy-list.js
│   │   │   └── traffic.js
│   │   └── styles/                # 样式文件
│   │       ├── popup.css
│   │       └── components.css
│   │
│   ├── options/                   # 设置页面
│   │   ├── options.html
│   │   ├── options.js
│   │   └── styles/
│   │       └── options.css
│   │
│   ├── utils/                     # 工具函数
│   │   ├── format.js              # 格式化
│   │   ├── storage.js             # 存储操作
│   │   └── error.js               # 错误处理
│   │
│   ├── icons/                     # 图标资源
│   │   ├── icon16.png
│   │   ├── icon32.png
│   │   ├── icon48.png
│   │   └── icon128.png
│   │
│   └── _locales/                  # 国际化（可选）
│       ├── en/
│       │   └── messages.json
│       └── zh_CN/
│           └── messages.json
│
├── docs/                          # 文档
│   ├── ARCHITECTURE.md            # 架构设计
│   ├── API_SPECIFICATION.md       # API 规范
│   ├── DATA_MODELS.md             # 数据模型
│   ├── CHROME_EXTENSION_DESIGN.md # 扩展设计
│   ├── DEVELOPMENT_GUIDE.md       # 开发指南
│   └── DEPLOYMENT.md              # 部署文档
│
├── build/                         # 构建输出
│   ├── agent/
│   │   └── proxy-agent.exe
│   └── extension/
│       └── proxy-manager.zip
│
└── data/                          # 运行时数据（不提交到 Git）
    ├── config.yaml                # Agent 配置
    ├── subscriptions.json         # 订阅列表
    ├── core/
    │   ├── clash.exe              # Core 可执行文件
    │   └── config.yaml            # Core 配置
    ├── cache/
    │   ├── delays.json            # 延迟缓存
    │   └── traffic.json           # 流量统计
    └── logs/
        ├── agent.log              # Agent 日志
        └── core.log               # Core 日志
```

## 2. Go Backend 目录详解

### 2.1 cmd/ - 应用程序入口

```
cmd/agent/main.go
- 程序启动入口
- 初始化配置
- 启动各个模块
- 信号处理
- 优雅关闭
```

**职责**:
- 最小化逻辑
- 只负责组装和启动
- 不包含业务逻辑

### 2.2 internal/ - 内部实现

#### 2.2.1 api/ - API 层

```
handler/     - 处理 HTTP 请求，调用业务逻辑
middleware/  - HTTP 中间件（CORS、日志、认证等）
router.go    - 路由配置
server.go    - HTTP 服务器封装
```

**设计原则**:
- Handler 只负责请求解析和响应格式化
- 业务逻辑在其他模块实现
- 统一的错误处理和响应格式

#### 2.2.2 core/ - Core 管理

```
manager.go   - 进程生命周期管理
client.go    - Core API 客户端封装
health.go    - 健康检查逻辑
config.go    - Core 配置生成
```

**核心功能**:
- 启动、监控、重启 Core 进程
- 与 Core API 通信
- 健康检查和故障恢复

#### 2.2.3 proxy/ - 代理控制

```
controller.go - 代理控制器（协调各模块）
group.go      - 代理组管理
node.go       - 节点管理
speedtest.go  - 测速实现
```

**核心功能**:
- 节点和代理组管理
- 节点切换
- 并发测速

#### 2.2.4 subscription/ - 订阅管理

```
manager.go    - 订阅 CRUD 操作
parser.go     - 订阅内容解析
updater.go    - 订阅更新逻辑
scheduler.go  - 定时更新调度
```

**核心功能**:
- 订阅源管理
- 订阅内容下载和解析
- 定时自动更新

#### 2.2.5 config/ - 配置管理

```
config.go     - 配置结构定义
loader.go     - 配置加载和保存
validator.go  - 配置验证
```

**核心功能**:
- 配置文件加载
- 配置验证
- 配置热更新

#### 2.2.6 storage/ - 数据存储

```
storage.go    - 存储接口定义
file.go       - 文件存储实现
cache.go      - 内存缓存实现
```

**核心功能**:
- 数据持久化
- 缓存管理
- 数据读写抽象

#### 2.2.7 logger/ - 日志模块

```
logger.go     - 日志接口定义
zap.go        - Zap 日志实现
```

**核心功能**:
- 结构化日志
- 日志级别控制
- 日志轮转

### 2.3 pkg/ - 公共包

```
models/       - 数据模型定义
errors/       - 错误类型定义
utils/        - 工具函数
```

**设计原则**:
- 可被外部引用
- 无状态、纯函数
- 通用性强

### 2.4 configs/ - 配置模板

```
agent.yaml.example    - Agent 配置示例
core.yaml.example     - Core 配置示例
```

**用途**:
- 提供配置示例
- 文档说明
- 首次运行时复制

### 2.5 scripts/ - 脚本文件

```
build.sh      - 构建脚本
install.sh    - 安装脚本
uninstall.sh  - 卸载脚本
```

**用途**:
- 自动化构建
- 系统安装
- 服务注册

### 2.6 test/ - 测试文件

```
api/          - API 测试
core/         - Core 管理测试
integration/  - 集成测试
```

**测试策略**:
- 单元测试覆盖核心逻辑
- 集成测试验证模块协作
- API 测试验证接口正确性

## 3. Chrome Extension 目录详解

### 3.1 background/ - Service Worker

```
background.js - 主入口文件
modules/      - 功能模块
  state.js    - 状态管理
  api.js      - API 客户端
  proxy.js    - 代理控制
  scheduler.js - 定时任务
  message.js  - 消息处理
```

**设计原则**:
- 模块化设计
- 单一职责
- 清晰的依赖关系

### 3.2 popup/ - Popup UI

```
popup.html    - 页面结构
popup.js      - 主逻辑
components/   - UI 组件
styles/       - 样式文件
```

**设计原则**:
- 组件化 UI
- 响应式设计
- 性能优化

### 3.3 options/ - 设置页面

```
options.html  - 设置页面
options.js    - 设置逻辑
styles/       - 样式文件
```

**功能**:
- Agent 地址配置
- 订阅管理
- 高级设置

### 3.4 utils/ - 工具函数

```
format.js     - 格式化函数
storage.js    - 存储操作
error.js      - 错误处理
```

**设计原则**:
- 纯函数
- 可复用
- 易测试

### 3.5 icons/ - 图标资源

```
icon16.png    - 工具栏图标
icon32.png    - 扩展管理图标
icon48.png    - 扩展详情图标
icon128.png   - Chrome 商店图标
```

**规范**:
- PNG 格式
- 透明背景
- 符合 Chrome 设计规范

## 4. 配置文件存放位置

### 4.1 开发环境

```
项目根目录/data/
├── config.yaml           # Agent 配置
├── subscriptions.json    # 订阅列表
└── core/
    └── config.yaml       # Core 配置
```

### 4.2 生产环境（Windows）

```
C:/ProgramData/ProxyManager/
├── config.yaml
├── subscriptions.json
├── core/
│   ├── clash.exe
│   └── config.yaml
├── cache/
│   ├── delays.json
│   └── traffic.json
└── logs/
    ├── agent.log
    └── core.log
```

### 4.3 用户配置（可选）

```
%USERPROFILE%/.proxy-manager/
├── config.yaml           # 用户自定义配置
└── subscriptions.json    # 用户订阅
```

## 5. 日志目录设计

### 5.1 日志文件结构

```
logs/
├── agent.log             # 当前日志
├── agent.log.2026-02-22  # 按日期归档
├── agent.log.2026-02-21
├── core.log              # Core 日志
└── core.log.2026-02-22
```

### 5.2 日志轮转策略

- 按天轮转
- 单文件最大 100MB
- 保留最近 7 天
- 压缩旧日志（可选）

### 5.3 日志级别

```
DEBUG - 详细调试信息
INFO  - 一般信息
WARN  - 警告信息
ERROR - 错误信息
FATAL - 致命错误
```

## 6. 构建输出目录

### 6.1 构建产物

```
build/
├── agent/
│   ├── proxy-agent.exe       # Windows 可执行文件
│   ├── config.yaml.example   # 配置示例
│   └── README.txt            # 说明文档
└── extension/
    └── proxy-manager.zip     # 扩展打包文件
```

### 6.2 发布包结构

```
proxy-manager-v1.0.0-windows-amd64/
├── proxy-agent.exe
├── clash.exe
├── config.yaml.example
├── install.bat
├── uninstall.bat
└── README.txt
```

## 7. 数据目录权限

### 7.1 Windows 权限设置

```
C:/ProgramData/ProxyManager/
- 读写权限：SYSTEM, Administrators
- 只读权限：Users

logs/
- 读写权限：SYSTEM, Administrators, Users
```

### 7.2 文件权限

```
config.yaml        - 644 (rw-r--r--)
subscriptions.json - 644 (rw-r--r--)
*.log              - 644 (rw-r--r--)
proxy-agent.exe    - 755 (rwxr-xr-x)
```

## 8. .gitignore 配置

```gitignore
# 构建产物
build/
dist/
*.exe
*.zip

# 运行时数据
data/
logs/
*.log

# 缓存
cache/
*.cache

# 依赖
node_modules/
vendor/

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# 配置文件（保留示例）
config.yaml
subscriptions.json
!*.example

# 测试覆盖率
coverage/
*.out
```

## 9. 目录命名规范

### 9.1 Go 项目规范

- 使用小写字母
- 多个单词用下划线分隔（不推荐）或直接连接
- 包名简短且有意义
- 避免使用复数形式

### 9.2 JavaScript 项目规范

- 使用小写字母
- 多个单词用连字符分隔
- 文件名与内容对应
- 组件文件使用 PascalCase（可选）

## 10. 模块依赖关系

```
main.go
  ├─> config (配置加载)
  ├─> logger (日志初始化)
  ├─> storage (存储初始化)
  ├─> core.Manager (Core 管理)
  ├─> subscription.Manager (订阅管理)
  ├─> proxy.Controller (代理控制)
  └─> api.Server (API 服务)
      ├─> handler (请求处理)
      └─> middleware (中间件)
```

**依赖原则**:
- 高层模块不依赖低层模块
- 都依赖于抽象（接口）
- 避免循环依赖
- 清晰的分层结构
