# 并发与性能设计文档

## 1. Goroutine 管理策略

### 1.1 Goroutine 使用原则

#### 1.1.1 受控启动

```go
// ❌ 错误：裸启动 goroutine
go someFunction()

// ✅ 正确：使用 context 和 WaitGroup
func (s *Service) Start(ctx context.Context) error {
    var wg sync.WaitGroup
    
    wg.Add(1)
    go func() {
        defer wg.Done()
        s.worker(ctx)
    }()
    
    // 等待 context 取消
    <-ctx.Done()
    wg.Wait()
    return nil
}
```

#### 1.1.2 Goroutine 池模式

```go
type WorkerPool struct {
    workers   int
    taskQueue chan Task
    wg        sync.WaitGroup
    ctx       context.Context
    cancel    context.CancelFunc
}

func NewWorkerPool(workers int) *WorkerPool {
    ctx, cancel := context.WithCancel(context.Background())
    return &WorkerPool{
        workers:   workers,
        taskQueue: make(chan Task, workers*2),
        ctx:       ctx,
        cancel:    cancel,
    }
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
            p.processTask(task)
        case <-p.ctx.Done():
            return
        }
    }
}

func (p *WorkerPool) Submit(task Task) error {
    select {
    case p.taskQueue <- task:
        return nil
    case <-p.ctx.Done():
        return errors.New("worker pool is closed")
    default:
        return errors.New("task queue is full")
    }
}

func (p *WorkerPool) Stop() {
    p.cancel()
    p.wg.Wait()
    close(p.taskQueue)
}
```

### 1.2 Goroutine 生命周期管理

#### 1.2.1 启动阶段

```go
type Service struct {
    ctx    context.Context
    cancel context.CancelFunc
    wg     sync.WaitGroup
    
    // 子服务
    coreManager    *core.Manager
    apiServer      *api.Server
    subManager     *subscription.Manager
}

func (s *Service) Start() error {
    s.ctx, s.cancel = context.WithCancel(context.Background())
    
    // 启动 Core 管理器
    s.wg.Add(1)
    go func() {
        defer s.wg.Done()
        if err := s.coreManager.Run(s.ctx); err != nil {
            log.Error("Core manager error", zap.Error(err))
        }
    }()
    
    // 启动 API 服务器
    s.wg.Add(1)
    go func() {
        defer s.wg.Done()
        if err := s.apiServer.Run(s.ctx); err != nil {
            log.Error("API server error", zap.Error(err))
        }
    }()
    
    // 启动订阅管理器
    s.wg.Add(1)
    go func() {
        defer s.wg.Done()
        if err := s.subManager.Run(s.ctx); err != nil {
            log.Error("Subscription manager error", zap.Error(err))
        }
    }()
    
    return nil
}
```

#### 1.2.2 关闭阶段

```go
func (s *Service) Stop() error {
    // 发送取消信号
    s.cancel()
    
    // 等待所有 goroutine 退出（最多 30 秒）
    done := make(chan struct{})
    go func() {
        s.wg.Wait()
        close(done)
    }()
    
    select {
    case <-done:
        log.Info("All goroutines stopped gracefully")
    case <-time.After(30 * time.Second):
        log.Warn("Timeout waiting for goroutines to stop")
    }
    
    return nil
}
```

### 1.3 避免 Goroutine 泄露

#### 1.3.1 常见泄露场景

```go
// ❌ 场景 1：channel 阻塞导致泄露
func leak1() {
    ch := make(chan int)
    go func() {
        ch <- 1  // 永久阻塞，goroutine 泄露
    }()
}

// ✅ 修复：使用 buffered channel 或 select
func fixed1() {
    ch := make(chan int, 1)  // buffered
    go func() {
        ch <- 1  // 不会阻塞
    }()
}

// ❌ 场景 2：没有退出机制
func leak2() {
    go func() {
        for {
            // 无限循环，无法退出
            doWork()
            time.Sleep(time.Second)
        }
    }()
}

// ✅ 修复：使用 context
func fixed2(ctx context.Context) {
    go func() {
        ticker := time.NewTicker(time.Second)
        defer ticker.Stop()
        
        for {
            select {
            case <-ticker.C:
                doWork()
            case <-ctx.Done():
                return  // 正常退出
            }
        }
    }()
}

// ❌ 场景 3：HTTP 请求没有超时
func leak3() {
    go func() {
        resp, _ := http.Get("http://example.com")  // 可能永久阻塞
        defer resp.Body.Close()
    }()
}

// ✅ 修复：设置超时
func fixed3(ctx context.Context) {
    go func() {
        ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
        defer cancel()
        
        req, _ := http.NewRequestWithContext(ctx, "GET", "http://example.com", nil)
        resp, err := http.DefaultClient.Do(req)
        if err != nil {
            return
        }
        defer resp.Body.Close()
    }()
}
```

