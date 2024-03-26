import TelegramBot from "node-telegram-bot-api";

export const getBot = async (
	secret: string,
	environment: Environment,
): Promise<TelegramBot> => {
	const options =
		environment === "development"
			? { polling: true }
			: {
					webHook: {
						port: 3000,
					},
				};

	const bot = new TelegramBot(secret, options);

	// setup webhook
	if (environment === "production") {
		const url = process.env.WEBHOOK_URL;
		const res = await bot.setWebHook(`${url}/bot${secret}`);
		console.log("Webhook setup result: ", res);
	}

	return bot;
};
