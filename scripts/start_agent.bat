@echo off
chcp 65001 >nul

REM 切换到项目根目录
cd /d "%~dp0.."

echo ========================================
echo Proxy Manager Agent 启动工具
echo ========================================
echo.
echo 当前目录: %CD%
echo.

REM 检查依赖是否已安装
echo 检查 Go 依赖...
go list -m all >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo 检测到依赖未安装，正在自动安装...
    echo.
    call scripts\setup_go_proxy.bat
    if %errorlevel% neq 0 (
        echo.
        echo 依赖安装失败，无法启动 Agent
        pause
        exit /b 1
    )
)

echo ✓ 依赖检查完成
echo.
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
    echo 1. 端口被占用 - 检查 8765 端口是否被占用
    echo 2. 配置文件错误 - 检查 config.yaml
    echo 3. Core 文件缺失 - 检查 core/verge-mihomo.exe
    echo.
    echo 查看日志: logs\agent.log
    echo.
    pause
    exit /b 1
)
