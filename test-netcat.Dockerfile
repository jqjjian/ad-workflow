FROM node:20
# 测试不同版本的netcat安装
RUN apt-get update && apt-get install -y wget
RUN apt-get update && apt-get install -y netcat-traditional || echo "netcat-traditional安装失败"
RUN apt-get update && apt-get install -y netcat-openbsd || echo "netcat-openbsd安装失败"
RUN apt-get update && apt-get install -y netcat || echo "netcat安装失败"
RUN apt-get update && apt-get install -y nc || echo "nc安装失败"

# 检查安装了哪个版本
RUN which nc || echo "未找到nc命令"
RUN which netcat || echo "未找到netcat命令"
RUN ls -la /bin/nc* || echo "未找到nc可执行文件"
RUN ls -la /usr/bin/nc* || echo "未找到usr/bin下的nc可执行文件" 