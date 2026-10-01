const sharp = require('sharp');
const path = require('path');

async function removeBackground() {
  const logoPath = path.join(__dirname, '..', 'public', 'KaalaBhadraLogo.PNG');
  const outputPath = path.join(__dirname, '..', 'public', 'KaalaBhadraLogoTransparent.png');

  // Read the logo
  const { data, info } = await sharp(logoPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  console.log('Image:', info.width, 'x', info.height, 'channels:', info.channels);

  // The background color is a cream/off-white (~#f0ece2 to #efe9df range)
  // We'll make pixels that are close to this color transparent
  const pixels = Buffer.from(data);
  const { width, height, channels } = info;

  // Sample background color from corner pixels
  const bgR = pixels[0];
  const bgG = pixels[1];
  const bgB = pixels[2];
  console.log('Background color sample (top-left):', bgR, bgG, bgB);

  // More aggressive threshold for cream/beige backgrounds
  const threshold = 45;

  for (let i = 0; i < pixels.length; i += channels) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];

    // Check if this pixel is close to the cream background
    const dr = Math.abs(r - bgR);
    const dg = Math.abs(g - bgG);
    const db = Math.abs(b - bgB);

    if (dr < threshold && dg < threshold && db < threshold) {
      // Make transparent
      pixels[i + 3] = 0;
    } else if (dr < threshold * 1.5 && dg < threshold * 1.5 && db < threshold * 1.5) {
      // Partial transparency for edge pixels (anti-aliasing)
      const maxDiff = Math.max(dr, dg, db);
      const alpha = Math.min(255, Math.floor((maxDiff / (threshold * 1.5)) * 255));
      pixels[i + 3] = alpha;
    }
  }

  await sharp(pixels, { raw: { width, height, channels } })
    .png()
    .toFile(outputPath);

  console.log('Created transparent logo at:', outputPath);
}

removeBackground().catch(console.error);
