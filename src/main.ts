import 'dotenv/config';
import { getGoogleSheetClient } from './google';
import { CategoriesCommand } from './commands/categories/categories';
import { fetchCategories } from './commands/categories/fetch';
import { CONFIG } from './config/config';
import { getBot } from './telegram';
import { StartCommand } from './commands/start';
import { AddExpenseCommand } from './commands/expenses/add-expense';
import { AddExpenseQuickCommand } from './commands/expenses/add-expense-quick';

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
MANDATORY
- TODO: rendere il bot generico
  - /start <sheetId> -> salva chatId-spreadsheetId
  - /stop -> cancella chatId-spreadsheetId
  - potremmo tenere questa mappa/stato (chatId-sheetId) in un altro sheetId, con un po' di "cache" per accessi continui (tipo 5/10m)
  - dobbiamo anche caricare le categorie per ogni messaggio in base alla chat dal sheet giusto (anche qui "cacheando un po'")
- TODO: dire a botfather cosa può fare e cambiare icona al bot
- TODO: action to deploy on merge to master
  - sarebbe figo se il bot mandasse un messaggio su una chat hardcodata (mia) quando è stato deployato (più facile di quando sembra, mess quando parte se è in prod mode)
  - auto bump version e print della versione quando si aggiorna?
- TODO: Analytics
  - quante spese aggiunte
  - in quante chat attivo
- TODO: /help per capire come funziona (anche come condividere il sheet al bot)

- TODO: vedere altri todo del progetto, tipo typo tolerant sarebbe figo

FUTURE:
- TODO: come gestiamo le spese ricorrenti?
  - TODO: posso farmi mandare dei reminder dal bot? per esempio per le spese ricorrenti?
- TODO: messaggio ricorrente settimanale o mensile per un resoconto? (da attivare in chat)
  - sarebbe fighissimo ricevere il resoconto anche in Grafico a torta tipo
- TODO: possiamo anche parsare i vocali e rispondere a quelli?

OPTIONAL:
- TODO: funzione per aggiungere una categoria o sotto categoria ?
- TODO: comando bot per aggiungere una categoria o sottocategoria (e aggiornare la lista corrente) -> tricky, bisogna risettare "allCategories" se uno lancia sto comando
- TODO: - alias /a per "aggiungi"?
- TODO: - alias /av per "aggiungi veloce"?
- TODO: rendere le risposte un po' varie (fatto, spesa aggiunta, ho aggiunto la spesa x, etc...)
- TODO: - better log management, .info sempre e .debug solo per dev?
*/

const main = async () => {
  const googleSheetClient = await getGoogleSheetClient({
    clientEmail: GOOGLE_SECRET_CLIENT_EMAIL,
    privateKey: GOOGLE_SECRET_PRIVATE_KEY,
  });

  const allCategories = await fetchCategories(
    googleSheetClient,
    CONFIG.sheetId
  );

  const bot = await getBot(TELEGRAM_SECRET, ENVIRONMENT);
  console.log(`Bot up and listening. Environment ${ENVIRONMENT}`);

  // TODO: do we want to attach a generic listener just to log incoming msg?
  bot.on('message', (msg) => {
    console.log('Received message', msg.text);
  });

  bot.onText(StartCommand.pattern, StartCommand.getHandler(bot));

  bot.onText(
    AddExpenseCommand.pattern,
    AddExpenseCommand.getHandler(bot, allCategories, googleSheetClient)
  );

  bot.onText(
    AddExpenseQuickCommand.pattern,
    AddExpenseQuickCommand.getHandler(bot, googleSheetClient)
  );

  bot.onText(
    CategoriesCommand.pattern,
    CategoriesCommand.getHandler(bot, allCategories)
  );
};
main();
