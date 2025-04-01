#!/bin/bash

# 确保脚本在出错时停止
set -e

echo "===== 开始导出工单系统Docker镜像 ====="

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

# 检查镜像是否存在
if ! docker image inspect ad-workflow:latest &> /dev/null; then
    echo "错误: ad-workflow:latest 镜像不存在，请先构建镜像"
    echo "提示: 可以使用 'docker build -t ad-workflow:latest .' 命令构建镜像"
    exit 1
fi

# 优化镜像（可选）
echo "是否要优化镜像大小(y/n)? "
read optimize
if [[ "$optimize" == "y" || "$optimize" == "Y" ]]; then
    echo "正在优化镜像大小..."
    # 压缩镜像层，减小体积
    docker run --rm -v /var/run/docker.sock:/var/run/docker.sock alpine/dfimage -sV=1.36 ad-workflow:latest > image-history.log
    echo "镜像历史已保存到 image-history.log"
fi

# 选择压缩级别
echo "选择压缩级别(1-9)，数字越大压缩率越高，但速度越慢(默认:6): "
read compress_level
if [[ ! "$compress_level" =~ ^[1-9]$ ]]; then
    compress_level=6
fi

# 导出镜像
echo "正在导出镜像，这可能需要几分钟..."
echo "使用压缩级别: $compress_level"
IMAGE_FILE="ad-workflow-image.tar.gz"
docker save ad-workflow:latest | gzip -$compress_level > $IMAGE_FILE

# 获取文件大小
FILE_SIZE=$(du -h $IMAGE_FILE | cut -f1)

echo "===== 导出完成 ====="
echo "镜像文件: $IMAGE_FILE (大小: $FILE_SIZE)"
echo "您可以将此文件提供给甲方，甲方可以使用以下命令导入镜像:"
echo "$ docker load < $IMAGE_FILE"
echo 
echo "导入后，可以使用docker-compose.yml启动应用:"
echo "$ docker-compose up -d"

# 创建部署包
echo "是否创建完整部署包(y/n)? "
read create_package
if [[ "$create_package" == "y" || "$create_package" == "Y" ]]; then
    echo "正在创建部署包..."
    
    # 调用prepare-package.sh脚本
    if [ -f prepare-package.sh ]; then
        chmod +x prepare-package.sh
        ./prepare-package.sh
    else
        echo "未找到prepare-package.sh脚本，无法创建部署包"
    fi
fi 