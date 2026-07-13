const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const source = path.join(__dirname, '..', 'src', 'assets', 'images', 'deendesk-logo.png');

// Standard launcher sizes
const sizes = [
  { folder: 'mipmap-mdpi',    size: 48,  fgSize: 54  },
  { folder: 'mipmap-hdpi',    size: 72,  fgSize: 81  },
  { folder: 'mipmap-xhdpi',   size: 96,  fgSize: 108 },
  { folder: 'mipmap-xxhdpi',  size: 144, fgSize: 162 },
  { folder: 'mipmap-xxxhdpi', size: 192, fgSize: 216 },
];

const resDir = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'res');

async function generate() {
  for (const { folder, size, fgSize } of sizes) {
    const outDir = path.join(resDir, folder);

    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }

    // ic_launcher.png  (standard)
    await sharp(source).resize(size, size).png()
      .toFile(path.join(outDir, 'ic_launcher.png'));

    // ic_launcher_round.png  (standard)
    await sharp(source).resize(size, size).png()
      .toFile(path.join(outDir, 'ic_launcher_round.png'));

    // ic_launcher_foreground.png  (used by adaptive icon XML — slightly larger for safe zone)
    await sharp(source).resize(fgSize, fgSize).png()
      .toFile(path.join(outDir, 'ic_launcher_foreground.png'));

    console.log(`✓ ${folder} → ic_launcher.png (${size}px) + ic_launcher_foreground.png (${fgSize}px)`);
  }

  // Play Store icon 512x512
  const playStoreOut = path.join(__dirname, 'play_store_icon_512.png');
  await sharp(source).resize(512, 512).png().toFile(playStoreOut);
  console.log(`✓ Play Store icon (512x512px) → ${playStoreOut}`);

  // Fix adaptive icon XMLs to reference ic_launcher_foreground (avoids circular ref)
  const anydpiDir = path.join(resDir, 'mipmap-anydpi-v26');

  const launcherXml = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@android:color/transparent"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>`;

  fs.writeFileSync(path.join(anydpiDir, 'ic_launcher.xml'), launcherXml);
  fs.writeFileSync(path.join(anydpiDir, 'ic_launcher_round.xml'), launcherXml);

  console.log('✓ Fixed adaptive icon XMLs in mipmap-anydpi-v26/');
  console.log('\n✅ All Android icon sizes generated successfully!');
}

generate().catch(console.error);
