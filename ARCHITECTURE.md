# 本地代理管理系统 - 系统架构设计文档

## 1. 系统总体架构设计

### 1.1 模块划分

系统由三个核心模块组成：

#### 1.1.1 Agent 服务（Go Backend）
- **进程管理模块（Process Manager）**
  - 负责启动、监控、重启代理内核进程
  - 管理进程生命周期
  - 处理进程崩溃恢复
  - 监控进程健康状态

- **配置管理模块（Config Manager）**
  - 加载和解析配置文件
  - 管理订阅源
  - 配置文件热更新
  - 配置验证和校验

- **API 服务模块（API Server）**
  - 提供 RESTful API 接口
  - 请求路由和处理
  - 请求验证和鉴权
  - 响应格式化

- **代理控制模块（Proxy Controller）**
  - 节点管理
  - 代理模式切换
  - 规则管理
  - 与 Core 通信

- **测速模块（Speed Test Module）**
  - 并发测速调度
  - 延迟测试
  - 结果缓存
  - 超时控制

- **订阅管理模块（Subscription Manager）**
  - 订阅源管理
  - 订阅更新
  - 节点解析
  - 更新调度

- **日志模块（Logger）**
  - 结构化日志
  - 日志轮转
  - 日志级别控制
  - 错误追踪

#### 1.1.2 代理内核（Proxy Core）
- 使用 Clash Core 或类似内核
- 提供 SOCKS5/HTTP 代理服务（127.0.0.1:7890）
- 提供 External Controller API（127.0.0.1:9090）
- 处理实际流量转发

#### 1.1.3 Chrome Extension（UI 层）
- **Service Worker**
  - 管理浏览器代理设置
  - 与 Agent API 通信
  - 状态同步
  - 后台任务调度

- **Popup UI**
  - 节点列表展示
  - 节点切换操作
  - 测速触发
  - 延迟显示
  - 模式切换

- **API Client**
  - HTTP 请求封装
  - 错误处理
  - 重试机制
  - 超时控制

### 1.2 进程模型

```
┌─────────────────────────────────────────────────────┐
│                   Windows 系统                       │
│                                                      │
│  ┌────────────────────────────────────────────┐    │
│  │         Chrome Browser Process              │    │
│  │                                              │    │
│  │  ┌──────────────────────────────────────┐  │    │
│  │  │    Chrome Extension                   │  │    │
│  │  │  ┌────────────┐  ┌─────────────────┐ │  │    │
│  │  │  │  Service   │  │   Popup UI      │ │  │    │
│  │  │  │  Worker    │  │                 │ │  │    │
│  │  │  └─────┬──────┘  └─────────────────┘ │  │    │
│  │  │        │                               │  │    │
│  │  │        │ chrome.proxy API              │  │    │
│  │  │        │                               │  │    │
│  │  └────────┼───────────────────────────────┘  │    │
│  │           │                                   │    │
│  └───────────┼───────────────────────────────────┘    │
│              │                                         │
│              │ HTTP Request (127.0.0.1:8765)          │
│              ▼                                         │
│  ┌───────────────────────────────────────────────┐   │
│  │      Agent Service (Go Backend)                │   │
│  │      - 常驻后台进程                             │   │
│  │      - 无界面服务                               │   │
│  │      - 监听 127.0.0.1:8765                     │   │
│  │                                                 │   │
│  │  ┌─────────────────────────────────────────┐  │   │
│  │  │  API Server (Gin/Fiber)                 │  │   │
│  │  └─────────────────────────────────────────┘  │   │
│  │  ┌─────────────────────────────────────────┐  │   │
│  │  │  Process Manager                        │  │   │
│  │  │  - 启动/监控/重启 Core                   │  │   │
│  │  └─────────────────────────────────────────┘  │   │
│  │  ┌─────────────────────────────────────────┐  │   │
│  │  │  Proxy Controller                       │  │   │
│  │  └─────────────────────────────────────────┘  │   │
│  │  ┌─────────────────────────────────────────┐  │   │
│  │  │  Speed Test Module                      │  │   │
│  │  └─────────────────────────────────────────┘  │   │
│  │              │                                  │   │
│  │              │ 进程管理 / API 调用               │   │
│  │              ▼                                  │   │
│  │  ┌─────────────────────────────────────────┐  │   │
│  │  │    Proxy Core Process (clash)           │  │   │
│  │  │    - 子进程                              │  │   │
│  │  │    - SOCKS5: 127.0.0.1:7890            │  │   │
│  │  │    - HTTP: 127.0.0.1:7890              │  │   │
│  │  │    - Controller: 127.0.0.1:9090        │  │   │
│  │  └─────────────────────────────────────────┘  │   │
│  └───────────────────────────────────────────────┘   │
│                      │                                │
│                      │ 代理流量                       │
│                      ▼                                │
└──────────────────────────────────────────────────────┘
                       │
                       ▼
                   Internet
```

