#!/bin/bash
# 脚本名称: export-docker-image.sh
# 功能: 打包Docker镜像并导出为tar文件
# 用法: ./export-docker-image.sh [输出文件名(可选)]

set -e

# 颜色设置
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # 无颜色

# 日志函数
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[警告]${NC} $1"
}

log_error() {
    echo -e "${RED}[错误]${NC} $1"
}

# 显示标题
echo -e "${BLUE}===== Docker镜像打包脚本 =====${NC}"
echo "该脚本将构建并导出Docker镜像为tar文件"
echo ""

# 配置项
IMAGE_NAME="ad-workflow-x86"
IMAGE_TAG="latest"
FULL_IMAGE_NAME="${IMAGE_NAME}:${IMAGE_TAG}"
CURRENT_DATE=$(date +"%Y%m%d")

# 处理输出文件名
if [ -z "$1" ]; then
    OUTPUT_FILE="${IMAGE_NAME}-${CURRENT_DATE}.tar"
else
    OUTPUT_FILE="$1"
fi

# 检查Docker是否已安装
if ! command -v docker &> /dev/null; then
    log_error "Docker未安装，请先安装Docker"
    exit 1
fi

# 检查Docker服务是否运行
if ! docker info &> /dev/null; then
    log_error "无法连接到Docker服务，请确保Docker服务已启动"
    exit 1
fi

# 检查是否有Dockerfile.x86
if [ ! -f "Dockerfile.x86" ]; then
    log_error "Dockerfile.x86不存在，请确保位于正确的目录"
    exit 1
fi

# 定义构建和导出函数
build_image() {
    log_info "开始构建Docker镜像 ${FULL_IMAGE_NAME}..."
    log_info "明确指定构建为AMD/x86平台镜像"
    docker build --platform=linux/amd64 -t ${FULL_IMAGE_NAME} -f Dockerfile.x86 .
    
    if [ $? -ne 0 ]; then
        log_error "镜像构建失败"
        exit 1
    fi
    
    # 确认镜像架构
    PLATFORM=$(docker inspect --format '{{.Os}}/{{.Architecture}}' ${FULL_IMAGE_NAME})
    log_info "镜像平台: ${PLATFORM}"
    
    log_info "镜像构建成功: ${FULL_IMAGE_NAME}"
}

export_image() {
    log_info "开始将镜像导出到文件: ${OUTPUT_FILE}..."
    docker save -o ${OUTPUT_FILE} ${FULL_IMAGE_NAME}
    
    if [ $? -ne 0 ]; then
        log_error "镜像导出失败"
        exit 1
    fi
    
    # 获取文件大小
    FILE_SIZE=$(du -h ${OUTPUT_FILE} | cut -f1)
    log_info "镜像已成功导出到文件: ${OUTPUT_FILE} (${FILE_SIZE})"
}

# 执行主流程
echo -e "${YELLOW}将执行以下操作:${NC}"
echo "1. 构建Docker镜像: ${FULL_IMAGE_NAME}"
echo "2. 导出镜像到文件: ${OUTPUT_FILE}"
echo ""

# 询问是否继续
read -p "是否继续? [Y/n] " -n 1 -r
echo    # 换行
if [[ $REPLY =~ ^[Nn]$ ]]; then
    log_info "操作已取消"
    exit 0
fi

# 开始构建并导出
log_info "开始处理..."
build_image
export_image

# 压缩文件
log_info "是否要压缩导出的tar文件? [y/N] "
read -n 1 -r
echo    # 换行
if [[ $REPLY =~ ^[Yy]$ ]]; then
    COMPRESSED_FILE="${OUTPUT_FILE}.gz"
    log_info "开始压缩文件..."
    gzip -f ${OUTPUT_FILE}
    log_info "文件已压缩: ${COMPRESSED_FILE}"
    
    # 获取压缩后的文件大小
    COMPRESSED_SIZE=$(du -h ${COMPRESSED_FILE} | cut -f1)
    log_info "压缩文件大小: ${COMPRESSED_SIZE}"
fi

# 完成
echo ""
log_info "操作完成!"
log_info "已创建AMD/x86平台的Docker镜像并导出为文件"
echo -e "${GREEN}您可以使用以下命令在另一台机器上加载此镜像:${NC}"
echo "  docker load -i ${OUTPUT_FILE}"
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "  或者对于压缩文件: gunzip -c ${COMPRESSED_FILE} | docker load"
fi
echo ""
echo "加载后，您可以通过以下命令运行它(添加--platform=linux/amd64参数确保兼容性):"
echo "  docker run -d --platform=linux/amd64 -p 80:3000 ${FULL_IMAGE_NAME}"
echo ""
