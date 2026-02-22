# 数据模型设计文档

## 1. 核心数据模型

### 1.1 ProxyGroup（代理组）

```go
type ProxyGroup struct {
    Name    string      `json:"name"`           // 代理组名称
    Type    string      `json:"type"`           // 类型: Selector, URLTest, Fallback, LoadBalance
    Now     string      `json:"now"`            // 当前选中的节点
    All     []string    `json:"all"`            // 所有可用节点列表
    History []History   `json:"history"`        // 历史记录
}

type History struct {
    Time  time.Time `json:"time"`   // 记录时间
    Delay int       `json:"delay"`  // 延迟（毫秒）
}
```

**字段说明**:
- `Name`: 代理组的唯一标识符
- `Type`: 代理组类型，决定节点选择策略
  - `Selector`: 手动选择
  - `URLTest`: 自动选择延迟最低的节点
  - `Fallback`: 按顺序选择第一个可用节点
  - `LoadBalance`: 负载均衡
- `Now`: 当前正在使用的节点名称
- `All`: 该组包含的所有节点名称列表
- `History`: 延迟测试历史记录

### 1.2 ProxyNode（代理节点）

```go
type ProxyNode struct {
    Name    string      `json:"name"`           // 节点名称
    Type    string      `json:"type"`           // 协议类型
    Server  string      `json:"server"`         // 服务器地址
    Port    int         `json:"port"`           // 端口
    Delay   int         `json:"delay"`          // 延迟（毫秒）
    Alive   bool        `json:"alive"`          // 是否可用
    History []History   `json:"history"`        // 延迟历史
    Extra   interface{} `json:"extra,omitempty"` // 额外配置
}
```

**字段说明**:
- `Name`: 节点的唯一标识符
- `Type`: 协议类型
  - `Shadowsocks`
  - `ShadowsocksR`
  - `VMess`
  - `Trojan`
  - `SOCKS5`
  - `HTTP`
  - `Direct`
  - `Reject`
- `Server`: 服务器域名或 IP 地址
- `Port`: 服务器端口号
- `Delay`: 最近一次测速延迟，0 表示未测速或超时
- `Alive`: 节点是否可用
- `History`: 延迟测试历史记录（最多保留 10 条）
- `Extra`: 协议特定的额外配置（如加密方式、混淆等）

### 1.3 Subscription（订阅）

```go
type Subscription struct {
    ID             string    `json:"id"`              // 订阅唯一 ID
    Name           string    `json:"name"`            // 订阅名称
    URL            string    `json:"url"`             // 订阅地址
    Enabled        bool      `json:"enabled"`         // 是否启用
    UpdateInterval int64     `json:"update_interval"` // 更新间隔（秒）
    LastUpdate     time.Time `json:"last_update"`     // 最后更新时间
    NextUpdate     time.Time `json:"next_update"`     // 下次更新时间
    NodeCount      int       `json:"node_count"`      // 节点数量
    Status         string    `json:"status"`          // 状态
    Error          string    `json:"error,omitempty"` // 错误信息
    CreatedAt      time.Time `json:"created_at"`      // 创建时间
    UpdatedAt      time.Time `json:"updated_at"`      // 更新时间
}
```

**字段说明**:
- `ID`: 订阅的唯一标识符，格式: `sub-{timestamp}-{random}`
- `Name`: 用户自定义的订阅名称
- `URL`: 订阅源地址
- `Enabled`: 是否启用该订阅
- `UpdateInterval`: 自动更新间隔（秒），0 表示不自动更新
- `LastUpdate`: 最后一次成功更新的时间
- `NextUpdate`: 计划的下次更新时间
- `NodeCount`: 该订阅包含的节点数量
- `Status`: 订阅状态
  - `success`: 更新成功
  - `failed`: 更新失败
  - `updating`: 正在更新
  - `disabled`: 已禁用
- `Error`: 最后一次更新的错误信息
- `CreatedAt`: 订阅创建时间
- `UpdatedAt`: 订阅配置最后修改时间

### 1.4 CoreStatus（Core 状态）

```go
type CoreStatus struct {
    Status       string    `json:"status"`        // 运行状态
    Version      string    `json:"version"`       // Core 版本
    PID          int       `json:"pid"`           // 进程 ID
    Uptime       int64     `json:"uptime"`        // 运行时长（秒）
    StartTime    time.Time `json:"start_time"`    // 启动时间
    RestartCount int       `json:"restart_count"` // 重启次数
    Healthy      bool      `json:"healthy"`       // 健康状态
    LastCheck    time.Time `json:"last_check"`    // 最后检查时间
}
```

