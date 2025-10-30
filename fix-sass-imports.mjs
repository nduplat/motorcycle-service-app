import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. Primero actualizar _constants.scss con variables faltantes
function updateConstantsFile() {
  const constantsPath = 'src/styles/_constants.scss';
  let content = fs.readFileSync(constantsPath, 'utf8');

  // Verificar si falta $muted-foreground
  if (!content.includes('$muted-foreground')) {
    content += `\n// Colors
$muted-foreground: #6b7280;
$foreground: #1f2937;
$background: #ffffff;
$primary: #3b82f6;
$secondary: #64748b;
`;
    fs.writeFileSync(constantsPath, content, 'utf8');
    console.log('✓ Agregadas variables de color a _constants.scss');
  }
}

// 2. Actualizar _mixins.scss con mixins faltantes
function updateMixinsFile() {
  const mixinsPath = 'src/styles/_mixins.scss';
  let content = fs.readFileSync(mixinsPath, 'utf8');

  // Verificar mixins faltantes
  const mixinsToAdd = [];

  if (!content.includes('@mixin border-radius')) {
    mixinsToAdd.push(`
// Border radius mixin
@mixin border-radius($radius) {
  border-radius: $radius;
}`);
  }

  if (!content.includes('@mixin card-base')) {
    mixinsToAdd.push(`
// Card base styles
@mixin card-base {
  background: white;
  border-radius: 0.5rem;
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
  padding: 1.5rem;
}`);
  }

  if (mixinsToAdd.length > 0) {
    content += '\n' + mixinsToAdd.join('\n');
    fs.writeFileSync(mixinsPath, content, 'utf8');
    console.log('✓ Agregados mixins faltantes a _mixins.scss\n');
  }
}

// 3. Lista completa de archivos y sus necesidades
const allFiles = [
  { file: 'src/styles/utilities/_animations.scss', needs: ['constants'] },
  { file: 'src/components/home/hero/hero.component.scss', needs: ['constants'] },
  { file: 'src/components/admin/admin-dashboard.component.scss', needs: ['constants', 'mixins'] },
  { file: 'src/components/public/client-flow/motorcycle-selection.component.scss', needs: ['constants', 'mixins'] },
  { file: 'src/components/admin/schedules/time-blocks-manager.component.scss', needs: ['constants', 'mixins'] },
  { file: 'src/components/public/client-flow/client-flow-container.component.scss', needs: ['constants', 'mixins'] },
  { file: 'src/components/public/queue-status/queue-status.component.scss', needs: ['constants', 'mixins'] },
  { file: 'src/components/admin/schedules/employee-schedule-manager.component.scss', needs: ['constants', 'mixins'] },
  { file: 'src/components/shared/motorcycle-registration.component.scss', needs: ['constants', 'mixins'] },
  { file: 'src/components/admin/schedules/schedule-calendar.component.scss', needs: ['constants', 'mixins'] },
  { file: 'src/components/shared/queue-join.component.scss', needs: ['constants'] },
  { file: 'src/components/shared/service-selection.component.scss', needs: ['constants'] },
  { file: 'src/components/admin/capacity-dashboard/capacity-dashboard.component.scss', needs: ['constants', 'mixins'] },
  { file: 'src/components/employee/queue-management.component.scss', needs: ['constants', 'mixins'] },
  { file: 'src/components/admin/admin-layout.component.scss', needs: ['constants', 'mixins'] },
  { file: 'src/components/public/client-flow/wait-ticket.component.scss', needs: ['constants', 'mixins'] },
  { file: 'src/components/admin/capacity-dashboard/capacity-heatmap.component.scss', needs: ['constants', 'mixins'] },
  { file: 'src/components/admin/code-validation.component.scss', needs: ['constants', 'mixins'] },
  { file: 'src/components/shared/wait-ticket.component.scss', needs: ['constants'] },
  { file: 'src/components/shared/chatbot.component.scss', needs: ['constants', 'mixins'] },
  { file: 'src/components/admin/capacity-dashboard/bottleneck-analyzer.component.scss', needs: ['constants', 'mixins'] }
];

function getRelativeImportPath(fromFile, module) {
  const fromDir = path.dirname(fromFile);
  const toFile = `src/styles/_${module}.scss`;
  const toDir = path.dirname(toFile);

  let relativePath = path.relative(fromDir, toDir);
  relativePath = relativePath.replace(/\\/g, '/');

  if (!relativePath) {
    return `./${module}`;
  }

  if (!relativePath.startsWith('.')) {
    relativePath = './' + relativePath;
  }

  return `${relativePath}/${module}`;
}

function fixImportsInFile(filePath, neededModules) {
  const fullPath = path.resolve(filePath);

  if (!fs.existsSync(fullPath)) {
    console.log(`⚠ ${filePath} - No encontrado`);
    return false;
  }

  try {
    let content = fs.readFileSync(fullPath, 'utf8');
    let lines = content.split('\n');
    let modified = false;

    // Paso 1: Eliminar imports duplicados o incorrectos
    const newLines = [];
    const seenImports = new Set();

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Si es un @use de constants o mixins
      if (line.startsWith('@use') && (line.includes('constants') || line.includes('mixins'))) {
        // Extraer el módulo (constants o mixins)
        const match = line.match(/(constants|mixins)/);
        if (match) {
          const module = match[1];

          // Si ya vimos este módulo, skip
          if (seenImports.has(module)) {
            modified = true;
            continue;
          }

          seenImports.add(module);
        }
      }

      newLines.push(lines[i]);
    }

    // Paso 2: Agregar imports faltantes
    const importsToAdd = [];

    for (const module of neededModules) {
      if (!seenImports.has(module)) {
        const importPath = getRelativeImportPath(filePath, module);
        importsToAdd.push(`@use '${importPath}' as ${module};`);
        modified = true;
      }
    }

    if (importsToAdd.length > 0) {
      // Encontrar dónde insertar (después del último @use o al inicio)
      let insertIndex = 0;

      for (let i = 0; i < newLines.length; i++) {
        if (newLines[i].trim().startsWith('@use')) {
          insertIndex = i + 1;
        }
      }

      // Insertar los nuevos imports
      newLines.splice(insertIndex, 0, ...importsToAdd);

      // Agregar línea en blanco si no hay
      if (insertIndex + importsToAdd.length < newLines.length &&
          newLines[insertIndex + importsToAdd.length].trim() !== '') {
        newLines.splice(insertIndex + importsToAdd.length, 0, '');
      }
    }

    if (modified) {
      const newContent = newLines.join('\n');
      fs.writeFileSync(fullPath, newContent, 'utf8');
      console.log(`✓ ${filePath}`);
      return true;
    } else {
      console.log(`- ${filePath} (sin cambios)`);
      return false;
    }

  } catch (error) {
    console.error(`✗ ${filePath} - Error: ${error.message}`);
    return false;
  }
}

// Ejecutar
console.log('=== Paso 1: Actualizando archivos base ===\n');
updateConstantsFile();
updateMixinsFile();

console.log('=== Paso 2: Corrigiendo imports en componentes ===\n');

let fixed = 0;
let skipped = 0;

allFiles.forEach(({ file, needs }) => {
  if (fixImportsInFile(file, needs)) {
    fixed++;
  } else {
    skipped++;
  }
});

console.log('\n=== Resumen ===');
console.log(`✓ Archivos modificados: ${fixed}`);
console.log(`- Archivos sin cambios: ${skipped}`);
console.log('\n¡Listo! Ejecuta: npm run dev');