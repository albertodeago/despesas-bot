import { mock } from "node:test";
import { describe, expect, test, vi } from "vitest";
import { initGoogleService } from ".";

const updateAnswer = {
	spreadsheetId: "sheet-id",
	updatedRange: "tab-name!A1:B1",
	updatedRows: 2,
	updatedColumns: 1,
	updatedCells: 2,
};
const appendSingleRowAnswer = {
	spreadsheetId: "sheet-id",
	tableRange: "tab-name!A1:B4", // means that until row 4 we have data
	updates: {
		spreadsheetId: "sheet-id",
		updatedRange: "tab-name!A5:B5", // means that it added one new row (5)
		updatedRows: 1,
		updatedColumns: 2,
		updatedCells: 2,
	},
};
const appendMultipleRowsAnswer = {
	spreadsheetId: "sheet-id",
	tableRange: "tab-name!A1:B4", // means that until row 4 we have data
	updates: {
		spreadsheetId: "sheet-id",
		updatedRange: "tab-name!A5:B6", // means that it added one two rows (5 and 6)
		updatedRows: 2,
		updatedColumns: 2,
		updatedCells: 4,
	},
};

const mockClient = {
	spreadsheets: {
		values: {
			get: vi.fn(async () => ({
				data: {
					values: [
						["a", "b"],
						["c", "d"],
					],
				},
			})),
			update: vi.fn(async () => ({ data: updateAnswer })),
			append: vi.fn(async (params) => ({
				data:
					params.requestBody.values.length === 1
						? appendSingleRowAnswer
						: appendMultipleRowsAnswer,
			})),
		},
	},
};

describe("Google", () => {
	// @ts-expect-error
	const service = initGoogleService(mockClient);

	test("readGoogleSheet", async () => {
		const data = await service.readGoogleSheet({
			sheetId: "sheet-id",
			tabName: "tab-name",
			range: "A:B",
		});
		expect(mockClient.spreadsheets.values.get).toHaveBeenCalledWith({
			spreadsheetId: "sheet-id",
			range: "tab-name!A:B",
		});
		expect(data).toStrictEqual([
			["a", "b"],
			["c", "d"],
		]);
	});

	test("updateGoogleSheet", async () => {
		const data = await service.updateGoogleSheet({
			sheetId: "sheet-id",
			tabName: "tab-name",
			range: "A1:B1",
			data: [["a", "b"]],
		});

		expect(mockClient.spreadsheets.values.update).toHaveBeenCalledWith({
			spreadsheetId: "sheet-id",
			range: "tab-name!A1:B1",
			valueInputOption: "RAW",
			requestBody: {
				majorDimension: "ROWS",
				values: [["a", "b"]],
			},
		});
		expect(data).toStrictEqual(updateAnswer);
	});

	test("appendGoogleSheet - append single row", async () => {
		const data = await service.appendGoogleSheet({
			sheetId: "sheet-id",
			tabName: "tab-name",
			range: "A:B",
			data: [["a", "b"]],
		});

		expect(data).toStrictEqual(appendSingleRowAnswer);
	});

	test("appendGoogleSheet - append multiple rows", async () => {
		const data = await service.appendGoogleSheet({
			sheetId: "sheet-id",
			tabName: "tab-name",
			range: "A:B",
			data: [
				["a", "b"],
				["c", "d"],
			],
		});

		expect(data).toStrictEqual(appendMultipleRowsAnswer);
	});
});
