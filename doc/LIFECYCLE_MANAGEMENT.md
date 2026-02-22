# 启动与关闭流程设计文档

## 1. Agent 启动流程

### 1.1 启动流程图

```
开始
  ↓
加载配置文件
  ↓
验证配置
  ↓
初始化日志系统
  ↓
初始化数据存储
  ↓
创建 Core Manager
  ↓
启动 Core 进程
  ↓
等待 Core 就绪
  ↓
启动 API Server
  ↓
启动订阅管理器
  ↓
注册信号处理器
  ↓
进入运行状态
```

### 1.2 详细启动步骤

#### 1.2.1 主函数入口

```go
func main() {
    // 1. 解析命令行参数
    configFile := flag.String("config", "config.yaml", "config file path")
    flag.Parse()
    
    // 2. 加载配置
    cfg, err := config.Load(*configFile)
    if err != nil {
        fmt.Fprintf(os.Stderr, "Failed to load config: %v\n", err)
        os.Exit(1)
    }
    
    // 3. 初始化日志
    logger, err := logger.New(cfg.LogLevel, cfg.LogDir)
    if err != nil {
        fmt.Fprintf(os.Stderr, "Failed to initialize logger: %v\n", err)
        os.Exit(1)
    }
    defer logger.Sync()
    
    log.Info("Starting Proxy Agent", zap.String("version", Version))
    
    // 4. 创建应用实例
    app, err := NewApplication(cfg, logger)
    if err != nil {
        log.Fatal("Failed to create application", zap.Error(err))
    }
    
    // 5. 启动应用
    if err := app.Start(); err != nil {
        log.Fatal("Failed to start application", zap.Error(err))
    }
    
    // 6. 等待退出信号
    app.WaitForShutdown()
    
    // 7. 优雅关闭
    if err := app.Stop(); err != nil {
        log.Error("Error during shutdown", zap.Error(err))
        os.Exit(1)
    }
    
    log.Info("Proxy Agent stopped")
}
```

#### 1.2.2 配置加载

```go
func Load(path string) (*Config, error) {
    // 检查文件是否存在
    if _, err := os.Stat(path); os.IsNotExist(err) {
        // 首次运行，创建默认配置
        if err := createDefaultConfig(path); err != nil {
            return nil, fmt.Errorf("failed to create default config: %w", err)
        }
    }
    
    // 读取配置文件
    data, err := os.ReadFile(path)
    if err != nil {
        return nil, fmt.Errorf("failed to read config file: %w", err)
    }
    
    // 解析配置
    var cfg Config
    if err := yaml.Unmarshal(data, &cfg); err != nil {
        return nil, fmt.Errorf("failed to parse config: %w", err)
    }
    
    // 验证配置
    if err := cfg.Validate(); err != nil {
        return nil, fmt.Errorf("invalid config: %w", err)
    }
    
    // 设置默认值
    cfg.SetDefaults()
    
    return &cfg, nil
}
```

#### 1.2.3 应用初始化

```go
type Application struct {
    cfg    *config.Config
    logger *zap.Logger
    
    ctx    context.Context
    cancel context.CancelFunc
    wg     sync.WaitGroup
    
    storage    *storage.Storage
    coreManager *core.Manager
    apiServer   *api.Server
    subManager  *subscription.Manager
    
    shutdownCh chan os.Signal
}

func NewApplication(cfg *config.Config, logger *zap.Logger) (*Application, error) {
    ctx, cancel := context.WithCancel(context.Background())
    
    app := &Application{
        cfg:        cfg,
        logger:     logger,
        ctx:        ctx,
        cancel:     cancel,
        shutdownCh: make(chan os.Signal, 1),
    }
    
    // 初始化存储
    storage, err := storage.New(cfg.DataDir)
    if err != nil {
        cancel()
        return nil, fmt.Errorf("failed to initialize storage: %w", err)
    }
    app.storage = storage
    
    // 初始化 Core Manager
    coreManager, err := core.NewManager(cfg.Core, logger)
    if err != nil {
        cancel()
        return nil, fmt.Errorf("failed to create core manager: %w", err)
    }
    app.coreManager = coreManager
    
    // 初始化订阅管理器
    subManager, err := subscription.NewManager(storage, logger)
    if err != nil {
        cancel()
        return nil, fmt.Errorf("failed to create subscription manager: %w", err)
    }
    app.subManager = subManager
    
    // 初始化 API Server
    apiServer, err := api.NewServer(cfg.Listen, coreManager, subManager, logger)
    if err != nil {
        cancel()
        return nil, fmt.Errorf("failed to create API server: %w", err)
    }
    app.apiServer = apiServer
    
    return app, nil
}
```


