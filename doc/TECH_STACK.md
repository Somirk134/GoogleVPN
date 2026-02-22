# 技术选型说明文档

## 1. 技术栈总览

### 1.1 后端技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| Go | 1.22+ | 后端开发语言 |
| Gin | 1.9+ | Web 框架 |
| Zap | 1.26+ | 日志库 |
| Viper | 1.18+ | 配置管理 |
| golang.org/x/time/rate | latest | 限流 |

### 1.2 前端技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| Chrome Extension | Manifest V3 | 扩展框架 |
| Vanilla JavaScript | ES2020+ | 开发语言 |
| CSS3 | - | 样式 |

### 1.3 代理内核

| 技术 | 版本 | 用途 |
|------|------|------|
| Clash | 1.18+ | 代理核心 |

## 2. Go Web 框架选择

### 2.1 候选方案对比

#### 2.1.1 Gin Framework

**优势**:
- 性能优秀，基于 httprouter
- 生态成熟，社区活跃
- 中间件丰富
- 文档完善
- API 简洁直观
- 参数绑定方便
- 错误处理清晰

**劣势**:
- 相对较重（但仍然轻量）
- 部分功能需要中间件

**适用场景**:
- 中小型 API 服务
- 需要快速开发
- 追求性能和稳定性

#### 2.1.2 Fiber

**优势**:
- 性能极高，基于 fasthttp
- API 类似 Express.js
- 内置功能丰富

**劣势**:
- 生态较新，社区较小
- 文档不如 Gin 完善
- 部分库不兼容标准库

**适用场景**:
- 极致性能要求
- 熟悉 Express.js

#### 2.1.3 Echo

**优势**:
- 性能好
- 功能完整
- 文档清晰

**劣势**:
- 社区不如 Gin 活跃
- 生态不如 Gin 丰富

**适用场景**:
- 类似 Gin 的场景

#### 2.1.4 标准库 net/http

**优势**:
- 无依赖
- 完全控制
- 稳定性最高

**劣势**:
- 开发效率低
- 需要自己实现很多功能
- 代码量大

**适用场景**:
- 极简需求
- 不想引入依赖

### 2.2 最终选择：Gin

**选择理由**:

1. **性能满足需求**
   - 本地 API 服务，性能要求不高
   - Gin 性能已经足够优秀
   - 不需要 Fiber 的极致性能

2. **开发效率高**
   - API 简洁，上手快
   - 中间件丰富，开箱即用
   - 文档完善，问题容易解决

3. **生态成熟**
   - 社区活跃，问题容易找到答案
   - 第三方库丰富
   - 经过大量项目验证

4. **维护性好**
   - 代码清晰，易于维护
   - 团队熟悉度高
   - 长期支持

**使用示例**:

```go
package main

import (
    "github.com/gin-gonic/gin"
    "net/http"
)

func main() {
    r := gin.Default()
    
    // 中间件
    r.Use(CORSMiddleware())
    
    // 路由
    api := r.Group("/api/v1")
    {
        api.GET("/status", getStatus)
        api.GET("/proxies", getProxies)
        api.PUT("/proxies/:group", selectProxy)
    }
    
    r.Run(":8765")
}

func getStatus(c *gin.Context) {
    c.JSON(http.StatusOK, gin.H{
        "code": 0,
        "message": "success",
        "data": gin.H{
            "status": "running",
        },
    })
}
```

## 3. 日志方案选择

### 3.1 候选方案对比

#### 3.1.1 Zap (uber-go/zap)

**优势**:
- 性能极高，零分配设计
- 结构化日志
- 类型安全
- 支持日志级别
- 支持多输出
- 生产就绪

**劣势**:
- API 相对复杂
- 需要一定学习成本

#### 3.1.2 Logrus

**优势**:
- API 简单
- 功能完整
- 社区活跃

**劣势**:
- 性能不如 Zap
- 内存分配较多

#### 3.1.3 标准库 log

**优势**:
- 无依赖
- 简单

**劣势**:
- 功能有限
- 不支持结构化日志
- 不支持日志级别

### 3.2 最终选择：Zap

**选择理由**:

1. **性能优秀**
   - 零分配设计
   - 适合高频日志场景
   - 不影响程序性能

2. **功能完善**
   - 结构化日志
   - 日志级别控制
   - 多输出支持
   - 日志轮转支持

3. **生产就绪**
   - 经过大规模验证
   - 错误处理完善
   - 配置灵活

**使用示例**:

