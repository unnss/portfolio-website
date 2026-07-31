const express = require('express');
const fs = require('fs');
const app = express();

app.set('view engine', 'ejs');
app.use(express.static('public'));

// Available to every res.render() without passing it each time — the
// program-icons partial reads it. Edit the logos in data/program-icons.js.
app.locals.programIcons = require('./data/program-icons');

const getProjects = () => JSON.parse(fs.readFileSync('./data/projects.json'));

// Same priority as imagesFor() in hero.js: dedicated wide heroImages first,
// then media images, then the cover.
function firstHeroImage(project) {
  const images = (project.heroImages && project.heroImages.length)
    ? project.heroImages
    : (project.media || []).filter(m => m.type === 'image').map(m => m.src);
  return images.length ? images[0] : project.cover;
}

app.get('/', (req, res) => {
  const projects = getProjects();
  const heroProjects = projects.filter(p => p.featured);
  const resolvedHero = heroProjects.length ? heroProjects : [projects[0]];
  const heroFirstImage = firstHeroImage(resolvedHero[0]);

  res.render('index', {
    projects,
    heroProjects: resolvedHero,
    heroFirstImage,
    currentPage: 'home',   // controls both nav highlighting and which footer shows
  });
});

app.get('/project/:slug', (req, res) => {
  const project = getProjects().find(p => p.slug === req.params.slug);
  if (!project) return res.status(404).send('Not found');
  res.render('project', { project, currentPage: 'project' });
});

// Categorized index of every project. Categories are derived from whatever
// `category` value each project has — there's no fixed list to maintain,
// so adding a project with a new category string (e.g. "Texturing")
// automatically creates that section, in the order it's first seen.
app.get('/projects', (req, res) => {
  const projects = getProjects();
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