#### 1.2.4 启动各个组件

```go
func (app *Application) Start() error {
    log.Info("Starting application components")
    
    // 1. 启动 Core Manager
    log.Info("Starting Core Manager")
    app.wg.Add(1)
    go func() {
        defer app.wg.Done()
        if err := app.coreManager.Run(app.ctx); err != nil {
            log.Error("Core Manager error", zap.Error(err))
        }
    }()
    
    // 2. 等待 Core 就绪
    log.Info("Waiting for Core to be ready")
    if err := app.waitForCore(); err != nil {
        return fmt.Errorf("core failed to start: %w", err)
    }
    log.Info("Core is ready")
    
    // 3. 启动订阅管理器
    log.Info("Starting Subscription Manager")
    app.wg.Add(1)
    go func() {
        defer app.wg.Done()
        if err := app.subManager.Run(app.ctx); err != nil {
            log.Error("Subscription Manager error", zap.Error(err))
        }
    }()
    
    // 4. 启动 API Server
    log.Info("Starting API Server", zap.String("listen", app.cfg.Listen))
    app.wg.Add(1)
    go func() {
        defer app.wg.Done()
        if err := app.apiServer.Run(app.ctx); err != nil && err != http.ErrServerClosed {
            log.Error("API Server error", zap.Error(err))
        }
    }()
    
    // 5. 等待 API Server 就绪
    if err := app.waitForAPI(); err != nil {
        return fmt.Errorf("API server failed to start: %w", err)
    }
    log.Info("API Server is ready")
    
    log.Info("All components started successfully")
    return nil
}

func (app *Application) waitForCore() error {
    ctx, cancel := context.WithTimeout(app.ctx, 30*time.Second)
    defer cancel()
    
    ticker := time.NewTicker(500 * time.Millisecond)
    defer ticker.Stop()
    
    for {
        select {
        case <-ticker.C:
            if err := app.coreManager.HealthCheck(ctx); err == nil {
                return nil
            }
        case <-ctx.Done():
            return errors.New("timeout waiting for core to be ready")
        }
    }
}

func (app *Application) waitForAPI() error {
    ctx, cancel := context.WithTimeout(app.ctx, 10*time.Second)
    defer cancel()
    
    ticker := time.NewTicker(200 * time.Millisecond)
    defer ticker.Stop()
    
    for {
        select {
        case <-ticker.C:
            req, _ := http.NewRequestWithContext(ctx, "GET", "http://"+app.cfg.Listen+"/api/v1/status", nil)
            resp, err := http.DefaultClient.Do(req)
            if err == nil {
                resp.Body.Close()
                if resp.StatusCode == http.StatusOK {
                    return nil
                }
            }
        case <-ctx.Done():
            return errors.New("timeout waiting for API server to be ready")
        }
    }
}
```

#### 1.2.5 信号处理

```go
func (app *Application) WaitForShutdown() {
    // 注册信号处理
    signal.Notify(app.shutdownCh, os.Interrupt, syscall.SIGTERM)
    
    // 等待信号
    sig := <-app.shutdownCh
    log.Info("Received shutdown signal", zap.String("signal", sig.String()))
}
```

## 2. Core 启动流程

### 2.1 Core 启动步骤