**字段说明**:
- `Status`: Core 运行状态
  - `starting`: 正在启动
  - `running`: 正常运行
  - `stopping`: 正在停止
  - `stopped`: 已停止
  - `error`: 错误状态
- `Version`: Core 版本号
- `PID`: Core 进程的系统进程 ID
- `Uptime`: 从启动到现在的运行时长（秒）
- `StartTime`: Core 进程启动时间
- `RestartCount`: 自 Agent 启动以来 Core 重启的次数
- `Healthy`: 健康检查结果
- `LastCheck`: 最后一次健康检查的时间

### 1.5 DelayResult（测速结果）

```go
type DelayResult struct {
    Proxy     string    `json:"proxy"`             // 节点名称
    Delay     int       `json:"delay"`             // 延迟（毫秒）
    Success   bool      `json:"success"`           // 是否成功
    Error     string    `json:"error,omitempty"`   // 错误信息
    TestedAt  time.Time `json:"tested_at"`         // 测试时间
}
```

**字段说明**:
- `Proxy`: 被测试的节点名称
- `Delay`: 测试延迟（毫秒），0 表示测试失败或超时
- `Success`: 测试是否成功
- `Error`: 测试失败时的错误信息
- `TestedAt`: 测试执行的时间

### 1.6 ConnectionInfo（连接信息）

```go
type ConnectionInfo struct {
    ID       string              `json:"id"`       // 连接 ID
    Metadata ConnectionMetadata  `json:"metadata"` // 连接元数据
    Upload   int64               `json:"upload"`   // 上传字节数
    Download int64               `json:"download"` // 下载字节数
    Start    time.Time           `json:"start"`    // 开始时间
    Chains   []string            `json:"chains"`   // 代理链
    Rule     string              `json:"rule"`     // 匹配的规则类型
    RulePayload string           `json:"rule_payload"` // 规则内容
}

type ConnectionMetadata struct {
    Network         string `json:"network"`          // 网络类型: tcp/udp
    Type            string `json:"type"`             // 连接类型: HTTP/HTTPS/SOCKS5
    SourceIP        string `json:"source_ip"`        // 源 IP
    SourcePort      int    `json:"source_port"`      // 源端口
    DestinationIP   string `json:"destination_ip"`   // 目标 IP
    DestinationPort int    `json:"destination_port"` // 目标端口
    Host            string `json:"host"`             // 目标主机名
}
```

**字段说明**:
- `ID`: 连接的唯一标识符
- `Metadata`: 连接的详细元数据
  - `Network`: 网络层协议（tcp/udp）
  - `Type`: 应用层协议类型
  - `SourceIP`: 发起连接的本地 IP
  - `SourcePort`: 发起连接的本地端口
  - `DestinationIP`: 目标服务器 IP
  - `DestinationPort`: 目标服务器端口
  - `Host`: 目标主机名（HTTP/HTTPS）
- `Upload`: 该连接已上传的字节数
- `Download`: 该连接已下载的字节数
- `Start`: 连接建立的时间
- `Chains`: 代理链路径（如 ["PROXY", "HK-01"]）
- `Rule`: 匹配的规则类型（如 DOMAIN-SUFFIX）
- `RulePayload`: 规则的具体内容（如 google.com）

### 1.7 ConfigModel（配置模型）

```go
type ConfigModel struct {
    Mode      string    `json:"mode"`       // 代理模式
    Port      int       `json:"port"`       // HTTP 代理端口
    SocksPort int       `json:"socks_port"` // SOCKS5 代理端口
    AllowLan  bool      `json:"allow_lan"`  // 是否允许局域网连接
    LogLevel  string    `json:"log_level"`  // 日志级别
    IPv6      bool      `json:"ipv6"`       // 是否启用 IPv6
    DNS       DNSConfig `json:"dns"`        // DNS 配置
}

type DNSConfig struct {
    Enable       bool     `json:"enable"`        // 是否启用 DNS
    Listen       string   `json:"listen"`        // 监听地址
    EnhancedMode string   `json:"enhanced_mode"` // 增强模式
    Nameserver   []string `json:"nameserver"`    // DNS 服务器列表
    Fallback     []string `json:"fallback"`      // 备用 DNS 服务器
}
```

**字段说明**:
- `Mode`: 代理模式
  - `rule`: 规则模式
  - `global`: 全局模式
  - `direct`: 直连模式
