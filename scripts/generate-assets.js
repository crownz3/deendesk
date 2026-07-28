const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const LOGO_PATH = path.join(__dirname, '../src/assets/images/deendesk-logo.png');
const RES_PATH = path.join(__dirname, '../android/app/src/main/res');

// Background color for splash screen (Sleek dark blue / brand color #0f172a or white #ffffff)
const BG_COLOR = '#0f172a'; 

const icons = [
  { dir: 'mipmap-mdpi', size: 48 },
  { dir: 'mipmap-hdpi', size: 72 },
  { dir: 'mipmap-xhdpi', size: 96 },
  { dir: 'mipmap-xxhdpi', size: 144 },
  { dir: 'mipmap-xxxhdpi', size: 192 },
];

const splashPortrait = [
  { dir: 'drawable-port-mdpi', width: 320, height: 480 },
  { dir: 'drawable-port-hdpi', width: 480, height: 800 },
  { dir: 'drawable-port-xhdpi', width: 720, height: 1280 },
  { dir: 'drawable-port-xxhdpi', width: 960, height: 1600 },
  { dir: 'drawable-port-xxxhdpi', width: 1280, height: 1920 },
];

const splashLandscape = [
  { dir: 'drawable-land-mdpi', width: 480, height: 320 },
  { dir: 'drawable-land-hdpi', width: 800, height: 480 },
  { dir: 'drawable-land-xhdpi', width: 1280, height: 720 },
  { dir: 'drawable-land-xxhdpi', width: 1600, height: 960 },
  { dir: 'drawable-land-xxxhdpi', width: 1920, height: 1280 },
];

async function generateAssets() {
  console.log('Generating App Icons and Splash Screens from deendesk-logo.png...');

  if (!fs.existsSync(LOGO_PATH)) {
    console.error('Logo file not found:', LOGO_PATH);
    process.exit(1);
  }

  // 1. Generate App Icons
  for (const icon of icons) {
    const dirPath = path.join(RES_PATH, icon.dir);
    if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });

    // Square icon
    await sharp(LOGO_PATH)
      .resize(icon.size, icon.size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .toFile(path.join(dirPath, 'ic_launcher.png'));

    // Round icon
    await sharp(LOGO_PATH)
      .resize(icon.size, icon.size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .composite([{
        input: Buffer.from(`<svg><circle cx="${icon.size/2}" cy="${icon.size/2}" r="${icon.size/2}" fill="#fff"/></svg>`),
        blend: 'dest-in'
      }])
      .toFile(path.join(dirPath, 'ic_launcher_round.png'));

    // Foreground icon for adaptive icons
    await sharp(LOGO_PATH)
      .resize(Math.round(icon.size * 0.7), Math.round(icon.size * 0.7), { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .extend({
        top: Math.round(icon.size * 0.15),
        bottom: Math.round(icon.size * 0.15),
        left: Math.round(icon.size * 0.15),
        right: Math.round(icon.size * 0.15),
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .toFile(path.join(dirPath, 'ic_launcher_foreground.png'));
  }
  console.log('✔ App Icons generated successfully.');

  // Helper for generating centered logo splash
  async function createSplash(dir, width, height) {
    const dirPath = path.join(RES_PATH, dir);
    if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });

    const maxLogoDim = Math.round(Math.min(width, height) * 0.5);

    const resizedLogo = await sharp(LOGO_PATH)
      .resize(maxLogoDim, maxLogoDim, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .toBuffer();

    await sharp({
      create: {
        width: width,
        height: height,
        channels: 4,
        background: BG_COLOR
      }
    })
    .composite([{ input: resizedLogo, gravity: 'center' }])
    .png()
    .toFile(path.join(dirPath, 'splash.png'));
  }

  // 2. Generate Portrait Splash Screens
  for (const item of splashPortrait) {
    await createSplash(item.dir, item.width, item.height);
  }
  console.log('✔ Portrait Splash Screens generated.');

  // 3. Generate Landscape Splash Screens
  for (const item of splashLandscape) {
    await createSplash(item.dir, item.width, item.height);
  }
  console.log('✔ Landscape Splash Screens generated.');

  // 4. Default drawable splash
  await createSplash('drawable', 1080, 1920);
  console.log('✔ Default drawable splash created.');

  console.log('🎉 All Android Icons & Splash screens generated successfully!');
}

generateAssets().catch(err => {
  console.error('Error generating assets:', err);
  process.exit(1);
});
