# Stage 1: 基础环境
#FROM node:20-alpine AS base
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
# 安装MySQL客户端工具
RUN apk add --no-cache mysql-client

# Stage 2: 生产依赖安装
FROM base AS deps
WORKDIR /app

# 复制脚本目录
COPY scripts/ ./scripts/

# 设置执行权限
RUN chmod +x ./scripts/start.sh

COPY package.json ./
COPY pnpm-lock.yaml ./
# 确保安装同一个版本的Prisma和Client
# RUN pnpm install --prod --frozen-lockfile \
#     && pnpm add prisma@6.3.1 @prisma/client@6.3.1

# Stage 3: 完整构建
FROM base AS builder
WORKDIR /app
COPY scripts/ ./scripts/
# ⭐️ 关键修复：必须在复制后立即设置权限 ⭐️
RUN chmod +x ./scripts/start.sh && \
    ls -l ./scripts/start.sh  
# 验证权限

RUN apk add --no-cache build-base python3

# 配置可写路径（方案2）
ENV PNPM_HOME=/app/.pnpm-global
ENV PATH="$PNPM_HOME:$PATH"
ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN mkdir -p $PNPM_HOME

# 设置镜像源和引擎路径
# ENV PRISMA_ENGINES_MIRROR="https://registry.npmmirror.com/-/binary/prisma-engine"
# ENV PRISMA_BINARY_FILE_CACHE_DIR=/app/node_modules/@prisma/engines

COPY package.json ./
COPY pnpm-lock.yaml ./
# 显示诊断信息并使用--no-frozen-lockfile减少问题
RUN pnpm config set network-timeout 300000 && \
    pnpm config set fetch-retries 5 && \
    pnpm config set fetch-retry-mintimeout 20000 && \
    pnpm config set fetch-retry-maxtimeout 120000 && \
    echo "安装依赖，不使用锁定文件..." && \
    # 尝试使用更宽松的安装方式
    pnpm install --no-frozen-lockfile --unsafe-perm || (echo "==== 安装失败，查看日志 ====" && ls -la && exit 1)

# RUN wget -O /tmp/prisma-engine.tar.gz "https://registry.npmmirror.com/-/binary/prisma-engine/6.3.1-acc0b9dd43eb689cbd20c9470515d719db10d0b0/linux-musl-arm64-openssl-3.0.x.tar.gz"
# RUN tar -xzvf /tmp/prisma-engine.tar.gz -C /app/node_modules/@prisma/engines
# RUN chmod +x /app/node_modules/@prisma/engines/*

# 确保安装特定版本的Prisma，并且全局和本地版本一致
RUN echo "安装Prisma..." && \
    pnpm add -g prisma@6.3.1 @prisma/client@6.3.1 && \
    pnpm add -g tsx && \
    pnpm add prisma@6.3.1 @prisma/client@6.3.1

# 强制环境文件校验
ARG ENV_FILE=.env.docker
COPY ${ENV_FILE} .env
RUN test -f .env || (echo "Missing .env.docker" && exit 1)

COPY . .
# 设置正确的Prisma二进制目标和引擎类型
ENV PRISMA_BINARY_TARGETS="linux-arm64-openssl-3.0.x"
ENV PRISMA_ENGINE_PROTOCOL="json"
ENV PRISMA_CLI_QUERY_ENGINE_TYPE="library"
ENV PRISMA_CLIENT_ENGINE_TYPE="library"
ENV PRISMA_CLI_JS_ONLY="true"
# 尝试使用可用的引擎生成
RUN echo "生成Prisma客户端..." && \
    npm install -g prisma@6.3.1 && \
    PRISMA_CLI_JS_ONLY=true prisma generate --schema=./prisma/schema.prisma || \
    echo "Prisma generate failed, will try again at runtime"

# 构建Next.js应用 - 增加更多内存和调试信息
RUN echo "构建Next.js应用..." && \
    export NODE_OPTIONS="--max-old-space-size=4096" && \
    echo "已设置Node内存限制: $NODE_OPTIONS" && \
    ls -la node_modules/.bin/ && \
    echo "检查pnpm是否可用:" && which pnpm && \
    (NEXT_TELEMETRY_DISABLED=1 pnpm build || \
    (echo "构建失败，尝试使用npm" && \
    npm install && \
    NEXT_TELEMETRY_DISABLED=1 npm run build))

