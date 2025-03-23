import { db } from '@/lib/db'

export const getUserbyEmail = async (email: string) => {
    try {
        const user = await db.tecdo_users.findUnique({
            where: {
                email
            }
        })
        return user
    } catch (error) {
        return null
    }
}

export const getUserbyUsername = async (username: string) => {
    try {
        const user = await db.tecdo_users.findUnique({
            where: {
                username
            }
        })
        return user
    } catch (error) {
        return null
    }
}

export const getUserbyId = async (id: string) => {
    try {
        const user = await db.tecdo_users.findUnique({
            where: {
                id
            }
        })
        return user
    } catch (error) {
        return null
    }
}

// export const getApiKeysbyUserId = async (id: string) => {
//     try {
//         const userWithApiKeys = await db.user.findUnique({
//             where: {
//                 id
//             },
//             include: {
//                 apiKeys: true
//             }
//         })
//         if (userWithApiKeys) {
//             return userWithApiKeys.apiKeys
//         } else {
//             return null
//         }
//     } catch (error) {
//         return null
//     }
// }
