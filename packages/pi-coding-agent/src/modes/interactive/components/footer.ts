// Project/App: GSD-2
// File Purpose: Interactive terminal footer renderer for workspace, model, usage, context, and extension status.

import { type Component, truncateToWidth, visibleWidth } from "@gsd/pi-tui";
import type { AgentSession } from "../../../core/agent-session.js";
import type { ReadonlyFooterDataProvider } from "../../../core/footer-data-provider.js";
import { theme } from "../theme/theme.js";

/**
 * Sanitize text for display in a single-line status.
 * Removes newlines, tabs, carriage returns, and other control characters.
 */
function sanitizeStatusText(text: string): string {
	// Replace newlines, tabs, carriage returns with space, then collapse multiple spaces
	return text
		.replace(/[\r\n\t]/g, " ")
		.replace(/ +/g, " ")
		.trim();
}

function truncateFooterPath(text: string, width: number): string {
	if (visibleWidth(text) <= width) return text;
	const tailMatch = text.match(/( \([^)]+\)(?: · .*)?)$/);
	if (!tailMatch) return truncateToWidth(text, width, "...");
	const tail = tailMatch[1];
	const tailWidth = visibleWidth(tail);
	if (tailWidth >= width - 4) return truncateToWidth(text, width, "...");
	const head = text.slice(0, -tail.length);
	return `${truncateToWidth(head, width - tailWidth, "...")}${tail}`;
}

/**
 * Format token counts (similar to web-ui)
 */
function formatTokens(count: number): string {
	if (count < 1000) return count.toString();
	if (count < 10000) return `${(count / 1000).toFixed(1)}k`;
	if (count < 1000000) return `${Math.round(count / 1000)}k`;
	if (count < 10000000) return `${(count / 1000000).toFixed(1)}M`;
	return `${Math.round(count / 1000000)}M`;
}

/**
 * Format a cost value for compact display.
 * Uses fewer decimal places for larger amounts.
 * @internal Exported for testing only.
 */
export function formatPromptCost(cost: number): string {
	const n = Number.isFinite(Number(cost)) ? Number(cost) : 0;
	const sign = n < 0 ? "-" : "";
	return `${sign}$${Math.abs(n).toLocaleString("en-US", {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	})}`;
}

/**
 * Footer component that shows pwd, token stats, and context usage.
 * Computes token/context stats from session, gets git branch and extension statuses from provider.
 */
export class FooterComponent implements Component {
	private autoCompactEnabled = true;
	private toolOutputExpanded = false;

	constructor(
		private session: AgentSession,
		private footerData: ReadonlyFooterDataProvider,
	) {}

	setAutoCompactEnabled(enabled: boolean): void {
		this.autoCompactEnabled = enabled;
	}

	setToolOutputExpanded(expanded: boolean): void {
		this.toolOutputExpanded = expanded;
	}

	/**
	 * No-op: git branch caching now handled by provider.
	 * Kept for compatibility with existing call sites in interactive-mode.
	 */
	invalidate(): void {
		// No-op: git branch is cached/invalidated by provider
	}

	/**
	 * Clean up resources.
	 * Git watcher cleanup now handled by provider.
	 */
	dispose(): void {
		// Git watcher cleanup handled by provider
	}

