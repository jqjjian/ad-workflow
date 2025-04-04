#!/bin/bash

# 确保脚本在出错时停止
set -e

echo "===== 一键式构建和上传工单系统Docker镜像 (x86_64版本) ====="

# 设置固定的目标仓库和标签
DOCKER_REPO="jqjjian/ad-workflow-x86"
DOCKER_TAG="latest"
DOCKER_USER=""
DOCKER_PASSWORD=""

# 处理命令行参数
while getopts ":u:p:ht" opt; do
  case $opt in
    u)
      DOCKER_USER=$OPTARG
      ;;
    p)
      DOCKER_PASSWORD=$OPTARG
      ;;
    h)
      echo "用法: $0 [-u Docker用户名] [-p Docker密码(可选)] [-h 显示帮助] [-t 构建后进行本地测试]"
      echo "  -u 用户名: Docker Hub的用户名"
      echo "  -p 密码: Docker Hub的密码(可选，不提供则会提示输入)"
      echo "  -h: 显示此帮助信息"
      echo "  -t: 构建后在本地进行测试(需要Docker支持多架构)"
      exit 0
      ;;
    t)
      RUN_TEST=true
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

# 检查是否提供了用户名
if [ -z "$DOCKER_USER" ]; then
    echo "错误: 必须提供Docker Hub用户名 (-u 参数)"
    echo "用法: $0 -u 用户名 [-p 密码]"
    exit 1
fi

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

# 设置默认构建平台
export DOCKER_DEFAULT_PLATFORM=linux/amd64

# 检查是否支持多平台构建
if ! docker buildx ls | grep -q "linux/amd64"; then
    echo "设置Docker buildx以支持跨平台构建..."
    docker run --rm --privileged tonistiigi/binfmt --install all
    docker buildx create --name multiplatform --use || true
fi

# 确保scripts目录存在
mkdir -p scripts

# 确保start-x86.sh脚本存在
if [ ! -f "scripts/start-x86.sh" ]; then
    echo "创建x86_64版本启动脚本..."
    cp scripts/start.sh scripts/start-x86.sh 2>/dev/null || \
    echo '#!/bin/sh
set -e

echo "检查环境和权限..."
# 创建必要的Prisma缓存目录并确保它们可写
mkdir -p "$HOME/.prisma" "$HOME/.cache" 2>/dev/null || true
ls -la /app/node_modules 2>/dev/null || true

# 检查和安装可能缺少的工具
if ! command -v mysql > /dev/null 2>&1 && ! command -v mariadb > /dev/null 2>&1; then
    echo "MySQL/MariaDB客户端未安装，尝试安装..."
    apt-get update && { \
        apt-get install -y mysql-client || \
        apt-get install -y mariadb-client || \
        apt-get install -y default-mysql-client || \
        echo "警告：无法安装MySQL客户端，将使用替代方法连接数据库"; \
    }
fi

if ! command -v nc > /dev/null 2>&1; then
    echo "安装netcat工具..."
    apt-get update && apt-get install -y netcat || apt-get install -y nc || echo "警告：无法安装netcat，将使用替代方法检查数据库连接"
fi

echo "配置Prisma环境..."
# 完全禁用引擎下载，使用纯JavaScript实现
export PRISMA_BINARY_TARGETS="linux-musl-x64-openssl-3.0.x"
export PRISMA_ENGINE_PROTOCOL="json"
export PRISMA_CLI_QUERY_ENGINE_TYPE="library"
export PRISMA_CLIENT_ENGINE_TYPE="library"
# 强制使用JavaScript实现
export PRISMA_CLI_JS_ONLY=true
export PRISMA_SKIP_DOWNLOAD_BINARIES=true
# 强制使用JSON协议引擎，完全不依赖二进制文件
export PRISMA_QUERY_ENGINE_TYPE="json-file"
export PRISMA_SCHEMA_ENGINE_TYPE="json-file"
export PRISMA_CLIENT_BINARY_TARGETS="linux-musl-x64-openssl-3.0.x"
# 指定使用特定版本的Prisma
echo "使用Prisma 6.3.1版本 (纯JavaScript模式)..."
# 设置Prisma缓存目录
export PRISMA_ENGINES_MIRROR="https://registry.npmmirror.com/-/binary/prisma"
# 避免权限问题 - 创建并确保完整目录结构
export npm_config_prefix="$HOME/.npm-global"
export PATH="$HOME/.npm-global/bin:$PATH"
mkdir -p "$HOME/.npm-global/lib" "$HOME/.npm-global/bin" 2>/dev/null || true
chmod -R 755 "$HOME/.npm-global" 2>/dev/null || true

