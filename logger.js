const winston = require('winston');
const TelegramLogger = require('winston-telegram');

const TELEGRAM_TOKEN = '8477895961:AAFKYWnyzyJoPn0kmaMQ_OkkEstFWsj7zTg';
const TELEGRAM_CHAT_ID = '5292864478';

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.printf(({ timestamp, level, message }) =>
            `[${timestamp}] ${level.toUpperCase()}: ${message}`
        )
    ),
    transports: [
        new winston.transports.Console(),
        new TelegramLogger({
            token: TELEGRAM_TOKEN,
            chatId: TELEGRAM_CHAT_ID,
            level: 'error'
        })
    ],
    exitOnError: false,
});

module.exports = logger;
