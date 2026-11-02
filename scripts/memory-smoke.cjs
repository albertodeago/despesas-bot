#!/usr/bin/env node
"use strict";

// Build first (npm ci && npm run build), then, with nock installed:
// docker run --rm --network none --memory 256m --memory-swap 256m \
//   -v "$PWD:/app:ro" -w /app node:24-bookworm-slim node scripts/memory-smoke.cjs
// Never run main directly: the HTTP firewall and fake credentials below must come first.
// SMOKE_ALLOW_UNLIMITED=1 is ONLY for local debugging, never memory acceptance.
// Includes fixture/nock overhead; no forced GC, framework, or application-module mocks.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const { generateKeyPairSync } = require("node:crypto");
const { format } = require("node:util");

const MiB = 1024 * 1024;
const debug = process.env.SMOKE_ALLOW_UNLIMITED === "1";
const nativeDate = Date;
const nativeSetInterval = global.setInterval;
const nativeClearInterval = global.clearInterval;
const output = console.log.bind(console);
const errorOutput = console.error.bind(console);
const failures = [];
const longIntervals = [];
const intervals = new Set();
let sampleTimer;
let nock;
let peakRSS = 0;
let sampledCgroupPeak = 0;
let finishing = false;
let cgroup;

function fail(message) {
	failures.push(String(message));
}
function read(file) {
	return fs.readFileSync(file, "utf8").trim();
}
function detectCgroup() {
	// Docker normally mounts the process's own cgroup at this root (v2).
	// Also support v1 Docker hosts; fail closed if accounting isn't available.
	if (fs.existsSync("/sys/fs/cgroup/memory.max")) {
		return {
			limit: "/sys/fs/cgroup/memory.max",
			swap: "/sys/fs/cgroup/memory.swap.max",
			current: "/sys/fs/cgroup/memory.current",
			peak: "/sys/fs/cgroup/memory.peak",
			events: "/sys/fs/cgroup/memory.events",
		};
	}
	if (fs.existsSync("/sys/fs/cgroup/memory/memory.limit_in_bytes")) {
		return {
			limit: "/sys/fs/cgroup/memory/memory.limit_in_bytes",
			swap: "/sys/fs/cgroup/memory/memory.memsw.limit_in_bytes",
			current: "/sys/fs/cgroup/memory/memory.usage_in_bytes",
			peak: "/sys/fs/cgroup/memory/memory.max_usage_in_bytes",
			events: "/sys/fs/cgroup/memory/memory.failcnt",
		};
	}
	return null;
}
function sample() {
	peakRSS = Math.max(peakRSS, process.memoryUsage().rss);
	if (cgroup)
		sampledCgroupPeak = Math.max(
			sampledCgroupPeak,
			Number(read(cgroup.current)),
		);
}
function eventCounts(text) {
	if (/^\d+$/.test(text)) return { failcnt: Number(text) };
	return Object.fromEntries(
		text.split("\n").map((line) => {
			const [name, value] = line.split(/\s+/);
			return [name, Number(value)];
		}),
	);
}
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function waitFor(label, condition, timeout = 15000) {
	const deadline = performance.now() + timeout;
	while (!condition()) {
		assert.equal(failures.length, 0, failures.join("\n"));
		assert.ok(performance.now() < deadline, `Timed out: ${label}`);
		await delay(10);
	}
	assert.equal(failures.length, 0, failures.join("\n"));
}

