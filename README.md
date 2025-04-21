# 工单系统部署简易指南

本文档提供了如何在甲方环境中快速部署工单系统的简要步骤。

## 部署前准备

1. 确保服务器已安装Docker (19.03+)和Docker Compose (1.25+)
2. 确保服务器至少有2GB内存和10GB磁盘空间
3. 确保端口3000和3306未被占用

## 快速部署步骤

### 1. 导入Docker镜像

```bash
# 解压镜像文件（如果是压缩的）
# tar -xzf ad-workflow-package.tar.gz

# 加载Docker镜像
docker load < ad-workflow-image.tar.gz
```

### 2. 准备配置文件

1. 创建一个工作目录:

```bash
mkdir -p /opt/ad-workflow
cd /opt/ad-workflow
```

2. 将下列文件复制到该目录:

    - docker-compose.yml
    - .env.example (复制为.env)

3. 配置环境变量:

```bash
cp .env.example .env
# 编辑.env文件，设置必要的参数
nano .env
```

### 3. 启动服务

```bash
docker-compose up -d
```

服务启动后，访问 `http://服务器IP:3000` 即可使用工单系统。

### 默认管理员账户

- 用户名: admin
- 密码: Aa123123

**重要**: 首次登录后请立即修改默认密码。

## 常见问题排查

如果遇到问题，请检查:

1. Docker容器状态:

```bash
docker-compose ps
```

2. 应用日志:

```bash
docker-compose logs app
```

3. 数据库连接:

```bash
docker-compose logs mysql
```

详细的故障排除指南请参考完整的DEPLOYMENT.md文档。

## 项目状态

请查看[项目状态跟踪文档](./PROJECT_STATUS.md)获取最新的开发进展。

**当前版本:** v0.5.0
**下一版本:** v0.8.0 (计划发布日期: 2025-05-15)
**总体进度:** 60%

### 快速链接

- [已知问题](./PROJECT_STATUS.md#已知问题)
- [开发路线图](./PROJECT_STATUS.md#未来计划)
- [版本里程碑](./PROJECT_STATUS.md#版本里程碑)
