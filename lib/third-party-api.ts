// import { callExternalApi } from '@/lib/request'
// import {
//     MediaAccountsearch,
//     MediaAccountResponseType,
//     MediaAccountResponseSchema,
//     ApiResponse,
//     RechargeCreateSchema,
//     RechargeCreateType
// } from '@/schemas/third-party-type'
// const openApiUrl =
//     process.env.NODE_ENV === 'production'
//         ? process.env.OPEN_API_URL
//         : process.env.OPEN_API_URL_TEST
// // 查询广告账号列表
// export const mediaAccountQueryApi = async (
//     params: MediaAccountsearch
// ): Promise<ApiResponse<MediaAccountResponseType>> => {
//     const validatedParams = MediaAccountResponseSchema.parse(params)
//     if (!validatedParams) {
//         return {
//             code: '400',
//             success: false,
//             message: '查询参数验证失败',
//             data: null
//         }
//     }
//     const url = `${openApiUrl}/openApi/v1/mediaAccount/query`
//     const response = await callExternalApi<MediaAccountResponseType>({
//         url,
//         body: params
//     })
//     console.log('response', response)
//     return response
// }

// // 创建充值任务
// export const rechargeCreateApi = async (
//     params: RechargeCreateType
// ): Promise<ApiResponse<{ taskId: string }>> => {
//     const validatedParams = RechargeCreateSchema.parse(params)
//     if (!validatedParams) {
//         return {
//             code: '400',
//             success: false,
//             message: '充值参数验证失败',
//             data: null
//         }
//     }
//     const url = `${openApiUrl}/openApi/v1/mediaAccount/rechargeApplication/create`
//     return await callExternalApi<{ taskId: string }>({
//         url,
//         body: params
//     })
// }
