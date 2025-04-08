import { Metadata } from 'next'
import ForgotPasswordView from '@/app/(auth)/_components/forgot-password-view'

export const metadata: Metadata = {
    title: 'Ad-Workflow | 忘记密码',
    description: '忘记密码页面'
}

export default function ForgotPasswordPage() {
    return <ForgotPasswordView />
} 