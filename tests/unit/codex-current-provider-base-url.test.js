import { describe, expect, it } from "vitest";
import { getCurrentCodexProviderBaseUrl, getCurrentCodexProviderSettings } from "../../src/app/(dashboard)/dashboard/cli-tools/components/codexConfig.js";

describe("Codex current provider base URL", () => {
  it("uses the base URL from the configured model provider, not an earlier provider", () => {
    const config = `model = "gpt-5"
model_provider = "bansur-router"

[model_providers.omniroute]
base_url = "https://omniroute.example/v1"

[model_providers.bansur-router]
base_url = "http://127.0.0.1:20128/v1"
`;

    expect(getCurrentCodexProviderBaseUrl(config)).toBe("http://127.0.0.1:20128/v1");
  });

  it("reads the active provider URL and bearer key when another provider appears first", () => {
    const config = `model_provider = "bansur-router"

[model_providers.omniroute]
base_url = "https://omniroute.example/v1"

[model_providers.omniroute.http_headers]
Authorization = "Bearer placeholder-omniroute-key"

[model_providers.bansur-router]
base_url = "https://bansur-router.example/v1/"

[model_providers.bansur-router.http_headers]
Authorization = "Bearer placeholder-bansur-router-key"
`;

    expect(getCurrentCodexProviderSettings(config)).toEqual({
      baseUrl: "https://bansur-router.example/v1/",
      apiKey: "placeholder-bansur-router-key",
    });
  });

  it("returns empty settings when no active provider is configured", () => {
    expect(getCurrentCodexProviderSettings("model = \"gpt-5\"\n")).toEqual({ baseUrl: "", apiKey: "" });
  });
});
