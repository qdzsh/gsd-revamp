import test from 'node:test'
import assert from 'node:assert/strict'
const mcpServerUrl = new URL('../mcp-server.js', import.meta.url).href

test('mcp-server module imports without errors', async () => {
  const mod = await import(mcpServerUrl)
  assert.ok(mod, 'module should be importable')
  assert.strictEqual(typeof mod.startMcpServer, 'function', 'startMcpServer should be a function')
})

test('startMcpServer accepts the correct argument shape', async () => {
  const { startMcpServer } = await import(mcpServerUrl)

  assert.strictEqual(typeof startMcpServer, 'function')
  assert.strictEqual(startMcpServer.length, 1, 'startMcpServer should accept one argument')
})

test('compiled MCP runtime dependencies resolve with explicit .js subpaths', async () => {
  const stdioMod = await import('@modelcontextprotocol/sdk/server/stdio.js')
  const typesMod = await import('@modelcontextprotocol/sdk/types.js')

  assert.strictEqual(typeof stdioMod.StdioServerTransport, 'function')
  assert.ok(typesMod.ListToolsRequestSchema, 'ListToolsRequestSchema should be exported')
  assert.ok(typesMod.CallToolRequestSchema, 'CallToolRequestSchema should be exported')
})
