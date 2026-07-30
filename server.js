const express = require('express');
const fs = require('fs');
const app = express();

app.set('view engine', 'ejs');
app.use(express.static('public'));

const getProjects = () => JSON.parse(fs.readFileSync('./data/projects.json'));

app.get('/', (req, res) => {
  const projects = getProjects();
  const heroProjects = projects.filter(p => p.featured);
  const resolvedHero = heroProjects.length ? heroProjects : [projects[0]];

  // Same priority as imagesFor() in hero.js: dedicated wide heroImages
  // first, then media images, then the cover — kept in sync so the first
  // paint (before hero.js runs) matches what the script would show anyway.
  const firstProject = resolvedHero[0];
  const firstProjectImages = (firstProject.heroImages && firstProject.heroImages.length)
    ? firstProject.heroImages
    : (firstProject.media || []).filter(m => m.type === 'image').map(m => m.src);
  const heroFirstImage = firstProjectImages.length ? firstProjectImages[0] : firstProject.cover;

  res.render('index', { projects, heroProjects: resolvedHero, heroFirstImage });
});

app.get('/project/:slug', (req, res) => {
  const project = getProjects().find(p => p.slug === req.params.slug);
  if (!project) return res.status(404).send('Not found');
  res.render('project', { project });
});

app.listen(3000, () => console.log('Portfolio running on http://localhost:3000'));