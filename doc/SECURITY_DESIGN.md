# 安全边界设计文档

## 1. 威胁模型分析

### 1.1 攻击面识别

#### 1.1.1 本地攻击面

```
1. localhost API (127.0.0.1:8765)
   - 同机器上的任何进程都可以访问
   - 恶意软件可以调用 API
   - 浏览器其他扩展可能访问

2. 配置文件
   - 包含敏感信息（订阅 URL、密码等）
   - 文件权限不当可能被读取
   - 配置文件可能被篡改

3. 日志文件
   - 可能包含敏感信息
   - 日志文件权限问题
   - 日志注入攻击

4. 进程间通信
   - Agent 与 Core 通信
   - 可能被中间人攻击
```

#### 1.1.2 网络攻击面

```
1. 订阅更新
   - HTTP 订阅可能被劫持
   - 恶意订阅内容
   - DNS 劫持

2. 测速请求
   - 测速 URL 可能被篡改
   - 恶意响应

3. Core 外部连接
   - 代理流量可能被监听
   - 中间人攻击
```

### 1.2 威胁等级评估

| 威胁 | 等级 | 影响 | 可能性 |
|------|------|------|--------|
| 本地恶意软件调用 API | 高 | 控制代理设置 | 中 |
| 配置文件泄露 | 中 | 订阅信息泄露 | 低 |
| 订阅劫持 | 高 | 注入恶意节点 | 中 |
| CSRF 攻击 | 中 | 未授权操作 | 中 |
| 端口扫描 | 低 | 服务发现 | 高 |
| 日志注入 | 低 | 日志污染 | 低 |

## 2. Localhost API 安全

### 2.1 当前风险

```
风险 1: 任何本地进程都可以访问
- 恶意软件可以切换代理
- 恶意软件可以获取节点信息
- 恶意软件可以修改配置

风险 2: 浏览器跨域访问
- 其他网站可能通过 XHR 访问
- 其他扩展可能访问 API

风险 3: 无认证机制
- 任何请求都会被处理
- 无法区分合法和非法请求
```

### 2.2 基础防护措施

#### 2.2.1 CORS 限制

```go
func CORSMiddleware() gin.HandlerFunc {
    return func(c *gin.Context) {
        origin := c.Request.Header.Get("Origin")
        
        // 只允许 Chrome Extension
        if strings.HasPrefix(origin, "chrome-extension://") {
            c.Header("Access-Control-Allow-Origin", origin)
            c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH")
            c.Header("Access-Control-Allow-Headers", "Content-Type, Authorization")
            c.Header("Access-Control-Max-Age", "3600")
        } else {
            // 拒绝其他来源
            c.AbortWithStatusJSON(http.StatusForbidden, Response{
                Code:    40301,
                Message: "Forbidden: Invalid origin",
            })
            return
        }
        
        if c.Request.Method == "OPTIONS" {
            c.AbortWithStatus(http.StatusNoContent)
            return
        }
        
        c.Next()
    }
}
```

#### 2.2.2 User-Agent 验证

```go
func ValidateUserAgent() gin.HandlerFunc {
    return func(c *gin.Context) {
        ua := c.Request.Header.Get("User-Agent")
        
        // 检查是否来自 Chrome Extension
        if !strings.Contains(ua, "Chrome") {
            c.AbortWithStatusJSON(http.StatusForbidden, Response{
                Code:    40302,
                Message: "Forbidden: Invalid user agent",
            })
            return
        }
        
        c.Next()
    }
}
```

#### 2.2.3 请求频率限制

```go
import "golang.org/x/time/rate"

type IPRateLimiter struct {
    limiters sync.Map
    rate     rate.Limit
    burst    int
}

func NewIPRateLimiter(rps int, burst int) *IPRateLimiter {
    return &IPRateLimiter{
        rate:  rate.Limit(rps),
        burst: burst,
    }
}

func (rl *IPRateLimiter) getLimiter(ip string) *rate.Limiter {
    val, ok := rl.limiters.Load(ip)
    if !ok {
        limiter := rate.NewLimiter(rl.rate, rl.burst)
        rl.limiters.Store(ip, limiter)
        return limiter
    }
    return val.(*rate.Limiter)
}

func (rl *IPRateLimiter) Middleware() gin.HandlerFunc {
    return func(c *gin.Context) {
        ip := c.ClientIP()
        limiter := rl.getLimiter(ip)
        
        if !limiter.Allow() {
            c.AbortWithStatusJSON(http.StatusTooManyRequests, Response{
                Code:    42901,
                Message: "Too many requests",
            })
            return
        }
        
        c.Next()
    }
}
```

