import TTLCache from "@isaacs/ttlcache";
import type { CONFIG_TYPE } from "../config/config";
import type { Logger } from "../logger";
import type { GoogleService } from "../services/google";

const CACHE_KEY = "chat-configuration";
const CACHE_TTL = 1000 * 60 * 5; // 5 min

type ConfigChatsConfig = Pick<CONFIG_TYPE, "CHATS_CONFIGURATION">;

export type ChatsConfigurationUseCase = ReturnType<
	typeof initChatsConfigurationUseCase
>;

export const initChatsConfigurationUseCase = ({
	config,
	logger,
	googleService,
}: {
	config: ConfigChatsConfig;
	logger: Logger;
	googleService: GoogleService;
}) => {
	const cache: TTLCache<typeof CACHE_KEY, ChatConfig[]> = new TTLCache({
		max: 1, // we just need 1 entry, the config itself
		ttl: CACHE_TTL,
	});

	const get = async () => {
		try {
			const isCached = cache.has(CACHE_KEY);
			if (isCached) {
				// biome-ignore lint/style/noNonNullAssertion: it must be there
				return cache.get(CACHE_KEY)!;
			}

			const chatsConfig = await googleService.readGoogleSheet({
				sheetId: config.CHATS_CONFIGURATION.SHEET_ID,
				tabName: config.CHATS_CONFIGURATION.TAB_NAME,
				range: config.CHATS_CONFIGURATION.RANGE,
			});

			if (chatsConfig && chatsConfig.length > 0) {
				// first element is the header, we can skip it
				chatsConfig.shift();

				// remove every element that has a different length than 3, because it's not a valid chat configuration, may be dirty data
				const validChatsConfig = chatsConfig
					.filter((chatConfig) => chatConfig.length === 3)
					.map((chatConfig) => ({
						chatId: chatConfig[0],
						spreadsheetId: chatConfig[1],
						isActive: chatConfig[2].toLowerCase() === "true",
					}));

				cache.set(CACHE_KEY, validChatsConfig);

				return validChatsConfig;
			}
		} catch (e) {
			const err = new Error(`ChatConfigurationUseCase - error in get: ${e}`);
			logger.sendError(err, "NO_CHAT");
		}

		return [];
	};

	const isChatInConfiguration = async (chatId: ChatId) => {
		try {
			const chatsConfig = await get();
			if (chatsConfig) {
				const index = chatsConfig.findIndex(
					(chatConfig) => chatConfig.chatId === chatId,
				);
				if (index !== -1) {
					return true;
				}
			}
		} catch (e) {
			const err = new Error(
				`ChatConfigurationUseCase - error in isChatInConfiguration: ${e}`,
			);
			logger.sendError(err, "NO_CHAT");
		}

		return false;
	};

	const addChatToConfiguration = async (chatConfig: ChatConfig) => {
		try {
			await googleService.appendGoogleSheet({
				sheetId: config.CHATS_CONFIGURATION.SHEET_ID,
				tabName: config.CHATS_CONFIGURATION.TAB_NAME,
				range: config.CHATS_CONFIGURATION.RANGE,
				data: [
					[chatConfig.chatId, chatConfig.spreadsheetId, chatConfig.isActive],
				],
				valueInputOption: "RAW",
			});

			// update cache
			const currentCache = cache.get(CACHE_KEY);
			if (currentCache) {
				const newValue = currentCache.slice();
				newValue.push(chatConfig);
				cache.set(CACHE_KEY, newValue);
			}

			return true;
		} catch (e) {
			const err = new Error(
				`ChatConfigurationUseCase - error in addChatToConfiguration: ${e}`,
			);
			logger.sendError(err, "NO_CHAT");
		}
		return false;
	};

	const updateChatInConfiguration = async (
		chatId: ChatId,
		newChatConfig: ChatConfig,
	) => {
		// first we need to read the configuration, then we need to find the line with the right chatId
		// and then we need to update it

		try {
			const chatsConfig = await get();

			if (chatsConfig) {
				const index = chatsConfig.findIndex(
					(chatConfig) => chatConfig.chatId === chatId,
				);
				// we need to add 2 to the found index, one because google sheet start from 1 and not 0
				// and another one because the first row is the header that we skip when reading the configuration
				const correctIndex = index + 2;

				const range = config.CHATS_CONFIGURATION.RANGE.split(":")
					.map((v) => `${v}${correctIndex}`)
					.join(":");

				await googleService.updateGoogleSheet({
					sheetId: config.CHATS_CONFIGURATION.SHEET_ID,
					tabName: config.CHATS_CONFIGURATION.TAB_NAME,
					range,
					data: [
						[
							newChatConfig.chatId,
							newChatConfig.spreadsheetId,
							newChatConfig.isActive,
						],
					],
				});

				// update cache
				const currentCache = cache.get(CACHE_KEY);
				if (currentCache) {
					const newValue = currentCache.slice();
					newValue[index] = newChatConfig;
					cache.set(CACHE_KEY, newValue);
				}

				return true;
			}
		} catch (e) {
			const err = new Error(
				`ChatConfigurationUseCase - error in updateChatInConfiguration: ${e}`,
			);
			logger.sendError(err, "NO_CHAT");
		}

		return false;
	};

	const isChatActiveInConfiguration = async (chatId: ChatId) => {
		const _isChatInConfiguration = await isChatInConfiguration(chatId);
		if (!_isChatInConfiguration) {
			return false;
		}

		const chats = await get();
		const chat = chats?.find((c) => c.chatId === chatId);

		return chat?.isActive || false;
	};

	const getSpreadsheetIdFromChat = async (chatId: ChatId) => {
		const chats = await get();
		const chat = chats?.find((c) => c.chatId === chatId);

		if (!chats || !chat) {
			const err = new Error(
				`ChatConfigurationUseCase - error in getSpreadsheetIdFromChat, chats not found or unable to match the chat ${chatId}`,
			);
			logger.sendError(err, "NO_CHAT");
			throw err;
		}

		return chat.spreadsheetId;
	};

	return {
		get,
		isChatInConfiguration,
		addChatToConfiguration,
		updateChatInConfiguration,
		isChatActiveInConfiguration,
		getSpreadsheetIdFromChat,
	};
};
