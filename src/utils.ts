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

/**
 * This function first counts the occurrences of each character in both strings.
 * Then it iterates over the counts and adds the absolute difference between the
 * counts in the two strings to the total difference count. If a character is
 * present in one string but not the other, it adds the count from the string
 * where the character is present to the total difference count.
 * Finally, it returns the total difference count.
 */
export function getDifference(s: string, t: string): number {
	const sCount: { [key: string]: number } = Array.from(s).reduce(
		(count: { [key: string]: number }, char) => {
			count[char] = (count[char] || 0) + 1;
			return count;
		},
		{},
	);

	const tCount: { [key: string]: number } = Array.from(t).reduce(
		(count: { [key: string]: number }, char) => {
			count[char] = (count[char] || 0) + 1;
			return count;
		},
		{},
	);

	let diffCount = 0;

	for (const char in sCount) {
		if (tCount[char]) {
			diffCount += Math.abs(sCount[char] - tCount[char]);
		} else {
			diffCount += sCount[char];
		}
	}

	for (const char in tCount) {
		if (!sCount[char]) {
			diffCount += tCount[char];
		}
	}

	return diffCount;
}

export const includesConsideringTypo = (
	categories: string[],
	text: string,
): string | false => {
	const distance = 2; // hardcoded distance for now
	const lowerCaseText = text.toLowerCase();

	// first try to hard match the item
	const match = categories.find(
		(category) => category.toLowerCase() === lowerCaseText,
	);
	if (match) {
		return match;
	}

	// didn't match, let's try to find a close one
	for (const category of categories) {
		if (category.toLowerCase() === lowerCaseText) {
			return category;
		}

		if (getDifference(category.toLowerCase(), lowerCaseText) <= distance) {
			return category;
		}
	}

	return false;
};

export const filterNullish = <T>(item: T | null | undefined): item is T =>
	item !== null && item !== undefined;
