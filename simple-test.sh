#!/bin/bash
set -e

echo "===== 简化架构兼容性测试 ====="

# 检查必要工具
if ! command -v docker &> /dev/null; then
    echo "错误: 未安装Docker"
    exit 1
fi

# 显示架构信息
echo "当前系统架构: $(uname -m)"

# 创建网络
echo "创建Docker网络..."
docker network create test-net 2>/dev/null || true

# 清理之前可能存在的容器
echo "清理之前的测试容器..."
docker rm -f test-mysql test-app 2>/dev/null || true

# 预拉取MySQL镜像
echo "预拉取MySQL镜像..."
DOCKER_CLI_EXPERIMENTAL=enabled docker pull --platform linux/amd64 --disable-content-trust mysql:5.7.43 || {
    echo "使用备用方法拉取MySQL镜像..."
    docker run --rm --privileged multiarch/qemu-user-static --reset -p yes
    docker pull --platform linux/amd64 mysql:5.7.43
}

# 启动MySQL容器
echo "启动MySQL容器..."
docker run -d --platform linux/amd64 --name test-mysql \
    --network test-net \
    -e MYSQL_ROOT_PASSWORD=testroot \
    -e MYSQL_DATABASE=ad_workflow \
    -e MYSQL_USER=ad_workflow \
    -e MYSQL_PASSWORD=testpass \
    -p 3307:3306 \
    mysql:5.7.43

# 等待MySQL启动
echo "等待MySQL启动..."
for i in {1..30}; do
    if docker exec test-mysql mysqladmin ping -h localhost -u root --password=testroot &>/dev/null; then
        echo "MySQL已启动!"
        break
    fi
    echo -n "."
    sleep 2
    if [ $i -eq 30 ]; then
        echo "MySQL启动超时!"
        exit 1
    fi
done

# 确认本地镜像存在
echo "确认应用镜像存在..."
if ! docker images ad-workflow-x86:latest | grep -q 'ad-workflow-x86.*latest'; then
    echo "错误: 未找到ad-workflow-x86:latest镜像"
    echo "可能的解决方案:"
    echo "1. 请先构建镜像 (./build-and-export-x86.sh --load)"
    echo "2. 或者给现有镜像添加标签: docker tag 现有镜像ID ad-workflow-x86:latest"
    docker images | grep ad-workflow-x86
    exit 1
fi

# 启动应用容器
echo "启动应用容器..."
docker run -d --platform linux/amd64 --name test-app \
    --network test-net \
    -e DATABASE_URL=mysql://ad_workflow:testpass@test-mysql:3306/ad_workflow \
    -e MYSQL_HOST=test-mysql \
    -e MYSQL_USER=ad_workflow \
    -e MYSQL_PASSWORD=testpass \
    -e MYSQL_DATABASE=ad_workflow \
    -e NEXTAUTH_URL=http://localhost:3000 \
    -e NEXTAUTH_SECRET=Xo0W6XZGEWcNIyFnSqSsD+aLRcMQfDcLkK7Rp71wsqE= \
    -p 3000:3000 \
    ad-workflow-x86:latest

echo "应用启动中..."
sleep 10

# 检查应用状态
echo "应用日志:"
docker logs test-app

echo "检查应用健康状态..."
curl -s http://localhost:3000/api/health || echo "应用未响应健康检查"

echo ""
echo "===== 测试完成 ====="
echo "应用应该在http://localhost:3000运行"
echo "MySQL在localhost:3307可访问"
echo ""
echo "清理环境命令:"
echo "docker rm -f test-mysql test-app"
echo "docker network rm test-net" 