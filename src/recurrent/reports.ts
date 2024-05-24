import { UNCATEGORIZED_CATEGORY } from "../config/config";
import { getChart } from "./chart/chart";

import type TelegramBot from "node-telegram-bot-api";
import type { Logger } from "../logger";
import type { Expense, ExpenseService } from "../services/expense";
import type { ChatsConfigurationUseCase } from "../use-cases/chats-configuration";

type InitReportsParams = {
	logger: Logger;
	bot: TelegramBot;
	chatsConfigUC: ChatsConfigurationUseCase;
	expenseService: ExpenseService;
};

const CHECK_INTERVAL = 1000 * 60 * 60 * 10; // 10 hours

export const initReports = ({
	logger,
	bot,
	chatsConfigUC,
	expenseService,
}: InitReportsParams) => {
	let interval: NodeJS.Timeout | null = null;
	let lastSentDate = new Date();

	// Check reports
	const check = async () => {
		// 1. check if today is the first day of the month
		// 2. if it's not, return
		// 3. read the chatConfiguration
		// 4. for each *active* chat,
		// 5. gather the expenses of last month
		// 6. create a pie chart with them
		// 7. send the pie chart to the user
		// 8. update the "last-added-date" column in the "report" tab
		logger.debug("Checking reports", "NO_CHAT");

		try {
			// check if today is the first day of the month
			const now = new Date();
			if (now.getDate() !== 1) {
				logger.debug(
					"Today is not the first day of the month, skipping reports",
					"NO_CHAT",
				);
				return;
			}
			const lastSentIsToday =
				new Date().getDate() === lastSentDate.getDate() &&
				new Date().getMonth() === lastSentDate.getMonth() &&
				new Date().getFullYear() === lastSentDate.getFullYear();
			if (lastSentIsToday) {
				logger.debug("Reports already sent today, skipping", "NO_CHAT");
				return;
			}

			// update the last sent date to avoid sending the same report multiple times in the same day
			lastSentDate = new Date();

			const activeChats = (await chatsConfigUC.get()).filter(
				(chat) => chat.isActive,
			);
			for (const chat of activeChats) {
				const strChatId = `${chat.chatId}`;
				logger.debug(
					`Getting last month expenses for chat ${chat.chatId}`,
					strChatId,
				);

				const expenses = await expenseService.getLastMonthExpenses({
					sheetId: chat.spreadsheetId,
				});
				if (expenses.length === 0) {
					return;
				}

				const { totalExpense, expensesByCategory, expensesBySubCategory } =
					getExpenseGrouped(expenses);

				// get last month name
				const lastMonthDate = new Date(
					now.getFullYear(),
					now.getMonth() - 1,
					15,
				);
				const lastMonthName = lastMonthDate.toLocaleString("it", {
					month: "long",
				});

				// send a text msg with the prev month expenses, markdown table
				const categoryMsg = getCategoryReportMsg({
					lastMonthName,
					totalExpense,
					expensesByCategory,
				});
				bot.sendMessage(chat.chatId, categoryMsg, { parse_mode: "Markdown" });

				// create the pie chart and send it to the user
				const chartByCategory = await getChart({
					chartName: `Spese di ${lastMonthName} per categoria`,
					labels: Object.keys(expensesByCategory),
					data: Object.values(expensesByCategory),
				});
				bot.sendPhoto(
					chat.chatId,
					chartByCategory,
					{},
					{
						filename: `Spese per categoria di ${lastMonthName}.png`,
						contentType: "application/octet-stream",
					},
				);

				// send a text msg with the prev month expenses, markdown table
				const subCategoryMsg = getSubCategoryReportMsg({
					totalExpense,
					expensesBySubCategory,
				});
				bot.sendMessage(chat.chatId, subCategoryMsg, {
					parse_mode: "Markdown",
				});

				// create the pie chart and send it to the user
				const chartBySubCategory = await getChart({
					chartName: `Spese di ${lastMonthName} per sottocategoria`,
					labels: Object.keys(expensesBySubCategory),
					data: Object.values(expensesBySubCategory),
				});
				bot.sendPhoto(
					chat.chatId,
					chartBySubCategory,
					{},
					{
						filename: `Spese per sottocategoria di ${lastMonthName}.png`,
						contentType: "application/octet-stream",
					},
				);
			}
		} catch (e) {
			const err = new Error(`Error while checking reports: ${e}`);
			logger.sendError(err, "NO_CHAT");
		}
	};

	// Check reports every x time
	const start = () => {
		logger.info("Starting reports", "NO_CHAT");
		interval = setInterval(check, CHECK_INTERVAL);
	};

	return {
		check, // mainly returned for testing purposes
		start,
	};
};

/**
 * Cycle through the expenses and calculate:
 * - total
 * - map grouped by category
 * - map grouped by subcategory
 */
export const getExpenseGrouped = (
	expenses: Expense[],
): {
	totalExpense: number;
	expensesByCategory: Record<string, number>;
	expensesBySubCategory: Record<string, number>;
} => {
	let totalExpense = 0;
	const expensesByCategory: Record<string, number> = {};
	const expensesBySubCategory: Record<string, number> = {};

	for (const expense of expenses) {
		// handle totalExpense
		totalExpense += expense.amount;

		// handle expenses by category
		const category = expense.category;
		if (!expensesByCategory[category]) {
			expensesByCategory[category] = 0;
		}
		expensesByCategory[category] += expense.amount;

		// handle expenses by subcategory
		const subCategory = expense.subCategory;
		const key =
			category === UNCATEGORIZED_CATEGORY
				? category
				: `${category} - ${subCategory}`;
		if (!expensesBySubCategory[key]) {
			expensesBySubCategory[key] = 0;
		}
		expensesBySubCategory[key] += expense.amount;
	}

	return {
		totalExpense,
		expensesByCategory,
		expensesBySubCategory,
	};
};

const getCategoryReportMsg = ({
	lastMonthName,
	totalExpense,
	expensesByCategory,
}: {
	lastMonthName: string;
	totalExpense: number;
	expensesByCategory: Record<string, number>;
}) => {
	// sort the categories by most expensive to least expensive
	const sortedCategories = Object.entries(expensesByCategory).sort(
		(a, b) => b[1] - a[1],
	);

	let msg = `Le spese di ${lastMonthName} sono state di ${totalExpense}€\n`;
	for (const [category, amount] of sortedCategories) {
		msg += `- ${category} (${Math.round(
			(amount / totalExpense) * 100,
		)}%): ${amount}€\n`;
	}

	return msg;
};

const getSubCategoryReportMsg = ({
	totalExpense,
	expensesBySubCategory,
}: {
	totalExpense: number;
	expensesBySubCategory: Record<string, number>;
}) => {
	// sort the subcategories by most expensive to least expensive
	const sortedSubCategories = Object.entries(expensesBySubCategory).sort(
		(a, b) => b[1] - a[1],
	);

	let msg = "Report per sotto-categorie:\n";
	for (const [subCategory, amount] of sortedSubCategories) {
		msg += `- ${subCategory}(${Math.round(
			(amount / totalExpense) * 100,
		)}%): ${amount}€\n`;
	}

	return msg;
};
