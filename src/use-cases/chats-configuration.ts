import { sheets_v4 } from 'googleapis';
import {
  readGoogleSheet,
  appendGoogleSheet,
  updateGoogleSheet,
} from '../google';
import { CONFIG_TYPE } from '../config/config';
import TTLCache from '@isaacs/ttlcache';

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

export class ChatsConfiguration implements ChatsConfigurationUseCase {
  client: sheets_v4.Sheets;
  config: CONFIG_TYPE;
  cache: TTLCache<typeof CACHE_KEY, ChatConfig[]>;

  constructor(client: sheets_v4.Sheets, config: CONFIG_TYPE) {
    this.client = client;
    this.config = config;
    this.cache = new TTLCache({
      max: 1, // we just need 1 entry, the config itself
      ttl: CACHE_TTL,
    });
  }

  async get() {
    try {
      const isCached = this.cache.has(CACHE_KEY);
      if (isCached) {
        return this.cache.get(CACHE_KEY)!;
      }

      const chatsConfig = await readGoogleSheet({
        client: this.client,
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
      console.error(e);
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
      console.error(
        'Error while checking if the bot is started in the chat',
        e
      );
    }

    return false;
  }

  async addChatToConfiguration(chatConfig: ChatConfig) {
    try {
      await appendGoogleSheet({
        client: this.client,
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
      console.error(e);
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

        await updateGoogleSheet({
          client: this.client,
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
      console.error(e);
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
      throw new Error(
        `[getSpreadsheetIdFromChat]: error, chats not found or unable to match the chat ${chatId}`
      );
    }

    return chat.spreadsheetId;
  }
}
