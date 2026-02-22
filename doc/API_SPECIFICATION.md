# API 规范文档

## 1. 总体说明

### 1.1 基本信息

- **Base URL**: `http://127.0.0.1:8765`
- **API 版本**: `v1`
- **协议**: HTTP/1.1
- **数据格式**: JSON
- **字符编码**: UTF-8
- **认证方式**: Token（可选，后期扩展）

### 1.2 统一返回格式

#### 成功响应

```json
{
  "code": 0,
  "message": "success",
  "data": {
    // 具体数据
  },
  "timestamp": 1708588800
}
```

#### 错误响应

```json
{
  "code": 40001,
  "message": "Invalid parameter: proxy name is required",
  "data": null,
  "timestamp": 1708588800
}
```

### 1.3 HTTP 状态码规范

| 状态码 | 说明 | 使用场景 |
|--------|------|----------|
| 200 | OK | 请求成功 |
| 201 | Created | 资源创建成功 |
| 204 | No Content | 删除成功 |
| 400 | Bad Request | 请求参数错误 |
| 401 | Unauthorized | 认证失败 |
| 403 | Forbidden | 无权限访问 |
| 404 | Not Found | 资源不存在 |
| 409 | Conflict | 资源冲突 |
| 500 | Internal Server Error | 服务器内部错误 |
| 503 | Service Unavailable | 服务不可用（Core 未启动） |

### 1.4 业务错误码规范

| 错误码 | 说明 |
|--------|------|
| 0 | 成功 |
| 10001 | 系统错误 |
| 10002 | 服务不可用 |
| 10003 | 请求超时 |
| 20001 | 参数错误 |
| 20002 | 参数缺失 |
| 20003 | 参数类型错误 |
| 30001 | Core 未启动 |
| 30002 | Core 启动失败 |
| 30003 | Core 通信失败 |
| 40001 | 代理组不存在 |
| 40002 | 代理节点不存在 |
| 40003 | 节点切换失败 |
| 50001 | 订阅不存在 |
| 50002 | 订阅更新失败 |
| 50003 | 订阅解析失败 |
| 60001 | 配置文件错误 |
| 60002 | 配置加载失败 |
| 60003 | 配置保存失败 |

## 2. API 接口定义

### 2.1 系统状态接口

#### 2.1.1 获取系统状态

**接口**: `GET /api/v1/status`

**描述**: 获取 Agent 和 Core 的运行状态

**请求参数**: 无

**响应示例**:
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "agent": {
      "status": "running",
      "version": "1.0.0",
      "uptime": 3600,
      "start_time": "2026-02-22T10:00:00Z"
    },
    "core": {
      "status": "running",
      "version": "1.18.0",
      "pid": 12345,
      "uptime": 3500,
      "restart_count": 0,
      "healthy": true,
      "last_check": "2026-02-22T11:00:00Z"
    }
  },
  "timestamp": 1708588800
}
```

#### 2.1.2 获取系统版本

**接口**: `GET /api/v1/version`

**描述**: 获取 Agent 和 Core 的版本信息

**请求参数**: 无

**响应示例**:
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "agent_version": "1.0.0",
    "core_version": "1.18.0",
    "core_type": "clash",
    "build_time": "2026-02-20T15:30:00Z",
    "go_version": "1.22.0"
  },
  "timestamp": 1708588800
}
```


### 2.2 代理管理接口

#### 2.2.1 获取所有代理组

**接口**: `GET /api/v1/proxies`

**描述**: 获取所有代理组及其节点信息

**请求参数**: 无

