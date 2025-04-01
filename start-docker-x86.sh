#!/bin/bash

# 确保脚本在出错时停止
set -e

echo "===== 启动工单系统 Docker 容器 (x86_64版本) ====="

# 检查Docker是否安装
if ! command -v docker &> /dev/null; then
    echo "错误: Docker未安装，请先安装Docker"
    exit 1
fi

# 检查Docker Compose是否安装
if ! command -v docker-compose &> /dev/null; then
    echo "错误: Docker Compose未安装，请先安装Docker Compose"
    exit 1
fi

# 检查是否有足够权限运行Docker
if ! docker info &> /dev/null; then
    echo "错误: 无法连接到Docker，请确保有足够权限并且Docker服务正在运行"
    exit 1
fi

# 确保secrets目录和文件存在
if [ ! -d "secrets" ]; then
    echo "创建secrets目录..."
    mkdir -p secrets
    
    # 生成默认密码
    echo "生成默认MySQL密码文件..."
    echo "mysql_root_password" > secrets/mysql_root_password.txt
    echo "ad_workflow_password" > secrets/mysql_password.txt
    
    echo "注意: 已创建默认密码文件。在生产环境中，请修改这些密码以增强安全性。"
fi

# 检查是否存在镜像，如果不存在则导入
if ! docker image inspect ad-workflow-x86:latest &> /dev/null; then
    echo "未找到ad-workflow-x86:latest镜像"
    if [ -f "ad-workflow-x86-image.tar.gz" ]; then
        echo "从文件导入镜像..."
        docker load < ad-workflow-x86-image.tar.gz
    else
        echo "错误: 未找到镜像文件ad-workflow-x86-image.tar.gz"
        exit 1
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
docker-compose -f docker-compose.yml down 2>/dev/null || true

# 启动容器
echo "启动容器..."
docker-compose -f docker-compose.yml --env-file "$ENV_FILE" up -d

# 检查容器是否成功启动
if docker ps | grep "ad-workflow-app" > /dev/null; then
    echo "===== 启动成功 ====="
    echo "应用已在 http://localhost:3000 启动"
    echo "MySQL数据库在端口 3306 可访问"
    echo "可以使用以下命令查看日志:"
    echo "  docker-compose logs -f app"
else
    echo "===== 启动失败 ====="
    echo "容器未能成功启动，请查看日志获取更多信息:"
    echo "  docker-compose logs app"
fi 