```go
package main

import (
    "go.uber.org/zap"
    "go.uber.org/zap/zapcore"
)

func main() {
    // 开发环境配置
    config := zap.NewDevelopmentConfig()
    config.EncoderConfig.EncodeLevel = zapcore.CapitalColorLevelEncoder
    
    logger, _ := config.Build()
    defer logger.Sync()
    
    // 使用
    logger.Info("Server started",
        zap.String("address", "127.0.0.1:8765"),
        zap.Int("port", 8765))
    
    logger.Error("Failed to connect",
        zap.Error(err),
        zap.String("host", "example.com"))
}
```

## 4. 配置管理方案选择

### 4.1 候选方案对比

#### 4.1.1 Viper

**优势**:
- 支持多种格式（YAML, JSON, TOML, ENV）
- 支持环境变量
- 支持配置热更新
- 支持远程配置
- API 简单

**劣势**:
- 依赖较多
- 部分功能用不到

#### 4.1.2 标准库 + YAML

**优势**:
- 依赖少
- 完全控制

**劣势**:
- 需要自己实现很多功能
- 开发效率低

### 4.2 最终选择：Viper

**选择理由**:

1. **功能全面**
   - 支持多种格式
   - 支持环境变量覆盖
   - 支持配置热更新

2. **使用便捷**
   - API 简单
   - 类型安全
   - 默认值支持

3. **扩展性好**
   - 未来可以支持远程配置
   - 可以支持配置中心

**使用示例**:

```go
package main

import (
    "github.com/spf13/viper"
)

type Config struct {
    Listen   string     `mapstructure:"listen"`
    LogLevel string     `mapstructure:"log_level"`
    Core     CoreConfig `mapstructure:"core"`
}

type CoreConfig struct {
    Executable string `mapstructure:"executable"`
    Config     string `mapstructure:"config"`
}

func LoadConfig(path string) (*Config, error) {
    viper.SetConfigFile(path)
    viper.SetConfigType("yaml")
    
    // 设置默认值
    viper.SetDefault("listen", "127.0.0.1:8765")
    viper.SetDefault("log_level", "info")
    
    // 读取配置
    if err := viper.ReadInConfig(); err != nil {
        return nil, err
    }
    
    // 解析到结构体
    var config Config
    if err := viper.Unmarshal(&config); err != nil {
        return nil, err
    }
    
    return &config, nil
}
```

## 5. 进程管理方案选择

### 5.1 候选方案对比

#### 5.1.1 os/exec + 自定义守护

**优势**:
- 完全控制
- 无依赖
- 灵活性高

**劣势**:
- 需要自己实现监控逻辑
- 需要处理各种边界情况

#### 5.1.2 第三方进程管理库

**优势**:
- 功能完整
- 开箱即用

**劣势**:
- 增加依赖
- 可能过于复杂
- 不一定适合需求

### 5.2 最终选择：os/exec + 自定义守护

**选择理由**:

1. **需求简单**
   - 只需要管理一个进程
   - 不需要复杂的进程管理功能

2. **完全控制**
   - 可以精确控制进程行为
   - 可以自定义监控策略
   - 可以自定义重启策略

3. **无额外依赖**
   - 使用标准库
   - 减少依赖风险

**实现要点**:

```go
package core

import (
    "context"
    "os/exec"
    "sync"
)

type Manager struct {
    cmd    *exec.Cmd
    ctx    context.Context
    cancel context.CancelFunc
    wg     sync.WaitGroup
    mu     sync.RWMutex
}

func (m *Manager) Start(ctx context.Context) error {
    m.ctx, m.cancel = context.WithCancel(ctx)
    
    // 启动进程
    if err := m.startProcess(); err != nil {
        return err
    }
    
    // 启动监控
    m.wg.Add(1)
    go m.monitor()
    
    return nil
}

func (m *Manager) startProcess() error {
    m.cmd = exec.CommandContext(m.ctx, m.executable, m.args...)
    return m.cmd.Start()
}

func (m *Manager) monitor() {
    defer m.wg.Done()
    
    // 等待进程退出
    m.cmd.Wait()
    
    // 检查是否需要重启
    select {
    case <-m.ctx.Done():
        return
    default:
        m.restart()
    }
}
```

## 6. 并发模型选择

### 6.1 Goroutine 管理

**选择**：Context + WaitGroup + Channel

**理由**:
- Go 原生支持
- 简单高效
- 易于控制生命周期

**模式**:

```go
func (s *Service) Run(ctx context.Context) error {
    var wg sync.WaitGroup
    
    // 启动 worker
    wg.Add(1)
    go func() {
        defer wg.Done()
        s.worker(ctx)
    }()
    
    // 等待退出
    <-ctx.Done()
    wg.Wait()
    
    return nil
}
```

### 6.2 Worker Pool

**选择**：自定义 Worker Pool

**理由**:
- 控制并发数
- 避免 goroutine 泄露
- 资源可控

