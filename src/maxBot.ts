import { Bot, Context } from '@maxhub/max-bot-api';

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

  const welcomeText =
    `Добро пожаловать в Роза цветов!\n\n` +
    `Мы -- студия стабилизированной флористики. Живые цветы, которые не вянут. Букеты, которые остаются надолго.\n\n` +
    `Что мы предлагаем:\n` +
    `- Стабилизированные композиции\n` +
    `- Доставка по городу за 1-3 часа\n` +
    `- Кэшбэк 5% бонусами с каждого заказа\n\n` +
    `д. Званка, ул. Приозёрная, д. 58\n` +
    `+7 917 876-59-58\n` +
    `Ежедневно 9:00 - 21:00\n\n` +
    `Нажмите кнопку «Открыть» внизу, чтобы перейти в магазин.`;

  // /start
  maxBot.command('start', async (ctx: Context) => {
    const name = ctx.message?.sender?.name || (ctx as any).user?.name || 'друг';
    await ctx.reply(`Привет, ${name}!\n\n${welcomeText}`);
  });

  // /catalog
  maxBot.command('catalog', async (ctx: Context) => {
    await ctx.reply('Каталог композиций\n\nНажмите кнопку «Открыть» внизу, чтобы перейти в каталог.');
  });

  // /orders
  maxBot.command('orders', async (ctx: Context) => {
    await ctx.reply('Мои заказы\n\nНажмите кнопку «Открыть» внизу, чтобы посмотреть заказы.');
  });

  // /bonus
  maxBot.command('bonus', async (ctx: Context) => {
    await ctx.reply(
      'Бонусная программа\n\n' +
      'Как это работает:\n' +
      '- 5% кэшбэк с каждого оплаченного заказа\n' +
      '- Бонусами можно оплатить до 20% заказа\n' +
      '- 1 бонус = 1 рубль\n\n' +
      'Нажмите кнопку «Открыть» внизу, чтобы увидеть баланс.',
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
  maxBot.on('bot_started', async (ctx: Context) => {
    const name = (ctx as any).user?.name || 'друг';
    console.log(`[Max] bot_started event from user: ${name} (id: ${(ctx as any).user?.user_id})`);
    await ctx.reply(`Привет, ${name}!\n\n${welcomeText}`);
  });

  // Handle text messages (not commands) — friendly redirect
  maxBot.on('message_created', async (ctx: Context) => {
    const text = ctx.message?.body?.text;
    if (text && !text.startsWith('/')) {
      await ctx.reply(
        'Чтобы заказать букет, нажмите кнопку «Открыть» внизу экрана.\n\n' +
        'Если у вас вопрос -- звоните: +7 917 876-59-58',
      );
    }
  });

  try {
    await maxBot.start();
    console.log('Max bot started');
  } catch (err: any) {
    console.error(`Max bot startup failed: ${err.message || err}`);
    maxBot = null;
  }
}

// === Notification functions for Max users ===

export async function maxNotifyOrderStatus(maxId: string, orderId: number, status: string) {
  if (!maxBot) return;

  const statusTemplates: Record<string, { title: string; body: string }> = {
    confirmed: {
      title: 'Заказ подтверждён!',
      body: `Ваш заказ #${orderId} подтверждён.\nМы уже готовимся к его сборке.`,
    },
    preparing: {
      title: 'Собираем ваш букет!',
      body: `Ваш заказ #${orderId} уже в работе!\nНаш флорист с любовью собирает композицию.`,
    },
    delivering: {
      title: 'Заказ в пути!',
      body: `Ваш заказ #${orderId} уже едет!\nКурьер выехал и скоро будет по указанному адресу.`,
    },
    completed: {
      title: 'Заказ доставлен!',
      body: `Ваш заказ #${orderId} успешно выполнен!\nНадеемся, букет принесёт радость!\nСпасибо, что выбираете Роза цветов!`,
    },
    canceled: {
      title: 'Заказ отменён',
      body: `Ваш заказ #${orderId} был отменён.\nЕсли это по ошибке -- звоните: +7 917 876-59-58`,
    },
  };

  const template = statusTemplates[status];
  const text = template
    ? `${template.title}\n\n${template.body}`
    : `Заказ #${orderId}\nСтатус: ${status}`;

  try {
    await maxBot.api.sendMessageToUser(Number(maxId), text);
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
    await maxBot.api.sendMessageToUser(Number(maxId), text);
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

  const priceFormatted = totalPrice.toLocaleString('ru-RU');

  let text = `Оплата получена!\n\nЗаказ #${orderId}\n`;

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
    await maxBot.api.sendMessageToUser(Number(maxId), text);
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
