@echo off
chcp 65001 >nul
echo ========================================
echo 配置 pip 使用国内镜像（永久）
echo ========================================
echo.

set PIP_DIR=%USERPROFILE%\pip
set PIP_INI=%PIP_DIR%\pip.ini

echo 正在配置 pip 使用清华大学镜像...
echo.

REM 创建 pip 目录
if not exist "%PIP_DIR%" (
    mkdir "%PIP_DIR%"
    echo ✓ 创建配置目录: %PIP_DIR%
)

REM 创建配置文件
(
echo [global]
echo index-url = https://pypi.tuna.tsinghua.edu.cn/simple
echo [install]
echo trusted-host = pypi.tuna.tsinghua.edu.cn
) > "%PIP_INI%"

if %errorlevel% equ 0 (
    echo ✓ 配置文件已创建: %PIP_INI%
    echo.
    echo ========================================
    echo 配置成功！
    echo ========================================
    echo.
    echo 现在 pip install 会自动使用国内镜像
    echo 速度会快很多！
    echo.
    echo 配置内容:
    type "%PIP_INI%"
) else (
    echo.
    echo 错误: 配置文件创建失败
)

echo.
pause