#### 1.3.2 泄露检测

```go
// 使用 runtime 检测 goroutine 数量
func monitorGoroutines() {
    ticker := time.NewTicker(10 * time.Second)
    defer ticker.Stop()
    
    for range ticker.C {
        count := runtime.NumGoroutine()
        log.Info("Goroutine count", zap.Int("count", count))
        
        if count > 1000 {
            log.Warn("Too many goroutines, possible leak")
        }
    }
}
```

## 2. Context 生命周期管理

### 2.1 Context 层级结构

```go
// 根 context
rootCtx, rootCancel := context.WithCancel(context.Background())

// API 请求 context（带超时）
apiCtx, apiCancel := context.WithTimeout(rootCtx, 30*time.Second)
defer apiCancel()

// 子任务 context
taskCtx, taskCancel := context.WithCancel(apiCtx)
defer taskCancel()
```

### 2.2 Context 传递规范

```go
// ✅ 正确：context 作为第一个参数
func ProcessRequest(ctx context.Context, req *Request) error {
    // 传递给下层
    return s.repository.Save(ctx, req.Data)
}

// ❌ 错误：context 作为结构体字段
type Service struct {
    ctx context.Context  // 不推荐
}
```

### 2.3 Context 超时控制

```go
// API 请求超时
func (c *CoreClient) GetProxies(ctx context.Context) (map[string]Proxy, error) {
    ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
    defer cancel()
    
    req, err := http.NewRequestWithContext(ctx, "GET", c.baseURL+"/proxies", nil)
    if err != nil {
        return nil, err
    }
    
    resp, err := c.client.Do(req)
    if err != nil {
        if ctx.Err() == context.DeadlineExceeded {
            return nil, errors.New("request timeout")
        }
        return nil, err
    }
    defer resp.Body.Close()
    
    // 解析响应...
    return proxies, nil
}
```

### 2.4 Context 取消传播

```go
func (s *Service) ProcessWithSubtasks(ctx context.Context) error {
    // 创建可取消的子 context
    subCtx, cancel := context.WithCancel(ctx)
    defer cancel()
    
    var wg sync.WaitGroup
    errCh := make(chan error, 3)
    
    // 启动多个子任务
    for i := 0; i < 3; i++ {
        wg.Add(1)
        go func(id int) {
            defer wg.Done()
            if err := s.subtask(subCtx, id); err != nil {
                errCh <- err
                cancel()  // 一个失败，取消所有
            }
        }(i)
    }
    
    // 等待完成或错误
    go func() {
        wg.Wait()
        close(errCh)
    }()
    
    // 收集错误
    for err := range errCh {
        if err != nil {
            return err
        }
    }
    
    return nil
}
```

## 3. 子进程守护机制

### 3.1 进程启动

