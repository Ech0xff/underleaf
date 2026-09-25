import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { defaultConfig, normalizeConfig, validateConfig } from "../src/config.ts";

describe("saved settings", () => {
  it("migrates the selected provider without losing credentials or preferences", () => {
    const config = normalizeConfig({
      version: 4,
      providers: [
        {
          id: "first",
          type: "compatible",
          url: "https://a.example",
          token: "a",
          model: "a",
        },
        {
          id: "selected",
          type: "google",
          url: "https://b.example",
          token: "saved",
          model: "chat",
        },
      ],
      activeProviderId: "selected",
      target: "Italiano",
      uiLanguage: "en",
      concurrency: 2,
      cache: false,
      timeoutMs: 60000,
      systemPromptTemplate: "Translate into {{ __LANG__ }}: {{ __TEXT__ }}",
    });
    assert.deepEqual(config, {
      ...defaultConfig,
      endpoint: "https://b.example",
      apiKey: "saved",
      model: "chat",
      providerType: "google",
      target: "Italiano",
      uiLanguage: "en",
      concurrency: 2,
      cache: false,
      timeoutMs: 60000,
      systemPromptTemplate: "Translate into {{ __LANG__ }}: {{ __TEXT__ }}",
    });
    assert.deepEqual(normalizeConfig(config), config);
  });

  it("migrates legacy URLs and prompt markers without rewriting newly entered URLs", () => {
    for (const marker of ["**TEXT**", "__TEXT__", "{{ __TEXT__ }}"]) {
      const config = normalizeConfig({
        endpoint: "https://old.example/v1",
        apiKey: "saved",
        systemPromptTemplate: `Translate ${marker}`,
      });
      assert.equal(config.endpoint, "https://old.example");
      assert.equal(config.apiKey, "saved");
      assert.equal(config.systemPromptTemplate, "Translate {{ __TEXT__ }}");
      assert.deepEqual(normalizeConfig(config), config);
    }
    const config = normalizeConfig({
      ...defaultConfig,
      endpoint: "https://example.com/v1",
    });
    assert.throws(() => validateConfig(config), /URL/);
  });

  it("recovers malformed settings while bounding request limits", () => {
    assert.deepEqual(normalizeConfig(null), defaultConfig);
    assert.deepEqual(
      normalizeConfig({
        providers: [null],
        concurrency: NaN,
        timeoutMs: Infinity,
      }),
      defaultConfig,
    );
    const config = normalizeConfig({ concurrency: 100, timeoutMs: 1 });
    assert.equal(config.concurrency, 8);
    assert.equal(config.timeoutMs, 5000);
  });

  it("allows unfinished model input but rejects invalid request settings before saving", () => {
    assert.doesNotThrow(() => validateConfig(defaultConfig));
    for (const patch of [
      { concurrency: 0 },
      { concurrency: 1.5 },
      { timeoutMs: NaN },
      { target: " " },
      { endpoint: "api.example.com" },
      { systemPromptTemplate: "Missing source" },
    ])
      assert.throws(() => validateConfig({ ...defaultConfig, ...patch }));
  });
});