```go
func (m *Manager) Run(ctx context.Context) error {
    m.ctx = ctx
    
    // 1. 首次启动 Core
    if err := m.startCore(); err != nil {
        return fmt.Errorf("failed to start core: %w", err)
    }
    
    // 2. 启动监控 goroutine
    m.wg.Add(1)
    go m.monitorCore()
    
    // 3. 启动健康检查 goroutine
    m.wg.Add(1)
    go m.healthCheckLoop()
    
    // 4. 等待 context 取消
    <-ctx.Done()
    
    // 5. 停止 Core
    if err := m.stopCore(); err != nil {
        log.Error("Failed to stop core", zap.Error(err))
    }
    
    // 6. 等待所有 goroutine 退出
    m.wg.Wait()
    
    return nil
}

func (m *Manager) startCore() error {
    m.mu.Lock()
    defer m.mu.Unlock()
    
    log.Info("Starting Core process",
        zap.String("executable", m.cfg.Executable),
        zap.String("config", m.cfg.Config))
    
    // 1. 检查可执行文件
    if _, err := os.Stat(m.cfg.Executable); os.IsNotExist(err) {
        return fmt.Errorf("core executable not found: %s", m.cfg.Executable)
    }
    
    // 2. 检查配置文件
    if _, err := os.Stat(m.cfg.Config); os.IsNotExist(err) {
        return fmt.Errorf("core config not found: %s", m.cfg.Config)
    }
    
    // 3. 创建命令
    args := []string{"-f", m.cfg.Config}
    m.cmd = exec.CommandContext(m.ctx, m.cfg.Executable, args...)
    
    // 4. 设置工作目录
    m.cmd.Dir = filepath.Dir(m.cfg.Executable)
    
    // 5. 重定向输出
    stdoutLog := filepath.Join(m.logDir, "core-stdout.log")
    stderrLog := filepath.Join(m.logDir, "core-stderr.log")
    
    stdoutFile, err := os.OpenFile(stdoutLog, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
    if err != nil {
        return fmt.Errorf("failed to open stdout log: %w", err)
    }
    
    stderrFile, err := os.OpenFile(stderrLog, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
    if err != nil {
        stdoutFile.Close()
        return fmt.Errorf("failed to open stderr log: %w", err)
    }
    
    m.cmd.Stdout = stdoutFile
    m.cmd.Stderr = stderrFile
    
    // 6. 启动进程
    if err := m.cmd.Start(); err != nil {
        stdoutFile.Close()
        stderrFile.Close()
        return fmt.Errorf("failed to start core process: %w", err)
    }
    
    // 7. 更新状态
    m.pid = m.cmd.Process.Pid
    m.status = StatusRunning
    m.startTime = time.Now()
    
    log.Info("Core process started",
        zap.Int("pid", m.pid),
        zap.Time("start_time", m.startTime))
    
    return nil
}
```

### 2.2 Core 健康检查

```go
func (m *Manager) healthCheckLoop() {
    defer m.wg.Done()
    
    ticker := time.NewTicker(10 * time.Second)
    defer ticker.Stop()
    
    for {
        select {
        case <-ticker.C:
            if err := m.HealthCheck(m.ctx); err != nil {
                log.Warn("Core health check failed", zap.Error(err))
                m.mu.Lock()
                m.healthy = false
                m.mu.Unlock()
            } else {
                m.mu.Lock()
                m.healthy = true
                m.lastCheck = time.Now()
                m.mu.Unlock()
            }
        case <-m.ctx.Done():
            return
        }
    }
}

func (m *Manager) HealthCheck(ctx context.Context) error {
    // 1. 检查进程状态
    m.mu.RLock()
    pid := m.pid
    status := m.status
    m.mu.RUnlock()
    
    if status != StatusRunning {
        return errors.New("core is not running")
    }
    
    // 2. 检查进程是否存在（Windows）
    process, err := os.FindProcess(pid)
    if err != nil {
        return fmt.Errorf("process not found: %w", err)
    }
    
    // 3. 检查 API 可用性
    ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
    defer cancel()
    
    req, err := http.NewRequestWithContext(ctx, "GET", m.cfg.API+"/version", nil)
    if err != nil {
        return err
    }
    
    resp, err := http.DefaultClient.Do(req)
    if err != nil {
        return fmt.Errorf("API request failed: %w", err)
    }
    defer resp.Body.Close()
    
    if resp.StatusCode != http.StatusOK {
        return fmt.Errorf("unexpected status code: %d", resp.StatusCode)
    }
    
    return nil
}
```

## 3. Chrome Extension 加载流程

### 3.1 Extension 安装/更新

```javascript
// background.js

// 监听安装事件
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    console.log('Extension installed');
    await handleInstall();
  } else if (details.reason === 'update') {
    console.log('Extension updated');
    await handleUpdate(details.previousVersion);
  }
});

async function handleInstall() {
  // 1. 初始化默认配置
  await chrome.storage.local.set({
    config: {
      agentURL: 'http://127.0.0.1:8765',
      autoConnect: true,
      testInterval: 300,  // 5 分钟
    },
    state: {
      connected: false,
      proxyEnabled: false,
      currentGroup: 'GLOBAL',
      currentProxy: null,
    }
  });
  
  // 2. 打开欢迎页面
  chrome.tabs.create({
    url: 'options.html?welcome=true'
  });
}

async function handleUpdate(previousVersion) {
  // 迁移旧版本数据
  console.log('Migrating from version', previousVersion);
  
  // 清除旧缓存
  await chrome.storage.local.remove(['cache']);
}
```

