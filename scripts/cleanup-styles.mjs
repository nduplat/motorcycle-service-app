// scripts/cleanup-styles.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectRoot = path.resolve(__dirname, '..');

// Función para leer archivo SCSS
function readScssFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    console.error(`Error reading ${filePath}:`, error.message);
    return '';
  }
}

// Función para escribir archivo SCSS
function writeScssFile(filePath, content) {
  try {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ Updated ${filePath}`);
  } catch (error) {
    console.error(`Error writing ${filePath}:`, error.message);
  }
}

// Función para encontrar duplicados en variables
function findDuplicateVariables() {
  const variablesFile = path.join(projectRoot, 'src/styles/_variables.scss');
  const content = readScssFile(variablesFile);

  const variables = {};
  const duplicates = [];

  // Extraer variables con regex
  const varRegex = /\$([a-zA-Z-]+):\s*(.+?);/g;
  let match;

  while ((match = varRegex.exec(content)) !== null) {
    const [, name, value] = match;
    if (variables[name]) {
      duplicates.push({ name, firstValue: variables[name], secondValue: value });
    } else {
      variables[name] = value;
    }
  }

  return duplicates;
}

// Función para limpiar variables duplicadas
function cleanDuplicateVariables() {
  const variablesFile = path.join(projectRoot, 'src/styles/_variables.scss');
  let content = readScssFile(variablesFile);

  // Remover variables duplicadas (mantener la primera ocurrencia)
  const seen = new Set();
  const lines = content.split('\n');
  const cleanedLines = [];

  for (const line of lines) {
    const match = line.match(/\$([a-zA-Z-]+):\s*(.+?);/);
    if (match) {
      const varName = match[1];
      if (!seen.has(varName)) {
        seen.add(varName);
        cleanedLines.push(line);
      } else {
        console.log(`🗑️  Removed duplicate variable: $${varName}`);
      }
    } else {
      cleanedLines.push(line);
    }
  }

  writeScssFile(variablesFile, cleanedLines.join('\n'));
}

// Función para encontrar estilos no utilizados
function findUnusedStyles() {
  const componentsDir = path.join(projectRoot, 'src/components');
  const stylesDir = path.join(projectRoot, 'src/styles');

  // Obtener todos los archivos de componentes
  const componentFiles = [];
  function scanDirectory(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);

      if (stat.isDirectory()) {
        scanDirectory(filePath);
      } else if (file.endsWith('.ts') || file.endsWith('.html')) {
        componentFiles.push(filePath);
      }
    }
  }
  scanDirectory(componentsDir);

  // Obtener clases definidas en SCSS
  const scssClasses = new Set();
  function scanScssDirectory(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);

      if (stat.isDirectory()) {
        scanScssDirectory(filePath);
      } else if (file.endsWith('.scss')) {
        const content = readScssFile(filePath);
        const classRegex = /\.([a-zA-Z][a-zA-Z0-9_-]*)/g;
        let match;
        while ((match = classRegex.exec(content)) !== null) {
          scssClasses.add(match[1]);
        }
      }
    }
  }
  scanScssDirectory(stylesDir);

  // Verificar uso en componentes
  const usedClasses = new Set();
  for (const file of componentFiles) {
    const content = readScssFile(file);
    for (const className of scssClasses) {
      if (content.includes(className)) {
        usedClasses.add(className);
      }
    }
  }

  const unusedClasses = [...scssClasses].filter(cls => !usedClasses.has(cls));
  return unusedClasses;
}

// Función para limpiar estilos no utilizados
function cleanUnusedStyles() {
  const unusedClasses = findUnusedStyles();

  if (unusedClasses.length === 0) {
    console.log('✅ No unused styles found');
    return;
  }

  console.log('🧹 Found unused classes:', unusedClasses);

  // Nota: Esta función requeriría análisis más sofisticado para remover
  // estilos no utilizados de manera segura sin romper el código
  console.log('⚠️  Manual review required for unused styles cleanup');
}

// Función principal
function main() {
  console.log('🧹 Starting SCSS cleanup...\n');

  console.log('1. Finding duplicate variables...');
  const duplicates = findDuplicateVariables();
  if (duplicates.length > 0) {
    console.log('📋 Duplicate variables found:');
    duplicates.forEach(dup => {
      console.log(`   $${dup.name}: "${dup.firstValue}" vs "${dup.secondValue}"`);
    });

    console.log('\n2. Cleaning duplicate variables...');
    cleanDuplicateVariables();
  } else {
    console.log('✅ No duplicate variables found');
  }

  console.log('\n3. Finding unused styles...');
  cleanUnusedStyles();

  console.log('\n✨ Cleanup completed!');
}

// Ejecutar si se llama directamente
main();

export { main as cleanupStyles };