### 1.3 通信关系

#### 1.3.1 Extension ↔ Agent
- **协议**: HTTP/1.1
- **地址**: 127.0.0.1:8765
- **格式**: JSON
- **认证**: Token（可选，后期扩展）
- **通信方式**: 
  - Extension 主动请求
  - 轮询获取状态更新
  - 未来可扩展 WebSocket

#### 1.3.2 Agent ↔ Core
- **协议**: HTTP/1.1
- **地址**: 127.0.0.1:9090
- **格式**: JSON
- **通信方式**:
  - Agent 调用 Core 的 External Controller API
  - 进程管理通过 os/exec 包
  - 标准输入输出重定向

#### 1.3.3 Chrome ↔ Proxy
- **协议**: SOCKS5 / HTTP Proxy
- **地址**: 127.0.0.1:7890
- **流量**: 浏览器所有网络请求
- **控制**: chrome.proxy API

### 1.4 数据流说明

#### 1.4.1 节点切换流程
```
1. 用户在 Popup 点击节点
   ↓
2. Service Worker 接收事件
   ↓
3. 发送 POST /api/v1/proxies/{group}/select 到 Agent
   ↓
4. Agent 验证请求
   ↓
5. Agent 调用 Core API 切换节点
   ↓
6. Core 更新内部路由
   ↓
7. Agent 返回成功响应
   ↓
8. Extension 更新 UI 状态
```

#### 1.4.2 测速流程
```
1. 用户点击测速按钮
   ↓
2. Extension 发送 POST /api/v1/proxies/test 到 Agent
   ↓
3. Agent 创建测速任务
   ↓
4. 并发对所有节点发起测速（goroutine pool）
   ↓
5. 每个节点通过 Core 代理访问测速 URL
   ↓
6. 收集延迟结果
   ↓
7. 返回完整结果给 Extension
   ↓
8. Extension 更新节点延迟显示
```

#### 1.4.3 订阅更新流程
```
1. 定时任务或手动触发
   ↓
2. Extension 发送 POST /api/v1/subscriptions/{id}/update
   ↓
3. Agent 下载订阅内容
   ↓
4. 解析节点信息
   ↓
5. 更新配置文件
   ↓
6. 通知 Core 重新加载配置
   ↓
7. Core 重启并加载新配置
   ↓
8. Agent 返回更新结果
```

### 1.5 生命周期管理

#### 1.5.1 Agent 生命周期
```
启动阶段:
1. 加载配置文件
2. 初始化日志系统
3. 初始化数据存储
4. 启动 API Server
5. 启动 Core 进程
6. 注册信号处理器
7. 进入运行状态

运行阶段:
1. 监听 API 请求
2. 监控 Core 进程健康
3. 处理定时任务
4. 响应控制命令

关闭阶段:
1. 接收关闭信号（SIGINT/SIGTERM）
2. 停止接收新请求
3. 等待现有请求完成（最多 30 秒）
4. 优雅关闭 Core 进程
5. 保存状态数据
6. 关闭日志系统
7. 退出进程
```

