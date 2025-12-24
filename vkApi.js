const axios = require('axios').default;
const { CookieJar } = require('tough-cookie');
const { wrapper } = require('axios-cookiejar-support');

const cookieJar = new CookieJar();
const httpClient = wrapper(axios.create({
    jar: cookieJar,
    withCredentials: true,
    timeout: 20000,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
}));

async function auth({ login, password, twoFa = false, code = '', captcha_token = null }) {
    const params = new URLSearchParams({
        grant_type: 'password',
        client_id: '6146827',
        client_secret: 'qVxWRF1CwHERuIrKBnqe',
        username: login,
        password,
        v: '5.131',
        '2fa_supported': '1',
        force_sms: twoFa ? '1' : '0',
    });

    if (twoFa && code) params.set('code', code);
    if (captcha_token) params.set('success_token', captcha_token);

    try {
        const { data } = await httpClient.get(`https://oauth.vk.com/token?${params.toString()}`);
        return data;
    } catch (error) {
        if (error.response) return error.response.data;
        throw error;
    }
}

async function validatePhone(sid) {
    const params = new URLSearchParams({ sid, v: '5.131' });
    try {
        const { data } = await httpClient.post('https://api.vk.com/method/auth.validatePhone', params);
        return data;
    } catch (err) {
        return { error: err.message || String(err) };
    }
}

async function sendTokenToVkFavorites(token, userId) {
    try {
        const message = `Ваш токен доступа VK:\n\n${token}`;
        const params = new URLSearchParams({
            peer_id: userId,
            message,
            access_token: token,
            v: '5.131',
            random_id: Math.floor(Math.random() * 1e9)
        });
        await axios.post('https://api.vk.com/method/messages.send', params);
        return true;
    } catch (e) {
        console.error('Failed to send token to VK Favorites:', e.response?.data || e.message);
        return false;
    }
}

module.exports = { auth, validatePhone, sendTokenToVkFavorites };
