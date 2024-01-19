import { vi, describe, it, expect } from 'vitest';
import { getDescriptionFromTokenizedMessage, createExpenseRow } from './utils';

describe('utils', () => {
  describe('createExpenseRow', () => {
    it('should create an expense row', () => {
      const expenseRow = createExpenseRow({
        date: '2021-01-01',
        amount: 10,
        categoryName: 'Category_1',
        subCategoryName: 'Subcategory_1',
        description: 'Description',
      });

      expect(expenseRow).toEqual([
        ['2021-01-01', 10, 'Category_1', 'Subcategory_1', 'Description'],
      ]);
    });

    it('should create an expense row without description if not provided', () => {
      const expenseRow = createExpenseRow({
        date: '2021-01-01',
        amount: 10,
        categoryName: 'Category_1',
        subCategoryName: 'Subcategory_1',
      });

      expect(expenseRow).toEqual([
        ['2021-01-01', 10, 'Category_1', 'Subcategory_1', ''],
      ]);
    });

    it('should create an expense row without subcategory if not provided', () => {
      const expenseRow = createExpenseRow({
        date: '2021-01-01',
        amount: 10,
        categoryName: 'Category_1',
      });

      expect(expenseRow).toEqual([['2021-01-01', 10, 'Category_1', '', '']]);
    });
  });

  describe('getDescriptionFromTokenizedMessage', () => {
    it('should return the description from a tokenized message with no category and subcategory', () => {
      const tokens = ['aggiungi', '10', 'descrizione'];
      const description = getDescriptionFromTokenizedMessage(tokens, 2, 0);

      expect(description).toBe('descrizione');
    });

    it("should return the description from a tokenized message even if it's empty with no category and subcategory", () => {
      const tokens = ['aggiungi', '10', ''];
      const description = getDescriptionFromTokenizedMessage(tokens, 2, 0);

      expect(description).toBe('');
    });

    it('should return the description from a tokenized message even if it has more than one word with no category and subcategory', () => {
      const tokens = [
        'aggiungi',
        '10',
        'this',
        'is',
        'a',
        'long',
        'description',
      ];
      const description = getDescriptionFromTokenizedMessage(tokens, 2, 0);

      expect(description).toBe('this is a long description');
    });

    it('should return the description from a tokenized message', () => {
      const tokens = ['aggiungi', '10', 'descrizione', 'Category_1'];
      const description = getDescriptionFromTokenizedMessage(tokens);

      expect(description).toBe('descrizione');
    });

    it("should return the description from a tokenized message even if it's empty", () => {
      const tokens = ['aggiungi', '10', '', 'Category_1'];
      const description = getDescriptionFromTokenizedMessage(tokens);

      expect(description).toBe('');
    });

    it('should return the description from a tokenized message even if it has more than one word', () => {
      const tokens = [
        'aggiungi',
        '10',
        'this',
        'is',
        'a',
        'long',
        'description',
        'Category_1',
      ];
      const description = getDescriptionFromTokenizedMessage(tokens);

      expect(description).toBe('this is a long description');
    });

    it('should return the description from a tokenized message with subcategory', () => {
      const tokens = [
        'aggiungi',
        '10',
        'descrizione',
        'Category_1',
        'Subcategory_1',
      ];
      const description = getDescriptionFromTokenizedMessage(tokens, 2, 2);

      expect(description).toBe('descrizione');
    });

    it("should return the description from a tokenized message even if it's empty with subcategory", () => {
      const tokens = ['aggiungi', '10', '', 'Category_1', 'Subcategory_1'];
      const description = getDescriptionFromTokenizedMessage(tokens, 2, 2);

      expect(description).toBe('');
    });

    it('should return the description from a tokenized message even if it has more than one word with subcategory', () => {
      const tokens = [
        'aggiungi',
        '10',
        'this',
        'is',
        'a',
        'long',
        'description',
        'Category_1',
        'Subcategory_1',
      ];
      const description = getDescriptionFromTokenizedMessage(tokens, 2, 2);

      expect(description).toBe('this is a long description');
    });

    it("should return the description from a tokenized message with a different number of tokens from left and right if it's provided", () => {
      const tokens = [
        'aggiungi',
        'veloce',
        '10',
        'this',
        'is',
        'a',
        'long',
        'description',
      ];
      const description = getDescriptionFromTokenizedMessage(tokens, 3, 0);

      expect(description).toBe('this is a long description');
    });
  });
});
