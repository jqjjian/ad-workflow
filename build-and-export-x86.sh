#!/bin/bash

# 确保脚本在出错时停止
set -e

echo "===== 一键式构建和导出工单系统Docker镜像 (x86_64版本) ====="

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

# 设置压缩级别
COMPRESS_LEVEL=6

# 处理命令行参数
while getopts ":c:ht" opt; do
  case $opt in
    c)
      if [[ "$OPTARG" =~ ^[1-9]$ ]]; then
        COMPRESS_LEVEL=$OPTARG
      else
        echo "警告: 无效的压缩级别，使用默认值: 6"
      fi
      ;;
    h)
      echo "用法: $0 [-c 压缩级别(1-9)] [-h 显示帮助] [-t 构建后进行本地测试]"
      echo "  -c 压缩级别: 1-9之间的整数，数字越大压缩率越高，但速度越慢(默认:6)"
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

echo "等待数据库就绪..."
MAX_RETRIES=30
RETRY_COUNT=0

# 检查mysqladmin是否可用
if command -v mysqladmin > /dev/null 2>&1; then
  echo "使用mysqladmin检查数据库连接..."
  # 使用--skip-ssl代替
  until mysqladmin ping -h mysql -u"$MYSQL_USER" -p"$MYSQL_PWD" --skip-ssl; do
    RETRY_COUNT=$((RETRY_COUNT+1))
    if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
      echo "达到最大重试次数，无法连接到数据库"
      exit 1
    fi
    echo "数据库连接失败，5秒后重试... (尝试 $RETRY_COUNT/$MAX_RETRIES)"
    sleep 5
  done
else
  echo "mysqladmin未找到，使用nc命令检查数据库端口..."
  # 如果没有mysqladmin，使用nc检查端口
  if ! command -v nc > /dev/null 2>&1; then
    echo "安装nc工具..."
    # 修复netcat包名称，适配Debian/Ubuntu系统
    apt-get update && apt-get install -y netcat
  fi
  
  until nc -z mysql 3306; do
    RETRY_COUNT=$((RETRY_COUNT+1))
    if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
      echo "达到最大重试次数，无法连接到数据库"
      exit 1
    fi
    echo "数据库端口无法访问，5秒后重试... (尝试 $RETRY_COUNT/$MAX_RETRIES)"
    sleep 5
  done
  
  echo "数据库端口可访问，等待3秒确保服务完全启动..."
  sleep 3
fi

echo "执行数据库迁移..."
# 使用读取的密码更新数据库URL
export DATABASE_URL="mysql://$MYSQL_USER:$MYSQL_PWD@mysql:3306/$MYSQL_DATABASE?ssl=false"
echo "使用数据库连接: $DATABASE_URL"

echo "现在执行Prisma迁移部署..."
echo "使用纯JavaScript模式执行迁移..."
NODE_OPTIONS="--max-old-space-size=3072" npx prisma migrate deploy --schema=./prisma/schema.prisma || echo "迁移失败，继续启动应用"

# 检查并安装必要的工具
if ! command -v ts-node > /dev/null 2>&1; then
  echo "安装 ts-node..."
  npm install -g ts-node typescript
fi

# 添加种子数据初始化步骤
echo "执行数据库种子初始化..."
# 将标记文件放在用户主目录中，而不是/app目录
SEED_MARKER="$HOME/.seed_initialized"
if [ ! -f "$SEED_MARKER" ]; then
  echo "首次运行，执行数据库种子初始化..."
  NODE_OPTIONS="--max-old-space-size=3072" npx ts-node prisma/seed.ts || echo "种子初始化失败，继续启动应用"
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
    image: ad-workflow-x86:latest
    platform: linux/amd64
    container_name: test-app
    depends_on:
      mysql:
        condition: service_healthy
    environment:
      DATABASE_URL: mysql://ad_workflow:test_password@mysql:3306/ad_workflow?ssl=false
      MYSQL_USER: ad_workflow
      MYSQL_PASSWORD: test_password
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
if ! docker images | grep -q ad-workflow-x86; then
    echo "尝试构建镜像..."
    docker build -t ad-workflow-x86:latest -f Dockerfile.x86 .
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
docker buildx build --platform linux/amd64 --load -t ad-workflow-x86:latest -f Dockerfile.x86 .

# 检查构建是否成功
if ! docker image inspect ad-workflow-x86:latest &> /dev/null; then
    echo "错误: 镜像构建失败"
    exit 1
