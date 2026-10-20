const { getProjects } = require('../lib/projects');

getProjects().then(projects => {
  console.log(`Prepared responsive media for ${projects.length} projects.`);
}).catch(error => {
  console.error('Media preparation failed:', error.message);
  process.exitCode = 1;
});
