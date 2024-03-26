type SheetId = string;
type ChatId = string;

type Environment = "development" | "production";

type BotCommand<T> = {
	pattern: RegExp;
	getHandler: (params: T) => (msg: TelegramBot.Message) => Promise<unknown>;
};

type ChatConfig = {
	chatId: ChatId;
	spreadsheetId: SheetId;
	// active means that the user ran the /start command, so the bot is interacting with the chat
	isActive: boolean;
};