**响应示例**:
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "proxies": {
      "GLOBAL": {
        "name": "GLOBAL",
        "type": "Selector",
        "now": "HK-01",
        "all": ["HK-01", "US-01", "JP-01", "DIRECT"],
        "history": []
      },
      "HK-01": {
        "name": "HK-01",
        "type": "Shadowsocks",
        "server": "hk.example.com",
        "port": 8388,
        "delay": 45,
        "alive": true,
        "history": [
          {"time": "2026-02-22T10:00:00Z", "delay": 45},
          {"time": "2026-02-22T09:00:00Z", "delay": 48}
        ]
      },
      "US-01": {
        "name": "US-01",
        "type": "Shadowsocks",
        "server": "us.example.com",
        "port": 8388,
        "delay": 180,
        "alive": true,
        "history": []
      }
    }
  },
  "timestamp": 1708588800
}
```

#### 2.2.2 获取指定代理组信息

**接口**: `GET /api/v1/proxies/{group}`

**描述**: 获取指定代理组的详细信息

**路径参数**:
- `group`: 代理组名称

**响应示例**:
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "name": "GLOBAL",
    "type": "Selector",
    "now": "HK-01",
    "all": ["HK-01", "US-01", "JP-01", "DIRECT"],
    "history": []
  },
  "timestamp": 1708588800
}
```

**错误响应**:
```json
{
  "code": 40001,
  "message": "Proxy group not found: INVALID",
  "data": null,
  "timestamp": 1708588800
}
```

#### 2.2.3 切换代理节点

**接口**: `PUT /api/v1/proxies/{group}`

**描述**: 切换指定代理组的当前节点

**路径参数**:
- `group`: 代理组名称

**请求体**:
```json
{
  "name": "HK-01"
}
```

**响应示例**:
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "group": "GLOBAL",
    "previous": "US-01",
    "current": "HK-01",
    "switched_at": "2026-02-22T11:00:00Z"
  },
  "timestamp": 1708588800
}
```

**错误响应**:
```json
{
  "code": 40002,
  "message": "Proxy node not found in group: HK-99",
  "data": null,
  "timestamp": 1708588800
}
```

#### 2.2.4 获取代理节点延迟

**接口**: `GET /api/v1/proxies/{proxy}/delay`

**描述**: 获取指定节点的延迟信息

**路径参数**:
- `proxy`: 代理节点名称

**查询参数**:
- `url`: 测速 URL（可选，默认: http://www.gstatic.com/generate_204）
- `timeout`: 超时时间（可选，默认: 5000ms）

**响应示例**:
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "proxy": "HK-01",
    "delay": 45,
    "tested_at": "2026-02-22T11:00:00Z"
  },
  "timestamp": 1708588800
}
```

### 2.3 测速接口

#### 2.3.1 批量测速

**接口**: `POST /api/v1/proxies/test`

**描述**: 对所有或指定节点进行延迟测试

**请求体**:
```json
{
  "proxies": ["HK-01", "US-01", "JP-01"],
  "url": "http://www.gstatic.com/generate_204",
  "timeout": 5000
}
```

**请求参数说明**:
- `proxies`: 要测速的节点列表（可选，为空则测试所有节点）
- `url`: 测速 URL（可选）
- `timeout`: 超时时间，单位毫秒（可选）

**响应示例**:
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "results": [
      {
        "proxy": "HK-01",
        "delay": 45,
        "success": true,
        "error": null
      },
      {
        "proxy": "US-01",
        "delay": 180,
        "success": true,
        "error": null
      },
      {
        "proxy": "JP-01",
        "delay": 0,
        "success": false,
        "error": "timeout"
      }
    ],
    "total": 3,
    "success_count": 2,
    "failed_count": 1,
    "tested_at": "2026-02-22T11:00:00Z"
  },
  "timestamp": 1708588800
}
```

#### 2.3.2 测速任务状态

**接口**: `GET /api/v1/proxies/test/{task_id}`

**描述**: 获取异步测速任务的状态（未来扩展）

**路径参数**:
- `task_id`: 任务 ID

**响应示例**:
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "task_id": "test-20260222-110000",
    "status": "running",
    "progress": 60,
    "total": 10,
    "completed": 6,
    "started_at": "2026-02-22T11:00:00Z"
  },
  "timestamp": 1708588800
}
```

