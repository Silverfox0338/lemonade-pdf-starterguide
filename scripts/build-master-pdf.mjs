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

function buildHtmlDocument({ sections, version, wikiCommit }) {
  const body = sections
    .map((section) => {
      return `<section class="doc-section" id="${section.anchor}">\n${section.html}\n</section>`;
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
        margin: 0.7in;
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
        color: #1e1a16;
        background: #fffdf8;
        font-family: Georgia, "Times New Roman", serif;
        line-height: 1.55;
      }

      main {
        width: 100%;
      }

      .doc-section {
        break-before: page;
      }

      .doc-section:first-of-type {
        break-before: auto;
      }

      .build-meta {
        margin-top: 0.5rem;
        margin-bottom: 1.75rem;
        color: #6b6258;
        font-size: 0.9rem;
      }

      h1, h2, h3 {
        color: #241d16;
        line-height: 1.2;
        margin-top: 1.4em;
        margin-bottom: 0.55em;
        break-after: avoid-page;
      }

      h1 {
        font-size: 1.9rem;
        margin-top: 0;
      }

      h2 {
        font-size: 1.35rem;
        padding-top: 0.2rem;
        border-top: 1px solid #d8cbbd;
      }

      h3 {
        font-size: 1.05rem;
      }

      p, ul, ol, table, pre, blockquote {
        margin-top: 0;
        margin-bottom: 1rem;
      }

      ul, ol {
        padding-left: 1.4rem;
      }

      li + li {
        margin-top: 0.3rem;
      }

      a {
        color: #7a3e17;
        text-decoration: underline;
      }

      hr {
        border: 0;
        border-top: 1px solid #d8cbbd;
        margin: 1.4rem 0;
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
        background: #f6efe5;
        border-radius: 4px;
      }

      pre {
        overflow-wrap: anywhere;
        white-space: pre-wrap;
        padding: 0.9rem 1rem;
        background: #f6efe5;
        border: 1px solid #eadfce;
        border-radius: 8px;
      }

      pre code {
        padding: 0;
        background: transparent;
      }

      blockquote {
        margin-left: 0;
        padding: 0.2rem 1rem;
        border-left: 4px solid #d2a679;
        color: #53483d;
        background: #fbf6ef;
      }

      table {
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
    </style>
  </head>
  <body>
    <main>
      <div class="build-meta">Master PDF version ${version} · source wiki commit ${commitLabel}</div>
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

async function renderPdf(htmlPath, pdfPath) {
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
      printBackground: true
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
    const normalized = rewriteInternalLinks(stripBackToHome(normalizeMarkdown(rawMarkdown)), linkMap);
    const html = marked.parse(normalized);
    sections.push({ anchor, html });
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
  await renderPdf(tempHtmlPath, latestPdfPath);
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
