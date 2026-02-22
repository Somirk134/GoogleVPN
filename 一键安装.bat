@echo off
chcp 65001 >nul
title Proxy Manager - 一键安装

:menu
cls
echo ╔════════════════════════════════════════╗
echo ║   Proxy Manager - 一键安装工具         ║
echo ╚════════════════════════════════════════╝
echo.
echo 请选择操作:
echo.
echo [1] 生成 Extension 图标
echo [2] 配置 Go 代理并下载依赖
echo [3] 启动 Agent 服务
echo [4] 完整安装（执行 1+2）
echo [5] 查看帮助
echo [0] 退出
echo.
set /p choice=请输入选项 (0-5): 

if "%choice%"=="1" goto generate_icons
if "%choice%"=="2" goto setup_go
if "%choice%"=="3" goto start_agent
if "%choice%"=="4" goto full_install
if "%choice%"=="5" goto help
if "%choice%"=="0" goto end
goto menu

:generate_icons
cls
echo ========================================
echo 生成 Extension 图标
echo ========================================
echo.
echo 正在检查 Python 环境...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo 错误: 未找到 Python
    echo.
    echo 请选择以下方案之一:
    echo 1. 安装 Python: https://www.python.org/downloads/
    echo 2. 使用在线工具: https://www.favicon-generator.org/
    echo 3. 手动创建图标文件
    echo.
    pause
    goto menu
)

echo ✓ Python 已安装
echo.
echo 正在检查 Pillow 库...
python -c "import PIL" >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo Pillow 库未安装，正在安装...
    pip install Pillow
    if %errorlevel% neq 0 (
        echo.
        echo 错误: Pillow 安装失败
        pause
        goto menu
    )
)

echo ✓ Pillow 已安装
echo.
echo 正在生成图标...
python scripts\resize_icon.py
echo.
pause
goto menu

:setup_go
cls
echo ========================================
echo 配置 Go 代理并下载依赖
echo ========================================
echo.
call scripts\setup_go_proxy.bat
goto menu

:start_agent
cls
echo ========================================
echo 启动 Agent 服务
echo ========================================
echo.
echo 提示: 按 Ctrl+C 可以停止服务
echo.
call scripts\start_agent.bat
goto menu

:full_install
cls
echo ========================================
echo 完整安装
echo ========================================
echo.
echo 步骤 1/2: 生成图标
echo ----------------------------------------
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo 警告: 未找到 Python，跳过图标生成
    echo 请手动准备图标文件或使用在线工具
    echo.
    pause
) else (
    python -c "import PIL" >nul 2>&1
    if %errorlevel% neq 0 (
        echo 正在安装 Pillow...
        pip install Pillow
    )
    python scripts\resize_icon.py
)

echo.
echo 步骤 2/2: 配置 Go 环境
echo ----------------------------------------
call scripts\setup_go_proxy.bat

echo.
echo ========================================
echo 安装完成！
echo ========================================
echo.
echo 下一步:
echo 1. 运行选项 [3] 启动 Agent 服务
echo 2. 打开 Chrome 浏览器
echo 3. 访问 chrome://extensions/
echo 4. 开启"开发者模式"
echo 5. 点击"加载已解压的扩展程序"
echo 6. 选择项目中的 extension 文件夹
echo.
pause
goto menu

:help
cls
echo ╔════════════════════════════════════════╗
echo ║              使用帮助                  ║
echo ╚════════════════════════════════════════╝
echo.
echo 【快速开始】
echo.
echo 1. 首次使用请选择 [4] 完整安装
echo    - 自动生成图标
echo    - 配置 Go 代理
echo    - 下载依赖
echo.
echo 2. 然后选择 [3] 启动 Agent 服务
echo.
echo 3. 在 Chrome 中加载 Extension:
echo    - 打开 chrome://extensions/
echo    - 开启"开发者模式"
echo    - 加载 extension 文件夹
echo.
echo 【常见问题】
echo.
echo Q: 图标生成失败？
echo A: 需要安装 Python 和 Pillow 库
echo    或使用在线工具: https://www.favicon-generator.org/
echo.
echo Q: Go 依赖下载失败？
echo A: 选择 [2] 配置 Go 代理
echo.
echo Q: Agent 启动失败？
echo A: 检查端口 8765 是否被占用
echo    查看 logs\agent.log 日志
echo.
echo 【文档】
echo.
echo - START_HERE.md - 快速开始
echo - QUICK_START.md - 详细步骤
echo - README_DEV.md - 开发指南
echo.
pause
goto menu

:end
cls
echo.
echo 感谢使用 Proxy Manager！
echo.
timeout /t 2 >nul
exit
