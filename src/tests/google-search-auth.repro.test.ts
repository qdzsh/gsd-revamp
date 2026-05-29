import test from "node:test";
import assert from "node:assert/strict";
import googleSearchExtension from "../../extensions/google-search/index.ts";

function createMockPI() {
  const handlers: any[] = [];
  let registeredTool: any = null;

  return {
    handlers,
    registeredTool,
    on(event: string, handler: any) {
      handlers.push({ event, handler });
    },
    registerTool(tool: any) {
      this.registeredTool = tool;
    },
    async fire(event: string, eventData: any, ctx: any) {
      for (const h of handlers) {
        if (h.event === event) {
          await h.handler(eventData, ctx);
        }
      }
    }
  };
}

/**
 * Build a mock modelRegistry. Auth now relies solely on GEMINI_API_KEY, so the
 * registry no longer participates in google_search auth; this is a minimal stub.
 */
function mockModelRegistry(_oauthJson?: string) {
  return {
    authStorage: {
      hasAuth: async (_id: string) => false,
    },
    getApiKeyForProvider: async (_provider: string) => undefined,
  };
}

test("google-search warns if NO authentication is present", async (t) => {
  const originalKey = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;

  t.after(() => process.env.GEMINI_API_KEY = originalKey);
  const pi = createMockPI();
  googleSearchExtension(pi as any);

  const notifications: any[] = [];
  const mockCtx = {
    ui: { notify(msg: string, level: string) { notifications.push({ msg, level }); } },
    modelRegistry: mockModelRegistry(undefined),
  };

  await pi.fire("session_start", {}, mockCtx);
  assert.equal(notifications.length, 1);
  assert.ok(notifications[0].msg.includes("No authentication set"));

  const registeredTool = (pi as any).registeredTool;
  const result = await registeredTool.execute("call-2", { query: "test" }, new AbortController().signal, () => {}, mockCtx);
  assert.equal(result.isError, true);
  assert.ok(result.content[0].text.includes("No authentication found"));
});

test("google-search uses GEMINI_API_KEY if present (precedence)", async (t) => {
  process.env.GEMINI_API_KEY = "mock-api-key";

  t.after(() => delete process.env.GEMINI_API_KEY);
  const pi = createMockPI();
  googleSearchExtension(pi as any);

  const notifications: any[] = [];
  const mockCtx = {
    ui: { notify(msg: string, level: string) { notifications.push({ msg, level }); } },
    modelRegistry: mockModelRegistry(JSON.stringify({ token: "should-not-be-used", projectId: "mock-project" })),
  };

  await pi.fire("session_start", {}, mockCtx);
  assert.equal(notifications.length, 0, "Should NOT notify if API Key is present");
});
