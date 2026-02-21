import { Bot, Keyboard, Context } from '@maxhub/max-bot-api';

// Helper: create an open_app button (opens Mini App inside Max, not external browser).
// The SDK v0.2.2 doesn't have this type yet, but the Max Bot API supports it.
function openAppButton(text: string, url: string): any {
  return { type: 'open_app', text, web_app: url };
}

let maxBot: Bot | null = null;

export function getMaxBot(): Bot | null {
  return maxBot;
}

export async function startMaxBot() {
  const token = process.env.MAX_BOT_TOKEN;
  if (!token || token.startsWith('placeholder')) {
    console.log('MAX_BOT_TOKEN not set, skipping Max bot start');
    return;
  }

  maxBot = new Bot(token);

  const webAppUrl = process.env.MAX_WEBAPP_URL || process.env.WEBAPP_URL || 'https://rosa-flowers-client.vercel.app';

  // /start
  maxBot.command('start', async (ctx: Context) => {
    const name = ctx.message?.sender?.name || (ctx as any).user?.name || 'друг';

    await ctx.reply(
      `Добро пожаловать в Роза цветов!\n\n` +
      `Привет, ${name}!\n\n` +
      `Мы -- студия стабилизированной флористики. Живые цветы, которые не вянут. Букеты, которые остаются надолго.\n\n` +
      `Что мы предлагаем:\n` +
      `- Стабилизированные композиции\n` +
      `- Доставка по городу за 1-3 часа\n` +
      `- Кэшбэк 5% бонусами с каждого заказа\n\n` +
      `д. Званка, ул. Приозёрная, д. 58\n` +
      `+7 917 876-59-58\n` +
      `Ежедневно 9:00 - 21:00`,
      {
        attachments: [
          Keyboard.inlineKeyboard([
            [openAppButton('Открыть магазин', webAppUrl)],
            [
              openAppButton('Заказы', `${webAppUrl}/orders`),
              openAppButton('Бонусы', `${webAppUrl}/profile`),
            ],
            [Keyboard.button.callback('Помощь', 'help')],
          ]),
        ],
      },
    );
  });

  // /catalog
  maxBot.command('catalog', async (ctx: Context) => {
    await ctx.reply(
      'Каталог композиций\n\n' +
      'Стабилизированные букеты -- живые цветы, которые не вянут. Выбирайте!',
      {
        attachments: [
          Keyboard.inlineKeyboard([
            [openAppButton('Открыть каталог', webAppUrl)],
          ]),
        ],
      },
    );
  });

  // /orders
  maxBot.command('orders', async (ctx: Context) => {
    await ctx.reply(
      'Мои заказы\n\n' +
      'Здесь вы можете отследить статус ваших заказов.',
      {
        attachments: [
          Keyboard.inlineKeyboard([
            [openAppButton('Посмотреть заказы', `${webAppUrl}/orders`)],
          ]),
        ],
      },
    );
  });

  // /bonus
  maxBot.command('bonus', async (ctx: Context) => {
    await ctx.reply(
      'Бонусная программа\n\n' +
      'Как это работает:\n' +
      '- 5% кэшбэк с каждого оплаченного заказа\n' +
      '- Бонусами можно оплатить до 20% заказа\n' +
      '- 1 бонус = 1 рубль\n\n' +
      'Откройте профиль, чтобы увидеть ваш баланс',
      {
        attachments: [
          Keyboard.inlineKeyboard([
            [openAppButton('Мой профиль', `${webAppUrl}/profile`)],
          ]),
        ],
      },
    );
  });

  // /help
  const helpText =
    'Помощь -- Роза цветов\n\n' +
    'Студия стабилизированной флористики\n' +
    'Живые цветы, которые не вянут\n\n' +
    'Адрес: д. Званка, ул. Приозёрная, д. 58\n' +
    'Телефон: +7 917 876-59-58\n' +
    'Email: rozacvetov@list.ru\n' +
    'Режим работы: ежедневно 9:00 - 21:00\n\n' +
    'Доставка:\n' +
    '- По городу -- 500 руб. (1-3 часа)\n' +
    '- Бесплатно от 5 000 руб.\n\n' +
    'Команды бота:\n' +
    '/start -- Главное меню\n' +
    '/catalog -- Каталог букетов\n' +
    '/orders -- Мои заказы\n' +
    '/bonus -- Бонусная программа\n' +
    '/help -- Эта справка\n\n' +
    'По любым вопросам пишите нам в чат!';

  maxBot.command('help', async (ctx: Context) => {
    await ctx.reply(helpText);
  });

  // Welcome message when user opens chat with bot for the first time
  // NOTE: bot_started fires ONCE per user. ctx.message is undefined here —
  // use ctx.user for the user object.
  maxBot.on('bot_started', async (ctx: Context) => {
    const name = (ctx as any).user?.name || 'друг';
    console.log(`[Max] bot_started event from user: ${name} (id: ${(ctx as any).user?.user_id})`);

    await ctx.reply(
      `Добро пожаловать в Роза цветов! 🌹\n\n` +
      `Привет, ${name}!\n\n` +
      `Мы — студия стабилизированной флористики. Живые цветы, которые не вянут. Букеты, которые остаются надолго.\n\n` +
      `Что мы предлагаем:\n` +
      `• Стабилизированные композиции\n` +
      `• Доставка по городу за 1-3 часа\n` +
      `• Кэшбэк 5% бонусами с каждого заказа\n\n` +
      `📍 д. Званка, ул. Приозёрная, д. 58\n` +
      `📞 +7 917 876-59-58\n` +
      `🕘 Ежедневно 9:00 - 21:00`,
      {
        attachments: [
          Keyboard.inlineKeyboard([
            [openAppButton('🛍 Открыть магазин', webAppUrl)],
            [
              openAppButton('📦 Заказы', `${webAppUrl}/orders`),
              openAppButton('⭐ Бонусы', `${webAppUrl}/profile`),
            ],
            [Keyboard.button.callback('❓ Помощь', 'help')],
          ]),
        ],
      },
    );
  });

  // Callback: help button
  maxBot.on('message_callback', async (ctx: Context) => {
    if (ctx.callback?.payload === 'help') {
      await ctx.reply(helpText);
    }
  });

  // Handle text messages (not commands) — friendly redirect
  maxBot.on('message_created', async (ctx: Context) => {
    const text = ctx.message?.body?.text;
    if (text && !text.startsWith('/')) {
      await ctx.reply(
        'Чтобы заказать букет, откройте наш магазин!\n\n' +
        'Если у вас вопрос -- звоните: +7 917 876-59-58',
        {
          attachments: [
            Keyboard.inlineKeyboard([
              [openAppButton('Открыть магазин', webAppUrl)],
            ]),
          ],
        },
      );
    }
  });

  try {
    // Start polling for ALL update types (including bot_started)
    await maxBot.start();
    console.log('Max bot started (polling for all update types including bot_started)');
  } catch (err: any) {
    console.error(`Max bot startup failed: ${err.message || err}`);
    maxBot = null;
  }
}

