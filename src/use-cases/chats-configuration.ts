import { sheets_v4 } from 'googleapis';
import {
  readGoogleSheet,
  appendGoogleSheet,
  updateGoogleSheet,
} from '../google';
import { CONFIG_TYPE } from '../config/config';

// TODO: do we want to cache the result by default (by some minutes for example) and add a parameter to force the read?
export const getChatsConfiguration = async (
  client: sheets_v4.Sheets,
  config: CONFIG_TYPE
): Promise<ChatConfig[] | undefined> => {
  try {
    const chatsConfig = await readGoogleSheet({
      client,
      sheetId: config.CHATS_CONFIGURATION.SHEET_ID,
      tabName: config.CHATS_CONFIGURATION.TAB_NAME,
      range: config.CHATS_CONFIGURATION.RANGE,
    });

    if (chatsConfig && chatsConfig.length > 0) {
      // first element is the header, we can skip it
      chatsConfig.shift();

      // remove every element that has a different length than 3, because it's not a valid chat configuration, may be dirty data
      const validChatsConfig = chatsConfig.filter(
        (chatConfig) => chatConfig.length === 3
      );

      return validChatsConfig.map((chatConfig) => ({
        chatId: chatConfig[0],
        spreadsheetId: chatConfig[1],
        isActive: chatConfig[2].toLowerCase() === 'true',
      }));
    }
  } catch (e) {
    console.error(e);
    return undefined;
    // TODO: sarebbe meglio tracciare l'errore e basta, return undefined costringe un sacco di IF in giro
  }

  return [];
};

export const isChatInConfiguration = async (
  client: sheets_v4.Sheets,
  config: CONFIG_TYPE,
  chatId: ChatId
) => {
  try {
    const chatsConfig = await getChatsConfiguration(client, config);
    if (chatsConfig) {
      const index = chatsConfig.findIndex(
        (chatConfig) => chatConfig.chatId === chatId
      );
      if (index !== -1) {
        return true;
      }
    }
  } catch (e) {
    console.error('Error while checking if the bot is started in the chat', e);
  }

  return false;
};

export const addChatToConfiguration = async (
  client: sheets_v4.Sheets,
  config: CONFIG_TYPE,
  chatConfig: ChatConfig
): Promise<boolean> => {
  try {
    await appendGoogleSheet({
      client,
      sheetId: config.CHATS_CONFIGURATION.SHEET_ID,
      tabName: config.CHATS_CONFIGURATION.TAB_NAME,
      range: config.CHATS_CONFIGURATION.RANGE,
      data: [
        [chatConfig.chatId, chatConfig.spreadsheetId, chatConfig.isActive],
      ],
    });

    return true;
  } catch (e) {
    console.error(e);
  }
  return false;
};

/**
 * Update the chat configuration with the `chatId` with the new value provided
 */
export const updateChatInConfiguration = async (
  client: sheets_v4.Sheets,
  config: CONFIG_TYPE,
  chatId: ChatId,
  newChatConfig: ChatConfig
): Promise<boolean> => {
  // first we need to read the configuration, then we need to find the line with the right chatId
  // and then we need to update it

  try {
    const chatsConfig = await getChatsConfiguration(client, config);

    if (chatsConfig) {
      const index = chatsConfig.findIndex(
        (chatConfig) => chatConfig.chatId === chatId
      );
      // we need to add 2 to the found index, one because google sheet start from 1 and not 0
      // and another one because the first row is the header that we skip when reading the configuration
      const correctIndex = index + 2;

      const range = config.CHATS_CONFIGURATION.RANGE.split(':')
        .map((v) => `${v}${correctIndex}`)
        .join(':');

      await updateGoogleSheet({
        client,
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

      return true;
    }
  } catch (e) {
    console.error(e);
  }

  return false;
};

export const isChatActiveInConfiguration = async (
  client: sheets_v4.Sheets,
  config: CONFIG_TYPE,
  chatId: ChatId
) => {
  const _isChatInConfiguration = await isChatInConfiguration(
    client,
    config,
    chatId
  );
  if (!_isChatInConfiguration) {
    return false;
  }

  const chats = await getChatsConfiguration(client, config);
  const chat = chats?.find((c) => c.chatId === chatId);

  return chat && chat.isActive;
};
