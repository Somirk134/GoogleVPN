package config

import (
	"fmt"
	"os"

	"github.com/spf13/viper"
)

// Config 应用配置
type Config struct {
	Listen   string     `mapstructure:"listen"`
	LogLevel string     `mapstructure:"log_level"`
	LogDir   string     `mapstructure:"log_dir"`
	DataDir  string     `mapstructure:"data_dir"`
	Core     CoreConfig `mapstructure:"core"`
}

// CoreConfig Core 配置
type CoreConfig struct {
	Executable string `mapstructure:"executable"`
	Config     string `mapstructure:"config"`
	API        string `mapstructure:"api"`
	ProxyPort  int    `mapstructure:"proxy_port"`
}

// Load 加载配置文件
func Load(path string) (*Config, error) {
	// 检查文件是否存在
	if _, err := os.Stat(path); os.IsNotExist(err) {
		// 首次运行，从示例创建默认配置
		if err := createDefaultConfig(path); err != nil {
			return nil, fmt.Errorf("failed to create default config: %w", err)
		}
	}

	viper.SetConfigFile(path)
	viper.SetConfigType("yaml")

	// 设置默认值
	setDefaults()

	// 读取配置
	if err := viper.ReadInConfig(); err != nil {
		return nil, fmt.Errorf("failed to read config: %w", err)
	}

	// 解析到结构体
	var cfg Config
	if err := viper.Unmarshal(&cfg); err != nil {
		return nil, fmt.Errorf("failed to unmarshal config: %w", err)
	}

	// 验证配置
	if err := cfg.Validate(); err != nil {
		return nil, fmt.Errorf("invalid config: %w", err)
	}

	return &cfg, nil
}

// setDefaults 设置默认值
func setDefaults() {
	viper.SetDefault("listen", "127.0.0.1:8765")
	viper.SetDefault("log_level", "info")
	viper.SetDefault("log_dir", "./logs")
	viper.SetDefault("data_dir", "./data")
	viper.SetDefault("core.executable", "./core/verge-mihomo.exe")
	viper.SetDefault("core.config", "./core/config/config.yaml")
	viper.SetDefault("core.api", "http://127.0.0.1:9090")
	viper.SetDefault("core.proxy_port", 7890)
}

// createDefaultConfig 创建默认配置文件
func createDefaultConfig(path string) error {
	defaultConfig := `# Agent 配置文件
listen: "127.0.0.1:8765"
log_level: "info"
log_dir: "./logs"
data_dir: "./data"

core:
  executable: "./core/verge-mihomo.exe"
  config: "./core/config/config.yaml"
  api: "http://127.0.0.1:9090"
  proxy_port: 7890
`
	return os.WriteFile(path, []byte(defaultConfig), 0644)
}

// Validate 验证配置
func (c *Config) Validate() error {
	if c.Listen == "" {
		return fmt.Errorf("listen address is required")
	}

	if c.Core.Executable == "" {
		return fmt.Errorf("core executable is required")
	}

	if c.Core.Config == "" {
		return fmt.Errorf("core config is required")
	}

	if c.Core.ProxyPort <= 0 || c.Core.ProxyPort > 65535 {
		return fmt.Errorf("invalid proxy port: %d", c.Core.ProxyPort)
	}

	return nil
}
