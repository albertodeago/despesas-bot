import 'dotenv/config';
import { version } from '../package.json';
import { getGoogleSheetClient } from './google';
import { getBot } from './telegram';
import { getConfig } from './config/config';
import { Analytics } from './analytics';

import { Categories } from './use-cases/categories';
import { ChatsConfiguration } from './use-cases/chats-configuration';

import { HelpCommand } from './commands/help/help';
import { StartCommand } from './commands/start/start';
import { StopCommand } from './commands/stop/stop';
import { CategoriesCommand } from './commands/categories/categories';
import { AddExpenseCommand } from './commands/expenses/add-expense';
import { AddExpenseQuickCommand } from './commands/expenses/add-expense-quick';
import { initLogger } from './logger';

const TELEGRAM_SECRET = process.env.TELEGRAM_SECRET;
const GOOGLE_SECRET_CLIENT_EMAIL = process.env.GOOGLE_SECRET_CLIENT_EMAIL;
const GOOGLE_SECRET_PRIVATE_KEY = (
  process.env.GOOGLE_SECRET_PRIVATE_KEY || ''
).replace(/\\n/g, '\n'); // https://stackoverflow.com/questions/74131595/error-error1e08010cdecoder-routinesunsupported-with-google-auth-library

const ENVIRONMENT: Environment =
  process.env.NODE_ENV === 'development' ? 'development' : 'production';

if (
  !TELEGRAM_SECRET ||
  !GOOGLE_SECRET_CLIENT_EMAIL ||
  !GOOGLE_SECRET_PRIVATE_KEY
) {
  throw new Error('Missing environment variables, please check the .env file');
}

/**
MANDATORY TO RELEASE
- TODO: test some actual failure (e.g. start with an invalid id - check others)

FUTURE:
- TODO: [FEATURE] how do we handle recurrent expenses?
  - TODO: [FEATURE] can I turn on some 'reminders' so that the bot help me track recurrent expenses (e.g. monthly bills) (activable in chats)
  - TODO: [FEATURE] add command to add recurrent expenses? (e.g. "aggiungi ricorrente 30 bolletta gas") -> but how do we let the user select when and how frequently?
- TODO: [FEATURE] recurrent message (weekly or monthly) for a report/summary? (activable in chats)
  - it would be pretty cool to send also a report/summary via some pie-charts
- TODO: [FEATURE] can we parse vocals and answer/handle that too?
- TODO: [FEATURE] typo tolerant?

OPTIONAL:
- [CODE_QUALITY] expose a fixture/mock folder/file in each module with a mock version of the module?
- [FEATURE] function to add a category / subcateogory? Do we want to add this kind of "admin" features? (not sure if they are useful, ppl should just edit the spreadsheet manually)
- [FEATURE] alias /a for "aggiungi"?
- [FEATURE] alias /av for "aggiungi veloce"?
- [FEATURE] make answers various (e.g. "fatto", "spesa aggiunta", "ho aggiunto la spesa x", etc...)
- [MAINTENANCE] add an "error tracker" that sends error to my chat or something like that? At least to not be 100% blind
- [CODE_QUALITY] improve project structure, currently it's pretty messy, also, some stuff are classes, some are just functions, meh

Probably a big refactor would make things easier.
If we put just one listener for every message, in that listener we could:
- log request
- check if the msg is to be ignored
- get / refresh the cache for the categories for that chatId
- based on the message, "call" a command or something like that
*/

const main = async () => {
  const config = getConfig(ENVIRONMENT);

  const googleSheetClient = await getGoogleSheetClient({
    clientEmail: GOOGLE_SECRET_CLIENT_EMAIL,
    privateKey: GOOGLE_SECRET_PRIVATE_KEY,
  });

  const bot = await getBot(TELEGRAM_SECRET, ENVIRONMENT);
  const upAndRunningMsg = `Bot v${version} up and listening. Environment ${ENVIRONMENT}`;

  const logger = initLogger({ bot, config, level: 1 });
  const analytics = new Analytics(googleSheetClient, config, logger);

  const categoriesUC = new Categories(googleSheetClient, config, logger);
  const chatsConfigUC = new ChatsConfiguration(
    googleSheetClient,
    config,
    logger
  );

  // On startup we want to inform the admin that the bot is up
  logger.sendInfo(upAndRunningMsg, 'NO_CHAT');

  bot.on('message', (msg): void => {
    logger.info(`Received message: ${msg.text}`, '' + msg.chat.id);
  });

  bot.onText(HelpCommand.pattern, HelpCommand.getHandler({ bot, logger }));

  bot.onText(
    StartCommand.pattern,
    StartCommand.getHandler({
      bot,
      googleSheetClient,
      config,
      chatsConfigUC,
      logger,
    })
  );

  bot.onText(
    StopCommand.pattern,
    StopCommand.getHandler({
      bot,
      chatsConfigUC,
      logger,
    })
  );

  bot.onText(
    AddExpenseCommand.pattern,
    AddExpenseCommand.getHandler({
      bot,
      categoriesUC,
      analytics,
      googleSheetClient,
      config,
      chatsConfigUC,
      logger,
    })
  );

  bot.onText(
    AddExpenseQuickCommand.pattern,
    AddExpenseQuickCommand.getHandler({
      bot,
      googleSheetClient,
      analytics,
      config,
      chatsConfigUC,
      logger,
    })
  );

  bot.onText(
    CategoriesCommand.pattern,
    CategoriesCommand.getHandler({
      bot,
      categoriesUC,
      chatsConfigUC,
      logger,
    })
  );
};
main();
