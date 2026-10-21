export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { initConsoleLogCapture } = await import("@/lib/consoleLogBuffer");
    initConsoleLogCapture();

    // Server-only: lets capabilities.js read the synced catalog without pulling
    // node:fs into the dashboard's browser bundle.
    const { installCatalogSource } = await import("open-sse/providers/catalogOverride.js");
    await installCatalogSource();

    const { startModelCatalogSync } = await import("@/lib/modelCatalog/sync.js");
    startModelCatalogSync();

    // Out-of-the-box Default Key. Upstream gets this guarantee from its
    // landing page (Endpoint & Key auto-provisions a "Default Key" on load
    // when the key list is empty). Since the parity rebuild made the
    // Overview the landing page, a fresh instance could sit at zero API
    // keys indefinitely — and with requireApiKey on by default, the
    // internal model-test ping then presents no key and every test fails
    // with the gateway's 401 "Missing API key". Provision at boot, only
    // when the table is completely empty, with the same calls the
    // /api/keys route uses. Never block boot on failure.
    try {
      const { getApiKeys, createApiKey } = await import("@/lib/localDb");
      const { getConsistentMachineId } = await import("@/shared/utils/machineId");
      const keys = await getApiKeys();
      if (!keys || keys.length === 0) {
        await createApiKey("Default Key", await getConsistentMachineId());
      }
    } catch { /* provisioning must never block boot */ }
  }
}