async function run() {
	cgroup = detectCgroup();
	if (!debug) {
		assert.equal(process.platform, "linux", "Acceptance requires Linux Docker");
		assert.equal(
			process.versions.node.split(".")[0],
			"24",
			"Acceptance requires Node 24",
		);
		assert.ok(
			cgroup,
			"No memory cgroup; use Docker --memory 256m --memory-swap 256m",
		);
		assert.equal(
			Number(read(cgroup.limit)),
			256 * MiB,
			"Expected an actual 256MiB cgroup limit",
		);
		const swapLimit = Number(read(cgroup.swap));
		assert.equal(
			swapLimit,
			cgroup.swap.includes("memsw") ? 256 * MiB : 0,
			"Swap must be disabled (--memory-swap 256m)",
		);
	} else {
		output("DEBUG ONLY: memory acceptance environment checks bypassed");
	}
	const initialEvents = cgroup ? eventCounts(read(cgroup.events)) : {};
	sample();
	sampleTimer = nativeSetInterval(sample, 20);

	// Set every credential explicitly; dotenv cannot load the checkout's .env.
	const token = "123456789:OFFLINE_MEMORY_SMOKE_FAKE_TOKEN";
	process.env.TELEGRAM_SECRET = token;
	process.env.GOOGLE_SECRET_CLIENT_EMAIL = "offline-smoke@example.invalid";
	process.env.GOOGLE_SECRET_PRIVATE_KEY = generateKeyPairSync("rsa", {
		modulusLength: 2048,
		privateKeyEncoding: { type: "pkcs8", format: "pem" },
		publicKeyEncoding: { type: "spki", format: "pem" },
	}).privateKey;
	process.env.WEBHOOK_URL = "https://offline-smoke.invalid";
	process.env.NODE_ENV = "production";
	process.env.DOTENV_CONFIG_PATH = "/dev/null";
	process.env.DOTENV_KEY = ""; // Also prevent ambient dotenv-vault configuration.
	// Don't allow ambient proxy settings to change the target intercepted by nock.
	for (const key of Object.keys(process.env)) {
		if (/^(https?_proxy|all_proxy|no_proxy)$/i.test(key))
			delete process.env[key];
	}

	const nockModule = require("nock");
	nock = nockModule.default || nockModule;
	nock.disableNetConnect();
	nock.enableNetConnect((host) => host === "127.0.0.1:3000");
	nock.emitter.on("no match", (req) => {
		const host =
			req.options?.hostname ||
			req.options?.host ||
			req.getHeader?.("host") ||
			(req.url ? new URL(req.url, "https://unknown.invalid").host : "");
		if (
			host === "127.0.0.1" ||
			host === "127.0.0.1:3000" ||
			req.path === `/bot${token}`
		)
			return;
		fail(
			`Unexpected HTTP: ${req.method || req.options?.method} ${host} ${req.url || req.path || req.options?.path}`,
		);
	});
	console.error = (...args) => {
		const message = format(...args);
		// Node 24 emits this warning for the Telegram client's legacy request stack.
		if (
			!/^\(node:\d+\) \[DEP0169\] DeprecationWarning: `url\.parse\(\)`/.test(
				message,
			)
		) {
			fail(`Application console.error: ${message}`);
		}
		errorOutput(...args);
	};
	console.warn = (...args) => {
		const message = format(...args);
		// This SDK migration warning is not an application error; keep it visible.
		if (
			!message.startsWith(
				"The `credentials` option is deprecated. Please use the `auth` object constructor instead.",
			)
		) {
			fail(`Application console.warn: ${message}`);
		}
		errorOutput(...args);
	};
	// Preserve real Date.now() (OAuth, nock and networking deadlines). Only zero-arg
	// construction is controlled; explicit expense dates keep their real semantics.
	let simulatedNow = new nativeDate(2025, 0, 15, 12).getTime();
	global.Date = class SmokeDate extends nativeDate {
		constructor(...args) {
			super(...(args.length ? args : [simulatedNow]));
		}
		static now() {
			return nativeDate.now();
		}
	};
	global.setInterval = (callback, ms, ...args) => {
		const handle = nativeSetInterval(callback, ms, ...args);
		intervals.add(handle);
		if (ms >= 60 * 60 * 1000) longIntervals.push({ callback, ms, args });
		return handle;
	};

	const chat = "424242";
	const sheet = "offline-expenses";
	const admin = "53084797";
	const configSheet = "12zLMygxscN3KeRnJcQ2YwhyZFuIhdyYOjYAKCtjjxkY";
	const months = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno"];
	// Each month: 1 listing row at 5 EUR + 999 bulk rows at 2 EUR = 2003 EUR.
	// Remaining 4000 rows are old history, still parsed/sorted on every read.
	const rows = [
		["Data", "Importo", "Categoria", "Sottocategoria", "Descrizione"],
	];
	for (let i = 0; i < 10000; i++) {
		const month = Math.floor(i / 1000);
		rows.push([
			`15/${String(month < 6 ? month + 1 : 12).padStart(2, "0")}/${month < 6 ? 2025 : 2024}`,
			i % 1000 === 0 && month < 6 ? "5,00" : "2,00",
			i % 1000 === 0 && month < 6 ? "Smoke" : "Casa",
			i % 1000 === 0 && month < 6 ? "Unica" : "Spesa",
			`synthetic-${i}`,
		]);
	}
	const messages = [];
	const reads = new Map();
	let appends = 0;
	let updates = 0;
	let oauth = 0;
	let webhooks = 0;
	const valuePath = /^\/v4\/spreadsheets\/[^/]+\/values\/.+/;
	function location(uri) {
		const match = new URL(uri, "https://sheets.googleapis.com").pathname.match(
			/^\/v4\/spreadsheets\/([^/]+)\/values\/(.+)$/,
		);
		assert.ok(match, `Unexpected Sheets path ${uri}`);
		return [decodeURIComponent(match[1]), decodeURIComponent(match[2])];
	}
	nock("https://oauth2.googleapis.com")
		.persist()
		.post("/token")
		.reply(200, () => {
			oauth++;
			return {
				access_token: "offline-access-token",
				token_type: "Bearer",
				expires_in: 3600,
			};
		});
	nock("https://sheets.googleapis.com")
		.persist()
		.get(valuePath)
		.query(true)
		.reply(200, (uri) => {
			const [id, range] = location(uri);
			reads.set(range, (reads.get(range) || 0) + 1);
			let values;
			if (id === configSheet && range === "chats-configuration!A:C") {
				values = [
					["chatId", "spreadsheetId", "isActive"],
					[chat, sheet, "true"],
					["434343", "inactive-sheet", "false"],
				];
			} else if (id === configSheet && range === "analytics!A1:B1") {
				values = [["Tracked expenses", "10000"]];
			} else if (id === sheet) {
				switch (range) {
					case "Spese!A:E":
						values = rows;
						break;
					case "Categorie!A2:K100":
						values = [
							["Smoke", "Unica"],
							["Casa", "Spesa"],
						];
						break;
					case "Spese Ricorrenti!A1:G50":
						values = [
							[
								"Categoria",
								"Sottocategoria",
								"Descrizione",
								"Importo",
								"Frequenza",
								"Ultima aggiunta",
							],
						];
						break;
					case "Promemoria!A1:C50":
						values = [["Messaggio", "Frequenza", "Ultimo invio"]];
						break;
					default:
						assert.fail(`Unexpected fixture range ${range}`);
				}
			} else assert.fail(`Unexpected fixture sheet ${id} ${range}`);
			return { range, majorDimension: "ROWS", values };
		});
	nock("https://sheets.googleapis.com")
		.persist()
		.post(valuePath)
		.query(true)
		.reply(200, (uri, body) => {
			assert.deepEqual(location(uri), [sheet, "Spese!A:E:append"]);
			assert.deepEqual(body, {
				majorDimension: "ROWS",
				values: [
					[
						"15/01/2025",
						7.5,
						"NON CATEGORIZZATA",
						"NON CATEGORIZZATA",
						"offline-smoke",
					],
				],
			});
			assert.equal(appends++, 0, "Only the command should append");
			// Keep the fixture stateful; this row doesn't affect the isolated Smoke listing.
			rows.push([
				"15/01/2025",
				"7,50",
				"NON CATEGORIZZATA",
				"NON CATEGORIZZATA",
				"offline-smoke",
			]);
			return { updates: { updatedRows: 1, updatedCells: 5 } };
		});
	nock("https://sheets.googleapis.com")
		.persist()
		.put(valuePath)
		.query(true)
		.reply(200, (uri, body) => {
			assert.deepEqual(location(uri), [configSheet, "analytics!A1:B1"]);
			assert.deepEqual(body, {
				majorDimension: "ROWS",
				values: [["Tracked expenses", 10001]],
			});
			assert.equal(updates++, 0);
			return { updatedRows: 1, updatedCells: 2 };
		});
	nock("https://api.telegram.org")
		.persist()
		.post(`/bot${token}/setWebHook`)
		.query(true)
		.reply(200, (uri) => {
			const query = new URL(uri, "https://api.telegram.org").searchParams;
			assert.equal(query.get("url"), `${process.env.WEBHOOK_URL}/bot${token}`);
			webhooks++;
			return { ok: true, result: true };
		});
	nock("https://api.telegram.org")
		.persist()
		.post(`/bot${token}/sendMessage`)
		.delay(75)
		.reply(200, (_uri, body) => {
			const form = new URLSearchParams(body);
			const item = {
				chat: form.get("chat_id"),
				text: form.get("text"),
				mode: form.get("parse_mode"),
			};
			assert.ok(
				[chat, admin].includes(item.chat),
				`Unexpected Telegram destination ${item.chat}`,
			);
			assert.ok(
				item.text && item.text.length <= 4096,
				"Telegram text must fit real API limits",
			);
			if (item.chat === admin)
				assert.match(
					item.text,
					/^Bot v[\d.]+ up and listening\. Environment production$/,
				);
			assert.doesNotMatch(item.text, /error|errore|problema|verificato/i);
			messages.push(item);
			return {
				ok: true,
				result: {
					message_id: messages.length,
					date: 1736942400,
					chat: { id: Number(item.chat), type: "private" },
					text: item.text,
				},
			};
		});
	assert.ok(
		nock.activeMocks().length >= 6,
		"HTTP interceptors must precede bundle load",
	);

	require(path.resolve(__dirname, "../dist/main.js"));
	await waitFor(
		"complete startup",
		() =>
			longIntervals.filter((x) => x.ms === 3600000).length === 2 &&
			longIntervals.some((x) => x.ms === 36000000) &&
			messages.some((m) => m.chat === admin),
	);
	assert.equal(webhooks, 1);
	assert.ok(oauth >= 1, "Real Google auth must obtain a mocked OAuth token");
	assert.equal(reads.get("Spese Ricorrenti!A1:G50"), 1);
	assert.equal(reads.get("Promemoria!A1:C50"), 1);

	let updateID = 0;
	async function webhook(text) {
		const payload = JSON.stringify({
			update_id: ++updateID,
			message: {
				message_id: updateID,
				date: new nativeDate(2025, 0, 15, 12).getTime() / 1000,
				chat: { id: Number(chat), type: "private" },
				from: { id: Number(chat), is_bot: false, first_name: "Offline" },
				text,
			},
		});
		await new Promise((resolve, reject) => {
			const req = http.request(
				{
					hostname: "127.0.0.1",
					port: 3000,
					path: `/bot${token}`,
					method: "POST",
					headers: {
						"content-type": "application/json",
						"content-length": Buffer.byteLength(payload),
					},
				},
				(res) => {
					res.resume();
					res.on("end", () => {
						try {
							assert.equal(res.statusCode, 200);
							resolve();
						} catch (err) {
							reject(err);
						}
					});
				},
			);
			req.on("error", reject);
			req.setTimeout(5000, () => req.destroy(new Error("Webhook timeout")));
			req.end(payload);
		});
	}
	const successes = new Set([
		"Fatto!",
		"Spesa aggiunta!",
		"Ho aggiunto la spesa!",
		"Perfetto, spesa registrata!",
		"Tutto a posto!",
		"Registrata!",
		"Ok, aggiunta!",
	]);
	await webhook("aggiungi veloce 7.50 offline-smoke");
	await waitFor(
		"expense append, success and analytics update",
		() =>
			appends === 1 &&
			updates === 1 &&
			messages.some((m) => m.chat === chat && successes.has(m.text)),
	);

	const report = longIntervals.find((x) => x.ms === 36000000);
	const cycleRSS = [];
	const reportCycles = 60;
	for (let cycle = 0; cycle < reportCycles; cycle++) {
		const monthIndex = cycle % months.length;
		const start = messages.length;
		await webhook("lista spese Smoke Unica");
		await waitFor(`listing ${cycle + 1}`, () => messages.length > start);
		const listing = messages[start];
		assert.equal(listing.chat, chat);
		assert.match(
			listing.text,
			/sottocategoria Unica \(Smoke\)\nTotale spese: 30€/,
		);
		for (let month = 0; month < 6; month++)
			assert.ok(listing.text.includes(`synthetic-${month * 1000}`));

		simulatedNow = new nativeDate(2025, monthIndex + 1, 1, 12).getTime();
		const before = messages.length;
		await report.callback(...report.args);
		await waitFor(
			`monthly report ${cycle + 1}`,
			() => messages.length === before + 2,
		);
		const category = messages[before];
		const subcategory = messages[before + 1];
		const januaryExtra = monthIndex === 0 ? 7.5 : 0;
		assert.equal(category.chat, chat);
		assert.equal(subcategory.chat, chat);
		assert.equal(category.mode, "Markdown");
		assert.equal(subcategory.mode, "Markdown");
		assert.ok(
			category.text.startsWith(
				`Le spese di ${months[monthIndex]} sono state di ${2003 + januaryExtra}€\n`,
			),
		);
		const casaPercent = Math.round((1998 / (2003 + januaryExtra)) * 100);
		assert.ok(category.text.includes(`Casa (${casaPercent}%): 1998€`));
		assert.ok(category.text.includes("Smoke (0%): 5€"));
		assert.ok(subcategory.text.startsWith("Report per sotto-categorie:\n"));
		assert.ok(
			subcategory.text.includes(`Casa - Spesa(${casaPercent}%): 1998€`),
		);
		assert.ok(subcategory.text.includes("Smoke - Unica(0%): 5€"));
		// The same first day must not emit duplicate reports or reread expense history.
		const count = reads.get("Spese!A:E");
		await report.callback(...report.args);
		assert.equal(messages.length, before + 2);
		assert.equal(reads.get("Spese!A:E"), count);
		sample();
		cycleRSS.push(Number((process.memoryUsage().rss / MiB).toFixed(2)));
	}
	assert.equal(reads.get("Spese!A:E"), reportCycles * 2);
	assert.equal(messages.length, 2 + reportCycles * 3);
	assert.equal(failures.length, 0, failures.join("\n"));
	sample();
	// Node normalizes resourceUsage().maxRSS to KiB. Includes startup/RSA generation.
	const resourcePeak = process.resourceUsage().maxRSS * 1024;
	peakRSS = Math.max(peakRSS, resourcePeak);
	const memoryPeak = cgroup ? Number(read(cgroup.peak)) : null;
	const finalEvents = cgroup ? eventCounts(read(cgroup.events)) : {};
	const result = {
		status: debug ? "DEBUG (not acceptance)" : "MEASURED (checks follow)",
		node: process.version,
		syntheticRows: 10000,
		cycles: reportCycles,
		expenseReads: reads.get("Spese!A:E"),
		appends,
		updates,
		telegramMessages: messages.length,
		slowTelegramMs: 75,
		maxRSSMiB: Number((peakRSS / MiB).toFixed(2)),
		cycleRSSMiB: cycleRSS,
		cgroupLimit: cgroup ? read(cgroup.limit) : null,
		cgroupPeakMiB:
			memoryPeak === null ? null : Number((memoryPeak / MiB).toFixed(2)),
		sampledCgroupPeakMiB: Number((sampledCgroupPeak / MiB).toFixed(2)),
		memoryEventsBefore: initialEvents,
		memoryEventsAfter: finalEvents,
	};
	output(JSON.stringify(result, null, 2));
	assert.ok(
		peakRSS <= 160 * MiB,
		`Process peak exceeds 160MiB: ${result.maxRSSMiB}`,
	);
	if (memoryPeak !== null)
		assert.ok(
			memoryPeak <= 192 * MiB,
			`Cgroup peak exceeds 192MiB: ${result.cgroupPeakMiB}`,
		);
	for (const key of ["max", "oom", "oom_kill", "oom_group_kill", "failcnt"]) {
		assert.equal(
			finalEvents[key] || 0,
			initialEvents[key] || 0,
			`Memory pressure event: ${key}`,
		);
	}
	output(
		debug
			? "MEMORY SMOKE DEBUG COMPLETE (not acceptance)"
			: "MEMORY SMOKE PASS",
	);
}

async function finish(code, err) {
	if (finishing) return;
	finishing = true;
	if (err) errorOutput("MEMORY SMOKE FAIL:", err.stack || err);
	nativeClearInterval(sampleTimer);
	for (const interval of intervals) nativeClearInterval(interval);
	global.setInterval = nativeSetInterval;
	global.Date = nativeDate;
	if (nock) nock.abortPendingRequests();
	// Bundle intentionally exposes no shutdown API. Exit closes its webhook server
	// and TTL timers; wait for stdout/stderr callbacks so Docker retains the result.
	await Promise.all(
		[process.stdout, process.stderr].map(
			(stream) => new Promise((resolve) => stream.write("", resolve)),
		),
	);
	process.exit(code);
}
process.on("unhandledRejection", (err) => {
	void finish(1, err);
});
process.on("uncaughtException", (err) => {
	void finish(1, err);
});
const watchdog = setTimeout(() => {
	void finish(1, new Error("Harness exceeded 90 seconds"));
}, 90000);
watchdog.unref();
run().then(
	() => finish(0),
	(err) => finish(1, err),
);
