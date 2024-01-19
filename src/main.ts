import 'dotenv/config';
import { getGoogleSheetClient } from './google';
import { CategoriesCommand } from './commands/categories/categories';
import { fetchCategories } from './commands/categories/fetch';
import { CONFIG } from './config/config';
import { getBot } from './telegram';
import { StartCommand } from './commands/start';
import { AddExpenseCommand } from './commands/expenses/add-expense';

// TODO: don't push the config files, should we remove them?
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
TODO: funzione per aggiungere una categoria o sotto categoria ?
TODO: comando bot per aggiungere una categoria o sottocategoria (e aggiornare la lista corrente) -> tricky, bisogna risettare "allCategories" se uno lancia sto comando
TODO: - alias con /a per aggiungi?
 - /aggiungi <importo> <descrizione> <categoria> -> chiede la sottocategoria
TODO: - /aggiungi veloce <importo> <descrizione> -> aggiunge la spesa con categoria NON_CATEGORIZZATA
TODO: - alias con /av ?
TODO: come gestiamo le spese ricorrenti?
TODO: posso farmi mandare dei reminder dal bot? per esempio per le spese ricorrenti?
TODO: messaggio ricorrente settimanale o mensile per un resoconto?
 - sarebbe fighissimo ricevere il resoconto anche in Grafico a torta tipo
TODO: unit test
TODO: come rendiamo il BOT privato? comando /password? oppure check sulla chatId/userId?
 - oppure *se si può* farlo generico, ogni "chat" deve attivarlo, il bot si salva chatId-spreadsheetId e lo facciamo generico
  TODO: Provato -> condividendo il foglio al bot, il bot può scrivere in più sheets, quindi può essere "generico"
    - per farlo generico servirebbe un comando di /start in cui si passa l'ID del foglio.
      il bot dovrebbe salvarsi da qualche parte una mappa chatId-spreadsheetId e poi in base
      ai messaggi che arrivano dovrebbe scrivere sul foglio giusto
      - potremmo tenere questa mappa/stato in un altro sheetId, con un po' di "cache" per accessi continui (tipo 5/10m)
TODO: possiamo anche parsare i vocali e rispondere a quelli?
TODO: dire a botfather cosa può fare e cambiare icona al bot
TODO: rendere le risposte un po' varie (fatto, spesa aggiunta, ho aggiunto la spesa x, etc...)
TODO: vedere altri todo del progetto, tipo typo tolerant sarebbe figo
TODO: deploy on lambda
  TODO: dev bot per development?
  TODO: how to make bot available in dev? should we use polling in dev or something like ngrok?
TODO: action to deploy on merge to master
*/

const main = async () => {
  const googleSheetClient = await getGoogleSheetClient({
    clientEmail: GOOGLE_SECRET_CLIENT_EMAIL,
    privateKey: GOOGLE_SECRET_PRIVATE_KEY,
  });

  // TODO: what if a category changes? We should probably load them at every message (caching for a while)
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
    CategoriesCommand.pattern,
    CategoriesCommand.getHandler(bot, allCategories)
  );
};
main();
