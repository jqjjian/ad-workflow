# 工单系统故障排除指南

本文档提供常见问题的排查和解决方法，帮助您在遇到问题时快速恢复系统运行。

## 容器启动问题

### 问题：容器无法启动

**症状**：`docker-compose up -d`后，容器没有正常运行

**排查步骤**：

1. 查看容器状态：

    ```bash
    docker-compose ps
    ```

2. 查看容器日志：
    ```bash
    docker-compose logs app
    docker-compose logs mysql
    ```

**常见原因和解决方案**：

- **端口冲突**：检查端口是否被占用

    ```bash
    netstat -tuln | grep 3000
    netstat -tuln | grep 3306
    ```

    解决方案：修改`.env`文件中的`APP_PORT`或`MYSQL_PORT`设置

- **内存不足**：检查服务器内存使用情况

    ```bash
    free -m
    ```

    解决方案：增加服务器内存或减少容器内存限制

- **磁盘空间不足**：检查磁盘使用情况
    ```bash
    df -h
    ```
    解决方案：清理磁盘空间或扩容

## 数据库问题

### 问题：数据库连接失败

**症状**：应用日志中出现数据库连接错误

**排查步骤**：

1. 检查数据库容器是否正常运行：

    ```bash
    docker-compose ps mysql
    ```

2. 检查数据库连接参数：

    ```bash
    cat .env | grep DATABASE_URL
    ```

3. 尝试从容器内连接数据库：
    ```bash
    docker exec -it ad-workflow-mysql mysql -uroot -p
    ```

**常见原因和解决方案**：

- **数据库密码错误**：确保`.env`中的数据库密码与实际设置一致
- **数据库未完全初始化**：重新启动数据库容器
    ```bash
    docker-compose restart mysql
    ```
- **数据库配置错误**：检查并修改数据库配置

### 问题：数据库数据丢失

**解决方案**：

1. 如果有备份，恢复备份：
    ```bash
    cat backup.sql | docker exec -i ad-workflow-mysql sh -c 'exec mysql -uroot -p"$MYSQL_ROOT_PASSWORD" ad_workflow'
    ```
2. 如果没有备份，检查Docker卷是否存在：
    ```bash
    docker volume ls | grep mysql-data
    ```
    卷存在但数据丢失，可能是权限问题或文件系统错误。

## 应用访问问题

### 问题：无法访问Web界面

**症状**：浏览器无法打开应用URL

**排查步骤**：

1. 确认应用容器运行状态：

    ```bash
    docker-compose ps app
    ```

2. 检查网络连通性：

    ```bash
    curl localhost:3000
    ```

3. 检查防火墙设置：
    ```bash
    firewall-cmd --list-ports
    ```

**常见原因和解决方案**：

- **应用未完全启动**：查看应用日志，等待应用完全启动
    ```bash
    docker-compose logs -f app
    ```
- **防火墙阻止**：开放需要的端口
    ```bash
    sudo firewall-cmd --zone=public --add-port=3000/tcp --permanent
    sudo firewall-cmd --reload
    ```
- **NEXTAUTH_URL配置错误**：确保`.env`中的`NEXTAUTH_URL`设置正确

## 性能问题

### 问题：系统响应缓慢

**排查步骤**：

1. 检查容器资源使用情况：

    ```bash
    docker stats
    ```

2. 检查应用日志是否有错误或警告：

    ```bash
    docker-compose logs app | grep -i error
    docker-compose logs app | grep -i warn
    ```

3. 检查数据库性能：
    ```bash
    docker exec -it ad-workflow-mysql mysqladmin -uroot -p status
    ```

**解决方案**：

- 增加容器资源限制
- 优化数据库查询
- 检查网络延迟

## 登录问题

### 问题：无法登录系统

**排查步骤**：

1. 检查用户名和密码是否正确
2. 检查认证相关的环境变量：
    ```bash
    cat .env | grep AUTH
    ```
3. 检查应用日志中的认证错误：
    ```bash
    docker-compose logs app | grep -i auth
    ```

**解决方案**：

- 重置管理员密码
- 检查和更新认证密钥
- 确保NextAuth配置正确

## 系统维护

### 如何安全重启系统

```bash
# 平滑重启所有服务
docker-compose restart

# 或者完全停止后重启
docker-compose down
docker-compose up -d
```

### 如何更新系统

1. 备份数据库：

    ```bash
    docker exec ad-workflow-mysql sh -c 'exec mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" ad_workflow' > backup.sql
    ```

2. 拉取新的镜像或导入新提供的镜像：

    ```bash
    # 如果是提供新的镜像文件
    docker load < new-ad-workflow-image.tar.gz

    # 更新docker-compose.yml中的镜像标签（如果需要）
    ```

3. 重启服务：
    ```bash
    docker-compose down
    docker-compose up -d
    ```

### 如何彻底卸载系统

```bash
# 停止所有服务
docker-compose down

# 删除所有相关数据卷（谨慎操作，会删除所有数据！）
docker volume rm ad-workflow-mysql-data

# 删除镜像
docker rmi ad-workflow:latest
```

## 联系支持

如果您遇到无法解决的问题，请联系我们的技术支持团队：

- 电话：XXX-XXXX-XXXX
- 邮箱：support@example.com

在联系支持时，请提供以下信息：

1. 详细的错误描述
2. 相关的容器日志
3. 服务器环境信息（操作系统版本、Docker版本等）