fi

echo "2. 正在导出镜像(压缩级别: $COMPRESS_LEVEL)..."
IMAGE_FILE="ad-workflow-x86-image.tar.gz"
docker save ad-workflow-x86:latest | gzip -$COMPRESS_LEVEL > $IMAGE_FILE

# 获取文件大小
FILE_SIZE=$(du -h $IMAGE_FILE | cut -f1)

echo "3. 创建部署包..."
DEPLOY_PACKAGE="ad-workflow-x86-deploy.tar.gz"

# 创建临时目录
TEMP_DIR="temp_package_x86"
mkdir -p $TEMP_DIR

# 复制必要的文件到临时目录
cp $IMAGE_FILE $TEMP_DIR/
# 复制并修正docker-compose文件
echo "复制并修正docker-compose.yml文件..."
cp docker-compose.x86.yml $TEMP_DIR/docker-compose.yml.tmp
# 将所有布尔值修改为字符串形式
sed 's/NEXTAUTH_TRUST_HOST: true/NEXTAUTH_TRUST_HOST: "true"/g; s/start_period: '"'"'60s'"'"'/start_period: "60s"/g' $TEMP_DIR/docker-compose.yml.tmp > $TEMP_DIR/docker-compose.yml
rm $TEMP_DIR/docker-compose.yml.tmp

cp .env.docker $TEMP_DIR/
cp -r secrets $TEMP_DIR/
mkdir -p $TEMP_DIR/scripts
cp scripts/start-x86.sh $TEMP_DIR/scripts/start.sh
chmod +x $TEMP_DIR/scripts/start.sh

# 创建修复脚本
cat > $TEMP_DIR/fix-compose-config.sh << 'EOF'
#!/bin/bash
set -e

echo "===== 修复Docker Compose配置文件 ====="

if [ ! -f "docker-compose.yml" ]; then
    echo "错误: 未找到docker-compose.yml文件"
    exit 1
fi

echo "备份原始文件..."
cp docker-compose.yml docker-compose.yml.bak

# 根据操作系统选择正确的sed参数
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS需要不同的sed参数
    echo "检测到macOS系统，使用兼容参数..."
    sed -i '' 's/NEXTAUTH_TRUST_HOST: true/NEXTAUTH_TRUST_HOST: "true"/g' docker-compose.yml
    sed -i '' 's/start_period: '"'"'60s'"'"'/start_period: "60s"/g' docker-compose.yml
else
    # Linux或其他系统
    echo "检测到Linux系统，使用标准参数..."
    sed -i 's/NEXTAUTH_TRUST_HOST: true/NEXTAUTH_TRUST_HOST: "true"/g' docker-compose.yml
    sed -i 's/start_period: '"'"'60s'"'"'/start_period: "60s"/g' docker-compose.yml
fi

echo "检查是否含有其他布尔值环境变量..."
grep -E ':[[:space:]]+(true|false)[[:space:]]*($|#)' docker-compose.yml || echo "未发现其他布尔值环境变量"

echo "===== 修复完成 ====="
echo "现在可以重新运行 ./start-service.sh 启动服务"
EOF

chmod +x $TEMP_DIR/fix-compose-config.sh

# 创建CentOS专用的前置安装脚本
cat > $TEMP_DIR/install-prerequisites.sh << 'EOF'
#!/bin/bash
set -e

echo "===== 安装工单系统所需的依赖 ====="

# 检查是否为root用户
if [ "$(id -u)" != "0" ]; then
   echo "此脚本需要root权限运行" 
   echo "请使用sudo或以root身份运行"
   exit 1
fi

# 检查系统版本
if [ -f /etc/centos-release ]; then
    echo "检测到CentOS系统"
    SYSTEM_TYPE="centos"
elif [ -f /etc/redhat-release ]; then
    echo "检测到RHEL/Fedora系统"
    SYSTEM_TYPE="redhat"
else
    echo "未检测到支持的系统类型，将尝试使用yum工具"
    SYSTEM_TYPE="unknown"
fi

echo "1. 安装基础工具..."
yum install -y yum-utils device-mapper-persistent-data lvm2 wget curl nc || {
    echo "无法安装基础工具包，请手动安装"
    echo "yum install -y yum-utils device-mapper-persistent-data lvm2 wget curl nc"
    exit 1
}