### 2.4 订阅管理接口

#### 2.4.1 获取所有订阅

**接口**: `GET /api/v1/subscriptions`

**描述**: 获取所有订阅源信息

**请求参数**: 无

**响应示例**:
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "subscriptions": [
      {
        "id": "sub-001",
        "name": "订阅1",
        "url": "https://example.com/sub1",
        "enabled": true,
        "update_interval": 86400,
        "last_update": "2026-02-22T10:00:00Z",
        "next_update": "2026-02-23T10:00:00Z",
        "node_count": 50,
        "status": "success",
        "error": null
      },
      {
        "id": "sub-002",
        "name": "订阅2",
        "url": "https://example.com/sub2",
        "enabled": false,
        "update_interval": 86400,
        "last_update": "2026-02-21T10:00:00Z",
        "next_update": null,
        "node_count": 0,
        "status": "disabled",
        "error": null
      }
    ]
  },
  "timestamp": 1708588800
}
```

#### 2.4.2 添加订阅

**接口**: `POST /api/v1/subscriptions`

**描述**: 添加新的订阅源

**请求体**:
```json
{
  "name": "新订阅",
  "url": "https://example.com/sub",
  "update_interval": 86400,
  "enabled": true
}
```

**响应示例**:
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": "sub-003",
    "name": "新订阅",
    "url": "https://example.com/sub",
    "enabled": true,
    "update_interval": 86400,
    "created_at": "2026-02-22T11:00:00Z"
  },
  "timestamp": 1708588800
}
```

#### 2.4.3 更新订阅

**接口**: `PUT /api/v1/subscriptions/{id}`

**描述**: 更新订阅源配置

**路径参数**:
- `id`: 订阅 ID

**请求体**:
```json
{
  "name": "更新后的名称",
  "url": "https://example.com/new-sub",
  "update_interval": 43200,
  "enabled": true
}
```

**响应示例**:
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": "sub-001",
    "name": "更新后的名称",
    "url": "https://example.com/new-sub",
    "enabled": true,
    "update_interval": 43200,
    "updated_at": "2026-02-22T11:00:00Z"
  },
  "timestamp": 1708588800
}
```

#### 2.4.4 删除订阅

**接口**: `DELETE /api/v1/subscriptions/{id}`

**描述**: 删除指定订阅源

**路径参数**:
- `id`: 订阅 ID

**响应示例**:
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": "sub-001",
    "deleted_at": "2026-02-22T11:00:00Z"
  },
  "timestamp": 1708588800
}
```

#### 2.4.5 手动更新订阅

**接口**: `POST /api/v1/subscriptions/{id}/update`

**描述**: 手动触发订阅更新

**路径参数**:
- `id`: 订阅 ID

**请求参数**: 无

**响应示例**:
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": "sub-001",
    "status": "success",
    "node_count": 52,
    "added": 3,
    "removed": 1,
    "updated_at": "2026-02-22T11:00:00Z"
  },
  "timestamp": 1708588800
}
```

**错误响应**:
```json
{
  "code": 50002,
  "message": "Subscription update failed: connection timeout",
  "data": {
    "id": "sub-001",
    "error": "connection timeout"
  },
  "timestamp": 1708588800
}
```

### 2.5 配置管理接口

#### 2.5.1 获取配置

**接口**: `GET /api/v1/config`

**描述**: 获取当前配置信息

**请求参数**: 无

**响应示例**:
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "mode": "rule",
    "port": 7890,
    "socks_port": 7891,
    "allow_lan": false,
    "log_level": "info",
    "ipv6": false,
    "dns": {
      "enable": true,
      "listen": "0.0.0.0:53",
      "enhanced_mode": "fake-ip",
      "nameserver": [
        "223.5.5.5",
        "119.29.29.29"
      ]
    }
  },
  "timestamp": 1708588800
}
```

