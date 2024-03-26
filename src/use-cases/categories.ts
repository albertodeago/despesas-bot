import TTLCache from "@isaacs/ttlcache";
import type { CONFIG_TYPE } from "../config/config";
import type { Logger } from "../logger";
import type { GoogleService } from "../services/google";

export type Category = {
	name: string;
	subCategories: SubCategory[];
};
export type SubCategory = {
	name: string;
};

const CACHE_TTL = 1000 * 60 * 5; // 5 min

type ConfigCategories = Pick<CONFIG_TYPE, "CATEGORIES">;

export type CategoriesUseCase = ReturnType<typeof initCategoriesUseCase>;

export const initCategoriesUseCase = ({
	config,
	logger,
	googleService,
}: {
	config: ConfigCategories;
	logger: Logger;
	googleService: GoogleService;
}) => {
	const cache = new TTLCache<SheetId, Category[]>({
		max: 100,
		ttl: CACHE_TTL,
	});

	const get = async (sheetId: SheetId): Promise<Category[]> => {
		if (cache.has(sheetId)) {
			logger.debug("CategoriesUseCase - get cache hit", "NO_CHAT");
			return cache.get(sheetId)!;
		}

		logger.debug("CategoriesUseCase - cache miss", "NO_CHAT");
		const rawCategories = await googleService.readGoogleSheet({
			sheetId,
			tabName: config.CATEGORIES.TAB_NAME,
			range: config.CATEGORIES.RANGE,
		});

		if (!rawCategories) {
			throw new Error("Categories not found");
		}

		const categories = _googleResultToCategories(rawCategories);

		cache.set(sheetId, categories);

		return categories;
	};

	return {
		get,
	};
};

// Exported just for testing
export const _googleResultToCategories = (
	categoriesOnSheet: string[][],
): Category[] => {
	const categories: Category[] = [];
	categoriesOnSheet.forEach((row: string[]) => {
		// Every row contains the category name in the first cell and the
		// subcategories in the following cells (if there are any)

		const category: Category = {
			name: "",
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
