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

# 执行一次初始清理，确保环境干净
echo "初始化环境，停止和清理所有相关容器..."
$DOCKER_COMPOSE -f docker-compose.x86.yml down --remove-orphans 2>/dev/null || true
docker ps -a | grep -E "ad-workflow|mysql" | awk '{print $1}' | xargs -r docker rm -f 2>/dev/null || true
echo "初始清理完成"

# 初始清理完成后，询问是否要彻底清理数据卷
echo "是否需要彻底清理数据卷? 这将删除所有数据，包括数据库内容! [y/N]"
read -r CLEAN_ALL_VOLUMES
if [[ "$CLEAN_ALL_VOLUMES" =~ ^[Yy]$ ]]; then
    echo "执行彻底清理，移除所有数据卷..."
    $DOCKER_COMPOSE -f docker-compose.x86.yml down --volumes --remove-orphans
    docker volume rm $(docker volume ls -q -f name=ad-workflow) 2>/dev/null || echo "无相关卷可删除"
    echo "数据卷清理完成，将使用全新的数据环境"
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

# 获取服务器域名
echo "使用域名 myad.shopwis.cn 作为服务地址"
SERVER_IP="myad.shopwis.cn"

# 环境变量设置
echo "配置环境变量，使用域名: $SERVER_IP"
export SERVER_IP=$SERVER_IP

# 创建配置文件确保持久化
echo "SERVER_IP=$SERVER_IP" > .env

# 部署环境的持久化设置
cat > nextauth-env.conf << EOF
# NextAuth配置
NEXTAUTH_URL=https://$SERVER_IP
NEXTAUTH_URL_INTERNAL=https://$SERVER_IP
NEXTAUTH_SECRET=Xo0W6XZGEWcNIyFnSqSsD+aLRcMQfDcLkK7Rp71wsqE=
NEXTAUTH_TRUST_HOST=true
NEXT_PUBLIC_VERCEL_URL=$SERVER_IP

# 安全头部配置
NEXTAUTH_COOKIE_SECURE=true
NEXTAUTH_COOKIE_DOMAIN=$SERVER_IP

# 前端应用设置
NEXT_PUBLIC_APP_URL=https://$SERVER_IP

# 其它关键设置
SERVER_IP=$SERVER_IP
EOF

# 显示将使用的服务器信息
echo "将使用以下服务器域名: $SERVER_IP"

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
APP_IMAGE=ad-workflow-x86:latest
APP_CONTAINER_NAME=ad-workflow-app-x86
APP_PORT=80
NODE_ENV=production
NEXTAUTH_URL=https://${SERVER_IP}
NEXTAUTH_SECRET=Xo0W6XZGEWcNIyFnSqSsD+aLRcMQfDcLkK7Rp71wsqE=
AUTH_SECRET=Xo0W6XZGEWcNIyFnSqSsD+aLRcMQfDcLkK7Rp71wsqE=
ACCESS_TOKEN_SECRET=ad776656d49f4adb840ef6187115fb8b
ACCESS_TOKEN_SECRET_TEST=ad776656d49f4adb840ef6187115fb8b
OPEN_API_URL=https://business.uniagency.net/uni-agency
OPEN_API_URL_TEST=https://test-ua-gw.tec-develop.cn/uni-agency
# 信任所有主机，解决Docker中的UntrustedHost错误
NEXTAUTH_URL_INTERNAL=https://${SERVER_IP}
NEXTAUTH_TRUSTED_HOSTS=localhost,app,127.0.0.1,${SERVER_IP}
# 安全头部配置
NEXTAUTH_TRUST_HOST=true
NEXT_PUBLIC_VERCEL_URL=${SERVER_IP}
NEXTAUTH_COOKIE_SECURE=true
NEXTAUTH_COOKIE_DOMAIN=${SERVER_IP}

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

# 删除拉取镜像的提示，直接使用本地镜像
echo "使用本地镜像 ad-workflow-x86:latest..."