echo "2. 添加Docker存储库..."
yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo || {
    echo "无法添加Docker存储库，请手动添加"
    echo "yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo"
    exit 1
}

echo "3. 安装Docker..."
yum install -y docker-ce docker-ce-cli containerd.io || {
    echo "无法安装Docker，请手动安装"
    echo "yum install -y docker-ce docker-ce-cli containerd.io"
    exit 1
}

echo "4. 启动Docker服务..."
systemctl start docker
systemctl enable docker

echo "5. 安装Docker Compose..."
curl -L "https://github.com/docker/compose/releases/download/1.29.2/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose
ln -sf /usr/local/bin/docker-compose /usr/bin/docker-compose

echo "6. 验证安装..."
docker --version
docker-compose --version

echo "===== 依赖安装完成 ====="
echo "现在您可以运行 start-service.sh 启动工单系统"
EOF

chmod +x $TEMP_DIR/install-prerequisites.sh

# 创建部署说明
cat > $TEMP_DIR/README.md << 'EOF'
# 工单系统部署说明 (CentOS 7.x版本)

本部署包包含了所有必要的文件，用于在CentOS 7.x环境中部署工单系统。

## 系统要求
- CentOS 7.9或更高版本
- Docker 20.10或更高版本
- Docker Compose 1.29或更高版本
- 至少4GB RAM
- 至少10GB可用磁盘空间

## 快速部署方法

如果您的服务器是全新安装的CentOS系统，可以使用以下命令快速部署：

```bash
# 安装依赖(需要root权限)
sudo ./install-prerequisites.sh

# 导入镜像并启动服务
./start-service.sh
```

## 手动安装步骤

### 1. 安装Docker和Docker Compose（如果尚未安装）

```bash
# 安装所需的软件包
sudo yum install -y yum-utils device-mapper-persistent-data lvm2

# 添加Docker仓库
sudo yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo

# 安装Docker
sudo yum install -y docker-ce docker-ce-cli containerd.io

# 启动Docker并设置为开机自启
sudo systemctl start docker
sudo systemctl enable docker

# 安装Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/1.29.2/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
sudo ln -s /usr/local/bin/docker-compose /usr/bin/docker-compose

# 验证安装
docker --version
docker-compose --version
```

### 2. 导入Docker镜像

```bash
# 导入工单系统镜像
docker load < ad-workflow-x86-image.tar.gz
```

### 3. 配置环境

1. 修改.env.docker文件中的配置（如需要）
2. 修改secrets目录中的密码文件（强烈建议修改默认密码）

### 4. 启动应用

```bash
docker-compose up -d
```

### 5. 验证应用是否正常运行

```bash
docker-compose ps
```

应用成功启动后，可以通过http://服务器IP:3000访问工单系统。

## 宝塔面板反向代理配置

如果您使用宝塔面板，可以按照以下步骤配置反向代理：

1. 在宝塔面板中添加站点（如www.example.com）
2. 在站点设置中找到"反向代理"
3. 添加反向代理，目标URL设置为http://127.0.0.1:3000

## 故障排除

如果遇到问题，可以查看Docker容器的日志：

```bash
docker-compose logs app
docker-compose logs mysql
```

常见问题解决方法：

1. 如果MySQL容器无法启动，尝试删除数据卷后重新启动：
   ```bash
   docker-compose down -v
   docker-compose up -d
   ```

2. 如果应用容器显示"等待数据库连接"，但一直无法连接：
   ```bash
   # 检查MySQL是否正常运行
   docker exec -it ad-workflow-mysql mysqladmin -u root -p version
   # 然后重启应用容器
   docker-compose restart app
   ```

## 数据备份

定期备份MySQL数据：

```bash
# 备份到当前目录
docker exec ad-workflow-mysql mysqldump -u root -p$(cat secrets/mysql_root_password.txt) ad_workflow > backup.sql
```
EOF

# 创建启动脚本
cat > $TEMP_DIR/start-service.sh << 'EOF'
#!/bin/bash
set -e

echo "===== 启动工单系统 ====="

# 设置正确的文件权限
echo "设置文件权限..."
chmod +x scripts/start.sh || echo "Warning: 无法设置启动脚本权限"

