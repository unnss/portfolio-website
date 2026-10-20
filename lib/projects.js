const fs = require('node:fs/promises');
const path = require('node:path');
const { prepareMedia, heroSources } = require('./media');

const BODY_SIZES = '(max-width: 600px) calc(100vw - 3rem - 2px), (max-width: 1500px) calc(100vw - 6rem - 2px), 1402px';

function heroSizes(count) {
  const controls = count > 1 ? 120 : 0;
  // Desktop arrows and gaps consume 120px. Mobile controls sit below the image.
  return `(max-width: 600px) calc(100vw - 3rem - 2px), (max-width: ${1376 + controls}px) calc(100vw - 6rem - ${controls + 2}px), 1278px`;
}

// Serialize refreshes so two preview requests cannot regenerate the same files at once.
let pending = Promise.resolve();
function getProjects() {
  const work = pending.then(async () => {
    const projects = JSON.parse(await fs.readFile(path.join(__dirname, '../data/projects.json'), 'utf8'));
    const media = await prepareMedia(projects);
    return projects.map(project => ({
      ...project,
      heroSlides: heroSources(project).map(src => media[src] || { src }),
      body: (project.body || project.media || []).map(block => ({ ...block, ...media[block.src] })),
    }));
  });
  pending = work.catch(() => {});
  return work;
}

module.exports = { getProjects, heroSizes, BODY_SIZES };
