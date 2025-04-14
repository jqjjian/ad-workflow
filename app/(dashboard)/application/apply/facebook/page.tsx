'use client'
import { useState, useEffect, useTransition } from 'react'
import {
    Card,
    Row,
    Col,
    Button,
    Space,
    Flex,
    Select,
    Typography,
    Breadcrumb,
    Form,
    Input,
    Upload,
    type FormProps,
    UploadFile,
    ConfigProvider,
    Modal
} from 'antd'
import { InfoCircleOutlined, UploadOutlined } from '@ant-design/icons'
import { StyleProvider } from '@ant-design/cssinjs'
import {
    getDictionaryItems,
    getTimezoneDictionary
} from '@/app/actions/dictionary'
import { createSchemaFieldRule } from 'antd-zod'
// import { GoogleAccountSchema, GoogleAccount, ApplyRecordData } from '@/schemas'
// import { WorkOrderCompanyInfoSchema } from '@/schemas/company-info'
import {
    FacebookAccountApplication,
    FacebookAccountApplicationSchema,
    AuthRoleEnum,
    // ApplicationCompanyInfo,
    ProductTypeEnum
} from '@/schemas/facebook-account'
import {
    facebookApply,
    updateFacebookApply,
    getFacebookApplyRecord
} from '@/app/actions/workorder/facebook-account-application'
import { bindExternalTaskIdToWorkOrder } from '@/app/actions/workorder/account-application'
// import { updateGoogleApply, getApplyRecord } from '@/app/actions/business'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { message } from 'antd'
// import Image from 'next/image'
import {
    // FieldTimeOutlined,
    PlusOutlined,
    DeleteOutlined
} from '@ant-design/icons'
import { useSearchParams, useRouter } from 'next/navigation'
import { type Rule } from 'antd/es/form'
import { Session } from 'next-auth'
import { SSOService } from '@/lib/sso-service'
import { FileUploadUtil, UploadType } from '@/utils/file-upload'
const { Text, Title } = Typography
const { Item: FormItem, List } = Form
// const url = 'https://test-ua-gw.tec-develop.cn/uni-agency'
// const token = 'ad776656d49f4adb840ef6187115fb8b'

// 定义返回数据的类型
// interface MediaAccountApplication {
//     taskId: string
//     taskNumber: string
//     mediaAccountInfo: {
//         productType: number
//         currencyCode: string
//         timezone: string
//         rechargeAmount: string
//         promotionLinks: string[]
//         name: string
//         auths: Array<{ value: string; role: number }>
//     }
// }