# 检查本地是否存在该镜像
if ! docker image inspect ad-workflow-x86:latest &> /dev/null; then
    echo "警告: 本地未找到 ad-workflow-x86:latest 镜像"
    
    # 查找可能的tar文件
    TAR_FILES=$(find . -maxdepth 1 -name "ad-workflow-x86*.tar" -o -name "ad-workflow-x86*.tar.gz" | sort -r)
    
    if [ -n "$TAR_FILES" ]; then
        echo "发现以下可能的镜像文件:"
        echo "$TAR_FILES" | nl
        
        echo "是否要从这些文件中导入镜像? [Y/n]"
        read -r IMPORT_IMAGE
        if [[ ! "$IMPORT_IMAGE" =~ ^[Nn]$ ]]; then
            echo "请输入要导入的文件编号:"
            read -r FILE_NUM
            
            SELECTED_FILE=$(echo "$TAR_FILES" | sed -n "${FILE_NUM}p")
            if [ -n "$SELECTED_FILE" ]; then
                echo "正在从 $SELECTED_FILE 导入镜像..."
                
                # 处理压缩文件
                if [[ "$SELECTED_FILE" == *.tar.gz ]]; then
                    gunzip -c "$SELECTED_FILE" | docker load
                else
                    docker load -i "$SELECTED_FILE"
                fi
                
                if [ $? -eq 0 ]; then
                    echo "镜像导入成功"
                else
                    echo "镜像导入失败，请检查文件完整性"
                    exit 1
                fi
            fi
        else
            echo "请先准备镜像后再运行此脚本，或修改脚本以使用其他镜像"
            exit 1
        fi
    else
        echo "未找到镜像文件。请先构建镜像或使用 export-docker-image.sh 脚本导出镜像"
        echo "是否继续? [y/N]"
        read -r CONTINUE
        if [[ ! "$CONTINUE" =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
fi

# 停止并清理旧容器和卷
echo "清理之前的容器..."
$DOCKER_COMPOSE -f docker-compose.x86.yml down

# 再次检查镜像状态并提供手动标记选项
if ! docker image inspect ad-workflow-x86:latest &> /dev/null; then
    echo "找不到 ad-workflow-x86:latest 镜像，检查是否有其他可用镜像..."
    
    # 列出所有本地镜像
    AVAILABLE_IMAGES=$(docker images --format "{{.Repository}}:{{.Tag}}" | grep -i "workflow\|ad-workflow")
    
    if [ -n "$AVAILABLE_IMAGES" ]; then
        echo "找到以下可能相关的镜像:"
        echo "$AVAILABLE_IMAGES" | nl
        
        echo "是否要将其中一个标记为 ad-workflow-x86:latest? [Y/n]"
        read -r TAG_IMAGE
        if [[ ! "$TAG_IMAGE" =~ ^[Nn]$ ]]; then
            echo "请输入要使用的镜像编号:"
            read -r IMAGE_NUM
            
            SELECTED_IMAGE=$(echo "$AVAILABLE_IMAGES" | sed -n "${IMAGE_NUM}p")
            if [ -n "$SELECTED_IMAGE" ]; then
                echo "正在将 $SELECTED_IMAGE 标记为 ad-workflow-x86:latest..."
                docker tag "$SELECTED_IMAGE" ad-workflow-x86:latest
                
                if [ $? -eq 0 ]; then
                    echo "镜像标记成功"
                else
                    echo "镜像标记失败"
                    exit 1
                fi
            fi
        fi
    else
        echo "未找到任何相关镜像。"
        echo "您可以尝试手动拉取镜像："
        echo "docker pull jqjjian/ad-workflow-x86:latest"
        echo "docker tag jqjjian/ad-workflow-x86:latest ad-workflow-x86:latest"
        
        echo "是否尝试从Docker Hub拉取镜像? [y/N]"
        read -r PULL_FROM_HUB
        if [[ "$PULL_FROM_HUB" =~ ^[Yy]$ ]]; then
            echo "尝试从Docker Hub拉取镜像..."
            docker pull jqjjian/ad-workflow-x86:latest && \
            docker tag jqjjian/ad-workflow-x86:latest ad-workflow-x86:latest
            
            if [ $? -eq 0 ]; then
                echo "镜像拉取并标记成功"
            else
                echo "镜像拉取失败"
                exit 1
            fi
        else
            echo "跳过镜像拉取，可能无法启动容器"
        fi
    fi
fi

# 检查MySQL镜像是否存在
if ! docker image inspect mysql:5.7.43 &> /dev/null; then
    echo "找不到 MySQL 5.7.43 镜像，检查是否有其他MySQL镜像..."
    
    # 列出所有MySQL相关镜像
    MYSQL_IMAGES=$(docker images --format "{{.Repository}}:{{.Tag}}" | grep -i "mysql\|mariadb")
    
    if [ -n "$MYSQL_IMAGES" ]; then
        echo "找到以下MySQL相关镜像:"
        echo "$MYSQL_IMAGES" | nl
        
        echo "是否要将其中一个标记为 mysql:5.7.43? [Y/n]"
        read -r TAG_MYSQL
        if [[ ! "$TAG_MYSQL" =~ ^[Nn]$ ]]; then
            echo "请输入要使用的镜像编号:"
            read -r MYSQL_NUM
            
            SELECTED_MYSQL=$(echo "$MYSQL_IMAGES" | sed -n "${MYSQL_NUM}p")
            if [ -n "$SELECTED_MYSQL" ]; then
                echo "正在将 $SELECTED_MYSQL 标记为 mysql:5.7.43..."
                docker tag "$SELECTED_MYSQL" mysql:5.7.43
                
                if [ $? -eq 0 ]; then
                    echo "MySQL镜像标记成功"
                else
                    echo "MySQL镜像标记失败"
                    exit 1
                fi
            fi
        else
            echo "您选择不标记MySQL镜像，将可能导致启动失败"
        fi
    else
        echo "未找到任何MySQL相关镜像。"
        echo "您可以修改docker-compose.x86.yml文件使用其他数据库镜像，或手动下载MySQL镜像"
        
        echo "是否尝试离线安装MySQL镜像? [y/N]"
        read -r OFFLINE_MYSQL
        if [[ "$OFFLINE_MYSQL" =~ ^[Yy]$ ]]; then
            # 查找MySQL镜像tar文件
            MYSQL_TARS=$(find . -maxdepth 2 -name "mysql*.tar" -o -name "mysql*.tar.gz" | sort -r)
            
            if [ -n "$MYSQL_TARS" ]; then
                echo "找到以下MySQL镜像文件:"
                echo "$MYSQL_TARS" | nl
                
                echo "请选择要导入的MySQL镜像文件:"
                read -r MYSQL_TAR_NUM
                
                SELECTED_MYSQL_TAR=$(echo "$MYSQL_TARS" | sed -n "${MYSQL_TAR_NUM}p")
                if [ -n "$SELECTED_MYSQL_TAR" ]; then
                    echo "正在导入 $SELECTED_MYSQL_TAR..."
                    
                    if [[ "$SELECTED_MYSQL_TAR" == *.tar.gz ]]; then
                        gunzip -c "$SELECTED_MYSQL_TAR" | docker load
                    else
                        docker load -i "$SELECTED_MYSQL_TAR"
                    fi
                    
                    if [ $? -eq 0 ]; then
                        echo "MySQL镜像导入成功"
                        
                        # 导入后再次检查并可能需要标记
                        if ! docker image inspect mysql:5.7.43 &> /dev/null; then
                            echo "导入的镜像中没有 mysql:5.7.43，请选择一个镜像标记:"
                            IMPORTED_MYSQL=$(docker images --format "{{.Repository}}:{{.Tag}}" | grep -i "mysql" | head -n 10)
                            echo "$IMPORTED_MYSQL" | nl
                            
                            echo "请选择要标记为 mysql:5.7.43 的镜像编号:"
                            read -r IMP_MYSQL_NUM
                            
                            SELECTED_IMP_MYSQL=$(echo "$IMPORTED_MYSQL" | sed -n "${IMP_MYSQL_NUM}p")
                            if [ -n "$SELECTED_IMP_MYSQL" ]; then
                                docker tag "$SELECTED_IMP_MYSQL" mysql:5.7.43
                                echo "MySQL镜像已标记为 mysql:5.7.43"
                            fi
                        fi
                    else
                        echo "MySQL镜像导入失败"
                    fi
                fi
            else
                echo "未找到MySQL镜像文件，将继续但可能无法启动MySQL服务"
            fi
        else
            echo "跳过MySQL镜像安装，将继续但可能无法启动MySQL服务"
        fi
    fi
fi

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

# 创建浏览器访问提示
echo -e "\n\n打开浏览器访问: \033[1;34mhttps://$SERVER_IP\033[0m"

# 重建并启动容器 - 此处是真正的启动逻辑
echo "启动环境..."
echo "注意: 使用本地镜像启动，如果出现拉取错误，表示本地镜像不存在"

# 停止并清理所有相关容器 - 通用清理逻辑
echo "停止并清理相关容器..."
docker ps -a | grep -E "ad-workflow|mysql" | awk '{print $1}' | xargs -r docker stop 2>/dev/null || true
docker ps -a | grep -E "ad-workflow|mysql" | awk '{print $1}' | xargs -r docker rm -f 2>/dev/null || true
echo "容器清理完成"

# 添加强制离线模式 - 使用临时shell脚本启动
echo "检测到网络连接问题，尝试使用临时脚本离线启动容器..."

# 在脚本外部获取密码，避免命令替换问题
MYSQL_ROOT_PASSWORD=$(cat secrets/mysql_root_password.txt 2>/dev/null || echo "mysql_root_password")
MYSQL_PASSWORD=$(cat secrets/mysql_password.txt 2>/dev/null || echo "ad_workflow_password")

# 检查80端口是否被占用
PORT_TO_USE=3000
if netstat -tuln | grep -q ":3000 "; then
    echo "警告: 3000端口已被占用!"
    echo "请选择操作："
    echo "1. 使用默认备用端口8000"
    echo "2. 手动指定端口"
    echo "3. 尝试释放3000端口（需要管理员权限）"
    read -p "请选择 [1-3]: " PORT_CHOICE
    
    case $PORT_CHOICE in
        1)
            PORT_TO_USE=8000
            echo "将使用端口 8000"
            ;;
        2)
            read -p "请输入要使用的端口号: " CUSTOM_PORT
            if [[ "$CUSTOM_PORT" =~ ^[0-9]+$ ]] && [ "$CUSTOM_PORT" -gt 0 ] && [ "$CUSTOM_PORT" -lt 65536 ]; then
                PORT_TO_USE=$CUSTOM_PORT
                echo "将使用端口 $PORT_TO_USE"
            else
                echo "无效的端口号，将使用默认端口 8000"
                PORT_TO_USE=8000
            fi
            ;;
        3)
            echo "尝试释放3000端口..."
            if [ "$(id -u)" = "0" ]; then
                # 获取使用3000端口的进程
                PID=$(lsof -t -i:3000 -sTCP:LISTEN)
                if [ -n "$PID" ]; then
                    echo "发现使用3000端口的进程: $PID"
                    read -p "是否终止此进程? [y/N] " KILL_PROCESS
                    if [[ "$KILL_PROCESS" =~ ^[Yy]$ ]]; then
                        kill -9 $PID
                        echo "已终止进程，将使用端口 3000"
                    else
                        echo "将使用备用端口 8000"
                        PORT_TO_USE=8000
                    fi
                else
                    echo "无法确定使用3000端口的进程，将使用备用端口 8000"
                    PORT_TO_USE=8000
                fi
            else
                echo "需要管理员权限来释放端口，请尝试以sudo或root身份运行，将使用备用端口 8000"
                PORT_TO_USE=8000
            fi
            ;;
        *)
            echo "无效选择，将使用默认端口 8000"
            PORT_TO_USE=8000
            ;;
    esac
