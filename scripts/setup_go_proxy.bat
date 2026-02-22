@echo off
chcp 65001 >nul
echo ========================================
echo Go 代理配置工具
echo ========================================
echo.

echo 正在配置 Go 代理...
echo.

echo [1/3] 设置 GOPROXY 为国内镜像
go env -w GOPROXY=https://goproxy.cn,direct
if %errorlevel% neq 0 (
    echo 错误: 设置 GOPROXY 失败
    pause
    exit /b 1
)
echo ✓ GOPROXY 设置成功

echo.
echo [2/3] 关闭 GOSUMDB 校验
go env -w GOSUMDB=off
if %errorlevel% neq 0 (
    echo 错误: 设置 GOSUMDB 失败
    pause
    exit /b 1
)
echo ✓ GOSUMDB 设置成功

echo.
echo [3/3] 下载 Go 依赖包
go mod download
if %errorlevel% neq 0 (
    echo.
    echo 警告: 依赖下载失败，尝试使用备用镜像...
    echo.
    go env -w GOPROXY=https://goproxy.io,direct
    go mod download
    if %errorlevel% neq 0 (
        echo.
        echo 错误: 依赖下载仍然失败
        echo 请检查网络连接或尝试手动配置代理
        pause
        exit /b 1
    )
)
echo ✓ 依赖下载成功

echo.
echo ========================================
echo 配置完成！
echo ========================================
echo.
echo 当前 Go 环境配置:
go env GOPROXY
go env GOSUMDB
echo.
echo 现在可以运行项目了！
echo.
pause
