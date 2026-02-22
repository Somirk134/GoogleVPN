@echo off
chcp 65001 >nul
title Proxy Manager - 一键启动

cls
echo.
echo ════════════════════════════════════════
echo   Proxy Manager - 一键启动
echo ════════════════════════════════════════
echo.

REM 检查是否首次运行
if not exist "go.sum" (
    echo 【检测到首次运行，正在初始化...】
    echo.
    
    echo [1/3] 配置 Go 代理...
    go env -w GOPROXY=https://goproxy.cn,direct
    go env -w GOSUMDB=off
    echo ✓ Go 代理配置完成
    echo.
    
    echo [2/3] 下载依赖包（这可能需要几分钟）...
    echo.
    
    REM 先 tidy 再 download
    echo 正在整理依赖...
    go mod tidy
    
    echo 正在下载依赖包...
    go mod download
    
    REM 检查是否成功
    if not exist "go.sum" (
        echo.
        echo ⚠ 下载失败，尝试备用镜像 goproxy.io...
        go env -w GOPROXY=https://goproxy.io,direct
        go mod tidy
        go mod download
        
        if not exist "go.sum" (
            echo.
            echo ⚠ 仍然失败，尝试阿里云镜像...
            go env -w GOPROXY=https://mirrors.aliyun.com/goproxy/,direct
            go mod tidy
            go mod download
            
            if not exist "go.sum" (
                echo.
                echo ✗ 依赖下载失败，请检查网络连接
                echo.
                pause
                exit /b 1
            )
        )
    )
    
    echo ✓ 依赖下载完成
    echo.
    
    echo [3/3] 生成图标（可选）...
    python --version >nul 2>&1
    if %errorlevel% equ 0 (
        python -c "import PIL" >nul 2>&1
        if %errorlevel% neq 0 (
            echo 正在安装 Pillow...
            pip install -i https://pypi.tuna.tsinghua.edu.cn/simple Pillow >nul 2>&1
        )
        python scripts\resize_icon.py >nul 2>&1
        if %errorlevel% equ 0 (
            echo ✓ 图标生成成功
        ) else (
            echo ⚠ 图标生成失败（不影响使用）
        )
    ) else (
        echo ⚠ 未安装 Python，跳过图标生成
    )
    echo.
    echo ════════════════════════════════════════
    echo   初始化完成！
    echo ════════════════════════════════════════
    echo.
    timeout /t 2 >nul
)

cls
echo.
echo ════════════════════════════════════════
echo   Agent 正在启动...
echo ════════════════════════════════════════
echo.
echo 监听地址: http://127.0.0.1:8765
echo 代理端口: 7890
echo.
echo 提示: 按 Ctrl+C 可以停止
echo.
echo ════════════════════════════════════════
echo.

go run ./cmd/agent

if %errorlevel% neq 0 (
    echo.
    echo ════════════════════════════════════════
    echo   启动失败
    echo ════════════════════════════════════════
    echo.
    echo 可能原因:
    echo 1. 端口 8765 被占用
    echo 2. core\verge-mihomo.exe 缺失
    echo 3. 配置文件错误
    echo.
    echo 查看日志: logs\agent.log
    echo.
    pause
)
