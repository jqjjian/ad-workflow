import { redirect } from 'next/navigation';

export default function HomePage() {
    // 服务器端重定向
    redirect('/login');

    // 这部分代码在重定向后不会执行
    return null;
} 