import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Lista de archivos que necesitan corrección final
const filesToFix = [
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

function fixFile(filePath) {
  const fullPath = path.resolve(filePath);

  if (!fs.existsSync(fullPath)) {
    console.log(`⚠ ${filePath} - No encontrado`);
    return false;
  }

  try {
    let content = fs.readFileSync(fullPath, 'utf8');
    let modified = false;

    // Paso 1: Eliminar imports duplicados de mixins
    const lines = content.split('\n');
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

    // Paso 2: Agregar namespace 'mixins.' a mixins sin namespace que no lo tienen
    content = newLines.join('\n');

    // Solo agregar namespace si no hay un import de mixins sin namespace
    const hasMixinsImport = content.includes("@use 'mixins'") || content.includes("@use 'mixins';");
    const hasMixinsAsMixins = content.includes("as mixins");

    if (!hasMixinsImport && hasMixinsAsMixins) {
      // Agregar namespace a mixins sin namespace
      const mixinReplacements = [
        { pattern: /@include (flex-start|flex-between|flex-center|flex-column|flex-column-center)/g, replace: '@include mixins.$1' },
        { pattern: /@include (card-base|card-header|card-body|card-footer)/g, replace: '@include mixins.$1' },
        { pattern: /@include (border-radius)/g, replace: '@include mixins.$1' },
        { pattern: /@include (respond-to)/g, replace: '@include mixins.$1' },
        { pattern: /@include (grid-cols)/g, replace: '@include mixins.$1' },
        { pattern: /@include (transition)/g, replace: '@include mixins.$1' }
      ];

      for (const { pattern, replace } of mixinReplacements) {
        if (pattern.test(content)) {
          content = content.replace(pattern, replace);
          modified = true;
        }
      }
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
console.log('=== Corrección final de imports duplicados ===\n');

let fixed = 0;
let skipped = 0;

filesToFix.forEach(file => {
  if (fixFile(file)) {
    fixed++;
  } else {
    skipped++;
  }
});

console.log('\n=== Resumen ===');
console.log(`✓ Archivos modificados: ${fixed}`);
console.log(`- Archivos sin cambios: ${skipped}`);
console.log('\n¡Listo! Ejecuta: npm run dev');