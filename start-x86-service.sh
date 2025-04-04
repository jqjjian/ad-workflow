#!/bin/bash
set -e

echo "===== 启动工单系统 x86 版本 ====="

# 检查Docker是否可用
if ! command -v docker &> /dev/null; then
    echo "错误: Docker未安装，请先安装Docker"
    exit 1
fi

if ! docker info &> /dev/null; then
    echo "错误: 无法连接到Docker，请确保有足够权限并且Docker服务正在运行"
    exit 1
fi

# 检查Docker Compose命令
if command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE="docker-compose"
elif command -v docker &> /dev/null && docker compose version &> /dev/null; then
    DOCKER_COMPOSE="docker compose"
else
    echo "错误: Docker Compose未安装，请先安装Docker Compose"
    exit 1
fi

# 确认所需文件存在
if [ ! -f "docker-compose.x86.yml" ]; then
    echo "错误: 未找到docker-compose.x86.yml文件"
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

# 获取服务器IP
echo "请输入服务器IP地址:"
read -p "> " SERVER_IP
if [ -z "$SERVER_IP" ]; then
  echo "未输入IP地址，将使用localhost作为默认值"
  SERVER_IP="localhost"
fi

# 环境变量设置
echo "配置环境变量，使用IP: $SERVER_IP"
export SERVER_IP=$SERVER_IP

# 创建配置文件确保持久化
echo "SERVER_IP=$SERVER_IP" > .env

# 部署环境的持久化设置
cat > nextauth-env.conf << EOF
# NextAuth配置
NEXTAUTH_URL=http://$SERVER_IP:3000
NEXTAUTH_URL_INTERNAL=http://$SERVER_IP:3000
NEXTAUTH_SECRET=Xo0W6XZGEWcNIyFnSqSsD+aLRcMQfDcLkK7Rp71wsqE=
NEXTAUTH_TRUST_HOST=true

# 前端应用设置
NEXT_PUBLIC_APP_URL=http://$SERVER_IP:3000

# 其它关键设置
SERVER_IP=$SERVER_IP
EOF

# 显示将使用的服务器信息
echo "将使用以下服务器IP/域名: $SERVER_IP"

# 询问是否开启加速模式
echo "是否开启加速模式(跳过依赖安装)? [Y/n]"
read -r USE_FAST_MODE
if [[ ! "$USE_FAST_MODE" =~ ^[Nn]$ ]]; then
    FAST_MODE=true
    echo "加速模式已开启，将跳过依赖安装"
else
    FAST_MODE=false
    echo "加速模式已关闭，将正常安装依赖"
fi

# 创建并配置.env.docker文件
if [ ! -f ".env.docker" ] || [ "$CHANGE_IP" = "y" ] || [ "$CHANGE_IP" = "Y" ]; then
    echo "更新环境配置文件..."
    cat > .env.docker << EOF
# 应用配置
APP_IMAGE=jqjjian/ad-workflow-x86:latest
APP_CONTAINER_NAME=ad-workflow-app-x86
APP_PORT=3000
NODE_ENV=production
NEXTAUTH_URL=http://${SERVER_IP}:3000
NEXTAUTH_SECRET=Xo0W6XZGEWcNIyFnSqSsD+aLRcMQfDcLkK7Rp71wsqE=
AUTH_SECRET=Xo0W6XZGEWcNIyFnSqSsD+aLRcMQfDcLkK7Rp71wsqE=
ACCESS_TOKEN_SECRET=ad776656d49f4adb840ef6187115fb8b
ACCESS_TOKEN_SECRET_TEST=ad776656d49f4adb840ef6187115fb8b
OPEN_API_URL=https://test-ua-gw.tec-develop.cn/uni-agency
OPEN_API_URL_TEST=https://test-ua-gw.tec-develop.cn/uni-agency
# 信任所有主机，解决Docker中的UntrustedHost错误
NEXTAUTH_URL_INTERNAL=http://${SERVER_IP}:3000
NEXTAUTH_TRUSTED_HOSTS=localhost,app,127.0.0.1,${SERVER_IP}

# MySQL配置
MYSQL_CONTAINER_NAME=ad-workflow-mysql-x86
MYSQL_HOST=mysql
MYSQL_DATABASE=ad_workflow
MYSQL_USER=ad_workflow
# MYSQL_PASSWORD会通过环境变量或密钥文件提供
MYSQL_PORT=3306
MYSQL_VOLUME_NAME=ad-workflow-mysql-data-x86

# 加速选项 - 跳过依赖安装
SKIP_TSX_INSTALL=${FAST_MODE}
SKIP_DEPENDENCIES_INSTALL=${FAST_MODE}

