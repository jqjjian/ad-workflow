#!/bin/bash
set -e

echo "===== M1 Mac深度架构兼容性修复工具 ====="
echo "此脚本尝试从底层解决Docker在M1 Mac上的架构兼容性问题"

# 检查系统架构
if [ "$(uname -m)" != "arm64" ]; then
    echo "此脚本仅适用于M1/M2 Mac (ARM架构)"
    exit 1
fi

# 1. 重置Docker环境
echo "步骤1: 重置Docker环境..."
echo "注意: 这将停止所有运行中的容器"
docker system prune -f
docker stop $(docker ps -q) 2>/dev/null || true
docker rm $(docker ps -a -q) 2>/dev/null || true

# 2. 重置Docker Desktop设置
echo "步骤2: 重置Docker Desktop设置..."
killall Docker 2>/dev/null || true
sleep 2

# 3. 创建或修改.docker/config.json
echo "步骤3: 配置Docker客户端..."
mkdir -p ~/.docker
cat > ~/.docker/config.json << EOF
{
  "experimental": "enabled",
  "features": {
    "buildkit": true
  }
}
EOF
chmod 600 ~/.docker/config.json

# 4. 修复Docker Desktop设置
echo "步骤4: 配置Docker Desktop..."
DOCKER_SETTINGS=~/Library/Group\ Containers/group.com.docker/settings.json
if [ -f "$DOCKER_SETTINGS" ]; then
    echo "备份当前Docker设置..."
    cp "$DOCKER_SETTINGS" "$DOCKER_SETTINGS.bak"
fi

cat > ~/Library/Group\ Containers/group.com.docker/settings.json << EOF
{
  "experimental": true,
  "deprecatedCgroupv1": false,
  "builder": {
    "gc": {
      "enabled": true,
      "defaultKeepStorage": "20GB"
    }
  },
  "features": {
    "buildkit": true
  },
  "archivesGcSchedule": "daily",
  "emulatedVolumes": {
    "enabled": false
  },
  "displayRestartDialog": false,
  "useDnsForwarder": false,
  "filesharingDirectories": [
    "/Users",
    "/Volumes",
    "/private",
    "/tmp",
    "/var/folders"
  ]
}
EOF

# 5. 修复VirtioFS设置
echo "步骤5: 优化虚拟化设置..."
defaults write com.docker.docker VirtioFSEnabled -bool false
defaults write com.docker.docker displayRestartDialog -bool false
defaults write com.docker.docker showWelcomeOnLaunch -bool false

echo "即将重启Docker Desktop..."
echo "请在Docker Desktop完全启动后按回车键继续..."
open -a Docker
read -p "Docker已重启? (按回车继续)"

# 6. 安装Rosetta 2 (如果尚未安装)
echo "步骤6: 确保Rosetta 2已安装..."
if ! pgrep -q oahd; then
    softwareupdate --install-rosetta --agree-to-license
fi

# 7. 重新安装QEMU支持
echo "步骤7: 重新安装QEMU支持..."
docker run --rm --privileged tonistiigi/binfmt:latest --install all

# 8. 建立新的buildx构建器
echo "步骤8: 设置buildx..."
docker buildx rm builder 2>/dev/null || true
docker buildx create --name builder --driver docker-container --bootstrap
docker buildx use builder
docker buildx inspect --bootstrap

# 9. 测试新环境
echo "步骤9: 测试环境..."
echo "当前系统: $(uname -m)"
echo "测试x86_64容器:"
docker run --rm --platform linux/amd64 alpine uname -m

# 10. 修改之前的docker-compose.arch-test.yml文件
echo "步骤10: 更新docker-compose测试文件..."
cat > docker-compose.m1-fixed.yml << EOF
version: '3.8'

services:
  mysql:
    platform: linux/amd64
    image: mysql:5.7.43
    container_name: m1-test-mysql
    environment:
      MYSQL_ROOT_PASSWORD: testroot
      MYSQL_DATABASE: ad_workflow
      MYSQL_USER: ad_workflow
      MYSQL_PASSWORD: testpass
    ports:
      - "3307:3306"
    networks:
      - m1-test-network
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost", "-uroot", "-ptestroot"]
      interval: 5s
      timeout: 5s
      retries: 10
      start_period: 30s

# 应用服务先注释掉，等MySQL成功运行后再启用
#  app:
#    platform: linux/amd64
#    image: ad-workflow-x86:latest
#    container_name: m1-test-app
#    depends_on:
#      mysql:
#        condition: service_healthy
#    environment:
#      DATABASE_URL: mysql://ad_workflow:testpass@mysql:3306/ad_workflow
#      MYSQL_HOST: mysql
#      MYSQL_USER: ad_workflow
#      MYSQL_PASSWORD: testpass
#      MYSQL_DATABASE: ad_workflow
#      NEXTAUTH_URL: http://localhost:3000
#      NEXTAUTH_SECRET: Xo0W6XZGEWcNIyFnSqSsD+aLRcMQfDcLkK7Rp71wsqE=
#    ports:
#      - "3000:3000"
#    networks:
#      - m1-test-network
#    command: ["./scripts/start-x86.sh"]

networks:
  m1-test-network:
    driver: bridge
EOF

# 11. 创建替代测试脚本，使用最可靠的方法运行MySQL
cat > test-mysql-only.sh << EOF
#!/bin/bash
set -e

echo "===== 测试仅MySQL容器 ====="
# 清理旧容器
docker rm -f test-mysql 2>/dev/null || true

# 确保网络存在
docker network create test-net 2>/dev/null || true

# 拉取MySQL镜像 (不使用压缩)
echo "拉取MySQL镜像..."
docker pull --platform=linux/amd64 mysql:5.7.43

# 运行MySQL容器，使用最简化的参数
echo "启动MySQL容器..."
docker run -d --platform=linux/amd64 --name test-mysql \
  --network test-net \
  -e MYSQL_ROOT_PASSWORD=testroot \
  -e MYSQL_DATABASE=ad_workflow \
  -e MYSQL_USER=ad_workflow \
  -e MYSQL_PASSWORD=testpass \
  -p 3307:3306 \
  mysql:5.7.43

echo "MySQL容器已启动，30秒后检查状态..."
sleep 30

# 检查MySQL是否运行
if docker ps | grep -q test-mysql; then
  echo "MySQL容器运行中!"
  docker logs test-mysql
else
  echo "MySQL容器启动失败!"
  docker logs test-mysql
  exit 1
fi

echo ""
echo "如果MySQL成功运行，接下来可以修改docker-compose.m1-fixed.yml文件"
echo "取消注释app服务部分，然后运行:"
echo "docker-compose -f docker-compose.m1-fixed.yml up -d"
echo ""
echo "要清理环境，请运行: docker rm -f test-mysql"
EOF
chmod +x test-mysql-only.sh

echo "===== 修复脚本执行完成 ====="
echo "请先尝试单独测试MySQL:"
echo "./test-mysql-only.sh"
echo ""
echo "如果MySQL成功运行，再测试完整环境:"
echo "docker-compose -f docker-compose.m1-fixed.yml up -d" 