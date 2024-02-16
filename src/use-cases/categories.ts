import { sheets_v4 } from 'googleapis';
import { CONFIG_TYPE } from '../config/config';
import { googleResultToCategories } from '../commands/categories/fetch';
import { readGoogleSheet } from '../google';
import TTLCache from '@isaacs/ttlcache';

export type Category = {
  name: string;
  subCategories: SubCategory[];
};
type SubCategory = {
  name: string;
};

const CACHE_TTL = 1000 * 60 * 5; // 5 min

let cache: TTLCache<SheetId, Category[]> = new TTLCache({
  max: 100,
  ttl: CACHE_TTL,
});

// exported for testing, if we migrate this into a Class, we can have the cache per instance and bypass the testing problem
export const clearCache = () => {
  cache.clear();
};

export class Categories {
  config: CONFIG_TYPE;
  client: sheets_v4.Sheets;

  constructor(client: sheets_v4.Sheets, config: CONFIG_TYPE) {
    this.client = client;
    this.config = config;
  }

  async get(sheetId: SheetId): Promise<Category[]> {
    if (cache.has(sheetId)) {
      return cache.get(sheetId)!;
    }

    const categories = await fetchCategories(
      this.client,
      sheetId,
      this.config.CATEGORIES.TAB_NAME,
      this.config.CATEGORIES.RANGE
    );

    cache.set(sheetId, categories);

    return categories;
  }

  // purge({ chatId: ChatId}) {
  // implement this if we need it, purge the cache for the selected chatId
  // would it be better to have a "set"?
  // }
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

  return googleResultToCategories(result);
};
