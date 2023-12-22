import TelegramBot from 'node-telegram-bot-api';
import type { ExpenseRow } from './google';

export const fromMsg = (msg: TelegramBot.Message) => {
  const tokens = msg.text?.split(' ') ?? [];

  return {
    chatId: msg.chat.id,
    messageText: msg.text,
    date: new Date(msg.date * 1000),
    tokens,
  };
};

type CreateExpenseRowParams = {
  date: string;
  amount: number;
  categoryName: string;
  subCategoryName?: string;
  description?: string;
};
export const createExpenseRow = ({
  date,
  amount,
  categoryName,
  subCategoryName,
  description,
}: CreateExpenseRowParams): [ExpenseRow] => {
  return [
    [date, amount, categoryName, subCategoryName ?? '', description ?? ''],
  ];
};

export const getDescriptionFromTokenizedMessage = (
  tokens: string[],
  tokensFromRight: number = 1
) => tokens.slice(2, tokens.length - tokensFromRight).join(' ');