// === Notification functions for Max users ===

export async function maxNotifyOrderStatus(maxId: string, orderId: number, status: string) {
  if (!maxBot) return;

  const webAppUrl = process.env.MAX_WEBAPP_URL || process.env.WEBAPP_URL || 'https://rosa-flowers-client.vercel.app';

  const statusTemplates: Record<string, { title: string; body: string; buttonText: string }> = {
    confirmed: {
      title: 'Заказ подтверждён!',
      body: `Ваш заказ #${orderId} подтверждён.\nМы уже готовимся к его сборке.`,
      buttonText: 'Детали заказа',
    },
    preparing: {
      title: 'Собираем ваш букет!',
      body: `Ваш заказ #${orderId} уже в работе!\nНаш флорист с любовью собирает композицию.`,
      buttonText: 'Следить за заказом',
    },
    delivering: {
      title: 'Заказ в пути!',
      body: `Ваш заказ #${orderId} уже едет!\nКурьер выехал и скоро будет по указанному адресу.`,
      buttonText: 'Отследить заказ',
    },
    completed: {
      title: 'Заказ доставлен!',
      body: `Ваш заказ #${orderId} успешно выполнен!\nНадеемся, букет принесёт радость!\nСпасибо, что выбираете Роза цветов!`,
      buttonText: 'Заказать ещё',
    },
    canceled: {
      title: 'Заказ отменён',
      body: `Ваш заказ #${orderId} был отменён.\nЕсли это по ошибке -- звоните: +7 917 876-59-58`,
      buttonText: 'Новый заказ',
    },
  };

  const template = statusTemplates[status];
  const text = template
    ? `${template.title}\n\n${template.body}`
    : `Заказ #${orderId}\nСтатус: ${status}`;
  const btnText = template?.buttonText || 'Посмотреть заказ';

  try {
    await maxBot.api.sendMessageToUser(Number(maxId), text, {
      attachments: [
        Keyboard.inlineKeyboard([
          [openAppButton(btnText, `${webAppUrl}/orders`)],
        ]),
      ],
    });
  } catch (e) {
    console.error(`Failed to send Max notification to ${maxId}:`, e);
  }
}

