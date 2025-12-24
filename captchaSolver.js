const axios = require('axios').default;

async function postWithRetry(url, payload, retries = 3, delayMs = 2000) {
    for (let i = 0; i < retries; i++) {
        try {
            const { data } = await axios.post(url, payload);
            return data;
        } catch (error) {
            if (i === retries - 1) throw error;
            await new Promise((res) => setTimeout(res, delayMs));
        }
    }
    return null;
}

async function captchaSolverVKTask(redirectUri, userAgent, proxy = null, apiKey) {
    try {
        const urlObj = new URL(redirectUri);
        const sessionToken = urlObj.searchParams.get('session_token');
        if (!sessionToken) return null;

        const taskPayload = {
            clientKey: apiKey,
            task: {
                type: 'VKCaptchaTask',
                redirectUri,
                sessionToken,
                userAgent,
            }
        };

        if (proxy?.proxyAddress && proxy?.proxyPort) {
            Object.assign(taskPayload.task, {
                proxyType: proxy.proxyType,
                proxyAddress: proxy.proxyAddress,
                proxyPort: proxy.proxyPort,
                proxyLogin: proxy.proxyLogin || undefined,
                proxyPassword: proxy.proxyPassword || undefined,
            });
        }

        const create = await postWithRetry('https://api.2captcha.com/createTask', taskPayload);
        if (!create || create.errorId !== 0) return null;

        const taskId = create.taskId;

        for (let i = 0; i < 60; i++) {
            await new Promise(r => setTimeout(r, 5000));
            const result = await postWithRetry('https://api.2captcha.com/getTaskResult', {
                clientKey: apiKey,
                taskId
            });
            if (!result) break;
            if (result.status === 'ready') return result.solution.token;
            if (result.errorId && result.errorId !== 1) break;
        }
    } catch (e) {
        console.error('Error during captcha solving:', e.message || e);
    }
    return null;
}

module.exports = { captchaSolverVKTask, postWithRetry };
