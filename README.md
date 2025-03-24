## Ad-Workflow 广告工单系统

这是一个基于 [Next.js](https://nextjs.org) 构建的广告工单系统，使用 App Router、Server Actions 和 Prisma ORM。

## 开发环境启动

首先，运行开发服务器:

```bash
npm run dev
# 或
yarn dev
# 或
pnpm dev
# 或
bun dev
```

在浏览器中打开 [http://localhost:3000](http://localhost:3000) 查看结果。

## Docker 部署说明

### 构建 Docker 镜像

```bash
# 构建 Docker 镜像
docker build -t ad-workflow:latest .
```

### Docker Compose 部署

1. 创建 docker-compose.yml 文件:

```yaml
version: '3'

services:
    mysql:
        image: mysql:5.7
        container_name: ad-workflow-mysql
        restart: always
        environment:
            MYSQL_ROOT_PASSWORD: your_root_password
            MYSQL_DATABASE: ad_workflow
            MYSQL_USER: ad_workflow
            MYSQL_PASSWORD: your_password
        volumes:
            - mysql-data:/var/lib/mysql
        ports:
            - '3306:3306'
        networks:
            - ad-workflow-network

    app:
        image: ad-workflow:latest
        container_name: ad-workflow-app
        restart: always
        depends_on:
            - mysql
        environment:
            - DATABASE_URL=mysql://ad_workflow:your_password@mysql:3306/ad_workflow
            - NODE_ENV=production
            - NEXTAUTH_URL=http://localhost:3000
            - NEXTAUTH_SECRET=your_nextauth_secret
        ports:
            - '3000:3000'
        networks:
            - ad-workflow-network
        command: >
            sh -c "npm run docker:init && npm start"

networks:
    ad-workflow-network:
        driver: bridge

volumes:
    mysql-data:
```

2. 启动 Docker Compose:

```bash
docker-compose up -d
```

### 系统初始化

系统启动时会自动执行以下操作:

1. 生成 Prisma 客户端
2. 应用数据库迁移
3. 初始化基础数据，包括:
    - 超级管理员账户 (账号: admin@example.com, 密码: Admin@123456)
    - 测试用户账户 (账号: user@example.com, 密码: User@123456)
    - 产品类型字典数据
    - Google 时区字典数据
    - TikTok 时区字典数据

如果需要单独运行初始化脚本，可以执行:

```bash
# 只运行数据初始化脚本
npm run db:seed

# 完整初始化流程
npm run docker:init
```

## 技术栈

- Next.js 14.2.24
- Prisma ORM
- MySQL 5.7
- Ant Design
- TypeScript
- TailwindCSS

## 了解更多

要了解有关 Next.js 的更多信息，请查看以下资源:

- [Next.js 文档](https://nextjs.org/docs) - 了解 Next.js 功能和 API。
- [学习 Next.js](https://nextjs.org/learn) - 一个交互式的 Next.js 教程。
