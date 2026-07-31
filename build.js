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

// Logo data for the program-icons partial. Mirrors app.locals.programIcons
// in server.js so both renderers see the same thing.
const PROGRAM_ICONS = require('./data/program-icons');

// Renders a view with the locals every template gets, plus its own page data
const renderView = (view, data) =>
  ejs.renderFile(path.join(VIEWS_DIR, view), { programIcons: PROGRAM_ICONS, ...data });

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

  // Same priority as imagesFor() in hero.js: dedicated wide heroImages
  // first, then body images, then the cover.
  const firstProject = resolvedHero[0];
  const firstProjectImages = (firstProject.heroImages && firstProject.heroImages.length)
    ? firstProject.heroImages
    : (firstProject.body || firstProject.media || [])
        .filter((m) => m.type === 'image')
        .map((m) => m.src);
  const heroFirstImage = firstProjectImages.length ? firstProjectImages[0] : firstProject.cover;

  // Home page — same data server.js would have passed to index.ejs
  const indexHtml = await renderView('index.ejs', {
    projects,
    heroProjects: resolvedHero,
    heroFirstImage,
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

build();
