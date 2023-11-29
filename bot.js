require('dotenv').config();
const { chromium } = require('playwright');
const TelegramBot = require('node-telegram-bot-api');

const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.CHAT_ID;
const price = 2500000;
const livingArea = 40;
const rooms = 1.5;
const hemnetSite = `https://www.hemnet.se/bostader?price_max=${price}&living_area_min=${livingArea}&rooms_min=${rooms}&item_types%5B%5D=bostadsratt&location_ids%5B%5D=18028`
const bot = new TelegramBot(token, { polling: true });

async function apartmentVariants() {
  const browser = await chromium.launch({
    headless: false
  });
  const page = await browser.newPage();
  try {
    await page.goto(hemnetSite);
    console.log(hemnetSite);
    await page.waitForLoadState("networkidle");

    const dialogPopUp = await page.getByRole('dialog');
    await dialogPopUp.isVisible()
      .then(()=>console.log('Dialog PopUp is here'));

    await page.getByTestId('uc-accept-all-button').click()
      .then(()=> console.log('Accept Dialog popUp'));

    await page.waitForTimeout(3_000);

    await dialogPopUp.isHidden()
      .then(()=> console.log('Dialog popUp is Hidden'));

    const newProperties = await page.evaluate(() => {
      const items = [];

      document.querySelectorAll('.hcl-card').forEach((element, index) => {
        if (index >= 4 && index <= 10) {
          const address = element.querySelector('.hcl-card__title').innerText;
          const price = element.querySelector('.ForSaleAttributes_primaryAttributes__tqSRJ').innerText;
          const area = element.querySelectorAll('.ForSaleAttributes_primaryAttributes__tqSRJ')[1].innerText;
          const rums = element.querySelectorAll('.ForSaleAttributes_primaryAttributes__tqSRJ')[2].innerText;
          const link = element.href;

          items.push({ address, price, area, rums, link });
        }
      });
      return items;
    });
    console.log('newProperties:', newProperties);

    await browser.close();
    return newProperties;
  } catch (error) {
    console.error(`Error posting data: ${error}`);
    await browser.close();
    return [];
  }
}

async function postNewProperties() {
  const today = new Date();
  const day = String(today.getDate()).padStart(2, '0');
  const month = String(today.getMonth() + 1).padStart(2, '0'); // January is 0!
  const year = today.getFullYear();

  const properties = await apartmentVariants();
  await bot.sendMessage(chatId, `Новые квартиры за сегодня \n${day}/${month}/${year}`);

  for (const property of properties) {
    if ( properties[property.address] ) {
      console.log('Уже есть такая квартира');
      console.log(
        property.address,
        '\n',
        property.price
      )
    }
    await bot.sendMessage(chatId, `${property.address}: \n${property.price} \n${property.area} - ${property.rums} \n${property.link}`);
  }
}

// Обработчик для команды /showMe
bot.onText(/\/newApparts|\/command1/, () => {
  bot.sendMessage(chatId, 'Ушел искать новые варианты!');
  postNewProperties();
});
bot.on('message', (msg) => {
  if (msg.text !== undefined && !msg.text.startsWith('/')) {
    bot.sendMessage(chatId, 'Введите команду для выполнения действия.');
  }
});