### 2.3 Token 认证机制

#### 2.3.1 Token 生成

```go
import "crypto/rand"
import "encoding/hex"

type TokenManager struct {
    token     string
    tokenFile string
    mu        sync.RWMutex
}

func NewTokenManager(tokenFile string) (*TokenManager, error) {
    tm := &TokenManager{
        tokenFile: tokenFile,
    }
    
    // 尝试从文件加载
    if err := tm.loadToken(); err != nil {
        // 生成新 token
        if err := tm.generateToken(); err != nil {
            return nil, err
        }
    }
    
    return tm, nil
}

func (tm *TokenManager) generateToken() error {
    tm.mu.Lock()
    defer tm.mu.Unlock()
    
    // 生成 32 字节随机 token
    bytes := make([]byte, 32)
    if _, err := rand.Read(bytes); err != nil {
        return err
    }
    
    tm.token = hex.EncodeToString(bytes)
    
    // 保存到文件
    return tm.saveToken()
}

func (tm *TokenManager) saveToken() error {
    return os.WriteFile(tm.tokenFile, []byte(tm.token), 0600)
}

func (tm *TokenManager) loadToken() error {
    data, err := os.ReadFile(tm.tokenFile)
    if err != nil {
        return err
    }
    
    tm.mu.Lock()
    tm.token = string(data)
    tm.mu.Unlock()
    
    return nil
}

func (tm *TokenManager) GetToken() string {
    tm.mu.RLock()
    defer tm.mu.RUnlock()
    return tm.token
}

func (tm *TokenManager) ValidateToken(token string) bool {
    tm.mu.RLock()
    defer tm.mu.RUnlock()
    return token == tm.token
}
```

#### 2.3.2 Token 认证中间件

```go
func (tm *TokenManager) AuthMiddleware() gin.HandlerFunc {
    return func(c *gin.Context) {
        // 从 Header 获取 token
        token := c.GetHeader("Authorization")
        if token == "" {
            c.AbortWithStatusJSON(http.StatusUnauthorized, Response{
                Code:    40101,
                Message: "Unauthorized: Missing token",
            })
            return
        }
        
        // 移除 "Bearer " 前缀
        token = strings.TrimPrefix(token, "Bearer ")
        
        // 验证 token
        if !tm.ValidateToken(token) {
            c.AbortWithStatusJSON(http.StatusUnauthorized, Response{
                Code:    40102,
                Message: "Unauthorized: Invalid token",
            })
            return
        }
        
        c.Next()
    }
}
```

#### 2.3.3 Extension 中使用 Token

```javascript
// background.js
class AgentAPI {
  constructor(baseURL) {
    this.baseURL = baseURL;
    this.token = null;
  }
  
  async loadToken() {
    // 从 storage 读取 token
    const result = await chrome.storage.local.get('apiToken');
    this.token = result.apiToken;
  }
  
  async request(method, path, data = null) {
    if (!this.token) {
      await this.loadToken();
    }
    
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`
      }
    };
    
    if (data) {
      options.body = JSON.stringify(data);
    }
    
    const response = await fetch(`${this.baseURL}${path}`, options);
    
    if (response.status === 401) {
      // Token 无效，需要重新配置
      throw new Error('Invalid API token');
    }
    
    return response.json();
  }
}
```

### 2.4 防止 CSRF

#### 2.4.1 CSRF Token

```go
type CSRFManager struct {
    tokens sync.Map
    ttl    time.Duration
}

type CSRFToken struct {
    Token     string
    ExpiresAt time.Time
}

func NewCSRFManager(ttl time.Duration) *CSRFManager {
    return &CSRFManager{
        ttl: ttl,
    }
}

func (cm *CSRFManager) GenerateToken() string {
    token := generateRandomString(32)
    
    cm.tokens.Store(token, CSRFToken{
        Token:     token,
        ExpiresAt: time.Now().Add(cm.ttl),
    })
    
    return token
}

func (cm *CSRFManager) ValidateToken(token string) bool {
    val, ok := cm.tokens.Load(token)
    if !ok {
        return false
    }
    
    csrfToken := val.(CSRFToken)
    if time.Now().After(csrfToken.ExpiresAt) {
        cm.tokens.Delete(token)
        return false
    }
    
    // 一次性使用
    cm.tokens.Delete(token)
    return true
}

