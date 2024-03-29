import { ChartJSNodeCanvas } from "chartjs-node-canvas";

import type { ChartTypeRegistry } from "chart.js";
import type TelegramBot from "node-telegram-bot-api";
import type { Analytics } from "../analytics";
import type { CONFIG_TYPE } from "../config/config";
import type { Logger } from "../logger";
import type { GoogleService } from "../services/google";
// import type { Reminder, ReminderService } from "../services/recurrent/reminder";
import type { ChatsConfigurationUseCase } from "../use-cases/chats-configuration";

type InitReportsParams = {
	logger: Logger;
	bot: TelegramBot;
	chatsConfigUC: ChatsConfigurationUseCase;
	// reminderService: ReminderService;
	googleService: GoogleService;
	analytics: Analytics;
	config: Pick<CONFIG_TYPE, "EXPENSES">;
};

const CHECK_INTERVAL = 1000 * 60 * 60 * 10; // 10 hours

/* Randomize array in-place using Durstenfeld shuffle algorithm */
function shuffleArray(array: string[]) {
	for (let i = array.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		const temp = array[i];
		array[i] = array[j];
		array[j] = temp;
	}
	return array;
}

const chartJSNodeCanvas = new ChartJSNodeCanvas({
	width: 800,
	height: 800,
	backgroundColour: "white",
});
// generate an array of 50 different colors
const colors = shuffleArray(
	Array.from({ length: 50 }, (_, i) => {
		return `hsl(${(i * 7) % 360}, 100%, 50%)`;
	}),
);
const getChartConfiguration = ({
	chartName,
	labels,
	data,
}: { chartName: string; labels: string[]; data: number[] }) => {
	return {
		type: "doughnut" as keyof ChartTypeRegistry,
		data: {
			datasets: [
				{
					data,
					backgroundColor: colors,
				},
			],
			// These labels appear in the legend and in the tooltips when hovering different arcs
			labels,
		},
		options: {
			plugins: {
				title: {
					display: true,
					text: chartName,
				},
				legend: {
					position: "top",
				},
			},
		},
	};
};

export const initReports = ({
	logger,
	bot,
	chatsConfigUC,
	// reminderService,
	googleService,
	analytics,
	config,
}: InitReportsParams) => {
	let interval: NodeJS.Timeout | null = null;

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
			// if (now.getDate() !== 1) {
			// 	logger.debug("Today is not the first day of the month", "NO_CHAT");
			// 	return;
			// }

			const activeChats = (await chatsConfigUC.get()).filter(
				(chat) => chat.isActive,
			);
			for (const chat of activeChats) {
				const strChatId = `${chat.chatId}`;
				logger.debug(
					`Getting last month expenses for chat ${chat.chatId}`,
					strChatId,
				);

				// TODO: get expenses of last month
				const data = await googleService.readGoogleSheet({
					sheetId: chat.spreadsheetId,
					range: config.EXPENSES.RANGE,
					tabName: config.EXPENSES.TAB_NAME,
				});
				if (!data) {
					console.log("NO DATA");
					return;
				}

				const expenses = data.map((d) => {
					const dateString = d[0]; // format is dd/mm/yyyy
					const dateSplit = dateString.split("/");
					const date = new Date(
						+dateSplit[2],
						+dateSplit[1] - 1, // month is 0-based, that's why we need dataParts[1] - 1
						+dateSplit[0],
						8, // just to make sure we don't get the prev day because of the timezone
					);

					return {
						date,
						amount: Number.parseFloat(d[1]),
						category: d[2],
						subCategory: d[3],
						description: d[4],
					};
				});
				expenses.shift(); // remove the header

				// sort it JUST IN CASE
				expenses.sort((a, b) => {
					return a.date.getTime() - b.date.getTime();
				});

				const prevMonthExpenses = expenses.filter((expense) => {
					const expenseDate = expense.date;
					return (
						expenseDate.getMonth() === now.getMonth() - 1 &&
						expenseDate.getFullYear() === now.getFullYear()
					);
				});
				console.log(prevMonthExpenses);

				// group expenses by category
				const expensesByCategory = prevMonthExpenses.reduce((acc, expense) => {
					const category = expense.category;
					if (!acc[category]) {
						acc[category] = 0;
					}
					acc[category] += expense.amount;
					return acc;
				}, {});

				// group expenses by subcategory
				const expensesBySubCategory = prevMonthExpenses.reduce(
					(acc, expense) => {
						const category = expense.category;
						const subCategory = expense.subCategory;
						const key =
							category === "NON CATEGORIZZATA"
								? category
								: `${category} - ${subCategory}`;
						if (!acc[key]) {
							acc[key] = 0;
						}
						acc[key] += expense.amount;
						return acc;
					},
					{},
				);

				console.log(expensesBySubCategory);
				// get last month name
				// get yesterday in Date
				const lastMonthDate = new Date(
					now.getFullYear(),
					now.getMonth() - 1,
					15,
				);
				const monthName = lastMonthDate.toLocaleString("it", { month: "long" });
				console.log(monthName);

				const chartByCategoryConfig = getChartConfiguration({
					chartName: `Spese di ${monthName} per categoria`,
					labels: Object.keys(expensesByCategory),
					data: Object.values(expensesByCategory),
				});

				// send a text msg with the prev month expenses, markdown table

				// create the pie chart and send it to the user
				const chartByCategory = await chartJSNodeCanvas.renderToBuffer(
					chartByCategoryConfig,
				);
				bot.sendPhoto(chat.chatId, chartByCategory);

				// wait a bit before sending the next chart
				await new Promise((resolve) => setTimeout(resolve, 2500));

				// const chartBySubCategoryConfig = getChartConfiguration({
				// 	chartName: `Spese di ${monthName} per sottocategoria`,
				// 	labels: Object.keys(expensesBySubCategory),
				// 	data: Object.values(expensesBySubCategory),
				// });

				// // create the pie chart and send it to the user
				// const chartBySubCategory = await chartJSNodeCanvas.renderToBuffer(
				// 	chartBySubCategoryConfig,
				// );
				// bot.sendPhoto(chat.chatId, chartBySubCategory);
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