export default function Page() {
    const { data: session, status } = useSession()
    const router = useRouter()
    const userId = session?.user?.id
    // console.log('userId', userId)
    const [productTypeList, setProductTypeList] = useState<
        { label: string; value: number }[]
    >([])
    const [timezoneOptions, setTimezoneOptions] = useState<
        { label: string; value: string }[]
    >([
        { label: '(GMT+8:00) 北京时间', value: 'Asia/Shanghai' },
        { label: '(GMT+0:00) 伦敦', value: 'Europe/London' },
        { label: '(GMT-5:00) 纽约', value: 'America/New_York' }
    ])
    const [facebookAccount, setFacebookAccount] =
        useState<FacebookAccountApplication>({
            productType: undefined,
            currencyCode: '',
            timezone: '',
            promotionLinks: [''],
            name: '',
            rechargeAmount: '',
            auths: [null],
            businessLicenseNo: '',
            businessLicenseAttachment: [],
            companyNameEN: '',
            registrationDetails: {
                companyName: '',
                legalRepName: '',
                idType: undefined,
                idNumber: '',
                legalRepPhone: '',
                legalRepBankCard: ''
            }
        })
    const searchParams = useSearchParams()
    const taskId = searchParams.get('taskId')
    const isCopy = searchParams.get('copy') === 'true'
    const isEdit = !!taskId && !isCopy
    const [loading, setLoading] = useState(false)
    const requiredRule = { required: true }
    const rule = createSchemaFieldRule(FacebookAccountApplicationSchema)
    const [locationId, setLocationId] = useState(1)
    const [accountId, setAccountId] = useState('')
    const [fileList, setFileList] = useState<UploadFile[]>([])
    const [addressData, setAddressData] = useState<any>(null)
    const [authEmailList, setAuthEmailList] = useState<string[]>([])
    const [authRoleList, setAuthRoleList] = useState<{ label: string; value: number }[]>([])
    const [promotionLinks, setPromotionLinks] = useState<string[]>([])
    const [redirectToMyAccount, setRedirectToMyAccount] = useState(false)
    const [initialData, setInitialData] = useState<any>(null)
    const [showRedirectButton, setShowRedirectButton] = useState(false)
    const [workOrderId, setWorkOrderId] = useState('')
    const [idTypeOptions, setIdTypeOptions] = useState<{ label: string; value: number }[]>([
        { label: '身份证', value: 1 },
        { label: '护照', value: 2 }
    ])
    // const authRule = createSchemaFieldRule(AuthItemSchema)

    // 邮箱验证规则
    const emailValidateRule = (field: any): Rule[] => [
        {
            validator: async (_: any, value: string) => {
                const role = form.getFieldValue(['auths', field.name, 'role'])

                // 如果权限有值，且正在输入邮箱，触发权限字段的重新验证
                if (role && value) {
                    form.validateFields([['auths', field.name, 'role']])
                }

                // 如果邮箱有值，验证格式
                if (
                    value &&
                    !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(
                        value
                    )
                ) {
                    return Promise.reject('请输入正确的邮箱格式')
                }

                // 如果只有邮箱有值，没有权限
                if (value && !role) {
                    return Promise.reject('授权邮箱和权限必须同时填写')
                }

                return Promise.resolve()
            }
        }
    ]

    // 权限验证规则
    const roleValidateRule = (field: any): Rule[] => [
        {
            validator: async (_: any, value: number) => {
                const email = form.getFieldValue(['auths', field.name, 'value'])

                // 如果只有权限有值，没有邮箱
                if (value && !email) {
                    return Promise.reject('授权邮箱和权限必须同时填写')
                }

                return Promise.resolve()
            }
        }
    ]

    // 添加自定义上传组件
    const customUpload = async (options: any) => {
        const { file, onSuccess, onError, onProgress } = options;

        try {
            onProgress({ percent: 10 });

            // 不再检查全局初始化状态，在每次上传时创建新的SSOService实例
            console.log('开始上传文件:', file.name);
            onProgress({ percent: 20 });

            // 1. 创建SSO服务实例
            const ssoService = new SSOService();

            // 2. 获取token
            try {
                await ssoService.getToken('13268125705', 'aa123456');
                console.log('获取SSO Token成功');
                onProgress({ percent: 30 });
            } catch (tokenError) {
                console.error('获取Token失败:', tokenError);
                message.error('获取授权失败，请稍后重试');
                onError();
                return;
            }

            // 3. 获取SSO配置
            try {
                await ssoService.getSSOConfig();
                console.log('获取SSO配置成功');
                onProgress({ percent: 50 });
            } catch (configError) {
                console.error('获取SSO配置失败:', configError);
                message.error('获取配置失败，请稍后重试');
                onError();
                return;
            }

            // 4. 上传文件
            let result;
            try {
                // 构建上传路径
                const userId = 'user_' + Math.floor(Math.random() * 1000000);
                const date = new Date().toISOString().split('T')[0];
                const directory = `account-application/${userId}/${date}`;

                // 执行上传
                result = await ssoService.uploadFile(file, directory);
                console.log('文件上传成功:', result);
                onProgress({ percent: 100 });
            } catch (uploadError) {
                console.error('文件上传失败:', uploadError);
                message.error('文件上传失败，请稍后重试');
                onError();
                return;
            }

            // 5. 返回上传结果
            if (result) {
                onSuccess({
                    url: result.fileUrl,
                    name: result.fileName,
                    response: {
                        url: result.fileUrl,
                        name: result.fileName
                    }
                });

                message.success('文件上传成功');
            } else {
                message.error('文件上传失败，未获取到结果');
                onError();
            }
        } catch (error) {
            console.error('文件上传过程中发生错误:', error);
            message.error('文件上传失败: ' + (error instanceof Error ? error.message : '未知错误'));
            onError();
        }
    };

    // 推广链接验证规则
    const urlValidateRule = (): Rule[] => [
        {
            required: true,
            message: '推广链接不能为空'
        },
        {
            validator: async (_, value) => {
                if (!value) {
                    return Promise.reject('推广链接不能为空')
                }

                // 如果URL不包含协议前缀，添加https://
                if (value && !value.match(/^https?:\/\//)) {
                    // 找到当前字段在form中的路径
                    const fieldPath = form.getFieldsValue()
                    const promotionLinks = [
                        ...(form.getFieldValue('promotionLinks') || [''])
                    ]

                    // 找到当前值在数组中的索引
                    const index = promotionLinks.findIndex(
                        (link) => link === value
                    )
                    if (index !== -1) {
                        // 修改值，添加https://前缀
                        promotionLinks[index] = `https://${value}`
                        // 更新表单值
                        form.setFieldValue('promotionLinks', promotionLinks)
                    }
                }

                return Promise.resolve()
            }
        }
    ]

    const getDicData = async () => {
        try {
            // 获取产品类型字典
            const productTypeRes = await getDictionaryItems(
                'BUSINESS',
                'PRODUCT_TYPE'
            )
            if (productTypeRes?.items && productTypeRes.items.length > 0) {
                const list = productTypeRes.items.map((item) => ({
                    label: item.itemName,
                    value: Number(item.itemValue)
                }))
                setProductTypeList(list)
            } else {
                // 在字典中缺失产品类型时使用默认值
                setProductTypeList([
                    { label: '游戏', value: ProductTypeEnum.GAME },
                    { label: 'App', value: ProductTypeEnum.APP },
                    { label: '电商', value: ProductTypeEnum.ECOMMERCE },
                    { label: '其他', value: ProductTypeEnum.OTHER }
                ])
            }

            // 获取时区字典 - 目前只支持GOOGLE和TIKTOK类型
            const timezoneRes = await getTimezoneDictionary('GOOGLE')
            if (timezoneRes && timezoneRes.length > 0) {
                setTimezoneOptions(timezoneRes)
            }

            // 获取授权角色字典
            try {
                const authRolesRes = await getDictionaryItems(
                    'BUSINESS',
                    'AUTH_ROLE'
                )
                if (authRolesRes?.items && authRolesRes.items.length > 0) {
                    const roleOptions = authRolesRes.items.map((item) => ({
                        label: item.itemName,
                        value: Number(item.itemValue)
                    }))
                    setAuthRoleList(roleOptions)
                } else {
                    // 设置默认的角色选项
                    setAuthRoleList([
                        { label: '标准授权', value: AuthRoleEnum.STANDARD },
                        { label: '管理员授权', value: AuthRoleEnum.ADMIN },
                        { label: '只读授权', value: AuthRoleEnum.READONLY }
                    ])
                }
            } catch (error) {
                console.error('获取授权角色字典失败:', error)
                // 设置默认的角色选项
                setAuthRoleList([
                    { label: '标准授权', value: AuthRoleEnum.STANDARD },
                    { label: '管理员授权', value: AuthRoleEnum.ADMIN },
                    { label: '只读授权', value: AuthRoleEnum.READONLY }
                ])
            }

            // 获取证件类型字典
            try {
                const idTypeRes = await getDictionaryItems(
                    'BUSINESS',
                    'ID_TYPE'
                )
                if (idTypeRes?.items && idTypeRes.items.length > 0) {
                    const idTypeList = idTypeRes.items.map((item) => ({
                        label: item.itemName,
                        value: Number(item.itemValue)
                    }))
                    setIdTypeOptions(idTypeList)
                }
            } catch (error) {
                console.error('获取证件类型字典失败:', error)
            }
        } catch (error) {
            console.error('获取字典数据失败:', error)
            message.error('获取字典数据失败')
        }
    }
    const [isPending, startTransition] = useTransition()
    const [form] = Form.useForm()
    const handleSubmit = async (values: any) => {
        // 简单的手动验证
        const requiredFields = [
            { key: 'name', msg: '账户名称不能为空' },
            { key: 'currencyCode', msg: '币种不能为空' },
            { key: 'timezone', msg: '时区不能为空' },
            {
                key: 'registrationDetails.companyName',
                msg: '公司中文名称不能为空'
            },
            { key: 'companyNameEN', msg: '公司英文名称不能为空' },
            {
                key: 'businessLicenseNo',
                msg: '营业执照统一社会信用代码不能为空'
            }
        ]

        // 检查必填字段
        for (const field of requiredFields) {
            let value
            if (field.key.includes('.')) {
                const [obj, prop] = field.key.split('.')
                value = values[obj] && values[obj][prop]
            } else {
                value = values[field.key]
            }

            if (!value) {
                message.error(field.msg)
                return // 验证失败，直接返回
            }
        }

        // 特殊检查附件
        if (
            !values.businessLicenseAttachment ||
            !Array.isArray(values.businessLicenseAttachment) ||
            values.businessLicenseAttachment.length === 0
        ) {
            // 检查fileList是否有值
            if (fileList && fileList.length > 0) {
                values.businessLicenseAttachment = fileList
            } else {
                message.error('请上传营业执照')
                return
            }
        }

        // 验证通过，继续处理提交...
        console.log('提交的表单值:', JSON.stringify(values, null, 2))

        // 确保所有必要值都存在
        if (!values || !userId) {
            message.error('表单数据不完整')
            return
        }

        try {
            // 开始显示加载状态
            setLoading(true)

            // 在提交前手动触发验证
            try {
                await form.validateFields()
                console.log('表单验证通过，开始处理提交:', values)
            } catch (validationError: any) {
                console.error('表单验证失败:', validationError)

                // 检查是否有错误字段信息
                if (validationError?.errorFields?.length > 0) {
                    // 显示第一个错误消息
                    const firstError = validationError.errorFields[0]
                    message.error(`表单验证失败: ${firstError.errors[0]}`)
                    console.log('错误字段详情:', validationError.errorFields)
                } else {
                    // 如果没有具体错误信息，再次尝试手动验证
                    console.log('没有错误字段信息，再次执行手动验证')
                    validateFormManually() // 只是为了显示错误信息
                    message.error('表单验证失败，请检查所有必填项')
                }

                setLoading(false)
                return
            }

            // 再次检查关键字段 - 双重保障
            if (!values.name) {
                console.error('账户名称不能为空')
                message.error('账户名称不能为空')
                setLoading(false)
                return
            }

            if (!values.currencyCode) {
                console.error('币种不能为空')
                message.error('币种不能为空')
                setLoading(false)
                return
            }

            if (!values.timezone) {
                console.error('时区不能为空')
                message.error('时区不能为空')
                setLoading(false)
                return
            }

            // 检查公司名称
            if (!values.registrationDetails?.companyName) {
                console.error('公司中文名称不能为空')
                message.error('公司中文名称不能为空')
                setLoading(false)
                return
            }

            // 获取用户ID
            const userId = session?.user?.id
            if (!userId) {
                message.error('用户未登录')
                setLoading(false)
                return
            }

            // 构建要提交的数据
            const formData: any = {
                // 账户基本信息
                productType:
                    values.productType !== undefined
                        ? Number(values.productType)
                        : 0,
                currencyCode: values.currencyCode || 'USD',
                timezone: values.timezone || 'Asia/Shanghai',
                promotionLinks: Array.isArray(values.promotionLinks)
                    ? values.promotionLinks.filter((link: string) => !!link) // 过滤掉空链接
                    : [values.promotionLinks].filter(Boolean),
                name: values.name,
                rechargeAmount: values.rechargeAmount || '',

                // 授权信息 - 过滤掉空值
                auths: Array.isArray(values.auths)
                    ? values.auths
                        .filter(
                            (auth: any) =>
                                auth !== null && (auth.role || auth.value)
                        )
                        .map((auth: any) => ({
                            role: Number(auth?.role) || 1,
                            value: auth?.value || ''
                        }))
                    : []
            }

            // 如果文件已上传，准备公司信息和附件数据
            if (fileList && fileList.length > 0) {
                try {
                    // 准备附件数据
                    const attachmentRecords = fileList.map(file => {
                        // 从上传结果中提取关键字段
                        const ssoResponse = file.response || {};
                        const fileName = ssoResponse.name || file.name || '';
                        const fileUrl = ssoResponse.url || file.url || '';
                        const fileSize = file.size || 0;
                        const fileType = file.type || '';

                        return {
                            fileName,
                            fileType,
                            fileSize,
                            filePath: `licenses/${fileName}`,
                            ossObjectKey: fileName,
                            fileUrl,
                            description: '营业执照'
                        };
                    });

                    // 设置公司信息，包含附件信息，但不再创建数据库记录
                    formData.companyInfo = {
                        companyNameCN: values.registrationDetails.companyName || '',
                        companyNameEN: values.companyNameEN || '',
                        businessLicenseNo: values.businessLicenseNo || '',
                        location: locationId,

                        // 仅当位置ID为1（中国大陆）时才填充这些字段
                        ...(locationId === 1
                            ? {
                                legalRepName: values.registrationDetails?.legalRepName || '',
                                idType: Number(values.registrationDetails?.idType) || 1,
                                idNumber: values.registrationDetails?.idNumber || '',
                                legalRepPhone: values.registrationDetails?.legalRepPhone || '',
                                legalRepBankCard: values.registrationDetails?.legalRepBankCard || ''
                            }
                            : {}),

                        // 设置附件信息
                        attachments: attachmentRecords
                    };
                } catch (error) {
                    console.error('准备附件数据失败:', error);
                    message.error('准备附件数据失败，请稍后重试');
                    setLoading(false);
                    return;
                }
            } else {
                // 没有文件上传，只设置基本公司信息
                formData.companyInfo = {
                    companyNameCN: values.registrationDetails?.companyName || '',
                    companyNameEN: values.companyNameEN || '',
                    businessLicenseNo: values.businessLicenseNo || '',
                    location: locationId,

                    // 仅当位置ID为1（中国大陆）时才填充这些字段
                    ...(locationId === 1
                        ? {
                            legalRepName: values.registrationDetails?.legalRepName || '',
                            idType: Number(values.registrationDetails?.idType) || 1,
                            idNumber: values.registrationDetails?.idNumber || '',
                            legalRepPhone: values.registrationDetails?.legalRepPhone || '',
                            legalRepBankCard: values.registrationDetails?.legalRepBankCard || ''
                        }
                        : {})
                };
            }

            // 确保公司名称被正确设置
            if (
                !formData.companyInfo.companyNameCN &&
                values.registrationDetails?.companyName
            ) {
                formData.companyInfo.companyNameCN =
                    values.registrationDetails.companyName
                console.log(
                    '从registrationDetails.companyName设置了companyNameCN:',
                    formData.companyInfo.companyNameCN
                )
            }

            // 如果是编辑模式，添加taskId
            if (isEdit && taskId) {
                formData.taskId = taskId
            }

            console.log('最终提交的数据:', formData)

            // 根据模式调用不同的API
            let res
            if (isEdit) {
                res = await updateFacebookApply(formData, userId, taskId)
            } else {
                res = await facebookApply(formData, userId)
            }

            console.log('API返回结果:', res)

            if (res.success) {
                message.success(isEdit ? '修改成功' : '提交成功')
                setShowRedirectButton(true)

                // 如果是编辑模式，跳转到列表页
                if (isEdit) {
                    setTimeout(() => {
                        router.push('/application/record')
                    }, 1500)
                } else {
                    // 保存返回的工单ID
                    if (res.data && res.data.workOrderId) {
                        setWorkOrderId(res.data.workOrderId)
                    }

                    // 显示成功弹窗，并提供跳转链接
                    Modal.success({
                        title: '申请已提交成功',
                        content: (
                            <div>
                                <p>请点击下方按钮完成Facebook开户的剩余申请流程</p>
                                <p>系统将跳转到Facebook官方申请页面</p>
                            </div>
                        ),
                        okText: '前往Facebook继续申请',
                        onOk: () => {
                            // 跳转到Facebook开户申请链接
                            window.open('https://www.facebook.com/chinabusinesses/onboarding/261607794910821/?token=1805737306827191', '_blank')
                        }
                    })

                    // 如果是新建模式，重置表单
                    form.resetFields()
                    // 清空文件上传列表
                    setFileList([])
                }
            } else {
                console.error('API调用失败:', res.message)
                message.error(res.message || '提交失败')
            }
        } catch (error) {
            console.error('提交过程中发生错误:', error)
            message.error('提交过程中发生错误')
        } finally {
            setLoading(false)
        }
    }

    const fetchTaskDetail = async () => {
        if (!taskId || !userId) return

        setLoading(true)
        try {
            const response = await getFacebookApplyRecord(taskId)

            if (
                response.success &&
                response.data?.mediaAccountApplications?.[0]?.mediaAccountInfos
            ) {
                // 保存工单ID
                if (response.data.mediaAccountApplications[0].workOrderId) {
                    setWorkOrderId(
                        response.data.mediaAccountApplications[0].workOrderId
                    )
                }

                const mediaAccountInfo =
                    response.data.mediaAccountApplications[0]
                        .mediaAccountInfos[0]
                const company =
                    response.data.mediaAccountApplications[0].company || {}

                // 首先确保公司信息的类型和结构正确
                const formData = {
                    ...mediaAccountInfo,
                    productType: Number(mediaAccountInfo.productType),
                    promotionLinks: Array.isArray(
                        mediaAccountInfo.promotionLinks
                    )
                        ? mediaAccountInfo.promotionLinks
                        : [mediaAccountInfo.promotionLinks].filter(Boolean),
                    auths: mediaAccountInfo.auths?.map((auth: any) =>
                        auth
                            ? {
                                role: Number(auth.role),
                                value: auth.value
                            }
                            : null
                    ) || [null],
                    // 设置企业信息数据
                    businessLicenseNo: company.businessLicenseNo || '',
                    companyNameEN: company.companyNameEN || '',
                    registrationDetails: {
                        companyName: company.companyNameCN || '',
                        legalRepName: company.legalRepName || '',
                        idType: company.idType || 1,
                        idNumber: company.idNumber || '',
                        legalRepPhone: company.legalRepPhone || '',
                        legalRepBankCard: company.legalRepBankCard || ''
                    },
                    // 处理附件
                    businessLicenseAttachment:
                        company.attachments &&
                            Array.isArray(company.attachments) &&
                            company.attachments[0] &&
                            company.attachments[0].fileUrl
                            ? [
                                {
                                    uid: '-1',
                                    name:
                                        company.attachments[0].fileName ||
                                        'business_license.jpg',
                                    status: 'done',
                                    url: company.attachments[0].fileUrl
                                }
                            ]
                            : []
                }

                // 添加日志以检查公司中文名是否正确设置
                console.log('初始化表单数据:', {
                    companyNameCN: company.companyNameCN,
                    formDataCompanyName:
                        formData.registrationDetails.companyName
                })

                // 确保registrationDetails.companyName有正确的值
                if (
                    !formData.registrationDetails.companyName &&
                    company.companyNameCN
                ) {
                    formData.registrationDetails.companyName =
                        company.companyNameCN
                }

                // 设置初始表单数据
                setInitialData(formData)

                // 填充表单
                form.setFieldsValue(formData)

                // 单独设置嵌套字段，确保其被正确设置
                if (company.companyNameCN) {
                    console.log('设置公司中文名:', company.companyNameCN)
                    form.setFieldValue(
                        ['registrationDetails', 'companyName'],
                        company.companyNameCN
                    )

                    // 确保这个值被正确设置
                    setTimeout(() => {
                        const currentValue = form.getFieldValue([
                            'registrationDetails',
                            'companyName'
                        ])
                        console.log('检查公司名称是否设置成功:', currentValue)
                        if (currentValue !== company.companyNameCN) {
                            console.log('公司名称设置不成功，重试')
                            form.setFieldValue(
                                ['registrationDetails', 'companyName'],
                                company.companyNameCN
                            )
                        }
                    }, 100)
                }

                // 设置公司所在地
                if (company.location !== undefined) {
                    setLocationId(Number(company.location))
                }

                message.success('已加载申请数据')
            } else {
                message.error('获取申请数据失败')
            }
        } catch (error) {
            console.error('获取申请数据失败:', error)
            message.error('获取申请数据失败')
        } finally {
            setLoading(false)
        }
    }

    // 在useEffect中检查表单字段设置是否成功
    useEffect(() => {
        if (initialData && form) {
            // 检查表单中的公司名称是否正确设置
            const companyName = form.getFieldValue([
                'registrationDetails',
                'companyName'
            ])
            console.log('检查表单中的公司名称:', companyName)

            // 如果未正确设置，尝试重新设置
            if (!companyName && initialData.registrationDetails?.companyName) {
                console.log('重新设置公司名称')
                form.setFieldValue(
                    ['registrationDetails', 'companyName'],
                    initialData.registrationDetails.companyName
                )
            }
        }
    }, [initialData, form])

    useEffect(() => {
        // 检查登录状态
        if (status === 'unauthenticated') {
            message.error('请先登录')
            return
        }

        getDicData()
        if (isEdit) {
            fetchTaskDetail()
        } else {
            // 只设置默认的位置ID为中国大陆
            setLocationId(1)
        }
    }, [taskId, status, form])

    // 如果未登录，显示加载状态或重定向
    if (status === 'loading' || !session) {
        return <div>Loading...</div>
    }

    // 货币选项
    const currencyOptions = [
        { label: '美元 (USD)', value: 'USD' }
        // { label: '人民币 (CNY)', value: 'CNY' },
        // { label: '欧元 (EUR)', value: 'EUR' }
    ]

    // 添加手动验证函数
    const validateFormManually = () => {
        // 获取表单值
        const values = form.getFieldsValue(true)

        // 清除之前的错误状态
        form.setFields([
            { name: 'name', errors: [] },
            { name: 'currencyCode', errors: [] },
            { name: 'timezone', errors: [] },
            { name: ['registrationDetails', 'companyName'], errors: [] },
            { name: 'companyNameEN', errors: [] },
            { name: 'businessLicenseNo', errors: [] },
            { name: ['promotionLinks', 0], errors: [] },
            { name: ['auths', 0, 'value'], errors: [] },
            { name: ['auths', 0, 'role'], errors: [] },
            { name: ['registrationDetails', 'legalRepName'], errors: [] },
            { name: ['registrationDetails', 'idType'], errors: [] },
            { name: ['registrationDetails', 'idNumber'], errors: [] },
            { name: ['registrationDetails', 'legalRepBankCard'], errors: [] },
            { name: ['registrationDetails', 'legalRepPhone'], errors: [] }
        ])

        let hasError = false
        let errorMsg = ''

        // 验证账户名称
        if (!values.name) {
            form.setFields([{ name: 'name', errors: ['账户名称不能为空'] }])
            hasError = true
            errorMsg = '账户名称不能为空'
        }

        // 验证币种
        if (!values.currencyCode) {
            form.setFields([{ name: 'currencyCode', errors: ['币种不能为空'] }])
            hasError = true
            errorMsg = '币种不能为空'
        }

        // 验证时区
        if (!values.timezone) {
            form.setFields([{ name: 'timezone', errors: ['时区不能为空'] }])
            hasError = true
            errorMsg = '时区不能为空'
        }

        // 验证公司中文名称
        if (!values.registrationDetails?.companyName) {
            form.setFields([
                {
                    name: ['registrationDetails', 'companyName'],
                    errors: ['公司中文名称不能为空']
                }
            ])
            hasError = true
            errorMsg = '公司中文名称不能为空'
        }

        // 验证公司英文名称
        if (!values.companyNameEN) {
            form.setFields([
                { name: 'companyNameEN', errors: ['公司英文名称不能为空'] }
            ])
            hasError = true
            errorMsg = '公司英文名称不能为空'
        }

        // 验证营业执照统一社会信用代码
        if (!values.businessLicenseNo) {
            form.setFields([
                {
                    name: 'businessLicenseNo',
                    errors: ['营业执照统一社会信用代码不能为空']
                }
            ])
            hasError = true
            errorMsg = '营业执照统一社会信用代码不能为空'
        } else if (values.businessLicenseNo.length < 15) {
            form.setFields([
                {
                    name: 'businessLicenseNo',
                    errors: ['营业执照统一社会信用代码长度不正确']
                }
            ])
            hasError = true
            errorMsg = '营业执照统一社会信用代码长度不正确'
        }

        // 验证法人姓名
        if (!values.registrationDetails?.legalRepName) {
            form.setFields([
                {
                    name: ['registrationDetails', 'legalRepName'],
                    errors: ['法人姓名不能为空']
                }
            ])
            hasError = true
            errorMsg = '法人姓名不能为空'
        }

        // 验证法人证件号码
        if (!values.registrationDetails?.idNumber) {
            form.setFields([
                {
                    name: ['registrationDetails', 'idNumber'],
                    errors: ['法人证件号码不能为空']
                }
            ])
            hasError = true
            errorMsg = '法人证件号码不能为空'
        } else if (
            values.registrationDetails.idType === 1 &&
            values.registrationDetails.idNumber.length !== 18
        ) {
            form.setFields([
                {
                    name: ['registrationDetails', 'idNumber'],
                    errors: ['身份证号码必须为18位']
                }
            ])
            hasError = true
            errorMsg = '身份证号码必须为18位'
        }

        // 验证法人手机号
        if (!values.registrationDetails?.legalRepPhone) {
            form.setFields([
                {
                    name: ['registrationDetails', 'legalRepPhone'],
                    errors: ['法人手机号不能为空']
                }
            ])
            hasError = true
            errorMsg = '法人手机号不能为空'
        } else if (
            !/^1\d{10}$/.test(values.registrationDetails.legalRepPhone)
        ) {
            form.setFields([
                {
                    name: ['registrationDetails', 'legalRepPhone'],
                    errors: ['请输入正确的手机号码']
                }
            ])
            hasError = true
            errorMsg = '请输入正确的手机号码'
        }

        // 验证银行卡号
        if (!values.registrationDetails?.legalRepBankCard) {
            form.setFields([
                {
                    name: ['registrationDetails', 'legalRepBankCard'],
                    errors: ['法人银行卡号不能为空']
                }
            ])
            hasError = true
            errorMsg = '法人银行卡号不能为空'
        }

        // 验证推广链接
        if (
            !values.promotionLinks ||
            values.promotionLinks.length === 0 ||
            !values.promotionLinks[0]
        ) {
            form.setFields([
                {
                    name: ['promotionLinks', 0],
                    errors: ['至少需要一个推广链接']
                }
            ])
            hasError = true
            errorMsg = '至少需要一个推广链接'
        }

        if (hasError) {
            message.error(errorMsg)
            return false
        }

        return true
    }

    // 生成随机测试数据
    const generateTestData = () => {
        // 随机公司名称
        const companyNamePrefixes = [
            '智能',
            '科技',
            '未来',
            '云',
            '数字',
            '创新',
            '星辰',
            '光年'
        ]
        const companyNameSuffixes = [
            '科技',
            '网络',
            '信息',
            '互联网',
            '数据',
            '智能',
            '科学'
        ]
        const randomCompanyName = `${companyNamePrefixes[
            Math.floor(Math.random() * companyNamePrefixes.length)
        ]
            }${companyNameSuffixes[
            Math.floor(Math.random() * companyNameSuffixes.length)
            ]
            }有限公司`

        // 随机英文公司名称
        const engCompanyPrefixes = [
            'Smart',
            'Tech',
            'Future',
            'Cloud',
            'Digital',
            'Nova',
            'Stellar',
            'Quantum'
        ]
        const engCompanySuffixes = [
            'Tech',
            'Network',
            'Info',
            'Data',
            'Intelligence',
            'Systems',
            'Solutions'
        ]
        const randomEngCompanyName = `${engCompanyPrefixes[
            Math.floor(Math.random() * engCompanyPrefixes.length)
        ]
            } ${engCompanySuffixes[
            Math.floor(Math.random() * engCompanySuffixes.length)
            ]
            } Co., Ltd.`

        // 标准统一社会信用代码格式（18位）
        const generateValidCode = () => {
            const chars = '0123456789ABCDEFGHJKLMNPQRTUWXY'
            let result = ''
            for (let i = 0; i < 18; i++) {
                result += chars.charAt(Math.floor(Math.random() * chars.length))
            }
            return result
        }

        // 随机法人姓名
        const firstNames = [
            '张',
            '王',
            '李',
            '赵',
            '刘',
            '陈',
            '杨',
            '黄',
            '周',
            '吴'
        ]
        const lastNames = [
            '明',
            '华',
            '强',
            '伟',
            '勇',
            '芳',
            '娜',
            '静',
            '秀',
            '磊'
        ]
        const randomName = `${firstNames[Math.floor(Math.random() * firstNames.length)]
            }${lastNames[Math.floor(Math.random() * lastNames.length)]}`

        // 有效的身份证号（18位）
        const generateValidID = () => {
            // 有效的省市区代码
            const areaCodes = ['110101', '310101', '440101', '510101', '320101']
            const areaCode =
                areaCodes[Math.floor(Math.random() * areaCodes.length)]

            // 有效的出生日期
            const year = 1970 + Math.floor(Math.random() * 30)
            const month = (1 + Math.floor(Math.random() * 12))
                .toString()
                .padStart(2, '0')
            const day = (1 + Math.floor(Math.random() * 28))
                .toString()
                .padStart(2, '0')

            // 顺序码
            const sequence = Math.floor(Math.random() * 1000)
                .toString()
                .padStart(3, '0')

            // 简化的校验码，实际上有计算公式
            const checkCode = '0123456789X'[Math.floor(Math.random() * 11)]

            return `${areaCode}${year}${month}${day}${sequence}${checkCode}`
        }

        // 有效的中国大陆手机号（11位，以1开头）
        const generateValidPhone = () => {
            const prefixes = [
                '134',
                '135',
                '136',
                '137',
                '138',
                '139',
                '150',
                '151',
                '152',
                '157',
                '158',
                '159',
                '188',
                '187',
                '182'
            ]
            const prefix = prefixes[Math.floor(Math.random() * prefixes.length)]
            const suffix = Math.floor(Math.random() * 100000000)
                .toString()
                .padStart(8, '0')
            return `${prefix}${suffix}`
        }

        // 有效的银行卡号（16-19位）
        const generateValidBankCard = () => {
            const prefixes = ['6222', '6225', '6226', '6228']
            const prefix = prefixes[Math.floor(Math.random() * prefixes.length)]
            // 确保至少16位数字
            const length = 12 + Math.floor(Math.random() * 4) // 总长度16-19位
            const suffix = Math.floor(Math.random() * Math.pow(10, length))
                .toString()
                .padStart(length, '0')
            return `${prefix}${suffix}`
        }

        // 随机账户名称
        const accountPrefixes = ['广告', '营销', '推广', '品牌', '销售']
        const accountSuffixes = ['账户', '平台', '中心', '服务', '渠道']
        const randomAccountName = `${accountPrefixes[Math.floor(Math.random() * accountPrefixes.length)]
            }${accountSuffixes[Math.floor(Math.random() * accountSuffixes.length)]}`

        // 确保产品类型有效
        let randomProductType
        if (productTypeList && productTypeList.length > 0) {
            randomProductType =
                productTypeList[
                    Math.floor(Math.random() * productTypeList.length)
                ].value
        } else {
            // 默认值
            randomProductType = ProductTypeEnum.OTHER
        }

        // 有效的邮箱
        const generateValidEmail = () => {
            const names = [
                'marketing',
                'sales',
                'info',
                'support',
                'contact',
                'media',
                'service'
            ]
            const domains = [
                'example.com',
                'test.com',
                'company.net',
                'business.org',
                'enterprise.co'
            ]
            return `${names[Math.floor(Math.random() * names.length)]}@${domains[Math.floor(Math.random() * domains.length)]
                }`
        }

        // 有效的URL（确保包含https://）
        const generateValidUrl = () => {
            const domains = [
                'example.com',
                'mysite.net',
                'testapp.io',
                'product.co',
                'brand.com'
            ]
            const paths = [
                '',
                'product',
                'service',
                'about',
                'landing',
                'promo'
            ]
            return `https://www.${domains[Math.floor(Math.random() * domains.length)]
                }/${paths[Math.floor(Math.random() * paths.length)]}`
        }

        // 设置表单数据
        const testData = {
            name: randomAccountName,
            productType: randomProductType,
            currencyCode: 'USD', // 使用美元
            timezone: 'America/New_York',
            rechargeAmount: '',
            registrationDetails: {
                companyName: randomCompanyName,
                legalRepName: randomName,
                idType: 1, // 身份证
                idNumber: generateValidID(),
                legalRepPhone: generateValidPhone(),
                legalRepBankCard: generateValidBankCard()
            },
            companyNameEN: randomEngCompanyName,
            businessLicenseNo: generateValidCode(),
            promotionLinks: [generateValidUrl()],
            auths: [
                {
                    value: generateValidEmail(),
                    role: [
                        AuthRoleEnum.STANDARD,
                        AuthRoleEnum.ADMIN,
                        AuthRoleEnum.READONLY
                    ][Math.floor(Math.random() * 3)]
                }
            ]
        }

        console.log('生成的测试数据:', JSON.stringify(testData, null, 2))

        // 清除之前的错误状态
        form.setFields([
            { name: 'name', errors: [] },
            { name: 'currencyCode', errors: [] },
            { name: 'timezone', errors: [] },
            { name: ['registrationDetails', 'companyName'], errors: [] },
            { name: 'companyNameEN', errors: [] },
            { name: 'businessLicenseNo', errors: [] },
            { name: ['promotionLinks', 0], errors: [] },
            { name: ['auths', 0, 'value'], errors: [] },
            { name: ['auths', 0, 'role'], errors: [] },
            { name: ['registrationDetails', 'legalRepName'], errors: [] },
            { name: ['registrationDetails', 'idType'], errors: [] },
            { name: ['registrationDetails', 'idNumber'], errors: [] },
            { name: ['registrationDetails', 'legalRepBankCard'], errors: [] },
            { name: ['registrationDetails', 'legalRepPhone'], errors: [] }
        ])

        // 设置表单值
        form.setFieldsValue(testData)

        // 输出干净的测试数据，确保无循环引用
        try {
            console.log('测试数据JSON:', JSON.stringify(testData, null, 2))
        } catch (err) {
            console.error('测试数据包含循环引用:', err)
        }

        message.success('已填入随机测试数据，请检查并提交')
    }

    return (
        <StyleProvider layer>
            <ConfigProvider>
                <Breadcrumb
                    className="mb-4"
                    items={[
                        { title: '开户管理' },
                        {
                            title: (
                                <Link href="/application/apply">开户申请</Link>
                            )
                        },
                        {
                            title: 'Facebook Ads ' + (isEdit ? '修改' : '开户')
                        }
                    ]}
                />
                <Title level={3} className="m-0 mb-4">
                    Facebook 平台{isEdit ? '修改申请' : '开户申请'}
                </Title>
                <div style={{ maxWidth: '1500px', margin: '0 auto' }}>
                    <Form
                        layout="horizontal"
                        form={form}
                        onFinish={handleSubmit}
                        initialValues={{
                            businessLicenseAttachment: [],
                            promotionLinks: [''],
                            auths: [null]
                        }}
                        labelAlign="right"
                        labelCol={{ span: 6 }}
                        wrapperCol={{ span: 18 }}
                        disabled={loading}
                    >
                        <Flex gap={20} vertical>
                            {/* 企业信息卡片 */}
                            <Card>
                                <Title level={4} className="m-0">
                                    企业信息
                                </Title>
                                <Row gutter={[16, 0]} className="mt-4">
                                    <Col span={12}>
                                        <FormItem
                                            name={[
                                                'registrationDetails',
                                                'companyName'
                                            ]}
                                            label="开户公司名称（中文）"
                                            rules={[
                                                {
                                                    required: true,
                                                    message:
                                                        '公司中文名称不能为空'
                                                }
                                            ]}
                                        >
                                            <Input placeholder="请输入开户公司名称（中文）" />
                                        </FormItem>
                                    </Col>
                                    <Col span={12}>
                                        <FormItem
                                            name="companyNameEN"
                                            label="开户公司名称（英文）"
                                            rules={[
                                                {
                                                    required: true,
                                                    message:
                                                        '公司英文名称不能为空'
                                                }
                                            ]}
                                        >
                                            <Input placeholder="请输入开户公司名称（英文）" />
                                        </FormItem>
                                    </Col>
                                    <Col span={12}>
                                        <FormItem
                                            name="businessLicenseNo"
                                            label="营业执照统一社会信用代码"
                                            rules={[
                                                {
                                                    required: true,
                                                    message:
                                                        '营业执照统一社会信用代码不能为空'
                                                }
                                            ]}
                                        >
                                            <Input placeholder="请输入营业执照统一社会信用代码" />
                                        </FormItem>
                                    </Col>
                                    <Col span={12}>
                                        <FormItem
                                            name="businessLicenseAttachment"
                                            label="上传营业执照"
                                            rules={[
                                                {
                                                    required: true,
                                                    message: '请上传营业执照'
                                                }
                                            ]}
                                            valuePropName="fileList"
                                        >
                                            <Upload
                                                name="file"
                                                accept="image/*,.pdf"
                                                headers={{
                                                    authorization:
                                                        'authorization-text'
                                                }}
                                                listType="picture"
                                                fileList={fileList}
                                                customRequest={customUpload}
                                                onChange={({
                                                    fileList: newFileList
                                                }) => {
                                                    console.log(
                                                        '上传文件变化:',
                                                        newFileList
                                                    )
                                                    // 避免频繁设置状态
                                                    const formattedList =
                                                        newFileList.map(
                                                            (file) => ({
                                                                ...file,
                                                                status:
                                                                    file.status ||
                                                                    'done',
                                                                uid:
                                                                    file.uid ||
                                                                    `-${Date.now()}`,
                                                                name:
                                                                    file.name ||
                                                                    'file.jpg'
                                                            })
                                                        )

                                                    // 检查是否真的变化了
                                                    if (
                                                        JSON.stringify(
                                                            formattedList
                                                        ) !==
                                                        JSON.stringify(fileList)
                                                    ) {
                                                        setFileList(
                                                            formattedList
                                                        )
                                                        form.setFieldsValue({
                                                            businessLicenseAttachment:
                                                                formattedList
                                                        })
                                                    }
                                                }}
                                            >
                                                <Button
                                                    icon={<UploadOutlined />}
                                                >
                                                    上传
                                                </Button>
                                            </Upload>
                                        </FormItem>
                                    </Col>
                                    {/* 法人相关信息，不再判断locationId，始终显示 */}
                                    <>
                                        <Col span={12}>
                                            <FormItem
                                                name={[
                                                    'registrationDetails',
                                                    'legalRepName'
                                                ]}
                                                label="法人姓名"
                                                rules={[
                                                    {
                                                        required: true,
                                                        message:
                                                            '法人姓名不能为空'
                                                    }
                                                ]}
                                            >
                                                <Input placeholder="请输入法人姓名" />
                                            </FormItem>
                                        </Col>
                                        <Col span={12}>
                                            <FormItem
                                                name={[
                                                    'registrationDetails',
                                                    'idType'
                                                ]}
                                                label="证件类型"
                                                rules={[
                                                    {
                                                        required: true,
                                                        message:
                                                            '请选择证件类型'
                                                    }
                                                ]}
                                            >
                                                <Select
                                                    placeholder="请选择证件类型"
                                                    options={idTypeOptions}
                                                />
                                            </FormItem>
                                        </Col>
                                        <Col span={12}>
                                            <FormItem
                                                name={[
                                                    'registrationDetails',
                                                    'idNumber'
                                                ]}
                                                label="证件号码"
                                                rules={[
                                                    {
                                                        required: true,
                                                        message:
                                                            '证件号码不能为空'
                                                    }
                                                ]}
                                            >
                                                <Input placeholder="请输入证件号码" />
                                            </FormItem>
                                        </Col>
                                        <Col span={12}>
                                            <FormItem
                                                name={[
                                                    'registrationDetails',
                                                    'legalRepBankCard'
                                                ]}
                                                label="法人银行卡号"
                                                rules={[
                                                    {
                                                        required: true,
                                                        message:
                                                            '法人银行卡号不能为空'
                                                    }
                                                ]}
                                            >
                                                <Input placeholder="请输入法人银行卡号" />
                                            </FormItem>
                                        </Col>
                                        <Col span={12}>
                                            <FormItem
                                                name={[
                                                    'registrationDetails',
                                                    'legalRepPhone'
                                                ]}
                                                label="法人手机号"
                                                rules={[
                                                    {
                                                        required: true,
                                                        message:
                                                            '法人手机号不能为空'
                                                    }
                                                ]}
                                            >
                                                <Input placeholder="请输入法人手机号" />
                                            </FormItem>
                                        </Col>
                                    </>
                                </Row>
                            </Card>
                            {/* 账户信息卡片 */}
                            <Card>
                                <Title level={4} className="m-0">
                                    账户信息
                                </Title>
                                <Row gutter={[16, 0]} className="mt-4">
                                    <Col span={12}>
                                        <FormItem
                                            name="name"
                                            label="账户名称"
                                            rules={[
                                                {
                                                    required: true,
                                                    message: '账户名称不能为空'
                                                }
                                            ]}
                                        >
                                            <Input placeholder="请输入账户名称" />
                                        </FormItem>
                                    </Col>
                                    <Col span={12}>
                                        <FormItem
                                            name="productType"
                                            label="产品类型"
                                            rules={[
                                                {
                                                    required: true,
                                                    message: '产品类型不能为空'
                                                }
                                            ]}
                                        >
                                            <Select
                                                placeholder="请选择产品类型"
                                                options={productTypeList}
                                            />
                                        </FormItem>
                                    </Col>
                                    <Col span={12}>
                                        <FormItem
                                            name="currencyCode"
                                            label="币种"
                                            rules={[
                                                {
                                                    required: true,
                                                    message: '币种不能为空'
                                                }
                                            ]}
                                        >
                                            <Select
                                                placeholder="请选择币种"
                                                options={currencyOptions}
                                            />
                                        </FormItem>
                                    </Col>
                                    <Col span={12}>
                                        <FormItem
                                            name="timezone"
                                            label="账户时区"
                                            rules={[
                                                {
                                                    required: true,
                                                    message: '账户时区不能为空'
                                                }
                                            ]}
                                        >
                                            <Select
                                                placeholder="请选择时区"
                                                options={timezoneOptions}
                                            />
                                        </FormItem>
                                    </Col>
                                    <Col span={12}>
                                        <FormItem
                                            name="rechargeAmount"
                                            label="充值金额"
                                            tooltip={{
                                                title: '正式开通后，实际需要充值的金额',
                                                icon: <InfoCircleOutlined />
                                            }}
                                        >
                                            <Input placeholder="请输入充值金额" />
                                        </FormItem>
                                    </Col>
                                    <Col span={24}>
                                        <List name="promotionLinks">
                                            {(fields, { add, remove }) => {
                                                return (
                                                    <div>
                                                        <Row gutter={16}>
                                                            {fields.map(
                                                                (field) => (
                                                                    <Col
                                                                        span={
                                                                            24
                                                                        }
                                                                        key={
                                                                            field.key
                                                                        }
                                                                    >
                                                                        <Row
                                                                            gutter={
                                                                                16
                                                                            }
                                                                        >
                                                                            <Col
                                                                                span={
                                                                                    12
                                                                                }
                                                                            >
                                                                                <FormItem
                                                                                    name={
                                                                                        field.name
                                                                                    }
                                                                                    label={`推广链接${field.name + 1}`}
                                                                                    labelCol={{
                                                                                        span: 6
                                                                                    }}
                                                                                    wrapperCol={{
                                                                                        span: 18
                                                                                    }}
                                                                                    style={{
                                                                                        position:
                                                                                            'relative'
                                                                                    }}
                                                                                    rules={[
                                                                                        {
                                                                                            required:
                                                                                                true,
                                                                                            message:
                                                                                                '至少需要一个推广链接'
                                                                                        }
                                                                                    ]}
                                                                                >
                                                                                    <Input placeholder="请输入推广链接" />
                                                                                    {fields.length >
                                                                                        1 && (
                                                                                            <DeleteOutlined
                                                                                                style={{
                                                                                                    color: 'red',
                                                                                                    fontSize:
                                                                                                        '16px',
                                                                                                    cursor: 'pointer',
                                                                                                    position:
                                                                                                        'absolute',
                                                                                                    right: '-24px',
                                                                                                    bottom: '8px'
                                                                                                }}
                                                                                                onClick={() =>
                                                                                                    remove(
                                                                                                        field.name
                                                                                                    )
                                                                                                }
                                                                                            />
                                                                                        )}
                                                                                </FormItem>
                                                                            </Col>
                                                                        </Row>
                                                                    </Col>
                                                                )
                                                            )}
                                                            <Col
                                                                span={12}
                                                                className="flex justify-end"
                                                            >
                                                                <Button
                                                                    type="dashed"
                                                                    onClick={() =>
                                                                        add()
                                                                    }
                                                                    icon={
                                                                        <PlusOutlined />
                                                                    }
                                                                >
                                                                    添加推广链接
                                                                </Button>
                                                            </Col>
                                                        </Row>
                                                    </div>
                                                )
                                            }}
                                        </List>
                                    </Col>
                                </Row>
                            </Card>
                            {/* 授权信息卡片 */}
                            <Card>
                                <Title level={4} className="m-0">
                                    授权信息
                                </Title>
                                <List name="auths">
                                    {(fields, { add, remove }) => {
                                        return (
                                            <div className="mt-4">
                                                <Row gutter={[16, 16]}>
                                                    {fields.map((field) => (
                                                        <Col
                                                            span={24}
                                                            key={field.key}
                                                        >
                                                            <Row gutter={16}>
                                                                <Col span={12}>
                                                                    <FormItem
                                                                        name={[
                                                                            field.name,
                                                                            'value'
                                                                        ]}
                                                                        label="授权邮箱"
                                                                        labelCol={{
                                                                            span: 6
                                                                        }}
                                                                        wrapperCol={{
                                                                            span: 18
                                                                        }}
                                                                        style={{
                                                                            position:
                                                                                'relative'
                                                                        }}
                                                                    >
                                                                        <Input placeholder="请输入邮箱" />
                                                                    </FormItem>
                                                                </Col>
                                                                <Col span={12}>
                                                                    <FormItem
                                                                        name={[
                                                                            field.name,
                                                                            'role'
                                                                        ]}
                                                                        label="授权权限"
                                                                        labelCol={{
                                                                            span: 6
                                                                        }}
                                                                        wrapperCol={{
                                                                            span: 18
                                                                        }}
                                                                        style={{
                                                                            position:
                                                                                'relative'
                                                                        }}
                                                                        rules={roleValidateRule(
                                                                            field
                                                                        )}
                                                                    >
                                                                        <Select
                                                                            placeholder="请选择权限"
                                                                            options={authRoleList}
                                                                        />
                                                                        {fields.length >
                                                                            1 && (
                                                                                <DeleteOutlined
                                                                                    style={{
                                                                                        color: 'red',
                                                                                        fontSize:
                                                                                            '16px',
                                                                                        cursor: 'pointer',
                                                                                        position:
                                                                                            'absolute',
                                                                                        right: '-24px',
                                                                                        bottom: '8px'
                                                                                    }}
                                                                                    onClick={() =>
                                                                                        remove(
                                                                                            field.name
                                                                                        )
                                                                                    }
                                                                                />
                                                                            )}
                                                                    </FormItem>
                                                                </Col>
                                                            </Row>
                                                        </Col>
                                                    ))}
                                                    <Col
                                                        span={24}
                                                        className="flex justify-end"
                                                    >
                                                        <Button
                                                            type="dashed"
                                                            onClick={() =>
                                                                add()
                                                            }
                                                            icon={
                                                                <PlusOutlined />
                                                            }
                                                        >
                                                            添加授权邮箱
                                                        </Button>
                                                    </Col>
                                                </Row>
                                            </div>
                                        )
                                    }}
                                </List>
                            </Card>
                            <Card>
                                <Flex justify="center">
                                    <Space>
                                        <Button
                                            type="default"
                                            onClick={() => {
                                                if (isEdit) {
                                                    fetchTaskDetail()
                                                } else {
                                                    form.resetFields()
                                                }
                                            }}
                                        >
                                            重置
                                        </Button>
                                        {/* <Button
                                            type="default"
                                            onClick={generateTestData}
                                        >
                                            填入测试数据
                                        </Button> */}
                                        <Button
                                            type="primary"
                                            onClick={() => {
                                                // 获取表单值并手动提交
                                                const values =
                                                    form.getFieldsValue(true)

                                                // 手动检查和处理文件附件
                                                if (
                                                    !values.businessLicenseAttachment ||
                                                    values
                                                        .businessLicenseAttachment
                                                        .length === 0
                                                ) {
                                                    if (
                                                        fileList &&
                                                        fileList.length > 0
                                                    ) {
                                                        values.businessLicenseAttachment =
                                                            fileList
                                                    } else {
                                                        message.error(
                                                            '请上传营业执照'
                                                        )
                                                        return
                                                    }
                                                }

                                                // 调用handleSubmit
                                                handleSubmit(values)
                                            }}
                                            loading={loading}
                                            disabled={loading}
                                        >
                                            {isEdit ? '保存修改' : '提交申请'}
                                        </Button>
                                        {showRedirectButton && (
                                            <Button
                                                type="primary"
                                                onClick={() =>
                                                    router.push(
                                                        '/application/record'
                                                    )
                                                }
                                            >
                                                查看申请记录
                                            </Button>
                                        )}
                                    </Space>
                                </Flex>
                            </Card>
                        </Flex>
                    </Form>
                    {isEdit && (
                        <Card className="mt-4">
                            <Title level={4} className="m-0">
                                绑定外部任务ID
                            </Title>
                            <Row gutter={[16, 16]} className="mt-4">
                                <Col span={12}>
                                    <FormItem
                                        name="externalTaskId"
                                        label="外部任务ID"
                                        rules={[
                                            {
                                                required: true,
                                                message: '外部任务ID不能为空'
                                            }
                                        ]}
                                    >
                                        <Input placeholder="请输入Facebook平台获取的任务ID" />
                                    </FormItem>
                                </Col>
                                <Col span={12} className="flex items-center">
                                    <Button
                                        type="primary"
                                        onClick={async () => {
                                            const externalTaskId =
                                                form.getFieldValue(
                                                    'externalTaskId'
                                                )
                                            if (!externalTaskId) {
                                                message.error(
                                                    '请输入外部任务ID'
                                                )
                                                return
                                            }

                                            try {
                                                setLoading(true)
                                                const res =
                                                    await bindExternalTaskIdToWorkOrder(
                                                        workOrderId, // 需要从任务详情中获取工单ID
                                                        externalTaskId,
                                                        1, // mediaPlatform: 1 for Facebook
                                                        userId
                                                    )

                                                if (res.success) {
                                                    message.success('绑定成功')
                                                    // 刷新任务详情
                                                    fetchTaskDetail()
                                                } else {
                                                    message.error(
                                                        res.message ||
                                                        '绑定失败'
                                                    )
                                                }
                                            } catch (error) {
                                                console.error(
                                                    '绑定外部任务ID失败:',
                                                    error
                                                )
                                                message.error(
                                                    '绑定过程中发生错误'
                                                )
                                            } finally {
                                                setLoading(false)
                                            }
                                        }}
                                    >
                                        绑定
                                    </Button>
                                </Col>
                            </Row>
                        </Card>
                    )}
                </div>
            </ConfigProvider>
        </StyleProvider>
    )
}
