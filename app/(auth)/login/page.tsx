import { Metadata } from 'next'
import SignInViewPage from '@/app/(auth)/_components/sigin-view'
export const metadata: Metadata = {
    title: 'Ad-Workflow | Sign In',
    description: 'Sign In page for Ad-Workflow.'
}
export const dynamic = 'force-dynamic'

export default function Page() {
    return <SignInViewPage />
}