func (cm *CSRFManager) Middleware() gin.HandlerFunc {
    return func(c *gin.Context) {
        // 只对修改操作检查 CSRF
        if c.Request.Method != "GET" && c.Request.Method != "HEAD" {
            token := c.GetHeader("X-CSRF-Token")
            if token == "" || !cm.ValidateToken(token) {
                c.AbortWithStatusJSON(http.StatusForbidden, Response{
                    Code:    40303,
                    Message: "Forbidden: Invalid CSRF token",
                })
                return
            }
        }
        
        c.Next()
    }
}
```

#### 2.4.2 SameSite Cookie（未来扩展）

```go
// 如果使用 Cookie 认证
func SetSecureCookie(c *gin.Context, name, value string) {
    c.SetCookie(
        name,
        value,
        3600,           // maxAge
        "/",            // path
        "localhost",    // domain
        false,          // secure (localhost 不需要 HTTPS)
        true,           // httpOnly
    )
    
    // 手动设置 SameSite
    c.Header("Set-Cookie", fmt.Sprintf("%s=%s; Path=/; HttpOnly; SameSite=Strict", name, value))
}
```

### 2.5 防止端口扫描

#### 2.5.1 随机端口（可选）

```go
func findAvailablePort(start, end int) (int, error) {
    for port := start; port <= end; port++ {
        addr := fmt.Sprintf("127.0.0.1:%d", port)
        listener, err := net.Listen("tcp", addr)
        if err == nil {
            listener.Close()
            return port, nil
        }
    }
    return 0, errors.New("no available port found")
}

// 使用随机端口
port, err := findAvailablePort(8765, 8800)
if err != nil {
    return err
}

// 保存端口到配置文件供 Extension 读取
```

#### 2.5.2 端口隐藏

```go
// 不在标准端口运行
// 不响应未认证的请求
// 不返回详细的错误信息

func HideServerInfo() gin.HandlerFunc {
    return func(c *gin.Context) {
        // 移除服务器信息
        c.Header("Server", "")
        c.Next()
    }
}
```

## 3. 配置文件安全

### 3.1 文件权限

```go
func SaveConfigSecurely(path string, data []byte) error {
    // 创建临时文件
    tmpFile := path + ".tmp"
    
    // 写入数据
    if err := os.WriteFile(tmpFile, data, 0600); err != nil {
        return err
    }
    
    // 原子性重命名
    if err := os.Rename(tmpFile, path); err != nil {
        os.Remove(tmpFile)
        return err
    }
    
    return nil
}

func LoadConfigSecurely(path string) ([]byte, error) {
    // 检查文件权限
    info, err := os.Stat(path)
    if err != nil {
        return nil, err
    }
    
    // Windows 权限检查
    if runtime.GOOS == "windows" {
        // 检查文件所有者
        // 实现略...
    }
    
    return os.ReadFile(path)
}
```

### 3.2 敏感信息加密

```go
import "crypto/aes"
import "crypto/cipher"

type ConfigEncryptor struct {
    key []byte
}

func NewConfigEncryptor(password string) (*ConfigEncryptor, error) {
    // 从密码派生密钥
    key := pbkdf2.Key([]byte(password), []byte("salt"), 10000, 32, sha256.New)
    
    return &ConfigEncryptor{
        key: key,
    }, nil
}

func (e *ConfigEncryptor) Encrypt(plaintext []byte) ([]byte, error) {
    block, err := aes.NewCipher(e.key)
    if err != nil {
        return nil, err
    }
    
    gcm, err := cipher.NewGCM(block)
    if err != nil {
        return nil, err
    }
    
    nonce := make([]byte, gcm.NonceSize())
    if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
        return nil, err
    }
    
    ciphertext := gcm.Seal(nonce, nonce, plaintext, nil)
    return ciphertext, nil
}

