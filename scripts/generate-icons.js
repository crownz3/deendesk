const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const source = path.join(__dirname, '..', 'src', 'assets', 'images', 'deendesk-logo.png');

const sizes = [
  { folder: 'mipmap-mdpi',    size: 48  },
  { folder: 'mipmap-hdpi',    size: 72  },
  { folder: 'mipmap-xhdpi',   size: 96  },
  { folder: 'mipmap-xxhdpi',  size: 144 },
  { folder: 'mipmap-xxxhdpi', size: 192 },
];

const resDir = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'res');

async function generate() {
  for (const { folder, size } of sizes) {
    const outDir = path.join(resDir, folder);
    const outFile = path.join(outDir, 'ic_launcher.png');
    const roundFile = path.join(outDir, 'ic_launcher_round.png');

    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }

    await sharp(source)
      .resize(size, size)
      .png()
      .toFile(outFile);

    await sharp(source)
      .resize(size, size)
      .png()
      .toFile(roundFile);

    console.log(`✓ ${folder} (${size}x${size}px) → ic_launcher.png + ic_launcher_round.png`);
  }

  // Also generate 512x512 Play Store icon
  const playStoreOut = path.join(__dirname, 'play_store_icon_512.png');
  await sharp(source).resize(512, 512).png().toFile(playStoreOut);
  console.log(`✓ Play Store icon (512x512px) → ${playStoreOut}`);

  console.log('\n✅ All Android icon sizes generated successfully!');
}

generate().catch(console.error);