#### 1.5.2 Core 生命周期
```
启动:
1. Agent 通过 exec.Command 启动
2. 传递配置文件路径
3. 重定向标准输出到日志
4. 等待健康检查通过

监控:
1. Agent 定期检查进程状态
2. 检查 API 端点可用性
3. 监控资源使用

重启:
1. 检测到崩溃或无响应
2. 记录错误日志
3. 清理旧进程
4. 启动新进程
5. 通知 Extension 状态变化

关闭:
1. 发送 SIGTERM 信号
2. 等待 5 秒优雅退出
3. 超时则发送 SIGKILL
4. 清理资源
```

### 1.6 状态管理模型

#### 1.6.1 Agent 状态
```go
type AgentState struct {
    Status      string    // "starting", "running", "stopping", "stopped"
    StartTime   time.Time
    CoreStatus  CoreState
    APIStatus   string    // "listening", "error"
    LastError   error
}
```

#### 1.6.2 Core 状态
```go
type CoreState struct {
    Status      string    // "starting", "running", "stopped", "error"
    PID         int
    StartTime   time.Time
    RestartCount int
    LastCheck   time.Time
    Healthy     bool
}
```

#### 1.6.3 Extension 状态
```go
// Service Worker 维护的状态
{
    connected: boolean,        // 与 Agent 连接状态
    proxyEnabled: boolean,     // 代理是否启用
    currentGroup: string,      // 当前代理组
    currentProxy: string,      // 当前节点
    lastUpdate: timestamp,     // 最后更新时间
    error: string | null       // 错误信息
}
```

### 1.7 错误处理策略

#### 1.7.1 分层错误处理

**API 层错误**
- 请求参数验证错误 → 400 Bad Request
- 认证失败 → 401 Unauthorized
- 资源不存在 → 404 Not Found
- 内部错误 → 500 Internal Server Error
- 所有错误统一格式返回

**业务层错误**
- 配置文件错误 → 记录日志 + 返回错误码
- Core 通信失败 → 重试 3 次 + 降级处理
- 订阅更新失败 → 记录日志 + 保持旧配置

**进程层错误**
- Core 启动失败 → 记录日志 + 重试 3 次 + 通知用户
- Core 崩溃 → 自动重启 + 记录崩溃日志
- 端口占用 → 尝试其他端口 + 记录警告

#### 1.7.2 错误恢复机制

**自动恢复**
- Core 进程崩溃 → 自动重启（最多 5 次/分钟）
- 网络请求失败 → 指数退避重试
- 配置加载失败 → 使用默认配置

**降级处理**
- Core 不可用 → API 返回服务不可用状态
- 测速超时 → 返回部分结果
- 订阅更新失败 → 继续使用旧配置

**错误通知**
- 关键错误 → 记录到错误日志
- 用户操作失败 → 返回明确错误信息
- 系统异常 → 记录堆栈信息

#### 1.7.3 错误日志规范

```
[时间] [级别] [模块] [操作] 错误信息
[2026-02-22 10:30:45] [ERROR] [ProcessManager] [StartCore] Failed to start core process: port 7890 already in use
[2026-02-22 10:30:46] [WARN] [API] [ProxySelect] Core API timeout, retrying (1/3)
[2026-02-22 10:30:47] [INFO] [Config] [Reload] Configuration reloaded successfully
```

## 2. 技术选型说明

### 2.1 Go Web 框架选择

#### 选择：Gin Framework

**理由：**

1. **性能优秀**
   - 基于 httprouter，路由性能极高
   - 中间件机制高效
   - 内存占用低

2. **生态成熟**
   - 文档完善
   - 社区活跃
   - 中间件丰富

3. **开发效率**
   - API 简洁直观
   - 参数绑定方便
   - 错误处理清晰

4. **适合场景**
   - 本地 API 服务
   - 不需要复杂功能
   - 追求轻量和性能

