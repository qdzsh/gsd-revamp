import { existsSync, mkdirSync, readdirSync, renameSync } from 'node:fs'
import { join } from 'node:path'
import { getProjectSessionsDir } from './project-sessions.js'

export interface CliFlags {
  mode?: 'text' | 'json' | 'rpc' | 'mcp'
  print?: boolean
  continue?: boolean
  noSession?: boolean
  worktree?: boolean | string
  model?: string
  listModels?: string | true
  extensions: string[]
  appendSystemPrompt?: string
  tools?: string[]
  messages: string[]

  /** Set by `gsd sessions` when the user picks a specific session to resume */
  _selectedSessionPath?: string
}

export function parseCliArgs(argv: string[]): CliFlags {
  const flags: CliFlags = { extensions: [], messages: [] }
  const args = argv.slice(2)
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '--mode' && i + 1 < args.length) {
      const mode = args[++i]
      if (mode === 'text' || mode === 'json' || mode === 'rpc' || mode === 'mcp') flags.mode = mode
    } else if (arg === '--print' || arg === '-p') {
      flags.print = true
    } else if (arg === '--continue' || arg === '-c') {
      flags.continue = true
    } else if (arg === '--no-session') {
      flags.noSession = true
    } else if (arg === '--worktree' || arg === '-w') {
      if (i + 1 < args.length && !args[i + 1].startsWith('-')) {
        flags.worktree = args[++i]
      } else {
        flags.worktree = true
      }
    } else if (arg === '--model' && i + 1 < args.length) {
      flags.model = args[++i]
    } else if (arg === '--extension' && i + 1 < args.length) {
      flags.extensions.push(args[++i])
    } else if (arg === '--append-system-prompt' && i + 1 < args.length) {
      flags.appendSystemPrompt = args[++i]
    } else if (arg === '--tools' && i + 1 < args.length) {
      flags.tools = args[++i].split(',')
    } else if (arg === '--list-models') {
      flags.listModels = (i + 1 < args.length && !args[i + 1].startsWith('-')) ? args[++i] : true
    } else if (!arg.startsWith('--') && !arg.startsWith('-')) {
      flags.messages.push(arg)
    }
  }
  return flags
}

export function buildHeadlessAutoArgs(flags: Pick<CliFlags, 'messages' | 'model'>): string[] {
  return flags.model ? ['--model', flags.model, ...flags.messages] : [...flags.messages]
}

export { getProjectSessionsDir } from './project-sessions.js'

export function migrateLegacyFlatSessions(baseSessionsDir: string, projectSessionsDir: string): void {
  if (!existsSync(baseSessionsDir)) return

  try {
    const entries = readdirSync(baseSessionsDir)
    const flatJsonl = entries.filter((file) => file.endsWith('.jsonl'))
    if (flatJsonl.length === 0) return

    mkdirSync(projectSessionsDir, { recursive: true })
    for (const file of flatJsonl) {
      const src = join(baseSessionsDir, file)
      const dst = join(projectSessionsDir, file)
      if (!existsSync(dst)) {
        renameSync(src, dst)
      }
    }
  } catch {
    // Non-fatal: don't block startup if migration fails.
  }
}
