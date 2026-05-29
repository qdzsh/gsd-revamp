// Project/App: GSD-2
// File Purpose: Startup welcome screen rendering for the GSD terminal experience.

/**
 * GSD Welcome Screen
 *
 * Command-center layout: GSD-Revamp logo, workspace,
 * model, and MCP summary.
 * Falls back to simple text on narrow terminals (<70 cols) or non-TTY.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import os from 'node:os'
import chalk from 'chalk'
import stripAnsi from 'strip-ansi'
import { formatDisplayModel } from './resources/extensions/shared/usage-display.js'

const GSD_REVAMP_LOGO: readonly string[] = [
  ' ██████╗ ███████╗██████╗       ██████╗ ',
  '██╔════╝ ██╔════╝██╔══██╗      ██╔══██╗',
  '██║  ███╗███████╗██║  ██║█████╗██████╔╝',
  '██║   ██║╚════██║██║  ██║╚════╝██╔══██╗',
  '╚██████╔╝███████║██████╔╝      ██║  ██║',
  ' ╚═════╝ ╚══════╝╚═════╝       ╚═╝  ╚═╝',
]

function countMcpServers(): number {
  const configPaths = [
    join(process.cwd(), '.mcp.json'),
    join(process.cwd(), '.gsd', 'mcp.json'),
  ]
  const seen = new Set<string>()
  for (const p of configPaths) {
    try {
      const raw = readFileSync(p, 'utf-8')
      const data = JSON.parse(raw) as Record<string, unknown>
      const servers = (data.mcpServers ?? data.servers) as
        | Record<string, unknown>
        | undefined
      if (!servers || typeof servers !== 'object') continue
      for (const name of Object.keys(servers)) seen.add(name)
    } catch {
      // missing or malformed config — ignore
    }
  }
  return seen.size
}

export interface WelcomeScreenOptions {
  version: string
  modelName?: string
  provider?: string
  authMode?: string
  thinkingLevel?: string
  remoteChannel?: string
  width?: number
  logoColorAnsi?: string
}

function getShortCwd(): string {
  const cwd = process.cwd()
  const home = os.homedir()
  return cwd.startsWith(home) ? '~' + cwd.slice(home.length) : cwd
}

/** Visible length — strips ANSI escape codes before measuring. */
function visLen(s: string): number {
  return stripAnsi(s).length
}

/** Right-pad a string to the given visible width. */
function rpad(s: string, w: number): string {
  const clamped = clampVisible(s, w)
  return clamped + ' '.repeat(Math.max(0, w - visLen(clamped)))
}

/** Clamp rendered terminal output by visible columns. Falls back to plain text only when truncating. */
function clampVisible(s: string, w: number): string {
  if (w <= 0) return ''
  if (visLen(s) <= w) return s
  const plain = stripAnsi(s)
  return plain.slice(0, Math.max(0, w - 1)) + '…'
}

export function buildWelcomeScreenLines(opts: WelcomeScreenOptions): string[] {
  const { version, remoteChannel } = opts
  const shortCwd = getShortCwd()
  const termWidth = Math.max(1, (opts.width ?? process.stderr.columns ?? 80) - 1)

  // Narrow terminal fallback
  if (termWidth < 70) {
    return [`GSD-Revamp CLI v${version}`, shortCwd]
  }

  const toolParts: string[] = []
  if (process.env.BRAVE_API_KEY)      toolParts.push('Brave ✓')
  if (process.env.BRAVE_ANSWERS_KEY)  toolParts.push('Answers ✓')
  if (process.env.JINA_API_KEY)       toolParts.push('Jina ✓')
  if (process.env.TAVILY_API_KEY)     toolParts.push('Tavily ✓')
  if (process.env.CONTEXT7_API_KEY)   toolParts.push('Context7 ✓')
  if (remoteChannel)                  toolParts.push(`${remoteChannel.charAt(0).toUpperCase() + remoteChannel.slice(1)} ✓`)

  const innerWidth = Math.max(1, termWidth - 2)
  const logoWidth = Math.max(...GSD_REVAMP_LOGO.map((line) => visLen(line)))
  // Plain spaces, not a `│` divider — a vertical bar would be dragged into
  // every copied logo row.
  const divider = '    '
  const panelWidth = innerWidth - logoWidth - visLen(divider)
  if (panelWidth < 34) {
    return [`GSD-Revamp CLI v${version}`, shortCwd]
  }

  const mcpCount = countMcpServers()
  const mcpText = toolParts.length > 0
    ? toolParts.join(' · ')
    : mcpCount > 0
      ? `${mcpCount} server${mcpCount === 1 ? '' : 's'} configured`
      : 'none configured'

  const value = (s: string) => chalk.hex('#dce4f2')(s)
  const brand = (s: string) => opts.logoColorAnsi
    ? `${opts.logoColorAnsi}${s}\x1b[39m`
    : chalk.hex('#2f8f46')(s)
  const modelName = formatDisplayModel(opts.modelName) || 'default'
  const thinking = opts.thinkingLevel && opts.thinkingLevel !== 'off' ? ` · ${opts.thinkingLevel}` : ''
  const modelInfo = `${modelName}${thinking}`
  const panelRows = [
    `${brand('GSD-Revamp CLI')} ${value(`v${version}`)}`,
    value(`Workspace: ${shortCwd}`),
    value(`Model: ${modelInfo}`),
    value(`MCP: ${mcpText}`),
  ]

  // ── Render ──────────────────────────────────────────────────────────────────
  // No outer box: logo + panel are indented. Every content line is plain text,
  // so terminal selection copies cleanly.
  const out: string[] = []
  for (let i = 0; i < GSD_REVAMP_LOGO.length; i++) {
    const logo = rpad(brand(GSD_REVAMP_LOGO[i]), logoWidth)
    out.push('  ' + clampVisible(`${logo}${divider}${panelRows[i] ?? ''}`, termWidth - 2))
  }

  return out.map((line) => clampVisible(line, termWidth))
}

export function printWelcomeScreen(opts: WelcomeScreenOptions): void {
  if (!process.stderr.isTTY) return
  process.stderr.write(buildWelcomeScreenLines(opts).join('\n') + '\n')
}
