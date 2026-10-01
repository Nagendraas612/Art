const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

async function generateFavicons() {
  const logoPath = path.join(__dirname, '..', 'public', 'KaalaBhadraLogo.PNG');
  const publicDir = path.join(__dirname, '..', 'public');

  console.log('Reading logo from:', logoPath);

  // Read the original logo
  const logo = sharp(logoPath);
  const metadata = await logo.metadata();
  console.log('Logo dimensions:', metadata.width, 'x', metadata.height);

  // The logo has a light/cream background. We need to:
  // 1. Trim the whitespace around the actual art
  // 2. Create PNG icons with transparent background
  
  // First, trim the logo to just the art content
  const trimmed = await sharp(logoPath)
    .trim({ threshold: 30 })
    .toBuffer();
  
  const trimmedMeta = await sharp(trimmed).metadata();
  console.log('Trimmed dimensions:', trimmedMeta.width, 'x', trimmedMeta.height);

  // Generate favicon sizes - keep the aspect ratio, place on transparent background
  // For ICO/favicon: 32x32 and 16x16
  // For PWA icons: 192x192 and 512x512
  // For apple-icon: 180x180

  // Create a high-quality 512 icon first - fit the art within the square, transparent bg
  await sharp(trimmed)
    .resize(512, 512, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .png()
    .toFile(path.join(publicDir, 'icon-512.png'));
  console.log('Created icon-512.png');

  // 192x192
  await sharp(trimmed)
    .resize(192, 192, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .png()
    .toFile(path.join(publicDir, 'icon-192.png'));
  console.log('Created icon-192.png');

  // 180x180 apple icon
  await sharp(trimmed)
    .resize(180, 180, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .png()
    .toFile(path.join(publicDir, 'apple-icon.png'));
  console.log('Created apple-icon.png');

  // For favicon.ico, create a 32x32 PNG first, then we'll use it as favicon
  // Modern browsers support PNG favicons, so we can use that
  const favicon32 = await sharp(trimmed)
    .resize(32, 32, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .png()
    .toBuffer();
  
  // Also create a 48x48 for higher DPI
  const favicon48 = await sharp(trimmed)
    .resize(48, 48, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .png()
    .toBuffer();

  // Save 32x32 as favicon.png for modern browsers
  await sharp(favicon32).toFile(path.join(publicDir, 'favicon.png'));
  console.log('Created favicon.png (32x32)');

  // Create an ICO file manually (ICO format header + PNG data)
  // ICO format: https://en.wikipedia.org/wiki/ICO_(file_format)
  const pngData32 = favicon32;
  const pngData48 = favicon48;
  
  // ICO header: 6 bytes
  const iconDir = Buffer.alloc(6);
  iconDir.writeUInt16LE(0, 0);     // Reserved
  iconDir.writeUInt16LE(1, 2);     // Type: 1 = ICO
  iconDir.writeUInt16LE(2, 4);     // Number of images: 2

  // ICO directory entries: 16 bytes each
  const entry1 = Buffer.alloc(16);
  entry1.writeUInt8(32, 0);        // Width: 32
  entry1.writeUInt8(32, 1);        // Height: 32
  entry1.writeUInt8(0, 2);         // Color palette: 0
  entry1.writeUInt8(0, 3);         // Reserved
  entry1.writeUInt16LE(1, 4);      // Color planes
  entry1.writeUInt16LE(32, 6);     // Bits per pixel
  entry1.writeUInt32LE(pngData32.length, 8);  // Size of image data
  entry1.writeUInt32LE(6 + 16 * 2, 12);       // Offset to image data

  const entry2 = Buffer.alloc(16);
  entry2.writeUInt8(48, 0);        // Width: 48
  entry2.writeUInt8(48, 1);        // Height: 48
  entry2.writeUInt8(0, 2);         // Color palette: 0
  entry2.writeUInt8(0, 3);         // Reserved
  entry2.writeUInt16LE(1, 4);      // Color planes
  entry2.writeUInt16LE(32, 6);     // Bits per pixel
  entry2.writeUInt32LE(pngData48.length, 8);  // Size of image data
  entry2.writeUInt32LE(6 + 16 * 2 + pngData32.length, 12);  // Offset

  const ico = Buffer.concat([iconDir, entry1, entry2, pngData32, pngData48]);
  fs.writeFileSync(path.join(publicDir, 'favicon.ico'), ico);
  console.log('Created favicon.ico (32x32 + 48x48)');

  console.log('\nAll favicons generated successfully!');
}

generateFavicons().catch(console.error);
