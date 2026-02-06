import TelegramBot from 'node-telegram-bot-api';

let bot: TelegramBot;

const statusMessages: Record<string, string> = {
  new: '🆕 Новый',
  confirmed: '✅ Подтверждён',
  preparing: '💐 Готовится',
  delivering: '🚗 В доставке',
  completed: '🎉 Выполнен',
  canceled: '❌ Отменён',
};

export async function startBot() {
  const token = process.env.BOT_TOKEN;
  if (!token || token.startsWith('placeholder')) {
    console.log('⚠️ BOT_TOKEN not set or placeholder, skipping bot start');
    return;
  }

  // Validate token before starting polling
  const testBot = new TelegramBot(token);
  try {
    const me = await testBot.getMe();
    console.log(`🤖 Bot token valid: @${me.username}`);
    await testBot.stopPolling();
  } catch (err: any) {
    console.error(`❌ Invalid BOT_TOKEN: ${err.message || err}. Skipping bot start.`);
    return;
  }

  bot = new TelegramBot(token, { polling: true });

  // Handle polling errors silently (log once, don't spam)
  bot.on('polling_error', (err: any) => {
    console.error(`Bot polling error: ${err.code || err.message}`);
  });

  // Set commands
  bot.setMyCommands([
    { command: 'start', description: '🌹 Начать' },
    { command: 'catalog', description: '💐 Каталог букетов' },
    { command: 'constructor', description: '🎨 Собрать свой букет' },
    { command: 'orders', description: '📦 Мои заказы' },
    { command: 'bonus', description: '⭐ Мои бонусы' },
    { command: 'help', description: '❓ Помощь' },
  ]);

  const webAppUrl = process.env.WEBAPP_URL || 'https://rosa-flowers-client.vercel.app';

  // Set bot description (shown before user starts the bot)
  bot.setMyDescription({
    description:
      '🌹 Роза цветов — студия флористики в Казани\n\n' +
      '💐 Свежие букеты с доставкой по городу\n' +
      '🎨 Конструктор — собери свой уникальный букет\n' +
      '⭐ Бонусная программа — кэшбэк 5% с каждого заказа\n\n' +
      '📍 д. Званка, ул. Приозёрная, д. 58\n' +
      '🕐 Ежедневно 9:00 – 21:00\n\n' +
      'Нажмите «Начать», чтобы открыть каталог!',
  }).catch(() => {});

  // Short description (shown in profile and search results)
  bot.setMyShortDescription({
    short_description:
      '🌹 Студия флористики — букеты с доставкой по Казани. Конструктор букетов, бонусная программа.',
  }).catch(() => {});

  // /start
  bot.onText(/\/start/, (msg) => {
    const name = msg.from?.first_name || 'друг';
    bot.sendMessage(msg.chat.id,
      `🌷 *Добро пожаловать в Роза цветов!*\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `Привет, *${name}*! 🤗\n\n` +
      `Мы — студия флористики, создаём букеты с любовью и доставляем с заботой.\n\n` +
      `✨ *Что мы предлагаем:*\n` +
      `├ 💐 Готовые букеты на любой повод\n` +
      `├ 🎨 Конструктор — собери свой букет\n` +
      `├ 🚗 Доставка по городу за 1–2 часа\n` +
      `└ ⭐ Кэшбэк 5% бонусами с каждого заказа\n\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `📍 д. Званка, ул. Приозёрная, д. 58\n` +
      `📞 +7 917 876-59-58\n` +
      `🕐 Ежедневно 9:00 – 21:00\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `Выберите действие 👇`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🌹 Открыть магазин', web_app: { url: webAppUrl } }],
            [
              { text: '🎨 Конструктор', web_app: { url: `${webAppUrl}/constructor` } },
              { text: '📦 Заказы', web_app: { url: `${webAppUrl}/orders` } },
            ],
            [
              { text: '⭐ Бонусы', web_app: { url: `${webAppUrl}/profile` } },
              { text: '❓ Помощь', callback_data: 'help' },
            ],
          ],
        },
      }
    );
  });

  // /catalog
  bot.onText(/\/catalog/, (msg) => {
    bot.sendMessage(msg.chat.id,
      '💐 *Каталог букетов*\n\n' +
      'Розы, тюльпаны, пионы, экзотика и авторские композиции — выбирайте!',
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🌹 Открыть каталог', web_app: { url: webAppUrl } }],
          ],
        },
      }
    );
  });

  // /constructor
  bot.onText(/\/constructor/, (msg) => {
    bot.sendMessage(msg.chat.id,
      '🎨 *Конструктор букетов*\n\n' +
      'Выберите цветы, упаковку и декор — мы соберём для вас уникальную композицию!',
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🎨 Собрать букет', web_app: { url: `${webAppUrl}/constructor` } }],
          ],
        },
      }
    );
  });

  // /orders
  bot.onText(/\/orders/, (msg) => {
    bot.sendMessage(msg.chat.id,
      '📦 *Мои заказы*\n\n' +
      'Здесь вы можете отследить статус ваших заказов.',
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '📦 Посмотреть заказы', web_app: { url: `${webAppUrl}/orders` } }],
          ],
        },
      }
    );
  });

  // /bonus
  bot.onText(/\/bonus/, (msg) => {
    bot.sendMessage(msg.chat.id,
      '⭐ *Бонусная программа*\n' +
      '━━━━━━━━━━━━━━━━━━━━\n\n' +
      '🎁 *Как это работает:*\n' +
      '├ 5% кэшбэк с каждого оплаченного заказа\n' +
      '├ Бонусами можно оплатить до 20% заказа\n' +
      '└ 1 бонус = 1 рубль\n\n' +
      'Откройте профиль, чтобы увидеть ваш баланс 👇',
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '👤 Мой профиль', web_app: { url: `${webAppUrl}/profile` } }],
          ],
        },
      }
    );
  });

  // Help text (reusable)
  const helpText =
    '❓ *Помощь — Роза цветов*\n' +
    '━━━━━━━━━━━━━━━━━━━━\n\n' +
    '🌹 Студия флористики в Казани\n\n' +
    '📍 *Адрес:* д. Званка, ул. Приозёрная, д. 58\n' +
    '📞 *Телефон:* +7 917 876-59-58\n' +
    '📧 *Email:* rozacvetov@list.ru\n' +
    '🕐 *Режим работы:* ежедневно 9:00 – 21:00\n\n' +
    '🚗 *Доставка:*\n' +
    '├ По городу — 300₽\n' +
    '└ Бесплатно от 3 000₽\n\n' +
    '🤖 *Команды бота:*\n' +
    '├ /start — Главное меню\n' +
    '├ /catalog — Каталог букетов\n' +
    '├ /constructor — Собрать свой букет\n' +
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
      bot.sendMessage(msg.chat.id,
        '🌹 Чтобы заказать букет, откройте наш магазин!\n\n' +
        'Если у вас вопрос — звоните: +7 917 876-59-58',
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: '💐 Открыть магазин', web_app: { url: webAppUrl } }],
            ],
          },
        }
      );
    }
  });

  console.log('🤖 Telegram bot started');
}

// Notify user about order status change
export async function notifyOrderStatus(telegramId: string, orderId: number, status: string) {
  if (!bot) return;

  const statusText = statusMessages[status] || status;
  const webAppUrl = process.env.WEBAPP_URL || 'https://rosa-flowers-client.vercel.app';

  await bot.sendMessage(telegramId,
    `🌹 *Роза цветов*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n\n` +
    `📋 Заказ *#${orderId}*\n` +
    `📌 Статус: ${statusText}\n\n` +
    `Спасибо, что выбираете нас! 💐`,
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '📦 Посмотреть заказ', web_app: { url: `${webAppUrl}/orders` } }],
        ],
      },
    }
  );
}

