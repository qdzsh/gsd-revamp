import { formatTokenCount } from "./format-utils.js";

export interface UsageDisplayStats {
	input?: number;
	output?: number;
	cacheRead?: number;
	cacheWrite?: number;
	cost?: number;
	contextTokens?: number;
	contextWindow?: number;
	contextPercent?: number | null;
	turns?: number;
	model?: string;
}

export interface UsageDisplayOptions {
	includeTurns?: boolean;
	includeModel?: boolean;
	includeContext?: boolean;
}

export function formatDisplayModel(model: string | undefined): string {
	const trimmed = model?.trim() ?? "";
	if (!trimmed) return "";
	const slashIndex = trimmed.indexOf("/");
	if (slashIndex <= 0 || slashIndex >= trimmed.length - 1) return trimmed;
	return trimmed.slice(slashIndex + 1);
}

export function formatUsageCost(cost: number): string {
	const n = Number.isFinite(Number(cost)) ? Number(cost) : 0;
	const sign = n < 0 ? "-" : "";
	return `${sign}$${Math.abs(n).toLocaleString("en-US", {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	})}`;
}

export function formatUsageTokens(count: number): string {
	if (count < 1000) return count.toString();
	if (count < 10000) return `${(count / 1000).toFixed(1)}k`;
	if (count < 1000000) return `${Math.round(count / 1000)}k`;
	if (count < 10000000) return `${(count / 1000000).toFixed(1)}M`;
	return `${Math.round(count / 1000000)}M`;
}

export function formatUsageContext(stats: UsageDisplayStats): string {
	const contextWindow = stats.contextWindow ?? 0;
	const contextTokens = stats.contextTokens ?? 0;

	if (contextWindow > 0) {
		if (stats.contextPercent === null) {
			return `?/${formatUsageTokens(contextWindow)}`;
		}
		const percent =
			typeof stats.contextPercent === "number"
				? stats.contextPercent
				: contextTokens > 0
					? (contextTokens / contextWindow) * 100
					: 0;
		return `${percent.toFixed(1)}%/${formatUsageTokens(contextWindow)}`;
	}

	if (contextTokens > 0) {
		return `Ctx ${formatTokenCount(contextTokens)}`;
	}

	return "";
}

export function formatUsageDisplay(stats: UsageDisplayStats, options: UsageDisplayOptions = {}): string {
	const parts: string[] = [];

	if (options.includeTurns && stats.turns) {
		parts.push(`${stats.turns} turn${stats.turns > 1 ? "s" : ""}`);
	}

	const tokenParts: string[] = [];
	if (stats.input) tokenParts.push(`↑${formatUsageTokens(stats.input)}`);
	if (stats.output) tokenParts.push(`↓${formatUsageTokens(stats.output)}`);
	if (tokenParts.length > 0) {
		parts.push(tokenParts.join(" "));
	}

	const cacheRead = stats.cacheRead ?? 0;
	const cacheWrite = stats.cacheWrite ?? 0;
	const totalCacheTokens = cacheRead + cacheWrite;
	if (totalCacheTokens > 0) {
		parts.push(`Hit ${((cacheRead / totalCacheTokens) * 100).toFixed(1)}%`);
	}

	if (stats.cost) {
		parts.push(formatUsageCost(stats.cost));
	}

	if (options.includeContext !== false) {
		const context = formatUsageContext(stats);
		if (context) parts.push(context);
	}

	if (options.includeModel && stats.model) {
		parts.push(formatDisplayModel(stats.model));
	}

	return parts.join(" · ");
}