fi

cat > offline-start.sh << EOF
#!/bin/bash
# 临时脚本，用于完全离线方式启动容器

# 直接使用docker命令启动容器
echo "使用离线方式启动MySQL容器..."
docker run -d --name ad-workflow-mysql-x86 \\
  --platform linux/amd64 \\
  --network ad-workflow-network \\
  --network-alias mysql \\
  -v ad-workflow-mysql-data-x86:/var/lib/mysql \\
  -e MYSQL_ROOT_PASSWORD=$MYSQL_ROOT_PASSWORD \\
  -e MYSQL_DATABASE=ad_workflow \\
  -e MYSQL_USER=ad_workflow \\
  -e MYSQL_PASSWORD=$MYSQL_PASSWORD \\
  mysql:5.7.43

echo "使用离线方式启动应用容器..."
docker run -d --name ad-workflow-app-x86 \\
  --platform linux/amd64 \\
  --network ad-workflow-network \\
  -v prisma-cache-x86:/home/nextjs/.prisma \\
  -v node-cache-x86:/home/nextjs/.npm-global \\
  -v prisma-bin-x86:/home/nextjs/.prisma-bin \\
  -e MYSQL_HOST=mysql \\
  -e MYSQL_DATABASE=ad_workflow \\
  -e MYSQL_USER=ad_workflow \\
  -e MYSQL_PASSWORD=$MYSQL_PASSWORD \\
  -e NEXTAUTH_URL=https://myad.shopwis.cn \\
  -e NEXTAUTH_URL_INTERNAL=https://myad.shopwis.cn \\
  -e NEXTAUTH_SECRET=Xo0W6XZGEWcNIyFnSqSsD+aLRcMQfDcLkK7Rp71wsqE= \\
  -e NEXTAUTH_TRUST_HOST=true \\
  -e NEXT_PUBLIC_APP_URL=https://myad.shopwis.cn \\
  -e NEXTAUTH_TRUSTED_HOSTS=myad.shopwis.cn,localhost,127.0.0.1 \\
  -e SKIP_TSX_INSTALL=true \\
  -e SKIP_DEPENDENCIES_INSTALL=true \\
  -p ${PORT_TO_USE}:3000 \\
  ad-workflow-x86:latest ./scripts/start-x86.sh
