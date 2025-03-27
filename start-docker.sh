#!/bin/bash

# 确保脚本在出错时停止
set -e

echo "===== 启动工单系统 Docker 容器 ====="

# 检查Docker是否安装
if ! command -v docker &> /dev/null; then
    echo "错误: Docker未安装，请先安装Docker"
    exit 1
fi

# 检查是否有足够权限运行Docker
if ! docker info &> /dev/null; then
    echo "错误: 无法连接到Docker，请确保有足够权限并且Docker服务正在运行"
    exit 1
fi

# 询问是否需要重新构建镜像
read -p "是否需要重新构建Docker镜像? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "开始构建Docker镜像..."
    docker build -t ad-workflow:latest .
    
    if [ $? -ne 0 ]; then
        echo "错误: Docker镜像构建失败"
        exit 1
    fi
    
    echo "Docker镜像构建成功"
else
    # 检查是否存在镜像
    if ! docker image inspect ad-workflow:latest &> /dev/null; then
        echo "错误: 未找到ad-workflow:latest镜像，将自动构建"
        docker build -t ad-workflow:latest .
        
        if [ $? -ne 0 ]; then
            echo "错误: Docker镜像构建失败"
            exit 1
        fi
    else
        echo "使用现有Docker镜像..."
    fi
fi

# 使用.env.docker文件启动容器
echo "使用.env.docker配置启动容器..."
ENV_FILE=".env.docker"

if [ ! -f "$ENV_FILE" ]; then
    echo "警告: $ENV_FILE 不存在，将使用默认配置"
else
    echo "使用 $ENV_FILE 中的配置"
fi

# 停止并移除现有容器
echo "停止并移除现有容器..."
docker compose down 2>/dev/null || true

# 启动容器
echo "启动容器..."
docker compose --env-file "$ENV_FILE" up -d

# 检查容器是否成功启动
if docker ps | grep "ad-workflow-app" > /dev/null; then
    echo "===== 启动成功 ====="
    echo "应用已在 http://localhost:3000 启动"
    echo "MySQL数据库在端口 3306 可访问"
    echo "可以使用以下命令查看日志:"
    echo "  docker logs -f ad-workflow-app"
else
    echo "===== 启动失败 ====="
    echo "容器未能成功启动，请查看日志获取更多信息:"
    echo "  docker logs ad-workflow-app"
fi 