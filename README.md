# Proxy Manager

Windows 本地代理管理系统

## 使用方法

### 1. 启动服务
双击 `一键启动.bat`

首次运行会自动：
- 配置 Go 代理
- 下载依赖
- 生成图标

### 2. 加载 Chrome 扩展
1. 打开 Chrome，访问 `chrome://extensions/`
2. 开启"开发者模式"
3. 点击"加载已解压的扩展程序"
4. 选择 `extension` 文件夹

### 3. 完成
点击 Chrome 工具栏的扩展图标使用

## 常见问题

**Q: 启动失败？**
- 检查端口 8765 是否被占用
- 确认 `core/verge-mihomo.exe` 存在
- 查看 `logs/agent.log`

**Q: 依赖下载慢？**
- 脚本会自动尝试多个国内镜像

## 项目结构

```
├── cmd/agent/       # Agent 主程序
├── internal/        # 内部包
├── core/            # Clash Core
├── extension/       # Chrome 扩展
├── configs/         # 配置文件
└── doc/             # 设计文档
```

## 技术栈

- Go 1.22+
- Chrome Extension (Manifest V3)
- Clash Core (verge-mihomo)

详细文档见 `doc/` 目录
