# 工单系统部署指南

本文档提供了如何在甲方环境中部署工单系统的详细步骤。

## 系统要求

- Docker 19.03 或更高版本
- Docker Compose 1.25 或更高版本
- 至少 2GB 内存
- 至少 10GB 磁盘空间

## 部署步骤

### 1. 准备环境

确保目标服务器已安装 Docker 和 Docker Compose。

#### 安装 Docker (如果尚未安装)

```bash
# CentOS
sudo yum install -y docker

# Ubuntu
sudo apt-get update
sudo apt-get install -y docker.io

# 启动 Docker 服务
sudo systemctl start docker
sudo systemctl enable docker
```

#### 安装 Docker Compose (如果尚未安装)

```bash
sudo curl -L "https://github.com/docker/compose/releases/download/1.29.2/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

### 2. 解压部署包

将提供的部署包解压到适当的目录：

```bash
mkdir -p /opt/ad-workflow
tar -zxvf ad-workflow-docker.tar.gz -C /opt/ad-workflow
cd /opt/ad-workflow
```

### 3. 配置环境变量

1. 复制环境变量示例文件并根据实际环境进行修改：

```bash
cp .env.example .env
```

2. 使用文本编辑器打开 `.env` 文件进行配置：

```bash
nano .env
```

主要配置项说明：

- `NEXTAUTH_SECRET` 和 `AUTH_SECRET`: 用于加密会话，请设置为安全的随机字符串
- `MYSQL_ROOT_PASSWORD` 和 `MYSQL_PASSWORD`: 设置为安全的数据库密码
- `NEXTAUTH_URL`: 设置为您的实际访问域名或IP，例如 `http://your-domain.com:3000`

### 4. 启动服务

```bash
docker-compose up -d
```

首次启动时，系统将：

1. 拉取必要的 Docker 镜像
2. 创建数据库和表结构
3. 初始化系统数据

### 5. 验证部署

服务启动后，可以通过以下方式验证部署是否成功：

```bash
# 检查容器运行状态
docker-compose ps

# 查看应用日志
docker-compose logs -f app
```

成功后，通过浏览器访问 `http://服务器IP:3000` 即可看到登录界面。

### 6. 默认账户

系统默认创建了管理员账户，初始登录信息：

- 用户名: admin
- 密码: Aa123123

**重要**: 首次登录后请立即修改默认密码。

## 常见问题

### 数据库连接失败

检查 .env 文件中的数据库配置是否正确，特别是密码设置。

### 无法访问应用

1. 检查防火墙是否开放了相应端口
2. 检查 Docker 容器是否正常运行
3. 查看应用日志了解具体错误

```bash
# 检查3000端口是否开放
firewall-cmd --list-ports

# 如未开放，可以执行
sudo firewall-cmd --zone=public --add-port=3000/tcp --permanent
sudo firewall-cmd --reload
```

### 数据备份与恢复

MySQL数据存储在Docker卷中，可通过以下方式备份与恢复：

#### 备份

```bash
docker exec ad-workflow-mysql sh -c 'exec mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" ad_workflow' > backup.sql
```

#### 恢复

```bash
cat backup.sql | docker exec -i ad-workflow-mysql sh -c 'exec mysql -uroot -p"$MYSQL_ROOT_PASSWORD" ad_workflow'
```

## 支持与联系

如果您在部署过程中遇到任何问题，请联系我们的技术支持团队：

- 电话：XXX-XXXX-XXXX
- 邮箱：support@example.com
