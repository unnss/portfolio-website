# Portfolio website

Use Node.js 24 or newer and install the tools with `npm ci`.

- `npm start` opens the local server at http://localhost:3000.
- `npm run build` prepares media and rebuilds the static site in `docs`.
- `npm run prepare:media` prepares media without rebuilding pages.
- `npm test` checks media generation, cache refreshes, and project integration.

## Adding images and videos

Continue editing `data/projects.json` with the original paths in `heroImages`
and image/video body blocks. Captions are optional. The preview refreshes media
when you reload a project or the home page; publishing prepares it automatically.

The preparation step creates WebP image versions at 800, 1280, 1920, and 2560px
wide where the original is larger. It keeps original files unchanged and offers
them as the largest browser candidate. Variants that would be larger in bytes
than the original are omitted. Smaller images are never enlarged.

Image and MP4 dimensions are read automatically to reserve space while loading.
Local MP4 files are not re-encoded. New or changed image content gets new generated
filenames so browsers can load updates. Cached versions are reused on later runs.

`public/images/generated` and `.cache/media.json` are generated files; edit the
original assets instead. The static build copies responsive assets into `docs`,
so the generated site can also be previewed on its own. GitHub Pages runs the
same preparation during `node build.js`.
