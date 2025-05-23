import { themes as prismThemes } from "prism-react-renderer";
import type { Config } from "@docusaurus/types";
import type * as Preset from "@docusaurus/preset-classic";

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

const config: Config = {
  title: "ViBe",
  tagline: "Reimagining Learning, One Question at a Time",
  favicon: "img/favicon.ico",

  // Set the production url of your site here
  url: "https://continuousactivelearning.github.io",
  // Set the /<baseUrl>/ pathname under which your site is served
  // For GitHub pages deployment, it is often '/<projectName>/'
  baseUrl: "/vibe/",
  deploymentBranch: "gh-pages",
  trailingSlash: false,

  markdown: {
    mermaid: true,
  },



  plugins: [
    [
      "docusaurus-plugin-typedoc",
      {
        categorizeByGroup: true,
        hideBreadcrumbs: true,
        hidePageTitle: true,
        entryPoints: [
          "../backend/src/modules/courses/index.ts",
          "../backend/src/modules/auth/index.ts",
        ],
        entryFileName:"Backend.md",
        entryPointStrategy: "expand",
        tsconfig: "../backend/tsconfig.json",
        out: "./docs/api/backend",
        exclude: ["**/tests/**"],
        router: "category",
        sidebar: {
          autoConfiguration: true,
        },
      },
    ],
    [
      '@docusaurus/plugin-content-docs',
      {
        id: 'newdocs',                            // *must* be unique
        path: 'newdocs',                          // folder you just created
        routeBasePath: 'newdocs',                 // URL: /newdocs/<docId>
        sidebarPath: require.resolve('./sidebarsNew.js'),
        editUrl: 'https://github.com/your-org/…', // adjust if you want "edit this page"
      },
    ],
  ],

  // GitHub pages deployment config.
  // If you aren't using GitHub pages, you don't need these.
  organizationName: "continuousactivelearning", // Usually your GitHub org/user name.
  projectName: "vibe", // Usually your repo name.

  onBrokenLinks: "throw",
  onBrokenMarkdownLinks: "warn",

  // Even if you don't use internationalization, you can use this field to set
  // useful metadata like html lang. For example, if your site is Chinese, you
  // may want to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: "en",
    locales: ["en"],
  },

  presets: [
    [
      "classic",
      {
        docs: {
          sidebarPath: "./sidebars.ts",
          // Please change this to your repo.
          // Remove this to remove the "edit this page" links.
          editUrl:
            "https://github.com/continuousactivelearning/vibe/edit/main/docs/",
        },
        blog: {
          showReadingTime: true,
          feedOptions: {
            type: ["rss", "atom"],
            xslt: true,
          },
          // Please change this to your repo.
          // Remove this to remove the "edit this page" links.
          editUrl:
            "https://github.com/facebook/docusaurus/tree/main/packages/create-docusaurus/templates/shared/",
          // Useful options to enforce blogging best practices
          onInlineTags: "warn",
          onInlineAuthors: "warn",
          onUntruncatedBlogPosts: "warn",
        },
        theme: {
          customCss: "./src/css/custom.css",
        },
      } satisfies Preset.Options,
    ],
  ],
  themeConfig: {
    // Replace with your project's social card
    image: "img/docusaurus-social-card.jpg",
    navbar: {
      title: "ViBe",
      logo: {
        alt: "Vikram Betaal(ViBe) Logo",
        src: "img/logo.png",
      },
      items: [
        {
          type: "docSidebar",
          sidebarId: "tutorialSidebar",
          position: "left",
          label: "Documentation",
        },
        {
          type: 'docSidebar',
          sidebarId: 'newSidebar',
          position: 'left',
          label: 'MERN Tutorial',       // <-- your new section name
          docsPluginId: 'newdocs',  // <-- point at the plugin instance
         },
        {
          href: "https://github.com/continuousactivelearning/vibe",
          label: "GitHub",
          position: "right",
        },
      ],
    },
    algolia: {
      appId: 'XXGSK16Q2E',
      apiKey: '185a09fe6fdd903609d79c14183bbe32',
      insights: true,
      indexName: 'continuousactivelearningio',
      contextualSearch: true,
    },
    footer: {
      style: "dark",
      links: [
        {
          title: "Docs",
          items: [
            {
              label: "Documentation",
              to: "/docs/getting-started/intro",
            },
          ],
        },
        {
          title: "Community",
          items: [
            {
              label: "GitHub",
              href: "https://github.com/continuousactivelearning/vibe",
            },
            {
              label: "LinkedIn",
              href: "https://www.linkedin.com/company/educationdesignlab/?viewAsMember=true",
            },
          ],
        },
        {
          title: "More",
          items: [
            {
              label: "Blog",
              to: "/blog",
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} DLED IIT Ropar.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
