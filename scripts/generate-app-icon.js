/**
 * Generate the Lumio app icon: #fa420f bg + white flame, all sizes.
 * Run: node scripts/generate-app-icon.js
 */
const sharp = require('sharp');
const path = require('path');

// The flame path from the Lumio SVG, in its natural coordinate space:
// viewBox roughly: flame spans x≈580–635, y≈0–85
// We'll render it in a square SVG with padding so it looks like a proper icon.

function flameSVG(size) {
  // Render flame centered in a square with ~20% padding on each side
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">
    <!-- orange background -->
    <rect width="100" height="100" fill="#fa420f"/>
    <!-- flame scaled to fit with padding: original coords ~580-635 x 0-85
         mapped into roughly 20..80 horizontal, 15..85 vertical -->
    <path fill="white" transform="translate(50,50) scale(0.62) translate(-50,-42.5)"
      d="M 55.7,85 
         C 47.9,85 41.4,82.3 36.0,76.8 
         C 30.7,71.3 28.0,64.8 28.0,57.1 
         C 27.9,42.5 35.0,32.8 40.2,28.2 
         C 37.3,44.2 53.8,44.6 49.2,31.6 
         C 42.7,10.2 55.5,0 55.5,0 
         C 55.5,0 56.7,13.3 75.5,37.4 
         C 79.9,43.1 83.0,49.2 83.0,57.1 
         C 83.0,64.8 80.5,71.3 75.5,76.8 
         C 70.5,82.3 63.9,85 55.7,85 Z"/>
  </svg>`;
}

async function generate() {
  const sizes = [
    // iOS
    { file: 'ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon.png', size: 1024 },
    // PWA / web
    { file: 'public/icons/icon-192.png', size: 192 },
    { file: 'public/icons/icon-512.png', size: 512 },
    { file: 'public/icons/apple-touch-icon.png', size: 180 },
    { file: 'public/icons/favicon-32.png', size: 32 },
    { file: 'public/icons/favicon-16.png', size: 16 },
    { file: 'public/icons/maskable-512.png', size: 512 },
  ];

  const root = path.join(__dirname, '..');

  for (const { file, size } of sizes) {
    const svg = flameSVG(size);
    await sharp(Buffer.from(svg))
      .resize(size, size)
      .png()
      .toFile(path.join(root, file));
    console.log(`✓ ${file} (${size}x${size})`);
  }

  console.log('\nAll icons generated!');
}

generate().catch(e => { console.error(e); process.exit(1); });