#### 2.5.2 更新配置

**接口**: `PATCH /api/v1/config`

**描述**: 更新部分配置项

**请求体**:
```json
{
  "mode": "global",
  "log_level": "debug"
}
```

**响应示例**:
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "updated_fields": ["mode", "log_level"],
    "updated_at": "2026-02-22T11:00:00Z"
  },
  "timestamp": 1708588800
}
```

#### 2.5.3 重载配置

**接口**: `POST /api/v1/config/reload`

**描述**: 重新加载配置文件

**请求参数**: 无

**响应示例**:
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "reloaded_at": "2026-02-22T11:00:00Z",
    "core_restarted": true
  },
  "timestamp": 1708588800
}
```

### 2.6 规则管理接口

#### 2.6.1 获取规则列表

**接口**: `GET /api/v1/rules`

**描述**: 获取当前生效的规则列表

**请求参数**: 无

**响应示例**:
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "rules": [
      {
        "type": "DOMAIN-SUFFIX",
        "payload": "google.com",
        "proxy": "PROXY"
      },
      {
        "type": "DOMAIN-KEYWORD",
        "payload": "youtube",
        "proxy": "PROXY"
      },
      {
        "type": "GEOIP",
        "payload": "CN",
        "proxy": "DIRECT"
      },
      {
        "type": "MATCH",
        "payload": "",
        "proxy": "PROXY"
      }
    ],
    "total": 4
  },
  "timestamp": 1708588800
}
```

### 2.7 连接管理接口

#### 2.7.1 获取活动连接

**接口**: `GET /api/v1/connections`

**描述**: 获取当前活动的连接列表

**请求参数**: 无

**响应示例**:
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "connections": [
      {
        "id": "conn-001",
        "metadata": {
          "network": "tcp",
          "type": "HTTP",
          "source_ip": "127.0.0.1",
          "source_port": 54321,
          "destination_ip": "142.250.185.46",
          "destination_port": 443,
          "host": "www.google.com"
        },
        "upload": 1024,
        "download": 4096,
        "start": "2026-02-22T11:00:00Z",
        "chains": ["PROXY", "HK-01"],
        "rule": "DOMAIN-SUFFIX",
        "rule_payload": "google.com"
      }
    ],
    "total": 1,
    "upload_total": 1024,
    "download_total": 4096
  },
  "timestamp": 1708588800
}
```

#### 2.7.2 关闭连接

**接口**: `DELETE /api/v1/connections/{id}`

**描述**: 关闭指定连接

**路径参数**:
- `id`: 连接 ID

**响应示例**:
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": "conn-001",
    "closed_at": "2026-02-22T11:00:00Z"
  },
  "timestamp": 1708588800
}
```

#### 2.7.3 关闭所有连接

**接口**: `DELETE /api/v1/connections`

**描述**: 关闭所有活动连接

**请求参数**: 无

**响应示例**:
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "closed_count": 15,
    "closed_at": "2026-02-22T11:00:00Z"
  },
  "timestamp": 1708588800
}
```

### 2.8 日志接口

#### 2.8.1 获取日志

**接口**: `GET /api/v1/logs`

**描述**: 获取最近的日志记录

**查询参数**:
- `level`: 日志级别（可选，debug/info/warn/error）
- `limit`: 返回条数（可选，默认 100）
- `offset`: 偏移量（可选，默认 0）

**响应示例**:
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "logs": [
      {
        "time": "2026-02-22T11:00:00Z",
        "level": "info",
        "module": "API",
        "message": "Proxy switched to HK-01"
      },
      {
        "time": "2026-02-22T10:59:55Z",
        "level": "debug",
        "module": "Core",
        "message": "Health check passed"
      }
    ],
    "total": 2,
    "limit": 100,
    "offset": 0
  },
  "timestamp": 1708588800
}
```

### 2.9 流量统计接口

#### 2.9.1 获取流量统计

**接口**: `GET /api/v1/traffic`

**描述**: 获取流量统计信息

**请求参数**: 无

**响应示例**:
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "upload": 1048576,
    "download": 10485760,
    "upload_speed": 1024,
    "download_speed": 10240,
    "connections": 5
  },
  "timestamp": 1708588800
}
```

