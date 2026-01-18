import type { ChartTypeRegistry } from "chart.js";
import { Chart } from "chart.js";
import { ChartJSNodeCanvas } from "chartjs-node-canvas";
import ChartDataLabels from "chartjs-plugin-datalabels";
import { shuffleArray } from "../../utils";

Chart.register(ChartDataLabels);

const chartJSNodeCanvas = new ChartJSNodeCanvas({
	width: 800,
	height: 800,
	backgroundColour: "white",
});

// an array of 50 different colors
const colors = shuffleArray(
	Array.from({ length: 50 }, (_, i) => {
		return `hsl(${(i * 7) % 360}, 100%, 50%)`;
	}),
);

type ChartConfiguration = {
	chartName: string;
	labels: string[];
	data: number[];
};
const getChartConfiguration = ({
	chartName,
	labels,
	data,
}: ChartConfiguration) => {
	return {
		type: "doughnut" as keyof ChartTypeRegistry,
		data: {
			datasets: [
				{
					data,
					backgroundColor: colors,
				},
			],
			// These labels appear in the legend and in the tooltips when hovering different arcs
			labels,
		},
		options: {
			plugins: {
				title: {
					display: true,
					text: chartName,
				},
				legend: {
					position: "top" as const,
				},
				datalabels: {
					backgroundColor: "#ffffff",
					color: "#333333",
					font: {
						size: 22,
					},
				},
			},
		},
	};
};

export const getChart = async ({
	chartName,
	labels,
	data,
}: ChartConfiguration): Promise<Buffer> => {
	const chartConfig = getChartConfiguration({ chartName, labels, data });
	const chart = await chartJSNodeCanvas.renderToBuffer(chartConfig);
	return chart;
};