EOF

chmod +x offline-start.sh

# 询问是否使用离线脚本启动
echo "要使用离线脚本启动容器吗? [Y/n]"
read -r USE_OFFLINE
if [[ ! "$USE_OFFLINE" =~ ^[Nn]$ ]]; then
    echo "使用离线脚本启动..."
    
    # 先创建网络
    echo "创建Docker网络..."
    docker network create ad-workflow-network 2>/dev/null || true
    
    # 运行离线脚本
    echo "启动容器..."
    ./offline-start.sh
    
    # 检查容器是否成功启动
    echo "检查容器启动状态..."
    sleep 5
    MYSQL_STATUS=$(docker inspect --format='{{.State.Status}}' ad-workflow-mysql-x86 2>/dev/null || echo "未启动")
    APP_STATUS=$(docker inspect --format='{{.State.Status}}' ad-workflow-app-x86 2>/dev/null || echo "未启动")
    echo "MySQL容器状态: $MYSQL_STATUS"
    echo "应用容器状态: $APP_STATUS"
    
    if [ "$APP_STATUS" != "running" ]; then
        echo "应用容器未正常启动，查看日志:"
        docker logs ad-workflow-app-x86 2>&1 | tail -n 20
    fi
else
    # 使用docker-compose启动
    echo "使用Docker Compose启动容器(配置文件已包含平台设置)..."
    
    # 先执行down命令彻底清理
    echo "使用Docker Compose彻底清理环境..."
    $DOCKER_COMPOSE -f docker-compose.x86.yml down --remove-orphans
    
    # 不使用--no-pull选项，直接启动(前面的检查已经确保镜像存在)
    echo "启动新容器..."
    $DOCKER_COMPOSE --env-file .env -f docker-compose.x86.yml up -d
    
    # 验证容器平台
    sleep 5
    echo "验证容器平台..."
    MYSQL_PLATFORM=$(docker inspect --format='{{.Architecture}}' $(docker ps --filter "name=ad-workflow-mysql-x86" --format "{{.ID}}" | head -n 1) 2>/dev/null || echo "未知")
    APP_PLATFORM=$(docker inspect --format='{{.Architecture}}' $(docker ps --filter "name=ad-workflow-app-x86" --format "{{.ID}}" | head -n 1) 2>/dev/null || echo "未知")
    
    echo "MySQL容器架构: $MYSQL_PLATFORM (应为amd64)"
    echo "应用容器架构: $APP_PLATFORM (应为amd64)"
    
    # 如果检测到非amd64架构，给出警告
    if [ "$MYSQL_PLATFORM" != "amd64" ] && [ "$MYSQL_PLATFORM" != "未知" ]; then
        echo "警告: MySQL容器不是amd64架构，可能会出现兼容性问题"
    fi
    
    if [ "$APP_PLATFORM" != "amd64" ] && [ "$APP_PLATFORM" != "未知" ]; then
        echo "警告: 应用容器不是amd64架构，可能会出现兼容性问题"
    fi
fi

# 等待容器启动
echo "等待容器启动..."
sleep 10

# 注入环境配置到容器
APP_CONTAINER=$(docker ps --filter "name=ad-workflow-app-x86" --format "{{.Names}}" | head -n 1)
if [ -n "$APP_CONTAINER" ]; then
  echo "注入NextAuth配置..."
  docker cp nextauth-env.conf $APP_CONTAINER:/app/.env.local
fi

echo "配置完成！请访问: https://$SERVER_IP"

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
echo "应用可以通过 https://$SERVER_IP 访问"
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