// Notify user that order was created successfully
export async function notifyOrderCreated(
  telegramId: string,
  orderId: number,
  totalPrice: number,
  itemCount: number,
  deliveryType: string,
  bonusEarned: number,
) {
  if (!bot) return;

  const webAppUrl = process.env.WEBAPP_URL || 'https://rosa-flowers-client.vercel.app';
  const deliveryText = deliveryType === 'pickup' ? '🏪 Самовывоз' : '🚗 Доставка';
  const priceFormatted = totalPrice.toLocaleString('ru-RU');

  await bot.sendMessage(telegramId,
    `✅ *Заказ оформлен!*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n\n` +
    `📋 Заказ *#${orderId}*\n` +
    `🛒 Позиций: ${itemCount}\n` +
    `💰 Сумма: *${priceFormatted} ₽*\n` +
    `${deliveryText}\n\n` +
    (bonusEarned > 0
      ? `⭐ После оплаты вам начислится *${bonusEarned} бонусов*!\n\n`
      : '') +
    `Ожидайте подтверждения. Мы свяжемся с вами в ближайшее время! 🌹`,
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '📦 Мои заказы', web_app: { url: `${webAppUrl}/orders` } }],
          [{ text: '💐 Продолжить покупки', web_app: { url: webAppUrl } }],
        ],
      },
    }
  );
}

