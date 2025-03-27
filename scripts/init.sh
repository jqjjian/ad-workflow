#!/bin/sh
set -e

# 导入环境变量
source /app/scripts/env.sh

echo "正在初始化数据库..."
# 生成 Prisma 客户端
NODE_OPTIONS="--max-old-space-size=3072" npx prisma generate --schema=./prisma/schema.prisma

# 运行数据库迁移
NODE_OPTIONS="--max-old-space-size=3072" npx prisma migrate deploy --schema=./prisma/schema.prisma

# 执行种子脚本
NODE_OPTIONS="--max-old-space-size=3072" pnpm run db:seed

echo "数据库初始化完成!" 