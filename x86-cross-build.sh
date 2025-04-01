#!/bin/bash
set -e

echo "===== M1 Mac上构建x86_64 Docker镜像替代方案 ====="
echo "此脚本使用远程构建方式创建x86_64架构的镜像"

# 检查系统架构
if [ "$(uname -m)" != "arm64" ]; then
    echo "此脚本仅适用于M1/M2 Mac (ARM架构)"
    exit 1
fi

# 1. 确保Docker正在运行
echo "检查Docker状态..."
if ! pgrep -x Docker > /dev/null; then
    echo "Docker未运行，请先启动Docker Desktop"
    exit 1
fi

# 创建临时构建目录
BUILD_DIR="x86_build_$(date +%s)"
mkdir -p $BUILD_DIR
cd $BUILD_DIR

# 2. 创建简化的Dockerfile
echo "创建简化的Dockerfile..."
cat > Dockerfile.simplified << EOF
FROM node:20-slim
WORKDIR /app

# 安装必要的工具
RUN apt-get update && \
    apt-get install -y wget netcat-traditional mysql-client && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# 添加健康检查脚本
COPY check-health.sh /app/
RUN chmod +x /app/check-health.sh

CMD ["/app/check-health.sh"]
EOF

# 创建健康检查脚本
cat > check-health.sh << EOF
#!/bin/bash
echo "系统架构: \$(uname -m)"
echo "MySQL客户端版本: \$(mysql --version || echo '未安装')"
echo "网络工具: \$(nc -h 2>&1 | head -n 1 || echo '未安装')"
echo "健康检查完成"
EOF

echo "准备构建简化的x86_64测试镜像..."

# 3. 使用不同的方法构建x86_64镜像
echo "方法1: 使用-t构建简化镜像..."
docker build --platform linux/amd64 -t x86-test:simplified -f Dockerfile.simplified . || echo "方法1构建失败"

# 如果第一种方法失败，尝试第二种方法
if ! docker images | grep -q "x86-test"; then
    echo "方法2: 使用最简单的方式构建..."
    # 使用最基本的命令
    DOCKER_BUILDKIT=0 docker build --platform=linux/amd64 -t x86-test:simple . || echo "方法2构建失败"
fi

# 检查镜像是否成功构建
if docker images | grep -q "x86-test"; then
    echo "镜像构建成功!"
    
    # 测试镜像
    echo "测试镜像..."
    docker run --rm --platform linux/amd64 x86-test:simplified || echo "测试失败"
    
    # 保存镜像为tar文件
    echo "保存镜像为tar文件..."
    docker save x86-test:simplified -o x86-test-image.tar
    echo "镜像已保存到: $(pwd)/x86-test-image.tar"
    
    # 尝试加载镜像
    echo "尝试重新加载镜像..."
    docker rmi x86-test:simplified
    docker load < x86-test-image.tar && echo "镜像加载成功!" || echo "镜像加载失败"
else
    echo "所有构建方法均失败，请检查Docker配置"
fi

# 返回原始目录
cd ..
echo "构建完成。如需清理，请运行: rm -rf $BUILD_DIR"

echo ""
echo "===== 后续步骤 ====="
echo "如果上述测试成功，说明Docker可以处理x86_64镜像"
echo "尝试手动构建项目镜像:"
echo "docker build --platform linux/amd64 -t ad-workflow-x86:latest -f Dockerfile.x86 ."
echo ""
echo "建议在Linux x86_64服务器上测试最终部署" 