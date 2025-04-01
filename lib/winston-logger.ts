import { createLogger, format, transports } from 'winston'
import 'winston-daily-rotate-file'

// 使用require方式导入moment
const moment = require('moment')

const customFormat = format.combine(
    format.timestamp({
        format: () => moment().utcOffset(8).format('YYYY-MM-DD HH:mm:ss')
    }),
    format.align(),
    format.printf((info) => `${info.level}: ${info.timestamp}: ${info.message}`)
)
const defaultOptions = {
    format: customFormat,
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: '20m',
    maxFiles: '14d',
    frequency: '1m'
    //format: format.json()
}

const globalLogger = createLogger({
    format: customFormat,
    transports: [
        new transports.Console(),
        new transports.DailyRotateFile({
            filename: 'logs/info-%DATE%.log',
            level: 'info',
            ...defaultOptions
        }),
        new transports.DailyRotateFile({
            filename: 'logs/error-%DATE%.log',
            level: 'error',
            ...defaultOptions
        })
    ],
    exitOnError: false,
    exceptionHandlers: [
        new transports.DailyRotateFile({
            filename: 'logs/exceptions.log'
        })
    ]
})

export default globalLogger
