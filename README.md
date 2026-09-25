# Underleaf

English · [简体中文](README.zh-CN.md)

Read your notes in two languages. Underleaf places translations beneath the original paragraphs in Obsidian Reading view, without changing your files.

## Features

- Translate or hide a paragraph with a hotkey, or translate visible paragraphs as you scroll.
- Use OpenAI-compatible services, Anthropic, or Google Gemini, including compatible local models.
- Preserve inline code and math, with an optional translation cache.
- Choose custom languages and prompts, discover models, and switch between English and Chinese interfaces.

## Installation

Desktop only. Requires Obsidian 1.8.7 or later.

1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/Ech0xff/underleaf/releases/latest).
2. Place the three files in your vault's `.obsidian/plugins/underleaf/` folder.
3. Reload Obsidian and enable **Underleaf** in **Settings → Community plugins**.

## Usage

1. In plugin settings, choose a protocol, enter your API token and model, and select a translation language. Leave URL blank for the official service. For a custom service, enter only its origin, such as `http://localhost:11434`, without `/v1`.
2. Open a note in **Reading view**, hover over a paragraph, and press `⌘⌥T` (macOS) or `Ctrl+Alt+T` (Windows/Linux) to translate or hide it. You can change the shortcut in Obsidian's Hotkeys settings.
3. Click the translation icon at the top of the note to translate visible paragraphs as you scroll. Turning it off cancels pending work and keeps completed translations.

Settings save automatically. Custom prompts require `{{ __TEXT__ }}` and can use `{{ __LANG__ }}` for the target language; leave the prompt blank to use the default.

## Privacy and cost

- Translation sends requested paragraphs, your prompt, and the target language only to the configured service. Model discovery and connection testing also contact that service. No vault-wide uploads, analytics, or access outside the vault.
- Hosted services usually require your own account and API credits; their fees and data policies apply. Compatible local services need no hosted account.
- API tokens are stored unencrypted in the plugin's `data.json` and may be included in vault sync. Optional `cache.json` stores translations and content hashes; disabling the cache clears it.
- Obsidian cannot abort requests already sent, so cancellation or timeout may still incur charges.

## Development

Node.js 24.12+. Run `npm ci`, then `npm run check` for oxfmt, oxlint, tests, type checking, and the build. Use `npm run format` to format changes.

[Report an issue](https://github.com/Ech0xff/underleaf/issues) · [MIT](LICENSE) · [Ech0xff](https://github.com/Ech0xff)
