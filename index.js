import express from 'express';
import fs from 'node:fs';
import { RefreshingAuthProvider } from '@donation-alerts/auth';
import { ApiClient } from '@donation-alerts/api';
import { UserEventsClient } from '@donation-alerts/events';
import { getRawData } from '@donation-alerts/common';

// ---------- Настройки из переменных окружения (заполняются в Railway → Variables) ----------
const {
  DA_CLIENT_ID,
  DA_CLIENT_SECRET,
  DA_REDIRECT_URI,
  DISCORD_WEBHOOK_URL,
  SPONSOR_PRICE = '100',
  SUPPORT_MIN_PRICE = '30',
  PORT = 8000,
} = process.env;

const REQUIRED = { DA_CLIENT_ID, DA_CLIENT_SECRET, DA_REDIRECT_URI, DISCORD_WEBHOOK_URL };
for (const [name, val] of Object.entries(REQUIRED)) {
  if (!val) {
    console.warn(`⚠️  Не задана переменная окружения ${name} — заполни её в Railway → Variables`);
  }
}

const SCOPES = ['oauth-user-show', 'oauth-donation-subscribe'];
const TOKENS_FILE = './tokens.json';

// ---------- Простое файловое хранилище токена (переживает только рестарты процесса, не пересборку) ----------
function loadSavedUser() {
  try {
    return JSON.parse(fs.readFileSync(TOKENS_FILE, 'utf8'));
  } catch {
    return null;
  }
}
function saveUser(userId, token) {
  fs.writeFileSync(
    TOKENS_FILE,
    JSON.stringify({ userId, ...token }, null, 2),
  );
}

// ---------- DonationAlerts auth + api ----------
const authProvider = new RefreshingAuthProvider({
  clientId: DA_CLIENT_ID,
  clientSecret: DA_CLIENT_SECRET,
  redirectUri: DA_REDIRECT_URI,
  scopes: SCOPES,
});

authProvider.onRefresh((userId, token) => {
  saveUser(userId, token);
  console.log(`🔄 Токен обновлён для пользователя ${userId}`);
});

const apiClient = new ApiClient({ authProvider });

let currentListener = null;

// ---------- Определяем, на какой тариф похож донат ----------
function detectTariff(amountRub) {
  const sponsorPrice = Number(SPONSOR_PRICE);
  const supportMin = Number(SUPPORT_MIN_PRICE);
  if (amountRub >= sponsorPrice) return `Спонсор (от ${sponsorPrice}₽)`;
  if (amountRub >= supportMin) return `Поддержать команду (от ${supportMin}₽)`;
  return null; // сумма меньше минимальной — не считаем это подтверждённой покупкой тарифа
}

// ---------- Обработка реального доната, пришедшего от DonationAlerts ----------
async function handleDonation(evt) {
  const raw = getRawData(evt); // сырые данные события, поля документированы библиотекой
  const username = raw.username || 'Аноним';
  const message = raw.message || '';
  const amount = raw.amount_in_user_currency ?? raw.amount;
  const currency = raw.currency || 'RUB';

  const tariff = currency === 'RUB' ? detectTariff(amount) : null;

  const payload = {
    username: 'Донаты Clarity',
    embeds: [
      {
        title: tariff ? '✅ Подтверждённый донат' : '💸 Донат (сумма ниже минимального тарифа)',
        color: tariff ? 3066993 : 15105570, // зелёный / оранжевый
        fields: [
          { name: 'От кого', value: username, inline: true },
          { name: 'Сумма', value: `${amount} ${currency}`, inline: true },
          { name: 'Комментарий', value: message || '—' },
          { name: 'Похоже на тариф', value: tariff || 'не определён — проверь вручную' },
        ],
        timestamp: new Date().toISOString(),
        footer: { text: 'Подтверждено DonationAlerts — это реальный оплаченный донат' },
      },
    ],
  };

  const res = await fetch(DISCORD_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok && res.status !== 204) {
    console.error('❌ Discord webhook ответил ошибкой:', res.status, await res.text());
  } else {
    console.log(`✅ Отправлено в Discord: ${username} — ${amount} ${currency}`);
  }
}

// ---------- Запускаем прослушивание донатов конкретного пользователя ----------
async function startListening(userId) {
  if (currentListener === userId) return; // уже слушаем
  currentListener = userId;

  const eventsClient = new UserEventsClient({ user: userId, apiClient });
  eventsClient.onDonation((evt) => {
    handleDonation(evt).catch((err) => console.error('Ошибка обработки доната:', err));
  });

  console.log(`🎧 Слушаю донаты пользователя DonationAlerts #${userId}`);
}

// ---------- Веб-сервер: страница входа + OAuth callback ----------
const app = express();

app.get('/', (req, res) => {
  const saved = loadSavedUser();
  if (saved) {
    res.send(`
      <h1>✅ Бот подключён</h1>
      <p>Слушаю донаты пользователя DonationAlerts ID ${saved.userId}.</p>
      <p><a href="/reauth">Переавторизоваться</a> (если нужно подключить другой аккаунт)</p>
    `);
    return;
  }
  res.send(loginPage());
});

app.get('/reauth', (req, res) => {
  res.send(loginPage());
});

function loginPage() {
  const authorizeUrl =
    `https://www.donationalerts.com/oauth/authorize` +
    `?client_id=${encodeURIComponent(DA_CLIENT_ID || '')}` +
    `&redirect_uri=${encodeURIComponent(DA_REDIRECT_URI || '')}` +
    `&response_type=code` +
    `&scope=${encodeURIComponent(SCOPES.join(' '))}`;
  return `
    <h1>Бот не подключён</h1>
    <p>Нажми кнопку ниже и разреши доступ своему аккаунту DonationAlerts:</p>
    <p><a href="${authorizeUrl}" style="display:inline-block;padding:12px 20px;background:#1F8FCC;color:#fff;border-radius:8px;text-decoration:none;font-weight:700;">Войти через DonationAlerts</a></p>
  `;
}

app.get('/callback', async (req, res) => {
  const { code, error } = req.query;
  if (error) {
    res.status(400).send(`Ошибка авторизации от DonationAlerts: ${error}`);
    return;
  }
  if (!code) {
    res.status(400).send('В ссылке нет параметра code — попробуй пройти авторизацию заново с главной страницы.');
    return;
  }
  try {
    const tokenWithUserId = await authProvider.addUserForCode(code);
    saveUser(tokenWithUserId.userId, tokenWithUserId);
    await startListening(tokenWithUserId.userId);
    res.send(`<h1>✅ Готово!</h1><p>Бот подключён и уже слушает донаты. Можешь закрыть эту страницу.</p>`);
  } catch (err) {
    console.error('Ошибка обмена code на токен:', err);
    res
      .status(500)
      .send(
        `Не получилось обменять код на токен: ${err.message}. ` +
          `Скорее всего, код уже устарел (живёт пару минут) — вернись на <a href="/">главную</a> и попробуй снова.`,
      );
  }
});

app.get('/health', (req, res) => res.send('ok'));

app.listen(PORT, () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);

  // Если токен уже сохранён с прошлого раза — сразу начинаем слушать
  const saved = loadSavedUser();
  if (saved && DA_CLIENT_ID && DA_CLIENT_SECRET) {
    authProvider.addUser(saved.userId, saved);
    startListening(saved.userId).catch((err) => console.error('Не удалось запустить прослушивание:', err));
  }
});
