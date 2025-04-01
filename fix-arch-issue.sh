#!/bin/bash
set -e

echo "===== M1 Mac架构兼容性修复工具 ====="
echo "此脚本将修复Docker在M1 Mac上处理x86_64镜像的问题"

# 1. 确保QEMU支持已安装
echo "步骤1: 安装/更新QEMU支持..."
docker run --rm --privileged multiarch/qemu-user-static --reset -p yes

# 2. 强制更新镜像拉取工具
echo "步骤2: 配置Docker引擎..."
cat > ~/Library/Group\ Containers/group.com.docker/settings.json << EOF
{
  "experimental": true,
  "builder": {
    "gc": {
      "enabled": true,
      "defaultKeepStorage": "20GB"
    }
  }
}
EOF

# 3. 确保buildx正确安装
echo "步骤3: 确保buildx正确安装..."
docker buildx install
docker buildx ls

# 4. 测试多架构支持
echo "步骤4: 测试架构支持..."
echo "当前系统架构: $(uname -m)"
echo "Docker支持的架构:"
docker run --rm --platform linux/amd64 alpine uname -m
docker run --rm --platform linux/arm64 alpine uname -m

echo "===== 准备启动测试容器 ====="
echo "尝试使用非压缩方式拉取MySQL镜像..."

# 5. 使用特定方式拉取MySQL镜像
echo "步骤5: 拉取MySQL镜像(禁用压缩)..."
DOCKER_CLI_EXPERIMENTAL=enabled docker pull --platform linux/amd64 mysql:5.7.43

echo "===== 创建测试环境 ====="
# 创建测试网络
docker network create test-network || true

# 创建必要的目录文件
mkdir -p ./secrets
echo "testroot" > ./secrets/mysql_root_password.txt
echo "testpass" > ./secrets/mysql_password.txt
chmod 600 ./secrets/mysql_root_password.txt ./secrets/mysql_password.txt

# 创建测试compose文件
cat > docker-compose.arch-test.yml << EOF
version: '3.8'

services:
  mysql:
    platform: linux/amd64
    image: mysql:5.7.43
    container_name: arch-test-mysql
    environment:
      MYSQL_ROOT_PASSWORD_FILE: /run/secrets/db_root_password
      MYSQL_DATABASE: ad_workflow
      MYSQL_USER: ad_workflow
      MYSQL_PASSWORD_FILE: /run/secrets/db_password
    ports:
      - "3307:3306"
    secrets:
      - db_root_password
      - db_password
    networks:
      - test-network
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
      interval: 5s
      timeout: 5s
      retries: 10

  app:
    platform: linux/amd64
    image: ad-workflow-x86:latest
    container_name: arch-test-app
    depends_on:
      mysql:
        condition: service_healthy
    environment:
      DATABASE_URL: mysql://ad_workflow:testpass@mysql:3306/ad_workflow
      MYSQL_HOST: mysql
      MYSQL_USER: ad_workflow
      MYSQL_PASSWORD_FILE: /run/secrets/db_password
      MYSQL_DATABASE: ad_workflow
      NEXTAUTH_URL: http://localhost:3000
      NEXTAUTH_SECRET: Xo0W6XZGEWcNIyFnSqSsD+aLRcMQfDcLkK7Rp71wsqE=
    ports:
      - "3000:3000"
    secrets:
      - db_password
    networks:
      - test-network
    command: ["./scripts/start-x86.sh"]

networks:
  test-network:
    driver: bridge

secrets:
  db_root_password:
    file: ./secrets/mysql_root_password.txt
  db_password:
    file: ./secrets/mysql_password.txt
EOF

echo "===== 脚本执行完成 ====="
echo "请执行以下命令测试环境:"
echo "1. 启动测试环境: docker-compose -f docker-compose.arch-test.yml up -d"
echo "2. 查看应用日志: docker logs arch-test-app"
echo "3. 测试应用健康状态: curl -v http://localhost:3000/api/health"
echo "4. 清理测试环境: docker-compose -f docker-compose.arch-test.yml down" 