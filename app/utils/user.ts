/**
 * 用户相关工具函数
 */

/**
 * 从工单信息中提取用户信息
 * 按照优先级依次从不同位置查找用户信息
 * @param record 工单记录对象
 * @returns 用户信息字符串
 */
export const findUserInfo = (record: any): string => {
    // 常见的用户信息字段
    const possibleFields = [
        'createdBy',
        'userId',
        'creator',
        'creatorName',
        'creatorId',
        'userName',
        'applicant',
        'submittedBy',
        'createUser',
        'createUserId',
        'createUserName'
    ]

    // 尝试从record直接获取
    for (const field of possibleFields) {
        if (record[field] && typeof record[field] === 'string') {
            return record[field]
        }
    }

    // 尝试从user对象中获取
    if (record.user) {
        const user = record.user
        if (typeof user === 'string') return user
        if (user.name) return user.name
        if (user.id) return user.id
        if (user.userName) return user.userName
    }

    // 尝试从嵌套属性中查找
    for (const key in record) {
        if (typeof record[key] === 'object' && record[key] !== null) {
            for (const field of possibleFields) {
                if (
                    record[key][field] &&
                    typeof record[key][field] === 'string'
                ) {
                    return record[key][field]
                }
            }
        }
    }

    // 从metadata中查找
    if (record.metadata) {
        let metadata
        try {
            metadata =
                typeof record.metadata === 'string'
                    ? JSON.parse(record.metadata)
                    : record.metadata

            for (const field of possibleFields) {
                if (metadata[field] && typeof metadata[field] === 'string') {
                    return metadata[field]
                }
            }
        } catch (error) {
            console.error('解析metadata失败', error)
        }
    }

    return '-'
}
