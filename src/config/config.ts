export type CONFIG_TYPE = ReturnType<typeof getConfig>;

const sharedConfigProps = {
  DEPLOY_CHAT_ID: '53084797',
  sheetId: '1ZwB1vymJf-YvSIPt-H0tHM1z4uWwradcrGNUDR_LeWs', // despesas -> TODO: to be removed when generic bot implemented
  // sheetId: '17higBTMCC09k95Dr_ccw7BRClxdkdBwT3dk9xqnpiVg', // despesas-2
  tabName: 'Spese',
  range: 'A:E',
  CATEGORIES: {
    TAB_NAME: 'Categorie',
    RANGE: 'A2:Z100',
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
    SHEET_ID: 'TODO:',
    TAB_NAME: 'analytics',
    TRACKED_EXPENSES_RANGE: 'A1:B1',
    TRACKED_EXPENSES_LABEL: 'Tracked expenses',
  },
  CHATS_CONFIGURATION: {
    SHEET_ID: 'TODO:',
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
