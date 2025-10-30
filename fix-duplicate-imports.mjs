import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Lista de archivos que tienen imports duplicados
const filesWithDuplicates = [
  'src/components/shared/chatbot.component.scss',
  'src/components/home/hero/hero.component.scss',
  'src/components/employee/queue-management.component.scss',
  'src/components/public/queue-status/queue-status.component.scss',
  'src/components/shared/queue-join.component.scss',
  'src/components/admin/admin-layout.component.scss',
  'src/components/shared/service-selection.component.scss',
  'src/components/admin/code-validation.component.scss',
  'src/components/shared/motorcycle-registration.component.scss',
  'src/components/shared/wait-ticket.component.scss',
  'src/components/public/client-flow/client-flow-container.component.scss',
  'src/components/public/client-flow/motorcycle-selection.component.scss',
  'src/components/admin/schedules/employee-schedule-manager.component.scss',
  'src/components/admin/admin-dashboard.component.scss',
  'src/components/admin/schedules/schedule-calendar.component.scss',
  'src/components/admin/capacity-dashboard/capacity-dashboard.component.scss',
  'src/components/admin/capacity-dashboard/capacity-heatmap.component.scss',
  'src/components/admin/schedules/time-blocks-manager.component.scss',
  'src/components/public/client-flow/wait-ticket.component.scss'
];

function fixDuplicateImports(filePath) {
  const fullPath = path.resolve(filePath);

  if (!fs.existsSync(fullPath)) {
    console.log(`⚠ ${filePath} - No encontrado`);
    return false;
  }

  try {
    let content = fs.readFileSync(fullPath, 'utf8');
    let lines = content.split('\n');
    let modified = false;

    // Paso 1: Eliminar imports duplicados de mixins
    const newLines = [];
    const seenImports = new Set();

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Si es un @use de mixins
      if (line.includes('@use') && (line.includes('mixins') || line.includes('_mixins'))) {
        const isMixinsImport = line.includes('mixins') && !line.includes('as mixins');
        const isMixinsAsMixins = line.includes('as mixins');

        if (isMixinsImport) {
          // Si ya vimos un import de mixins, skip
          if (seenImports.has('mixins')) {
            modified = true;
            continue;
          }
          seenImports.add('mixins');
        } else if (isMixinsAsMixins) {
          // Si ya vimos un import as mixins, skip
          if (seenImports.has('mixins-as-mixins')) {
            modified = true;
            continue;
          }
          seenImports.add('mixins-as-mixins');
        }
      }

      newLines.push(lines[i]);
    }

    // Paso 2: Corregir variables duplicadas (constants.constants -> constants)
    content = newLines.join('\n');
    if (content.includes('constants.constants.')) {
      content = content.replace(/constants\.constants\./g, 'constants.');
      modified = true;
    }

    if (modified) {
      fs.writeFileSync(fullPath, content, 'utf8');
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
console.log('=== Eliminando imports duplicados ===\n');

let fixed = 0;
let skipped = 0;

filesWithDuplicates.forEach(file => {
  if (fixDuplicateImports(file)) {
    fixed++;
  } else {
    skipped++;
  }
});

console.log('\n=== Resumen ===');
console.log(`✓ Archivos modificados: ${fixed}`);
console.log(`- Archivos sin cambios: ${skipped}`);
console.log('\n¡Listo! Ejecuta: npm run dev');