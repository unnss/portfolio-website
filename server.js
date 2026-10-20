const express = require('express');
const path = require('path');
const { getProjects, heroSizes, BODY_SIZES } = require('./lib/projects');
const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

// Available to every res.render() without passing it each time — the
// program-icons partial reads it. Edit the logos in data/program-icons.js.
app.locals.programIcons = require('./data/program-icons');
app.locals.bodyImageSizes = BODY_SIZES;

app.get('/', async (req, res) => {
  const projects = await getProjects();
  const heroProjects = projects.filter(p => p.featured);
  const resolvedHero = heroProjects.length ? heroProjects : [projects[0]];
  const heroFirstImage = resolvedHero[0].heroSlides[0];

  res.render('index', {
    projects,
    heroProjects: resolvedHero,
    heroFirstImage,
    heroImageSizes: heroSizes(resolvedHero.length),
    currentPage: 'home',   // controls both nav highlighting and which footer shows
  });
});

app.get('/project/:slug', async (req, res) => {
  const project = (await getProjects()).find(p => p.slug === req.params.slug);
  if (!project) return res.status(404).send('Not found');
  res.render('project', { project, currentPage: 'project' });
});

// Categorized index of every project. Categories are derived from whatever
// `category` value each project has — there's no fixed list to maintain,
// so adding a project with a new category string (e.g. "Texturing")
// automatically creates that section, in the order it's first seen.
app.get('/projects', async (req, res) => {
  const projects = await getProjects();
  const grouped = {};
  projects.forEach((p) => {
    const category = p.category || 'Other';
    if (!grouped[category]) grouped[category] = [];
    grouped[category].push(p);
  });
  res.render('projects', { grouped, currentPage: 'project' });
});

app.get('/about', (req, res) => {
  res.render('about', { currentPage: 'about' });
});

app.listen(3000, () => console.log('Portfolio running on http://localhost:3000'));
