import { sheets_v4 } from 'googleapis';
import { CONFIG_TYPE } from '../config/config';
import { readGoogleSheet } from '../google';
import TTLCache from '@isaacs/ttlcache';

export type Category = {
  name: string;
  subCategories: SubCategory[];
};
export type SubCategory = {
  name: string;
};

const CACHE_TTL = 1000 * 60 * 5; // 5 min

export interface CategoriesUseCase {
  get: (sheetId: SheetId) => Promise<Category[]>;
}

export class Categories implements CategoriesUseCase {
  config: CONFIG_TYPE;
  client: sheets_v4.Sheets;
  cache: TTLCache<SheetId, Category[]>;

  constructor(client: sheets_v4.Sheets, config: CONFIG_TYPE) {
    this.client = client;
    this.config = config;
    this.cache = new TTLCache({
      max: 100,
      ttl: CACHE_TTL,
    });
  }

  async get(sheetId: SheetId): Promise<Category[]> {
    if (this.cache.has(sheetId)) {
      console.debug('[UseCase][Categories][get] cache hit');
      return this.cache.get(sheetId)!;
    }

    console.debug('[UseCase][Categories][get] cache miss');
    const categories = await fetchCategories(
      this.client,
      sheetId,
      this.config.CATEGORIES.TAB_NAME,
      this.config.CATEGORIES.RANGE
    );

    this.cache.set(sheetId, categories);

    return categories;
  }
}

export const fetchCategories = async (
  client: sheets_v4.Sheets,
  sheetId: SheetId,
  tabName: string,
  range: string
): Promise<Category[]> => {
  const result = await readGoogleSheet({
    client,
    sheetId,
    tabName,
    range,
  });

  if (!result) {
    throw new Error('Categories not found');
  }
  // TODO: what happens if the tab is empty? we should throw an error, to be tested

  return _googleResultToCategories(result);
};

// Exported just for testing
export const _googleResultToCategories = (
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