### 3.2 Extension 启动

```javascript
// background.js

// 监听浏览器启动
chrome.runtime.onStartup.addListener(async () => {
  console.log('Browser started');
  await handleStartup();
});

async function handleStartup() {
  // 1. 恢复状态
  const { state, config } = await chrome.storage.local.get(['state', 'config']);
  
  // 2. 初始化模块
  await stateManager.restore();
  await api.initialize(config.agentURL);
  
  // 3. 连接 Agent
  if (config.autoConnect) {
    try {
      await connectToAgent();
    } catch (error) {
      console.error('Failed to connect to agent:', error);
    }
  }
  
  // 4. 启动定时任务
  scheduler.start();
  
  // 5. 恢复代理设置
  if (state.proxyEnabled) {
    await proxyController.enable();
  }
}

async function connectToAgent() {
  // 1. 检查 Agent 状态
  const status = await api.getStatus();
  
  // 2. 更新状态
  stateManager.setState({
    connected: true,
    lastConnectTime: Date.now(),
  });
  
  // 3. 同步代理列表
  const proxies = await api.getProxies();
  stateManager.setState({
    proxies: proxies.proxies,
  });
  
  console.log('Connected to agent successfully');
}
```

### 3.3 定时任务启动

```javascript
// modules/scheduler.js

class TaskScheduler {
  start() {
    // 1. 状态同步任务（每 10 秒）
    chrome.alarms.create('sync-status', {
      periodInMinutes: 10 / 60
    });
    
    // 2. 流量统计任务（每 5 秒）
    chrome.alarms.create('sync-traffic', {
      periodInMinutes: 5 / 60
    });
    
    // 3. 健康检查任务（每 30 秒）
    chrome.alarms.create('health-check', {
      periodInMinutes: 30 / 60
    });
    
    console.log('Scheduler started');
  }
  
  stop() {
    chrome.alarms.clearAll();
    console.log('Scheduler stopped');
  }
}

// 监听定时任务
chrome.alarms.onAlarm.addListener(async (alarm) => {
  try {
    await scheduler.handle(alarm);
  } catch (error) {
    console.error(`Task ${alarm.name} failed:`, error);
  }
});
```

## 4. 优雅关闭流程

### 4.1 Agent 关闭

```go
func (app *Application) Stop() error {
    log.Info("Stopping application")
    
    // 1. 发送取消信号
    app.cancel()
    
    // 2. 等待所有 goroutine 退出（最多 30 秒）
    done := make(chan struct{})
    go func() {
        app.wg.Wait()
        close(done)
    }()
    
    select {
    case <-done:
        log.Info("All goroutines stopped")
    case <-time.After(30 * time.Second):
        log.Warn("Timeout waiting for goroutines to stop")
    }
    
    // 3. 关闭 API Server
    log.Info("Stopping API Server")
    if err := app.apiServer.Shutdown(context.Background()); err != nil {
        log.Error("Failed to shutdown API server", zap.Error(err))
    }
    
    // 4. 关闭订阅管理器
    log.Info("Stopping Subscription Manager")
    if err := app.subManager.Stop(); err != nil {
        log.Error("Failed to stop subscription manager", zap.Error(err))
    }
    
    // 5. 关闭 Core Manager
    log.Info("Stopping Core Manager")
    if err := app.coreManager.Stop(); err != nil {
        log.Error("Failed to stop core manager", zap.Error(err))
    }
    
    // 6. 关闭存储
    log.Info("Closing storage")
    if err := app.storage.Close(); err != nil {
        log.Error("Failed to close storage", zap.Error(err))
    }
    
    log.Info("Application stopped successfully")
    return nil
}
```

### 4.2 API Server 优雅关闭

