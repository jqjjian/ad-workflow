#!/bin/bash
set -e

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
echo "配置文件已修复"

echo "验证Docker服务状态..."
docker --version
docker ps

echo "如果上面没有显示警告信息，说明问题已解决" 