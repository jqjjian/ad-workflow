#!/bin/sh
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

# 添加客户端可访问的环境变量
export NEXT_PUBLIC_APP_URL="${NEXTAUTH_URL}"
export NEXT_PUBLIC_API_URL="${NEXTAUTH_URL}/api"

# 打印关键环境变量用于调试
echo "======== 关键环境变量 ========"
echo "NEXTAUTH_URL: ${NEXTAUTH_URL}"
echo "NEXTAUTH_URL_INTERNAL: ${NEXTAUTH_URL_INTERNAL}"
echo "NEXTAUTH_TRUSTED_HOSTS: ${NEXTAUTH_TRUSTED_HOSTS}"
echo "NEXT_PUBLIC_APP_URL: ${NEXT_PUBLIC_APP_URL}"
echo "DATABASE_URL: ${DATABASE_URL}"
echo "============================="

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
  echo "tsx命令不可用，设置镜像并安装..."
  # 设置镜像源
  npm config set registry https://registry.npmmirror.com
  # 尝试使用不同方式安装
  npm install -g tsx typescript @types/node || \
  (mkdir -p ~/.npm && npm install -g tsx typescript @types/node) || \
  (sudo npm install -g tsx typescript @types/node)
  
  # 验证安装结果
  if ! command -v tsx > /dev/null 2>&1; then
    echo "警告: tsx安装失败，某些功能可能无法使用"
  else
    echo "tsx安装成功!"
  fi
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

# 确保API环境变量设置正确
echo "确保API环境变量设置正确..."
export OPEN_API_URL=${OPEN_API_URL:-"https://test-ua-gw.tec-develop.cn/uni-agency"}
export OPEN_API_URL_TEST=${OPEN_API_URL_TEST:-"https://test-ua-gw.tec-develop.cn/uni-agency"}
export ACCESS_TOKEN_SECRET=${ACCESS_TOKEN_SECRET:-"ad776656d49f4adb840ef6187115fb8b"}
export ACCESS_TOKEN_SECRET_TEST=${ACCESS_TOKEN_SECRET_TEST:-"ad776656d49f4adb840ef6187115fb8b"}

echo "环境变量状态检查:"
echo "NODE_ENV: $NODE_ENV"
echo "OPEN_API_URL: $OPEN_API_URL"
echo "OPEN_API_URL_TEST: $OPEN_API_URL_TEST"
echo "ACCESS_TOKEN_SECRET: $ACCESS_TOKEN_SECRET"
echo "ACCESS_TOKEN_SECRET_TEST: $ACCESS_TOKEN_SECRET_TEST"
echo "启动应用服务器..."
exec pnpm start 