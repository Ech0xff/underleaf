import { createLocalizedError } from "../i18n.ts";
import { generateText } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogle } from "@ai-sdk/google";
import { systemPrompt } from "./text.ts";
import { providerConfig, type Settings } from "../config.ts";
import type { Transport } from "./http.ts";

// SDK providers build the protocol; Obsidian's transport handles CORS-free HTTP.
// Never fall back to the browser's fetch or send credentials to a different host.
export function createSdkGenerator(transport: Transport) {
  return async (
    source: string,
    settings: Settings,
  ): Promise<Readonly<{ text: string; truncated: boolean }>> => {
    const config = providerConfig(settings.endpoint, settings.providerType);
    const fetchAdapter: typeof fetch = async (input, init) => {
      if (init?.signal?.aborted) throw new DOMException("Aborted", "AbortError");
      const url =
        typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      assert(
        new URL(url).origin === new URL(config.baseURL).origin,
        createLocalizedError("providerOriginInvalid"),
      );
      assert(
        init?.method === "POST" && typeof init.body === "string",
        createLocalizedError("providerRequestInvalid"),
      );
      const headers = Object.fromEntries(new Headers(init.headers).entries());
      const response = await transport(url, headers, init.body);
      if (init.signal?.aborted) throw new DOMException("Aborted", "AbortError");
      return new Response(JSON.stringify(response.json), {
        status: response.status,
        headers: { "Content-Type": "application/json" },
      });
    };
    const options = {
      baseURL: config.baseURL,
      apiKey: settings.apiKey,
      fetch: fetchAdapter,
    };
    const model =
      config.kind === "anthropic"
        ? createAnthropic(options)(settings.model)
        : config.kind === "google"
          ? createGoogle(options)(settings.model)
          : createOpenAICompatible({ ...options, name: "underleaf" }).chatModel(settings.model);
    const result = await generateText({
      model,
      instructions: systemPrompt(settings, source),
      // Keep the exact source in the user message as well: some compatible services
      // prepend their own system messages, making references to 'system instructions' ambiguous.
      prompt: JSON.stringify({ source_text: source }),
      maxRetries: 0,
    });
    return { text: result.text, truncated: result.finishReason === "length" };
  };
}
import { assert } from "es-toolkit";
