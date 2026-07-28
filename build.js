const fs = require('fs');
const path = require('path');
const ejs = require('ejs');

// ---- Config ----
// If your site will live at https://<username>.github.io/<repo-name>/
// (a "project site" — true for any repo NOT named <username>.github.io),
// set this to '/<repo-name>'. If it's a root site at
// https://<username>.github.io/, or you're using a custom domain, leave
// this as an empty string.
//
// Check your actual live URL to know which case you're in — if it has
// anything after the first slash past ".github.io/", that's your repo
// name and it needs to go here.
const BASE_PATH = '/portfolio-website';

const ROOT_DIR = __dirname;
const OUTPUT_DIR = path.join(ROOT_DIR, 'docs');
const VIEWS_DIR = path.join(ROOT_DIR, 'views');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');

const getProjects = () =>
  JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'data/projects.json')));

// Rewrites root-relative paths (href="/..." and src="/...") so links and
// assets still resolve correctly if the site is served from a sub-path.
function withBasePath(html) {
  if (!BASE_PATH) return html;
  return html.replace(/(href|src)="\//g, `$1="${BASE_PATH}/`);
}

function writeFile(outPath, contents) {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, contents);
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

async function build() {
  // Start from a clean output folder each time
  fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });

  // Copy static assets (css, js, images, videos) over as-is
  copyDir(PUBLIC_DIR, OUTPUT_DIR);

  // Tells GitHub Pages to skip its default Jekyll processing step, which
  // otherwise ignores certain file/folder naming patterns you don't need
  // here but is worth ruling out as a source of missing files.
  fs.writeFileSync(path.join(OUTPUT_DIR, '.nojekyll'), '');

  const projects = getProjects();
  const heroProjects = projects.filter((p) => p.featured);
  const resolvedHero = heroProjects.length ? heroProjects : [projects[0]];

  // Home page — same data server.js would have passed to index.ejs
  const indexHtml = await ejs.renderFile(path.join(VIEWS_DIR, 'index.ejs'), {
    projects,
    heroProjects: resolvedHero,
  });
  writeFile(path.join(OUTPUT_DIR, 'index.html'), withBasePath(indexHtml));

  // One page per project, at /project/<slug>/ — matches your existing
  // href="/project/<slug>" links without needing to rewrite them
  for (const project of projects) {
    const projectHtml = await ejs.renderFile(
      path.join(VIEWS_DIR, 'project.ejs'),
      { project }
    );
    writeFile(
      path.join(OUTPUT_DIR, 'project', project.slug, 'index.html'),
      withBasePath(projectHtml)
    );
  }

  console.log(`Built ${projects.length + 1} pages into /docs`);
}

build();