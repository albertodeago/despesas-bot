import type { CONFIG_TYPE } from "../config/config";
import { filterNullish } from "../utils";
import type { GoogleService } from "./google";

export type Expense = {
	date: Date;
	amount: number;
	category: string;
	subCategory: string;
	description: string;
};

type getExpensesFilters = {
	categoryName?: string;
	subCategoryName?: string;
};

type InitExpenseServiceParams = {
	googleService: GoogleService;
	config: Pick<CONFIG_TYPE, "EXPENSES">;
};

export type ExpenseService = ReturnType<typeof initExpenseService>;

export const initExpenseService = ({
	googleService,
	config,
}: InitExpenseServiceParams) => {
	const getAllExpenses = async ({
		sheetId,
		filters,
	}: { sheetId: SheetId; filters?: getExpensesFilters }): Promise<
		Expense[]
	> => {
		const data = await googleService.readGoogleSheet({
			sheetId,
			range: config.EXPENSES.RANGE,
			tabName: config.EXPENSES.TAB_NAME,
		});
		if (!data) {
			return [];
		}

		const expenses: Expense[] = data
			.map((d, index) => {
				const date = dateFromDDMMYYYY(d[0]);
				// We manipulate the response, removing the point (.) that sheets uses as a
				// thousands separator.
				// We also replacing the comma (,) with a point (.) because that was JS is
				// expecting (1.396,00 -> 1.396 instead of 1396)
				const amount = Number.parseFloat(
					d[1].replace(".", "").replace(",", "."),
				);
				const category = d[2];
				const subCategory = d[3];
				const description = d[4];
				if (index > 0 && filters?.categoryName) {
					if (category !== filters.categoryName) {
						return null;
					}
					if (
						filters.subCategoryName &&
						subCategory !== filters.subCategoryName
					) {
						return null;
					}
				}

				return {
					date,
					amount,
					category,
					subCategory,
					description,
				};
			})
			.filter(filterNullish);
		expenses.shift(); // remove the header

		// sort it JUST IN CASE
		expenses.sort((a, b) => {
			return a.date.getTime() - b.date.getTime();
		});

		return expenses;
	};

	const getLastMonthExpenses = async ({
		sheetId,
	}: { sheetId: SheetId }): Promise<Expense[]> => {
		const now = new Date();

		const expenses = await getAllExpenses({ sheetId });

		// if we are the first day of the year, we need to return the expenses of the last month of the previous year
		if (now.getMonth() === 0) {
			return expenses.filter((expense) => {
				return (
					expense.date.getMonth() === 11 &&
					expense.date.getFullYear() === now.getFullYear() - 1
				);
			});
		}

		return expenses.filter((expense) => {
			return (
				expense.date.getMonth() === now.getMonth() - 1 &&
				expense.date.getFullYear() === now.getFullYear()
			);
		});
	};

	return {
		getAllExpenses,
		getLastMonthExpenses,
	};
};

// dateString is formatted as dd/mm/yyyy
const dateFromDDMMYYYY = (dateString: string): Date => {
	const dateSplit = dateString.split("/");
	const date = new Date(
		+dateSplit[2],
		+dateSplit[1] - 1, // month is 0-based, that's why we need dataParts[1] - 1
		+dateSplit[0],
		8, // just to make sure we don't get the prev day because of the timezone
	);
	return date;
};
