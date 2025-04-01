#!/bin/bash
set -e

echo "===== 在M1 Mac上测试x86_64镜像 ====="

# 确保Docker可用
if ! command -v docker &> /dev/null; then
    echo "错误: Docker未安装或未运行" >&2
    exit 1
fi

# 启用QEMU架构支持
echo "启用跨架构支持..."
docker run --rm --privileged tonistiigi/binfmt --install all

# 创建测试用的secrets目录
mkdir -p test-secrets
echo "test_root_password" > test-secrets/mysql_root_password.txt
echo "test_password" > test-secrets/mysql_password.txt

# 创建临时测试配置
cat > docker-compose.test.yml << 'EOF'
version: '3.8'

services:
  mysql:
    image: mysql:5.7
    platform: linux/amd64
    container_name: test-mysql
    environment:
      MYSQL_ROOT_PASSWORD_FILE: /run/secrets/db_root_password
      MYSQL_DATABASE: ad_workflow
      MYSQL_USER: ad_workflow
      MYSQL_PASSWORD_FILE: /run/secrets/db_password
    secrets:
      - db_root_password
      - db_password
    ports:
      - "3306:3306"
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost", "-u", "ad_workflow", "--password=test_password", "--skip-ssl"]
      interval: 5s
      timeout: 5s
      retries: 3

  app:
    image: ad-workflow-x86:latest
    platform: linux/amd64
    container_name: test-app
    depends_on:
      mysql:
        condition: service_healthy
    environment:
      DATABASE_URL: mysql://ad_workflow:test_password@mysql:3306/ad_workflow?ssl=false
      MYSQL_USER: ad_workflow
      MYSQL_PASSWORD: test_password
      NEXTAUTH_URL: http://localhost:3000
      NEXTAUTH_SECRET: test_secret_key_for_local_testing
      PRISMA_BINARY_TARGETS: "linux-musl-x64-openssl-3.0.x"
      PRISMA_ENGINE_PROTOCOL: "json"
      PRISMA_CLI_JS_ONLY: "true"
    secrets:
      - db_password
    ports:
      - "3000:3000"
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3000/api/health"]
      interval: 10s
      timeout: 5s
      retries: 3
      start_period: 15s
    command: ["./scripts/start-x86.sh"]

secrets:
  db_root_password:
    file: ./test-secrets/mysql_root_password.txt
  db_password:
    file: ./test-secrets/mysql_password.txt
EOF

# 确保镜像存在
if ! docker images | grep -q ad-workflow-x86; then
    echo "尝试构建镜像..."
    docker build -t ad-workflow-x86:latest -f Dockerfile.x86 .
fi

echo "启动测试环境..."
docker compose -f docker-compose.test.yml down -v || true
docker compose -f docker-compose.test.yml up -d

echo "等待容器启动..."
sleep 10

# 监控应用状态
echo "检查应用状态..."
MAX_RETRIES=15
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if docker ps | grep -q "test-app" && docker ps | grep -q "test-mysql"; then
        APP_STATUS=$(docker inspect --format='{{.State.Health.Status}}' test-app 2>/dev/null || echo "starting")
        MYSQL_STATUS=$(docker inspect --format='{{.State.Health.Status}}' test-mysql 2>/dev/null || echo "starting")
        
        echo "MySQL状态: $MYSQL_STATUS, 应用状态: $APP_STATUS"
        
        if [ "$APP_STATUS" = "healthy" ] && [ "$MYSQL_STATUS" = "healthy" ]; then
            echo "===== 测试成功! ====="
            echo "应用可以通过 http://localhost:3000 访问"
            echo ""
            echo "容器日志:"
            docker compose -f docker-compose.test.yml logs --tail=20 app
            echo ""
            echo "要停止测试环境，请运行:"
            echo "docker compose -f docker-compose.test.yml down -v"
            exit 0
        fi
    else
        echo "容器未运行，检查错误..."
        docker compose -f docker-compose.test.yml logs
        echo "===== 测试失败 ====="
        docker compose -f docker-compose.test.yml down -v
        exit 1
    fi
    
    RETRY_COUNT=$((RETRY_COUNT+1))
    echo "等待服务就绪 ($RETRY_COUNT/$MAX_RETRIES)..."
    sleep 10
done

echo "达到最大重试次数，检查日志获取更多信息:"
docker compose -f docker-compose.test.yml logs
echo "===== 测试超时 ====="
echo "您可以手动检查容器状态:"
echo "docker ps"
echo "docker compose -f docker-compose.test.yml logs app"
echo ""
echo "要停止测试环境，请运行:"
echo "docker compose -f docker-compose.test.yml down -v"
