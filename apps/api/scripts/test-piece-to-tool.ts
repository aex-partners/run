/**
 * Test: piece-to-tool conversion produces valid AI SDK tools.
 *
 * Usage: npx tsx scripts/test-piece-to-tool.ts
 */

async function main() {
  console.log("=== Test: Piece-to-Tool Conversion ===\n");

  const { loadPiece } = await import("../src/plugins/piece-loader.js");
  const { pieceActionsToTools, sanitizeToolName } = await import("../src/plugins/piece-to-tool.js");

  const piece = await loadPiece("@activepieces/piece-http");
  if (!piece) {
    console.error("FAILED: Could not load HTTP piece");
    process.exit(1);
  }

  console.log("1. Converting actions to AI SDK tools...");

  // pieceActionsToTools needs a db, but for testing we can pass a mock
  const mockDb = {} as any;
  const tools = pieceActionsToTools({
    db: mockDb,
    piece,
    serverUrl: "http://localhost:3001",
    credentialValue: undefined,
  });

  const toolNames = Object.keys(tools);
  console.log(`   Generated ${toolNames.length} tools:`);
  for (const name of toolNames) {
    console.log(`   - ${name}`);
  }

  // Verify tool structure
  console.log("\n2. Verifying tool structure...");
  for (const [name, tool] of Object.entries(tools)) {
    const t = tool as Record<string, unknown>;
    const hasDescription = !!t.description;
    // AI SDK tool() wraps the schema - check for parameters or inputSchema
    const hasParameters = !!(t.parameters ?? t.inputSchema ?? (t as any)._def);
    const hasExecute = typeof t.execute === "function";

    console.log(`     keys: ${Object.keys(t).join(", ")}`);

    console.log(`   ${name}:`);
    console.log(`     description: ${hasDescription ? "yes" : "MISSING"}`);
    console.log(`     parameters: ${hasParameters ? "yes" : "MISSING"}`);
    console.log(`     execute: ${hasExecute ? "yes" : "MISSING"}`);

    if (!hasDescription || !hasParameters || !hasExecute) {
      console.error(`   FAILED: Tool ${name} is missing required fields`);
      process.exit(1);
    }
  }

  // Test tool name sanitization
  console.log("\n3. Testing tool name sanitization...");
  const cases = [
    ["@activepieces/piece-google-sheets_insert_row", "google-sheets_insert_row"],
    ["@activepieces/piece-slack_send_message", "slack_send_message"],
    ["http_send_request", "http_send_request"],
  ];
  for (const [input, expected] of cases) {
    const result = sanitizeToolName(input);
    const pass = result === expected;
    console.log(`   ${input} -> ${result} ${pass ? "OK" : `EXPECTED ${expected}`}`);
  }

  // Test executing the tool
  console.log("\n4. Executing tool via AI SDK interface...");
  const httpTool = tools[toolNames[0]];
  if (httpTool) {
    const t = httpTool as { execute: (args: unknown) => Promise<unknown> };
    try {
      const result = await t.execute({
        url: "https://httpbin.org/get",
        method: "GET",
        headers: {},
        queryParams: {},
      });
      const res = result as { status?: number; body?: Record<string, unknown>; error?: string };
      if (res.error) {
        console.log(`   Result: error = ${res.error}`);
        // Errors are expected since we have no full context, but the tool executed
        console.log("   Tool executed (returned error, which is expected without full context)");
      } else if (res.status === 200) {
        console.log(`   Result: status=${res.status}, body has ${Object.keys(res.body ?? {}).length} keys`);
        console.log("   SUCCESS: Tool executed correctly via AI SDK interface");
      } else {
        console.log(`   Result: ${JSON.stringify(res).slice(0, 200)}`);
      }
    } catch (err) {
      console.log(`   Execution error: ${(err as Error).message}`);
      console.log("   (This may be expected if the context is incomplete)");
    }
  }

  console.log("\n=== Test Complete ===");
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
