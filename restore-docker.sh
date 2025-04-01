#!/bin/bash
set -e

echo "===== Docker配置恢复工具 ====="
echo "此脚本将恢复Docker配置并验证功能"

# 等待用户确认Docker已启动
echo "请确保Docker Desktop已手动启动"
read -p "Docker Desktop是否已启动? (y/n): " started
if [ "$started" != "y" ]; then
    echo "请启动Docker Desktop后再继续"
    open -a Docker
    echo "等待Docker启动..."
    read -p "Docker Desktop现在是否已启动? (y/n): " started
    if [ "$started" != "y" ]; then
        echo "无法继续，请手动启动Docker Desktop后重试"
        exit 1
    fi
fi

# 恢复Docker配置文件
echo "恢复Docker配置文件..."

# 1. 恢复~/.docker/config.json
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
echo "已恢复~/.docker/config.json"

# 2. 恢复Docker Desktop设置
DOCKER_SETTINGS=~/Library/Group\ Containers/group.com.docker/settings.json
if [ -f "$DOCKER_SETTINGS.bak" ]; then
    echo "恢复之前备份的Docker设置..."
    cp "$DOCKER_SETTINGS.bak" "$DOCKER_SETTINGS"
else
    echo "创建标准Docker Desktop设置..."
    cat > ~/Library/Group\ Containers/group.com.docker/settings.json << EOF
{
  "experimental": true,
  "features": {
    "buildkit": true
  },
  "displayRestartDialog": false,
  "useDnsForwarder": true,
  "cpus": 4,
  "memoryMiB": 8192,
  "useCredentialHelper": true,
  "useGrpcfuse": false,
  "filesharingDirectories": [
    "/Users",
    "/Volumes",
    "/private",
    "/tmp",
    "/var/folders"
  ]
}
EOF
fi

# 等待Docker引擎就绪
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
        echo "请尝试手动重启Docker Desktop"
        exit 1
    fi
done

# 重新安装QEMU支持
echo "重新安装QEMU架构支持..."
docker run --rm --privileged tonistiigi/binfmt:latest --install all

# 测试Docker配置
echo "测试Docker基本功能..."
echo "当前系统: $(uname -m)"
docker version

# 运行简单容器测试
echo "测试容器功能..."
if docker run --rm hello-world; then
    echo "本地容器测试通过!"
else
    echo "本地容器测试失败"
    exit 1
fi

# 测试架构模拟
echo "测试x86_64架构模拟..."
if docker run --rm --platform linux/amd64 alpine uname -m; then
    echo "x86_64架构模拟测试通过!"
else
    echo "x86_64架构模拟测试失败"
    exit 1
fi

echo ""
echo "===== Docker配置已恢复 ====="
echo "Docker功能测试通过，现在应该可以正常使用"
echo ""
echo "如果需要测试更多功能，请运行:"
echo "./direct-test.sh" 