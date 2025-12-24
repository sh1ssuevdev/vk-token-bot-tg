const winston = require('winston');
const TelegramLogger = require('winston-telegram');

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

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