## 3. WebSocket 接口（未来扩展）

### 3.1 实时日志推送

**接口**: `WS /api/v1/ws/logs`

**描述**: 实时推送日志信息

**消息格式**:
```json
{
  "type": "log",
  "data": {
    "time": "2026-02-22T11:00:00Z",
    "level": "info",
    "module": "API",
    "message": "Proxy switched to HK-01"
  }
}
```

### 3.2 实时流量推送

**接口**: `WS /api/v1/ws/traffic`

**描述**: 实时推送流量统计

**消息格式**:
```json
{
  "type": "traffic",
  "data": {
    "upload": 1048576,
    "download": 10485760,
    "upload_speed": 1024,
    "download_speed": 10240,
    "connections": 5,
    "timestamp": 1708588800
  }
}
```

### 3.3 实时连接推送

**接口**: `WS /api/v1/ws/connections`

**描述**: 实时推送连接变化

**消息格式**:
```json
{
  "type": "connection",
  "action": "new",
  "data": {
    "id": "conn-001",
    "metadata": {
      "network": "tcp",
      "type": "HTTP",
      "host": "www.google.com"
    }
  }
}
```

## 4. 认证机制（未来扩展）

### 4.1 Token 认证

**请求头**:
```
Authorization: Bearer <token>
```

**Token 获取**:
- 从配置文件读取
- 首次启动自动生成
- 可通过 API 重新生成

### 4.2 CORS 配置

```
Access-Control-Allow-Origin: chrome-extension://*
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, PATCH
Access-Control-Allow-Headers: Content-Type, Authorization
```

## 5. 限流策略（未来扩展）

### 5.1 全局限流

- 每秒最多 100 个请求
- 超过限制返回 429 Too Many Requests

### 5.2 接口限流

- 测速接口：每分钟最多 10 次
- 订阅更新：每分钟最多 5 次
- 其他接口：每秒最多 20 次

## 6. API 调用示例

### 6.1 切换节点完整流程

```javascript
// 1. 获取所有代理组
const proxiesRes = await fetch('http://127.0.0.1:8765/api/v1/proxies');
const proxies = await proxiesRes.json();

// 2. 切换节点
const switchRes = await fetch('http://127.0.0.1:8765/api/v1/proxies/GLOBAL', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'HK-01' })
});
const result = await switchRes.json();

// 3. 验证切换结果
if (result.code === 0) {
  console.log('切换成功:', result.data.current);
}
```

### 6.2 批量测速流程

```javascript
// 1. 发起测速请求
const testRes = await fetch('http://127.0.0.1:8765/api/v1/proxies/test', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    proxies: ['HK-01', 'US-01', 'JP-01'],
    timeout: 5000
  })
});
const testResult = await testRes.json();

// 2. 处理测速结果
testResult.data.results.forEach(result => {
  if (result.success) {
    console.log(`${result.proxy}: ${result.delay}ms`);
  } else {
    console.log(`${result.proxy}: 测速失败 - ${result.error}`);
  }
});
```

### 6.3 订阅更新流程

```javascript
// 1. 获取所有订阅
const subsRes = await fetch('http://127.0.0.1:8765/api/v1/subscriptions');
const subs = await subsRes.json();

// 2. 更新指定订阅
const updateRes = await fetch(`http://127.0.0.1:8765/api/v1/subscriptions/${subs.data.subscriptions[0].id}/update`, {
  method: 'POST'
});
const updateResult = await updateRes.json();

// 3. 检查更新结果
if (updateResult.code === 0) {
  console.log('更新成功，新增节点:', updateResult.data.added);
}
```
