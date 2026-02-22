@echo off
chcp 65001 >nul
echo ========================================
echo Proxy Manager Agent 启动工具
echo ========================================
echo.

cd /d "%~dp0.."

echo 正在启动 Agent...
echo.
echo 提示: 按 Ctrl+C 可以停止 Agent
echo.
echo ========================================
echo.

go run ./cmd/agent

if %errorlevel% neq 0 (
    echo.
    echo ========================================
    echo 错误: Agent 启动失败
    echo ========================================
    echo.
    echo 可能的原因:
    echo 1. Go 依赖未安装 - 请先运行 setup_go_proxy.bat
    echo 2. 端口被占用 - 检查 8765 端口是否被占用
    echo 3. 配置文件错误 - 检查 config.yaml
    echo.
    pause
    exit /b 1
)
