#!/bin/bash

echo "===== Docker配置和服务验证 ====="

# 检查配置文件
echo "检查配置文件 ~/.docker/config.json:"
if [ -f ~/.docker/config.json ]; then
  echo "配置文件存在"
  cat ~/.docker/config.json
else
  echo "配置文件不存在"
fi

# 检查Docker进程
echo ""
echo "检查Docker进程:"
ps aux | grep -i docker | grep -v grep

# 检查Docker Desktop应用
echo ""
echo "检查Docker Desktop应用:"
ls -la /Applications/Docker.app 2>/dev/null || echo "Docker Desktop可能未安装"

# 检查Docker版本
echo ""
echo "Docker版本信息:"
docker --version 2>&1

# 尝试启动Docker Desktop
echo ""
echo "尝试启动Docker Desktop..."
open -a Docker 2>/dev/null || echo "无法启动Docker Desktop"
echo "请确保Docker Desktop完全启动（查看菜单栏图标）"
echo "启动后请手动运行: docker ps" 