export async function maxNotifyOrderCreated(
  maxId: string,
  orderId: number,
  totalPrice: number,
  itemCount: number,
  deliveryType: string,
  bonusEarned: number,
) {
  if (!maxBot) return;

  const webAppUrl = process.env.MAX_WEBAPP_URL || process.env.WEBAPP_URL || 'https://rosa-flowers-client.vercel.app';
  const deliveryText = deliveryType === 'pickup' ? 'Самовывоз' : 'Доставка';
  const priceFormatted = totalPrice.toLocaleString('ru-RU');

  const text =
    `Заказ оформлен!\n\n` +
    `Заказ #${orderId}\n` +
    `Позиций: ${itemCount}\n` +
    `Сумма: ${priceFormatted} руб.\n` +
    `${deliveryText}\n` +
    (bonusEarned > 0 ? `\nПосле оплаты вам начислится ${bonusEarned} бонусов!\n` : '') +
    `\nОжидайте подтверждения. Мы свяжемся с вами в ближайшее время!`;

  try {
    await maxBot.api.sendMessageToUser(Number(maxId), text, {
      attachments: [
        Keyboard.inlineKeyboard([
          [openAppButton('Мои заказы', `${webAppUrl}/orders`)],
          [openAppButton('Продолжить покупки', webAppUrl)],
        ]),
      ],
    });
  } catch (e) {
    console.error(`Failed to send Max order notification to ${maxId}:`, e);
  }
}

interface OrderItemInfo {
  name: string;
  price: number;
  quantity: number;
}

export async function maxNotifyPaymentSuccess(
  maxId: string,
  orderId: number,
  totalPrice: number,
  bonusEarned: number,
  items?: OrderItemInfo[],
  deliveryType?: string,
  deliveryDate?: string,
  deliveryTime?: string,
  address?: string,
  recipientName?: string,
) {
  if (!maxBot) return;

  const webAppUrl = process.env.MAX_WEBAPP_URL || process.env.WEBAPP_URL || 'https://rosa-flowers-client.vercel.app';
  const priceFormatted = totalPrice.toLocaleString('ru-RU');

  let text = `Оплата получена!\n\nЗаказ #${orderId}\n`;

  // Состав заказа
  if (items && items.length > 0) {
    text += `\nСостав заказа:\n`;
    for (const item of items) {
      const itemTotal = item.price * item.quantity;
      text += `  - ${item.name}`;
      if (item.quantity > 1) text += ` x${item.quantity}`;
      text += ` — ${itemTotal.toLocaleString('ru-RU')} руб.\n`;
    }
  }

  text += `\nИтого: ${priceFormatted} руб.\n`;

  // Доставка
  if (deliveryType === 'delivery') {
    text += `\nДоставка`;
    if (address) text += `: ${address}`;
    text += `\n`;
  } else if (deliveryType === 'pickup') {
    text += `\nСамовывоз\n`;
  }

  if (deliveryDate) {
    text += `Дата: ${deliveryDate}`;
    if (deliveryTime) text += `, ${deliveryTime}`;
    text += `\n`;
  }

  if (recipientName) {
    text += `Получатель: ${recipientName}\n`;
  }

  if (bonusEarned > 0) {
    text += `\nНачислено ${bonusEarned} бонусов на ваш счёт!\n`;
  }

  text += `\nМы уже начинаем собирать ваш букет!`;

  try {
    await maxBot.api.sendMessageToUser(Number(maxId), text, {
      attachments: [
        Keyboard.inlineKeyboard([
          [openAppButton('Статус заказа', `${webAppUrl}/orders`)],
        ]),
      ],
    });
  } catch (e) {
    console.error(`Failed to send Max payment notification to ${maxId}:`, e);
  }
}

export async function maxBroadcastMessage(
  maxIds: string[],
  message: string,
): Promise<{ sent: number; failed: number }> {
  if (!maxBot) return { sent: 0, failed: 0 };

  let sent = 0;
  let failed = 0;

  for (const maxId of maxIds) {
    try {
      await maxBot.api.sendMessageToUser(Number(maxId), message);
      sent++;
      // Rate limit: Max allows 30 rps, add small delay
      if (sent % 25 === 0) {
        await new Promise((r) => setTimeout(r, 1000));
      }
    } catch (err) {
      console.error(`Failed to send Max broadcast to ${maxId}:`, err);
      failed++;
    }
  }

  return { sent, failed };
}
