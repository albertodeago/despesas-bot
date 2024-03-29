export const setup = () => {
	// Set the timezone to UTC to have more deterministic tests
	process.env.TZ = "UTC";
};