echo "列出当前目录内容以确认package.json存在..."
ls -la /app/

echo "跳过Prisma生成步骤，使用预编译的客户端..."
# 由于平台的引擎下载问题，我们将使用已有的客户端

# 处理从Docker secret读取的密码
if [ -f "$MYSQL_PASSWORD" ]; then
  echo "从密钥文件读取MySQL密码..."
  MYSQL_PWD=$(cat "$MYSQL_PASSWORD")
else
  echo "使用环境变量中的MySQL密码..."
  MYSQL_PWD="$MYSQL_PASSWORD"
fi

# 设置环境变量供应用使用
export MYSQL_PASSWORD="$MYSQL_PWD"
# 设置完整的DATABASE_URL，支持自定义主机名
export DATABASE_URL="mysql://$MYSQL_USER:$MYSQL_PWD@${MYSQL_HOST:-mysql}:3306/$MYSQL_DATABASE?ssl=false"

echo "等待数据库就绪..."
MAX_RETRIES=30
RETRY_COUNT=0

# 检查mysqladmin是否可用
if command -v mysqladmin > /dev/null 2>&1; then
  echo "使用mysqladmin检查数据库连接..."
  # 使用--skip-ssl代替
  until mysqladmin ping -h ${MYSQL_HOST:-mysql} -u"$MYSQL_USER" -p"$MYSQL_PWD" --skip-ssl; do
    RETRY_COUNT=$((RETRY_COUNT+1))
    if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
      echo "达到最大重试次数，无法连接到数据库"
      exit 1
    fi
    echo "数据库连接失败，5秒后重试... (尝试 $RETRY_COUNT/$MAX_RETRIES)"
    sleep 5
  done
elif command -v mysql > /dev/null 2>&1; then
  echo "使用mysql命令检查数据库连接..."
  until mysql -h ${MYSQL_HOST:-mysql} -u"$MYSQL_USER" -p"$MYSQL_PWD" -e "SELECT 1" --skip-ssl; do
    RETRY_COUNT=$((RETRY_COUNT+1))
    if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
      echo "达到最大重试次数，无法连接到数据库"
      exit 1
    fi
    echo "数据库连接失败，5秒后重试... (尝试 $RETRY_COUNT/$MAX_RETRIES)"
    sleep 5
  done
else
  echo "MySQL客户端工具未找到，使用nc命令检查数据库端口..."
  # 如果没有mysqladmin，使用nc检查端口
  if command -v nc > /dev/null 2>&1; then
    until nc -z ${MYSQL_HOST:-mysql} 3306; do
      RETRY_COUNT=$((RETRY_COUNT+1))
      if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
        echo "达到最大重试次数，无法连接到数据库"
        exit 1
      fi
      echo "数据库端口无法访问，5秒后重试... (尝试 $RETRY_COUNT/$MAX_RETRIES)"
      sleep 5
    done
  else
    # 如果没有nc，使用/dev/tcp尝试连接
    echo "检查数据库连接..."
    until (echo > /dev/tcp/${MYSQL_HOST:-mysql}/3306) >/dev/null 2>&1; do
      RETRY_COUNT=$((RETRY_COUNT+1))
      if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
        echo "达到最大重试次数，无法连接到数据库"
        exit 1
      fi
      echo "数据库端口无法访问，5秒后重试... (尝试 $RETRY_COUNT/$MAX_RETRIES)"
      sleep 5
    done
  fi
  
  echo "数据库端口可访问，等待3秒确保服务完全启动..."
  sleep 3
fi

echo "执行数据库迁移..."
echo "使用数据库连接: $DATABASE_URL"

echo "现在执行Prisma迁移部署..."
echo "使用纯JavaScript模式执行迁移..."
NODE_OPTIONS="--max-old-space-size=3072" npx prisma migrate deploy --schema=./prisma/schema.prisma || echo "迁移失败，继续启动应用"

