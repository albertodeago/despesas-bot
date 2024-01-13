import { sheets_v4 } from 'googleapis';
import { readGoogleSheet } from '../../google';
import { CATEGORIES_TAB_NAME } from './constants';

export type Category = {
  name: string;
  subCategories: SubCategory[];
};
type SubCategory = {
  name: string;
};

// Exported just for testing
export const googleResultToCategories = (
  categoriesOnSheet: string[][]
): Category[] => {
  let categories: Category[] = [];
  categoriesOnSheet.forEach((row: string[]) => {
    // Every row contains the category name in the first cell and the
    // subcategories in the following cells (if there are any)

    let category: Category = {
      name: '',
      subCategories: [],
    };

    row.forEach((cell: string, index: number) => {
      if (index === 0) {
        category.name = cell;
        categories.push(category);
      } else {
        category.subCategories.push({
          name: cell,
        });
      }
    });
  });
  return categories;
};

// TODO: document limit and how the categories are saved on the google sheet

// TODO: this is not actually the command! We should move this
export const fetchCategories = async (
  client: sheets_v4.Sheets,
  sheetId: SheetId
): Promise<Category[]> => {
  const result = await readGoogleSheet({
    client,
    sheetId,
    tabName: CATEGORIES_TAB_NAME,
    range: 'A2:Z100',
  });

  if (!result) {
    throw new Error(
      'No categories found. Please add some categories in the google sheet'
    );
  }
  // TODO: what happens if the tab is empty? we should throw an error, to be tested

  return googleResultToCategories(result);
};
