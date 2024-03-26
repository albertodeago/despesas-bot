import type { Category } from "../../use-cases/categories";

// construct the message to send to the user from a list of categories
export const getCategoriesAnswer = (categories: Category[]) => {
	let answer =
		categories.length === 1
			? `Ecco le sottocategorie di *${categories[0].name}*`
			: `Ecco le categorie\n`;
	categories.forEach((category) => {
		answer += categories.length === 1 ? "\n" : `- *${category.name}* \n`;
		if (category.subCategories.length > 0) {
			answer += `  - ${category.subCategories
				.map((sc) => sc.name)
				.join(", ")} \n`;
		}
	});
	return answer;
};
