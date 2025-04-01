#!/bin/bash
set -e

echo "启动MySQL容器..."
docker run -d --platform linux/amd64 --name mysql-test \
  -e MYSQL_ROOT_PASSWORD=testroot \
  -e MYSQL_DATABASE=ad_workflow \
  -e MYSQL_USER=ad_workflow \
  -e MYSQL_PASSWORD=testpass \
  -p 3307:3306 \
  mysql:5.7.43

echo "等待MySQL启动... (30秒)"
sleep 30

echo "启动应用容器..."
docker run -d --platform linux/amd64 --name app-test \
  --link mysql-test:mysql \
  -e DATABASE_URL=mysql://ad_workflow:testpass@mysql:3306/ad_workflow \
  -e MYSQL_HOST=mysql \
  -e MYSQL_USER=ad_workflow \
  -e MYSQL_PASSWORD=testpass \
  -e MYSQL_DATABASE=ad_workflow \
  -e NEXTAUTH_URL=http://localhost:3000 \
  -e NEXTAUTH_SECRET=Xo0W6XZGEWcNIyFnSqSsD+aLRcMQfDcLkK7Rp71wsqE= \
  -p 3000:3000 \
  ad-workflow-x86:latest

echo "应用启动中... (10秒)"
sleep 10

echo "查看应用日志..."
docker logs app-test

echo "测试应用健康状态..."
curl -v http://localhost:3000/api/health || echo "应用可能还未完全启动，请稍后再试"

echo "测试完成后，运行以下命令清理环境:"
echo "docker rm -f app-test mysql-test"
