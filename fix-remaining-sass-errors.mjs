import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Lista de archivos que necesitan correcciones adicionales
const filesToFix = [
  'src/components/shared/chatbot.component.scss',
  'src/components/home/hero/hero.component.scss',
  'src/components/employee/queue-management.component.scss',
  'src/components/public/queue-status/queue-status.component.scss',
  'src/components/shared/queue-join.component.scss',
  'src/components/admin/admin-layout.component.scss',
  'src/components/admin/capacity-dashboard/bottleneck-analyzer.component.scss',
  'src/components/shared/service-selection.component.scss',
  'src/components/admin/code-validation.component.scss',
  'src/components/admin/schedules/employee-schedule-manager.component.scss',
  'src/components/admin/capacity-dashboard/capacity-dashboard.component.scss',
  'src/components/admin/schedules/time-blocks-manager.component.scss',
  'src/components/admin/admin-dashboard.component.scss',
  'src/components/admin/capacity-dashboard/capacity-heatmap.component.scss',
  'src/components/public/client-flow/motorcycle-selection.component.scss',
  'src/components/public/client-flow/client-flow-container.component.scss',
  'src/components/admin/schedules/schedule-calendar.component.scss',
  'src/components/public/client-flow/wait-ticket.component.scss',
  'src/components/shared/motorcycle-registration.component.scss',
  'src/components/shared/wait-ticket.component.scss'
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

    // 1. Reemplazar $muted-foreground con constants.$muted-foreground
    if (content.includes('$muted-foreground')) {
      content = content.replace(/\$muted-foreground/g, 'constants.$muted-foreground');
      modified = true;
    }

    // 2. Agregar @use 'mixins' si no existe y hay mixins sin namespace
    const hasMixinsImport = content.includes("@use 'mixins'") || content.includes("@use '_mixins'");
    const hasUnnamespacedMixins = /\@include (flex-|card-base|border-radius|respond-to|grid-cols)/.test(content);

    if (!hasMixinsImport && hasUnnamespacedMixins) {
      // Encontrar dónde insertar el import
      const lines = content.split('\n');
      let insertIndex = 0;

      for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim().startsWith('@use')) {
          insertIndex = i + 1;
        }
      }

      // Calcular la ruta relativa
      const fromDir = path.dirname(filePath);
      const mixinsPath = path.relative(fromDir, 'src/styles/_mixins.scss');
      const relativePath = mixinsPath.replace(/\\/g, '/');

      lines.splice(insertIndex, 0, `@use '${relativePath}' as mixins;`);
      content = lines.join('\n');
      modified = true;
    }

    // 3. Agregar namespace 'mixins.' a mixins sin namespace
    const mixinReplacements = [
      { pattern: /@include (flex-start|flex-between|flex-center|flex-column|flex-column-center)/g, replace: '@include mixins.$1' },
      { pattern: /@include (card-base|card-header|card-body|card-footer)/g, replace: '@include mixins.$1' },
      { pattern: /@include (border-radius)/g, replace: '@include mixins.$1' },
      { pattern: /@include (respond-to)/g, replace: '@include mixins.$1' },
      { pattern: /@include (grid-cols)/g, replace: '@include mixins.$1' }
    ];

    for (const { pattern, replace } of mixinReplacements) {
      if (pattern.test(content)) {
        content = content.replace(pattern, replace);
        modified = true;
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
console.log('=== Corrigiendo errores restantes de Sass ===\n');

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