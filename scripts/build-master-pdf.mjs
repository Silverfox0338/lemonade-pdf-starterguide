import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { pathToFileURL } from 'node:url';

import { marked } from 'marked';
import { chromium } from 'playwright';

const execFileAsync = promisify(execFile);

const GUIDE_NAME = 'Lemonade.gg Starter Guide';
const GUIDE_BASENAME = 'Lemonade.gg-Starter-Guide';
const DEFAULT_BASE_VERSION = '1.0.0';
const ORDERED_FILES = [
  'Home.md',
  'Chapter-01-What-Is-Lemonade.md',
  'Chapter-02-Roblox-Basics.md',
  'Chapter-03-Getting-Started.md',
  'Chapter-04-What-Lemonade-Can-Build.md',
  'Chapter-05-The-Day-to-Day-Workflow.md',
  'Chapter-06-Writing-Great-Prompts.md',
  'Chapter-07-Debugging-and-Fixing-Issues.md',
  'Chapter-08-Building-Your-First-Game.md',
  'Chapter-09-Tips-Tricks-and-Advanced-Usage.md',
  'Chapter-10-Limitations-and-What-to-Expect.md',
  'Chapter-11-FAQs.md',
  'Glossary.md'
];

marked.setOptions({
  gfm: true
});

function parseArgs(argv) {
  const args = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (!token.startsWith('--')) {
      continue;
    }

    const key = token.slice(2);
    const next = argv[index + 1];

    if (!next || next.startsWith('--')) {
      args[key] = true;
      continue;
    }

    args[key] = next;
    index += 1;
  }

  return args;
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function toPosixRelative(fromDir, targetPath) {
  return path.relative(fromDir, targetPath).split(path.sep).join('/');
}

function incrementPatch(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);

  if (!match) {
    throw new Error(`Invalid semantic version: ${version}`);
  }

  const [, major, minor, patch] = match;
  return `${major}.${minor}.${Number(patch) + 1}`;
}

function normalizeMarkdown(markdown) {
  return markdown.replace(/\r\n/g, '\n');
}

function stripBackToHome(markdown) {
  return markdown.replace(/^\*\[Back to Home\]\(Home\)\*\n\n?/m, '');
}

