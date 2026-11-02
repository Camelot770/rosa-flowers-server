"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startBot = startBot;
exports.notifyOrderStatus = notifyOrderStatus;
exports.notifyOrderCreated = notifyOrderCreated;
exports.notifyPaymentSuccess = notifyPaymentSuccess;
exports.notifyAdminNewOrder = notifyAdminNewOrder;
exports.notifyAdminPayment = notifyAdminPayment;
exports.notifyAdminContactMessage = notifyAdminContactMessage;
exports.broadcastMessage = broadcastMessage;
const node_telegram_bot_api_1 = __importDefault(require("node-telegram-bot-api"));
let bot;
const statusMessages = {
    new: '🆕 Новый',
    confirmed: '✅ Подтверждён',
    preparing: '💐 Готовится',
    delivering: '🚗 В доставке',
    completed: '🎉 Выполнен',
    canceled: '❌ Отменён',
};
async function startBot() {
    const token = process.env.BOT_TOKEN;
    if (!token || token.startsWith('placeholder')) {
        console.log('⚠️ BOT_TOKEN not set or placeholder, skipping bot start');
        return;
    }
    // Validate token before starting polling
    const testBot = new node_telegram_bot_api_1.default(token);
    try {
        const me = await testBot.getMe();
        console.log(`🤖 Bot token valid: @${me.username}`);
        await testBot.stopPolling();
    }
    catch (err) {
        console.error(`❌ Invalid BOT_TOKEN: ${err.message || err}. Skipping bot start.`);
        return;
    }
    bot = new node_telegram_bot_api_1.default(token, { polling: true });
    // Handle polling errors silently (log once, don't spam)
    bot.on('polling_error', (err) => {
        console.error(`Bot polling error: ${err.code || err.message}`);
    });
    // Set commands
    bot.setMyCommands([
        { command: 'start', description: '🌹 Начать' },
        { command: 'catalog', description: '💐 Каталог букетов' },
        { command: 'orders', description: '📦 Мои заказы' },
        { command: 'bonus', description: '⭐ Мои бонусы' },
        { command: 'help', description: '❓ Помощь' },
    ]);
    const webAppUrl = process.env.WEBAPP_URL || 'https://rosa-flowers-client.vercel.app';
    // Set bot description (shown before user starts the bot)
    bot.setMyDescription({
        description: '🌹 Роза цветов — студия стабилизированной флористики\n\n' +
            '💐 Живые цветы, которые не вянут\n' +
            '🌸 Букеты, которые остаются надолго\n' +
            '⭐ Бонусная программа — кэшбэк 5% с каждого заказа\n\n' +
            '📍 д. Званка, ул. Приозёрная, д. 58\n' +
            '🕐 Ежедневно 9:00 – 21:00\n\n' +
            'Нажмите «Начать», чтобы открыть каталог!',
    }).catch(() => { });
    // Short description (shown in profile and search results)
    bot.setMyShortDescription({
        short_description: '🌹 Студия стабилизированной флористики — живые цветы, которые не вянут. Доставка по городу.',
    }).catch(() => { });
    // /start
    bot.onText(/\/start/, (msg) => {
        const name = msg.from?.first_name || 'друг';
        bot.sendMessage(msg.chat.id, `🌷 *Добро пожаловать в Роза цветов!*\n` +
            `━━━━━━━━━━━━━━━━━━━━\n\n` +
            `Привет, *${name}*! 🤗\n\n` +
            `Мы — студия стабилизированной флористики. Живые цветы, которые не вянут. Букеты, которые остаются надолго.\n\n` +
            `✨ *Что мы предлагаем:*\n` +
            `├ 💐 Стабилизированные композиции\n` +
            `├ 🚗 Доставка по городу за 1–3 часа\n` +
            `└ ⭐ Кэшбэк 5% бонусами с каждого заказа\n\n` +
            `━━━━━━━━━━━━━━━━━━━━\n` +
            `📍 д. Званка, ул. Приозёрная, д. 58\n` +
            `📞 +7 917 876-59-58\n` +
            `🕐 Ежедневно 9:00 – 21:00\n` +
            `━━━━━━━━━━━━━━━━━━━━\n\n` +
            `Выберите действие 👇`, {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🌹 Открыть магазин', web_app: { url: webAppUrl } }],
                    [
                        { text: '📦 Заказы', web_app: { url: `${webAppUrl}/orders` } },
                        { text: '⭐ Бонусы', web_app: { url: `${webAppUrl}/profile` } },
                    ],
                    [{ text: '❓ Помощь', callback_data: 'help' }],
                ],
            },
        });
    });
    // /catalog
    bot.onText(/\/catalog/, (msg) => {
        bot.sendMessage(msg.chat.id, '💐 *Каталог композиций*\n\n' +
            'Стабилизированные букеты — живые цветы, которые не вянут. Выбирайте!', {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🌹 Открыть каталог', web_app: { url: webAppUrl } }],
                ],
            },
        });
    });
    // /orders
    bot.onText(/\/orders/, (msg) => {
        bot.sendMessage(msg.chat.id, '📦 *Мои заказы*\n\n' +
            'Здесь вы можете отследить статус ваших заказов.', {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '📦 Посмотреть заказы', web_app: { url: `${webAppUrl}/orders` } }],
                ],
            },
        });
    });
    // /bonus
    bot.onText(/\/bonus/, (msg) => {
        bot.sendMessage(msg.chat.id, '⭐ *Бонусная программа*\n' +
            '━━━━━━━━━━━━━━━━━━━━\n\n' +
            '🎁 *Как это работает:*\n' +
            '├ 5% кэшбэк с каждого оплаченного заказа\n' +
            '├ Бонусами можно оплатить до 20% заказа\n' +
            '└ 1 бонус = 1 рубль\n\n' +
            'Откройте профиль, чтобы увидеть ваш баланс 👇', {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '👤 Мой профиль', web_app: { url: `${webAppUrl}/profile` } }],
                ],
            },
        });
    });
    // Help text (reusable)
    const helpText = '❓ *Помощь — Роза цветов*\n' +
        '━━━━━━━━━━━━━━━━━━━━\n\n' +
        '🌹 Студия стабилизированной флористики\n' +
        '🌸 Живые цветы, которые не вянут\n\n' +
        '📍 *Адрес:* д. Званка, ул. Приозёрная, д. 58\n' +
        '📞 *Телефон:* +7 917 876-59-58\n' +
        '📧 *Email:* rozacvetov@list.ru\n' +
        '🕐 *Режим работы:* ежедневно 9:00 – 21:00\n\n' +
        '🚗 *Доставка:*\n' +
        '├ По городу — 500₽ (1–3 часа)\n' +
        '└ Бесплатно от 5 000₽\n\n' +
        '🤖 *Команды бота:*\n' +
        '├ /start — Главное меню\n' +
        '├ /catalog — Каталог букетов\n' +
        '├ /orders — Мои заказы\n' +
        '├ /bonus — Бонусная программа\n' +
        '└ /help — Эта справка\n\n' +
        '💬 По любым вопросам пишите нам в чат!';
    // /help
    bot.onText(/\/help/, (msg) => {
        bot.sendMessage(msg.chat.id, helpText, { parse_mode: 'Markdown' });
    });
    // Callback: help button from /start
    bot.on('callback_query', (query) => {
        if (query.data === 'help' && query.message) {
            bot.sendMessage(query.message.chat.id, helpText, { parse_mode: 'Markdown' });
            bot.answerCallbackQuery(query.id);
        }
    });
    // Handle any text message (not a command) — friendly redirect
    bot.on('message', (msg) => {
        if (msg.text && !msg.text.startsWith('/') && msg.chat.type === 'private') {
            bot.sendMessage(msg.chat.id, '🌹 Чтобы заказать букет, откройте наш магазин!\n\n' +
                'Если у вас вопрос — звоните: +7 917 876-59-58', {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '💐 Открыть магазин', web_app: { url: webAppUrl } }],
                    ],
                },
            });
        }
    });
    console.log('🤖 Telegram bot started');
}
// Notify user about order status change with beautiful per-status messages
async function notifyOrderStatus(telegramId, orderId, status) {
    if (!bot)
        return;
    const webAppUrl = process.env.WEBAPP_URL || 'https://rosa-flowers-client.vercel.app';
    const statusTemplates = {
        confirmed: {
            title: '✅ Заказ подтверждён!',
            body: `Отличные новости! Ваш заказ *#${orderId}* подтверждён.\n\n` +
                `🌸 Мы уже готовимся к его сборке.\n` +
                `📞 Если нужно что-то уточнить — свяжитесь с нами.`,
            buttonText: '📦 Детали заказа',
        },
        preparing: {
            title: '💐 Собираем ваш букет!',
            body: `Ваш заказ *#${orderId}* уже в работе!\n\n` +
                `🎨 Наш флорист с любовью собирает композицию специально для вас.\n` +
                `⏱ Совсем скоро он будет готов!`,
            buttonText: '📦 Следить за заказом',
        },
        delivering: {
            title: '🚗 Заказ в пути!',
            body: `Ваш заказ *#${orderId}* уже едет!\n\n` +
                `📍 Курьер выехал и скоро будет по указанному адресу.\n` +
                `🌹 Подготовьтесь к приятному сюрпризу!`,
            buttonText: '📦 Отследить заказ',
        },
        completed: {
            title: '🎉 Заказ доставлен!',
            body: `Ваш заказ *#${orderId}* успешно выполнен!\n\n` +
                `💐 Надеемся, букет принесёт радость и улыбки!\n` +
                `⭐ Не забудьте, что с каждого заказа вы получаете бонусы.\n\n` +
                `Спасибо, что выбираете *Роза цветов*! 🌹`,
            buttonText: '💐 Заказать ещё',
        },
        canceled: {
            title: '❌ Заказ отменён',
            body: `Ваш заказ *#${orderId}* был отменён.\n\n` +
                `Если это произошло по ошибке или у вас есть вопросы — свяжитесь с нами:\n` +
                `📞 +7 917 876-59-58\n\n` +
                `Мы всегда рады помочь! 🌸`,
            buttonText: '💐 Новый заказ',
        },
    };
    const template = statusTemplates[status];
    if (template) {
        await bot.sendMessage(telegramId, `${template.title}\n` +
            `━━━━━━━━━━━━━━━━━━━━\n\n` +
            template.body, {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: template.buttonText, web_app: { url: `${webAppUrl}/orders` } }],
                ],
            },
        });
    }
    else {
        // Fallback for unknown statuses
        const statusText = statusMessages[status] || status;
        await bot.sendMessage(telegramId, `🌹 *Роза цветов*\n` +
            `━━━━━━━━━━━━━━━━━━━━\n\n` +
            `📋 Заказ *#${orderId}*\n` +
            `📌 Статус: ${statusText}\n\n` +
            `Спасибо, что выбираете нас! 💐`, {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '📦 Посмотреть заказ', web_app: { url: `${webAppUrl}/orders` } }],
                ],
            },
        });
    }
}
// Notify user that order was created successfully
async function notifyOrderCreated(telegramId, orderId, totalPrice, itemCount, deliveryType, bonusEarned) {
    if (!bot)
        return;
    const webAppUrl = process.env.WEBAPP_URL || 'https://rosa-flowers-client.vercel.app';
    const deliveryText = deliveryType === 'pickup' ? '🏪 Самовывоз' : '🚗 Доставка';
    const priceFormatted = totalPrice.toLocaleString('ru-RU');
    await bot.sendMessage(telegramId, `✅ *Заказ оформлен!*\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `📋 Заказ *#${orderId}*\n` +
        `🛒 Позиций: ${itemCount}\n` +
        `💰 Сумма: *${priceFormatted} ₽*\n` +
        `${deliveryText}\n\n` +
        (bonusEarned > 0
            ? `⭐ После оплаты вам начислится *${bonusEarned} бонусов*!\n\n`
            : '') +
        `Ожидайте подтверждения. Мы свяжемся с вами в ближайшее время! 🌹`, {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [{ text: '📦 Мои заказы', web_app: { url: `${webAppUrl}/orders` } }],
                [{ text: '💐 Продолжить покупки', web_app: { url: webAppUrl } }],
            ],
        },
    });
}
// Notify user that payment was successful with full order details
async function notifyPaymentSuccess(telegramId, orderId, totalPrice, bonusEarned, items, deliveryType, deliveryDate, deliveryTime, address, recipientName) {
    if (!bot)
        return;
    const webAppUrl = process.env.WEBAPP_URL || 'https://rosa-flowers-client.vercel.app';
    const priceFormatted = totalPrice.toLocaleString('ru-RU');
    let text = `💳 *Оплата получена!*\n━━━━━━━━━━━━━━━━━━━━\n\n📋 Заказ *#${orderId}*\n`;
    // Состав заказа
    if (items && items.length > 0) {
        text += `\n🛒 *Состав заказа:*\n`;
        for (const item of items) {
            const itemTotal = item.price * item.quantity;
            text += `  • ${item.name}`;
            if (item.quantity > 1)
                text += ` ×${item.quantity}`;
            text += ` — ${itemTotal.toLocaleString('ru-RU')} ₽\n`;
        }
    }
    text += `\n💰 *Итого: ${priceFormatted} ₽*\n`;
    // Доставка
    if (deliveryType === 'delivery') {
        text += `\n🚗 Доставка`;
        if (address)
            text += `: ${address}`;
        text += `\n`;
    }
    else if (deliveryType === 'pickup') {
        text += `\n🏪 Самовывоз\n`;
    }
    if (deliveryDate) {
        text += `📅 ${deliveryDate}`;
        if (deliveryTime)
            text += `, ${deliveryTime}`;
        text += `\n`;
    }
    if (recipientName) {
        text += `👤 Получатель: ${recipientName}\n`;
    }
    if (bonusEarned > 0) {
        text += `\n⭐ Начислено *${bonusEarned} бонусов* на ваш счёт!\n`;
    }
    text += `\nМы уже начинаем собирать ваш букет! 💐\nСледите за статусом заказа 👇`;
    await bot.sendMessage(telegramId, text, {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [{ text: '📦 Статус заказа', web_app: { url: `${webAppUrl}/orders` } }],
            ],
        },
    });
}
// Admin Telegram IDs for order notifications
const ADMIN_IDS = ['5598055475', '736051965'];
// Helper: send message to all admins
async function sendToAllAdmins(text) {
    if (!bot)
        return;
    for (const adminId of ADMIN_IDS) {
        try {
            await bot.sendMessage(adminId, text, { parse_mode: 'Markdown' });
        }
        catch (e) {
            console.error(`Failed to send admin notification to ${adminId}:`, e);
        }
    }
}
// Notify admin(s) about new order with full details
async function notifyAdminNewOrder(orderId, customerName, totalPrice, itemCount, deliveryType, items, platform, deliveryDate, deliveryTime, address, recipientName, recipientPhone, bonusUsed, bonusEarned) {
    const priceFormatted = totalPrice.toLocaleString('ru-RU');
    const deliveryText = deliveryType === 'pickup' ? '🏪 Самовывоз' : '🚗 Доставка';
    const platformText = platform === 'max' ? '📱 Max' : '📱 Telegram';
    let text = `🔔 *Новый заказ!*\n━━━━━━━━━━━━━━━━━━━━\n\n`;
    text += `📋 Заказ *#${orderId}*\n`;
    text += `${platformText}\n`;
    text += `👤 Клиент: ${customerName}\n`;
    text += `💰 Сумма: *${priceFormatted} ₽*\n`;
    text += `${deliveryText}\n`;
    // Состав заказа
    if (items && items.length > 0) {
        text += `\n🛒 *Состав заказа:*\n`;
        for (const item of items) {
            const itemTotal = item.price * item.quantity;
            text += `  • ${item.name}`;
            if (item.quantity > 1)
                text += ` ×${item.quantity}`;
            text += ` — ${itemTotal.toLocaleString('ru-RU')} ₽\n`;
        }
    }
    // Доставка
    if (deliveryType === 'delivery' && address) {
        text += `\n📍 Адрес: ${address}\n`;
    }
    if (deliveryDate) {
        text += `📅 ${deliveryDate}`;
        if (deliveryTime)
            text += `, ${deliveryTime}`;
        text += `\n`;
    }
    if (recipientName) {
        text += `🎁 Получатель: ${recipientName}\n`;
    }
    if (recipientPhone) {
        text += `📞 Телефон: ${recipientPhone}\n`;
    }
    if (bonusUsed && bonusUsed > 0) {
        text += `🔻 Списано бонусов: ${bonusUsed}\n`;
    }
    if (bonusEarned && bonusEarned > 0) {
        text += `⭐ Начислится бонусов: ${bonusEarned}\n`;
    }
    await sendToAllAdmins(text);
}
// Notify admin about successful payment with full order details
async function notifyAdminPayment(orderId, totalPrice, items, deliveryType, deliveryDate, deliveryTime, address, recipientName, customerName, platform, bonusEarned, recipientPhone, bonusUsed) {
    const priceFormatted = totalPrice.toLocaleString('ru-RU');
    const platformText = platform === 'max' ? '📱 Max' : '📱 Telegram';
    let text = `💳 *Оплата получена!*\n━━━━━━━━━━━━━━━━━━━━\n\n`;
    text += `📋 Заказ *#${orderId}*\n`;
    text += `${platformText}\n`;
    if (customerName)
        text += `👤 Клиент: ${customerName}\n`;
    text += `💰 Сумма: *${priceFormatted} ₽*\n`;
    // Состав заказа
    if (items && items.length > 0) {
        text += `\n🛒 *Состав заказа:*\n`;
        for (const item of items) {
            const itemTotal = item.price * item.quantity;
            text += `  • ${item.name}`;
            if (item.quantity > 1)
                text += ` ×${item.quantity}`;
            text += ` — ${itemTotal.toLocaleString('ru-RU')} ₽\n`;
        }
    }
    // Доставка
    if (deliveryType === 'delivery') {
        text += `\n🚗 Доставка`;
        if (address)
            text += `: ${address}`;
        text += `\n`;
    }
    else if (deliveryType === 'pickup') {
        text += `\n🏪 Самовывоз\n`;
    }
    if (deliveryDate) {
        text += `📅 ${deliveryDate}`;
        if (deliveryTime)
            text += `, ${deliveryTime}`;
        text += `\n`;
    }
    if (recipientName) {
        text += `🎁 Получатель: ${recipientName}`;
        if (recipientPhone)
            text += ` (${recipientPhone})`;
        text += `\n`;
    }
    if (bonusUsed && bonusUsed > 0) {
        text += `🔻 Использовано бонусов: ${bonusUsed}\n`;
    }
    if (bonusEarned && bonusEarned > 0) {
        text += `⭐ Начислено бонусов: ${bonusEarned}\n`;
    }
    text += `\nПора собирать букет! 💐`;
    await sendToAllAdmins(text);
}
// Notify admin about contact message from client
async function notifyAdminContactMessage(senderName, senderUsername, platformId, message) {
    const usernameText = senderUsername ? ` (@${senderUsername})` : '';
    const text = `💬 *Сообщение от клиента*\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `👤 ${senderName}${usernameText}\n` +
        `🆔 ID: ${platformId}\n\n` +
        `📝 *Сообщение:*\n${message}`;
    await sendToAllAdmins(text);
}
// Broadcast message to all users
async function broadcastMessage(telegramIds, message) {
    if (!bot)
        return { sent: 0, failed: 0 };
    let sent = 0;
    let failed = 0;
    for (const telegramId of telegramIds) {
        try {
            await bot.sendMessage(telegramId, message, { parse_mode: 'Markdown' });
            sent++;
            // Rate limit: Telegram allows ~30 msg/sec, pause every 25
            if (sent % 25 === 0) {
                await new Promise((r) => setTimeout(r, 1000));
            }
        }
        catch (err) {
            console.error(`Failed to send broadcast to ${telegramId}:`, err);
            failed++;
        }
    }
    return { sent, failed };
}
//# sourceMappingURL=bot.js.map