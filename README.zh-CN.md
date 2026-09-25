# Underleaf

[English](README.md) · 简体中文

在 Obsidian 阅读视图中，将译文显示在原段落下方，边读边译，不修改笔记文件。

## 功能

- 用快捷键翻译或隐藏鼠标所在段落，也可以开启随滚动自动翻译。
- 支持 OpenAI 兼容服务、Anthropic 和 Google Gemini，包括兼容的本地模型。
- 保留行内代码和公式，可选择保存译文缓存。
- 支持自定义目标语言、提示词、模型列表查询及中英文界面。

## 安装

仅支持桌面端，需要 Obsidian 1.8.7 或更高版本。

1. 从 [最新版本](https://github.com/Ech0xff/underleaf/releases/latest) 下载 `main.js`、`manifest.json` 和 `styles.css`。
2. 将三个文件放入仓库的 `.obsidian/plugins/underleaf/` 文件夹。
3. 重新加载 Obsidian，在 **设置 → 第三方插件** 中启用 **Underleaf**。

## 使用

1. 在插件设置中选择接口类型，填写 API Token 和模型，选择目标语言。使用官方服务时 URL 留空；自定义服务只填域名和端口，例如 `http://localhost:11434`，不要加 `/v1`。
2. 在 Obsidian 的快捷键设置中，为 **Underleaf：翻译 / 隐藏鼠标所在段落** 指定快捷键。打开笔记的**阅读视图**，鼠标移到段落上，按该快捷键翻译或隐藏译文。
3. 点击笔记顶部的翻译图标，自动翻译可见段落并随滚动继续。关闭后停止待处理任务，已完成的译文保留。

设置自动保存。自定义提示词必须包含 `{{ __TEXT__ }}`，可用 `{{ __LANG__ }}` 插入目标语言；留空则使用默认提示词。

## 隐私与费用

- 翻译时，仅向配置的服务发送请求的段落、提示词和目标语言；查询模型和测试连接也会访问该服务。不上传整个仓库，不收集使用数据，不访问仓库外文件。
- 云服务通常需要自备账号和 API 额度，费用与数据政策由服务商决定；兼容的本地服务无需云端账号。
- API Token 明文保存在插件的 `data.json`，可能随仓库同步。可选缓存保存在 `cache.json`，包含译文和内容哈希；关闭缓存会清空该文件。
- 已发出的请求无法由 Obsidian 中止，取消或超时后仍可能计费。

## 开发

Node.js 24.12+。运行 `npm ci` 安装依赖，`npm run check` 执行 oxfmt、oxlint、测试、类型检查和构建。使用 `npm run format` 格式化代码。

[反馈问题](https://github.com/Ech0xff/underleaf/issues) · [MIT](LICENSE) · [Ech0xff](https://github.com/Ech0xff)