# Stage 4: 生产运行
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
# 设置正确的Prisma二进制目标
ENV PRISMA_BINARY_TARGETS="linux-arm64-openssl-3.0.x"
ENV PRISMA_ENGINE_PROTOCOL="json"
ENV PRISMA_CLI_QUERY_ENGINE_TYPE="library"
ENV PRISMA_CLIENT_ENGINE_TYPE="library"
ENV PRISMA_CLI_JS_ONLY="true"

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# 为nextjs用户创建npm全局目录
RUN mkdir -p /home/nextjs/.npm-global && \
    chown -R nextjs:nodejs /home/nextjs
RUN mkdir logs
RUN chown nextjs:nodejs /app/logs
# 配置用户特定的npm全局目录
ENV NPM_CONFIG_PREFIX=/home/nextjs/.npm-global
ENV PATH="/home/nextjs/.npm-global/bin:$PATH"

# 必须复制package.json
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nextjs:nodejs /app/pnpm-lock.yaml ./pnpm-lock.yaml

# 分开复制每个目录，避免使用多源文件的COPY命令
COPY --from=builder --chown=nextjs:nodejs /app/public/ ./public/

# 创建目标目录
RUN mkdir -p ./.next/static/

# 使用RUN命令有条件地复制文件，避免COPY命令中使用||true
RUN if [ -d "/app/.next/static/" ]; then \
    cp -r /app/.next/static/* ./.next/static/ || echo "No static files to copy"; \
    fi

# 单独复制standalone目录内容
RUN if [ -d "/app/.next/standalone/" ]; then \
    cp -r /app/.next/standalone/* ./ || echo "No standalone files to copy"; \
    fi

# 复制其他必要文件
COPY --from=builder --chown=nextjs:nodejs /app/prisma/ ./prisma/
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/ ./node_modules/
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nextjs:nodejs /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=builder --chown=nextjs:nodejs /app/scripts/ ./scripts/
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next/

# 确保生产环境中脚本有执行权限
RUN chmod +x ./scripts/start.sh

# 确保目录有正确的权限
RUN mkdir -p /app/.prisma /app/.cache && \
    chown -R nextjs:nodejs /app/node_modules /app/.prisma /app/.cache /app/.next /app/prisma /app && \
    chmod -R 755 /app/node_modules

# 列出文件确认是否正确复制
RUN echo "验证文件复制情况..." && \
    ls -la /app/ && \
    echo "检查package.json文件是否存在:" && \
    cat /app/package.json | head -n 5

# 使用非root用户运行
USER nextjs

# 预先安装Prisma到用户可写的目录，并设置使用JS引擎
RUN mkdir -p /home/nextjs/.prisma-bin && \
    cd /home/nextjs/.prisma-bin && \
    npm init -y && \
    npm install --save prisma@6.3.1 @prisma/client@6.3.1 tsx && \
    chmod -R 755 /home/nextjs/.prisma-bin && \
    ln -s /home/nextjs/.prisma-bin/node_modules/.bin/prisma /home/nextjs/.npm-global/bin/prisma || true && \
    ln -s /home/nextjs/.prisma-bin/node_modules/.bin/tsx /home/nextjs/.npm-global/bin/tsx || true

# 创建Prisma引擎缓存目录
RUN mkdir -p /home/nextjs/.prisma /home/nextjs/.cache && \
    chmod -R 755 /home/nextjs/.prisma /home/nextjs/.cache

# 确保目录结构和权限
RUN mkdir -p /home/nextjs/.npm-global/lib /home/nextjs/.npm-global/bin \
    && chmod -R 755 /home/nextjs/.npm-global \
    && chown -R nextjs:nodejs /home/nextjs/.npm-global

EXPOSE 3000
# 修改为使用启动脚本
CMD ["./scripts/start.sh"]
