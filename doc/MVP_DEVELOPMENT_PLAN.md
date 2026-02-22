# MVP 分阶段开发规划

## 1. 总体规划

### 1.1 开发原则

```
1. 最小可用产品优先
2. 核心功能先行
3. 逐步迭代完善
4. 每个阶段可独立测试
5. 保持架构可扩展性
```

### 1.2 阶段划分

```
阶段 0: 环境准备和项目搭建（1-2 天）
阶段 1: Core 进程管理（2-3 天）
阶段 2: 基础 API 服务（2-3 天）
阶段 3: Chrome Extension 基础（2-3 天）
阶段 4: 代理控制和节点切换（2-3 天）
阶段 5: 测速功能（1-2 天）
阶段 6: 订阅管理（2-3 天）
阶段 7: 完善和优化（2-3 天）

总计：14-22 天
```

## 2. 阶段 0：环境准备和项目搭建

### 2.1 目标

- 搭建项目目录结构
- 配置开发环境
- 准备依赖和工具

### 2.2 任务清单

#### 2.2.1 Go 后端

```
□ 创建项目目录结构
□ 初始化 Go 模块（go mod init）
□ 安装依赖包
  - github.com/gin-gonic/gin
  - go.uber.org/zap
  - gopkg.in/yaml.v3
  - golang.org/x/time/rate
□ 配置 .gitignore
□ 创建 Makefile
□ 准备 Clash Core 可执行文件
```

#### 2.2.2 Chrome Extension

```
□ 创建 extension 目录
□ 创建 manifest.json
□ 准备图标资源
□ 创建基础 HTML 文件
```

#### 2.2.3 文档

```
□ 创建 README.md
□ 复制设计文档到 docs/
```

### 2.3 验收标准

```
✓ 项目目录结构完整
✓ Go 项目可以编译
✓ Extension 可以加载到 Chrome
✓ 文档齐全
```

### 2.4 风险

```
- Clash Core 版本兼容性问题
- Go 依赖下载失败
```

## 3. 阶段 1：Core 进程管理

### 3.1 目标

- 实现 Core 进程的启动、监控、重启
- 实现健康检查
- 实现优雅关闭

### 3.2 必须完成的功能

#### 3.2.1 进程管理器

```go
// internal/core/manager.go

type Manager struct {
    // 基础字段
    cfg        *CoreConfig
    cmd        *exec.Cmd
    pid        int
    status     ProcessStatus
    
    // 并发控制
    ctx        context.Context
    cancel     context.CancelFunc
    wg         sync.WaitGroup
    mu         sync.RWMutex
}

// 必须实现的方法
func (m *Manager) Start(ctx context.Context) error
func (m *Manager) Stop() error
func (m *Manager) HealthCheck(ctx context.Context) error
func (m *Manager) GetStatus() ProcessStatus
```

#### 3.2.2 配置管理

```go
// internal/config/config.go

type Config struct {
    Core CoreConfig `yaml:"core"`
}

type CoreConfig struct {
    Executable string `yaml:"executable"`
    Config     string `yaml:"config"`
    API        string `yaml:"api"`
    ProxyPort  int    `yaml:"proxy_port"`
}

func Load(path string) (*Config, error)
func (c *Config) Validate() error
```

#### 3.2.3 日志系统

```go
// internal/logger/logger.go

func New(level string, logDir string) (*zap.Logger, error)
```

### 3.3 测试方法

```
1. 单元测试
   - 测试配置加载
   - 测试进程启动
   - 测试健康检查

2. 集成测试
   - 启动 Core 进程
   - 验证进程运行
   - 验证健康检查通过
   - 停止进程
   - 验证优雅关闭

3. 手动测试
   - 运行 Agent
   - 检查 Core 是否启动
   - 检查日志输出
   - Ctrl+C 停止
   - 验证 Core 正常退出
```

### 3.4 验收标准

```
✓ Core 进程可以正常启动
✓ 健康检查正常工作
✓ Core 崩溃后自动重启
✓ Agent 关闭时 Core 优雅退出
✓ 日志记录完整
```

### 3.5 可能风险

```
- Windows 进程信号处理差异
- Core 启动失败无法检测
- 进程僵尸问题
```

## 4. 阶段 2：基础 API 服务

### 4.1 目标

- 实现 HTTP API 服务器
- 实现基础接口
- 实现中间件

### 4.2 必须完成的接口

#### 4.2.1 系统状态接口

