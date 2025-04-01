#!/bin/bash
set -e

echo "===== 尝试修复包安装问题 ====="

# 备份原始Dockerfile
if [ -f "Dockerfile.x86" ]; then
    echo "备份原始Dockerfile.x86..."
    cp Dockerfile.x86 Dockerfile.x86.bak
fi

# 复制新的Dockerfile
echo "使用修复后的Dockerfile.x86.new..."
cp Dockerfile.x86.new Dockerfile.x86

# 检查修复是否成功
echo "尝试构建测试镜像..."
docker build -t test-netcat-install -f test-netcat.Dockerfile .

echo "如果测试镜像构建成功，尝试构建完整应用镜像..."
docker build -t ad-workflow-x86:latest -f Dockerfile.x86 . || {
    echo "构建失败，请查看错误信息" 
    exit 1
}

echo "镜像构建成功，现在可以使用以下命令导出镜像:"
echo "./build-and-export-x86.sh" 