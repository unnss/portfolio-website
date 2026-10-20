const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const sharp = require('sharp');
const MP4Box = require('mp4box');

const ROOT = path.join(__dirname, '..');
const GENERATED = '/images/generated/';
const WIDTHS = [800, 1280, 1920, 2560];
const RECIPE = JSON.stringify({ widths: WIDTHS, quality: 90, sharp: sharp.versions.sharp, vips: sharp.versions.vips, version: 1 });

function heroSources(project) {
  if (project.heroImages?.length) return project.heroImages;
  const images = (project.body || project.media || []).filter(b => b.type === 'image').map(b => b.src);
  return images.length ? images : [project.cover];
}

function localFile(publicDir, src) {
  const file = path.resolve(publicDir, '.' + src);
  if (!file.startsWith(path.resolve(publicDir) + path.sep)) {
    throw new Error('Media path must stay inside public: ' + src);
  }
  return file;
}

async function exists(file) {
  try { await fs.access(file); return true; } catch { return false; }
}

function videoDimensions(buffer, src) {
  const parser = MP4Box.createFile();
  let info, failure;
  parser.onReady = result => { info = result; };
  parser.onError = error => { failure = error; };
  const data = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  data.fileStart = 0;
  parser.appendBuffer(data);
  parser.flush();
  const track = info?.videoTracks?.[0];
  const width = track?.track_width || track?.video?.width;
  const height = track?.track_height || track?.video?.height;
  if (failure || !width || !height) throw new Error('Cannot read video dimensions: ' + src);
  return { width, height };
}

async function imageVersions(buffer, src, publicDir) {
  const metadata = await sharp(buffer).metadata();
  const rotated = metadata.orientation >= 5 && metadata.orientation <= 8;
  const width = rotated ? metadata.height : metadata.width;
  const height = rotated ? metadata.width : metadata.height;
  if (!width || !height) throw new Error('Cannot read image dimensions: ' + src);

  // Keep the original at its native size, including animation and fine detail.
  const sources = [];
  if (!metadata.pages || metadata.pages === 1) {
    const hash = crypto.createHash('sha256').update(buffer).update(RECIPE).digest('hex').slice(0, 16);
    for (const target of WIDTHS.filter(w => w < width)) {
      const variant = `${GENERATED}${hash}-${target}.webp`;
      const file = localFile(publicDir, variant);
      if (!(await exists(file))) {
        await sharp(buffer).rotate().resize({ width: target, withoutEnlargement: true })
          .webp({ quality: 90, effort: 5 }).toFile(file);
      }
      // Detailed diagrams can already be smaller than a re-encoded derivative.
      if ((await fs.stat(file)).size < buffer.length) sources.push({ src: variant, width: target });
    }
  }
  sources.push({ src, width });
  const fallback = sources.find(s => s.width >= Math.min(1280, width));
  return { src: fallback.src, width, height, sources };
}

async function prepareMedia(projects, options = {}) {
  const publicDir = options.publicDir || path.join(ROOT, 'public');
  const cachePath = options.cachePath || path.join(ROOT, '.cache', 'media.json');
  const references = new Map();
  const add = (src, type) => {
    if (typeof src === 'string' && src.startsWith('/') && !src.startsWith('//')) references.set(src, type);
  };
  for (const project of projects) {
    heroSources(project).forEach(src => add(src, 'image'));
    for (const block of project.body || project.media || []) {
      if (block.type === 'image' || block.type === 'video') add(block.src, block.type);
    }
  }

  let previous = {};
  try { previous = JSON.parse(await fs.readFile(cachePath, 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  await fs.mkdir(localFile(publicDir, GENERATED), { recursive: true });
  const cache = {}, media = {};
  for (const [src, type] of references) {
    const file = localFile(publicDir, src);
    const stat = await fs.stat(file);
    const fingerprint = `${type}:${stat.size}:${stat.mtimeMs}:${RECIPE}`;
    const cached = previous[src];
    const reusable = cached?.fingerprint === fingerprint &&
      (await Promise.all((cached.media.sources || []).map(s => exists(localFile(publicDir, s.src))))).every(Boolean);
    const result = reusable ? cached.media : type === 'image'
      ? await imageVersions(await fs.readFile(file), src, publicDir)
      : videoDimensions(await fs.readFile(file), src);
    media[src] = result;
    cache[src] = { fingerprint, media: result };
  }

  // This dedicated directory contains only generated derivatives, never originals.
  const used = new Set(Object.values(media).flatMap(m => (m.sources || []).map(s => s.src)));
  for (const name of await fs.readdir(localFile(publicDir, GENERATED))) {
    if (/^[a-f0-9]{16}-\d+\.webp$/.test(name) && !used.has(GENERATED + name)) {
      await fs.unlink(localFile(publicDir, GENERATED + name));
    }
  }
  if (JSON.stringify(previous) !== JSON.stringify(cache)) {
    await fs.mkdir(path.dirname(cachePath), { recursive: true });
    await fs.writeFile(cachePath, JSON.stringify(cache, null, 2) + '\n');
  }
  return media;
}

module.exports = { prepareMedia, heroSources };
