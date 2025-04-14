import {
    HomeOutlined,
    UserAddOutlined,
    UserOutlined,
    FileOutlined,
    TeamOutlined
    // LaptopOutlined,
    // NotificationOutlined
} from '@ant-design/icons'

// 定义菜单项类型，包含isAdmin属性
export interface MenuItem {
    key: string;
    label: string;
    icon?: React.ReactNode;
    children?: MenuItem[];
    isAdmin?: boolean; // 标记是否需要管理员权限
}

export const menuItems: MenuItem[] = [
    // {
    //     key: 'dashboard',
    //     label: '概览',
    //     icon: <HomeOutlined />
    // },
    {
        key: 'application',
        label: '开户管理',
        icon: <UserAddOutlined />,
        children: [
            {
                key: 'apply',
                label: '开户申请'
            },
            {
                key: 'application-record',
                label: '开户记录'
            }
        ]
    },
    {
        key: 'account',
        label: '广告账户',
        icon: <UserOutlined />,
        children: [
            {
                key: 'manage',
                label: '账户管理'
            },
            {
                key: 'account-record',
                label: '申请记录'
            }
            // {
            //     key: 'recharge',
            //     label: '充值管理'
            // },
            // {
            //     key: 'balance',
            //     label: '余额管理'
            // }
        ]
    },
    {
        key: 'admin',
        label: '管理',
        icon: <UserOutlined />,
        isAdmin: true, // 标记为管理员菜单
        children: [
            {
                key: 'workorders',
                label: '工单管理',
                icon: <FileOutlined />
            },
            {
                key: 'users',
                label: '账户管理',
                icon: <TeamOutlined />,
                isAdmin: true // 只有超级管理员可见
            }
        ]
    },

    // {
    //     key: 'system',
    //     label: '系统设置',
    //     icon: <FileOutlined />,
    //     children: [
    //         {
    //             key: 'dictionary-manage',
    //             label: '字典管理'
    //         }
    //     ]
    // }
]
