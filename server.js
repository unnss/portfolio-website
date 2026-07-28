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
  res.render('index', { projects, heroProjects: resolvedHero });
});

app.get('/project/:slug', (req, res) => {
  const project = getProjects().find(p => p.slug === req.params.slug);
  if (!project) return res.status(404).send('Not found');
  res.render('project', { project });
});

app.listen(3000, () => console.log('Portfolio running on http://localhost:3000'));
