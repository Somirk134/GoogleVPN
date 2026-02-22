@echo off
chcp 65001 >nul
echo ========================================
echo Pillow 快速安装工具（使用国内镜像）
echo ========================================
echo.

echo 正在使用清华大学镜像安装 Pillow...
echo.

pip install -i https://pypi.tuna.tsinghua.edu.cn/simple Pillow

if %errorlevel% neq 0 (
    echo.
    echo 清华镜像失败，尝试阿里云镜像...
    pip install -i https://mirrors.aliyun.com/pypi/simple/ Pillow
    
    if %errorlevel% neq 0 (
        echo.
        echo 阿里云镜像失败，尝试豆瓣镜像...
        pip install -i https://pypi.douban.com/simple Pillow
        
        if %errorlevel% neq 0 (
            echo.
            echo ========================================
            echo 错误: 所有镜像都失败了
            echo ========================================
            echo.
            echo 建议:
            echo 1. 检查网络连接
            echo 2. 或者跳过图标生成，手动准备图标
            echo.
            pause
            exit /b 1
        )
    )
)

echo.
echo ========================================
echo Pillow 安装成功！
echo ========================================
echo.
pause
