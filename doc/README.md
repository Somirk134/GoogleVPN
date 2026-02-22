# 本地代理管理系统 - 完整工程设计文档

## 项目概述

这是一个 Windows 平台本地代理管理系统的完整工程设计文档集。系统由 Go 后端服务（Agent）、代理内核（Clash Core）和 Chrome Extension 三部分组成，提供完整的代理管理、节点切换、测速和订阅管理功能。

## 系统架构

```
┌─────────────────────────────────────────────────────┐
│                   Windows 系统                       │
│                                                      │
│  ┌────────────────────────────────────────────┐    │
│  │         Chrome Browser + Extension          │    │
│  │         (唯一 UI 界面)                       │    │
│  └────────────────┬───────────────────────────┘    │
│                   │ HTTP (127.0.0.1:8765)           │
│                   ▼                                 │
│  ┌───────────────────────────────────────────────┐ │
│  │      Agent Service (Go Backend)               │ │
│  │      - 常驻后台进程                            │ │
│  │      - 管理 Core 进程                          │ │
│  │      - 提供 REST API                           │ │
│  │      - 节点管理、测速、订阅                     │ │
│  └───────────────┬───────────────────────────────┘ │
│                  │ 进程管理                         │
│                  ▼                                  │
│  ┌───────────────────────────────────────────────┐ │
│  │    Proxy Core (Clash)                         │ │
│  │    - 代理服务: 127.0.0.1:7890                 │ │
│  │    - Controller API: 127.0.0.1:9090          │ │
│  └───────────────────────────────────────────────┘ │
│                  │ 代理流量                         │
└──────────────────┼──────────────────────────────────┘
                   ▼
               Internet
```

## 核心特性

### 1. Agent 服务（Go Backend）
- ✅ 常驻后台无界面服务
- ✅ 启动和守护 Clash Core 进程
- ✅ 提供 RESTful API (127.0.0.1:8765)
- ✅ 节点管理和切换
- ✅ 并发测速
- ✅ 订阅管理和更新
- ✅ 配置管理
- ✅ 日志记录

### 2. Chrome Extension（UI 层）
- ✅ Manifest V3 标准
- ✅ 控制浏览器代理（仅 Chrome）
- ✅ 节点列表展示
- ✅ 一键切换节点
- ✅ 批量测速
- ✅ 延迟显示
- ✅ 流量统计

### 3. 代理内核（Clash Core）
- ✅ SOCKS5/HTTP 代理
- ✅ 规则路由
- ✅ 多协议支持
- ✅ External Controller API

## 文档结构

本项目包含以下完整的工程设计文档：

### 📋 核心设计文档

1. **[ARCHITECTURE.md](ARCHITECTURE.md)** - 系统总体架构设计
   - 模块划分
   - 进程模型
   - 通信关系
   - 数据流说明
   - 生命周期管理
   - 状态管理模型
   - 错误处理策略

2. **[API_SPECIFICATION.md](API_SPECIFICATION.md)** - API 规范文档
   - 所有接口定义
   - 请求/响应格式
   - 错误码规范
   - 统一返回格式
   - 完整 JSON 示例

3. **[DATA_MODELS.md](DATA_MODELS.md)** - 数据模型设计
   - ProxyGroup（代理组）
   - ProxyNode（代理节点）
   - Subscription（订阅）
   - CoreStatus（Core 状态）
   - DelayResult（测速结果）
   - ConnectionInfo（连接信息）
   - ConfigModel（配置模型）

4. **[CHROME_EXTENSION_DESIGN.md](CHROME_EXTENSION_DESIGN.md)** - Chrome Extension 架构设计
   - Manifest V3 配置
   - Service Worker 设计
   - Popup UI 设计
   - 状态管理方式
   - API 通信封装
   - 错误处理设计

5. **[PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md)** - 项目目录结构
   - 完整目录树
   - Go backend 结构
   - Chrome extension 结构
   - 配置文件位置
   - 日志目录设计

### 🔧 技术实现文档

6. **[TECH_STACK.md](TECH_STACK.md)** - 技术选型说明
   - Go Web 框架选择（Gin）
   - 日志方案（Zap）
   - 配置管理（Viper）
   - 进程管理方案
   - 并发模型设计
   - 为什么不直接让扩展调用 Core

7. **[CONCURRENCY_DESIGN.md](CONCURRENCY_DESIGN.md)** - 并发与性能设计
   - Goroutine 管理策略
   - Context 生命周期管理
   - 子进程守护机制
   - 测速并发模型
   - 避免 goroutine 泄露
   - 防止 API 阻塞

8. **[SECURITY_DESIGN.md](SECURITY_DESIGN.md)** - 安全边界设计
   - Localhost API 风险分析
   - Token 认证机制
   - CSRF 防护
   - 端口扫描防护
   - 配置文件安全
   - 订阅安全
   - 未来安全升级路径

9. **[LIFECYCLE_MANAGEMENT.md](LIFECYCLE_MANAGEMENT.md)** - 启动与关闭流程
   - Agent 启动流程
   - Core 启动流程
   - Chrome Extension 加载流程
   - 优雅关闭流程
   - 崩溃恢复流程
   - 健康检查机制

### 📅 开发规划文档

10. **[MVP_DEVELOPMENT_PLAN.md](MVP_DEVELOPMENT_PLAN.md)** - MVP 分阶段开发规划
    - 阶段划分（7 个阶段）
    - 每阶段目标和任务
    - 必须完成的接口
    - 测试方法
    - 验收标准
    - 风险评估
    - 里程碑定义

## 技术栈

### 后端（Go）
- **语言**: Go 1.22+
- **Web 框架**: Gin 1.9+
- **日志**: Zap 1.26+
- **配置**: Viper 1.18+
- **限流**: golang.org/x/time/rate

