import { describe, expect, it } from "vitest";
import {
	createExpenseRow,
	getDescriptionFromTokenizedMessage,
	getDifference,
	includesConsideringTypo,
} from "./utils";

describe("utils", () => {
	describe("createExpenseRow", () => {
		it("should create an expense row", () => {
			const expenseRow = createExpenseRow({
				date: "2021-01-01",
				amount: 10,
				categoryName: "Category_1",
				subCategoryName: "Subcategory_1",
				description: "Description",
			});

			expect(expenseRow).toEqual([
				["2021-01-01", 10, "Category_1", "Subcategory_1", "Description"],
			]);
		});

		it("should create an expense row without description if not provided", () => {
			const expenseRow = createExpenseRow({
				date: "2021-01-01",
				amount: 10,
				categoryName: "Category_1",
				subCategoryName: "Subcategory_1",
			});

			expect(expenseRow).toEqual([
				["2021-01-01", 10, "Category_1", "Subcategory_1", ""],
			]);
		});

		it("should create an expense row without subcategory if not provided", () => {
			const expenseRow = createExpenseRow({
				date: "2021-01-01",
				amount: 10,
				categoryName: "Category_1",
			});

			expect(expenseRow).toEqual([["2021-01-01", 10, "Category_1", "", ""]]);
		});
	});

	describe("getDescriptionFromTokenizedMessage", () => {
		it("should return the description from a tokenized message with no category and subcategory", () => {
			const tokens = ["aggiungi", "10", "descrizione"];
			const description = getDescriptionFromTokenizedMessage(tokens, 2, 0);

			expect(description).toBe("descrizione");
		});

		it("should return the description from a tokenized message even if it's empty with no category and subcategory", () => {
			const tokens = ["aggiungi", "10", ""];
			const description = getDescriptionFromTokenizedMessage(tokens, 2, 0);

			expect(description).toBe("");
		});

		it("should return the description from a tokenized message even if it has more than one word with no category and subcategory", () => {
			const tokens = [
				"aggiungi",
				"10",
				"this",
				"is",
				"a",
				"long",
				"description",
			];
			const description = getDescriptionFromTokenizedMessage(tokens, 2, 0);

			expect(description).toBe("this is a long description");
		});

		it("should return the description from a tokenized message", () => {
			const tokens = ["aggiungi", "10", "descrizione", "Category_1"];
			const description = getDescriptionFromTokenizedMessage(tokens);

			expect(description).toBe("descrizione");
		});

		it("should return the description from a tokenized message even if it's empty", () => {
			const tokens = ["aggiungi", "10", "", "Category_1"];
			const description = getDescriptionFromTokenizedMessage(tokens);

			expect(description).toBe("");
		});

		it("should return the description from a tokenized message even if it has more than one word", () => {
			const tokens = [
				"aggiungi",
				"10",
				"this",
				"is",
				"a",
				"long",
				"description",
				"Category_1",
			];
			const description = getDescriptionFromTokenizedMessage(tokens);

			expect(description).toBe("this is a long description");
		});

		it("should return the description from a tokenized message with subcategory", () => {
			const tokens = [
				"aggiungi",
				"10",
				"descrizione",
				"Category_1",
				"Subcategory_1",
			];
			const description = getDescriptionFromTokenizedMessage(tokens, 2, 2);

			expect(description).toBe("descrizione");
		});

		it("should return the description from a tokenized message even if it's empty with subcategory", () => {
			const tokens = ["aggiungi", "10", "", "Category_1", "Subcategory_1"];
			const description = getDescriptionFromTokenizedMessage(tokens, 2, 2);

			expect(description).toBe("");
		});

		it("should return the description from a tokenized message even if it has more than one word with subcategory", () => {
			const tokens = [
				"aggiungi",
				"10",
				"this",
				"is",
				"a",
				"long",
				"description",
				"Category_1",
				"Subcategory_1",
			];
			const description = getDescriptionFromTokenizedMessage(tokens, 2, 2);

			expect(description).toBe("this is a long description");
		});

		it("should return the description from a tokenized message with a different number of tokens from left and right if it's provided", () => {
			const tokens = [
				"aggiungi",
				"veloce",
				"10",
				"this",
				"is",
				"a",
				"long",
				"description",
			];
			const description = getDescriptionFromTokenizedMessage(tokens, 3, 0);

			expect(description).toBe("this is a long description");
		});
	});
});

describe("getDifference", () => {
	it("should return the difference between two strings", () => {
		const difference = getDifference("prova", "prova");
		expect(difference).toBe(0);

		const difference2 = getDifference("prova", "provaa");
		expect(difference2).toBe(1);

		const difference3 = getDifference("prova", "prva");
		expect(difference3).toBe(1);

		const difference4 = getDifference("prova", "rova");
		expect(difference4).toBe(1);

		const difference5 = getDifference("prova", "arova");
		expect(difference5).toBe(2);

		const difference6 = getDifference("prova", "acqua");
		expect(difference6).toBe(8);
	});
});

describe("includesConsideringTypo", () => {
	it("should return false if the string is too different compared to the array", () => {
		const res1 = includesConsideringTypo(["prova"], "acqua");
		expect(res1).toBe(false);

		const res2 = includesConsideringTypo(["prova"], "provaaaa");
		expect(res2).toBe(false);

		const res3 = includesConsideringTypo(["testo"], "to");
		expect(res3).toBe(false);

		const res4 = includesConsideringTypo(["prova"], "ovaa");
		expect(res4).toBe(false);
	});

	it("should return the name of the matched element if the string is not too different compared to the array", () => {
		const res1 = includesConsideringTypo(["prova"], "pro");
		expect(res1).toBe("prova");

		const res2 = includesConsideringTypo(["prova"], "provaa");
		expect(res2).toBe("prova");

		const res3 = includesConsideringTypo(["prova"], "prov");
		expect(res3).toBe("prova");

		const res4 = includesConsideringTypo(["prova", "provino"], "provin");
		expect(res4).toBe("provino");

		const res5 = includesConsideringTypo(["prova", "provino"], "provinc");
		expect(res5).toBe("provino");
	});

	it("should return the one with the exact same name if there is one", () => {
		const res1 = includesConsideringTypo(["prova", "pro"], "pro");
		expect(res1).toBe("pro");

		const res2 = includesConsideringTypo(["prova", "prov"], "prova");
		expect(res2).toBe("prova");
	});
});
