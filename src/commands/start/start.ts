import type TelegramBot from "node-telegram-bot-api";
import type { CONFIG_TYPE } from "../../config/config";
import type { Logger } from "../../logger";
import type { GoogleService } from "../../services/google";
import type { ChatsConfigurationUseCase } from "../../use-cases/chats-configuration";
import { fromMsg } from "../../utils";

const STARTED_MSG = `Ciao! Sono il tuo bot personal per il tracciamento delle spese e mi sono collegato al tuo foglio di calcolo.

Per aggiungere una spesa, puoi usare questi comandi (non hanno lo slash davanti per essere più veloci da utilizzare):

- aggiungi <quantità> <descrizione> <categoria> <sotto-categoria>
  Un esempio può essere (ipotizzando che cibo sia una tua categoria e ristorante una sotto-categoria di cibo):
  aggiungi 10.5 pranzo con colleghi cibo ristorante
- aggiungi veloce 20 pranzo con colleghi

quest'ultimo comando aggiunge la spesa ma senza associarci una categoria.

Se non ti ricordi le tue categorie, puoi sempre chiedere al bot con il comando /categorie.

Ricorda che le tue spese saranno tracciate nel foglio di calcolo da te scelto, puoi sempre andare a modificare le tue spese lì.

Se vuoi smettere di tracciare le spese scrivi /stop
`;

const NO_SHEET_ID_MSG = `Devi specificare un id di foglio di calcolo. Esempio: /start sheet-id
Se non sai come ottenerlo, leggi [qui](https://albertodeago.github.io/despesas-bot/)`;

const CANT_READ_SHEET_MSG = `Non riesco a leggere il foglio di calcolo.
Assicurati che l'id sia corretto e che io abbia i permessi per leggerlo.`;

type StartCommandHandlerProps = {
	bot: TelegramBot;
	googleService: GoogleService;
	config: Pick<CONFIG_TYPE, "ADMINISTRATION_CHAT_ID" | "EXPENSES">;
	chatsConfigUC: ChatsConfigurationUseCase;
	logger: Logger;
};
export const StartCommand: BotCommand<StartCommandHandlerProps> = {
	pattern: /\/start \S+$/,
	getHandler({ bot, googleService, config, chatsConfigUC, logger }) {
		return async (msg: TelegramBot.Message) => {
			const { chatId, strChatId, tokens } = fromMsg(msg);
			logger.info(`StartCommand handler. Tokens ${tokens}`, strChatId);

			if (tokens.length < 2) {
				bot.sendMessage(chatId, NO_SHEET_ID_MSG, { parse_mode: "Markdown" });
				return;
			}

			const sheetId = tokens[1];
			// attempt to read something from the sheet to validate it
			// if it fails, we should inform the user and return
			try {
				await googleService.readGoogleSheet({
					sheetId,
					tabName: config.EXPENSES.TAB_NAME,
					range: "A1",
				});

				const newChatConfig = {
					chatId: strChatId,
					spreadsheetId: sheetId,
					isActive: true,
				};
				// sheet is ok, check if we already have the chatId in the ChatConfig
				// if we do, update the row, otherwise add a new row
				const isInConfig = await chatsConfigUC.isChatInConfiguration(strChatId);

				if (isInConfig) {
					// we need to update the row and set to active
					await chatsConfigUC.updateChatInConfiguration(
						`${chatId}`,
						newChatConfig,
					);
				} else {
					// new chat, we need to add a row in the config
					await chatsConfigUC.addChatToConfiguration(newChatConfig);
				}

				bot.sendMessage(chatId, STARTED_MSG, { parse_mode: "Markdown" });
				bot.sendMessage(
					config.ADMINISTRATION_CHAT_ID,
					`Bot started for chat ${strChatId}`,
				);
				return;
			} catch (e) {
				const err = new Error(
					`Error while handling the start command ${sheetId}: ${e}`,
				);
				logger.sendError(err, strChatId);

				bot.sendMessage(chatId, CANT_READ_SHEET_MSG);
				return;
			}
		};
	},
};
