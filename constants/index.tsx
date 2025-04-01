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
        label: '广告账户',
        icon: <UserOutlined />,
        children: [
            {
                key: 'manage',
                label: '账户管理'
            },
            {
                key: 'record',
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
        children: [
            {
                key: 'workorders',
                label: '工单管理',
                icon: <FileOutlined />
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