- `Port`: HTTP 代理监听端口
- `SocksPort`: SOCKS5 代理监听端口
- `AllowLan`: 是否允许局域网设备连接
- `LogLevel`: 日志级别（debug/info/warn/error/silent）
- `IPv6`: 是否启用 IPv6 支持
- `DNS`: DNS 配置
  - `Enable`: 是否启用内置 DNS
  - `Listen`: DNS 服务监听地址
  - `EnhancedMode`: 增强模式（fake-ip/redir-host）
  - `Nameserver`: 主 DNS 服务器列表
  - `Fallback`: 备用 DNS 服务器列表

## 2. 辅助数据模型

### 2.1 AgentConfig（Agent 配置）

```go
type AgentConfig struct {
    Listen   string      `yaml:"listen"`    // API 监听地址
    LogLevel string      `yaml:"log_level"` // 日志级别
    LogDir   string      `yaml:"log_dir"`   // 日志目录
    DataDir  string      `yaml:"data_dir"`  // 数据目录
    Core     CoreConfig  `yaml:"core"`      // Core 配置
}

type CoreConfig struct {
    Executable string `yaml:"executable"` // Core 可执行文件路径
    Config     string `yaml:"config"`     // Core 配置文件路径
    API        string `yaml:"api"`        // Core API 地址
    ProxyPort  int    `yaml:"proxy_port"` // 代理端口
}
```

### 2.2 Rule（规则）

```go
type Rule struct {
    Type    string `json:"type"`    // 规则类型
    Payload string `json:"payload"` // 规则内容
    Proxy   string `json:"proxy"`   // 目标代理组
}
```

**规则类型**:
- `DOMAIN`: 完整域名匹配
- `DOMAIN-SUFFIX`: 域名后缀匹配
- `DOMAIN-KEYWORD`: 域名关键字匹配
- `IP-CIDR`: IP 地址段匹配
- `GEOIP`: 地理位置匹配
- `MATCH`: 兜底规则

### 2.3 TrafficStats（流量统计）

```go
type TrafficStats struct {
    Upload        int64 `json:"upload"`         // 总上传字节数
    Download      int64 `json:"download"`       // 总下载字节数
    UploadSpeed   int64 `json:"upload_speed"`   // 上传速度（字节/秒）
    DownloadSpeed int64 `json:"download_speed"` // 下载速度（字节/秒）
    Connections   int   `json:"connections"`    // 当前连接数
}
```

### 2.4 LogEntry（日志条目）

```go
type LogEntry struct {
    Time    time.Time `json:"time"`    // 日志时间
    Level   string    `json:"level"`   // 日志级别
    Module  string    `json:"module"`  // 模块名称
    Message string    `json:"message"` // 日志消息
}
```

### 2.5 TestTask（测速任务）

```go
type TestTask struct {
    ID          string        `json:"id"`           // 任务 ID
    Status      string        `json:"status"`       // 任务状态
    Progress    int           `json:"progress"`     // 进度百分比
    Total       int           `json:"total"`        // 总节点数
    Completed   int           `json:"completed"`    // 已完成数
    Results     []DelayResult `json:"results"`      // 测速结果
    StartedAt   time.Time     `json:"started_at"`   // 开始时间
    CompletedAt time.Time     `json:"completed_at"` // 完成时间
}
```

**任务状态**:
- `pending`: 等待执行
- `running`: 正在执行
- `completed`: 已完成
- `failed`: 失败
- `cancelled`: 已取消

## 3. 数据存储设计

### 3.1 文件存储结构

```
data/
├── config.yaml              # Agent 配置
├── subscriptions.json       # 订阅列表
├── core/
│   └── config.yaml         # Core 配置文件
└── cache/
    ├── delays.json         # 延迟缓存
    └── traffic.json        # 流量统计
```

### 3.2 订阅存储格式

```json
{
  "subscriptions": [
    {
      "id": "sub-001",
      "name": "订阅1",
      "url": "https://example.com/sub",
      "enabled": true,
      "update_interval": 86400,
      "last_update": "2026-02-22T10:00:00Z",
      "next_update": "2026-02-23T10:00:00Z",
      "node_count": 50,
      "status": "success",
      "error": null,
      "created_at": "2026-02-20T10:00:00Z",
      "updated_at": "2026-02-22T10:00:00Z"
    }
  ],
  "version": "1.0",
  "updated_at": "2026-02-22T10:00:00Z"
}
```

### 3.3 延迟缓存格式

```json
{
  "delays": {
    "HK-01": {
      "delay": 45,
      "tested_at": "2026-02-22T11:00:00Z",
      "success": true
    },
    "US-01": {
      "delay": 180,
      "tested_at": "2026-02-22T11:00:00Z",
      "success": true
    }
  },
  "version": "1.0",
  "updated_at": "2026-02-22T11:00:00Z"
}
```

