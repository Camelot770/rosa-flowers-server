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

  const webAppUrl = process.env.WEBAPP_URL || 'https://rosa-client.vercel.app';

  // /start
  bot.onText(/\/start/, (msg) => {
    const name = msg.from?.first_name || 'друг';
    bot.sendMessage(msg.chat.id,
      `🌹 Привет, ${name}!\n\nДобро пожаловать в *Роза цветов* — студию флористики!\n\n` +
      `💐 У нас вы найдёте:\n` +
      `• Готовые букеты на любой вкус\n` +
      `• Конструктор — соберите свой уникальный букет\n` +
      `• Бонусная программа — 5% кэшбэк с каждого заказа\n\n` +
      `📍 д. Званка, ул. Приозёрная, д. 58\n` +
      `📞 +7 917 876-59-58\n` +
      `🕐 9:00 – 21:00\n\n` +
      `Нажмите кнопку ниже, чтобы открыть каталог 👇`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '💐 Открыть каталог', web_app: { url: webAppUrl } }],
            [{ text: '🎨 Конструктор букетов', web_app: { url: `${webAppUrl}/constructor` } }],
            [{ text: '📦 Мои заказы', web_app: { url: `${webAppUrl}/orders` } }],
          ],
        },
      }
    );
  });

  // /catalog
  bot.onText(/\/catalog/, (msg) => {
    bot.sendMessage(msg.chat.id, '💐 Откройте каталог букетов:', {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🌹 Открыть каталог', web_app: { url: webAppUrl } }],
        ],
      },
    });
  });

  // /constructor
  bot.onText(/\/constructor/, (msg) => {
    bot.sendMessage(msg.chat.id, '🎨 Соберите свой уникальный букет в конструкторе:', {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🎨 Открыть конструктор', web_app: { url: `${webAppUrl}/constructor` } }],
        ],
      },
    });
  });

  // /orders
  bot.onText(/\/orders/, (msg) => {
    bot.sendMessage(msg.chat.id, '📦 Ваши заказы:', {
      reply_markup: {
        inline_keyboard: [
          [{ text: '📦 Мои заказы', web_app: { url: `${webAppUrl}/orders` } }],
        ],
      },
    });
  });

  // /bonus
  bot.onText(/\/bonus/, (msg) => {
    bot.sendMessage(msg.chat.id,
      '⭐ *Бонусная программа «Роза цветов»*\n\n' +
      '• 5% кэшбэк с каждого оплаченного заказа\n' +
      '• Бонусами можно оплатить до 20% следующего заказа\n' +
      '• 1 бонус = 1 рубль\n\n' +
      'Откройте профиль, чтобы увидеть баланс 👇',
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

  // /help
  bot.onText(/\/help/, (msg) => {
    bot.sendMessage(msg.chat.id,
      '❓ *Помощь*\n\n' +
      '🌹 *Роза цветов* — студия флористики\n\n' +
      '📍 Адрес: д. Званка, ул. Приозёрная, д. 58\n' +
      '📞 Телефон: +7 917 876-59-58\n' +
      '📧 Email: rozacvetov@list.ru\n' +
      '🕐 Режим работы: 9:00 – 21:00\n\n' +
      '🚗 *Доставка:*\n' +
      '• Стоимость доставки — 300₽\n' +
      '• Бесплатно от 3000₽\n\n' +
      '💬 По любым вопросам пишите нам!',
      { parse_mode: 'Markdown' }
    );
  });

  console.log('🤖 Telegram bot started');
}

// Notify user about order status change
export async function notifyOrderStatus(telegramId: string, orderId: number, status: string) {
  if (!bot) return;

  const statusText = statusMessages[status] || status;
  const webAppUrl = process.env.WEBAPP_URL || 'https://rosa-client.vercel.app';

  await bot.sendMessage(telegramId,
    `🌹 *Роза цветов*\n\n` +
    `Заказ #${orderId}\n` +
    `Статус: ${statusText}\n\n` +
    `Спасибо, что выбираете нас! 💐`,
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '📦 Подробнее', web_app: { url: `${webAppUrl}/orders` } }],
        ],
      },
    }
  );
}