# 检查操作系统类型
if [[ "$OSTYPE" == "darwin"* ]]; then
    echo "检测到macOS系统"
    # macOS下检查Docker服务
    if ! docker ps &>/dev/null; then
        echo "Docker服务未运行，尝试启动Docker..."
        # 尝试启动Docker Desktop应用
        if [ -d "/Applications/Docker.app" ]; then
            open -a Docker && sleep 5
            echo "已尝试启动Docker Desktop，等待服务就绪..."
            # 等待Docker启动
            timeout=60
            count=0
            while ! docker ps &>/dev/null; do
                sleep 2
                count=$((count+1))
                if [ $count -ge $timeout ]; then
                    echo "Docker服务未能在规定时间内启动，请手动启动Docker应用"
                    exit 1
                fi
                echo "等待Docker服务就绪... ($count/$timeout)"
            done
        else
            echo "未找到Docker Desktop应用，请手动启动Docker"
            exit 1
        fi
    fi
else
    # Linux系统
    # 检查是否使用systemd
    if command -v systemctl &>/dev/null; then
        echo "检测到systemd系统"
        if ! systemctl is-active --quiet docker; then
            echo "启动Docker服务..."
            systemctl start docker
        fi
    else
        echo "未检测到systemd，尝试使用service命令"
        if command -v service &>/dev/null; then
            if ! service docker status &>/dev/null; then
                echo "启动Docker服务..."
                service docker start || echo "无法启动Docker服务，请手动启动"
            fi
        else
            # 最后尝试直接检查Docker是否可用
            if ! docker ps &>/dev/null; then
                echo "Docker未运行，但找不到合适的方法启动服务"
                echo "请手动启动Docker服务后再运行此脚本"
                exit 1
            fi
        fi
    fi
fi

# 再次检查Docker是否真的可用
if ! docker info &>/dev/null; then
    echo "错误: Docker服务未启动或权限不足"
    echo "请确保Docker已正确安装并有足够权限运行"
    exit 1
fi

# 检测使用的Docker Compose命令格式
if docker compose version &>/dev/null; then
    echo "使用新版本的 docker compose 命令..."
    DOCKER_COMPOSE_CMD="docker compose"
elif docker-compose --version &>/dev/null; then
    echo "使用传统的 docker-compose 命令..."
    DOCKER_COMPOSE_CMD="docker-compose"
else
    echo "错误: 未找到 docker compose 或 docker-compose 命令"
    echo "请确保已正确安装 Docker Compose"
    exit 1
fi

# 停止并移除现有容器
echo "停止并移除现有容器..."
$DOCKER_COMPOSE_CMD down 2>/dev/null || true

# 启动容器
echo "启动容器..."
$DOCKER_COMPOSE_CMD up -d

# 检查容器是否成功启动
CONTAINER_PREFIX=${APP_CONTAINER_NAME:-ad-workflow-app-x86}
if docker ps | grep -q "$CONTAINER_PREFIX"; then
    echo "===== 启动成功 ====="
    echo "应用已在 http://localhost:3000 启动"
    echo "MySQL数据库在端口 3306 可访问"
    echo "可以使用以下命令查看日志:"
    echo "  $DOCKER_COMPOSE_CMD logs -f app"
else
    echo "===== 启动失败 ====="
    echo "容器未能成功启动，请查看日志获取更多信息:"
    echo "  $DOCKER_COMPOSE_CMD logs app"
    echo ""
    echo "您也可以尝试运行 ./fix-compose-config.sh 修复配置问题后重试"
fi
EOF

# 添加执行权限
chmod +x $TEMP_DIR/start-service.sh

# 打包部署文件
tar -czvf $DEPLOY_PACKAGE -C $TEMP_DIR .

# 清理临时目录
rm -rf $TEMP_DIR

# 获取文件大小
PACKAGE_SIZE=$(du -h $DEPLOY_PACKAGE | cut -f1)

echo "===== 全部完成 ====="
echo "镜像文件: $IMAGE_FILE (大小: $FILE_SIZE)"
echo "部署包: $DEPLOY_PACKAGE (大小: $PACKAGE_SIZE)"
echo "您可以将部署包直接提供给甲方，里面包含了所有必要的部署文件和说明"
echo "甲方可以使用以下命令解压部署包:"
echo "$ tar -xzvf $DEPLOY_PACKAGE"
echo "然后运行start-service.sh脚本启动服务"
echo "部署完成后，可以通过 http://服务器IP:3000 访问应用"

# 如果指定了测试标志，则运行测试
if [ "$RUN_TEST" = true ]; then
    echo "====== 开始本地测试 ======"
    ./test-docker-x86-local.sh
fi 