## 4. 数据验证规则

### 4.1 订阅验证

```go
func ValidateSubscription(sub *Subscription) error {
    if sub.Name == "" {
        return errors.New("name is required")
    }
    if sub.URL == "" {
        return errors.New("url is required")
    }
    if !strings.HasPrefix(sub.URL, "http://") && !strings.HasPrefix(sub.URL, "https://") {
        return errors.New("url must start with http:// or https://")
    }
    if sub.UpdateInterval < 0 {
        return errors.New("update_interval must be non-negative")
    }
    return nil
}
```

### 4.2 代理节点验证

```go
func ValidateProxyNode(node *ProxyNode) error {
    if node.Name == "" {
        return errors.New("name is required")
    }
    if node.Type == "" {
        return errors.New("type is required")
    }
    if node.Server == "" {
        return errors.New("server is required")
    }
    if node.Port <= 0 || node.Port > 65535 {
        return errors.New("port must be between 1 and 65535")
    }
    return nil
}
```

### 4.3 配置验证

```go
func ValidateConfig(cfg *ConfigModel) error {
    validModes := map[string]bool{"rule": true, "global": true, "direct": true}
    if !validModes[cfg.Mode] {
        return errors.New("invalid mode")
    }
    if cfg.Port <= 0 || cfg.Port > 65535 {
        return errors.New("invalid port")
    }
    if cfg.SocksPort <= 0 || cfg.SocksPort > 65535 {
        return errors.New("invalid socks_port")
    }
    validLogLevels := map[string]bool{"debug": true, "info": true, "warn": true, "error": true, "silent": true}
    if !validLogLevels[cfg.LogLevel] {
        return errors.New("invalid log_level")
    }
    return nil
}
```

## 5. 数据转换

### 5.1 Core 数据到 Agent 数据

```go
// 将 Core 返回的代理信息转换为 Agent 的 ProxyNode
func ConvertCoreProxy(coreProxy map[string]interface{}) *ProxyNode {
    return &ProxyNode{
        Name:   coreProxy["name"].(string),
        Type:   coreProxy["type"].(string),
        Server: coreProxy["server"].(string),
        Port:   int(coreProxy["port"].(float64)),
        Delay:  0,
        Alive:  false,
        History: []History{},
    }
}
```

### 5.2 订阅内容解析

```go
// 解析 Base64 编码的订阅内容
func ParseSubscription(content string) ([]ProxyNode, error) {
    decoded, err := base64.StdEncoding.DecodeString(content)
    if err != nil {
        return nil, err
    }
    
    lines := strings.Split(string(decoded), "\n")
    nodes := make([]ProxyNode, 0)
    
    for _, line := range lines {
        line = strings.TrimSpace(line)
        if line == "" {
            continue
        }
        
        node, err := parseProxyLine(line)
        if err != nil {
            continue // 跳过无法解析的行
        }
        nodes = append(nodes, node)
    }
    
    return nodes, nil
}
```

## 6. 数据缓存策略

### 6.1 延迟缓存

- 缓存时间：5 分钟
- 缓存键：节点名称
- 缓存值：延迟结果
- 失效策略：时间过期或手动测速

### 6.2 代理列表缓存

- 缓存时间：30 秒
- 缓存键：固定键 "proxies"
- 缓存值：完整代理列表
- 失效策略：时间过期或配置变更

### 6.3 流量统计缓存

- 缓存时间：1 秒
- 缓存键：固定键 "traffic"
- 缓存值：流量统计数据
- 失效策略：时间过期

## 7. 数据同步机制

### 7.1 Agent 与 Core 同步

```
1. Agent 启动时从 Core 获取初始状态
2. 定期（每 30 秒）同步代理列表
3. 配置变更时立即同步
4. Core 重启后重新同步
```

### 7.2 Extension 与 Agent 同步

```
1. Extension 启动时获取完整状态
2. 用户操作时立即同步
3. 定期（每 10 秒）轮询状态更新
4. 未来可升级为 WebSocket 推送
```

## 8. 数据持久化

### 8.1 需要持久化的数据

- 订阅列表
- Agent 配置
- 延迟缓存（可选）
- 流量统计（可选）

### 8.2 不需要持久化的数据

- 当前连接列表
- 实时流量速度
- Core 进程状态
- API 请求日志

### 8.3 持久化时机

- 订阅变更：立即持久化
- 配置变更：立即持久化
- 延迟缓存：每 5 分钟或程序退出时
- 流量统计：每 1 分钟或程序退出时