```
GET /api/v1/status
- 返回 Agent 和 Core 状态

GET /api/v1/version
- 返回版本信息
```

#### 4.2.2 代理管理接口

```
GET /api/v1/proxies
- 获取所有代理组和节点

GET /api/v1/proxies/{group}
- 获取指定代理组

PUT /api/v1/proxies/{group}
- 切换代理节点
```

### 4.3 必须实现的中间件

```go
// internal/api/middleware/

func CORS() gin.HandlerFunc
func Logger() gin.HandlerFunc
func Recovery() gin.HandlerFunc
```

### 4.4 测试方法

```
1. 单元测试
   - 测试路由注册
   - 测试中间件
   - 测试 Handler 逻辑

2. API 测试
   使用 curl 或 Postman 测试：
   
   # 获取状态
   curl http://127.0.0.1:8765/api/v1/status
   
   # 获取代理列表
   curl http://127.0.0.1:8765/api/v1/proxies
   
   # 切换节点
   curl -X PUT http://127.0.0.1:8765/api/v1/proxies/GLOBAL \
     -H "Content-Type: application/json" \
     -d '{"name":"HK-01"}'

3. 集成测试
   - 启动 Agent
   - 调用所有 API
   - 验证响应格式
   - 验证错误处理
```

### 4.5 验收标准

```
✓ API 服务器正常启动
✓ 所有接口返回正确格式
✓ CORS 配置正确
✓ 错误处理完善
✓ 日志记录完整
```

### 4.6 可能风险

```
- Core API 格式变化
- 并发请求处理问题
- 错误处理不完善
```

## 5. 阶段 3：Chrome Extension 基础

### 5.1 目标

- 实现 Service Worker
- 实现 Popup UI
- 实现与 Agent 通信

### 5.2 必须完成的功能

#### 5.2.1 Service Worker

```javascript
// background/background.js

// 状态管理
class StateManager {
    getState()
    setState(updates)
    persist()
    restore()
}

// API 客户端
class AgentAPI {
    request(method, path, data)
    getStatus()
    getProxies()
    selectProxy(group, proxy)
}

// 代理控制
class ProxyController {
    enable()
    disable()
    isEnabled()
}
```

#### 5.2.2 Popup UI

```html
<!-- popup/popup.html -->

- 状态指示器
- 代理开关按钮
- 代理组选择
- 节点列表
- 流量统计
```

#### 5.2.3 消息通信

```javascript
// 消息类型
- GET_STATE
- SELECT_PROXY
- TOGGLE_PROXY
- STATE_UPDATE
```

### 5.3 测试方法

```
1. 功能测试
   - 加载扩展到 Chrome
   - 打开 Popup
   - 检查 UI 显示
   - 测试按钮点击
   - 检查 Service Worker 日志

2. 通信测试
   - 启动 Agent
   - Extension 连接 Agent
   - 验证状态同步
   - 测试节点切换
   - 验证代理生效

3. 状态持久化测试
   - 设置状态
   - 重启浏览器
   - 验证状态恢复
```

### 5.4 验收标准

```
✓ Extension 可以正常加载
✓ Popup UI 正常显示
✓ 可以连接到 Agent
✓ 状态同步正常
✓ 代理控制正常工作
```

### 5.5 可能风险

```
- Manifest V3 API 限制
- Service Worker 生命周期问题
- 跨域请求被阻止
```

## 6. 阶段 4：代理控制和节点切换

### 6.1 目标

- 完善代理控制逻辑
- 实现节点切换
- 实现状态同步

### 6.2 必须完成的功能

#### 6.2.1 代理控制器

```go
// internal/proxy/controller.go

type Controller struct {
    coreClient *core.Client
}

func (c *Controller) GetProxies(ctx context.Context) (map[string]Proxy, error)
func (c *Controller) GetGroup(ctx context.Context, name string) (*ProxyGroup, error)
func (c *Controller) SelectProxy(ctx context.Context, group, proxy string) error
```

#### 6.2.2 Core API 客户端

```go
// internal/core/client.go

type Client struct {
    baseURL string
    client  *http.Client
}

func (c *Client) GetProxies(ctx context.Context) (map[string]interface{}, error)
func (c *Client) SelectProxy(ctx context.Context, group, proxy string) error
```

#### 6.2.3 Extension 节点切换

