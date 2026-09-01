import { defineConfig } from "vitepress";
import type { LanguageInput } from "@shikijs/types";
import stillaGrammar from "./syntaxes/stilla.tmLanguage.json" with {
  type: "json",
};

// Register the Stilla TextMate grammar (source: ../stilla/stilla-syntax)
// for ```stilla code fences. https://vitepress.dev/reference/site-config#markdown
// SAFETY: the JSON is a raw TextMate grammar already shaped as Shiki's
// `RawGrammar` (name/scopeName/patterns) — we only add an id + labels. TS
// can't structurally match JSON-inferred `patterns` against the
// discriminated `IRawGrammarRule` union, but the runtime value is valid.
const stilla: LanguageInput = {
  ...stillaGrammar,
  name: "stilla",
  displayName: "Stilla",
} as unknown as LanguageInput;

// https://vitepress.dev/reference/site-config
export default defineConfig({
  srcDir: "docs",

  markdown: {
    languages: [stilla],
  },

  title: "Stilla",
  description:
    "A programming language for embedded scripting — Static, Small, Safe, Simple",

  locales: {
    root: {
      label: "English",
      lang: "en",
    },
    zh: {
      label: "中文",
      lang: "zh-CN",
      link: "/zh/",
      description: "一种用于嵌入式脚本的编程语言——静态、小巧、安全、简单",
      themeConfig: {
        nav: [
          { text: "首页", link: "/zh/" },
          { text: "指南", link: "/zh/guide/intro" },
        ],
        sidebar: [
          {
            text: "指南",
            items: [
              { text: "Stilla 语言", link: "/zh/guide/intro" },
              { text: "快速开始", link: "/zh/guide/getting-started" },
              { text: "宿主嵌入", link: "/zh/guide/embedding" },
            ],
          },
        ],
      },
      markdown: {
        container: {
          tipLabel: "提示",
          warningLabel: "警告",
          dangerLabel: "危险",
          detailsLabel: "详细信息",
        },
        codeCopyButton: {
          tooltipText: "复制代码",
          copiedText: "已复制",
        },
      },
    },
  },

  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    logo: { light: "/logo.svg", dark: "/logo-dark.svg" },

    nav: [
      { text: "Home", link: "/" },
      { text: "Guide", link: "/guide/intro" },
    ],

    sidebar: [
      {
        text: "Guide",
        items: [
          { text: "The Stilla Language", link: "/guide/intro" },
          { text: "Getting Started", link: "/guide/getting-started" },
          { text: "Host Embedding", link: "/guide/embedding" },
        ],
      },
    ],

    socialLinks: [
      { icon: "github", link: "https://github.com/zoltrazig/stilla" },
    ],
  },
});
