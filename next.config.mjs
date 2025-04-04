/** @type {import('next').NextConfig} */
const nextConfig = {
    output: 'standalone',
    transpilePackages: ['antd', '@ant-design/icons', 'rc-*'],

    // 移除 serverComponentsExternalPackages 中的 antd 相关配置
    experimental: {
        // 只保留必要的外部化包（如数据库驱动等）
        serverComponentsExternalPackages: ['sharp'],
        // 添加 RSC 编译缓存配置（提升构建速度）
        incrementalPackageCache: true,
        // 禁用 barrel optimizations
        optimizePackageImports: []
    },

    // 添加打包优化配置
    productionBrowserSourceMaps: true,
    optimizeFonts: true,

    // 确保环境变量在构建时被正确处理
    env: {
        OPEN_API_URL: process.env.OPEN_API_URL || 'https://test-ua-gw.tec-develop.cn/uni-agency',
        OPEN_API_URL_TEST: process.env.OPEN_API_URL_TEST || 'https://test-ua-gw.tec-develop.cn/uni-agency',
        ACCESS_TOKEN_SECRET: process.env.ACCESS_TOKEN_SECRET || 'ad776656d49f4adb840ef6187115fb8b',
        ACCESS_TOKEN_SECRET_TEST: process.env.ACCESS_TOKEN_SECRET_TEST || 'ad776656d49f4adb840ef6187115fb8b'
    }
};

export default nextConfig;