**实现**:

```go
type WorkerPool struct {
    workers   int
    taskQueue chan Task
    wg        sync.WaitGroup
    ctx       context.Context
    cancel    context.CancelFunc
}

func (p *WorkerPool) Start() {
    for i := 0; i < p.workers; i++ {
        p.wg.Add(1)
        go p.worker(i)
    }
}

func (p *WorkerPool) worker(id int) {
    defer p.wg.Done()
    
    for {
        select {
        case task := <-p.taskQueue:
            task.Execute()
        case <-p.ctx.Done():
            return
        }
    }
}
```

## 7. HTTP 客户端选择

### 7.1 标准库 net/http

**选择理由**:
- 功能完整
- 性能足够
- 无需额外依赖
- 支持 context
- 支持超时控制

**使用示例**:

```go
func (c *Client) request(ctx context.Context, method, path string) (*Response, error) {
    ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
    defer cancel()
    
    req, err := http.NewRequestWithContext(ctx, method, c.baseURL+path, nil)
    if err != nil {
        return nil, err
    }
    
    resp, err := c.client.Do(req)
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()
    
    // 处理响应...
    return response, nil
}
```

## 8. 数据存储选择

### 8.1 文件存储

**选择**：JSON 文件

**理由**:
- 数据量小
- 结构简单
- 易于调试
- 无需数据库

**使用场景**:
- 订阅列表
- 配置信息
- 缓存数据

### 8.2 内存缓存

**选择**：sync.Map

**理由**:
- 并发安全
- 性能好
- 标准库支持

**使用场景**:
- 延迟缓存
- 状态缓存

## 9. Chrome Extension 技术选择

### 9.1 Manifest 版本

**选择**：Manifest V3

**理由**:
- Chrome 官方推荐
- 未来趋势
- 更安全
- 更高性能

**注意事项**:
- Service Worker 替代 Background Page
- 权限更严格
- API 有变化

### 9.2 开发语言

**选择**：Vanilla JavaScript (ES2020+)

**理由**:
- 无需构建工具
- 开发简单
- 调试方便
- 性能好

**不选择框架的原因**:
- 项目规模小
- 不需要复杂状态管理
- 避免构建复杂度

## 10. 为什么不直接让扩展调用 Core

### 10.1 架构原因

**问题**:
- Extension 无法管理系统进程
- Extension 无法持久化运行
- Extension 存储能力有限

**解决**:
- Agent 作为常驻服务
- 管理 Core 生命周期
- 提供统一抽象层

### 10.2 功能原因

**问题**:
- 测速需要并发控制
- 订阅更新需要后台处理
- 配置管理需要持久化

**解决**:
- Agent 提供完整功能
- Extension 只负责 UI
- 职责分离清晰

### 10.3 安全原因

**问题**:
- Core API 不应直接暴露
- 需要统一访问控制
- 需要请求验证

**解决**:
- Agent 作为安全边界
- 统一认证和授权
- 请求过滤和验证

### 10.4 扩展性原因

**问题**:
- 未来支持其他浏览器
- 未来支持其他客户端
- 功能持续扩展

**解决**:
- Agent 提供统一接口
- 客户端只需调用 API
- 易于扩展和维护

## 11. 依赖管理

### 11.1 Go 依赖

```go
// go.mod
module github.com/yourusername/proxy-manager

go 1.22

require (
    github.com/gin-gonic/gin v1.9.1
    go.uber.org/zap v1.26.0
    github.com/spf13/viper v1.18.0
    golang.org/x/time v0.5.0
    gopkg.in/yaml.v3 v3.0.1
)
```

### 11.2 依赖更新策略

```
- 定期检查依赖更新
- 优先更新安全补丁
- 谨慎更新大版本
- 充分测试后更新
```

## 12. 开发工具

### 12.1 Go 开发工具

```
- Go 1.22+
- VSCode / GoLand
- golangci-lint（代码检查）
- go test（测试）
- pprof（性能分析）
```

### 12.2 Extension 开发工具

```
- Chrome DevTools
- Extension Reloader
- Postman（API 测试）
```

### 12.3 其他工具

```
- Git（版本控制）
- Make（构建工具）
- Docker（可选，用于测试环境）
```

## 13. 技术栈总结

### 13.1 优势

```
1. 技术成熟稳定
2. 生态完善
3. 性能满足需求
4. 开发效率高
5. 维护成本低
```

### 13.2 风险

```
1. Go 版本兼容性
2. Chrome Extension API 变化
3. Clash Core 版本兼容性
```

### 13.3 应对措施

```
1. 使用稳定版本
2. 关注官方更新
3. 充分测试
4. 预留升级方案
```
