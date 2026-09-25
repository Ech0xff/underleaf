# Underleaf · 段下译

Translate paragraphs below the original text in Obsidian Reading view, without changing your notes. Supports OpenAI-compatible services, Anthropic, and Google Gemini. Desktop only; requires Obsidian 1.8.7 or later.

## Use

1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/Ech0xff/underleaf/releases/latest), place them in `.obsidian/plugins/underleaf/`, then enable Underleaf in Community plugins.
2. Choose a protocol in settings, enter your API token and model, and select a translation language. Leave the URL blank for the official service, or enter an origin such as `http://localhost:8000` (no `/v1` path).
3. In Reading view, hover over a paragraph and press `⌘⌥T` / `Ctrl+Alt+T` to translate or hide it. Change this shortcut in Obsidian's Hotkeys settings.
4. Use the translation icon at the top of the note to translate visible paragraphs as you scroll. Turning it off cancels pending work and keeps completed translations.

Inline code and math are preserved. Model discovery, connection testing, custom languages, and Chinese/English interface settings are available. Settings save automatically. Custom prompts support `{{ __TEXT__ }}` (required) and `{{ __LANG__ }}`; leave the prompt blank to use the default.

## Privacy and cost

- Translation sends requested paragraphs, your prompt, and the target language to the configured service. Model discovery and connection testing also contact that service. No vault-wide uploads, analytics, or access outside the vault.
- Hosted services usually require an account and API credits; their fees and data policies apply. Local OpenAI-compatible services can be used without a hosted account.
- API tokens are stored unencrypted in the plugin's `data.json`. Vault sync may include this file.
- Optional translations are stored in `cache.json`, keyed by a hash of the source and settings. The cache does not separately store source text or API tokens; translations may still contain sensitive note content. Disabling the cache clears it.
- Requests already sent cannot be aborted by Obsidian's transport and may still incur charges after cancellation or timeout.

## Development

Node.js 24.12+: `npm ci`, then `npm run check` to run oxfmt, oxlint, tests, type checking, and the build. Use `npm run format` to format changes and `npm run lint:fix` to fix lint issues.

MIT · [Ech0xff](https://github.com/Ech0xff)
