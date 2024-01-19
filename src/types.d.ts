type SheetId = string;

type Environment = 'development' | 'production';

type BotCommand = {
  pattern: RegExp;
  getHandler: (
    ...params: any[]
  ) => (msg: TelegramBot.Message) => Promise<unknown>;
};
