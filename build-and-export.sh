#!/bin/bash

# 确保脚本在出错时停止
set -e

echo "===== 一键式构建和导出工单系统Docker镜像 ====="

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

# 设置压缩级别
COMPRESS_LEVEL=6

# 处理命令行参数
while getopts ":c:h" opt; do
  case $opt in
    c)
      if [[ "$OPTARG" =~ ^[1-9]$ ]]; then
        COMPRESS_LEVEL=$OPTARG
      else
        echo "警告: 无效的压缩级别，使用默认值: 6"
      fi
      ;;
    h)
      echo "用法: $0 [-c 压缩级别(1-9)] [-h 显示帮助]"
      echo "  -c 压缩级别: 1-9之间的整数，数字越大压缩率越高，但速度越慢(默认:6)"
      echo "  -h: 显示此帮助信息"
      exit 0
      ;;
    \?)
      echo "无效选项: -$OPTARG" >&2
      exit 1
      ;;
    :)
      echo "选项 -$OPTARG 需要参数." >&2
      exit 1
      ;;
  esac
done

# 开始构建
echo "1. 开始构建Docker镜像..."
echo "使用Dockerfile构建镜像..."
docker build -t ad-workflow:latest .

# 检查构建是否成功
if ! docker image inspect ad-workflow:latest &> /dev/null; then
    echo "错误: 镜像构建失败"
    exit 1
fi

echo "2. 正在导出镜像(压缩级别: $COMPRESS_LEVEL)..."
IMAGE_FILE="ad-workflow-image.tar.gz"
docker save ad-workflow:latest | gzip -$COMPRESS_LEVEL > $IMAGE_FILE

# 获取文件大小
FILE_SIZE=$(du -h $IMAGE_FILE | cut -f1)

echo "3. 创建部署包..."
if [ -f prepare-package.sh ]; then
    chmod +x prepare-package.sh
    ./prepare-package.sh
else
    echo "警告: 未找到prepare-package.sh脚本，跳过创建部署包步骤"
fi

echo "===== 全部完成 ====="
echo "镜像文件: $IMAGE_FILE (大小: $FILE_SIZE)"
if [ -f ad-workflow-deploy.tar.gz ]; then
    PACKAGE_SIZE=$(du -h ad-workflow-deploy.tar.gz | cut -f1)
    echo "部署包: ad-workflow-deploy.tar.gz (大小: $PACKAGE_SIZE)"
    echo "您可以将部署包直接提供给甲方，里面包含了所有必要的部署文件和说明"
else
    echo "您可以将镜像文件提供给甲方，甲方可以使用以下命令导入镜像:"
    echo "$ docker load < $IMAGE_FILE"
fi

echo "部署完成后，可以通过 http://服务器IP:3000 访问应用" 