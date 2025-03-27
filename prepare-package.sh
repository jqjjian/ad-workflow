#!/bin/bash

# 确保脚本在出错时停止
set -e

echo "===== 准备工单系统部署包 ====="

# 创建临时目录
TEMP_DIR="./deploy_package"
mkdir -p $TEMP_DIR

echo "1. 复制必要文件..."
cp docker-compose.yml $TEMP_DIR/
cp .env.example $TEMP_DIR/.env.example
cp GUIDE.md $TEMP_DIR/README.md
cp DEPLOYMENT.md $TEMP_DIR/
cp TROUBLESHOOTING.md $TEMP_DIR/

# 创建简易导入脚本
cat > $TEMP_DIR/setup.sh << 'EOF'
#!/bin/bash
set -e

echo "===== 工单系统部署脚本 ====="

# 检查是否存在镜像文件
if [ ! -f ad-workflow-image.tar.gz ]; then
    echo "错误: 未找到镜像文件 ad-workflow-image.tar.gz"
    exit 1
fi

# 检查是否存在Docker
if ! command -v docker &> /dev/null; then
    echo "错误: Docker未安装，请先安装Docker"
    exit 1
fi

# 检查是否存在Docker Compose
if ! command -v docker-compose &> /dev/null; then
    echo "错误: Docker Compose未安装，请先安装Docker Compose"
    exit 1
fi

# 检查是否存在.env文件，不存在则复制示例文件
if [ ! -f .env ]; then
    echo "未找到.env文件，正在从.env.example创建..."
    cp .env.example .env
    echo "请编辑.env文件设置您的环境配置"
    echo "可以使用 nano .env 命令编辑"
fi

# 导入Docker镜像
echo "正在导入Docker镜像，这可能需要几分钟..."
docker load < ad-workflow-image.tar.gz
echo "Docker镜像导入完成"

# 启动服务
echo "正在启动服务..."
docker-compose up -d

echo "===== 部署完成 ====="
echo "请通过浏览器访问: http://服务器IP:3000"
echo "默认管理员账户: admin"
echo "默认密码: Aa123123"
echo "请登录后立即修改默认密码"
EOF

chmod +x $TEMP_DIR/setup.sh

echo "2. 检查导出镜像是否存在..."
if [ -f ad-workflow-image.tar.gz ]; then
    echo "发现镜像文件，复制到部署包..."
    cp ad-workflow-image.tar.gz $TEMP_DIR/
else
    echo "未找到镜像文件，请先运行 ./export-image.sh 导出镜像"
    echo "然后再次运行此脚本"
    rm -rf $TEMP_DIR
    exit 1
fi

# 创建最终压缩包
PACKAGE_NAME="ad-workflow-deploy.tar.gz"
echo "3. 创建最终压缩包 $PACKAGE_NAME..."
tar -czf $PACKAGE_NAME -C $TEMP_DIR .

# 清理临时目录
rm -rf $TEMP_DIR

echo "===== 准备完成 ====="
echo "部署包: $PACKAGE_NAME"
echo "此文件包含了部署所需的所有内容，可以直接提供给甲方"
echo "甲方只需解压此文件，然后运行 setup.sh 即可完成部署" 