```javascript
// popup/popup.js

async function selectProxy(proxyName) {
    // 1. 发送切换请求
    const response = await chrome.runtime.sendMessage({
        type: 'SELECT_PROXY',
        data: { group: currentGroup, proxy: proxyName }
    });
    
    // 2. 更新 UI
    if (response.success) {
        updateProxyList();
    }
}
```

### 6.3 测试方法

```
1. 功能测试
   - 获取代理列表
   - 切换不同节点
   - 验证切换成功
   - 检查 Chrome 代理设置

2. 流量测试
   - 启用代理
   - 访问网站
   - 验证流量经过代理
   - 切换节点
   - 再次验证流量

3. 错误测试
   - 切换到不存在的节点
   - Core 未启动时切换
   - 验证错误处理
```

### 6.4 验收标准

```
✓ 可以获取完整代理列表
✓ 节点切换成功
✓ Chrome 代理设置正确
✓ 流量正常通过代理
✓ 错误处理完善
```

### 6.5 可能风险

```
- Core API 调用失败
- 代理设置不生效
- 节点切换延迟
```

## 7. 阶段 5：测速功能

### 7.1 目标

- 实现并发测速
- 实现延迟显示
- 实现结果缓存

### 7.2 必须完成的功能

#### 7.2.1 测速模块

```go
// internal/proxy/speedtest.go

type SpeedTester struct {
    client     *http.Client
    workerPool *WorkerPool
    timeout    time.Duration
    testURL    string
}

func (t *SpeedTester) TestProxies(ctx context.Context, proxies []string) ([]DelayResult, error)
func (t *SpeedTester) testSingleProxy(ctx context.Context, proxy string) DelayResult
```

#### 7.2.2 测速 API

```
POST /api/v1/proxies/test
- 批量测速

GET /api/v1/proxies/{proxy}/delay
- 单个节点测速
```

#### 7.2.3 Extension 测速

```javascript
// popup/popup.js

async function testAll() {
    // 1. 显示测速中
    showTesting();
    
    // 2. 发起测速请求
    const results = await api.testProxies();
    
    // 3. 更新延迟显示
    updateDelays(results);
}
```

### 7.3 测试方法

```
1. 功能测试
   - 测试单个节点
   - 测试所有节点
   - 验证延迟结果
   - 检查超时处理

2. 性能测试
   - 测试 50 个节点
   - 验证并发控制
   - 检查内存使用
   - 验证测速时间

3. UI 测试
   - 点击测速按钮
   - 观察测速进度
   - 验证延迟显示
   - 检查颜色标识
```

### 7.4 验收标准

```
✓ 测速功能正常工作
✓ 延迟结果准确
✓ 并发控制有效
✓ UI 显示正确
✓ 超时处理完善
```

### 7.5 可能风险

```
- 测速超时过多
- 并发过高导致性能问题
- 测速结果不准确
```

## 8. 阶段 6：订阅管理

### 8.1 目标

- 实现订阅 CRUD
- 实现订阅更新
- 实现节点解析

### 8.2 必须完成的功能

#### 8.2.1 订阅管理器

```go
// internal/subscription/manager.go

type Manager struct {
    storage *storage.Storage
    client  *http.Client
}

func (m *Manager) List() ([]Subscription, error)
func (m *Manager) Add(sub *Subscription) error
func (m *Manager) Update(ctx context.Context, id string) error
func (m *Manager) Delete(id string) error
```

#### 8.2.2 订阅解析器

```go
// internal/subscription/parser.go

func ParseSubscription(content []byte) ([]ProxyNode, error)
func parseProxyLine(line string) (ProxyNode, error)
```

#### 8.2.3 订阅 API

```
GET /api/v1/subscriptions
POST /api/v1/subscriptions
PUT /api/v1/subscriptions/{id}
DELETE /api/v1/subscriptions/{id}
POST /api/v1/subscriptions/{id}/update
```

#### 8.2.4 Extension 订阅管理

```javascript
// options/options.js

// 订阅列表显示
// 添加订阅表单
// 更新订阅按钮
// 删除订阅按钮
```

### 8.3 测试方法

```
1. 功能测试
   - 添加订阅
   - 更新订阅
   - 删除订阅
   - 验证节点解析

2. 更新测试
   - 手动更新订阅
   - 验证节点更新
   - 验证 Core 重载
   - 检查错误处理

3. UI 测试
   - 打开设置页面
   - 添加订阅
   - 更新订阅
   - 删除订阅
   - 验证列表更新
```

### 8.4 验收标准

