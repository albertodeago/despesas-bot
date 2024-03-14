import { CONFIG_TYPE } from '../config/config';
import TTLCache from '@isaacs/ttlcache';
import type { Logger } from '../logger';
import { GoogleService } from '../services/google';

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

type ConfigCategories = Pick<CONFIG_TYPE, 'CATEGORIES'>;

export class Categories implements CategoriesUseCase {
  config: ConfigCategories;
  cache: TTLCache<SheetId, Category[]>;
  logger: Logger;
  googleService: GoogleService;

  constructor({
    config,
    logger,
    googleService,
  }: {
    config: ConfigCategories;
    logger: Logger;
    googleService: GoogleService;
  }) {
    this.config = config;
    this.cache = new TTLCache({
      max: 100,
      ttl: CACHE_TTL,
    });
    this.logger = logger;
    this.googleService = googleService;
  }

  async get(sheetId: SheetId): Promise<Category[]> {
    if (this.cache.has(sheetId)) {
      this.logger.debug('CategoriesUseCase - get cache hit', 'NO_CHAT');
      return this.cache.get(sheetId)!;
    }

    this.logger.debug('CategoriesUseCase - cache miss', 'NO_CHAT');
    const rawCategories = await this.googleService.readGoogleSheet({
      sheetId,
      tabName: this.config.CATEGORIES.TAB_NAME,
      range: this.config.CATEGORIES.RANGE,
    });

    if (!rawCategories) {
      throw new Error('Categories not found');
    }

    const categories = _googleResultToCategories(rawCategories);

    this.cache.set(sheetId, categories);

    return categories;
  }
}

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
