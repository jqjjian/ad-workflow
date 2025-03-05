import { message } from 'antd'
import { useCallback } from 'react'

function useMessage() {
    const showMessage = useCallback(
        (
            type: 'success' | 'error' | 'info' | 'warning',
            content: string,
            duration: number = 3
        ) => {
            switch (type) {
                case 'success':
                    message.success(content, duration)
                    break
                case 'error':
                    message.error(content, duration)
                    break
                case 'info':
                    message.info(content, duration)
                    break
                case 'warning':
                    message.warning(content, duration)
                    break
                default:
                    message.info(content, duration)
            }
        },
        []
    )

    return { showMessage }
}

export default useMessage
