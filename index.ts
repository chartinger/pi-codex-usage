import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { accountIdFromToken, formatWindow, parseUsage, type Usage } from "./usage.ts";

const STATUS = "codex-usage";
const INTERVAL_MS = 5 * 60_000;
const ENDPOINT = "https://chatgpt.com/backend-api/wham/usage";

export default function (pi: ExtensionAPI) {
	let timer: ReturnType<typeof setInterval> | undefined;
	let inFlight: Promise<Usage> | undefined;
	let last: Usage | undefined;
	let lastError: string | undefined;
	let active = false;

	function show(ctx: ExtensionContext) {
		if (ctx.mode !== "tui" || !active) return;
		const text = last
			? `Codex ${formatWindow("5h", last.fiveHour, true)} · ${formatWindow("week", last.weekly, true)}`
			: `Codex: ${lastError ?? "loading…"}`;
		ctx.ui.setStatus(STATUS, ctx.ui.theme.fg(lastError ? "warning" : "muted", text));
	}

	async function refresh(ctx: ExtensionContext): Promise<Usage> {
		if (inFlight) return inFlight;
		inFlight = (async () => {
			// Pi resolves and refreshes the existing OAuth credential for us.
			const token = await ctx.modelRegistry.getApiKeyForProvider("openai-codex");
			if (!token) throw new Error("not logged in; run /login openai-codex");
			const accountId = accountIdFromToken(token);
			const response = await fetch(ENDPOINT, {
				method: "GET",
				headers: {
					Authorization: `Bearer ${token}`,
					...(accountId ? { "chatgpt-account-id": accountId } : {}),
					Accept: "application/json",
				},
				signal: AbortSignal.timeout(10_000),
			});
			if (!response.ok) throw new Error(`usage request failed (HTTP ${response.status})`);
			return parseUsage(await response.json());
		})();
		try {
			last = await inFlight;
			lastError = undefined;
			return last;
		} catch (error) {
			lastError = error instanceof Error ? error.message : "usage unavailable";
			throw error;
		} finally {
			inFlight = undefined;
			show(ctx);
		}
	}

	pi.on("session_start", (_event, ctx) => {
		active = true;
		show(ctx);
		if (ctx.mode !== "tui") return;
		void refresh(ctx).catch(() => {});
		timer = setInterval(() => { void refresh(ctx).catch(() => {}); }, INTERVAL_MS);
	});

	pi.on("agent_end", (_event, ctx) => {
		if (ctx.mode === "tui") void refresh(ctx).catch(() => {});
	});

	pi.on("session_shutdown", (_event, ctx) => {
		active = false;
		if (timer) clearInterval(timer);
		timer = undefined;
		if (ctx.mode === "tui") ctx.ui.setStatus(STATUS, undefined);
	});

	pi.registerCommand("codex-usage", {
		description: "Show current Codex 5-hour and weekly remaining usage",
		handler: async (_args, ctx) => {
			try {
				const usage = await refresh(ctx);
				ctx.ui.notify(`Codex ${formatWindow("5h", usage.fiveHour)} · ${formatWindow("week", usage.weekly)}`, "info");
			} catch {
				ctx.ui.notify(`Codex usage: ${lastError}`, "warning");
			}
		},
	});
}