**备选方案：**
- Fiber：性能更高，但生态较新
- Echo：功能类似，但 Gin 更流行
- 标准库 net/http：过于底层，开发效率低

### 2.2 进程管理方案

#### 选择：os/exec + 自定义守护逻辑

**核心实现：**

```
1. 使用 exec.Command 启动 Core
2. 使用 goroutine 监控进程状态
3. 使用 context 控制生命周期
4. 使用 sync.WaitGroup 等待退出
5. 使用 channel 通信状态变化
```

**监控策略：**
- 进程存活检查（每 5 秒）
- API 健康检查（每 10 秒）
- 资源使用监控（每 30 秒）

**重启策略：**
- 崩溃立即重启
- 连续失败限流（5 次/分钟）
- 指数退避（1s, 2s, 4s, 8s, 16s）

### 2.3 并发模型设计

#### 2.3.1 Goroutine 使用原则

**受控并发：**
- 使用 worker pool 限制并发数
- 测速并发数：10-20 个
- API 请求：Gin 自动管理

**生命周期管理：**
- 所有 goroutine 使用 context 控制
- 使用 WaitGroup 等待完成
- 避免裸启动 goroutine

**错误处理：**
- goroutine 内部 recover panic
- 错误通过 channel 传递
- 记录所有 panic 日志

#### 2.3.2 并发安全

**共享状态保护：**
- 使用 sync.RWMutex 保护读写
- 使用 sync.Map 存储并发访问数据
- 使用 atomic 操作计数器

**避免死锁：**
- 统一加锁顺序
- 使用 defer 释放锁
- 避免嵌套锁

### 2.4 日志方案

#### 选择：zap (uber-go/zap)

**理由：**

1. **性能极高**
   - 零分配设计
   - 结构化日志
   - 异步写入

2. **功能完善**
   - 日志级别控制
   - 日志轮转支持
   - 多输出目标

3. **生产就绪**
   - 经过大规模验证
   - 错误处理完善
   - 配置灵活

**日志配置：**
```
- 开发模式：控制台输出，彩色，详细
- 生产模式：文件输出，JSON，精简
- 日志级别：DEBUG, INFO, WARN, ERROR, FATAL
- 日志轮转：按天或按大小（100MB）
- 保留策略：保留 7 天或 10 个文件
```

### 2.5 配置管理方案

#### 选择：Viper

**理由：**

1. **功能全面**
   - 支持多种格式（YAML, JSON, TOML）
   - 支持环境变量
   - 支持配置热更新

2. **使用便捷**
   - API 简单
   - 类型安全
   - 默认值支持

**配置文件结构：**
```yaml
agent:
  listen: "127.0.0.1:8765"
  log_level: "info"
  log_dir: "./logs"
  
core:
  executable: "./clash.exe"
  config: "./config.yaml"
  api: "127.0.0.1:9090"
  proxy_port: 7890
  
subscriptions:
  - name: "订阅1"
    url: "https://example.com/sub"
    update_interval: 86400
```

### 2.6 为什么不直接让扩展调用 Core

**关键原因：**

1. **进程管理需求**
   - Core 需要启动、监控、重启
   - Extension 无法管理系统进程
   - 需要常驻服务保证 Core 运行

2. **配置管理复杂性**
   - 配置文件需要持久化
   - 订阅更新需要后台处理
   - Extension 存储能力有限

3. **功能扩展性**
   - 测速需要并发控制
   - 规则管理需要复杂逻辑
   - 日志需要持久化

4. **安全性考虑**
   - Core API 不应直接暴露
   - 需要统一的访问控制
   - 需要请求验证和过滤

5. **状态同步**
   - 多个 Extension 实例需要状态同步
   - 需要统一的状态管理
   - 需要事件通知机制

6. **跨浏览器扩展**
   - 未来支持其他浏览器
   - Agent 提供统一接口
   - 降低扩展开发复杂度

**架构优势：**
- 职责分离清晰
- 易于测试和维护
- 支持功能扩展
- 提供统一抽象层