```go
type ProcessManager struct {
    cmd        *exec.Cmd
    ctx        context.Context
    cancel     context.CancelFunc
    restartCh  chan struct{}
    
    executable string
    args       []string
    
    mu         sync.RWMutex
    pid        int
    status     ProcessStatus
    startTime  time.Time
    restartCount int
}

func (m *ProcessManager) Start(ctx context.Context) error {
    m.ctx, m.cancel = context.WithCancel(ctx)
    m.restartCh = make(chan struct{}, 1)
    
    // 首次启动
    if err := m.startProcess(); err != nil {
        return err
    }
    
    // 启动监控 goroutine
    go m.monitor()
    
    return nil
}

func (m *ProcessManager) startProcess() error {
    m.mu.Lock()
    defer m.mu.Unlock()
    
    // 创建命令
    m.cmd = exec.CommandContext(m.ctx, m.executable, m.args...)
    
    // 重定向输出
    m.cmd.Stdout = m.getLogWriter("stdout")
    m.cmd.Stderr = m.getLogWriter("stderr")
    
    // 启动进程
    if err := m.cmd.Start(); err != nil {
        return fmt.Errorf("failed to start process: %w", err)
    }
    
    m.pid = m.cmd.Process.Pid
    m.status = StatusRunning
    m.startTime = time.Now()
    
    log.Info("Process started",
        zap.Int("pid", m.pid),
        zap.String("executable", m.executable))
    
    return nil
}
```

### 3.2 进程监控

```go
func (m *ProcessManager) monitor() {
    // 等待进程退出
    go func() {
        err := m.cmd.Wait()
        
        m.mu.Lock()
        m.status = StatusStopped
        exitCode := m.cmd.ProcessState.ExitCode()
        m.mu.Unlock()
        
        if err != nil {
            log.Error("Process exited with error",
                zap.Error(err),
                zap.Int("exit_code", exitCode))
        }
        
        // 触发重启
        select {
        case m.restartCh <- struct{}{}:
        default:
        }
    }()
    
    // 重启循环
    limiter := rate.NewLimiter(rate.Every(time.Minute), 5)  // 最多 5 次/分钟
    
    for {
        select {
        case <-m.restartCh:
            if !limiter.Allow() {
                log.Error("Restart rate limit exceeded")
                continue
            }
            
            m.mu.Lock()
            m.restartCount++
            count := m.restartCount
            m.mu.Unlock()
            
            log.Info("Restarting process", zap.Int("restart_count", count))
            
            // 指数退避
            backoff := time.Duration(math.Min(float64(count), 5)) * time.Second
            time.Sleep(backoff)
            
            if err := m.startProcess(); err != nil {
                log.Error("Failed to restart process", zap.Error(err))
            }
            
        case <-m.ctx.Done():
            return
        }
    }
}
```

### 3.3 进程健康检查

```go
func (m *ProcessManager) HealthCheck(ctx context.Context) error {
    m.mu.RLock()
    pid := m.pid
    status := m.status
    m.mu.RUnlock()
    
    // 检查状态
    if status != StatusRunning {
        return errors.New("process is not running")
    }
    
    // 检查进程是否存在
    process, err := os.FindProcess(pid)
    if err != nil {
        return fmt.Errorf("process not found: %w", err)
    }
    
    // Windows: 发送信号 0 检查进程
    if err := process.Signal(syscall.Signal(0)); err != nil {
        return fmt.Errorf("process is dead: %w", err)
    }
    
    // 检查 API 可用性
    if err := m.checkAPI(ctx); err != nil {
        return fmt.Errorf("API check failed: %w", err)
    }
    
    return nil
}

func (m *ProcessManager) checkAPI(ctx context.Context) error {
    ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
    defer cancel()
    
    req, err := http.NewRequestWithContext(ctx, "GET", m.apiURL+"/version", nil)
    if err != nil {
        return err
    }
    
    resp, err := http.DefaultClient.Do(req)
    if err != nil {
        return err
    }
    defer resp.Body.Close()
    
    if resp.StatusCode != http.StatusOK {
        return fmt.Errorf("unexpected status code: %d", resp.StatusCode)
    }
    
    return nil
}
```

### 3.4 进程优雅关闭

```go
func (m *ProcessManager) Stop() error {
    m.cancel()  // 取消 context
    
    m.mu.RLock()
    cmd := m.cmd
    m.mu.RUnlock()
    
    if cmd == nil || cmd.Process == nil {
        return nil
    }
    
    // 发送 SIGTERM
    log.Info("Sending SIGTERM to process")
    if err := cmd.Process.Signal(os.Interrupt); err != nil {
        log.Warn("Failed to send SIGTERM", zap.Error(err))
    }
    
    // 等待 5 秒
    done := make(chan error, 1)
    go func() {
        done <- cmd.Wait()
    }()
    
    select {
    case <-done:
        log.Info("Process stopped gracefully")
        return nil
    case <-time.After(5 * time.Second):
        log.Warn("Process did not stop gracefully, killing")
        if err := cmd.Process.Kill(); err != nil {
            return fmt.Errorf("failed to kill process: %w", err)
        }
        return nil
    }
}
```