# 检查并安装必要的工具
echo "安装 tsx 和 ESM 支持..."
if ! command -v tsx > /dev/null 2>&1; then
  echo "tsx命令不可用，尝试安装..."
  npm install -g tsx typescript @types/node
fi
# 添加对.ts文件的特殊处理
export NODE_OPTIONS="--max-old-space-size=3072 --experimental-specifier-resolution=node --experimental-modules"

# 添加种子数据初始化步骤
echo "执行数据库种子初始化..."
# 将标记文件放在用户主目录中，而不是/app目录
SEED_MARKER="$HOME/.seed_initialized"
if [ ! -f "$SEED_MARKER" ]; then
  echo "首次运行，执行数据库种子初始化..."
  # 使用tsx执行TypeScript种子文件
  if command -v tsx > /dev/null 2>&1; then
    echo "使用tsx执行种子文件..."
    NODE_OPTIONS="--max-old-space-size=3072" npx tsx prisma/seed.ts || echo "种子初始化失败，继续启动应用"
  else
    echo "tsx不可用，尝试使用node执行JS版本..."
    NODE_OPTIONS="--max-old-space-size=3072" node prisma/seed.js || echo "种子初始化失败，继续启动应用"
  fi
  touch "$SEED_MARKER" || echo "无法创建种子标记文件，下次将再次尝试初始化"
else
  echo "已检测到种子数据初始化标记，跳过初始化步骤"
fi

echo "启动应用服务器..."
exec pnpm start' > scripts/start-x86.sh
    chmod +x scripts/start-x86.sh
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

# 复制启动脚本
chmod +x scripts/start-x86.sh

# 构建镜像标签
FULL_IMAGE_NAME="${DOCKER_REPO}:${DOCKER_TAG}"
LOCAL_IMAGE_NAME="ad-workflow-x86:latest"

# 开始构建
echo "1. 开始构建Docker镜像 (x86_64版本)..."
echo "使用Dockerfile.x86构建镜像..."
# 检查Dockerfile.x86是否存在
if [ ! -f "Dockerfile.x86" ]; then
    echo "错误: Dockerfile.x86不存在"
    exit 1
fi

# 创建本地测试脚本
cat > test-docker-x86-local.sh << 'EOL'
#!/bin/bash
set -e

echo "===== 在M1 Mac上测试x86_64镜像 ====="

# 确保Docker可用
if ! command -v docker &> /dev/null; then
    echo "错误: Docker未安装或未运行" >&2
    exit 1
fi

# 启用QEMU架构支持
echo "启用跨架构支持..."
docker run --rm --privileged tonistiigi/binfmt --install all

# 创建测试用的secrets目录
mkdir -p test-secrets
echo "test_root_password" > test-secrets/mysql_root_password.txt
echo "test_password" > test-secrets/mysql_password.txt

# 创建临时测试配置
cat > docker-compose.test.yml << 'EOF'
version: '3.8'

services:
  mysql:
    image: mysql:5.7
    platform: linux/amd64
    container_name: test-mysql
    environment:
      MYSQL_ROOT_PASSWORD_FILE: /run/secrets/db_root_password
      MYSQL_DATABASE: ad_workflow
      MYSQL_USER: ad_workflow
      MYSQL_PASSWORD_FILE: /run/secrets/db_password
    secrets:
      - db_root_password
      - db_password
    ports:
      - "3306:3306"
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost", "-u", "ad_workflow", "--password=test_password", "--skip-ssl"]
      interval: 5s
      timeout: 5s
      retries: 3

  app:
    image: jqjjian/ad-workflow-x86:latest
    platform: linux/amd64
    container_name: test-app
    depends_on:
      mysql:
        condition: service_healthy
    environment:
      DATABASE_URL: mysql://ad_workflow:test_password@mysql:3306/ad_workflow?ssl=false
      MYSQL_USER: ad_workflow
      MYSQL_PASSWORD: test_password
      MYSQL_HOST: mysql
      MYSQL_DATABASE: ad_workflow
      NEXTAUTH_URL: http://localhost:3000
      NEXTAUTH_SECRET: test_secret_key_for_local_testing
      PRISMA_BINARY_TARGETS: "linux-musl-x64-openssl-3.0.x"
      PRISMA_ENGINE_PROTOCOL: "json"
      PRISMA_CLI_JS_ONLY: "true"
    secrets:
      - db_password
    ports:
      - "3000:3000"
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3000/api/health"]
      interval: 10s
      timeout: 5s
      retries: 3
      start_period: 15s
    command: ["./scripts/start-x86.sh"]

