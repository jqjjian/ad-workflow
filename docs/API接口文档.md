# 广告工作流系统 API 文档

## 1. API目录清单

本文档提供广告工作流系统的所有API接口列表，按照功能模块分类，并标明版本号与调用权限。

### 1.1 认证与用户管理模块

| 接口名称 | 接口路径                          | 方法     | 版本 | 权限要求 | 描述                                    |
| -------- | --------------------------------- | -------- | ---- | -------- | --------------------------------------- |
| 认证服务 | `/api/auth/[...nextauth]`         | GET/POST | v1.0 | 无需认证 | NextAuth.js集成的认证服务，支持凭证登录 |
| 清除会话 | `/api/auth/clear-session`         | GET      | v1.0 | 无需认证 | 清除所有会话Cookie，用于解决JWT解密错误 |
| 用户登录 | `/login` (Server Action)          | POST     | v1.0 | 无需认证 | 用户登录服务端Action                    |
| 用户注册 | `/register` (Server Action)       | POST     | v1.0 | 无需认证 | 用户注册服务端Action                    |
| 重置密码 | `/reset-password` (Server Action) | POST     | v1.0 | 无需认证 | 重置用户密码服务端Action                |
| 用户管理 | `/user` (Server Action)           | 多种     | v1.0 | 需要认证 | 用户信息管理相关操作                    |

### 1.2 健康检查模块

| 接口名称 | 接口路径      | 方法 | 版本 | 权限要求 | 描述                           |
| -------- | ------------- | ---- | ---- | -------- | ------------------------------ |
| 健康检查 | `/api/health` | GET  | v1.0 | 无需认证 | 验证应用是否正常运行及环境配置 |

### 1.3 文件上传模块

| 接口名称 | 接口路径      | 方法    | 版本 | 权限要求 | 描述                               |
| -------- | ------------- | ------- | ---- | -------- | ---------------------------------- |
| 文件上传 | `/api/upload` | POST    | v1.0 | 需要认证 | 上传文件服务，支持各类业务所需文件 |
| 跨域预检 | `/api/upload` | OPTIONS | v1.0 | 无需认证 | 文件上传接口的CORS预检请求支持     |

### 1.4 工单处理模块

| 接口名称       | 接口路径                  | 方法 | 版本 | 权限要求 | 描述                           |
| -------------- | ------------------------- | ---- | ---- | -------- | ------------------------------ |
| 第三方回调处理 | `/api/workorder/callback` | POST | v1.0 | 需要认证 | 处理第三方系统对工单状态的回调 |
| 工单状态查询   | `/api/workorder/status`   | GET  | v1.0 | 需要认证 | 查询工单处理状态（已废弃保留） |

#### 1.4.1 账户申请工单相关 (Server Actions)

| 接口名称         | 接口路径                                          | 方法 | 版本 | 权限要求 | 描述                 |
| ---------------- | ------------------------------------------------- | ---- | ---- | -------- | -------------------- |
| 账户申请公共操作 | `/actions/workorder/common`                       | POST | v1.0 | 需要认证 | 通用工单处理逻辑     |
| 账户申请         | `/actions/workorder/account-application`          | POST | v1.0 | 需要认证 | 通用账户申请处理     |
| Google账户申请   | `/actions/workorder/google-account-application`   | POST | v1.0 | 需要认证 | Google广告账户申请   |
| Facebook账户申请 | `/actions/workorder/facebook-account-application` | POST | v1.0 | 需要认证 | Facebook广告账户申请 |
| TikTok账户申请   | `/actions/workorder/tiktok-account-application`   | POST | v1.0 | 需要认证 | TikTok广告账户申请   |

#### 1.4.2 账户管理工单相关 (Server Actions)

| 接口名称   | 接口路径                                           | 方法 | 版本 | 权限要求 | 描述             |
| ---------- | -------------------------------------------------- | ---- | ---- | -------- | ---------------- |
| 账户管理   | `/actions/workorder/account-management`            | POST | v1.0 | 需要认证 | 广告账户管理操作 |
| 存款操作   | `/actions/workorder/account-management/deposit`    | POST | v1.0 | 需要认证 | 账户存款操作     |
| 提款操作   | `/actions/workorder/account-management/withdrawal` | POST | v1.0 | 需要认证 | 账户提款操作     |
| 转账操作   | `/actions/workorder/account-management/transfer`   | POST | v1.0 | 需要认证 | 账户间转账操作   |
| 零余额操作 | `/actions/workorder/account-management/zeroing`    | POST | v1.0 | 需要认证 | 账户零余额操作   |
| 账户绑定   | `/actions/workorder/account-management/binding`    | POST | v1.0 | 需要认证 | 账户绑定操作     |

### 1.5 数据字典模块 (Server Actions)

| 接口名称 | 接口路径              | 方法 | 版本 | 权限要求 | 描述                 |
| -------- | --------------------- | ---- | ---- | -------- | -------------------- |
| 字典管理 | `/actions/dictionary` | 多种 | v1.0 | 需要认证 | 系统字典管理相关操作 |

### 1.6 模拟数据接口 (仅开发环境)

| 接口名称       | 接口路径                   | 方法 | 版本 | 权限要求 | 描述                       |
| -------------- | -------------------------- | ---- | ---- | -------- | -------------------------- |
| Google账户模拟 | `/api/mock/google-account` | GET  | v1.0 | 需要认证 | 模拟获取Google账户申请详情 |
| Google账户模拟 | `/api/mock/google-account` | POST | v1.0 | 需要认证 | 模拟创建Google账户申请     |
| Google账户模拟 | `/api/mock/google-account` | PUT  | v1.0 | 需要认证 | 模拟更新Google账户申请     |

## 2. API调用权限说明

系统API的调用权限分为以下几类：

1. **无需认证**：无需登录即可访问的公共API，如健康检查、认证服务等
2. **需要认证**：需要用户登录后才能访问的API，通过JWT Token验证身份
3. **角色权限**：根据用户角色限制访问权限
    - **SUPER_ADMIN**：超级管理员，可访问所有API
    - **ADMIN**：管理员，可访问大部分管理功能
    - **USER**：普通用户，仅可访问基本功能

## 3. API版本控制

当前API版本为`v1.0`，API更新时遵循以下规则：

- **小版本更新**（如v1.0 -> v1.1）：向后兼容的变更
- **大版本更新**（如v1.0 -> v2.0）：不兼容的变更，会通过新的路径提供

## 4. API请求认证

大多数API需要通过NextAuth.js提供的认证机制进行身份验证：

1. 客户端通过`/api/auth/[...nextauth]`接口获取JWT Token
2. Token存储在Cookie中，系统会自动将其附加到请求中
3. 服务器端通过中间件验证Token的有效性和权限

对于Server Actions，认证通过服务器端会话状态进行验证。

## 5. 错误处理

API返回的错误格式统一为：

```json
{
    "success": false,
    "message": "错误描述信息",
    "code": "错误代码（可选）"
}
```

常见错误代码：

- 400：请求参数错误
- 401：未认证
- 403：权限不足
- 404：资源不存在
- 500：服务器内部错误

## 6. 数据返回格式

API成功响应的标准格式：

```json
{
    "success": true,
    "data": {
        // 具体业务数据
    },
    "message": "操作成功"
}
```
