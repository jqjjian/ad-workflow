#!/bin/bash

# 确保脚本在出错时停止
set -e

echo "===== 开始打包工单系统 ====="

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

# 创建临时目录
TEMP_DIR="./temp_package"
mkdir -p $TEMP_DIR

echo "1. 构建Docker镜像..."
docker build -t ad-workflow:latest .

echo "2. 导出Docker镜像..."
docker save ad-workflow:latest | gzip > $TEMP_DIR/ad-workflow-image.tar.gz

echo "3. 复制必要文件..."
cp docker-compose.yml $TEMP_DIR/
cp .env.example $TEMP_DIR/
cp DEPLOYMENT.md $TEMP_DIR/README.md

# 创建简易启动脚本
cat > $TEMP_DIR/start.sh << 'EOF'
#!/bin/bash
set -e

# 检查是否存在.env文件，不存在则复制示例文件
if [ ! -f .env ]; then
    echo "未找到.env文件，正在从.env.example创建..."
    cp .env.example .env
    echo "请编辑.env文件设置您的环境配置"
fi

# 导入Docker镜像
if [ ! -f .image_imported ]; then
    echo "正在导入Docker镜像，这可能需要几分钟..."
    docker load < ad-workflow-image.tar.gz
    touch .image_imported
    echo "Docker镜像导入完成"
fi

# 启动服务
echo "正在启动服务..."
docker-compose up -d

echo "启动完成！请通过浏览器访问: http://localhost:3000"
echo "默认管理员账户: admin"
echo "默认密码: Aa123123"
echo "请登录后立即修改默认密码"
EOF

chmod +x $TEMP_DIR/start.sh

# 创建打包文件
PACKAGE_NAME="ad-workflow-docker.tar.gz"
echo "4. 创建最终打包文件 $PACKAGE_NAME..."
tar -czf $PACKAGE_NAME -C $TEMP_DIR .

# 清理临时目录
rm -rf $TEMP_DIR

echo "===== 打包完成 ====="
echo "打包文件: $PACKAGE_NAME"
echo "请将此文件提供给甲方，并参考DEPLOYMENT.md进行部署" 