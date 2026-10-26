"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.messengerAuth = messengerAuth;
const telegramAuth_1 = require("./telegramAuth");
const maxAuth_1 = require("./maxAuth");
function messengerAuth(req, res, next) {
    const hasTelegramData = !!req.headers['x-telegram-init-data'];
    const hasMaxData = !!req.headers['x-max-init-data'];
    if (hasTelegramData) {
        (0, telegramAuth_1.telegramAuth)(req, res, (err) => {
            if (err)
                return next(err);
            const tgUser = req.telegramUser;
            if (tgUser) {
                req.messengerUser = {
                    platform: 'telegram',
                    platformId: String(tgUser.id),
                    firstName: tgUser.first_name,
                    lastName: tgUser.last_name,
                    username: tgUser.username,
                    photoUrl: tgUser.photo_url,
                };
                next();
            }
            else {
                res.status(401).json({ error: 'Telegram auth failed: user data missing' });
            }
        });
    }
    else if (hasMaxData) {
        (0, maxAuth_1.maxAuth)(req, res, (err) => {
            if (err)
                return next(err);
            const mxUser = req.maxUser;
            if (mxUser) {
                req.messengerUser = {
                    platform: 'max',
                    platformId: String(mxUser.id),
                    firstName: mxUser.first_name || mxUser.name || 'User',
                    lastName: mxUser.last_name,
                    username: mxUser.username,
                };
                next();
            }
            else {
                res.status(401).json({ error: 'Max auth failed: user data missing' });
            }
        });
    }
    else {
        res.status(401).json({ error: 'Messenger auth data required (Telegram or Max)' });
    }
}
//# sourceMappingURL=messengerAuth.js.map