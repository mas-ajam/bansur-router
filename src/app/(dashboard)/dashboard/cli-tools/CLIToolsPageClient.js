"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, Button, Badge, CardSkeleton } from "@/shared/components";
import { CLI_TOOLS, MITM_TOOLS } from "@/shared/constants/cliTools";
import { useCopyToClipboard } from "@/shared/hooks/useCopyToClipboard";

const ALL_STATUSES_URL = "/api/cli-tools/all-statuses";

// Placeholder the artifact specifies wherever a config carries the dashboard key.
const KEY = "your-dashboard-key";
// Fallback model placeholder — the same literal the per-tool detail components
// use when no model has been selected yet ("provider/model-id").
const MODEL = "provider/model-id";

// Two-letter tiles: artifact glyphs for its 8 tools; derived for the rest.
const GLYPHS = {
  claude: "CC",
  codex: "CX",
  cursor: "CU",
  cline: "CL",
  opencode: "OC",
  antigravity: "AG",
  copilot: "CP",
  openclaw: "OW",
};
function glyphFor(tool) {
  if (GLYPHS[tool.id]) return GLYPHS[tool.id];
  const words = (tool.name || tool.id).replace(/[^A-Za-z ]/g, " ").split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return (words[0] || tool.id).slice(0, 2).toUpperCase();
}

/**
 * Per-tool config snippets, lifted from the detail components'
 * getManualConfigs() (dashboard/cli-tools/components/*ToolCard.js) and the
 * constants guide/codeBlock entries, with the real key replaced by
 * `your-dashboard-key` and the endpoint built from the live origin.
 * Returns { comment, body, copyLabel, copyText, hint? } or { mitm: true, ... }.
 */