## 4. 测速并发模型

### 4.1 并发测速实现

```go
type SpeedTester struct {
    client     *http.Client
    workerPool *WorkerPool
    timeout    time.Duration
    testURL    string
}

func NewSpeedTester(workers int) *SpeedTester {
    return &SpeedTester{
        client: &http.Client{
            Timeout: 5 * time.Second,
        },
        workerPool: NewWorkerPool(workers),
        timeout:    5 * time.Second,
        testURL:    "http://www.gstatic.com/generate_204",
    }
}

func (t *SpeedTester) TestProxies(ctx context.Context, proxies []string) ([]DelayResult, error) {
    results := make([]DelayResult, len(proxies))
    var mu sync.Mutex
    var wg sync.WaitGroup
    
    // 启动 worker pool
    t.workerPool.Start()
    defer t.workerPool.Stop()
    
    // 提交测速任务
    for i, proxy := range proxies {
        wg.Add(1)
        
        index := i
        proxyName := proxy
        
        task := Task{
            Execute: func() error {
                defer wg.Done()
                
                result := t.testSingleProxy(ctx, proxyName)
                
                mu.Lock()
                results[index] = result
                mu.Unlock()
                
                return nil
            },
        }
        
        if err := t.workerPool.Submit(task); err != nil {
            wg.Done()
            results[index] = DelayResult{
                Proxy:   proxyName,
                Success: false,
                Error:   err.Error(),
            }
        }
    }
    
    // 等待所有任务完成
    done := make(chan struct{})
    go func() {
        wg.Wait()
        close(done)
    }()
    
    select {
    case <-done:
        return results, nil
    case <-ctx.Done():
        return results, ctx.Err()
    }
}

func (t *SpeedTester) testSingleProxy(ctx context.Context, proxy string) DelayResult {
    ctx, cancel := context.WithTimeout(ctx, t.timeout)
    defer cancel()
    
    start := time.Now()
    
    // 通过 Core 代理发起请求
    req, err := http.NewRequestWithContext(ctx, "GET", t.testURL, nil)
    if err != nil {
        return DelayResult{
            Proxy:    proxy,
            Success:  false,
            Error:    err.Error(),
            TestedAt: time.Now(),
        }
    }
    
    // 设置代理头（让 Core 使用指定节点）
    req.Header.Set("X-Proxy-Name", proxy)
    
    resp, err := t.client.Do(req)
    if err != nil {
        return DelayResult{
            Proxy:    proxy,
            Success:  false,
            Error:    err.Error(),
            TestedAt: time.Now(),
        }
    }
    defer resp.Body.Close()
    
    delay := time.Since(start).Milliseconds()
    
    return DelayResult{
        Proxy:    proxy,
        Delay:    int(delay),
        Success:  true,
        TestedAt: time.Now(),
    }
}
```

### 4.2 测速超时控制

```go
// 全局超时
func (t *SpeedTester) TestWithGlobalTimeout(ctx context.Context, proxies []string, timeout time.Duration) ([]DelayResult, error) {
    ctx, cancel := context.WithTimeout(ctx, timeout)
    defer cancel()
    
    return t.TestProxies(ctx, proxies)
}

// 单个节点超时
func (t *SpeedTester) testSingleProxy(ctx context.Context, proxy string) DelayResult {
    ctx, cancel := context.WithTimeout(ctx, t.timeout)
    defer cancel()
    
    // 测速逻辑...
}
```

### 4.3 测速结果缓存

