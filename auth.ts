import NextAuth from 'next-auth'
import authConfig from '@/auth.config'

export const { auth, handlers, signOut, signIn } = NextAuth({
    ...authConfig,
    trustHost: true,
    debug: process.env.NODE_ENV === 'development',
    events: {
        ...authConfig.events,
        signOut: async (message) => {
            console.log('用户登出事件触发', message)
            // 后端记录用户退出登录
            try {
                // 可以在这里添加记录用户退出的逻辑
                // 例如更新数据库中的lastLogout时间等
                console.log('用户已安全登出系统')
            } catch (error) {
                console.error('记录用户登出失败:', error)
            }
        }
    },
    // 添加自定义配置
    callbacks: {
        ...authConfig.callbacks,
        // 确保重定向回调安全可靠
        redirect({ url, baseUrl }) {
            console.log('退出登录重定向:', { url, baseUrl })

            // 安全域名检查 - 确保只重定向到可信域名
            const trustedDomains = ['myad.shopwis.cn', 'localhost', '127.0.0.1', 'localhost:3000'];

            try {
                // 解析URL获取主机名
                const hostname = new URL(url.startsWith('http') ? url : `${baseUrl}${url.startsWith('/') ? url : `/${url}`}`).hostname;

                // 检查是否是可信域名
                const isTrustedDomain = trustedDomains.some(domain =>
                    hostname === domain || hostname.endsWith(`.${domain}`)
                );

                // 如果不是可信域名，返回基础URL
                if (!isTrustedDomain) {
                    console.log(`不可信的重定向域名: ${hostname}, 使用默认首页`);
                    return baseUrl;
                }
            } catch (error) {
                console.error('URL解析错误，使用默认重定向:', error);
                return baseUrl;
            }

            // 确保相对路径始终转为绝对路径
            if (url.startsWith('/')) {
                return `${baseUrl}${url}`
            }

            // 简单判断URL是否合法
            if (url.startsWith('http')) {
                return url
            }

            // 默认返回基础URL
            return baseUrl
        }
    }
})
