package main

import (
	"context"
	"flag"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"proxy-manager/internal/config"
	"proxy-manager/internal/logger"
)

const Version = "1.0.0"

func main() {
	// 解析命令行参数
	configFile := flag.String("config", "config.yaml", "config file path")
	version := flag.Bool("version", false, "show version")
	flag.Parse()

	// 显示版本
	if *version {
		fmt.Printf("Proxy Manager Agent v%s\n", Version)
		os.Exit(0)
	}

	// 加载配置
	cfg, err := config.Load(*configFile)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Failed to load config: %v\n", err)
		os.Exit(1)
	}

	// 初始化日志
	log, err := logger.New(cfg.LogLevel, cfg.LogDir)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Failed to initialize logger: %v\n", err)
		os.Exit(1)
	}
	defer log.Sync()

	log.Info("Starting Proxy Manager Agent", "version", Version)

	// 创建应用实例
	app, err := NewApplication(cfg, log)
	if err != nil {
		log.Error("Failed to create application", "error", err)
		os.Exit(1)
	}

	// 启动应用
	if err := app.Start(); err != nil {
		log.Error("Failed to start application", "error", err)
		os.Exit(1)
	}

	// 等待退出信号
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, os.Interrupt, syscall.SIGTERM)
	sig := <-sigCh
	log.Info("Received shutdown signal", "signal", sig.String())

	// 优雅关闭
	if err := app.Stop(); err != nil {
		log.Error("Error during shutdown", "error", err)
		os.Exit(1)
	}

	log.Info("Proxy Manager Agent stopped")
}

// Application 应用主结构
type Application struct {
	cfg    *config.Config
	logger *logger.Logger
	ctx    context.Context
	cancel context.CancelFunc
	server *http.Server
}

// NewApplication 创建应用实例
func NewApplication(cfg *config.Config, log *logger.Logger) (*Application, error) {
	ctx, cancel := context.WithCancel(context.Background())

	app := &Application{
		cfg:    cfg,
		logger: log,
		ctx:    ctx,
		cancel: cancel,
	}

	return app, nil
}

// Start 启动应用
func (app *Application) Start() error {
	// 创建 HTTP 服务器
	mux := http.NewServeMux()
	
	// 添加 CORS 中间件
	handler := corsMiddleware(mux)
	
	// 注册路由
	mux.HandleFunc("/api/v1/status", app.handleStatus)
	mux.HandleFunc("/api/v1/proxies", app.handleProxies)
	
	app.server = &http.Server{
		Addr:    app.cfg.Listen,
		Handler: handler,
	}
	
	// 启动服务器
	go func() {
		app.logger.Info("HTTP server listening", "address", app.cfg.Listen)
		if err := app.server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			app.logger.Error("HTTP server error", "error", err)
		}
	}()
	
	app.logger.Info("Application started successfully")
	return nil
}

// Stop 停止应用
func (app *Application) Stop() error {
	app.cancel()
	
	// 关闭 HTTP 服务器
	if app.server != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		
		if err := app.server.Shutdown(ctx); err != nil {
			app.logger.Error("Failed to shutdown HTTP server", "error", err)
		}
	}
	
	app.logger.Info("Application stopped")
	return nil
}

// CORS 中间件
func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}
		
		next.ServeHTTP(w, r)
	})
}

// API 处理函数
func (app *Application) handleStatus(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(`{
		"code": 0,
		"message": "success",
		"data": {
			"version": "` + Version + `",
			"uptime": 0,
			"core": {
				"running": false,
				"version": "unknown"
			}
		}
	}`))
}

func (app *Application) handleProxies(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(`{
		"code": 0,
		"message": "success",
		"data": {
			"proxies": {}
		}
	}`))
}
