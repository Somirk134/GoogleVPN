.PHONY: build run clean test install

# 构建 Agent
build:
	go build -o build/proxy-agent.exe ./cmd/agent

# 运行 Agent
run:
	go run ./cmd/agent

# 清理构建产物
clean:
	rm -rf build/
	rm -rf logs/
	rm -rf data/cache/

# 运行测试
test:
	go test -v ./...

# 安装依赖
install:
	go mod download
	go mod tidy

# 格式化代码
fmt:
	go fmt ./...

# 代码检查
lint:
	golangci-lint run

# 构建 Extension
build-extension:
	cd extension && zip -r ../build/proxy-manager.zip . -x "*.git*"
