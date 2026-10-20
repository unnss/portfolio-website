const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const sharp = require('sharp');
const { prepareMedia, heroSources } = require('../lib/media');
const { getProjects } = require('../lib/projects');

test('responsive versions preserve originals, regenerate on edits, and recover missing output', async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'portfolio-media-test-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const publicDir = path.join(dir, 'public');
  await fs.mkdir(path.join(publicDir, 'images'), { recursive: true });
  const file = path.join(publicDir, 'images', 'sample.png');
  const create = (width, height) => sharp({ create: { width, height, channels: 3, background: '#c86b29' } }).png().toFile(file);
  await create(1800, 1000);
  const original = await fs.readFile(file);
  const options = { publicDir, cachePath: path.join(dir, 'cache.json') };
  const projects = [{ cover: '/images/sample.png', body: [{ type: 'image', src: '/images/sample.png' }] }];
  const first = (await prepareMedia(projects, options))['/images/sample.png'];
  assert.equal(first.width, 1800);
  assert.equal(first.height, 1000);
  assert.deepEqual(first.sources.map(s => s.width), [800, 1280, 1800]);
  assert.deepEqual(await fs.readFile(file), original);
  assert.equal(first.sources.at(-1).src, '/images/sample.png');
  const variant = path.join(publicDir, first.sources[0].src);
  const variantInfo = await sharp(variant).metadata();
  assert.equal(variantInfo.width, 800);
  assert.equal(variantInfo.height, 444);
  const before = (await fs.stat(variant)).mtimeMs;
  assert.deepEqual((await prepareMedia(projects, options))['/images/sample.png'], first);
  assert.equal((await fs.stat(variant)).mtimeMs, before, 'cached files are not rewritten');
  await fs.unlink(variant);
  await prepareMedia(projects, options);
  assert.equal((await sharp(variant).metadata()).width, 800);

  await create(1900, 1100);
  const changed = (await prepareMedia(projects, options))['/images/sample.png'];
  assert.notEqual(changed.sources[0].src, first.sources[0].src, 'new content gets a new URL');
  assert.equal(changed.height, 1100);
  assert.deepEqual((await fs.readdir(path.join(publicDir, 'images', 'generated'))).sort(),
    changed.sources.filter(s => s.src.includes('/generated/')).map(s => path.basename(s.src)).sort());
});

test('small images are not enlarged and invalid local paths fail clearly', async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'portfolio-small-media-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  await sharp({ create: { width: 320, height: 200, channels: 4, background: '#ffffff00' } }).png().toFile(path.join(dir, 'small.png'));
  const options = { publicDir: dir, cachePath: path.join(dir, 'cache.json') };
  const media = await prepareMedia([{ heroImages: ['/small.png'] }], options);
  assert.deepEqual(media['/small.png'].sources, [{ src: '/small.png', width: 320 }]);
  await assert.rejects(prepareMedia([{ heroImages: ['/missing.png'] }], options), /ENOENT/);
  await assert.rejects(prepareMedia([{ heroImages: ['/../outside.png'] }], options), /inside public/);
});

test('existing projects get responsive media and correct video dimensions without editing JSON', async () => {
  const file = path.join(__dirname, '../data/projects.json');
  const before = await fs.readFile(file);
  const projects = await getProjects();
  let videos = 0;
  for (const project of projects) {
    for (const image of [...project.heroSlides, ...project.body.filter(b => b.type === 'image')]) {
      assert(image.width > 0 && image.height > 0);
      assert(image.sources.length >= 1);
      assert(image.sources.every(s => s.width <= image.width));
    }
    for (const video of project.body.filter(b => b.type === 'video')) {
      assert(video.width > 0 && video.height > 0);
      videos++;
    }
  }
  assert.equal(videos, JSON.parse(before).flatMap(p => p.body || p.media || []).filter(b => b.type === 'video').length);
  assert.deepEqual(await fs.readFile(file), before);
});

test('banner fallback supports body, legacy media, and a cover-only project', () => {
  assert.deepEqual(heroSources({ heroImages: ['/hero.webp'], body: [{ type: 'image', src: '/body.webp' }] }), ['/hero.webp']);
  assert.deepEqual(heroSources({ body: [{ type: 'text', text: 'Example' }, { type: 'image', src: '/body.webp' }] }), ['/body.webp']);
  assert.deepEqual(heroSources({ media: [{ type: 'image', src: '/legacy.webp' }] }), ['/legacy.webp']);
  assert.deepEqual(heroSources({ cover: '/cover.webp' }), ['/cover.webp']);
});
