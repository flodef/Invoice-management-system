const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// Create an SVG for the icon using Tabler's receipt icon
const svgIcon = `
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 24 24" stroke-width="1.5" stroke="#3b82f6" fill="none" stroke-linecap="round" stroke-linejoin="round">
  <rect width="100%" height="100%" fill="white" />
  <path stroke="none" d="M0 0h24v24H0z" fill="none" />
  <path d="M5 21v-16a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v16l-3 -2l-2 2l-2 -2l-2 2l-2 -2l-3 2" />
  <path d="M14 8h-2.5a1.5 1.5 0 0 0 0 3h1a1.5 1.5 0 0 1 0 3h-2.5m2 0v1.5m0 -9v1.5" />
</svg>
`;

const publicDir = path.join(__dirname, '..', 'public');
const iconsDir = path.join(publicDir, 'icons');

// Ensure directories exist
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Save the original SVG
fs.writeFileSync(path.join(iconsDir, 'icon.svg'), svgIcon);

// Generate favicon.ico
sharp(Buffer.from(svgIcon))
  .resize(32, 32)
  .toFile(path.join(publicDir, 'favicon.ico'))
  .then(() => console.log('Created favicon.ico'))
  .catch(err => console.error('Error creating favicon.ico:', err));

// Generate PNG icons in different sizes
const sizes = [16, 32, 192, 512];

Promise.all(
  sizes.map(size => {
    return sharp(Buffer.from(svgIcon))
      .resize(size, size)
      .png()
      .toFile(path.join(iconsDir, `icon-${size}x${size}.png`));
  })
)
  .then(() => console.log('Generated all icon sizes'))
  .catch(err => console.error('Error generating icons:', err));

// Also create apple touch icon
sharp(Buffer.from(svgIcon))
  .resize(180, 180)
  .png()
  .toFile(path.join(iconsDir, 'apple-touch-icon.png'))
  .then(() => console.log('Created apple-touch-icon.png'))
  .catch(err => console.error('Error creating apple-touch-icon.png:', err));
