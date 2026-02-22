# 🚀 快速启动指南

## ⚠️ 重要提示

由于网络问题，Go 依赖下载可能失败。请按以下步骤操作：

## 📦 步骤 1: 配置 Go 代理

打开命令行，执行：

```cmd
go env -w GOPROXY=https://goproxy.cn,direct
go env -w GOSUMDB=off
```

或者使用其他国内镜像：
```cmd
go env -w GOPROXY=https://goproxy.io,direct
```

## 📥 步骤 2: 下载依赖

```cmd
go mod download
go mod tidy
```

如果还是失败，可以尝试：
```cmd
go env -w GOPROXY=https://mirrors.aliyun.com/goproxy/,direct
go mod download
```

## 🎨 步骤 3: 准备 Extension 图标

**这一步很重要！Extension 没有图标无法加载。**

### 方法 1: 使用在线工具生成

1. 访问 https://www.favicon-generator.org/
2. 上传任意图片或使用文字生成
3. 下载生成的图标
4. 重命名并放到 `extension/icons/` 目录：
   - icon16.png
   - icon32.png
   - icon48.png
   - icon128.png

### 方法 2: 使用现有图片

1. 找一张图片（建议网络/代理相关）
2. 使用画图工具或在线工具调整大小
3. 保存为 PNG 格式
4. 放到 `extension/icons/` 目录

### 方法 3: 临时使用纯色图标

创建一个简单的 Python 脚本（如果你有 Python 和 Pillow）：

```python
from PIL import Image, ImageDraw

sizes = [16, 32, 48, 128]
for size in sizes:
    img = Image.new('RGB', (size, size), color='#2196F3')
    draw = ImageDraw.Draw(img)
    draw.text((size//4, size//4), 'P', fill='white')
    img.save(f'extension/icons/icon{size}.png')
```

## ▶️ 步骤 4: 启动 Agent

```cmd
go run ./cmd/agent
```

应该看到类似输出：
```
2026-02-22T10:00:00.000+0800    INFO    Starting Proxy Manager Agent    {"version": "1.0.0"}
2026-02-22T10:00:00.001+0800    INFO    Application started successfully
```

## 🌐 步骤 5: 加载 Chrome Extension

1. 打开 Chrome 浏览器
2. 地址栏输入：`chrome://extensions/`
3. 开启右上角的"开发者模式"开关
4. 点击"加载已解压的扩展程序"
5. 选择项目中的 `extension` 文件夹
6. 看到 "Proxy Manager" 扩展出现 ✅

## 🎉 步骤 6: 测试功能

1. 点击浏览器工具栏的扩展图标
2. 应该看到 Popup 界面
3. 点击"启用代理"按钮
4. 如果 Agent 正在运行，应该能看到连接状态

## 🔍 调试方法

### 查看 Agent 日志

```cmd
type logs\agent.log
```

### 查看 Extension 日志

1. 打开 `chrome://extensions/`
2. 找到 Proxy Manager
3. 点击"Service Worker"链接
4. 查看控制台输出

### 查看 Popup 日志

1. 点击扩展图标打开 Popup
2. 右键 Popup 窗口
3. 选择"检查"
4. 查看控制台

## ❓ 常见问题

### Q1: go mod download 失败

**A**: 配置 Go 代理（见步骤 1）

### Q2: Extension 无法加载

**A**: 检查是否有图标文件（见步骤 3）

### Q3: Popup 显示"未连接"

**A**: 
1. 确保 Agent 正在运行
2. 检查 Agent 是否监听 127.0.0.1:8765
3. 查看 Agent 日志是否有错误

### Q4: Core 无法启动

**A**:
1. 检查 `core/verge-mihomo.exe` 是否存在
2. 检查 `core/config/config.yaml` 是否存在
3. 检查端口 7890 和 9090 是否被占用

## 📝 下一步

基础框架已经搭建完成！接下来需要实现：

1. **Core 进程管理** - 让 Agent 能启动和管理 Clash Core
2. **API 接口** - 实现代理控制的 REST API
3. **节点切换** - 在 Extension 中实现节点切换功能
4. **测速功能** - 实现批量测速

详细开发计划请查看：[MVP_DEVELOPMENT_PLAN.md](doc/MVP_DEVELOPMENT_PLAN.md)

## 💡 提示

- 开发时保持 Agent 运行，修改代码后重启即可
- Extension 修改后需要在 chrome://extensions/ 点击刷新
- 遇到问题先查看日志和控制台输出

---

**需要帮助？** 查看 [README_DEV.md](README_DEV.md) 获取更多信息
