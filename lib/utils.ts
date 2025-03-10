export const generateTicketId = (prefix: string = 'TK') => {
    // const prefix = 'TK'
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const random = Math.random().toString(36).slice(2, 6).toUpperCase()
    return `${prefix}${date}-${random}`
}

export const formatCurrency = (amount: number) => {
    return amount.toFixed(2)
}
