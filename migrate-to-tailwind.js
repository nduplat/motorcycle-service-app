#!/usr/bin/env node

/**
 * Script de migración SCSS → Tailwind para Blue Dragon Motors
 * Uso: node migrate-to-tailwind.js [ruta-del-componente]
 */

import fs from 'fs';
import path from 'path';

// Mapeo común de estilos SCSS → Tailwind
const scssToTailwind = {
  // Layout
  'display: flex': 'flex',
  'display: grid': 'grid',
  'display: block': 'block',
  'display: none': 'hidden',
  'flex-direction: column': 'flex-col',
  'flex-direction: row': 'flex-row',
  'justify-content: center': 'justify-center',
  'justify-content: space-between': 'justify-between',
  'justify-content: flex-start': 'justify-start',
  'justify-content: flex-end': 'justify-end',
  'align-items: center': 'items-center',
  'align-items: flex-start': 'items-start',
  'align-items: flex-end': 'items-end',
  'gap: 1rem': 'gap-4',
  'gap: 0.5rem': 'gap-2',
  'gap: 2rem': 'gap-8',
  
  // Spacing
  'padding: 1rem': 'p-4',
  'padding: 0.5rem': 'p-2',
  'padding: 2rem': 'p-8',
  'margin: 1rem': 'm-4',
  'margin: 0.5rem': 'm-2',
  'margin: auto': 'm-auto',
  
  // Sizing
  'width: 100%': 'w-full',
  'height: 100%': 'h-full',
  'max-width: 1200px': 'max-w-7xl',
  'min-height: 100vh': 'min-h-screen',
  
  // Typography
  'font-size: 1.5rem': 'text-2xl',
  'font-size: 1.25rem': 'text-xl',
  'font-size: 1rem': 'text-base',
  'font-size: 0.875rem': 'text-sm',
  'font-weight: 700': 'font-bold',
  'font-weight: 600': 'font-semibold',
  'font-weight: 500': 'font-medium',
  'text-align: center': 'text-center',
  'text-align: left': 'text-left',
  'text-align: right': 'text-right',
  
  // Colors (basado en tus variables)
  'color: $primary': 'text-blue-500',
  'background-color: $primary': 'bg-blue-500',
  'color: $accent': 'text-purple-500',
  'background-color: $accent': 'bg-purple-500',
  'color: $destructive': 'text-red-500',
  'background-color: $destructive': 'bg-red-500',
  'color: white': 'text-white',
  'background-color: white': 'bg-white',
  
  // Effects
  'border-radius: 0.5rem': 'rounded-lg',
  'border-radius: 0.25rem': 'rounded',
  'border-radius: 9999px': 'rounded-full',
  'box-shadow: 0 1px 3px': 'shadow',
  'box-shadow: 0 4px 6px': 'shadow-md',
  'box-shadow: 0 10px 15px': 'shadow-lg',
  'box-shadow: 0 20px 25px': 'shadow-xl',
  'opacity: 0.5': 'opacity-50',
  'opacity: 0.75': 'opacity-75',
  
  // Interactive
  'cursor: pointer': 'cursor-pointer',
  'transition: all 0.3s': 'transition-all duration-300',
  'overflow: hidden': 'overflow-hidden',
  'overflow: auto': 'overflow-auto',
};

function analyzeSCSSFile(scssPath) {
  if (!fs.existsSync(scssPath)) {
    console.log(`❌ Archivo no encontrado: ${scssPath}`);
    return null;
  }

  const content = fs.readFileSync(scssPath, 'utf-8');
  const suggestions = [];
  
  // Analiza línea por línea
  const lines = content.split('\n');
  lines.forEach((line, index) => {
    const trimmed = line.trim();
    
    // Busca coincidencias en el mapeo
    for (const [scss, tailwind] of Object.entries(scssToTailwind)) {
      if (trimmed.includes(scss)) {
        suggestions.push({
          line: index + 1,
          original: trimmed,
          scss: scss,
          tailwind: tailwind
        });
      }
    }
  });

  return {
    path: scssPath,
    totalLines: lines.length,
    suggestions: suggestions
  };
}

function generateMigrationReport(componentPath) {
  const scssPath = componentPath.replace('.ts', '.scss');
  const htmlPath = componentPath.replace('.ts', '.html');
  
  console.log('\n🔍 ANÁLISIS DE MIGRACIÓN\n');
  console.log(`📁 Componente: ${path.basename(componentPath)}`);
  console.log(`📄 SCSS: ${path.basename(scssPath)}`);
  console.log(`📄 HTML: ${path.basename(htmlPath)}\n`);
  
  const analysis = analyzeSCSSFile(scssPath);
  
  if (!analysis) return;
  
  console.log(`📊 Estadísticas:`);
  console.log(`   - Total líneas SCSS: ${analysis.totalLines}`);
  console.log(`   - Conversiones detectadas: ${analysis.suggestions.length}\n`);
  
  if (analysis.suggestions.length === 0) {
    console.log('✅ No se encontraron conversiones automáticas.');
    console.log('💡 Este componente puede requerir migración manual.\n');
    return;
  }
  
  console.log('🎨 SUGERENCIAS DE CONVERSIÓN:\n');
  
  analysis.suggestions.forEach((sug, i) => {
    console.log(`${i + 1}. Línea ${sug.line}:`);
    console.log(`   SCSS: ${sug.scss}`);
    console.log(`   ➜ Tailwind: ${sug.tailwind}`);
    console.log(`   Original: ${sug.original}\n`);
  });
  
  console.log('📋 PRÓXIMOS PASOS:\n');
  console.log(`1. Abre ${path.basename(htmlPath)}`);
  console.log('2. Agrega las clases Tailwind sugeridas a los elementos correspondientes');
  console.log(`3. Una vez verificado, elimina ${path.basename(scssPath)}`);
  console.log('4. Remueve styleUrls del componente TypeScript\n');
  
  // Genera ejemplo de clase combinada
  const tailwindClasses = [...new Set(analysis.suggestions.map(s => s.tailwind))];
  if (tailwindClasses.length > 0) {
    console.log('💡 EJEMPLO DE CLASE COMBINADA:\n');
    console.log(`<div class="${tailwindClasses.slice(0, 10).join(' ')}">`);
    console.log('  <!-- tu contenido -->\n</div>\n');
  }
}

function listAllSCSSFiles(dir = 'src/components') {
  const files = [];
  
  function traverse(currentPath) {
    if (!fs.existsSync(currentPath)) return;
    
    const items = fs.readdirSync(currentPath);
    
    items.forEach(item => {
      const fullPath = path.join(currentPath, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        traverse(fullPath);
      } else if (item.endsWith('.component.scss')) {
        files.push(fullPath);
      }
    });
  }
  
  traverse(dir);
  return files;
}

// Main
const args = process.argv.slice(2);

if (args.length === 0) {
  console.log('🚀 MIGRADOR SCSS → TAILWIND\n');
  console.log('Componentes con SCSS encontrados:\n');
  
  const scssFiles = listAllSCSSFiles();
  
  scssFiles.forEach((file, i) => {
    console.log(`${i + 1}. ${file}`);
  });
  
  console.log(`\n📊 Total: ${scssFiles.length} archivos SCSS`);
  console.log('\n💡 Uso: node migrate-to-tailwind.js [ruta-del-componente.ts]\n');
  console.log('Ejemplo:');
  console.log('  node migrate-to-tailwind.js src/components/shared/phone-verification.component.ts\n');
} else {
  generateMigrationReport(args[0]);
}
