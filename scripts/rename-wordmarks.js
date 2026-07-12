const fs = require('fs');
const path = require('path');

const ICONS_DIR = '/Users/devchauhan/Documents/buttons/brands-icons-conf/icons';

const dirs = fs.readdirSync(ICONS_DIR).filter(d => {
  return fs.statSync(path.join(ICONS_DIR, d)).isDirectory();
});

let renamedCount = 0;

for (const dir of dirs) {
  const folderPath = path.join(ICONS_DIR, dir);

  const files = fs.readdirSync(folderPath);

  // Rename wordmark.svg -> text.svg
  if (files.includes('wordmark.svg') && !files.includes('text.svg')) {
    fs.renameSync(path.join(folderPath, 'wordmark.svg'), path.join(folderPath, 'text.svg'));
    renamedCount++;
  } else if (files.includes('wordmark.svg') && files.includes('text.svg')) {
    fs.unlinkSync(path.join(folderPath, 'wordmark.svg'));
  }

  // Rename wordmark-light.svg / wordmarkLight.svg -> text-black.svg
  const lightFile = files.find(f => f === 'wordmark-light.svg' || f === 'wordmarkLight.svg');
  if (lightFile) {
    const target = path.join(folderPath, 'text-black.svg');
    if (!fs.existsSync(target)) {
      fs.renameSync(path.join(folderPath, lightFile), target);
      renamedCount++;
    } else {
      fs.unlinkSync(path.join(folderPath, lightFile));
    }
  }

  // Rename wordmark-dark.svg / wordmarkDark.svg -> text-white.svg
  const darkFile = files.find(f => f === 'wordmark-dark.svg' || f === 'wordmarkDark.svg');
  if (darkFile) {
    const target = path.join(folderPath, 'text-white.svg');
    if (!fs.existsSync(target)) {
      fs.renameSync(path.join(folderPath, darkFile), target);
      renamedCount++;
    } else {
      fs.unlinkSync(path.join(folderPath, darkFile));
    }
  }
}

console.log(`Renamed/Cleaned ${renamedCount} wordmark SVG files.`);