### 前端（Chrome Extension）
- **框架**: Manifest V3
- **语言**: Vanilla JavaScript (ES2020+)
- **样式**: CSS3

### 代理内核
- **内核**: Clash 1.18+

## 开发时间估算

```
阶段 0: 环境准备和项目搭建    1-2 天
阶段 1: Core 进程管理          2-3 天
阶段 2: 基础 API 服务          2-3 天
阶段 3: Chrome Extension 基础  2-3 天
阶段 4: 代理控制和节点切换     2-3 天
阶段 5: 测速功能               1-2 天
阶段 6: 订阅管理               2-3 天
阶段 7: 完善和优化             2-3 天

总计: 14-22 天
```

## 关键设计决策

### 1. 为什么需要 Agent 中间层？

**不直接让 Extension 调用 Core 的原因**:

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

5. **跨浏览器扩展**
   - 未来支持其他浏览器
   - Agent 提供统一接口
   - 降低扩展开发复杂度

### 2. 为什么选择 Gin 框架？

1. **性能优秀**: 基于 httprouter，性能极高
2. **生态成熟**: 文档完善，社区活跃
3. **开发效率**: API 简洁，中间件丰富
4. **适合场景**: 本地 API 服务，不需要复杂功能

### 3. 为什么使用 Manifest V3？

1. **官方推荐**: Chrome 官方推荐的新标准
2. **未来趋势**: Manifest V2 将被淘汰
3. **更安全**: 权限控制更严格
4. **更高性能**: Service Worker 替代 Background Page

## 安全考虑

### 当前阶段（MVP）
- ✅ CORS 限制（只允许 Chrome Extension）
- ✅ User-Agent 验证
- ✅ 请求频率限制
- ✅ 配置文件权限控制

### 未来扩展
- 🔄 Token 认证机制
- 🔄 CSRF 防护
- 🔄 配置文件加密
- 🔄 订阅 HTTPS 强制
- 🔄 审计日志

## 性能指标

### 目标性能
- API 响应时间: < 100ms
- 节点切换时间: < 500ms
- 测速并发数: 10-20 个
- 单节点测速超时: 5 秒
- Agent 内存占用: < 50MB
- Core 启动时间: < 3 秒

## 使用场景

### 主要使用流程

1. **首次使用**
   ```
   1. 安装 Agent 服务
   2. 安装 Chrome Extension
   3. 添加订阅源
   4. 更新订阅获取节点
   5. 启用代理
   6. 选择节点
   7. 开始使用
   ```

2. **日常使用**
   ```
   1. 打开 Chrome
   2. 点击扩展图标
   3. 查看节点列表
   4. 切换节点（可选）
   5. 测速（可选）
   6. 正常浏览
   ```

3. **订阅管理**
   ```
   1. 打开扩展设置
   2. 添加/删除订阅
   3. 手动更新订阅
   4. 查看节点数量
   ```

## 故障排查

### 常见问题

1. **Agent 无法启动**
   - 检查端口是否被占用
   - 检查配置文件是否正确
   - 查看日志文件

2. **Core 无法启动**
   - 检查 Core 可执行文件是否存在
   - 检查 Core 配置文件是否正确
   - 查看 Core 日志

3. **Extension 无法连接**
   - 检查 Agent 是否运行
   - 检查 API 地址是否正确
   - 检查防火墙设置

4. **代理不生效**
   - 检查代理是否启用
   - 检查节点是否可用
   - 检查 Chrome 代理设置

## 后续扩展

### 短期计划
- [ ] 支持更多代理协议
- [ ] 规则管理功能
- [ ] 连接管理功能
- [ ] 流量统计图表

### 中期计划
- [ ] 支持 Firefox Extension
- [ ] 支持 Edge Extension
- [ ] 系统托盘图标
- [ ] 配置导入导出

### 长期计划
- [ ] 跨平台支持（macOS, Linux）
- [ ] GUI 管理界面
- [ ] 远程管理
- [ ] 多用户支持

## 贡献指南

### 开发规范
- 遵循 Go 官方代码规范
- 使用 gofmt 格式化代码
- 编写单元测试
- 完善注释文档

### Git 提交规范
```
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

## 许可证

待定

## 联系方式

待定

---

## 文档使用说明

### 对于项目经理
- 阅读 README.md 了解项目概况
- 阅读 MVP_DEVELOPMENT_PLAN.md 了解开发计划
- 使用里程碑跟踪项目进度

### 对于架构师
- 阅读 ARCHITECTURE.md 了解系统架构
- 阅读 TECH_STACK.md 了解技术选型
- 阅读 SECURITY_DESIGN.md 了解安全设计

### 对于后端开发
- 阅读 PROJECT_STRUCTURE.md 了解目录结构
- 阅读 API_SPECIFICATION.md 了解接口定义
- 阅读 DATA_MODELS.md 了解数据模型
- 阅读 CONCURRENCY_DESIGN.md 了解并发设计
- 阅读 LIFECYCLE_MANAGEMENT.md 了解生命周期

### 对于前端开发
- 阅读 CHROME_EXTENSION_DESIGN.md 了解扩展设计
- 阅读 API_SPECIFICATION.md 了解接口调用
- 阅读 DATA_MODELS.md 了解数据格式

### 对于测试人员
- 阅读 MVP_DEVELOPMENT_PLAN.md 了解测试方法
- 阅读 API_SPECIFICATION.md 了解接口测试
- 阅读 LIFECYCLE_MANAGEMENT.md 了解测试场景

---

**文档版本**: 1.0.0  
**最后更新**: 2026-02-22  
**文档状态**: 完整 ✅
