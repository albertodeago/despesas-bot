import { sheets_v4 } from 'googleapis';
import { CONFIG_TYPE } from '../config/config';
import { googleResultToCategories } from '../commands/categories/fetch';
import { readGoogleSheet } from '../google';
// const TTLCache = require('@isaacs/ttlcache')

export type Category = {
  name: string;
  subCategories: SubCategory[];
};
type SubCategory = {
  name: string;
};

// const cache = new TTLCache({ max: 100, ttl: 1000 * 60 * 5 }) // 5 min by default

// // set some value
// cache.set(1, 2)

// // 999 ms later
// cache.has(1) // returns true
// cache.get(1) // returns 2

// // 1000 ms later
// cache.get(1) // returns undefined
// cache.has(1) // returns false

export class Categories {
  config: CONFIG_TYPE;
  client: sheets_v4.Sheets;

  constructor(client: sheets_v4.Sheets, config: CONFIG_TYPE) {
    this.client = client;
    this.config = config;
  }

  async get(sheetId: SheetId) {
    // see in the cache if we have already the chatId categories
    // if yes, return it
    // otherwise fetch it from google and store it in the cache
    // TODO: check cache
    // how do we get the sheetId?
    const categories = await fetchCategories(
      this.client,
      sheetId,
      this.config.CATEGORIES.TAB_NAME,
      this.config.CATEGORIES.RANGE
    );
    // TODO: error handling?
    // TODO: set cache
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