# 重要：Docker环境中的数据库连接URL
# DATABASE_URL会在启动脚本中动态设置为：
# mysql://\$MYSQL_USER:\$MYSQL_PWD@\${MYSQL_HOST:-mysql}:3306/\$MYSQL_DATABASE?ssl=false
# 请不要在此处硬编码DATABASE_URL
EOF
    echo "环境配置文件已更新"
fi

# 检查是否需要拉取镜像
echo "是否需要拉取最新镜像? [y/N]"
read -r PULL_IMAGE
if [[ "$PULL_IMAGE" =~ ^[Yy]$ ]]; then
    echo "拉取最新镜像..."
    docker pull jqjjian/ad-workflow-x86:latest
fi

# 停止并清理旧容器和卷
echo "清理之前的容器..."
$DOCKER_COMPOSE -f docker-compose.x86.yml down

echo "是否需要清理数据卷(将删除所有数据)? [y/N]"
read -r CLEAN_VOLUMES
if [[ "$CLEAN_VOLUMES" =~ ^[Yy]$ ]]; then
    echo "彻底清理所有容器和网络..."
    $DOCKER_COMPOSE -f docker-compose.x86.yml down --volumes --remove-orphans
    
    echo "查找与应用相关的卷..."
    VOLUMES=$(docker volume ls --filter "name=ad-workflow" -q)
    
    if [ -n "$VOLUMES" ]; then
        echo "发现以下卷，尝试删除："
        echo "$VOLUMES"
        
        # 确保没有使用这些卷的容器
        docker ps -a | grep ad-workflow | awk '{print $1}' | xargs -r docker rm -f
        
        # 强制删除卷
        echo "$VOLUMES" | xargs docker volume rm -f
        
        # 验证删除结果
        REMAINING=$(docker volume ls --filter "name=ad-workflow" -q)
        if [ -n "$REMAINING" ]; then
            echo "警告：以下卷无法删除，可能需要手动处理："
            echo "$REMAINING"
        else
            echo "所有卷已成功删除"
        fi
    else
        echo "未发现ad-workflow相关的卷"
    fi
    
    # 以下是原有的删除命令，保留作为备份
    # docker volume rm ad-workflow-mysql-data-x86 || true
    # docker volume rm ad-workflow-prisma-cache-x86 || true
    # docker volume rm ad-workflow-node-cache-x86 || true
    # docker volume rm ad-workflow-prisma-bin-x86 || true
fi

# 创建启动前预处理脚本
if [ "$FAST_MODE" = true ]; then
    echo "创建依赖预处理脚本..."
    cat > scripts/skip-dependency-install.sh << 'EOF'
#!/bin/sh
# 此脚本用于替换原始的start-x86.sh中的依赖安装部分

# 将原始脚本复制到临时文件
cp scripts/start-x86.sh scripts/start-x86.sh.bak

# 修改脚本跳过依赖安装
sed -i 's/if ! command -v tsx > \/dev\/null 2>&1; then/if false; then/' scripts/start-x86.sh
sed -i 's/npm install -D tsx typescript @types\/node/echo "跳过tsx安装..."/' scripts/start-x86.sh
sed -i 's/npm install -g tsx typescript @types\/node/echo "跳过tsx全局安装..."/' scripts/start-x86.sh

echo "依赖安装已被修改为跳过模式"
EOF
    chmod +x scripts/skip-dependency-install.sh
    
    mkdir -p scripts
    if [ -f "scripts/start-x86.sh" ]; then
        ./scripts/skip-dependency-install.sh
        echo "依赖安装已设置为跳过模式"
    else
        echo "警告: 未找到start-x86.sh脚本，将在容器启动时处理"
    fi
fi

# 启动服务
echo "启动服务..."
# $DOCKER_COMPOSE -f docker-compose.x86.yml up -d  # 注释掉这行，避免重复启动

# 等待服务启动
echo "等待服务启动..."
sleep 10

# 检查服务状态
echo "检查服务状态..."
$DOCKER_COMPOSE -f docker-compose.x86.yml ps

# 检查容器健康状态
MYSQL_CONTAINER=$(docker ps --filter "name=ad-workflow-mysql-x86" --format "{{.Names}}" | head -n 1)
APP_CONTAINER=$(docker ps --filter "name=ad-workflow-app-x86" --format "{{.Names}}" | head -n 1)

if [ -n "$MYSQL_CONTAINER" ]; then
    echo "MySQL容器状态: $(docker inspect --format='{{.State.Health.Status}}' $MYSQL_CONTAINER 2>/dev/null || echo "未知")"
fi

if [ -n "$APP_CONTAINER" ]; then
    echo "应用容器状态: $(docker inspect --format='{{.State.Health.Status}}' $APP_CONTAINER 2>/dev/null || echo "未知")"
fi