```
✓ 订阅 CRUD 正常工作
✓ 订阅更新成功
✓ 节点解析正确
✓ Core 配置更新
✓ UI 操作流畅
```

### 8.5 可能风险

```
- 订阅格式不兼容
- 订阅下载失败
- 节点解析错误
- Core 重载失败
```

## 9. 阶段 7：完善和优化

### 9.1 目标

- 修复已知问题
- 优化性能
- 完善文档
- 准备发布

### 9.2 任务清单

#### 9.2.1 功能完善

```
□ 错误处理完善
□ 日志记录完善
□ 配置验证完善
□ 边界情况处理
```

#### 9.2.2 性能优化

```
□ API 响应时间优化
□ 测速并发优化
□ 内存使用优化
□ 启动时间优化
```

#### 9.2.3 用户体验

```
□ UI 交互优化
□ 错误提示优化
□ 加载状态显示
□ 操作反馈优化
```

#### 9.2.4 文档完善

```
□ 用户使用文档
□ 安装部署文档
□ 故障排查文档
□ API 文档
```

#### 9.2.5 测试

```
□ 完整功能测试
□ 性能测试
□ 兼容性测试
□ 压力测试
```

### 9.3 验收标准

```
✓ 所有功能正常工作
✓ 性能达到要求
✓ 文档完整
✓ 测试通过
✓ 可以发布
```

## 10. 开发规范

### 10.1 代码规范

```
Go:
- 遵循 Go 官方代码规范
- 使用 gofmt 格式化
- 使用 golint 检查
- 注释完整

JavaScript:
- 使用 ESLint
- 使用 Prettier 格式化
- 注释完整
```

### 10.2 Git 规范

```
提交信息格式:
[类型] 简短描述

类型:
- feat: 新功能
- fix: 修复
- docs: 文档
- style: 格式
- refactor: 重构
- test: 测试
- chore: 构建

示例:
[feat] 实现 Core 进程管理
[fix] 修复节点切换失败问题
[docs] 更新 API 文档
```

### 10.3 分支管理

```
main - 主分支（稳定版本）
develop - 开发分支
feature/* - 功能分支
bugfix/* - 修复分支
release/* - 发布分支
```

### 10.4 测试规范

```
- 单元测试覆盖率 > 60%
- 关键功能必须有测试
- 集成测试覆盖主要流程
- 手动测试验证用户体验
```

## 11. 里程碑

### 11.1 M1: Core 管理完成（第 5 天）

```
✓ Core 可以启动和停止
✓ 健康检查正常
✓ 日志记录完整
```

### 11.2 M2: API 服务完成（第 10 天）

```
✓ API 服务器运行
✓ 基础接口可用
✓ 代理控制正常
```

### 11.3 M3: Extension 完成（第 15 天）

```
✓ Extension 可以使用
✓ UI 功能完整
✓ 代理控制正常
```

### 11.4 M4: MVP 完成（第 22 天）

```
✓ 所有功能完成
✓ 测试通过
✓ 文档完整
✓ 可以发布
```

## 12. 风险管理

### 12.1 技术风险

```
风险: Core API 不兼容
应对: 提前测试 Core 版本，准备适配方案

风险: Windows 进程管理问题
应对: 充分测试，准备备用方案

风险: Extension 权限限制
应对: 研究 Manifest V3 文档，寻找替代方案
```

### 12.2 进度风险

```
风险: 开发时间超出预期
应对: 优先完成核心功能，次要功能后续迭代

风险: 测试发现重大问题
应对: 预留缓冲时间，及时调整计划
```

### 12.3 质量风险

```
风险: 功能不稳定
应对: 充分测试，逐步发布

风险: 性能不达标
应对: 性能监控，及时优化
```

## 13. 发布检查清单

### 13.1 功能检查

```
□ Core 进程管理正常
□ API 服务正常
□ Extension 功能完整
□ 代理控制正常
□ 节点切换正常
□ 测速功能正常
□ 订阅管理正常
```

### 13.2 质量检查

```
□ 单元测试通过
□ 集成测试通过
□ 手动测试通过
□ 性能测试通过
□ 无已知严重 Bug
```

### 13.3 文档检查

```
□ README 完整
□ 安装文档完整
□ 使用文档完整
□ API 文档完整
□ 故障排查文档完整
```

### 13.4 发布准备

```
□ 版本号确定
□ 更新日志编写
□ 构建脚本准备
□ 发布包打包
□ 发布说明准备
```
