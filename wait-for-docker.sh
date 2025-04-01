#!/bin/bash

echo "===== 等待Docker完全启动 ====="
echo "此脚本将等待Docker守护进程准备就绪"

# 确保配置文件正确
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
echo "配置文件已设置"

# 尝试启动Docker Desktop
echo "确保Docker Desktop已启动..."
open -a Docker

# 等待Docker服务准备就绪
echo "等待Docker守护进程准备就绪..."
MAX_RETRIES=60
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
  if docker ps &>/dev/null; then
    echo "Docker守护进程已准备就绪!"
    docker --version
    docker ps
    echo "Docker配置已完全恢复!"
    exit 0
  fi
  
  echo -n "."
  RETRY_COUNT=$((RETRY_COUNT+1))
  sleep 2
done

echo ""
echo "等待超时! Docker守护进程未就绪"
echo "请检查Docker Desktop状态，可能需要重新启动应用"
echo "如果问题持续，尝试以下选项:"
echo "1. 重启Docker Desktop"
echo "2. 检查Docker Desktop的错误信息 (点击状态栏图标)"
echo "3. 重启计算机"
exit 1 