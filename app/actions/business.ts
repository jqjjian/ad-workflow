'use server'
import { z } from 'zod'
import {
    GoogleAccount,
    TiktokBusiness,
    TiktokBusinessSchema,
    GoogleAccountSchema
} from '@/schemas'
import { callExternalApi } from '@/lib/request'
import { Logger } from '@/lib/logger'
// google平台开户申请
const googleUrl = '/openApi/v1/mediaAccountApplication/google/create'
const openApiUrl =
    process.env.NODE_ENV === 'production'
        ? process.env.OPEN_API_URL
        : process.env.OPEN_API_URL_TEST
// const accessToken =
//     process.env.NODE_ENV === 'production'
//         ? process.env.ACCESS_TOKEN_SECRET
//         : process.env.ACCESS_TOKEN_SECRET_TEST
export async function googleApply(data: GoogleAccount, userId: string) {
    const validatedData = GoogleAccountSchema.parse(data)
    if (!validatedData) {
        throw new Error('Google 开户申请数据验证失败')
    }
    try {
        Logger.info({ message: '开始处理 Google 开户申请', data, userId })

        const url = `${openApiUrl}${googleUrl}`
        const response = await callExternalApi({
            url,
            // headers: {
            //     'Content-Type': 'application/json',
            //     'Access-Token': accessToken || ''
            // },
            body: {
                // taskNumber: '33395894177064',
                mediaAccountInfos: [
                    {
                        ...data
                    }
                ]
            }
        })
        console.log('response', response)
        return response
        // if (response.code === '0') {
        //     console.log('response', response)
        //     Logger.info({ message: 'Google 开户申请处理完成', response })
        //     return response
        // } else {
        //     console.log('Google 开户申请处理失败')
        //     console.log('response', response)
        //     // Logger.error(new Error(response.message))
        //     throw new Error(response.message)
        // }
    } catch (error) {
        Logger.error(new Error('Google 开户申请处理失败'))
        Logger.error(new Error(error as string))
        throw error
    }
}
const tiktokUrl = '/openApi/v1/mediaAccountApplication/tiktok/create'

export async function tiktokApply(data: TiktokBusiness, userId: string) {
    const validatedData = TiktokBusinessSchema.parse(data)
    if (!validatedData) {
        throw new Error('Tiktok 开户申请数据验证失败')
    }
    try {
        Logger.info({ message: '开始处理 Tiktok 开户申请', data, userId })
        const url = `${openApiUrl}${tiktokUrl}`
        const response = await callExternalApi({
            url,
            body: {
                ...data
            }
        })
        console.log('response', response)
        return response
    } catch (error) {
        Logger.error(new Error('Tiktok 开户申请处理失败'))
        Logger.error(new Error(error as string))
        throw error
    }
}
