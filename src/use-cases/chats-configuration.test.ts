import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  addChatToConfiguration,
  getChatsConfiguration,
  isChatInConfiguration,
  updateChatInConfiguration,
  isChatActiveInConfiguration,
  getSpreadsheetIdFromChat,
} from './chats-configuration';

const spyGet = vi.fn(() =>
  Promise.resolve({
    data: {
      values: [
        ['chatId', 'spreadsheetId', 'isActive'],
        ['chat-123', 'spread-123', 'TRUE'],
        ['chat-456', 'spread-456', 'FALSE'],
        ['chat-789', 'spread-789', 'TRUE'],
      ],
    },
  })
);
const spyAppend = vi.fn(() => Promise.resolve({ data: {} }));
const spyUpdate = vi.fn(() => Promise.resolve({ data: {} }));

const mockGoogleSheetClient = {
  spreadsheets: {
    values: {
      get: spyGet,
      append: spyAppend,
      update: spyUpdate,
    },
  },
};
const mockConfig = {
  CHATS_CONFIGURATION: {
    SHEET_ID: 'sheet-id',
    TAB_NAME: 'tab-name',
    RANGE: 'A:Z',
  },
};

describe('USE-CASE: chats-configuration', () => {
  beforeEach(() => {
    spyGet.mockClear();
    spyAppend.mockClear();
    spyUpdate.mockClear();
  });

  describe('getChatsConfiguration', () => {
    it('should return an empty array if there are no active chats', async () => {
      spyGet.mockImplementationOnce(() =>
        Promise.resolve({ data: { values: [] } })
      );

      const chatsConfig = await getChatsConfiguration(
        // @ts-expect-error
        mockGoogleSheetClient,
        mockConfig
      );
      expect(chatsConfig).toEqual([]);
    });

    it('should return undefined if an error happens while fetching the chats configuration', async () => {
      spyGet.mockImplementationOnce(() => Promise.reject());

      const chatsConfig = await getChatsConfiguration(
        // @ts-expect-error
        mockGoogleSheetClient,
        mockConfig
      );
      expect(chatsConfig).toBeUndefined();
    });

    it('should return the array of chat configurations (without the header row)', async () => {
      const chatsConfig = await getChatsConfiguration(
        // @ts-expect-error
        mockGoogleSheetClient,
        mockConfig
      );
      expect(chatsConfig).toEqual([
        {
          chatId: 'chat-123',
          spreadsheetId: 'spread-123',
          isActive: true,
        },
        {
          chatId: 'chat-456',
          spreadsheetId: 'spread-456',
          isActive: false,
        },
        {
          chatId: 'chat-789',
          spreadsheetId: 'spread-789',
          isActive: true,
        },
      ]);
    });

    it('should return the array of chat configurations removing any row with length !== 3', async () => {
      spyGet.mockImplementationOnce(() =>
        Promise.resolve({
          data: {
            values: [
              ['chatId', 'spreadsheetId', 'isActive'],
              ['chat-123', 'spread-123', 'TRUE'],
              [''],
              ['chat-456', 'spread-456', 'FALSE', 'madafacka'],
            ],
          },
        })
      );
      const chatsConfig = await getChatsConfiguration(
        // @ts-expect-error
        mockGoogleSheetClient,
        mockConfig
      );
      expect(chatsConfig).toEqual([
        {
          chatId: 'chat-123',
          spreadsheetId: 'spread-123',
          isActive: true,
        },
      ]);
    });
  });

  describe('isChatInConfiguration', () => {
    it('should return true if the chat is in the configuration', async () => {
      const res = await isChatInConfiguration(
        // @ts-expect-error
        mockGoogleSheetClient,
        mockConfig,
        'chat-123'
      );
      expect(res).toEqual(true);
    });

    it('should return false if the chat is not in the configuration', async () => {
      const res = await isChatInConfiguration(
        // @ts-expect-error
        mockGoogleSheetClient,
        mockConfig,
        'chat-000'
      );
      expect(res).toEqual(false);
    });

    it('should return false if an error occurs while fetching the chats configuration', async () => {
      spyGet.mockImplementationOnce(() => Promise.reject());

      const res = await isChatInConfiguration(
        // @ts-expect-error
        mockGoogleSheetClient,
        mockConfig,
        'chat-123'
      );
      expect(res).toEqual(false);
    });
  });

  describe('addChatToConfiguration', () => {
    const mockChatConfig = {
      chatId: 'chat-123',
      spreadsheetId: 'spread-123',
      isActive: true,
    };

    it('should return false if an error occurs while appending the item', async () => {
      spyAppend.mockImplementationOnce(() => Promise.reject());

      const res = await addChatToConfiguration(
        // @ts-expect-error
        mockGoogleSheetClient,
        mockConfig,
        mockChatConfig
      );
      expect(res).toEqual(false);
    });

    it('should return true if the append succeeds', async () => {
      const res = await addChatToConfiguration(
        // @ts-expect-error
        mockGoogleSheetClient,
        mockConfig,
        mockChatConfig
      );
      expect(res).toEqual(true);
    });
  });

  describe('updateChatInConfiguration', () => {
    const mockChatConfig = {
      chatId: 'new-chat-id',
      spreadsheetId: 'new-spread-id',
      isActive: true,
    };

    it('should return false if an error occurs while updating the value', async () => {
      spyUpdate.mockImplementationOnce(() => Promise.reject());

      const res = await updateChatInConfiguration(
        // @ts-expect-error
        mockGoogleSheetClient,
        mockConfig,
        'chat-456',
        mockChatConfig
      );
      expect(res).toEqual(false);
    });

    it('should return true if the update succeeds', async () => {
      const res = await updateChatInConfiguration(
        // @ts-expect-error
        mockGoogleSheetClient,
        mockConfig,
        'chat-456',
        mockChatConfig
      );
      expect(res).toEqual(true);
    });
  });

  describe('isChatActiveInConfiguration', () => {
    it('should return false if the chat is not found in the config', async () => {
      const result = await isChatActiveInConfiguration(
        // @ts-expect-error
        mockGoogleSheetClient,
        mockConfig,
        'chat-666'
      );
      expect(result).toBe(false);
    });

    it("should return false if the chat is in the config but it' inactive", async () => {
      const result = await isChatActiveInConfiguration(
        // @ts-expect-error
        mockGoogleSheetClient,
        mockConfig,
        'chat-456'
      );

      expect(result).toBe(false);
    });

    it("should return true if the chat is in the config and it's active", async () => {
      const result = await isChatActiveInConfiguration(
        // @ts-expect-error
        mockGoogleSheetClient,
        mockConfig,
        'chat-789'
      );

      expect(result).toBe(true);
    });
  });

  describe('getSpreadsheetIdFromChat', () => {
    it('should throw an error if the requested chat is not found', async () => {
      await expect(() =>
        getSpreadsheetIdFromChat(
          // @ts-expect-error
          mockGoogleSheetClient,
          mockConfig,
          'chat-666'
        )
      ).rejects.toThrowError('[getSpreadsheetIdFromChat]');
    });

    it('should return the spreadsheetId of the chatId', async () => {
      const result = await getSpreadsheetIdFromChat(
        // @ts-expect-error
        mockGoogleSheetClient,
        mockConfig,
        'chat-789'
      );

      expect(result).toEqual('spread-789');
    });
  });
});