	render(width: number): string[] {
		const state = this.session.state;

		const usageTotals = this.session.sessionManager.getUsageTotals();
		const totalInput = usageTotals.input;
		const totalOutput = usageTotals.output;
		const totalCacheRead = usageTotals.cacheRead;
		const totalCacheWrite = usageTotals.cacheWrite;
		const totalCost = usageTotals.cost;

		// Use activeInferenceModel during streaming to show the model actually
		// being used, not the configured model which may have been switched mid-turn.
		const displayModel = state.activeInferenceModel ?? state.model;

		// Calculate context usage from session (handles compaction correctly).
		// After compaction, tokens are unknown until the next LLM response.
		const contextUsage = this.session.getContextUsage();
		const contextWindow = contextUsage?.contextWindow ?? displayModel?.contextWindow ?? 0;
		const contextPercentValue = contextUsage?.percent ?? 0;
		const contextPercent = contextUsage?.percent !== null ? contextPercentValue.toFixed(1) : "?";

		// Replace home directory with ~
		let pwd = process.cwd();
		const home = process.env.HOME || process.env.USERPROFILE;
		if (home && pwd.startsWith(home)) {
			pwd = `~${pwd.slice(home.length)}`;
		}

		// Add git branch if available
		const branch = this.footerData.getGitBranch();
		if (branch) {
			pwd = `${pwd} (${branch})`;
		}

		// Add session name if set
		const sessionName = this.session.sessionManager.getSessionName();
		if (sessionName) {
			pwd = `${pwd} · ${sessionName}`;
		}

		// Build the plain Pi-style stats line: token details first, then cost
		// and context. Totals still come from the GSD-Pi session manager.
		const statsParts: string[] = [];
		const tokenParts: string[] = [];
		if (totalInput) tokenParts.push(`↑${formatTokens(totalInput)}`);
		if (totalOutput) tokenParts.push(`↓${formatTokens(totalOutput)}`);
		if (tokenParts.length > 0) statsParts.push(tokenParts.join(" "));

		const totalCacheTokens = totalCacheRead + totalCacheWrite;
		if (totalCacheTokens > 0) {
			statsParts.push(`Hit ${((totalCacheRead / totalCacheTokens) * 100).toFixed(1)}%`);
		}

		const usingSubscription = displayModel ? this.session.modelRegistry.isUsingOAuth(displayModel) : false;
		if (totalCost || usingSubscription) {
			const costStr = `${formatPromptCost(totalCost)}${usingSubscription ? " (sub)" : ""}`;
			statsParts.push(costStr);
		}

		// Per-prompt cost annotation (opt-in via show_token_cost preference, #1515)
		if (process.env.GSD_SHOW_TOKEN_COST === "1") {
			const lastTurnCost = this.session.getLastTurnCost();
			if (lastTurnCost > 0) {
				statsParts.push(`(last: ${formatPromptCost(lastTurnCost)})`);
			}
		}

		const autoIndicator = this.autoCompactEnabled ? " (auto)" : "";
		const contextPercentDisplay =
			contextPercent === "?"
				? `?/${formatTokens(contextWindow)}${autoIndicator}`
				: `${contextPercent}%/${formatTokens(contextWindow)}${autoIndicator}`;
		const contextPercentStr =
			contextPercentValue > 90
				? theme.fg("error", contextPercentDisplay)
				: contextPercentValue > 70
					? theme.fg("warning", contextPercentDisplay)
					: contextPercentDisplay;
		statsParts.push(contextPercentStr);

		let statsLeft = statsParts.join(" · ");

		// Add tool display mode and model name on the right side, plus thinking level if model supports it.
		const modelName = displayModel?.id || "no-model";

		let statsLeftWidth = visibleWidth(statsLeft);

		// If statsLeft is too wide, truncate it
		if (statsLeftWidth > width) {
			statsLeft = truncateToWidth(statsLeft, width, "...");
			statsLeftWidth = visibleWidth(statsLeft);
		}

		// Calculate available space for padding (minimum 2 spaces between stats and model)
		const minPadding = 2;

		let modelDisplay = modelName;
		if (displayModel?.reasoning) {
			const thinkingLevel = state.thinkingLevel || "off";
			modelDisplay =
				thinkingLevel === "off" ? `${modelName} · thinking off` : `${modelName} · ${thinkingLevel}`;
		}

		const toolDisplayMode = this.toolOutputExpanded ? "expanded mode" : "collapsed mode";
		const rightSide = `${toolDisplayMode} │ ${modelDisplay}`;

		const rightSideWidth = visibleWidth(rightSide);
		const totalNeeded = statsLeftWidth + minPadding + rightSideWidth;

		let statsLine: string;
		if (totalNeeded <= width) {
			const padding = " ".repeat(width - statsLeftWidth - rightSideWidth);
			statsLine = statsLeft + padding + rightSide;
		} else {
			const availableForRight = width - statsLeftWidth - minPadding;
			if (availableForRight > 0) {
				const truncatedRight = truncateToWidth(rightSide, availableForRight, "");
				const truncatedRightWidth = visibleWidth(truncatedRight);
				const padding = " ".repeat(Math.max(0, width - statsLeftWidth - truncatedRightWidth));
				statsLine = statsLeft + padding + truncatedRight;
			} else {
				statsLine = statsLeft;
			}
		}

		const dimStatsLeft = theme.fg("dim", statsLeft);
		const remainder = statsLine.slice(statsLeft.length);
		const dimRemainder = theme.fg("dim", remainder);
		const extensionStatuses = this.footerData.getExtensionStatuses();
		const statusLine =
			extensionStatuses.size > 0
				? Array.from(extensionStatuses.entries())
						.sort(([a], [b]) => a.localeCompare(b))
						.map(([, text]) => sanitizeStatusText(text))
						.join(" ")
				: "";

		let pwdContent = truncateFooterPath(pwd, width);
		if (statusLine) {
			const minGap = 2;
			const statusContent = truncateToWidth(statusLine, Math.max(1, width - minGap - 1), "...");
			const statusWidth = visibleWidth(statusContent);
			const pwdBudget = width - minGap - statusWidth;
			if (pwdBudget > 0) {
				const truncatedPwd = truncateFooterPath(pwd, pwdBudget);
				const padding = " ".repeat(Math.max(minGap, width - visibleWidth(truncatedPwd) - statusWidth));
				pwdContent = `${truncatedPwd}${padding}${statusContent}`;
			} else {
				pwdContent = truncateToWidth(statusContent, width, "...");
			}
		}

		const pwdLine = theme.fg("dim", pwdContent);
		const lines = [pwdLine, dimStatsLeft + dimRemainder];

		return lines;
	}
}