function buildToolConfig(tool, origin) {
  const base = `${origin}/v1`;
  switch (tool.id) {
    case "claude": {
      // ClaudeToolCard.getManualConfigs — ~/.claude/settings.json env block.
      const env = { ANTHROPIC_BASE_URL: origin, ANTHROPIC_AUTH_TOKEN: KEY };
      for (const m of tool.defaultModels || []) {
        if (m.envKey && m.defaultValue) env[m.envKey] = m.defaultValue;
      }
      const body = JSON.stringify({ hasCompletedOnboarding: true, env }, null, 2);
      const sonnet = (tool.defaultModels || []).find((m) => m.id === "sonnet");
      return {
        comment: `# ${tool.settingsFile || "~/.claude/settings.json"}`,
        body,
        copyLabel: "Copy config",
        copyText: body,
        hint: sonnet?.defaultValue ? (
          <>Model: <span className="font-mono">{sonnet.defaultValue}</span></>
        ) : null,
      };
    }
    case "codex": {
      // CodexToolCard.getManualConfigs — ~/.codex/config.toml.
      const body = `model = "${MODEL}"\nmodel_provider = "bansur-router"\n\n[model_providers.bansur-router]\nname = "Bansur Router"\nbase_url = "${base}"\nwire_api = "responses"\n\n[model_providers.bansur-router.http_headers]\nAuthorization = "Bearer ${KEY}"`;
      return {
        comment: "# ~/.codex/config.toml",
        body,
        copyLabel: "Copy config",
        copyText: body,
        hint: (
          <>Endpoint: <span className="font-mono">{base}</span></>
        ),
      };
    }
    case "cursor":
      // Guide tool (constants guideSteps): configured in Cursor's settings UI.
      return {
        comment: "# Cursor > Settings > Models",
        body: `Override OpenAI Base URL:\n  ${base}\nAPI Key: ${KEY}\nModel:   ${MODEL}`,
        copyLabel: "Copy base URL",
        copyText: base,
        hint: "One-time setup in Cursor settings",
      };
    case "cline":
      // Artifact settings-UI pattern; ClineToolCard persists the same
      // base URL / key / model through the Cline settings API.
      return {
        comment: "# Cline > API Provider: OpenAI Compatible",
        body: `Base URL: ${base}\nAPI Key:  ${KEY}\nModel ID: ${MODEL}`,
        copyLabel: "Copy base URL",
        copyText: base,
      };
    case "opencode": {
      // OpenCodeToolCard.getManualConfigs — ~/.config/opencode/opencode.json.
      const body = JSON.stringify(
        {
          provider: {
            "bansur-router": {
              npm: "@ai-sdk/openai-compatible",
              options: { baseURL: base, apiKey: KEY },
              models: { [MODEL]: { name: MODEL, modalities: { input: ["text", "image"], output: ["text"] } } },
            },
          },
          model: `bansur-router/${MODEL}`,
        },
        null,
        2
      );
      return { comment: "# ~/.config/opencode/opencode.json", body, copyLabel: "Copy base URL", copyText: base };
    }
    case "openclaw": {
      // OpenClawToolCard.getManualConfigs — ~/.openclaw/openclaw.json.
      const body = JSON.stringify(
        {
          agents: { defaults: { model: { primary: `bansur-router/${MODEL}` } } },
          models: {
            providers: {
              "bansur-router": {
                baseUrl: base,
                apiKey: KEY,
                api: "openai-completions",
                models: [{ id: MODEL, name: MODEL.split("/").pop() }],
              },
            },
          },
        },
        null,
        2
      );
      return { comment: "# ~/.openclaw/openclaw.json", body, copyLabel: "Copy config", copyText: body };
    }
    case "copilot": {
      // CopilotToolCard.getManualConfigs — VS Code chatLanguageModels.json.
      const body = JSON.stringify(
        [
          {
            name: "Bansur Router",
            vendor: "azure",
            apiKey: KEY,
            models: [
              {
                id: MODEL,
                name: MODEL,
                url: `${base}/chat/completions#models.ai.azure.com`,
                toolCalling: true,
                vision: false,
                maxInputTokens: 128000,
                maxOutputTokens: 16000,
              },
            ],
          },
        ],
        null,
        2
      );
      return {
        comment: "# ~/Library/Application Support/Code/User/chatLanguageModels.json",
        body,
        copyLabel: "Copy config",
        copyText: body,
      };
    }
    case "cowork": {
      // CoworkToolCard.getManualConfigs — Claude-3p configLibrary entry.
      const body = JSON.stringify(
        {
          inferenceProvider: "gateway",
          inferenceGatewayBaseUrl: base,
          inferenceGatewayApiKey: KEY,
          inferenceModels: [{ name: MODEL }],
        },
        null,
        2
      );
      return {
        comment: "# ~/Library/Application Support/Claude-3p/configLibrary/<appliedId>.json",
        body,
        copyLabel: "Copy config",
        copyText: body,
      };
    }
    case "hermes": {
      // HermesToolCard.getManualConfigs — ~/.hermes/config.yaml (the key itself
      // is referenced from ~/.hermes/.env as ${OPENAI_API_KEY}).
      const body = `model:\n  default: "${MODEL}"\n  provider: "custom"\n  base_url: "${base}"\n  api_key: \${OPENAI_API_KEY}`;
      return { comment: "# ~/.hermes/config.yaml", body, copyLabel: "Copy config", copyText: body };
    }
    case "droid": {
      // DroidToolCard.getManualConfigs — ~/.factory/settings.json.
      const body = JSON.stringify(
        {
          customModels: [
            {
              model: MODEL,
              id: "custom:Bansur Router-0",
              index: 0,
              baseUrl: base,
              apiKey: KEY,
              displayName: MODEL,
              maxOutputTokens: 131072,
              noImageSupport: false,
              provider: "openai",
            },
          ],
        },
        null,
        2
      );
      return { comment: "# ~/.factory/settings.json", body, copyLabel: "Copy config", copyText: body };
    }
    case "kilo": {
      // KiloToolCard.getManualConfigs — ~/.local/share/kilo/auth.json.
      const body = JSON.stringify(
        { "openai-compatible": { type: "api-key", apiKey: KEY, baseUrl: base, model: MODEL } },
        null,
        2
      );
      return { comment: "# ~/.local/share/kilo/auth.json", body, copyLabel: "Copy config", copyText: body };
    }
    case "roo":
      // Guide tool (constants guideSteps): Roo settings, Ollama provider slot.
      return {
        comment: "# Roo Settings · API Provider: Ollama",
        body: `Base URL: ${base}\nAPI Key:  ${KEY}\nModel:    ${MODEL}`,
        copyLabel: "Copy base URL",
        copyText: base,
      };
    case "continue": {
      // Constants codeBlock for Continue's models array.
      const body = `{\n  "apiBase": "${base}",\n  "title": "${MODEL}",\n  "model": "${MODEL}",\n  "provider": "openai",\n  "apiKey": "${KEY}"\n}`;
      return { comment: "# Continue config · models array", body, copyLabel: "Copy config", copyText: body };
    }
    case "amp": {
      // Constants codeBlock (bash env).
      const envLines = `export OPENAI_API_KEY="${KEY}"\nexport OPENAI_BASE_URL="${base}"`;
      return {
        comment: "# environment",
        body: `${envLines}\namp --model "${MODEL}"`,
        copyLabel: "Copy env",
        copyText: envLines,
      };
    }
    case "qwen": {
      // Constants codeBlock — ~/.qwen/settings.json.
      const body = JSON.stringify(
        {
          security: { auth: { selectedType: "openai", apiKey: KEY, baseUrl: base } },
          model: { name: MODEL },
        },
        null,
        2
      );
      return { comment: "# ~/.qwen/settings.json", body, copyLabel: "Copy config", copyText: body };
    }
    case "deepseek-tui": {
      // DeepSeekTuiToolCard.getManualConfigs — ~/.deepseek/config.toml.
      const body = `[providers.openai]\nbase_url = "${base}"\napi_key = "${KEY}"\nmodel = "${MODEL}"`;
      return { comment: "# ~/.deepseek/config.toml", body, copyLabel: "Copy config", copyText: body };
    }
    case "jcode": {
      // JcodeToolCard.getManualConfigs — ~/.jcode/config.toml.
      const defaultModel = "cc/claude-opus-4-7";
      const body = `[providers.bansur-router]\ntype = "openai-compatible"\nbase_url = "${base}"\nauth = "bearer"\napi_key_env = "JCODE_BANSUR_ROUTER_API_KEY"\nenv_file = "provider-bansur-router.env"\ndefault_model = "${defaultModel}"\nrequires_api_key = true\n\n[[providers.bansur-router.models]]\nid = "${defaultModel}"`;
      return { comment: "# ~/.jcode/config.toml", body, copyLabel: "Copy config", copyText: body };
    }
    case "grok-build": {
      // GrokBuildToolCard.getManualConfigs — ~/.grok/config.toml.
      const body = `[models]\ndefault = "bansur-router"\n\n[model.bansur-router]\nmodel = "${MODEL}"\nbase_url = "${base}"\nname = "Bansur Router"\ndescription = "Routed via Bansur Router gateway"\napi_backend = "chat_completions"\napi_key = "${KEY}"\ncontext_window = 200000`;
      return { comment: "# ~/.grok/config.toml", body, copyLabel: "Copy config", copyText: body };
    }
    case "devin": {
      // Constants codeBlock: Devin is a local dependency, not a routed CLI —
      // the snippet is its install/auth commands.
      const body = tool.codeBlock?.code || "devin auth login";
      return { comment: "# terminal", body, copyLabel: "Copy config", copyText: body };
    }
    case "opendesign": {
      // Constants codeBlock: per-host plugin install commands; OpenDesign
      // inherits the host agent's model config (no endpoint of its own).
      const body = tool.codeBlock?.code || "";
      return { comment: "# install (per host)", body, copyLabel: "Copy config", copyText: body };
    }
    case "pi": {
      // GenericCliToolCard — ~/.pi/agent/models.json.
      const body = JSON.stringify(
        {
          providers: {
            "bansur-router": {
              baseUrl: base,
              apiKey: KEY,
              api: "openai-completions",
              models: [{ id: MODEL, name: MODEL, contextWindow: 128000, maxTokens: 16384 }],
            },
          },
        },
        null,
        2
      );
      return { comment: "# ~/.pi/agent/models.json", body, copyLabel: "Copy config", copyText: body };
    }
    case "omp": {
      // GenericCliToolCard — ~/.omp/agent/models.yml.
      const body = `providers:\n  bansur-router:\n    baseUrl: ${base}\n    apiKey: ${KEY}\n    api: openai-completions\n    authHeader: true\n    disableStrictTools: true\n    discovery:\n      type: proxy`;
      return { comment: "# ~/.omp/agent/models.yml", body, copyLabel: "Copy config", copyText: body };
    }
    case "crush": {
      // GenericCliToolCard — ~/.config/crush/crush.json.
      const body = JSON.stringify(
        {
          providers: {
            "bansur-router": {
              type: "openai-compat",
              base_url: base,
              api_key: KEY,
              models: [{ id: MODEL, name: MODEL, context_window: 128000 }],
            },
          },
        },
        null,
        2
      );
      return { comment: "# ~/.config/crush/crush.json", body, copyLabel: "Copy config", copyText: body };
    }
    case "forge": {
      // GenericCliToolCard — ~/.forge/config.toml.
      const body = `# Forge config — managed by Bansur Router\n\n[openai]\napi_key = "${KEY}"\nbase_url = "${base}"\nmodel = "${MODEL}"`;
      return { comment: "# ~/.forge/config.toml", body, copyLabel: "Copy config", copyText: body };
    }
    case "smelt": {
      // GenericCliToolCard — ~/.smelt/config.json.
      const body = JSON.stringify({ baseUrl: base, apiKey: KEY, model: MODEL, _managedBy: "bansur-router" }, null, 2);
      return { comment: "# ~/.smelt/config.json", body, copyLabel: "Copy config", copyText: body };
    }
    case "codewhale": {
      // GenericCliToolCard — ~/.codewhale/config.toml.
      const body = `# CodeWhale config — managed by Bansur Router\n\n[openai]\nbase_url = "${base}"\napi_key = "${KEY}"\nmodel = "${MODEL}"`;
      return { comment: "# ~/.codewhale/config.toml", body, copyLabel: "Copy config", copyText: body };
    }
    default: {
      // No config snippet exists anywhere for this tool — minimal factual
      // snippet composed from its constants entry (base URL + key + model).
      if (tool.configType === "mitm") {
        return { mitm: true, comment: "# No config file needed", body: "" };
      }
      return {
        comment: "# OpenAI-compatible endpoint",
        body: `baseUrl: ${base}\napiKey:  ${KEY}\nmodel:   ${MODEL}`,
        copyLabel: "Copy base URL",
        copyText: base,
      };
    }
  }
}