# 如果容器运行但卡住，提供直接进入容器的选项
if [ -n "$APP_CONTAINER" ]; then
    echo ""
    echo "如果启动过程卡住，您可以尝试以下操作:"
    echo "1. 进入容器调试: docker exec -it $APP_CONTAINER sh"
    echo "2. 在容器内执行: export SKIP_TSX_INSTALL=true && pnpm start"
    echo "3. 或重启容器: $DOCKER_COMPOSE -f docker-compose.x86.yml restart app"
    echo ""
fi

# 显示应用日志
echo "显示应用启动日志..."
$DOCKER_COMPOSE -f docker-compose.x86.yml logs --tail=30 app

echo "===== 服务已启动 ====="
echo "应用可以通过 http://$SERVER_IP:3000 访问"
echo ""
echo "查看应用日志: $DOCKER_COMPOSE -f docker-compose.x86.yml logs -f app"
echo "查看数据库日志: $DOCKER_COMPOSE -f docker-compose.x86.yml logs -f mysql"

# 创建修复数据库连接问题的脚本
cat > fix-db-connection-x86.sh << 'EOF'
#!/bin/bash
# 数据库连接修复脚本
echo "===== 数据库连接修复工具 ====="

# 读取密码
DB_PWD=$(cat secrets/mysql_password.txt 2>/dev/null || echo "ad_workflow_password")

echo "尝试手动修复数据库用户权限..."
docker exec -it ad-workflow-mysql-x86 mysql -uroot -p$(cat secrets/mysql_root_password.txt 2>/dev/null || echo "mysql_root_password") -e "DROP USER IF EXISTS 'ad_workflow'@'%'; DROP USER IF EXISTS 'ad_workflow'@'localhost'; CREATE USER 'ad_workflow'@'%' IDENTIFIED WITH mysql_native_password BY '$DB_PWD'; GRANT ALL PRIVILEGES ON ad_workflow.* TO 'ad_workflow'@'%'; CREATE USER 'ad_workflow'@'localhost' IDENTIFIED WITH mysql_native_password BY '$DB_PWD'; GRANT ALL PRIVILEGES ON ad_workflow.* TO 'ad_workflow'@'localhost'; FLUSH PRIVILEGES;"

echo "完成！请重启应用容器:"
echo "docker compose -f docker-compose.x86.yml restart app"
EOF

chmod +x fix-db-connection-x86.sh
echo "如果遇到数据库连接问题，可以运行 ./fix-db-connection-x86.sh 进行修复"

# 如果启用了加速模式，创建一个修复依赖问题的脚本
if [ "$FAST_MODE" = true ]; then
    cat > fix-dependency-x86.sh << 'EOF'
#!/bin/bash
# 依赖问题修复脚本
echo "===== 依赖安装问题修复工具 ====="

APP_CONTAINER=$(docker ps --filter "name=ad-workflow-app-x86" --format "{{.Names}}" | head -n 1)

if [ -z "$APP_CONTAINER" ]; then
    echo "错误：找不到应用容器"
    exit 1
fi

echo "正在修复依赖问题..."
docker exec -it $APP_CONTAINER sh -c "
    echo '正在设置环境变量...'
    export SKIP_TSX_INSTALL=true
    export PRISMA_CLI_JS_ONLY=true
    export SKIP_DEPENDENCIES_INSTALL=true
    
    echo '正在创建必要目录...'
    mkdir -p /home/nextjs/.prisma
    mkdir -p /home/nextjs/.npm-global/lib
    mkdir -p /home/nextjs/.npm-global/bin
    chmod -R 755 /home/nextjs/.npm-global
    
    echo '设置完成，重启应用...'
    pnpm start
"

echo "修复尝试完成。如果仍有问题，请尝试重启容器:"
echo "docker compose -f docker-compose.x86.yml restart app"
EOF

    chmod +x fix-dependency-x86.sh
    echo "如果遇到依赖安装问题，可以运行 ./fix-dependency-x86.sh 进行修复"
fi

# 创建浏览器访问提示
echo -e "\n\n打开浏览器访问: \033[1;34mhttp://$SERVER_IP:3000\033[0m"

# 重建并启动容器 - 此处是真正的启动逻辑
echo "启动环境..."
# docker-compose -f docker-compose.x86.yml down -v  # 注释掉，避免再次清理卷
docker-compose --env-file .env -f docker-compose.x86.yml up -d

# 等待容器启动
echo "等待容器启动..."
sleep 10

# 注入环境配置到容器
APP_CONTAINER=$(docker ps --filter "name=ad-workflow-app-x86" --format "{{.Names}}" | head -n 1)
if [ -n "$APP_CONTAINER" ]; then
  echo "注入NextAuth配置..."
  docker cp nextauth-env.conf $APP_CONTAINER:/app/.env.local
fi

echo "配置完成！请访问: http://$SERVER_IP:3000" 