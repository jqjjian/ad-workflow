# Nginx 反向代理配置说明

为了确保工单系统在使用Nginx反向代理时正常工作，特别是解决根路径访问问题，请按照以下步骤配置宝塔面板中的Nginx：

## 宝塔面板配置步骤

1. 登录宝塔面板，进入【网站】模块
2. 添加或选择已有的域名站点 `myad.shopwis.cn`
3. 点击【设置】→【反向代理】→【添加反向代理】
4. 填写以下信息：

    - 代理名称：`ad-workflow`
    - 目标URL：`http://127.0.0.1:3000`
    - 发送域名：`$host`

5. 点击【高级】，添加以下配置：

```
# 启用WebSocket支持
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";

# 传递真实客户端信息
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
proxy_set_header X-Forwarded-Host $host;

# 确保根路径请求正确处理
proxy_intercept_errors on;

# 防止缓存中间件响应
proxy_cache_bypass $http_upgrade;

# 超时设置
proxy_connect_timeout 300s;
proxy_send_timeout 300s;
proxy_read_timeout 300s;
```

6. 保存配置

## 配置文件参考

本目录中的 `myad.shopwis.cn.conf` 文件是一个完整的Nginx配置参考。如果您想手动配置Nginx，可以参考这个文件。

## 故障排查

如果配置完成后访问根路径（`https://myad.shopwis.cn/`）仍然有问题，请尝试以下步骤：

1. 检查容器环境变量是否正确

    - `NEXTAUTH_URL` 应设置为完整的外部访问URL，例如 `https://myad.shopwis.cn`
    - `NEXTAUTH_URL_INTERNAL` 应设置为 `http://localhost:3000`

2. 检查容器日志

    ```bash
    docker logs ad-workflow-app-x86
    ```

3. 检查Nginx日志

    - 在宝塔面板中查看站点的错误日志
    - 或通过命令行查看：`tail -f /www/wwwlogs/myad.shopwis.cn.error.log`

4. 测试直接访问容器

    ```bash
    curl http://localhost:3000/login
    ```

5. 确保防火墙允许3000端口（如有必要）
    ```bash
    firewall-cmd --zone=public --add-port=3000/tcp --permanent
    firewall-cmd --reload
    ```

## 重启服务

配置修改后，请重启服务以应用新配置：

```bash
cd /path/to/ad-workflow
docker-compose -f docker-compose.x86.yml down
docker-compose -f docker-compose.x86.yml up -d
```

然后重启Nginx服务（通过宝塔面板或命令行）：

```bash
systemctl restart nginx
# 或在宝塔面板中点击【服务】→【Nginx】→【重启】
```
