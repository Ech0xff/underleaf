import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { defaults, serviceOrigin } from "../src/config.ts";
import {
  cacheIdentity,
  splitText,
  tokensIn,
  validateTranslation,
  systemPrompt,
} from "../src/translation/text.ts";
import { checkHttpStatus } from "../src/translation/service.ts";
const settings = {
  ...defaults,
  endpoint: "https://api.example.com",
  model: "test",
  apiKey: "test-token",
};

describe("endpoint and output integrity", () => {
  it("accepts HTTP(S) origins with optional ports", () => {
    for (const url of ["https://api.example.com", "http://localhost:11434"])
      assert.equal(serviceOrigin(url), url);
    assert.equal(serviceOrigin("https://api.example.com/"), "https://api.example.com");
  });
  it("rejects absent schemes, API paths, credentials and query parameters", () => {
    for (const url of [
      "api.example.com",
      "bad",
      "ftp://host",
      "https://u:p@host",
      "https://host.com?key=token",
      "https://api.example.com/v1",
    ]) {
      assert.throws(() => serviceOrigin(url));
    }
  });
  it("separates translation settings in cache keys without including credentials", () => {
    const key = cacheIdentity(settings, "source");
    assert.equal(cacheIdentity({ ...settings, apiKey: "another-token" }, "source"), key);
    for (const change of [
      { endpoint: "https://other.example" },
      { model: "other" },
      { target: "日语" },
      { instructions: "technical" },
      { systemPromptTemplate: "Translate {{ __TEXT__ }}" },
    ]) {
      assert.notEqual(cacheIdentity({ ...settings, ...change }, "source"), key);
    }
  });
  it("rejects missing, duplicated and fabricated protected tokens", () => {
    const source = "Use ⟪UL_KEEP_0⟫ and ⟪UL_KEEP_1⟫.";
    assert.equal(
      validateTranslation(source, "用 ⟪UL_KEEP_0⟫ 和 ⟪UL_KEEP_1⟫"),
      "用 ⟪UL_KEEP_0⟫ 和 ⟪UL_KEEP_1⟫",
    );
    for (const bad of [
      "用 ⟪UL_KEEP_0⟫",
      "⟪UL_KEEP_0⟫ ⟪UL_KEEP_0⟫ ⟪UL_KEEP_1⟫",
      "⟪UL_KEEP_2⟫",
      "",
    ]) {
      assert.throws(() => validateTranslation(source, bad));
    }
  });
  it("splits large input without dropping text or cutting protected tokens or emoji", () => {
    const source = "Sentence with emoji 🐱 and ⟪UL_KEEP_0⟫. ".repeat(200);
    const chunks = splitText(source, 80);
    assert.equal(chunks.join(""), source);
    assert.ok(chunks.every((chunk) => chunk.length <= 80 && !/[\uD800-\uDBFF]$/.test(chunk)));
    assert.deepEqual(chunks.flatMap(tokensIn), tokensIn(source));
  });
  it("maps HTTP failures without exposing response bodies", () => {
    assert.throws(
      () => checkHttpStatus({ status: 401, json: { error: "private response" } }),
      /认证失败/,
    );
    assert.throws(
      () =>
        checkHttpStatus({
          status: 404,
          json: { error: { message: "Model x is not available" } },
        }),
      /模型不可用/,
    );
  });
});

describe("prompt expansion", () => {
  it("substitutes variables literally without expanding markers inside user text", () => {
    const source = "Literal {{ __LANG__ }} / {{ __TEXT__ }} / $&";
    const target = "Language {{ __TEXT__ }} $1";
    const template = "{{ __LANG__ }}:{{__TEXT__}}\n{{__LANG__}}:{{ __TEXT__ }}";
    assert.equal(
      systemPrompt({ ...settings, target, systemPromptTemplate: template }, source),
      `${target}:${source}\n${target}:${source}`,
    );
  });
  it("keeps placeholder protection for custom prompts and requires a source marker", () => {
    assert.match(
      systemPrompt(
        { ...settings, systemPromptTemplate: "Translate {{ __TEXT__ }}" },
        "Use ⟪UL_KEEP_0⟫",
      ),
      /Preserve each occurrence/,
    );
    assert.throws(
      () => systemPrompt({ ...settings, systemPromptTemplate: "Translate something" }, "Hello"),
      /__TEXT__/,
    );
  });
});
