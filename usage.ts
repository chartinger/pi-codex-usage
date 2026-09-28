// The WHAM usage endpoint is undocumented; keep its response parsing isolated.
export type Window = { usedPercent: number; resetAt?: number };
export type Usage = { fiveHour?: Window; weekly?: Window };

type RecordValue = Record<string, unknown>;
function object(value: unknown): RecordValue | undefined {
	return value !== null && typeof value === "object" && !Array.isArray(value) ? value as RecordValue : undefined;
}

function window(value: unknown): Window | undefined {
	const data = object(value);
	if (!data) return undefined;
	const percent = data.used_percent ?? data.usedPercent;
	if (typeof percent !== "number" || !Number.isFinite(percent) || percent < 0 || percent > 100) return undefined;
	const reset = data.reset_at ?? data.resetAt;
	return { usedPercent: percent, ...(typeof reset === "number" && Number.isFinite(reset) ? { resetAt: reset } : {}) };
}

export function parseUsage(value: unknown): Usage {
	const rate = object(object(value)?.rate_limit ?? object(value)?.rateLimit);
	const fiveHour = window(rate?.primary_window ?? rate?.primaryWindow);
	const weekly = window(rate?.secondary_window ?? rate?.secondaryWindow);
	if (!fiveHour && !weekly) throw new Error("Codex usage response has no rate-limit windows");
	return { fiveHour, weekly };
}

export function accountIdFromToken(token: string): string | undefined {
	try {
		const payload = object(JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8")));
		const auth = object(payload?.["https://api.openai.com/auth"]);
		return typeof auth?.chatgpt_account_id === "string" ? auth.chatgpt_account_id : undefined;
	} catch {
		return undefined;
	}
}

export function formatWindow(label: string, value: Window | undefined, compact = false, now = Date.now()): string {
	if (!value) return `${label}: —`;
	const remaining = Math.max(0, 100 - value.usedPercent);
	if (value.resetAt === undefined) return `${label}: ${Math.round(remaining)}% left`;
	const resetTime = value.resetAt * 1000;
	const minutes = Math.floor((resetTime - now) / 60_000);
	const days = Math.floor(minutes / 1440);
	const hours = Math.floor(minutes % 1440 / 60);
	const relative = resetTime <= now ? "reset due" : minutes < 1 ? "resets in <1m" :
		`resets in ${[days && `${days}d`, hours && `${hours}h`, minutes % 60 && `${minutes % 60}m`].filter(Boolean).join(" ")}`;
	const absolute = compact ? "" : ` (${new Date(resetTime).toLocaleString("de-DE", {
		day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
	})})`;
	return `${label}: ${Math.round(remaining)}% left, ${relative}${absolute}`;
}
