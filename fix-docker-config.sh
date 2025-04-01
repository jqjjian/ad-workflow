#!/bin/bash
set -e

echo "===== 修复Docker配置 ====="

# 1. 修复配置文件格式问题
echo "修复Docker配置文件格式..."
mkdir -p ~/.docker
cat > ~/.docker/config.json << EOF
{
  "experimental": "enabled",
  "features": {
    "buildkit": "true"
  }
}
EOF
chmod 600 ~/.docker/config.json

# 2. 确保Docker正在运行
echo "检查Docker状态..."
if ! pgrep -x Docker > /dev/null; then
    echo "Docker未运行，尝试启动Docker..."
    open -a Docker
    echo "等待Docker启动..."
    for i in {1..30}; do
        echo -n "."
        sleep 2
        if pgrep -x Docker > /dev/null; then
            echo "Docker已启动!"
            break
        fi
        if [ $i -eq 30 ]; then
            echo "Docker启动超时，请手动启动Docker Desktop并重试。"
            exit 1
        fi
    done
else
    echo "Docker已经在运行。"
fi

# 等待Docker引擎完全准备好
echo "等待Docker引擎就绪..."
for i in {1..30}; do
    if docker info &>/dev/null; then
        echo "Docker引擎已就绪!"
        break
    fi
    echo -n "."
    sleep 2
    if [ $i -eq 30 ]; then
        echo "Docker引擎启动超时!"
        echo "请尝试以下操作："
        echo "1. 手动重启Docker Desktop"
        echo "2. 检查Docker Desktop的设置"
        echo "3. 如果问题持续，可能需要重装Docker Desktop"
        exit 1
    fi
done

# 简化测试
echo "===== 测试Docker配置 ====="
echo "当前系统架构: $(uname -m)"
docker version
docker info | grep -E "Arch|OS"

# 测试基本容器运行能力
echo "尝试运行简单容器..."
docker run --rm hello-world

echo ""
echo "===== 基本测试完成 ====="
echo "如果上述命令成功执行，基本Docker功能已修复"
echo ""
echo "接下来尝试运行Alpine容器测试架构模拟:"
echo "docker run --rm --platform linux/amd64 alpine uname -m"
echo ""
echo "如果成功，可以尝试使用之前创建的测试脚本:"
echo "./test-mysql-only.sh" 