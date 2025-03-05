import {
    HomeOutlined,
    UserAddOutlined,
    UserOutlined,
    FileOutlined
    // LaptopOutlined,
    // NotificationOutlined
} from '@ant-design/icons'
export const menuItems = [
    {
        key: 'dashboard',
        label: '概览',
        icon: <HomeOutlined />
    },
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
                key: 'record',
                label: '开户记录'
            }
        ]
    },
    {
        key: 'account',
        label: '开户管理',
        icon: <UserOutlined />,
        children: [
            {
                key: 'manage',
                label: '账户管理'
            },
            {
                key: 'recharge',
                label: '账户充值'
            }
        ]
    },
    {
        key: 'system',
        label: '系统设置',
        icon: <FileOutlined />,
        children: [
            {
                key: 'dictionary-manage',
                label: '字典管理'
            }
        ]
    }
]
