import fs from 'fs';
import path from 'path';

const replacements = [
  { from: /bg-white/g, to: 'bg-background' },
  { from: /text-gray-900/g, to: 'text-foreground' },
  { from: /text-gray-700/g, to: 'text-muted-foreground' },
  { from: /border-gray-300/g, to: 'border-border' },
  { from: /focus:ring-blue-300/g, to: 'focus:ring-primary/20' },
  { from: /text-blue-800/g, to: 'text-primary' },
  { from: /text-blue-600/g, to: 'text-primary' },
  { from: /border-blue-200/g, to: 'border-primary/20' },
  { from: /bg-red-100/g, to: 'bg-destructive/10' },
  { from: /border-red-300/g, to: 'border-destructive/30' },
  { from: /text-red-700/g, to: 'text-destructive' },
  { from: /hover:bg-red-200/g, to: 'hover:bg-destructive/20' },
  { from: /focus:border-blue-400/g, to: 'focus:border-primary' },
  { from: /border-blue-600/g, to: 'border-primary' },
];

const filePath = process.argv[2];

if (!filePath) {
  console.error('Usage: node homogenize_styles.mjs <file_path>');
  process.exit(1);
}

const absolutePath = path.resolve(filePath);

fs.readFile(absolutePath, 'utf8', (err, data) => {
  if (err) {
    console.error(`Error reading file: ${err}`);
    process.exit(1);
  }

  let modifiedData = data;
  for (const replacement of replacements) {
    modifiedData = modifiedData.replace(replacement.from, replacement.to);
  }

  fs.writeFile(absolutePath, modifiedData, 'utf8', (err) => {
    if (err) {
      console.error(`Error writing file: ${err}`);
      process.exit(1);
    }
    console.log(`Homogenization complete for ${absolutePath}`);
  });
});
