import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Archivos que necesitan imports según los errores
const filesWithErrors = [
  { file: 'src/styles/utilities/_animations.scss', needs: ['constants'] },
  { file: 'src/components/admin/admin-dashboard.component.scss', needs: ['constants'] },
  { file: 'src/components/public/client-flow/motorcycle-selection.component.scss', needs: ['constants'] },
  { file: 'src/components/admin/schedules/time-blocks-manager.component.scss', needs: ['constants'] },
  { file: 'src/components/public/client-flow/client-flow-container.component.scss', needs: ['constants'] },
  { file: 'src/components/public/queue-status/queue-status.component.scss', needs: ['constants'] },
  { file: 'src/components/admin/schedules/employee-schedule-manager.component.scss', needs: ['constants'] },
  { file: 'src/components/shared/motorcycle-registration.component.scss', needs: ['constants'] },
  { file: 'src/components/admin/schedules/schedule-calendar.component.scss', needs: ['constants'] },
  { file: 'src/components/shared/queue-join.component.scss', needs: ['constants'] },
  { file: 'src/components/shared/service-selection.component.scss', needs: ['constants'] },
  { file: 'src/components/admin/capacity-dashboard/capacity-dashboard.component.scss', needs: ['constants'] },
  { file: 'src/components/employee/queue-management.component.scss', needs: ['constants'] },
  { file: 'src/components/admin/admin-layout.component.scss', needs: ['constants'] },
  { file: 'src/components/public/client-flow/wait-ticket.component.scss', needs: ['constants'] },
  { file: 'src/components/admin/capacity-dashboard/capacity-heatmap.component.scss', needs: ['constants'] },
  { file: 'src/components/admin/code-validation.component.scss', needs: ['constants'] },
  { file: 'src/components/shared/wait-ticket.component.scss', needs: ['constants'] },
  { file: 'src/components/shared/chatbot.component.scss', needs: ['constants', 'mixins'] },
  { file: 'src/components/admin/capacity-dashboard/bottleneck-analyzer.component.scss', needs: ['constants', 'mixins'] }
];

// Función para calcular la ruta relativa correcta
function getRelativeImportPath(fromFile, toFile) {
  const fromDir = path.dirname(fromFile);
  const toDir = path.dirname(toFile);
  const toBase = path.basename(toFile, '.scss');

  let relativePath = path.relative(fromDir, toDir);

  // Convertir barras invertidas a barras normales (Windows)
  relativePath = relativePath.replace(/\\/g, '/');

  // Si está vacío, es el mismo directorio
  if (!relativePath) {
    return `./${toBase}`;
  }

  // Asegurarse de que empiece con ./ o ../
  if (!relativePath.startsWith('.')) {
    relativePath = './' + relativePath;
  }

  return `${relativePath}/${toBase}`;
}

// Función para verificar si un import ya existe
function hasImport(content, moduleName) {
  const patterns = [
    new RegExp(`@use\\s+['"'][^'"]*\\/${moduleName}['"]\\s+as\\s+${moduleName}`, 'i'),
    new RegExp(`@use\\s+['"'][^'"]*${moduleName}['"]\\s+as\\s+${moduleName}`, 'i'),
    new RegExp(`@import\\s+['"'][^'"]*${moduleName}`, 'i')
  ];

  return patterns.some(pattern => pattern.test(content));
}

// Función para agregar imports faltantes
function addMissingImports(filePath, neededModules) {
  const fullPath = path.resolve(filePath);

  if (!fs.existsSync(fullPath)) {
    console.log(`⚠ ${filePath} - Archivo no encontrado`);
    return;
  }

  try {
    let content = fs.readFileSync(fullPath, 'utf8');
    let importsToAdd = [];

    // Verificar qué imports faltan
    for (const module of neededModules) {
      if (!hasImport(content, module)) {
        const modulePath = `src/styles/_${module}.scss`;
        const importPath = getRelativeImportPath(filePath, modulePath);
        importsToAdd.push(`@use '${importPath}' as ${module};`);
      }
    }

    if (importsToAdd.length === 0) {
      console.log(`✓ ${filePath} - Ya tiene todos los imports necesarios`);
      return;
    }

    // Encontrar dónde insertar los imports
    // Buscar después de los @use existentes o al inicio
    const lines = content.split('\n');
    let insertIndex = 0;
    let lastUseIndex = -1;

    // Encontrar el último @use
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim().startsWith('@use')) {
        lastUseIndex = i;
      } else if (lines[i].trim() && !lines[i].trim().startsWith('//') && lastUseIndex >= 0) {
        break;
      }
    }

    if (lastUseIndex >= 0) {
      insertIndex = lastUseIndex + 1;
      // Si hay línea en blanco después, mantenerla
      if (lines[insertIndex] && lines[insertIndex].trim() === '') {
        insertIndex++;
      }
    }

    // Insertar los imports
    lines.splice(insertIndex, 0, ...importsToAdd);

    // Si no había línea en blanco después de los imports, agregar una
    if (insertIndex + importsToAdd.length < lines.length &&
        lines[insertIndex + importsToAdd.length].trim() !== '') {
      lines.splice(insertIndex + importsToAdd.length, 0, '');
    }

    content = lines.join('\n');

    // Guardar el archivo
    fs.writeFileSync(fullPath, content, 'utf8');
    console.log(`✓ ${filePath} - Agregados: ${importsToAdd.join(', ')}`);

  } catch (error) {
    console.error(`✗ ${filePath} - Error: ${error.message}`);
  }
}

// Ejecutar el script
console.log('=== Agregando imports faltantes ===\n');

let fixed = 0;
let skipped = 0;
let errors = 0;

filesWithErrors.forEach(({ file, needs }) => {
  try {
    const before = fs.readFileSync(path.resolve(file), 'utf8');
    addMissingImports(file, needs);
    const after = fs.readFileSync(path.resolve(file), 'utf8');

    if (before !== after) {
      fixed++;
    } else {
      skipped++;
    }
  } catch (error) {
    errors++;
  }
});

console.log('\n=== Resumen ===');
console.log(`✓ Archivos modificados: ${fixed}`);
console.log(`- Archivos sin cambios: ${skipped}`);
console.log(`✗ Errores: ${errors}`);
console.log('\nAhora ejecuta: npm run dev');