```go
func (s *Server) Shutdown(ctx context.Context) error {
    log.Info("Shutting down API server")
    
    // 1. 停止接收新请求
    ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
    defer cancel()
    
    // 2. 等待现有请求完成
    if err := s.server.Shutdown(ctx); err != nil {
        return fmt.Errorf("server shutdown error: %w", err)
    }
    
    log.Info("API server shutdown complete")
    return nil
}
```

### 4.3 Core 优雅关闭

```go
func (m *Manager) stopCore() error {
    m.mu.Lock()
    cmd := m.cmd
    m.mu.Unlock()
    
    if cmd == nil || cmd.Process == nil {
        return nil
    }
    
    log.Info("Stopping Core process", zap.Int("pid", cmd.Process.Pid))
    
    // 1. 发送 SIGTERM（Windows 使用 os.Interrupt）
    if err := cmd.Process.Signal(os.Interrupt); err != nil {
        log.Warn("Failed to send interrupt signal", zap.Error(err))
    }
    
    // 2. 等待进程退出（最多 5 秒）
    done := make(chan error, 1)
    go func() {
        done <- cmd.Wait()
    }()
    
    select {
    case err := <-done:
        if err != nil {
            log.Warn("Core process exited with error", zap.Error(err))
        } else {
            log.Info("Core process stopped gracefully")
        }
        m.mu.Lock()
        m.status = StatusStopped
        m.mu.Unlock()
        return nil
        
    case <-time.After(5 * time.Second):
        // 3. 超时则强制杀死
        log.Warn("Core process did not stop gracefully, killing")
        if err := cmd.Process.Kill(); err != nil {
            return fmt.Errorf("failed to kill core process: %w", err)
        }
        m.mu.Lock()
        m.status = StatusStopped
        m.mu.Unlock()
        return nil
    }
}
```

### 4.4 Extension 关闭

```javascript
// Extension 没有显式的关闭流程，但可以清理资源

// 监听浏览器关闭前
chrome.runtime.onSuspend.addListener(async () => {
  console.log('Extension suspending');
  
  // 1. 停止定时任务
  scheduler.stop();
  
  // 2. 保存状态
  await stateManager.persist();
  
  // 3. 清理缓存
  // ...
  
  console.log('Extension cleanup complete');
});
```

## 5. 崩溃恢复流程

### 5.1 Core 崩溃恢复

```go
func (m *Manager) monitorCore() {
    defer m.wg.Done()
    
    // 等待进程退出
    err := m.cmd.Wait()
    
    m.mu.Lock()
    exitCode := m.cmd.ProcessState.ExitCode()
    m.status = StatusStopped
    m.mu.Unlock()
    
    if err != nil {
        log.Error("Core process exited unexpectedly",
            zap.Error(err),
            zap.Int("exit_code", exitCode))
    }
    
    // 检查是否应该重启
    select {
    case <-m.ctx.Done():
        // 正常关闭，不重启
        return
    default:
        // 异常退出，尝试重启
        m.restartCore()
    }
}

func (m *Manager) restartCore() {
    m.mu.Lock()
    m.restartCount++
    count := m.restartCount
    m.mu.Unlock()
    
    // 限流检查
    if !m.restartLimiter.Allow() {
        log.Error("Core restart rate limit exceeded")
        return
    }
    
    log.Info("Restarting Core", zap.Int("restart_count", count))
    
    // 指数退避
    backoff := time.Duration(math.Min(float64(count), 5)) * time.Second
    time.Sleep(backoff)
    
    // 重新启动
    if err := m.startCore(); err != nil {
        log.Error("Failed to restart Core", zap.Error(err))
        return
    }
    
    // 重新启动监控
    m.wg.Add(1)
    go m.monitorCore()
}
```

### 5.2 Agent 崩溃恢复

```
Windows 服务方式运行时，系统会自动重启
手动运行时，需要外部监控工具（如 supervisor）
```

### 5.3 Extension 崩溃恢复

```javascript
// Service Worker 崩溃后会自动重启
// 需要在启动时恢复状态

chrome.runtime.onStartup.addListener(async () => {
  // 恢复状态
  await stateManager.restore();
  
  // 重新连接 Agent
  try {
    await connectToAgent();
  } catch (error) {
    console.error('Failed to reconnect:', error);
    // 设置重试
    setTimeout(connectToAgent, 5000);
  }
});
```

## 6. 状态持久化

### 6.1 Agent 状态持久化