function metaFor(tool, status) {
  if (tool.configType === "mitm") return "Intercepted through MITM proxy";
  if (status) {
    if (status.installed === false) return "Not installed";
    if (status.installed && status.hasBansurRouter) return "Detected · configured";
    if (status.installed) return "Detected · not configured";
  }
  return tool.description || "";
}

export default function CLIToolsPageClient({ machineId }) {
  const [loading, setLoading] = useState(true);
  const [toolStatuses, setToolStatuses] = useState({});
  const [origin, setOrigin] = useState("http://localhost:667");
  const { copy } = useCopyToClipboard();

  useEffect(() => {
    if (typeof window !== "undefined") setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch(ALL_STATUSES_URL);
        if (res.ok && mounted) setToolStatuses(await res.json());
      } catch (error) {
        console.log("Error fetching tool statuses:", error);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="grid gap-3.5 grid-cols-1 min-[821px]:grid-cols-2">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  // All tools in one grid — no separate MITM group (CT-06).
  const allTools = [...Object.values(CLI_TOOLS), ...Object.values(MITM_TOOLS)];

  return (
    <div className="flex flex-col">
      {/* Page head */}
      <div className="mb-5">
        <h2 className="text-xl font-semibold tracking-[-0.01em]">CLI Tools</h2>
        <p className="mt-1 text-[13.5px] text-text-muted max-w-[640px]">Point any supported coding tool at the router once. Each card carries the exact configuration the tool needs.</p>
      </div>

      <div className="grid gap-3.5 grid-cols-1 min-[821px]:grid-cols-2">
        {allTools.map((tool) => {
          const status = toolStatuses[tool.id];
          const connected = status?.hasBansurRouter === true;
          const isMitm = tool.configType === "mitm";
          const config = buildToolConfig(tool, origin);
          return (
            <Card key={tool.id} padding="sm" className="flex flex-col gap-3">
              <div className="flex items-center gap-3 mb-3.5">
                <div className="w-[38px] h-[38px] shrink-0 border border-border-strong rounded-md bg-surface-2 flex items-center justify-center font-mono text-[13px] font-semibold">
                  {glyphFor(tool)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm leading-[1.25]">{tool.name}</div>
                  <div className="text-xs text-text-muted">{metaFor(tool, status)}</div>
                </div>
                {connected ? <Badge variant="primary">Connected</Badge> : <Badge>Not configured</Badge>}
              </div>

              {isMitm ? (
                <div className="bg-brand-500 text-[#e8ebed] rounded-brand px-4 py-3.5 font-mono text-[12.5px] leading-[1.65] overflow-x-auto whitespace-pre">
                  <span className="text-[#8b949c]"># No config file needed</span>
                  {"\n"}
                  {`${tool.name} traffic is routed by the\nMITM layer. Enable it under MITM,\nthen restart the tool.`}
                </div>
              ) : (
                <div className="bg-brand-500 text-[#e8ebed] rounded-brand px-4 py-3.5 font-mono text-[12.5px] leading-[1.65] overflow-x-auto whitespace-pre">
                  <span className="text-[#8b949c]">{config.comment}</span>
                  {"\n"}
                  {config.body}
                </div>
              )}

              <div className="flex items-center gap-2.5 mt-3.5">
                {isMitm ? (
                  <Link href="/dashboard/mitm">
                    <Button variant="secondary" size="sm">Open MITM</Button>
                  </Link>
                ) : (
                  <Button variant="secondary" size="sm" onClick={() => copy(config.copyText, `cli-${tool.id}`)}>
                    {config.copyLabel}
                  </Button>
                )}
                {config.hint && <span className="text-xs text-text-muted">{config.hint}</span>}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
