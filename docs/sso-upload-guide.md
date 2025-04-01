# 阿里云SSO认证与文件上传服务使用指南

本文档介绍如何使用阿里云SSO服务进行身份认证并上传文件。

## 1. 概述

该服务主要提供以下功能：

1. 获取阿里云SSO认证Token
2. 获取OSS配置信息
3. 文件上传至阿里云OSS
4. 在账户申请流程中使用文件上传功能

## 2. 实现方式

该功能主要通过以下两个模块实现：

- `SSOService`: 核心服务类，负责SSO Token获取、配置查询和实际文件上传。
- `FileUploadUtil`: 封装了面向业务的文件上传工具类，提供简单易用的接口。

## 3. 基本使用

### 3.1 获取SSO Token

```typescript
import { SSOService } from '@/lib/sso-service'

// 创建服务实例
const ssoService = new SSOService()

// 获取Token
const token = await ssoService.getToken('13268125705', 'aa123456')
console.log('获取的Token:', token)

// 获取SSO配置
const config = await ssoService.getSSOConfig()
console.log('获取的配置:', config)
```

### 3.2 上传文件

```typescript
import { FileUploadUtil, UploadType } from '@/utils/file-upload'

// 初始化上传工具(只需要调用一次)
await FileUploadUtil.initialize()

// 上传单个文件
const file = new File(['file content'], 'example.jpg', { type: 'image/jpeg' })
const result = await FileUploadUtil.uploadFile(
    file,
    UploadType.ACCOUNT_APPLICATION
)
console.log('上传结果:', result)

// 批量上传多个文件
const files = [
    new File(['file1 content'], 'example1.jpg', { type: 'image/jpeg' }),
    new File(['file2 content'], 'example2.pdf', { type: 'application/pdf' })
]
const results = await FileUploadUtil.uploadMultipleFiles(files)
console.log('批量上传结果:', results)
```

### 3.3 在React组件中使用FileUploader

```tsx
import FileUploader from '@/components/account-application/FileUploader'
import { UploadType, UploadResult } from '@/utils/file-upload'

function MyComponent() {
    const [files, setFiles] = useState<UploadResult[]>([])

    const handleFilesChange = (uploadedFiles: UploadResult[]) => {
        setFiles(uploadedFiles)
        // 可以将文件信息保存到表单数据中
    }

    return (
        <div>
            <FileUploader
                onChange={handleFilesChange}
                uploadType={UploadType.ACCOUNT_APPLICATION}
                maxFiles={3}
                acceptedFileTypes=".jpg,.jpeg,.png,.pdf"
                maxFileSize={5}
            />
        </div>
    )
}
```

## 4. 上传类型

文件上传支持以下预定义的上传类型，不同类型对应不同的存储路径：

- `UploadType.ACCOUNT_APPLICATION`: 账户申请相关文件
- `UploadType.RECHARGE`: 充值相关文件
- `UploadType.GENERAL`: 通用文件上传

## 5. 完整示例

我们提供了一个完整的示例页面，位于 `/app/demo/sso-upload/page.tsx`，您可以在浏览器中访问 `/demo/sso-upload` 查看完整的文件上传流程演示。

## 6. 注意事项

1. 首次使用文件上传功能时，需要先进行SSO认证
2. 默认文件大小限制为100MB
3. 上传路径会根据上传类型、用户ID和日期自动生成
4. 文件名会自动添加时间戳以避免重名
5. 上传失败会返回详细的错误信息

## 7. 错误处理

文件上传过程中可能出现的错误有：

- SSO Token获取失败
- SSO配置获取失败
- 文件类型不支持
- 文件大小超过限制
- 上传过程中网络错误

建议使用try-catch捕获这些错误，并给用户友好的提示。

## 8. 安全建议

1. 不要在客户端代码中硬编码SSO账号和密码
2. 考虑使用环境变量或服务端API来获取SSO认证信息
3. 对上传的文件进行类型和大小验证
4. 添加适当的访问控制，确保只有授权用户可以上传文件
