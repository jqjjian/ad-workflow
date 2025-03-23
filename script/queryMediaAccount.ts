import { callExternalApi, API_BASE_URL } from '@/lib/request'
interface MediaAccount {
    id: string
    name: string
    type: string
    status: string
    // Add other fields based on actual API response
}
const accessToken = process.env.ACCESS_TOKEN_SECRET_TEST
export const queryMediaAccount = async (): Promise<MediaAccount[]> => {
    const response = await callExternalApi<MediaAccount[]>({
        url: `${API_BASE_URL}/openApi/v1/mediaAccount/query`,
        headers: {
            'Content-Type': 'application/json;charset=UTF-8',
            'Access-Token': 'ad776656d49f4adb840ef6187115fb8b'
        },
        body: {
            pageNumber: 1,
            pageSize: 10
        }
    })
    console.log('response', JSON.stringify(response.data))
    // if (!response.success) {
    //     throw new Error(
    //         `Failed to query media accounts: ${response.message || response.code}`
    //     )
    // }

    return response.data || []
}

queryMediaAccount()