```go
type DelayCache struct {
    cache sync.Map
    ttl   time.Duration
}

type CachedDelay struct {
    Result    DelayResult
    ExpiresAt time.Time
}

func (c *DelayCache) Get(proxy string) (DelayResult, bool) {
    val, ok := c.cache.Load(proxy)
    if !ok {
        return DelayResult{}, false
    }
    
    cached := val.(CachedDelay)
    if time.Now().After(cached.ExpiresAt) {
        c.cache.Delete(proxy)
        return DelayResult{}, false
    }
    
    return cached.Result, true
}

func (c *DelayCache) Set(proxy string, result DelayResult) {
    cached := CachedDelay{
        Result:    result,
        ExpiresAt: time.Now().Add(c.ttl),
    }
    c.cache.Store(proxy, cached)
}
```

## 5. 防止 API 阻塞

### 5.1 请求超时

```go
func (s *Server) setupRouter() *gin.Engine {
    r := gin.New()
    
    // 全局超时中间件
    r.Use(func(c *gin.Context) {
        ctx, cancel := context.WithTimeout(c.Request.Context(), 30*time.Second)
        defer cancel()
        
        c.Request = c.Request.WithContext(ctx)
        c.Next()
    })
    
    return r
}
```

### 5.2 异步处理

```go
// 长时间操作使用异步处理
func (h *Handler) UpdateSubscription(c *gin.Context) {
    id := c.Param("id")
    
    // 创建异步任务
    taskID := generateTaskID()
    
    go func() {
        ctx := context.Background()
        if err := h.subManager.Update(ctx, id); err != nil {
            log.Error("Subscription update failed", zap.Error(err))
        }
    }()
    
    // 立即返回任务 ID
    c.JSON(http.StatusAccepted, Response{
        Code: 0,
        Message: "Update task created",
        Data: map[string]string{
            "task_id": taskID,
        },
    })
}
```

### 5.3 请求限流

```go
import "golang.org/x/time/rate"

type RateLimiter struct {
    limiter *rate.Limiter
}

func NewRateLimiter(rps int) *RateLimiter {
    return &RateLimiter{
        limiter: rate.NewLimiter(rate.Limit(rps), rps*2),
    }
}

func (rl *RateLimiter) Middleware() gin.HandlerFunc {
    return func(c *gin.Context) {
        if !rl.limiter.Allow() {
            c.JSON(http.StatusTooManyRequests, Response{
                Code:    42901,
                Message: "Too many requests",
            })
            c.Abort()
            return
        }
        c.Next()
    }
}
```

## 6. 性能监控

### 6.1 指标收集

```go
type Metrics struct {
    goroutineCount   int64
    requestCount     int64
    errorCount       int64
    avgResponseTime  int64
}

func (m *Metrics) RecordRequest(duration time.Duration, err error) {
    atomic.AddInt64(&m.requestCount, 1)
    if err != nil {
        atomic.AddInt64(&m.errorCount, 1)
    }
    
    // 更新平均响应时间
    atomic.StoreInt64(&m.avgResponseTime, duration.Milliseconds())
}

func (m *Metrics) UpdateGoroutineCount() {
    atomic.StoreInt64(&m.goroutineCount, int64(runtime.NumGoroutine()))
}
```

### 6.2 性能分析

```go
import _ "net/http/pprof"

func startPprofServer() {
    go func() {
        log.Info("Starting pprof server on :6060")
        if err := http.ListenAndServe(":6060", nil); err != nil {
            log.Error("pprof server error", zap.Error(err))
        }
    }()
}
```

## 7. 内存管理

### 7.1 对象池

```go
var bufferPool = sync.Pool{
    New: func() interface{} {
        return new(bytes.Buffer)
    },
}

func processData(data []byte) {
    buf := bufferPool.Get().(*bytes.Buffer)
    defer func() {
        buf.Reset()
        bufferPool.Put(buf)
    }()
    
    buf.Write(data)
    // 处理数据...
}
```

### 7.2 定期 GC

```go
func startGCScheduler() {
    ticker := time.NewTicker(5 * time.Minute)
    defer ticker.Stop()
    
    for range ticker.C {
        var m runtime.MemStats
        runtime.ReadMemStats(&m)
        
        if m.Alloc > 500*1024*1024 {  // 超过 500MB
            log.Info("Triggering GC", zap.Uint64("alloc_mb", m.Alloc/1024/1024))
            runtime.GC()
        }
    }
}
```
