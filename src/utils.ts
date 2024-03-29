import type TelegramBot from "node-telegram-bot-api";
import type { Category, SubCategory } from "./use-cases/categories";

type ExpenseRow = [
	string,
	number,
	Category["name"],
	SubCategory["name"],
	string,
];

export const fromMsg = (msg: TelegramBot.Message) => {
	const tokens = msg.text?.split(" ") ?? [];

	return {
		chatId: msg.chat.id,
		strChatId: `${msg.chat.id}`,
		messageText: msg.text,
		date: new Date(msg.date * 1000),
		tokens,
	};
};

export const formatDate = (date: Date) => {
	return date.toLocaleDateString("it-IT", {
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	});
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
		[date, amount, categoryName, subCategoryName ?? "", description ?? ""],
	];
};

export const getDescriptionFromTokenizedMessage = (
	tokens: string[],
	tokensFromLeft = 2,
	tokensFromRight = 1,
) => tokens.slice(tokensFromLeft, tokens.length - tokensFromRight).join(" ");

/* Randomize array in-place using Durstenfeld shuffle algorithm */
// This function mutates the array in place AND returns it
export function shuffleArray(array: string[]) {
	for (let i = array.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		const temp = array[i];
		array[i] = array[j];
		array[j] = temp;
	}
	return array;
}
