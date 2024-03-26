import type TelegramBot from "node-telegram-bot-api";
import type { CONFIG_TYPE } from "../config/config";

// NO_CHAT means that we are logging something that is happening outside of a chat (e.g. startup message)
type ChatIdentifier = ChatId | "NO_CHAT";

export type Logger = ReturnType<typeof initLogger>;

type InitLoggerParams = {
	bot: TelegramBot;
	config: CONFIG_TYPE;
	level: 0 | 1 | 2; // 0 only errors, 1 errors and info, 2 errors, info and debug
};
export const initLogger = ({ bot, config, level }: InitLoggerParams) => {
	const info = (msg: string, chatId: ChatIdentifier) => {
		if (level < 1) return;
		console.info(`${new Date()} - chatId:${chatId} - msg:${msg}`);
	};

	const debug = (msg: string, chatId: ChatIdentifier) => {
		if (level < 2) return;
		console.debug(`${new Date()} - chatId:${chatId} - msg:${msg}`);
	};

	const error = (err: Error, chatId: ChatIdentifier) => {
		console.error(
			`${new Date()} - chatId:${chatId} - msg:${err.message} - trace:${
				err.stack
			}`,
		);
	};

	const sendInfo = (msg: string, chatId: ChatIdentifier) => {
		info(msg, chatId);
		bot.sendMessage(config.ADMINISTRATION_CHAT_ID, msg);
	};

	const sendError = (err: Error, chatId: ChatIdentifier) => {
		error(err, chatId);
		bot.sendMessage(config.ADMINISTRATION_CHAT_ID, `Error: ${err.message}`);
	};

	return {
		info,
		debug,
		error,
		sendInfo,
		sendError,
	};
};
