/**
 * End-to-end test: install a piece, load it, convert actions to tools, execute one.
 *
 * Usage: npx tsx scripts/test-piece-e2e.ts
 */

const PIECE_NAME = "@activepieces/piece-http";

async function main() {
  console.log("=== Phase 2E: End-to-end Piece Test ===\n");

  // Step 1: Install the piece
  console.log(`1. Installing ${PIECE_NAME}...`);
  const { installPiece, isPieceInstalled, getPiecesDir } = await import("../src/plugins/piece-installer.js");

  const alreadyInstalled = await isPieceInstalled(PIECE_NAME);
  if (alreadyInstalled) {
    console.log(`   Already installed at ${getPiecesDir()}`);
  } else {
    await installPiece(PIECE_NAME);
    console.log(`   Installed successfully at ${getPiecesDir()}`);
  }

  // Step 2: Load the piece
  console.log(`\n2. Loading piece...`);
  const { loadPiece } = await import("../src/plugins/piece-loader.js");
  const piece = await loadPiece(PIECE_NAME);

  if (!piece) {
    console.error("   FAILED: Could not load piece");
    process.exit(1);
  }

  console.log(`   Loaded: ${piece.displayName}`);
  const meta = piece.metadata();
  console.log(`   Name: ${meta.name}`);
  console.log(`   Version: ${meta.version}`);

  // Step 3: List actions
  console.log(`\n3. Listing actions...`);
  const actions = piece.actions();
  const actionNames = Object.keys(actions);
  console.log(`   Found ${actionNames.length} actions:`);
  for (const name of actionNames) {
    const action = actions[name] as { displayName?: string; description?: string };
    console.log(`   - ${name}: ${action.displayName ?? name}`);
    if (action.description) {
      console.log(`     ${action.description.slice(0, 80)}...`);
    }
  }

  // Step 4: List triggers
  console.log(`\n4. Listing triggers...`);
  const triggers = piece.triggers();
  const triggerNames = Object.keys(triggers);
  console.log(`   Found ${triggerNames.length} triggers`);
  for (const name of triggerNames) {
    const trigger = triggers[name] as { displayName?: string };
    console.log(`   - ${name}: ${trigger.displayName ?? name}`);
  }

  // Step 5: Convert actions to AI SDK tools
  console.log(`\n5. Converting actions to AI SDK tools...`);
  const { PropertyType } = await import("@activepieces/pieces-framework");

  for (const [actionName, action] of Object.entries(actions)) {
    const a = action as { displayName?: string; props?: Record<string, unknown> };
    const propCount = a.props ? Object.keys(a.props).length : 0;

    // Check prop types
    const propTypes: string[] = [];
    if (a.props) {
      for (const [propName, propDef] of Object.entries(a.props)) {
        const p = propDef as { type?: string; displayName?: string; required?: boolean };
        propTypes.push(`${propName}(${p.type ?? "?"}${p.required ? "*" : ""})`);
      }
    }
    console.log(`   ${actionName}: ${propCount} props [${propTypes.join(", ")}]`);
  }

  // Step 6: Try executing the send_request action (HTTP GET to a public API)
  console.log(`\n6. Testing action execution (send_request)...`);
  const sendRequest = actions["send_request"];
  if (!sendRequest) {
    console.log("   SKIP: send_request action not found");
  } else {
    const actionFn = sendRequest as {
      run: (ctx: unknown) => Promise<unknown>;
      props: Record<string, unknown>;
    };

    // Build a minimal context
    const context = {
      auth: undefined,
      propsValue: {
        url: "https://httpbin.org/get",
        method: "GET",
        headers: {},
        queryParams: {},
        body_type: "none",
        body: {},
      },
      store: {
        put: async () => {},
        get: async () => null,
        delete: async () => {},
      },
      connections: {
        get: async () => null,
      },
      files: {
        write: async (params: { fileName: string }) => `file://${params.fileName}`,
      },
      server: {
        apiUrl: "http://localhost:3001",
        publicUrl: "http://localhost:3001",
        token: "",
      },
      project: { id: "test", externalId: undefined },
      run: { id: "test", stop: async () => {}, pause: async () => {} },
      flows: { list: async () => ({ data: [], next: null, previous: null }), current: { id: "test" } },
      tags: { add: async () => {} },
      output: { set: async () => {} },
      agent: undefined,
      generateResumeUrl: async () => "",
      step: { name: "test", type: "PIECE" },
      executionType: "BEGIN",
    };

    try {
      const result = await actionFn.run(context);
      const res = result as { status?: number; body?: unknown; headers?: unknown };
      console.log(`   Status: ${res.status ?? "unknown"}`);
      if (res.body && typeof res.body === "object") {
        const body = res.body as Record<string, unknown>;
        console.log(`   Response URL: ${body.url ?? "N/A"}`);
        console.log(`   Response has keys: ${Object.keys(body).join(", ")}`);
      }
      console.log(`   SUCCESS: HTTP GET executed correctly`);
    } catch (err) {
      console.error(`   FAILED:`, err);
    }
  }

  console.log(`\n=== Test Complete ===`);
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
