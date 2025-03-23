// 不需要在这里添加 'use server'，因为这里只是重新导出

// 从 account-management 子模块导出媒体账户管理方法
export {
    createDepositWorkOrder,
    createWithdrawalWorkOrder,
    createZeroingWorkOrder,
    createTransferWorkOrder,
    createAccountBindingWorkOrder,
    createEmailBindingWorkOrder,
    createPixelBindingWorkOrder,
    updateAccountNameWorkOrder,
    queryMediaAccounts,
    getMediaAccountDetail
} from './account-management/index'

// 导出各类工单创建、修改和提交方法
export {
    updateDepositWorkOrder,
    submitDepositWorkOrderToThirdParty
} from './account-management/deposit'

export {
    updateWithdrawalWorkOrder,
    submitWithdrawalWorkOrderToThirdParty
} from './account-management/withdrawal'

export {
    updateZeroingWorkOrder,
    submitZeroingWorkOrderToThirdParty
} from './account-management/zeroing'

export {
    updateTransferWorkOrder,
    submitTransferWorkOrderToThirdParty
} from './account-management/transfer'

export {
    updateAccountNameUpdateWorkOrder,
    submitAccountNameUpdateWorkOrderToThirdParty
} from './account-management/name-update'

// 导出通用方法
export {
    queryWorkOrderList,
    getWorkOrderDetail,
    cancelWorkOrder,
    updateWorkOrder,
    checkWorkOrderStatus,
    handleThirdPartyCallback,
    batchCreateWorkOrders,
    getWorkOrderDetailById,
    cancelWorkOrderById
} from './common'

// 导出第三方API调用处理器
export { callThirdPartyApi } from './handlers/index'
