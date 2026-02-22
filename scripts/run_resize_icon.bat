@echo off
chcp 65001 >nul

REM 切换到项目根目录（scripts 的上级目录）
cd /d "%~dp0.."

echo ========================================
echo 图标生成工具
echo ========================================
echo.
echo 当前目录: %CD%
echo.

REM 检查 Python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo 错误: 未找到 Python
    echo.
    echo 请安装 Python: https://www.python.org/downloads/
    echo 或使用在线工具: https://www.favicon-generator.org/
    echo.
    pause
    exit /b 1
)

echo ✓ Python 已安装
echo.

REM 检查 Pillow
python -c "import PIL" >nul 2>&1
if %errorlevel% neq 0 (
    echo Pillow 未安装，正在使用国内镜像安装...
    pip install -i https://pypi.tuna.tsinghua.edu.cn/simple Pillow
    if %errorlevel% neq 0 (
        pip install -i https://mirrors.aliyun.com/pypi/simple/ Pillow
        if %errorlevel% neq 0 (
            echo.
            echo 错误: Pillow 安装失败
            pause
            exit /b 1
        )
    )
)

echo ✓ Pillow 已安装
echo.

REM 运行图标生成脚本
echo 正在生成图标...
python scripts\resize_icon.py

if %errorlevel% neq 0 (
    echo.
    echo 错误: 图标生成失败
    pause
    exit /b 1
)

echo.
pause
