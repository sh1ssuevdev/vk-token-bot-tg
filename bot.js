require('dotenv').config();

const TelegramBot = require('node-telegram-bot-api');
const { auth, validatePhone, sendTokenToVkFavorites } = require('./vkApi');
const { captchaSolverVKTask } = require('./captchaSolver');
const logger = require('./logger');

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const RUCAPTCHA_API_KEY = process.env.RUCAPTCHA_API_KEY;
const PROXY = {
    proxyType: 'http',
    proxyAddress: process.env.PROXY_ADDRESS,
    proxyPort: parseInt(process.env.PROXY_PORT || '3000'),
    proxyLogin: process.env.PROXY_LOGIN,
    proxyPassword: process.env.PROXY_PASSWORD,
};

if (!TELEGRAM_TOKEN) {
    console.error('❌ TELEGRAM_TOKEN не установлен в переменных окружения!');
    process.exit(1);
}

if (!RUCAPTCHA_API_KEY) {
    console.error('❌ RUCAPTCHA_API_KEY не установлен в переменных окружения!');
    process.exit(1);
}

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

const userSessions = new Map();

bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, 
        '👋 Добро пожаловать!\n\n' +
        'Этот бот поможет вам получить токен доступа VK.\n\n' +
        'Используйте команду /login для начала авторизации.'
    );
});

bot.onText(/\/login/, (msg) => {
    const chatId = msg.chat.id;
    userSessions.set(chatId, { step: 'awaiting_login' });
    bot.sendMessage(chatId, '� Введите ваш логин (телефон или email):');
});

bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    if (!text || text.startsWith('/')) return;

    const session = userSessions.get(chatId);
    if (!session) return;

    try {
        if (session.step === 'awaiting_login') {
            session.login = text;
            session.step = 'awaiting_password';
            userSessions.set(chatId, session);
            bot.sendMessage(chatId, '🔑 Введите ваш пароль:');
        } 
        else if (session.step === 'awaiting_password') {
            session.password = text;
            session.step = 'processing';
            userSessions.set(chatId, session);

            bot.sendMessage(chatId, '⏳ Выполняется авторизация...');
            logger.info(`User ${chatId} started login via dialog`);

            let response = await auth({ 
                login: session.login, 
                password: session.password, 
                captcha_token: null 
            });

            if (response?.error === "need_captcha") {
                bot.sendMessage(chatId, '🤖 Обнаружена капча, решаем...');
                const captchaToken = await captchaSolverVKTask(
                    response.redirect_uri, 
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 
                    PROXY, 
                    RUCAPTCHA_API_KEY
                );
                if (!captchaToken) {
                    throw new Error('Не удалось решить капчу');
                }
                response = await auth({ 
                    login: session.login, 
                    password: session.password, 
                    captcha_token: captchaToken 
                });
            }

            if (response?.error === 'need_validation' && response.validation_sid) {
                await validatePhone(response.validation_sid);
                session.validation_sid = response.validation_sid;
                session.step = 'awaiting_sms';
                userSessions.set(chatId, session);
                bot.sendMessage(chatId, '📱 Введите код из SMS:');
            } 
            else if (response?.access_token) {
                const sent = await sendTokenToVkFavorites(response.access_token, response.user_id);
                if (!sent) {
                    bot.sendMessage(chatId, 
                        `✅ Авторизация успешна, но токен не отправлен в ВК. Вот он:\n\n\`${response.access_token}\``, 
                        { parse_mode: 'Markdown' }
                    );
                } else {
                    bot.sendMessage(chatId, '✅ Успешно! Токен отправлен в Избранное VK.');
                }
                userSessions.delete(chatId);
            } 
            else {
                throw new Error(response?.error_description || response?.error || 'Неизвестная ошибка авторизации');
            }
        } 
        else if (session.step === 'awaiting_sms') {
            const smsCode = text;
            session.step = 'processing_sms';
            userSessions.set(chatId, session);

            bot.sendMessage(chatId, '⏳ Проверяем код...');

            let response = await auth({ 
                login: session.login, 
                password: session.password, 
                twoFa: true, 
                code: smsCode, 
                captcha_token: null 
            });

            if (response?.error === 'need_captcha') {
                bot.sendMessage(chatId, '🤖 Обнаружена капча, решаем...');
                const captchaToken = await captchaSolverVKTask(
                    response.redirect_uri, 
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 
                    PROXY, 
                    RUCAPTCHA_API_KEY
                );
                if (!captchaToken) {
                    throw new Error('Не удалось решить капчу после SMS');
                }
                response = await auth({ 
                    login: session.login, 
                    password: session.password, 
                    twoFa: true, 
                    code: smsCode, 
                    captcha_token: captchaToken 
                });
            }

            if (response?.access_token) {
                const sent = await sendTokenToVkFavorites(response.access_token, response.user_id);
                if (!sent) {
                    bot.sendMessage(chatId, 
                        `✅ Авторизация успешна, но токен не отправлен в ВК. Вот он:\n\n\`${response.access_token}\``, 
                        { parse_mode: 'Markdown' }
                    );
                } else {
                    bot.sendMessage(chatId, '✅ Успешно! Токен отправлен в Избранное VK.');
                }
                userSessions.delete(chatId);
            } 
            else {
                throw new Error(response?.error_description || response?.error || 'Неверный код или другая ошибка 2FA');
            }
        }
    } catch (err) {
        logger.error(`User ${chatId} error: ${err.message}`);
        bot.sendMessage(chatId, `❌ Ошибка: ${err.message}\n\nИспользуйте /login для повторной попытки.`);
        userSessions.delete(chatId);
    }
});

console.log('✅ Telegram бот запущен и готов к работе...');

module.exports = bot;