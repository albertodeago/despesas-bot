import { beforeEach, describe, expect, vi, it, afterEach } from 'vitest';
import { googleResultToCategories } from './fetch';
import { CategoriesCommand } from './categories';
import TelegramBot from 'node-telegram-bot-api';

const mocks = vi.hoisted(() => {
  return {
    isChatActiveInConfiguration: vi.fn(() => Promise.resolve(true)),
    getSpreadsheetIdFromChat: vi.fn(() => Promise.resolve('')),
  };
});
vi.mock('../../use-cases/chats-configuration', () => ({
  isChatActiveInConfiguration: mocks.isChatActiveInConfiguration,
  getSpreadsheetIdFromChat: mocks.getSpreadsheetIdFromChat,
}));

const expectations = [
  {
    text: 'With a mix of categories with and without subcategories',
    input: [
      ['Category 1', 'Subcategory 1', 'Subcategory 2'],
      ['Category 2', 'Subcategory 3', 'Subcategory 4'],
      ['Category 3'],
    ],
    output: [
      {
        name: 'Category 1',
        subCategories: [
          {
            name: 'Subcategory 1',
          },
          {
            name: 'Subcategory 2',
          },
        ],
      },
      {
        name: 'Category 2',
        subCategories: [
          {
            name: 'Subcategory 3',
          },
          {
            name: 'Subcategory 4',
          },
        ],
      },
      {
        name: 'Category 3',
        subCategories: [],
      },
    ],
  },
  {
    text: 'With only categories without subcategories',
    input: [['Category 1'], ['Category 2'], ['Category 3']],
    output: [
      {
        name: 'Category 1',
        subCategories: [],
      },
      {
        name: 'Category 2',
        subCategories: [],
      },
      {
        name: 'Category 3',
        subCategories: [],
      },
    ],
  },
  {
    text: 'With only categories with subcategories',
    input: [
      ['Category 1', 'Subcategory 1', 'Subcategory 2'],
      ['Category 2', 'Subcategory 3', 'Subcategory 4'],
      ['Category 3', 'Subcategory 5', 'Subcategory 6'],
    ],
    output: [
      {
        name: 'Category 1',
        subCategories: [
          {
            name: 'Subcategory 1',
          },
          {
            name: 'Subcategory 2',
          },
        ],
      },
      {
        name: 'Category 2',
        subCategories: [
          {
            name: 'Subcategory 3',
          },
          {
            name: 'Subcategory 4',
          },
        ],
      },
      {
        name: 'Category 3',
        subCategories: [
          {
            name: 'Subcategory 5',
          },
          {
            name: 'Subcategory 6',
          },
        ],
      },
    ],
  },
];

describe('googleResultToCategories', () => {
  describe('should map categories stored in a google sheet to Categories', () => {
    expectations.forEach(({ text, input, output }) => {
      it(text, () => {
        expect(googleResultToCategories(input)).toEqual(output);
      });
    });
  });
});

const bot = {
  sendMessage: vi.fn(),
};
const mockConfig = {};
const mockGoogleSheetClient = {};
const mockCategoriesUC = {
  async get() {
    return [
      {
        name: 'Category_1',
        subCategories: [{ name: 'Subcategory_1' }, { name: 'Subcategory_2' }],
      },
      {
        name: 'Category_2',
        subCategories: [{ name: 'Subcategory_3' }, { name: 'Subcategory_4' }],
      },
      {
        name: 'Category_3',
        subCategories: [],
      },
    ];
  },
};

const defaultMsg: TelegramBot.Message = {
  text: '/categorie',
  chat: {
    id: 123,
    type: 'private',
  },
  date: new Date().getTime(),
  message_id: 987654321,
};
describe('CategoriesCommand', () => {
  let handler: ReturnType<typeof CategoriesCommand.getHandler>;

  beforeEach(() => {
    handler = CategoriesCommand.getHandler({
      // @ts-expect-error
      bot,
      // @ts-expect-error
      googleSheetClient: mockGoogleSheetClient,
      // @ts-expect-error
      config: mockConfig,
      // @ts-expect-error - TODO: we should create some interface type, so we just care that we receive something that have the 'get' method, not the entire class shape
      categoriesUC: mockCategoriesUC,
    });
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should match /categorie and /c', () => {
    expect(CategoriesCommand.pattern.test('/categorie')).toBe(true);
    expect(CategoriesCommand.pattern.test('/categorie auto')).toBe(true);
    expect(CategoriesCommand.pattern.test('/categorieee')).toBe(false);
    expect(CategoriesCommand.pattern.test('/categorieee casa')).toBe(false);
    expect(CategoriesCommand.pattern.test('/c')).toBe(true);
    expect(CategoriesCommand.pattern.test('/c casa')).toBe(true);
    expect(CategoriesCommand.pattern.test('/citando Dante')).toBe(false);
  });

  it('should answer with all the categories and subcategories', async () => {
    handler(defaultMsg);

    await vi.waitFor(() => {
      if (bot.sendMessage.mock.calls?.[0]?.[0] === undefined)
        throw 'Mock not called yet';
    });
    expect(bot.sendMessage).toHaveBeenCalledWith(
      123,
      `Ecco le categorie
- *Category_1* 
  - Subcategory_1, Subcategory_2 
- *Category_2* 
  - Subcategory_3, Subcategory_4 
- *Category_3* 
`,
      {
        parse_mode: 'Markdown',
      }
    );
  });

  it('should answer with just the specified category, listing subcategories', async () => {
    handler({
      ...defaultMsg,
      text: '/categorie Category_1',
    });

    await vi.waitFor(() => {
      if (bot.sendMessage.mock.calls?.[0]?.[0] === undefined)
        throw 'Mock not called yet';
    });
    expect(bot.sendMessage).toHaveBeenCalledWith(
      123,
      `Ecco le sottocategorie di *Category_1*
  - Subcategory_1, Subcategory_2 
`,
      {
        parse_mode: 'Markdown',
      }
    );
  });
});
