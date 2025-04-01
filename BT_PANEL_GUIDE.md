# 宝塔面板反向代理配置指南

本指南将帮助您在宝塔面板中为工单系统设置反向代理。

## 前提条件

1. 已经在CentOS 7.9上安装了宝塔面板
2. 已经通过Docker部署了工单系统
3. Docker容器已经正常运行在3000端口（默认）

## 配置步骤

### 1. 登录宝塔面板

打开浏览器，访问 `http://服务器IP:8888` 登录宝塔面板。

### 2. 添加网站

1. 点击左侧导航栏中的 `网站`
2. 点击 `添加站点` 按钮
3. 填写站点信息：
    - 域名：填写您的域名，例如 `workflow.yourdomain.com`
    - 根目录：使用默认值即可
    - FTP、数据库、PHP版本：均可不创建，选择纯静态
4. 点击 `提交` 按钮创建站点

### 3. 配置SSL（可选但推荐）

1. 在站点列表中找到刚创建的站点，点击 `设置`
2. 点击 `SSL` 选项卡
3. 您可以选择以下方式之一开启HTTPS：
    - 申请免费证书（Let's Encrypt）
    - 上传已有证书
4. 按照界面提示完成SSL配置
5. 开启强制HTTPS（可选）

### 4. 设置反向代理

1. 在站点列表中找到刚创建的站点，点击 `设置`
2. 点击 `反向代理` 选项卡
3. 点击 `添加反向代理` 按钮
4. 填写反向代理信息：
    - 名称：填写一个便于识别的名称，如 `工单系统`
    - 目标URL：`http://127.0.0.1:3000`（Docker容器的地址和端口）
    - 发送域名：保持默认
5. 点击 `提交` 按钮保存配置

### 5. 优化反向代理配置（推荐）

1. 在刚创建的反向代理行右侧点击 `配置文件`
2. 将以下配置添加到文件中：

```nginx
# 调整超时设置，避免长操作超时
proxy_connect_timeout 300s;
proxy_read_timeout 300s;
proxy_send_timeout 300s;

# 添加WebSocket支持（如果系统需要）
proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";

# 传递真实IP和主机头
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header Host $http_host;
```

3. 点击 `保存` 按钮
4. 重启Nginx服务

### 6. 验证配置

配置完成后，在浏览器中访问 `https://您的域名`（或 `http://您的域名`，如果没有配置SSL），应该能够正常访问工单系统。

## 故障排除

如果访问出现问题，请检查：

1. Docker容器是否正常运行：

    ```bash
    docker ps | grep ad-workflow-app
    ```

2. 容器日志是否有错误：

    ```bash
    docker-compose logs app
    ```

3. Nginx错误日志：
   在宝塔面板 > 网站 > 站点设置 > 日志 中查看

4. 防火墙设置：确保端口3000在服务器内部是可访问的（外部可以通过宝塔面板的Nginx访问）

## 安全建议

1. 限制Docker容器的3000端口只能在本地访问，避免直接暴露在公网
2. 在宝塔面板中配置WAF（网站防火墙）保护您的站点
3. 定期更新系统和Docker镜像
4. 启用HTTPS以加密传输数据
