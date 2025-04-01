# Docker配置修复与恢复指南

## 恢复您的Docker配置

我们创建了几个脚本来解决M1 Mac上运行x86_64 Docker镜像的问题。这里提供了如何使用这些脚本的指南。

### 1. 恢复Docker配置（首先尝试）

```bash
# 请先手动启动Docker Desktop应用
./restore-docker.sh
```

此脚本会:

- 恢复Docker客户端配置文件 (`~/.docker/config.json`)
- 恢复Docker Desktop设置
- 安装跨架构支持（QEMU）
- 测试基本Docker功能和x86_64架构模拟

### 2. 测试基本Docker功能

如果恢复成功，可以运行基础测试脚本验证Docker的各项功能:

```bash
./direct-test.sh
```

此脚本会测试:

- 本地ARM64容器
- x86_64架构容器模拟
- MySQL容器启动
- 镜像保存和加载功能

### 3. 尝试构建x86_64架构镜像

如果前面的测试都通过，可以尝试构建一个简化的x86_64测试镜像:

```bash
./x86-cross-build.sh
```

### 4. 如何解决架构相关问题

在M1 Mac上运行x86_64 Docker镜像时，可能遇到以下问题:

1. **配置文件格式问题**
    - `features.buildkit`值应为布尔值`true`而非字符串`"true"`
2. **QEMU模拟支持问题**

    - 需要安装最新的QEMU支持: `docker run --rm --privileged tonistiigi/binfmt:latest --install all`

3. **unpigz和其他工具格式错误**

    - 这是因为Docker尝试在ARM架构上直接执行x86_64二进制文件
    - 解决方案是确保Docker Desktop正确启用Rosetta 2支持

4. **Docker资源限制**
    - 增加Docker Desktop的内存和CPU分配（Docker Desktop设置中调整）

## Docker Desktop设置恢复

如果需要完全重置Docker Desktop设置，可以尝试:

1. 备份当前设置:

```bash
cp ~/Library/Group\ Containers/group.com.docker/settings.json ~/settings.json.backup
```

2. 删除并重新安装Docker Desktop

```bash
# 卸载Docker Desktop
rm -rf /Applications/Docker.app
rm -rf ~/.docker
rm -rf ~/Library/Group\ Containers/group.com.docker
rm -rf ~/Library/Containers/com.docker.*

# 重新安装Docker Desktop
# 从官网下载最新版本的Docker Desktop并安装
```

## 针对Docker在M1/M2 Mac上的建议

1. 确保使用最新版本的Docker Desktop
2. 为Docker Desktop分配足够的内存（至少8GB）
3. 明确指定`--platform=linux/amd64`标志
4. 对于重要的生产部署测试，建议在与目标环境相同架构的系统上进行