```go
func (s *Storage) SaveState(state *State) error {
    data, err := json.MarshalIndent(state, "", "  ")
    if err != nil {
        return err
    }
    
    // 原子性写入
    tmpFile := s.stateFile + ".tmp"
    if err := os.WriteFile(tmpFile, data, 0644); err != nil {
        return err
    }
    
    if err := os.Rename(tmpFile, s.stateFile); err != nil {
        os.Remove(tmpFile)
        return err
    }
    
    return nil
}

func (s *Storage) LoadState() (*State, error) {
    data, err := os.ReadFile(s.stateFile)
    if err != nil {
        if os.IsNotExist(err) {
            return &State{}, nil
        }
        return nil, err
    }
    
    var state State
    if err := json.Unmarshal(data, &state); err != nil {
        return nil, err
    }
    
    return &state, nil
}
```

### 6.2 Extension 状态持久化

```javascript
// modules/state.js

class StateManager {
  async persist() {
    await chrome.storage.local.set({
      state: this.state,
      timestamp: Date.now()
    });
  }
  
  async restore() {
    const result = await chrome.storage.local.get(['state', 'timestamp']);
    
    if (result.state) {
      this.state = result.state;
      console.log('State restored from', new Date(result.timestamp));
    } else {
      console.log('No saved state found, using defaults');
      this.state = this.getDefaultState();
    }
  }
  
  getDefaultState() {
    return {
      connected: false,
      proxyEnabled: false,
      currentGroup: 'GLOBAL',
      currentProxy: null,
      proxies: {},
      traffic: {
        upload: 0,
        download: 0
      }
    };
  }
}
```

## 7. 健康检查机制

### 7.1 多层健康检查

```
1. 进程级别
   - 检查进程是否存在
   - 检查进程是否响应

2. API 级别
   - 检查 API 端点可用性
   - 检查响应时间

3. 功能级别
   - 检查代理功能是否正常
   - 检查配置是否有效
```

### 7.2 健康检查实现

```go
type HealthChecker struct {
    coreManager *core.Manager
    apiServer   *api.Server
}

func (h *HealthChecker) Check(ctx context.Context) *HealthStatus {
    status := &HealthStatus{
        Timestamp: time.Now(),
    }
    
    // 1. 检查 Core
    if err := h.coreManager.HealthCheck(ctx); err != nil {
        status.Core = "unhealthy"
        status.CoreError = err.Error()
    } else {
        status.Core = "healthy"
    }
    
    // 2. 检查 API Server
    if h.apiServer.IsRunning() {
        status.API = "healthy"
    } else {
        status.API = "unhealthy"
    }
    
    // 3. 整体状态
    if status.Core == "healthy" && status.API == "healthy" {
        status.Overall = "healthy"
    } else {
        status.Overall = "unhealthy"
    }
    
    return status
}
```

## 8. 日志记录

### 8.1 启动日志

```
[2026-02-22 10:00:00] [INFO] Starting Proxy Agent v1.0.0
[2026-02-22 10:00:00] [INFO] Loading config from config.yaml
[2026-02-22 10:00:00] [INFO] Config loaded successfully
[2026-02-22 10:00:01] [INFO] Initializing logger
[2026-02-22 10:00:01] [INFO] Starting Core Manager
[2026-02-22 10:00:01] [INFO] Starting Core process: clash.exe
[2026-02-22 10:00:02] [INFO] Core process started, PID: 12345
[2026-02-22 10:00:03] [INFO] Core is ready
[2026-02-22 10:00:03] [INFO] Starting API Server on 127.0.0.1:8765
[2026-02-22 10:00:03] [INFO] API Server is ready
[2026-02-22 10:00:03] [INFO] All components started successfully
```

### 8.2 关闭日志

```
[2026-02-22 18:00:00] [INFO] Received shutdown signal: interrupt
[2026-02-22 18:00:00] [INFO] Stopping application
[2026-02-22 18:00:00] [INFO] Stopping API Server
[2026-02-22 18:00:01] [INFO] API Server stopped
[2026-02-22 18:00:01] [INFO] Stopping Core Manager
[2026-02-22 18:00:01] [INFO] Stopping Core process, PID: 12345
[2026-02-22 18:00:02] [INFO] Core process stopped gracefully
[2026-02-22 18:00:02] [INFO] All goroutines stopped
[2026-02-22 18:00:02] [INFO] Application stopped successfully
```