// Notify user that payment was successful
export async function notifyPaymentSuccess(
  telegramId: string,
  orderId: number,
  totalPrice: number,
  bonusEarned: number,
) {
  if (!bot) return;

  const webAppUrl = process.env.WEBAPP_URL || 'https://rosa-flowers-client.vercel.app';
  const priceFormatted = totalPrice.toLocaleString('ru-RU');

  await bot.sendMessage(telegramId,
    `💳 *Оплата получена!*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n\n` +
    `📋 Заказ *#${orderId}*\n` +
    `💰 Оплачено: *${priceFormatted} ₽*\n\n` +
    (bonusEarned > 0
      ? `⭐ Начислено *${bonusEarned} бонусов* на ваш счёт!\n\n`
      : '') +
    `Мы уже начинаем собирать ваш букет! 💐\n` +
    `Следите за статусом заказа 👇`,
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '📦 Статус заказа', web_app: { url: `${webAppUrl}/orders` } }],
        ],
      },
    }
  );
}

// Notify admin(s) about new order
export async function notifyAdminNewOrder(
  orderId: number,
  customerName: string,
  totalPrice: number,
  itemCount: number,
  deliveryType: string,
  items: { name: string; quantity: number; price: number }[],
) {
  if (!bot) return;

  const adminChatId = process.env.ADMIN_TELEGRAM_CHAT_ID;
  if (!adminChatId) return;

  const priceFormatted = totalPrice.toLocaleString('ru-RU');
  const deliveryText = deliveryType === 'pickup' ? '🏪 Самовывоз' : '🚗 Доставка';

  const itemsList = items
    .slice(0, 5)
    .map((item) => `  • ${item.name} × ${item.quantity} — ${item.price * item.quantity} ₽`)
    .join('\n');
  const moreItems = items.length > 5 ? `\n  _...и ещё ${items.length - 5} поз._` : '';

  await bot.sendMessage(adminChatId,
    `🔔 *Новый заказ!*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n\n` +
    `📋 Заказ *#${orderId}*\n` +
    `👤 Клиент: ${customerName}\n` +
    `💰 Сумма: *${priceFormatted} ₽*\n` +
    `${deliveryText}\n\n` +
    `🛒 *Состав:*\n${itemsList}${moreItems}`,
    { parse_mode: 'Markdown' }
  );
}

// Notify admin about successful payment
export async function notifyAdminPayment(orderId: number, totalPrice: number) {
  if (!bot) return;

  const adminChatId = process.env.ADMIN_TELEGRAM_CHAT_ID;
  if (!adminChatId) return;

  const priceFormatted = totalPrice.toLocaleString('ru-RU');

  await bot.sendMessage(adminChatId,
    `💳 *Оплата получена!*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n\n` +
    `📋 Заказ *#${orderId}*\n` +
    `💰 Сумма: *${priceFormatted} ₽*\n\n` +
    `Пора собирать букет! 💐`,
    { parse_mode: 'Markdown' }
  );
}
