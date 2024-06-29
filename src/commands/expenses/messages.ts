export const getMsgExplanation = () => `Per aggiungere una spesa, scrivere\n
aggiungi <importo> <descrizione> <categoria>? <sottocategoria>?\n\n
Se invece vuoi aggiungere velocemente una spesa non categorizzandola, scrivi\n
aggiungi veloce <importo> <descrizione>\n`;

export const getWrongAmountMessage = () => `L'importo dev'essere un numero. Un esempio per inserire una spesa è:\n
aggiungi 7.50 aperitivo`;

export const getWrongAmountMessageQuick = () => `L'importo dev'essere un numero. Un esempio per inserire una spesa è:\n
aggiungi veloce 7.50 aperitivo`;

export const getOkMessage = () => "Fatto!";

export const getErrorMessage = (e?: unknown) => {
	const errMsg = e ? `\nErrore:\n${e}` : "";
	return `C\è stato un problema, reinserisci la spesa\n${errMsg}`;
};

export const genericErrorMsg =
	"Si è verificato un errore, riprovare più tardi.";

export const getMsgExplanationList = () => `Per visualizzare le spese, scrivere\n
lista spese <categoria> [sottocategoria]`;