func (e *ConfigEncryptor) Decrypt(ciphertext []byte) ([]byte, error) {
    block, err := aes.NewCipher(e.key)
    if err != nil {
        return nil, err
    }
    
    gcm, err := cipher.NewGCM(block)
    if err != nil {
        return nil, err
    }
    
    nonceSize := gcm.NonceSize()
    if len(ciphertext) < nonceSize {
        return nil, errors.New("ciphertext too short")
    }
    
    nonce, ciphertext := ciphertext[:nonceSize], ciphertext[nonceSize:]
    plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
    if err != nil {
        return nil, err
    }
    
    return plaintext, nil
}
```

### 3.3 配置验证

```go
func ValidateConfig(cfg *Config) error {
    // 验证订阅 URL
    for _, sub := range cfg.Subscriptions {
        if !isValidURL(sub.URL) {
            return fmt.Errorf("invalid subscription URL: %s", sub.URL)
        }
        
        // 只允许 HTTPS
        if !strings.HasPrefix(sub.URL, "https://") {
            return fmt.Errorf("subscription URL must use HTTPS: %s", sub.URL)
        }
    }
    
    // 验证端口范围
    if cfg.Port < 1024 || cfg.Port > 65535 {
        return errors.New("invalid port number")
    }
    
    return nil
}

func isValidURL(urlStr string) bool {
    u, err := url.Parse(urlStr)
    if err != nil {
        return false
    }
    
    if u.Scheme != "http" && u.Scheme != "https" {
        return false
    }
    
    return true
}
```

## 4. 订阅安全

### 4.1 HTTPS 强制

```go
func (m *SubscriptionManager) Update(ctx context.Context, id string) error {
    sub, err := m.getSubscription(id)
    if err != nil {
        return err
    }
    
    // 强制使用 HTTPS
    if !strings.HasPrefix(sub.URL, "https://") {
        return errors.New("subscription URL must use HTTPS")
    }
    
    // 下载订阅内容...
}
```

### 4.2 内容验证

```go
func (m *SubscriptionManager) parseSubscription(content []byte) ([]ProxyNode, error) {
    // Base64 解码
    decoded, err := base64.StdEncoding.DecodeString(string(content))
    if err != nil {
        return nil, fmt.Errorf("invalid base64 encoding: %w", err)
    }
    
    // 大小限制
    if len(decoded) > 10*1024*1024 {  // 10MB
        return nil, errors.New("subscription content too large")
    }
    
    // 解析节点
    nodes := make([]ProxyNode, 0)
    lines := strings.Split(string(decoded), "\n")
    
    for _, line := range lines {
        line = strings.TrimSpace(line)
        if line == "" {
            continue
        }
        
        // 验证节点格式
        node, err := parseProxyLine(line)
        if err != nil {
            log.Warn("Invalid proxy line", zap.String("line", line), zap.Error(err))
            continue
        }
        
        // 验证节点内容
        if err := validateProxyNode(node); err != nil {
            log.Warn("Invalid proxy node", zap.Any("node", node), zap.Error(err))
            continue
        }
        
        nodes = append(nodes, node)
    }
    
    return nodes, nil
}

func validateProxyNode(node ProxyNode) error {
    // 验证服务器地址
    if node.Server == "" {
        return errors.New("server is required")
    }
    
    // 禁止本地地址
    if isLocalAddress(node.Server) {
        return errors.New("local address not allowed")
    }
    
    // 验证端口
    if node.Port < 1 || node.Port > 65535 {
        return errors.New("invalid port")
    }
    
    // 验证协议类型
    validTypes := map[string]bool{
        "ss": true, "ssr": true, "vmess": true, "trojan": true,
    }
    if !validTypes[node.Type] {
        return errors.New("invalid proxy type")
    }
    
    return nil
}

func isLocalAddress(addr string) bool {
    // 检查是否为本地地址
    localAddrs := []string{
        "localhost", "127.0.0.1", "::1",
        "0.0.0.0", "192.168.", "10.", "172.16.",
    }
    
    for _, local := range localAddrs {
        if strings.Contains(addr, local) {
            return true
        }
    }
    
    return false
}
```

### 4.3 下载超时和重试

```go
func (m *SubscriptionManager) downloadSubscription(ctx context.Context, url string) ([]byte, error) {
    ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
    defer cancel()
    
    var lastErr error
    for i := 0; i < 3; i++ {
        content, err := m.doDownload(ctx, url)
        if err == nil {
            return content, nil
        }
        
        lastErr = err
        
        // 指数退避
        backoff := time.Duration(math.Pow(2, float64(i))) * time.Second
        select {
        case <-time.After(backoff):
        case <-ctx.Done():
            return nil, ctx.Err()
        }
    }
    
    return nil, fmt.Errorf("download failed after 3 retries: %w", lastErr)
}

