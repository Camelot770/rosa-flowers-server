"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.telegramAuth = telegramAuth;
const crypto_1 = __importDefault(require("crypto"));
function telegramAuth(req, res, next) {
    const initData = req.headers['x-telegram-init-data'];
    if (!initData) {
        res.status(401).json({ error: 'Telegram init data required' });
        return;
    }
    try {
        const params = new URLSearchParams(initData);
        const hash = params.get('hash');
        params.delete('hash');
        const dataCheckString = Array.from(params.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, value]) => `${key}=${value}`)
            .join('\n');
        const botToken = process.env.BOT_TOKEN;
        if (!botToken) {
            res.status(500).json({ error: 'Server auth not configured' });
            return;
        }
        const secretKey = crypto_1.default.createHmac('sha256', 'WebAppData').update(botToken).digest();
        const calculatedHash = crypto_1.default.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
        if (calculatedHash !== hash) {
            res.status(401).json({ error: 'Invalid telegram data' });
            return;
        }
        // Validate auth_date freshness (24 hours)
        const authDate = params.get('auth_date');
        if (authDate) {
            const authTimestamp = parseInt(authDate) * 1000;
            const now = Date.now();
            if (now - authTimestamp > 24 * 60 * 60 * 1000) {
                res.status(401).json({ error: 'Telegram auth data expired' });
                return;
            }
        }
        const userStr = params.get('user');
        if (!userStr) {
            res.status(401).json({ error: 'Telegram user data required' });
            return;
        }
        req.telegramUser = JSON.parse(userStr);
        next();
    }
    catch (error) {
        res.status(401).json({ error: 'Auth failed' });
    }
}
//# sourceMappingURL=telegramAuth.js.map