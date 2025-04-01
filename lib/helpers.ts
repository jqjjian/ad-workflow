import { MediaPlatform, Currency } from '@/schemas/enums'

export const getCurrencyByPlatform = (platform: MediaPlatform): Currency => {
    return platform === 'FACEBOOK' ? 'HKD' : 'USD'
}
