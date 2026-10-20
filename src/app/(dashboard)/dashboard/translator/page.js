"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Card, Button, Select } from "@/shared/components";
import { useCopyToClipboard } from "@/shared/hooks/useCopyToClipboard";

// Sample payloads — copied from the artifact's translator JS (one per format).
const SAMPLES = {
  openai: { model: "kr/claude-sonnet-4.5", messages: [{ role: "system", content: "You are a careful coding assistant." }, { role: "user", content: "Explain what this router does in one sentence." }], temperature: 0.7, max_tokens: 512 },
  claude: { model: "kr/claude-sonnet-4.5", system: "You are a careful coding assistant.", messages: [{ role: "user", content: [{ type: "text", text: "Explain what this router does in one sentence." }] }], max_tokens: 512, temperature: 0.7 },
  gemini: { model: "kr/claude-sonnet-4.5", systemInstruction: { parts: [{ text: "You are a careful coding assistant." }] }, contents: [{ role: "user", parts: [{ text: "Explain what this router does in one sentence." }] }], generationConfig: { temperature: 0.7, maxOutputTokens: 512 } },
};

const FORMAT_OPTIONS = [
  { value: "openai", label: "OpenAI format" },
  { value: "claude", label: "Claude format" },
  { value: "gemini", label: "Gemini format" },
];

async function postTranslate(payload) {
  const res = await fetch("/api/translator/translate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res.json();
}

export default function TranslatorPage() {
  const [from, setFrom] = useState("openai");
  const [to, setTo] = useState("claude");
  const [source, setSource] = useState(() => JSON.stringify(SAMPLES.openai, null, 2));
  const [output, setOutput] = useState("");
  const [busy, setBusy] = useState(false);
  const { copy } = useCopyToClipboard();
  const runIdRef = useRef(0);

  // Conversion wiring (TR-03) — pivots through OpenAI on the real
  // /api/translator/translate machinery, exactly like the old debugger:
  //   step 2: source body -> OpenAI intermediate (format auto-detected
  //           server-side from the body shape, as the debugger relied on)
  //   step 1: detect { provider, model, targetFormat } from the body
  //   step 3: OpenAI intermediate -> the provider's target format
  // Step 3's target format is a property of the model's provider, so a
  // cross-format leg is only performed when the detected provider actually
  // targets the requested format — otherwise the limitation is reported in
  // the output pane instead of simulating a conversion client-side.
  const runTranslate = useCallback(async (srcText, fromFmt, toFmt) => {
    const runId = ++runIdRef.current;
    let parsed;
    try {
      parsed = JSON.parse(srcText);
    } catch {
      setOutput("Source is not valid JSON.");
      return;
    }
    const header = `// ${fromFmt} -> ${toFmt}  (applied by the proxy per request)`;
    if (fromFmt === toFmt) {
      setOutput(`${header}\n${JSON.stringify(parsed, null, 2)}`);
      return;
    }
    setBusy(true);
    try {
      // Leg 1: source -> OpenAI intermediate (skipped when already OpenAI).
      let openaiBody = parsed;
      if (fromFmt !== "openai") {
        const data = await postTranslate({ step: 2, body: parsed });
        if (!data.success) throw new Error(data.error || "Translation failed");
        openaiBody = data.result.body;
      }
      if (toFmt === "openai") {
        if (runId === runIdRef.current) setOutput(`${header}\n${JSON.stringify(openaiBody, null, 2)}`);
        return;
      }
      // Leg 2: OpenAI -> target format, via the provider the model routes to.
      const detected = await postTranslate({ step: 1, body: openaiBody });
      if (!detected.success) throw new Error(detected.error || "Could not detect provider for this model");
      const { provider, model, targetFormat } = detected.result;
      if (targetFormat !== toFmt) {
        if (runId === runIdRef.current) {
          setOutput(
            `${header}\nCannot produce ${toFmt} format for this model: it routes to provider "${provider}", whose target format is ${targetFormat}. The proxy converts per provider, so ${toFmt} output requires a model on a ${toFmt}-format provider.`
          );
        }
        return;
      }
      const data = await postTranslate({ step: 3, body: { ...openaiBody, provider, model } });
      if (!data.success) throw new Error(data.error || "Translation failed");
      if (runId === runIdRef.current) {
        setOutput(`${header}\n${JSON.stringify(data.result.body, null, 2)}`);
      }
    } catch (error) {
      if (runId === runIdRef.current) {
        setOutput(`${header}\n${error.message || "Translation failed"}`);
      }
    } finally {
      if (runId === runIdRef.current) setBusy(false);
    }
  }, []);

  // Initial run, matching the artifact (translates the prefilled sample).
  useEffect(() => {
    runTranslate(JSON.stringify(SAMPLES.openai, null, 2), "openai", "claude");
  }, [runTranslate]);

  const handleFromChange = (e) => {
    const next = e.target.value;
    setFrom(next);
    const sample = JSON.stringify(SAMPLES[next], null, 2);
    setSource(sample);
    runTranslate(sample, next, to);
  };

  const handleToChange = (e) => {
    const next = e.target.value;
    setTo(next);
    runTranslate(source, from, next);
  };

  return (
    <div className="flex flex-col">
      {/* Page head */}
      <div className="mb-5">
        <h2 className="text-xl font-semibold tracking-[-0.01em]">Translator</h2>
        <p className="mt-1 text-[13.5px] text-text-muted max-w-[640px]">The router converts between provider formats on the fly. Paste a request on the left and see exactly what another provider receives.</p>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2.5 flex-wrap mb-3.5">
        <div className="w-full max-w-[210px]">
          <Select options={FORMAT_OPTIONS} value={from} onChange={handleFromChange} />
        </div>
        <span className="text-text-subtle">→</span>
        <div className="w-full max-w-[210px]">
          <Select options={FORMAT_OPTIONS} value={to} onChange={handleToChange} />
        </div>
        <Button variant="primary" onClick={() => runTranslate(source, from, to)} loading={busy}>
          Translate
        </Button>
        <div className="flex-1" />
        <span className="text-xs text-text-muted">Same conversion the proxy applies per request.</span>
      </div>

      <div className="grid gap-3.5 grid-cols-1 min-[821px]:grid-cols-2">
        {/* Source */}
        <Card padding="none">
          <div className="flex items-center gap-2.5 px-[18px] py-[14px] border-b border-border">
            <h3 className="text-[13.5px] font-semibold">Source request</h3>
          </div>
          <div className="p-3.5">
            <textarea
              className="w-full border border-border-strong bg-surface rounded-md px-[11px] py-2 font-mono text-[12.5px] leading-[1.6] focus:outline-none focus:border-brand-500 focus:shadow-[var(--shadow-focus)]"
              rows={16}
              spellCheck={false}
              style={{ resize: "vertical" }}
              value={source}
              onChange={(e) => setSource(e.target.value)}
            />
          </div>
        </Card>

        {/* Translated */}
        <Card padding="none">
          <div className="flex items-center gap-2.5 px-[18px] py-[14px] border-b border-border">
            <h3 className="text-[13.5px] font-semibold">Translated request</h3>
            <div className="flex-1" />
            <Button variant="secondary" size="sm" onClick={() => output && copy(output, "translator-output")}>
              Copy output
            </Button>
          </div>
          <div className="p-3.5">
            <div className="bg-surface-2 text-text-main border border-border rounded-brand px-4 py-3.5 font-mono text-[12.5px] leading-[1.65] overflow-x-auto whitespace-pre-wrap break-words min-h-[352px]">
              {output}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