secrets:
  db_root_password:
    file: ./test-secrets/mysql_root_password.txt
  db_password:
    file: ./test-secrets/mysql_password.txt
EOF

# 确保镜像存在
if ! docker images | grep -q "jqjjian/ad-workflow-x86"; then
    echo "尝试构建镜像..."
    docker build -t jqjjian/ad-workflow-x86:latest -f Dockerfile.x86 .
fi

echo "启动测试环境..."
docker compose -f docker-compose.test.yml down -v || true
docker compose -f docker-compose.test.yml up -d

echo "等待容器启动..."
sleep 10

# 监控应用状态
echo "检查应用状态..."
MAX_RETRIES=15
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if docker ps | grep -q "test-app" && docker ps | grep -q "test-mysql"; then
        APP_STATUS=$(docker inspect --format='{{.State.Health.Status}}' test-app 2>/dev/null || echo "starting")
        MYSQL_STATUS=$(docker inspect --format='{{.State.Health.Status}}' test-mysql 2>/dev/null || echo "starting")
        
        echo "MySQL状态: $MYSQL_STATUS, 应用状态: $APP_STATUS"
        
        if [ "$APP_STATUS" = "healthy" ] && [ "$MYSQL_STATUS" = "healthy" ]; then
            echo "===== 测试成功! ====="
            echo "应用可以通过 http://localhost:3000 访问"
            echo ""
            echo "容器日志:"
            docker compose -f docker-compose.test.yml logs --tail=20 app
            echo ""
            echo "要停止测试环境，请运行:"
            echo "docker compose -f docker-compose.test.yml down -v"
            exit 0
        fi
    else
        echo "容器未运行，检查错误..."
        docker compose -f docker-compose.test.yml logs
        echo "===== 测试失败 ====="
        docker compose -f docker-compose.test.yml down -v
        exit 1
    fi
    
    RETRY_COUNT=$((RETRY_COUNT+1))
    echo "等待服务就绪 ($RETRY_COUNT/$MAX_RETRIES)..."
    sleep 10
done

echo "达到最大重试次数，检查日志获取更多信息:"
docker compose -f docker-compose.test.yml logs
echo "===== 测试超时 ====="
echo "您可以手动检查容器状态:"
echo "docker ps"
echo "docker compose -f docker-compose.test.yml logs app"
echo ""
echo "要停止测试环境，请运行:"
echo "docker compose -f docker-compose.test.yml down -v"
EOL
chmod +x test-docker-x86-local.sh

# 开始构建镜像
echo "构建镜像: $FULL_IMAGE_NAME"
docker buildx build --platform linux/amd64 --load -t $LOCAL_IMAGE_NAME -f Dockerfile.x86 .

# 检查构建是否成功
if ! docker image inspect $LOCAL_IMAGE_NAME &> /dev/null; then
    echo "错误: 镜像构建失败"
    exit 1
fi

# 准备上传到Docker Hub
echo "2. 登录Docker Hub并上传镜像..."
echo "登录Docker Hub..."

# 如果没有提供密码，则提示输入
if [ -z "$DOCKER_PASSWORD" ]; then
    echo "请输入Docker Hub密码："
    read -s DOCKER_PASSWORD
fi

echo "$DOCKER_PASSWORD" | docker login -u "$DOCKER_USER" --password-stdin

if [ $? -ne 0 ]; then
    echo "错误: Docker Hub登录失败，请检查凭据"
    exit 1
fi

echo "将本地镜像重新标记为 $FULL_IMAGE_NAME..."
docker tag $LOCAL_IMAGE_NAME $FULL_IMAGE_NAME

echo "上传镜像到Docker Hub..."
docker push $FULL_IMAGE_NAME

echo "===== 全部完成 ====="
echo "本地镜像: $LOCAL_IMAGE_NAME"
echo "Docker Hub镜像: $FULL_IMAGE_NAME"
echo "镜像已成功上传至Docker Hub"

# 如果指定了测试标志，则运行测试
if [ "$RUN_TEST" = true ]; then
    echo "====== 开始本地测试 ======"
    ./test-docker-x86-local.sh
fi 