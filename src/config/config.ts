export type CONFIG_TYPE = ReturnType<typeof getConfig>;

const sharedConfigProps = {
  ADMINISTRATION_CHAT_ID: '53084797',
  EXPENSES: {
    TAB_NAME: 'Spese',
    RANGE: 'A:E',
  },
  CATEGORIES: {
    TAB_NAME: 'Categorie',
    RANGE: 'A2:Z100',
  },
  RECURRENT_EXPENSES: {
    TAB_NAME: 'Spese Ricorrenti',
    RANGE: 'A1:G50', // TODO: document this limit, max 50 entries
  },
};

const developmentConfig: typeof productionConfig = {
  ANALYTICS: {
    SHEET_ID: '18bmsNx-F-vK-NHavi_QCv2DisS6i7FKmTDPAa44Mdpk',
    TAB_NAME: 'analytics',
    TRACKED_EXPENSES_RANGE: 'A1:B1',
    TRACKED_EXPENSES_LABEL: 'Tracked expenses',
  },
  CHATS_CONFIGURATION: {
    SHEET_ID: '18bmsNx-F-vK-NHavi_QCv2DisS6i7FKmTDPAa44Mdpk',
    TAB_NAME: 'chats-configuration',
    RANGE: 'A:C',
  },
};
const productionConfig = {
  ANALYTICS: {
    SHEET_ID: '12zLMygxscN3KeRnJcQ2YwhyZFuIhdyYOjYAKCtjjxkY',
    TAB_NAME: 'analytics',
    TRACKED_EXPENSES_RANGE: 'A1:B1',
    TRACKED_EXPENSES_LABEL: 'Tracked expenses',
  },
  CHATS_CONFIGURATION: {
    SHEET_ID: '12zLMygxscN3KeRnJcQ2YwhyZFuIhdyYOjYAKCtjjxkY',
    TAB_NAME: 'chats-configuration',
    RANGE: 'A:C',
  },
};

export const getConfig = (env: Environment) => {
  switch (env) {
    case 'development':
      return { ...sharedConfigProps, ...developmentConfig };
    case 'production':
      return { ...sharedConfigProps, ...productionConfig };
  }
};

export const UNCATEGORIZED_CATEGORY = 'NON CATEGORIZZATA';
