import 'dotenv/config';
import { ExpenseRow, getGoogleSheetClient, writeGoogleSheet } from './google';
import { fromMsg } from './utils';
import { CategoriesCommand } from './commands/categories/categories';
import { Category, fetchCategories } from './commands/categories/fetch';
import { CONFIG } from './config/config';
import { getBot } from './telegram';
import { StartCommand } from './commands/start';

// TODO: don't push the config files, should we remove them?
const TELEGRAM_SECRET = process.env.TELEGRAM_SECRET;
const GOOGLE_SECRET_CLIENT_EMAIL = process.env.GOOGLE_SECRET_CLIENT_EMAIL;
const GOOGLE_SECRET_PRIVATE_KEY = process.env.GOOGLE_SECRET_PRIVATE_KEY;

if (
  !TELEGRAM_SECRET ||
  !GOOGLE_SECRET_CLIENT_EMAIL ||
  !GOOGLE_SECRET_PRIVATE_KEY
) {
  throw new Error('Missing environment variables, please check the .env file');
}

// TODO: funzione per aggiungere una categoria o sotto categoria
// TODO: comando bot per aggiungere una categoria o sottocategoria (e aggiornare la lista corrente) -> tricky, bisogna risettare "allCategories" se uno lancia sto comando
// TODO: comando per aggiungere una spesa
//  - /aggiungi <importo> <descrizione> <categoria>? <sottocategoria>? -> verifica categoria e sottocategoria, se vanno bene mette la spesa
//  - /aggiungi <importo> <descrizione> -> chiede la categoria e la sottocategoria
// TODO: - alias con /a
//  - /aggiungi <importo> <descrizione> <categoria> -> chiede la sottocategoria
//  - /aggiungi veloce <importo> <descrizione>
// TODO: - alias con /av ?
// TODO: come gestiamo le spese ricorrenti?
// TODO: posso farmi mandare dei reminder dal bot? per esempio per le spese ricorrenti?
// TODO: messaggio ricorrente settimanale o mensile per un resoconto?
//  - sarebbe fighissimo ricevere il resoconto anche in Grafico a torta tipo
// TODO: unit test
// TODO: come rendiamo il BOT privato? comando /password? oppure check sulla chatId/userId?
//  - oppure *se si può* farlo generico, ogni "chat" deve attivarlo, il bot si salva chatId-spreadsheetId e lo facciamo generico
// TODO: possiamo anche parsare i vocali e rispondere a quelli?
// TODO: dire a botfather cosa può fare e cambiare icona al bot
// TODO: rendere le risposte un po' varie (fatto, spesa aggiunta, ho aggiunto la spesa x, etc...)
// TODO: vedere altri todo del progetto, tipo typo tolerant sarebbe figo

