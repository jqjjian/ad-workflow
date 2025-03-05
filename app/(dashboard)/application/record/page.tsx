'use client'
import {
    Row,
    Col,
    Card,
    Space,
    Table,
    Tag,
    Form,
    DatePicker,
    Select,
    Input,
    Button,
    Typography,
    type TableProps
} from 'antd'
// import Title from 'antd/es/typography/Title'
const { RangePicker } = DatePicker
const { Title } = Typography
const { Item } = Form
export default function Page() {
    const [form] = Form.useForm()
    const onFinish = (values: any) => {
        console.log(values)
    }
    return (
        <>
            <Title level={3} className="m-0 p-0">
                开户记录
            </Title>
            <Space direction="vertical" size={24}>
                <Card>
                    <Form
                        layout="inline"
                        form={form}
                        onFinish={onFinish}
                        labelCol={{ span: 6 }}
                    >
                        <Row gutter={16}>
                            <Col span={6}>
                                <Item
                                    label="媒体平台"
                                    style={{
                                        marginRight: 16,
                                        marginBottom: 16
                                    }}
                                >
                                    <Select
                                        style={{ width: '100%' }}
                                        placeholder="请选择媒体平台"
                                        options={[
                                            { label: 'Meta', value: '1' },
                                            { label: 'Google', value: '2' },
                                            { label: 'TikTok', value: '3' }
                                        ]}
                                    />
                                </Item>
                            </Col>
                            <Col span={6}>
                                <Item
                                    label="开户状态"
                                    style={{
                                        marginRight: 16,
                                        marginBottom: 16
                                    }}
                                >
                                    <Select
                                        style={{ width: '100%' }}
                                        placeholder="请选择开户状态"
                                        options={[
                                            { label: '审核中', value: '1' },
                                            { label: '已通过', value: '2' },
                                            { label: '待修改', value: '3' },
                                            { label: '已驳回', value: '4' }
                                        ]}
                                    />
                                </Item>
                            </Col>
                            <Col span={6}>
                                <Item
                                    label="开户主体"
                                    style={{
                                        marginRight: 16,
                                        marginBottom: 16
                                    }}
                                >
                                    <Input />
                                </Item>
                            </Col>
                            <Col span={6}>
                                <Item
                                    label="开户时间"
                                    style={{
                                        marginRight: 16,
                                        marginBottom: 16
                                    }}
                                >
                                    <RangePicker />
                                </Item>
                            </Col>
                            <Col span={6}>
                                <Item
                                    label="申请ID"
                                    style={{
                                        marginRight: 16,
                                        marginBottom: 16
                                    }}
                                >
                                    <Input />
                                </Item>
                            </Col>
                            <Col span={6}>
                                <Item
                                    label="OE ID"
                                    style={{
                                        marginRight: 16,
                                        marginBottom: 16
                                    }}
                                >
                                    <Input />
                                </Item>
                            </Col>
                            <Col span={6}>
                                <Item
                                    label="推广链接"
                                    style={{
                                        marginRight: 16,
                                        marginBottom: 16
                                    }}
                                >
                                    <Select
                                        style={{ width: '100%' }}
                                        placeholder="推广链接"
                                        options={[
                                            {
                                                label: 'https://wwww.baidu.com',
                                                value: '1'
                                            },
                                            {
                                                label: 'https://wwww.baidu.com',
                                                value: '2'
                                            },
                                            {
                                                label: 'https://wwww.baidu.com',
                                                value: '3'
                                            },
                                            {
                                                label: 'https://wwww.baidu.com',
                                                value: '4'
                                            }
                                        ]}
                                    />
                                </Item>
                            </Col>
                            <Col span={6}>
                                <Item>
                                    <Button type="primary">搜索</Button>
                                </Item>
                            </Col>
                        </Row>
                    </Form>
                </Card>
            </Space>
        </>
    )
}
