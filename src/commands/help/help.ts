import TelegramBot from 'node-telegram-bot-api';
import { fromMsg } from '../../utils';
import { Logger } from '../../logger';

const HELP_MSG = `Ciao, sono 🌵DespesasBot🌮 e sarò il bot per gestire le tue spese
Utilizzandomi potrai facilmente tracciare le tue spese e tenerle in un *tuo* google spreadsheet

Tutto ciò che devi fare è scritto in [questa guida](https://albertodeago.github.io/despesas-bot/)

In pratica devi condividere alla mia email (che è \`despesasserviceaccount@despesasbot.iam.gserviceaccount.com\`) il tuo google spreadsheet (dandomi diritti di scrittura/editor altrimenti non potrò scriverci) e poi usare il comando \`/start <spreadsheet_id>\`
Ricorda che lo spreadsheet deve avere una certa struttura, nel link sopra c'è scritto tutto

Ricorda che sono opensource e puoi trovare tutto il codice [qui](https://github.com/albertodeago/despesas-bot), quindi puoi verificare tu stesso che le spese che traccerai sono salvate *solo e soltando* nel tuo google spreadsheet

Se hai una richiesta di funzionalità o un dubbio, puoi aprire una issue, ma considera che il bot è stato fatto per come il mio gringo mi voleva, e il mio gringo lo mantiene nel tuo tempo libero, quindi non aspettarti per forza una risposta veloce o che tutto sia implementato

Dopo che avrai lanciato il comando \`/start\`, puoi utilizzare gli altri comandi:
- \`/stop\` 👉 per smettere di tracciare le spese
- \`/categorie\` 👉 per avere la lista delle tue categorie
- \`aggiungi 20 pizza con colleghi cibo ristorante\` 👉 esempio per tracciare una spesa (cibo e ristorante sono rispettivamente categoria e sotto-categoria)
- \`aggiungi 20 pizza con colleghi\` 👉 il bot ti chiederà in maniera interattiva come categorizzare la spesa
- \`aggiungi veloce 20\` 👉 esempio per tracciare una spesa velocemente, senza assegnare una categoria
- \`/help\` 👉 per riavere questo messaggio!
`;

type HelpCommandHandlerProps = {
  bot: TelegramBot;
  logger: Logger;
};
export const HelpCommand: BotCommand<HelpCommandHandlerProps> = {
  pattern: /\/help/,
  getHandler({ bot, logger }) {
    return async (msg: TelegramBot.Message) => {
      const { chatId, strChatId } = fromMsg(msg);
      logger.info(`HelpCommand handler.`, strChatId);

      bot.sendMessage(chatId, HELP_MSG, { parse_mode: 'Markdown' });
    };
  },
};