func (m *SubscriptionManager) doDownload(ctx context.Context, url string) ([]byte, error) {
    req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
    if err != nil {
        return nil, err
    }
    
    // 设置 User-Agent
    req.Header.Set("User-Agent", "ProxyManager/1.0")
    
    resp, err := m.client.Do(req)
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()
    
    if resp.StatusCode != http.StatusOK {
        return nil, fmt.Errorf("unexpected status code: %d", resp.StatusCode)
    }
    
    // 限制读取大小
    limitedReader := io.LimitReader(resp.Body, 10*1024*1024)  // 10MB
    content, err := io.ReadAll(limitedReader)
    if err != nil {
        return nil, err
    }
    
    return content, nil
}
```

## 5. 日志安全

### 5.1 敏感信息过滤

```go
type SensitiveFilter struct {
    patterns []*regexp.Regexp
}

func NewSensitiveFilter() *SensitiveFilter {
    return &SensitiveFilter{
        patterns: []*regexp.Regexp{
            regexp.MustCompile(`password=\S+`),
            regexp.MustCompile(`token=\S+`),
            regexp.MustCompile(`secret=\S+`),
            regexp.MustCompile(`\d{15,19}`),  // 信用卡号
        },
    }
}

func (f *SensitiveFilter) Filter(message string) string {
    for _, pattern := range f.patterns {
        message = pattern.ReplaceAllString(message, "[REDACTED]")
    }
    return message
}

// 在日志记录时使用
func LogSafely(message string, fields ...zap.Field) {
    filtered := sensitiveFilter.Filter(message)
    log.Info(filtered, fields...)
}
```

### 5.2 日志文件权限

```go
func setupLogger(logFile string) (*zap.Logger, error) {
    // 确保日志目录存在
    logDir := filepath.Dir(logFile)
    if err := os.MkdirAll(logDir, 0700); err != nil {
        return nil, err
    }
    
    // 创建日志文件（只有所有者可读写）
    file, err := os.OpenFile(logFile, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0600)
    if err != nil {
        return nil, err
    }
    file.Close()
    
    // 配置 zap
    cfg := zap.NewProductionConfig()
    cfg.OutputPaths = []string{logFile}
    
    return cfg.Build()
}
```

## 6. 未来安全升级路径

### 6.1 短期（MVP 后）

```
1. 实现 Token 认证
   - 生成和管理 API Token
   - Extension 配置 Token
   - 强制 Token 验证

2. 增强 CORS 策略
   - 白名单 Extension ID
   - 拒绝非 Extension 请求

3. 配置文件加密
   - 敏感字段加密存储
   - 密钥管理
```

### 6.2 中期

```
1. 证书固定（Certificate Pinning）
   - 订阅 URL 证书验证
   - 防止中间人攻击

2. 审计日志
   - 记录所有敏感操作
   - 操作来源追踪
   - 异常行为检测

3. 权限细分
   - 只读 Token
   - 管理员 Token
   - 操作权限控制
```

### 6.3 长期

```
1. 多因素认证
   - 生物识别
   - 硬件密钥

2. 加密通信
   - Agent 与 Core 加密通信
   - 本地 TLS

3. 沙箱隔离
   - Core 进程隔离
   - 最小权限原则
```

## 7. 安全检查清单

### 7.1 开发阶段

```
□ 所有 API 端点都有认证
□ 输入验证完整
□ 错误信息不泄露敏感信息
□ 日志不包含敏感信息
□ 配置文件权限正确
□ 依赖库无已知漏洞
```

### 7.2 测试阶段

```
□ 渗透测试
□ 模糊测试
□ 依赖扫描
□ 代码审计
□ 权限测试
```

### 7.3 部署阶段

```
□ 生产环境使用 HTTPS 订阅
□ Token 已配置
□ 日志级别适当
□ 文件权限正确
□ 防火墙规则配置
```

## 8. 应急响应

### 8.1 安全事件处理

```
1. 检测
   - 监控异常 API 调用
   - 监控配置文件变化
   - 监控进程异常

2. 响应
   - 立即禁用受影响功能
   - 记录详细日志
   - 通知用户

3. 恢复
   - 修复漏洞
   - 更新版本
   - 重置 Token
```

### 8.2 漏洞披露

```
1. 建立安全邮箱
2. 制定披露流程
3. 及时修复和发布
4. 通知用户更新
```
