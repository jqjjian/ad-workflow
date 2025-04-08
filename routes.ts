/**
 * 一个公开访问的路由数组
 * 这些路由不需要授权
 * @type {string[]}
 */
export const publicRoutes = [
    '/auth/new-verification',
    '/auth/error',
    '/error/redirect-loop'
]

/**
 * 一个用于授权的路由数组
 * 这些数组在登录授权后重定向到/dashboard
 * @type {string[]}
 */
export const authRoutes = ['/login', '/register', '/auth/reset-password'] // App Router模式下，根路径无页面访问

/**
 * 一个用于授权的API前缀路由数组
 * 这些API路由用于身份验证
 * @type {string}
 */
export const apiAuthPrefix = '/api/auth'

/**
 * 用户登录后默认重定向的路由
 * @type {string}
 */
export const DEFAULT_LOGIN_REDIRECT = '/application/apply'

/**
 * 一个只有管理员身份才能访问的跌幅数组
 * 这些数组非admin角色无法访问
 */
export const adminRoutes = ['/system', '/admin', '/analytics']

console.log('当前adminRoutes配置:', adminRoutes)
