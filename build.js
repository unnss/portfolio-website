const fs = require('fs');
const path = require('path');
const ejs = require('ejs');
const { getProjects, heroSizes, BODY_SIZES } = require('./lib/projects');

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

// Logo data for the program-icons partial. Mirrors app.locals.programIcons
// in server.js so both renderers see the same thing.
const PROGRAM_ICONS = require('./data/program-icons');

// Renders a view with the locals every template gets, plus its own page data
const renderView = (view, data) =>
  ejs.renderFile(path.join(VIEWS_DIR, view), { programIcons: PROGRAM_ICONS, bodyImageSizes: BODY_SIZES, ...data });

// Prefix root-relative links, images, and every responsive-image candidate
// so assets still resolve correctly when served from a sub-path.
function withBasePath(html) {
  if (!BASE_PATH) return html;
  return html
    .replace(/(href|src)="\/(?!\/)/g, `$1="${BASE_PATH}/`)
    .replace(/\bsrcset="([^"]*)"/g, (_, candidates) =>
      `srcset="${candidates.replace(/(^|,\s*)\/(?!\/)/g, `$1${BASE_PATH}/`)}"`
    );
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
  // Prepare responsive assets before copying public or replacing a working build.
  const projects = await getProjects();
  // Start from a clean output folder each time
  fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });

  // Copy static assets (css, js, images, videos) over as-is
  copyDir(PUBLIC_DIR, OUTPUT_DIR);

  // Tells GitHub Pages to skip its default Jekyll processing step, which
  // otherwise ignores certain file/folder naming patterns you don't need
  // here but is worth ruling out as a source of missing files.
  fs.writeFileSync(path.join(OUTPUT_DIR, '.nojekyll'), '');

  const heroProjects = projects.filter((p) => p.featured);
  const resolvedHero = heroProjects.length ? heroProjects : [projects[0]];

  const heroFirstImage = resolvedHero[0].heroSlides[0];

  // Home page — same data server.js would have passed to index.ejs
  const indexHtml = await renderView('index.ejs', {
    projects,
    heroProjects: resolvedHero,
    heroFirstImage,
    heroImageSizes: heroSizes(resolvedHero.length),
    currentPage: 'home',
  });
  writeFile(path.join(OUTPUT_DIR, 'index.html'), withBasePath(indexHtml));

  // One page per project, at /project/<slug>/ — matches your existing
  // href="/project/<slug>" links without needing to rewrite them
  for (const project of projects) {
    const projectHtml = await renderView('project.ejs', {
      project,
      currentPage: 'project',
    });
    writeFile(
      path.join(OUTPUT_DIR, 'project', project.slug, 'index.html'),
      withBasePath(projectHtml)
    );
  }

  // Categorized Projects index — same grouping logic as the /projects
  // route in server.js
  const grouped = {};
  projects.forEach((p) => {
    const category = p.category || 'Other';
    if (!grouped[category]) grouped[category] = [];
    grouped[category].push(p);
  });
  const projectsHtml = await renderView('projects.ejs', {
    grouped,
    currentPage: 'project',
  });
  writeFile(path.join(OUTPUT_DIR, 'projects', 'index.html'), withBasePath(projectsHtml));

  // About page
  const aboutHtml = await renderView('about.ejs', {
    currentPage: 'about',
  });
  writeFile(path.join(OUTPUT_DIR, 'about', 'index.html'), withBasePath(aboutHtml));

  console.log(`Built ${projects.length + 3} pages into /docs`);
}

build().catch(error => {
  console.error('Build failed:', error.message);
  process.exitCode = 1;
});