function stripLeadingDivider(markdown) {
  return markdown.replace(/^(# .+\n\n)---\n\n/, '$1');
}

function stripHomeTableOfContents(markdown, filename) {
  if (filename !== 'Home.md') {
    return markdown;
  }

  return markdown.replace(
    /## Table of Contents[\s\S]*?---\n\n## A Note Before You Start/,
    '## A Note Before You Start'
  );
}

function rewriteInternalLinks(markdown, linkMap) {
  return markdown.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (fullMatch, text, target) => {
    const trimmedTarget = target.trim();

    if (/^(https?:|mailto:|#)/i.test(trimmedTarget)) {
      return fullMatch;
    }

    const anchor = linkMap.get(trimmedTarget);
    if (!anchor) {
      return fullMatch;
    }

    return `[${text}](#${anchor})`;
  });
}

function extractTitle(markdown, filename) {
  const match = markdown.match(/^#\s+(.+)$/m);
  if (match) {
    return match[1].trim();
  }

  return path.basename(filename, path.extname(filename));
}

function buildSectionLabel(filename) {
  if (filename === 'Home.md') {
    return 'Guide Overview';
  }

  if (filename === 'Glossary.md') {
    return 'Reference';
  }

  const chapterMatch = filename.match(/^Chapter-(\d+)-/);
  if (chapterMatch) {
    return `Chapter ${Number(chapterMatch[1])}`;
  }

  return 'Section';
}

function transformMarkdown(filename, markdown, linkMap) {
  let result = normalizeMarkdown(markdown);
  result = stripBackToHome(result);
  result = stripLeadingDivider(result);
  result = stripHomeTableOfContents(result, filename);
  result = rewriteInternalLinks(result, linkMap);
  return result;
}

function buildHtmlDocument({ sections, version, wikiCommit }) {
  const tocItems = sections
    .map((section) => {
      return `<li class="toc-item"><a href="#${section.anchor}"><span class="toc-kicker">${section.label}</span><span class="toc-item-title">${section.title}</span></a></li>`;
    })
    .join('\n');

  const body = sections
    .map((section) => {
      return `<section class="doc-section ${section.kind}" id="${section.anchor}">\n<div class="section-kicker">${section.label}</div>\n${section.html}\n</section>`;
    })
    .join('\n');

  const commitLabel = wikiCommit ? wikiCommit.slice(0, 7) : 'unknown';

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${GUIDE_NAME} v${version}</title>
    <style>
      @page {
        size: Letter;
        margin: 0.8in 0.72in 0.9in 0.72in;
      }

      :root {
        color-scheme: light;
      }

      * {
        box-sizing: border-box;
      }

      html {
        font-size: 11pt;
      }

      body {
        margin: 0;
        color: #221c17;
        background: #fbf8f2;
        font-family: Georgia, "Times New Roman", serif;
        line-height: 1.65;
      }

      main {
        width: 100%;
      }

      .cover-page,
      .toc-section {
        break-after: page;
      }

      .cover-page {
        min-height: 9.05in;
      }

      .cover-frame {
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        min-height: 9.05in;
        padding: 0.95in 0.85in;
        border: 1px solid #dccfbd;
        border-radius: 26px;
        background:
          radial-gradient(circle at top left, rgba(217, 185, 143, 0.28), transparent 36%),
          linear-gradient(145deg, #fffdf8 0%, #f7efe2 52%, #fdf9f2 100%);
        box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.55);
      }

      .cover-eyebrow {
        color: #8f5a28;
        font-family: "Segoe UI", Arial, sans-serif;
        font-size: 0.78rem;
        font-weight: 700;
        letter-spacing: 0.16em;
        text-transform: uppercase;
      }

      .cover-title {
        margin: 0;
        max-width: 8.2in;
        color: #1c1713;
        font-size: 2.7rem;
        line-height: 1.06;
        padding-bottom: 0;
        border-bottom: 0;
      }

      .cover-subtitle {
        margin: 1rem 0 0;
        max-width: 6.8in;
        color: #51453a;
        font-size: 1.05rem;
      }

      .cover-meta {
        display: flex;
        gap: 0.9rem;
        flex-wrap: wrap;
        margin-top: 1.75rem;
        font-family: "Segoe UI", Arial, sans-serif;
        font-size: 0.85rem;
        color: #6c5b4d;
      }

      .cover-chip {
        padding: 0.35rem 0.65rem;
        border: 1px solid #dfcfba;
        border-radius: 999px;
        background: rgba(255, 251, 244, 0.78);
      }

      .toc-section {
        padding: 0.15in 0 0;
      }

      .toc-title {
        margin: 0 0 0.2rem;
        color: #1f1914;
        font-size: 2.1rem;
        padding-bottom: 0;
        border-bottom: 0;
      }

      .toc-copy {
        margin: 0 0 1.2rem;
        color: #5a4c3f;
        max-width: 5.8in;
      }

      .toc-list {
        margin: 0;
        padding: 0;
        list-style: none;
        border-top: 1px solid #deceb9;
      }

      .toc-item {
        border-bottom: 1px solid #eadfce;
      }

      .toc-item a {
        display: flex;
        gap: 0.9rem;
        align-items: baseline;
        padding: 0.72rem 0;
        color: inherit;
        text-decoration: none;
      }

      .toc-kicker {
        width: 1.35in;
        flex: 0 0 1.35in;
        color: #8f5a28;
        font-family: "Segoe UI", Arial, sans-serif;
        font-size: 0.8rem;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .toc-item-title {
        flex: 1 1 auto;
        color: #231d17;
        font-size: 1rem;
      }

      .doc-section {
        break-before: page;
        padding-top: 0.08in;
      }

      .section-kicker {
        margin-bottom: 0.55rem;
        color: #8f5a28;
        font-family: "Segoe UI", Arial, sans-serif;
        font-size: 0.76rem;
        font-weight: 700;
        letter-spacing: 0.16em;
        text-transform: uppercase;
      }

      h1, h2, h3 {
        color: #241c15;
        line-height: 1.22;
        margin-top: 1.5em;
        margin-bottom: 0.58em;
        break-after: avoid-page;
      }

      h1 {
        margin-top: 0;
        margin-bottom: 0.9rem;
        padding-bottom: 0.45rem;
        font-size: 1.9rem;
        border-bottom: 2px solid #dfcfba;
      }

      h2 {
        font-size: 1.3rem;
        padding-bottom: 0.2rem;
        border-bottom: 1px solid #e7dbc9;
      }

      h3 {
        font-size: 1.02rem;
      }

      p, ul, ol, table, pre, blockquote {
        margin-top: 0;
        margin-bottom: 0.95rem;
        orphans: 3;
        widows: 3;
      }

      ul, ol {
        padding-left: 1.4rem;
      }

      li + li {
        margin-top: 0.28rem;
      }

      a {
        color: #7a3e17;
        text-decoration-thickness: 1px;
        text-underline-offset: 0.12em;
      }

      ul li::marker,
      ol li::marker {
        color: #9b6431;
      }

      hr {
        border: 0;
        height: 1px;
        margin: 1.45rem 0;
        background: linear-gradient(90deg, transparent 0%, #d7c5ae 18%, #d7c5ae 82%, transparent 100%);
      }

      strong {
        color: #1a140f;
      }

      em {
        color: #4c4034;
      }

      code {
        font-family: "Cascadia Code", Consolas, "Courier New", monospace;
        font-size: 0.92em;
        padding: 0.08rem 0.25rem;
        background: #f5ede2;
        border-radius: 4px;
      }

      pre {
        break-inside: avoid;
        overflow-wrap: anywhere;
        white-space: pre-wrap;
        padding: 0.95rem 1rem;
        background: linear-gradient(180deg, #f8f2e9 0%, #f5ece0 100%);
        border: 1px solid #e7dbc9;
        border-radius: 12px;
      }

      pre code {
        padding: 0;
        background: transparent;
      }

      blockquote {
        break-inside: avoid;
        margin-left: 0;
        padding: 0.35rem 1rem;
        border-left: 4px solid #cd9d6b;
        color: #53483d;
        background: #fbf6ef;
        border-radius: 0 10px 10px 0;
      }

      table {
        break-inside: avoid;
        width: 100%;
        border-collapse: collapse;
        font-size: 0.96rem;
      }

      th,
      td {
        border: 1px solid #decfbe;
        padding: 0.55rem 0.65rem;
        text-align: left;
        vertical-align: top;
      }

      th {
        background: #f3e8da;
      }

      tr:nth-child(even) td {
        background: #fdf9f3;
      }

      img {
        max-width: 100%;
      }

      .doc-section p:last-child,
      .doc-section ul:last-child,
      .doc-section ol:last-child {
        margin-bottom: 0;
      }
    </style>
  </head>
  <body>
    <main>
      <section class="cover-page">
        <div class="cover-frame">
          <div>
            <div class="cover-eyebrow">Master PDF Edition</div>
            <h1 class="cover-title">${GUIDE_NAME}</h1>
            <p class="cover-subtitle">A beginner-to-advanced guide to what Lemonade.gg is, how it works, how to prompt it well, and how to use it effectively inside Roblox Studio.</p>
          </div>
          <div>
            <div class="cover-meta">
              <span class="cover-chip">Version ${version}</span>
              <span class="cover-chip">Source wiki ${commitLabel}</span>
              <span class="cover-chip">Single-file master export</span>
            </div>
          </div>
        </div>
      </section>
      <section class="toc-section">
        <h1 class="toc-title">Contents</h1>
        <p class="toc-copy">This PDF is generated from the live GitHub wiki and arranged as one continuous handbook for reading, sharing, and archiving.</p>
        <ol class="toc-list">
          ${tocItems}
        </ol>
      </section>
      ${body}
    </main>
  </body>
</html>`;
}

async function readJson(filePath, fallbackValue) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return fallbackValue;
    }

    throw error;
  }
}

async function readText(filePath, fallbackValue = null) {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') {
      return fallbackValue;
    }

    throw error;
  }
}

async function getGitHead(directory) {
  try {
    const { stdout } = await execFileAsync('git', ['-C', directory, 'rev-parse', 'HEAD']);
    return stdout.trim();
  } catch (error) {
    return '';
  }
}

async function renderPdf(htmlPath, pdfPath, version) {
  const launchOptions = { headless: true };

  if (process.env.PDF_BROWSER_EXECUTABLE) {
    launchOptions.executablePath = process.env.PDF_BROWSER_EXECUTABLE;
  } else if (process.env.PDF_BROWSER_CHANNEL) {
    launchOptions.channel = process.env.PDF_BROWSER_CHANNEL;
  } else if (process.platform === 'win32') {
    launchOptions.channel = 'msedge';
  }

  const browser = await chromium.launch(launchOptions);

  try {
    const page = await browser.newPage();
    await page.goto(pathToFileURL(htmlPath).toString(), {
      waitUntil: 'load'
    });
    await page.emulateMedia({ media: 'print' });
    await page.pdf({
      path: pdfPath,
      format: 'Letter',
      printBackground: true,
      displayHeaderFooter: true,
      preferCSSPageSize: true,
      margin: {
        top: '0.8in',
        right: '0.72in',
        bottom: '0.9in',
        left: '0.72in'
      },
      headerTemplate: '<div></div>',
      footerTemplate: `<div style="width:100%;padding:0 24px;font-size:8px;color:#7b6c59;display:flex;justify-content:space-between;align-items:center;"><span>${GUIDE_NAME} v${version}</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`
    });
  } finally {
    await browser.close();
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const rootDir = process.cwd();
  const wikiDir = path.resolve(rootDir, args['wiki-dir'] ?? '.wiki');
  const outputDir = path.resolve(rootDir, args['output-dir'] ?? 'pdf');
  const historyDir = path.join(outputDir, 'history');
  const versionFile = path.resolve(rootDir, args['version-file'] ?? 'VERSION');
  const manifestFile = path.resolve(rootDir, args['manifest-file'] ?? path.join(outputDir, 'manifest.json'));
  const baseVersion = args['base-version'] ?? DEFAULT_BASE_VERSION;
  const force = Boolean(args.force);

  await fs.mkdir(outputDir, { recursive: true });
  await fs.mkdir(historyDir, { recursive: true });

  const linkMap = new Map(
    ORDERED_FILES.map((filename) => {
      const stem = path.basename(filename, path.extname(filename));
      return [stem, slugify(stem)];
    })
  );

  const latestVersionFromFile = (await readText(versionFile))?.trim() || baseVersion;
  const manifest = await readJson(manifestFile, {
    baseVersion,
    latestVersion: latestVersionFromFile,
    latestWikiCommit: '',
    entries: []
  });

  const wikiCommit = await getGitHead(wikiDir);

  if (manifest.latestWikiCommit && manifest.latestWikiCommit === wikiCommit && !force) {
    console.log(`No wiki changes detected since v${manifest.latestVersion}. Skipping PDF build.`);
    return;
  }

  const versionSource = manifest.latestVersion || latestVersionFromFile || baseVersion;
  const nextVersion = incrementPatch(versionSource);

  const sections = [];
  for (const filename of ORDERED_FILES) {
    const filePath = path.join(wikiDir, filename);
    const rawMarkdown = await fs.readFile(filePath, 'utf8');
    const anchor = slugify(path.basename(filename, path.extname(filename)));
    const normalized = transformMarkdown(filename, rawMarkdown, linkMap);
    const title = extractTitle(normalized, filename);
    const html = marked.parse(normalized);
    const kind = filename === 'Home.md' ? 'overview' : filename === 'Glossary.md' ? 'glossary' : 'chapter';
    const label = buildSectionLabel(filename);
    sections.push({ anchor, html, kind, label, title });
  }

  const html = buildHtmlDocument({
    sections,
    version: nextVersion,
    wikiCommit
  });

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'lemonade-pdf-'));
  const tempHtmlPath = path.join(tempDir, `${GUIDE_BASENAME}.html`);
  const latestPdfPath = path.join(outputDir, `${GUIDE_BASENAME}-latest.pdf`);
  const historyPdfPath = path.join(historyDir, `${GUIDE_BASENAME}-v${nextVersion}.pdf`);

  await fs.writeFile(tempHtmlPath, html, 'utf8');
  await renderPdf(tempHtmlPath, latestPdfPath, nextVersion);
  await fs.copyFile(latestPdfPath, historyPdfPath);

  const nextEntry = {
    version: nextVersion,
    builtAt: new Date().toISOString(),
    wikiCommit,
    file: toPosixRelative(rootDir, historyPdfPath)
  };

  const entries = Array.isArray(manifest.entries) ? manifest.entries.slice() : [];
  entries.push(nextEntry);

  const nextManifest = {
    baseVersion,
    latestVersion: nextVersion,
    latestWikiCommit: wikiCommit,
    latestFile: toPosixRelative(rootDir, latestPdfPath),
    entries
  };

  await fs.writeFile(versionFile, `${nextVersion}\n`, 'utf8');
  await fs.writeFile(manifestFile, `${JSON.stringify(nextManifest, null, 2)}\n`, 'utf8');

  await fs.rm(tempDir, { recursive: true, force: true });

  console.log(`Built ${historyPdfPath}`);
  console.log(`Latest PDF: ${latestPdfPath}`);
  console.log(`Version: ${nextVersion}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
