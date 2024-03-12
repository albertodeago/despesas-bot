import { CONFIG_TYPE } from '../config/config';
import TTLCache from '@isaacs/ttlcache';
import { Logger } from '../logger';
import { GoogleService } from '../services/google';

const CACHE_KEY = 'chat-configuration';
const CACHE_TTL = 1000 * 60 * 5; // 5 min

export interface ChatsConfigurationUseCase {
  get: () => Promise<ChatConfig[]>;
  isChatInConfiguration: (chatId: ChatId) => Promise<boolean>;
  addChatToConfiguration: (chatConfig: ChatConfig) => Promise<boolean>;
  updateChatInConfiguration: (
    chatId: ChatId,
    newChatConfig: ChatConfig
  ) => Promise<boolean>;
  isChatActiveInConfiguration: (chatId: ChatId) => Promise<boolean>;
  getSpreadsheetIdFromChat: (chatId: ChatId) => Promise<SheetId>;
}

type ConfigChatsConfig = Pick<CONFIG_TYPE, 'CHATS_CONFIGURATION'>;

export class ChatsConfiguration implements ChatsConfigurationUseCase {
  config: ConfigChatsConfig;
  cache: TTLCache<typeof CACHE_KEY, ChatConfig[]>;
  logger: Logger;
  googleService: GoogleService;

  constructor({
    config,
    logger,
    googleService,
  }: {
    config: ConfigChatsConfig;
    logger: Logger;
    googleService: GoogleService;
  }) {
    this.config = config;
    this.cache = new TTLCache({
      max: 1, // we just need 1 entry, the config itself
      ttl: CACHE_TTL,
    });
    this.logger = logger;
    this.googleService = googleService;
  }

  async get() {
    try {
      const isCached = this.cache.has(CACHE_KEY);
      if (isCached) {
        return this.cache.get(CACHE_KEY)!;
      }

      const chatsConfig = await this.googleService.readGoogleSheet({
        sheetId: this.config.CHATS_CONFIGURATION.SHEET_ID,
        tabName: this.config.CHATS_CONFIGURATION.TAB_NAME,
        range: this.config.CHATS_CONFIGURATION.RANGE,
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
            isActive: chatConfig[2].toLowerCase() === 'true',
          }));

        this.cache.set(CACHE_KEY, validChatsConfig);

        return validChatsConfig;
      }
    } catch (e) {
      const err = new Error(`ChatConfigurationUseCase - error in get: ${e}`);
      this.logger.sendError(err, 'NO_CHAT');
    }

    return [];
  }

  async isChatInConfiguration(chatId: ChatId) {
    try {
      const chatsConfig = await this.get();
      if (chatsConfig) {
        const index = chatsConfig.findIndex(
          (chatConfig) => chatConfig.chatId === chatId
        );
        if (index !== -1) {
          return true;
        }
      }
    } catch (e) {
      const err = new Error(
        `ChatConfigurationUseCase - error in isChatInConfiguration: ${e}`
      );
      this.logger.sendError(err, 'NO_CHAT');
    }

    return false;
  }

  async addChatToConfiguration(chatConfig: ChatConfig) {
    try {
      await this.googleService.appendGoogleSheet({
        sheetId: this.config.CHATS_CONFIGURATION.SHEET_ID,
        tabName: this.config.CHATS_CONFIGURATION.TAB_NAME,
        range: this.config.CHATS_CONFIGURATION.RANGE,
        data: [
          [chatConfig.chatId, chatConfig.spreadsheetId, chatConfig.isActive],
        ],
      });

      // update cache
      const currentCache = this.cache.get(CACHE_KEY);
      if (currentCache) {
        const newValue = currentCache.slice();
        newValue.push(chatConfig);
        this.cache.set(CACHE_KEY, newValue);
      }

      return true;
    } catch (e) {
      const err = new Error(
        `ChatConfigurationUseCase - error in addChatToConfiguration: ${e}`
      );
      this.logger.sendError(err, 'NO_CHAT');
    }
    return false;
  }

  async updateChatInConfiguration(chatId: ChatId, newChatConfig: ChatConfig) {
    // first we need to read the configuration, then we need to find the line with the right chatId
    // and then we need to update it

    try {
      const chatsConfig = await this.get();

      if (chatsConfig) {
        const index = chatsConfig.findIndex(
          (chatConfig) => chatConfig.chatId === chatId
        );
        // we need to add 2 to the found index, one because google sheet start from 1 and not 0
        // and another one because the first row is the header that we skip when reading the configuration
        const correctIndex = index + 2;

        const range = this.config.CHATS_CONFIGURATION.RANGE.split(':')
          .map((v) => `${v}${correctIndex}`)
          .join(':');

        await this.googleService.updateGoogleSheet({
          sheetId: this.config.CHATS_CONFIGURATION.SHEET_ID,
          tabName: this.config.CHATS_CONFIGURATION.TAB_NAME,
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
        const currentCache = this.cache.get(CACHE_KEY);
        if (currentCache) {
          const newValue = currentCache.slice();
          newValue[index] = newChatConfig;
          this.cache.set(CACHE_KEY, newValue);
        }

        return true;
      }
    } catch (e) {
      const err = new Error(
        `ChatConfigurationUseCase - error in updateChatInConfiguration: ${e}`
      );
      this.logger.sendError(err, 'NO_CHAT');
    }

    return false;
  }

  async isChatActiveInConfiguration(chatId: ChatId) {
    const _isChatInConfiguration = await this.isChatInConfiguration(chatId);
    if (!_isChatInConfiguration) {
      return false;
    }

    const chats = await this.get();
    const chat = chats?.find((c) => c.chatId === chatId);

    return (chat && chat.isActive) || false;
  }

  async getSpreadsheetIdFromChat(chatId: ChatId) {
    const chats = await this.get();
    const chat = chats?.find((c) => c.chatId === chatId);

    if (!chats || !chat) {
      const err = new Error(
        `ChatConfigurationUseCase - error in getSpreadsheetIdFromChat, chats not found or unable to match the chat ${chatId}`
      );
      this.logger.sendError(err, 'NO_CHAT');
      throw err;
    }

    return chat.spreadsheetId;
  }
}