const main = async () => {
  const googleSheetClient = await getGoogleSheetClient({
    clientEmail: GOOGLE_SECRET_CLIENT_EMAIL,
    privateKey: GOOGLE_SECRET_PRIVATE_KEY,
  });

  const allCategories = await fetchCategories(
    googleSheetClient,
    CONFIG.sheetId
  );
  const categoriesFlat = allCategories.map((c) => c.name);

  const bot = getBot(TELEGRAM_SECRET);

  // TODO: do we want to attach a generic listener just to log incoming msg?

  bot.onText(StartCommand.pattern, StartCommand.getHandler(bot));

  bot.onText(/^aggiungi/i, async (msg) => {
    const { chatId, tokens, date } = fromMsg(msg);

    if (tokens.length < 3) {
      bot.sendMessage(
        chatId,
        `Per aggiungere una spesa, scrivere\n
aggiungi <importo> <descrizione> <categoria>? <sottocategoria>?\n\n
Se invece vuoi aggiungere velocemente una spesa non categorizzandola, scrivi\n
aggiungi veloce <importo> <descrizione>\n`
      );
      return;
    }

    const amount = parseFloat(tokens[1]);
    if (isNaN(amount)) {
      bot.sendMessage(
        chatId,
        `L'importo dev'essere un numbero. Un esempio per inserire una spesa è:\n
aggiungi 7.50 aperitivo`
      );
      return;
    }
    // const description = tokens[2]; // TODO: this is wrong, description can be long

    const secondLastToken = tokens[tokens.length - 2];
    const lastToken = tokens[tokens.length - 1];
    if (categoriesFlat.includes(lastToken)) {
      // last token is a category. if that category have no subcategories, we can add
      // the expense, otherwise we need to show the subcategories
      const category = allCategories.find((c) => c.name === lastToken)!;
      if (category.subCategories.length === 0) {
        // the category doesn't have any subcategories, we can add the expense
        let formattedDate = date.toLocaleDateString('it-IT');
        const description = tokens.slice(2, tokens.length - 1).join(' ');
        const expense: [ExpenseRow] = [
          [formattedDate, amount, category.name, '', description],
        ];
        try {
          await writeGoogleSheet({
            client: googleSheetClient,
            sheetId: CONFIG.sheetId,
            tabName: CONFIG.tabName,
            range: CONFIG.range,
            data: expense,
          });
          bot.sendMessage(chatId, 'Fatto');
        } catch (e) {
          bot.sendMessage(
            chatId,
            `C\è stato un problema, reinserisci la spesa\n\nErrore:\n${e}`
          );
        }
        return;
      } else {
        // we need to show the subcategories and then add the expense
        bot.sendMessage(chatId, 'Scegli una sottocategoria', {
          reply_markup: {
            keyboard: category.subCategories.map((sc) => [{ text: sc.name }]),
            one_time_keyboard: true,
          },
        });
        bot.once('message', async (msg) => {
          const subCategory = category.subCategories.find(
            (sc) => sc.name === msg.text
          );
          if (!subCategory) {
            bot.sendMessage(
              chatId,
              'Cè stato un problema, reinserisci la spesa'
            );
            return;
          }

          // we got everything, add the expense
          let formattedDate = date.toLocaleDateString('it-IT');
          const description = tokens.slice(2, tokens.length - 1).join(' ');
          const expense: [ExpenseRow] = [
            [
              formattedDate,
              amount,
              category.name,
              subCategory.name,
              description,
            ],
          ];
          try {
            await writeGoogleSheet({
              client: googleSheetClient,
              sheetId: CONFIG.sheetId,
              tabName: CONFIG.tabName,
              range: CONFIG.range,
              data: expense,
            });
            bot.sendMessage(chatId, 'Fatto');
            return;
          } catch (e) {
            bot.sendMessage(
              chatId,
              `C\è stato un problema, reinserisci la spesa\n\nErrore:\n${e}`
            );
            return;
          }
        });
      }
    }
    if (categoriesFlat.includes(secondLastToken)) {
      // second last token is a category, need to check if last token is a subcategory
      const category = allCategories.find((c) => c.name === secondLastToken)!;
      const subCategory = category.subCategories.find(
        (sc) => sc.name === lastToken
      );
      // TODO: it would be nice to have some kind of tollerancae to typos
      if (!subCategory) {
        // last token is not a subcategory, send an error message
        bot.sendMessage(
          chatId,
          `Non sono riuscito ad individuare la categoria e sotto categoria, reinserisci la spesa`
        );
        return;
      }

      // we got everything, add the expense
      let formattedDate = date.toLocaleDateString('it-IT');
      const description = tokens.slice(2, tokens.length - 2).join(' ');
      const expense: [ExpenseRow] = [
        [formattedDate, amount, category.name, subCategory.name, description],
      ];
      try {
        await writeGoogleSheet({
          client: googleSheetClient,
          sheetId: CONFIG.sheetId,
          tabName: CONFIG.tabName,
          range: CONFIG.range,
          data: expense,
        });
        bot.sendMessage(chatId, 'Fatto');
        return;
      } catch (e) {
        bot.sendMessage(
          chatId,
          `C\è stato un problema, reinserisci la spesa\n\nErrore:\n${e}`
        );
        return;
      }
    }

    const description = tokens.slice(2, tokens.length).join(' ');
    // the user wants to add the expense, but he didn't specify the category and subcategory
    // we need to show the category list (and after the subcategories based on his response)
    bot.sendMessage(chatId, 'Scegli una categoria', {
      reply_markup: {
        keyboard: allCategories.map((c) => [{ text: c.name }]),
        one_time_keyboard: true,
      },
    });
    bot.once('message', async (msg) => {
      const category = allCategories.find((c) => c.name === msg.text);
      if (!category) {
        bot.sendMessage(chatId, 'Cè stato un problema, reinserisci la spesa');
        return;
      }

      // now, if there are subcategories, show them, otherwise add the expense

      if (category.subCategories.length === 0) {
        // the category doesn't have any subcategories, we can add the expense
        let formattedDate = date.toLocaleDateString('it-IT');
        const expense: [ExpenseRow] = [
          [formattedDate, amount, category.name, '', description],
        ];
        try {
          await writeGoogleSheet({
            client: googleSheetClient,
            sheetId: CONFIG.sheetId,
            tabName: CONFIG.tabName,
            range: CONFIG.range,
            data: expense,
          });
          bot.sendMessage(chatId, 'Fatto');
          return;
        } catch (e) {
          bot.sendMessage(
            chatId,
            `C\è stato un problema, reinserisci la spesa\n\nErrore:\n${e}`
          );
          return;
        }
      }

      // the category has subcategories, we need to show them
      bot.sendMessage(chatId, 'Scegli una sottocategoria', {
        reply_markup: {
          keyboard: category.subCategories.map((sc) => [{ text: sc.name }]),
          one_time_keyboard: true,
        },
      });
      bot.once('message', async (msg) => {
        const subCategory = category.subCategories.find(
          (sc) => sc.name === msg.text
        );
        if (!subCategory) {
          bot.sendMessage(chatId, 'Cè stato un problema, reinserisci la spesa');
          return;
        }

        // we got everything, add the expense
        let formattedDate = date.toLocaleDateString('it-IT');
        const expense: [ExpenseRow] = [
          [formattedDate, amount, category.name, subCategory.name, description],
        ];
        try {
          await writeGoogleSheet({
            client: googleSheetClient,
            sheetId: CONFIG.sheetId,
            tabName: CONFIG.tabName,
            range: CONFIG.range,
            data: expense,
          });
          bot.sendMessage(chatId, 'Fatto');
          return;
        } catch (e) {
          bot.sendMessage(
            chatId,
            `C\è stato un problema, reinserisci la spesa\n\nErrore:\n${e}`
          );
          return;
        }
      });
    });
  });

  bot.onText(
    CategoriesCommand.pattern,
    CategoriesCommand.getHandler(bot, allCategories)
  );
};
main();
