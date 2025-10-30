#!/usr/bin/env node

/**
 * Script de migración batch SCSS → Tailwind
 * Genera reportes y tracking para múltiples componentes
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Mapeo extendido SCSS → Tailwind
const conversions = {
  // Layout & Flex
  'display: flex': 'flex',
  'display: grid': 'grid',
  'display: block': 'block',
  'display: inline-block': 'inline-block',
  'display: none': 'hidden',
  'flex-direction: column': 'flex-col',
  'flex-direction: row': 'flex-row',
  'justify-content: center': 'justify-center',
  'justify-content: space-between': 'justify-between',
  'justify-content: space-around': 'justify-around',
  'justify-content: flex-start': 'justify-start',
  'justify-content: flex-end': 'justify-end',
  'align-items: center': 'items-center',
  'align-items: flex-start': 'items-start',
  'align-items: flex-end': 'items-end',
  'align-items: stretch': 'items-stretch',
  'flex-wrap: wrap': 'flex-wrap',
  'gap: 0.25rem': 'gap-1',
  'gap: 0.5rem': 'gap-2',
  'gap: 0.75rem': 'gap-3',
  'gap: 1rem': 'gap-4',
  'gap: 1.5rem': 'gap-6',
  'gap: 2rem': 'gap-8',
  'gap: 3rem': 'gap-12',
  
  // Spacing
  'padding: 0.25rem': 'p-1',
  'padding: 0.5rem': 'p-2',
  'padding: 0.75rem': 'p-3',
  'padding: 1rem': 'p-4',
  'padding: 1.5rem': 'p-6',
  'padding: 2rem': 'p-8',
  'padding: 3rem': 'p-12',
  'margin: 0': 'm-0',
  'margin: 0.5rem': 'm-2',
  'margin: 1rem': 'm-4',
  'margin: 2rem': 'm-8',
  'margin: auto': 'm-auto',
  'margin-top: 1rem': 'mt-4',
  'margin-bottom: 1rem': 'mb-4',
  'margin-left: 1rem': 'ml-4',
  'margin-right: 1rem': 'mr-4',
  
  // Sizing
  'width: 100%': 'w-full',
  'width: 50%': 'w-1/2',
  'width: auto': 'w-auto',
  'height: 100%': 'h-full',
  'height: 100vh': 'h-screen',
  'min-height: 100vh': 'min-h-screen',
  'max-width: 640px': 'max-w-xl',
  'max-width: 768px': 'max-w-2xl',
  'max-width: 1024px': 'max-w-5xl',
  'max-width: 1200px': 'max-w-7xl',
  
  // Typography
  'font-size: 0.75rem': 'text-xs',
  'font-size: 0.875rem': 'text-sm',
  'font-size: 1rem': 'text-base',
  'font-size: 1.125rem': 'text-lg',
  'font-size: 1.25rem': 'text-xl',
  'font-size: 1.5rem': 'text-2xl',
  'font-size: 2rem': 'text-3xl',
  'font-size: 3rem': 'text-5xl',
  'font-weight: 400': 'font-normal',
  'font-weight: 500': 'font-medium',
  'font-weight: 600': 'font-semibold',
  'font-weight: 700': 'font-bold',
  'text-align: center': 'text-center',
  'text-align: left': 'text-left',
  'text-align: right': 'text-right',
  'line-height: 1': 'leading-none',
  'line-height: 1.5': 'leading-normal',
  'line-height: 2': 'leading-loose',
  
  // Colors
  'color: white': 'text-white',
  'color: black': 'text-black',
  'background-color: white': 'bg-white',
  'background-color: transparent': 'bg-transparent',
  
  // Borders
  'border: 1px solid': 'border',
  'border: 2px solid': 'border-2',
  'border-radius: 0.25rem': 'rounded',
  'border-radius: 0.375rem': 'rounded-md',
  'border-radius: 0.5rem': 'rounded-lg',
  'border-radius: 1rem': 'rounded-2xl',
  'border-radius: 9999px': 'rounded-full',
  
  // Effects
  'box-shadow: 0 1px 2px': 'shadow-sm',
  'box-shadow: 0 1px 3px': 'shadow',
  'box-shadow: 0 4px 6px': 'shadow-md',
  'box-shadow: 0 10px 15px': 'shadow-lg',
  'box-shadow: 0 20px 25px': 'shadow-xl',
  'box-shadow: 0 25px 50px': 'shadow-2xl',
  'opacity: 0': 'opacity-0',
  'opacity: 0.5': 'opacity-50',
  'opacity: 0.75': 'opacity-75',
  'opacity: 1': 'opacity-100',
  
  // Position
  'position: relative': 'relative',
  'position: absolute': 'absolute',
  'position: fixed': 'fixed',
  'position: sticky': 'sticky',
  
  // Interactive
  'cursor: pointer': 'cursor-pointer',
  'cursor: not-allowed': 'cursor-not-allowed',
  'pointer-events: none': 'pointer-events-none',
  'user-select: none': 'select-none',
  
  // Transitions
  'transition: all 0.2s': 'transition-all duration-200',
  'transition: all 0.3s': 'transition-all duration-300',
  'transition: all 0.5s': 'transition-all duration-500',
  
  // Overflow
  'overflow: hidden': 'overflow-hidden',
  'overflow: auto': 'overflow-auto',
  'overflow: scroll': 'overflow-scroll',
  'overflow-x: auto': 'overflow-x-auto',
  'overflow-y: auto': 'overflow-y-auto',
};

// Prioridad de migración (ordenados por dificultad)
const migrationOrder = {
  easy: [
    'phone-verification.component',
    'motorcycle-registration.component',
    'service-selection.component',
    'wait-ticket.component',
    'code-validation.component',
  ],
  medium: [
    'chatbot.component',
    'queue-join.component',
    'motorcycle-selection.component',
    'queue-status.component',
  ],
  hard: [
    'admin-dashboard.component',
    'admin-layout.component',
    'schedule-calendar.component',
    'time-blocks-manager.component',
    'capacity-dashboard.component',
    'capacity-heatmap.component',
    'queue-management.component',
    'employee-schedule-manager.component',
  ]
};

function findAllSCSSComponents(baseDir = 'src/components') {
  const components = [];
  
  function traverse(dir) {
    if (!fs.existsSync(dir)) return;
    
    const items = fs.readdirSync(dir);
    items.forEach(item => {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        traverse(fullPath);
      } else if (item.endsWith('.component.scss')) {
        const baseName = item.replace('.component.scss', '');
        const tsPath = fullPath.replace('.scss', '.ts');
        const htmlPath = fullPath.replace('.scss', '.html');
        
        components.push({
          name: baseName,
          scssPath: fullPath,
          tsPath: tsPath,
          htmlPath: htmlPath,
          dir: path.dirname(fullPath),
        });
      }
    });
  }
  
  traverse(baseDir);
  return components;
}

function analyzeComponent(component) {
  if (!fs.existsSync(component.scssPath)) {
    return null;
  }
  
  const content = fs.readFileSync(component.scssPath, 'utf-8');
  const matches = [];
  
  for (const [scss, tailwind] of Object.entries(conversions)) {
    const regex = new RegExp(scss.replace(/[.*+?^${}()|[\\]/g, '\\$&'), 'gi');
    const found = content.match(regex);
    if (found) {
      matches.push({ scss, tailwind, count: found.length });
    }
  }
  
  // Detectar patrones especiales
  const hasHover = /&:hover/.test(content);
  const hasFocus = /&:focus/.test(content);
  const hasMediaQuery = /@media/.test(content);
  const hasVariables = /\$\w+/.test(content);
  const hasColorFunctions = /color\.(change|adjust)/.test(content);
  const hasMixins = /@include/.test(content);
  
  return {
    ...component,
    matches,
    totalConversions: matches.reduce((sum, m) => sum + m.count, 0),
    complexity: {
      hasHover,
      hasFocus,
      hasMediaQuery,
      hasVariables,
      hasColorFunctions,
      hasMixins,
    },
    lines: content.split('\n').length,
  };
}

function getDifficulty(analysis) {
  if (!analysis) return 'unknown';
  
  const { complexity, lines } = analysis;
  const complexCount = Object.values(complexity).filter(Boolean).length;
  
  if (lines < 50 && complexCount <= 2) return 'easy';
  if (lines < 150 && complexCount <= 4) return 'medium';
  return 'hard';
}

function generateBatchReport(components) {
  console.log('\n' + '='.repeat(80));
  console.log('📊 REPORTE DE MIGRACIÓN BATCH - BLUE DRAGON MOTORS');
  console.log('='.repeat(80) + '\n');
  
  const analyses = components.map(analyzeComponent).filter(Boolean);
  const byDifficulty = {
    easy: analyses.filter(a => getDifficulty(a) === 'easy'),
    medium: analyses.filter(a => getDifficulty(a) === 'medium'),
    hard: analyses.filter(a => getDifficulty(a) === 'hard'),
  };
  
  // Estadísticas generales
  console.log('📈 ESTADÍSTICAS GENERALES\n');
  console.log(`   Total de componentes con SCSS: ${analyses.length}`);
  console.log(`   Total de líneas SCSS: ${analyses.reduce((sum, a) => sum + a.lines, 0)}`);
  console.log(`   Total de conversiones detectadas: ${analyses.reduce((sum, a) => sum + a.totalConversions, 0)}\n`);
  
  // Por dificultad
  console.log('🎯 COMPONENTES POR DIFICULTAD\n');
  
  ['easy', 'medium', 'hard'].forEach(difficulty => {
    const emoji = { easy: '⭐', medium: '⭐⭐', hard: '⭐⭐⭐' }[difficulty];
    const label = { easy: 'FÁCIL', medium: 'MEDIO', hard: 'DIFÍCIL' }[difficulty];
    const comps = byDifficulty[difficulty];
    
    console.log(`${emoji} ${label} (${comps.length} componentes)`);
    console.log('-'.repeat(80));
    
    comps.forEach((comp, i) => {
      console.log(`\n${i + 1}. ${comp.name}`);
      console.log(`   📁 ${path.relative(process.cwd(), comp.scssPath)}`);
      console.log(`   📏 ${comp.lines} líneas | 🔄 ${comp.totalConversions} conversiones`);
      
      const flags = [];
      if (comp.complexity.hasHover) flags.push('hover');
      if (comp.complexity.hasFocus) flags.push('focus');
      if (comp.complexity.hasMediaQuery) flags.push('media-query');
      if (comp.complexity.hasVariables) flags.push('variables');
      if (comp.complexity.hasColorFunctions) flags.push('color-functions');
      if (comp.complexity.hasMixins) flags.push('mixins');
      
      if (flags.length > 0) {
        console.log(`   ⚠️  Características: ${flags.join(', ')}`);
      }
    });
    console.log('\n');
  });
  
  // Orden de migración recomendado
  console.log('📋 ORDEN DE MIGRACIÓN RECOMENDADO\n');
  console.log('Sigue este orden para maximizar eficiencia:\n');
  
  let position = 1;
  ['easy', 'medium', 'hard'].forEach(difficulty => {
    const comps = byDifficulty[difficulty];
    comps.forEach(comp => {
      const emoji = { easy: '✅', medium: '🔶', hard: '🔴' }[difficulty];
      const estimate = { easy: '10-15 min', medium: '20-30 min', hard: '30-45 min' }[difficulty];
      console.log(`${position}. ${emoji} ${comp.name.padEnd(40)} ~${estimate}`);
      position++;
    });
  });
  
  // Tiempo estimado total
  const totalTime =
    byDifficulty.easy.length * 12.5 +
    byDifficulty.medium.length * 25 +
    byDifficulty.hard.length * 37.5;
  
  console.log(`\n⏱️  TIEMPO TOTAL ESTIMADO: ~${Math.ceil(totalTime / 60)} horas\n`);
  
  // Checklist para copiar
  console.log('='.repeat(80));
  console.log('📝 CHECKLIST DE MIGRACIÓN (copiar a un archivo)\n');
  console.log('```markdown');
  console.log('# Checklist de Migración Tailwind\n');
  console.log('## ✅ Completados\n- [x] phone-verification.component\n');
  console.log('## 🔄 En Progreso\n');
  console.log('##  Pendientes\n');
  
  analyses.forEach(comp => {
    if (comp.name !== 'phone-verification') {
      const difficulty = getDifficulty(comp);
      const emoji = { easy: '⭐', medium: '⭐⭐', hard: '⭐⭐⭐' }[difficulty];
      console.log(`- [ ] ${comp.name} ${emoji}`);
    }
  });
  
  console.log('```\n');
  console.log('='.repeat(80) + '\n');
}

// Main
const components = findAllSCSSComponents();
generateBatchReport(components);

console.log('💡 PRÓXIMOS PASOS:\n');
console.log('1. Copia el checklist a migration-progress.md');
console.log('2. Empieza con los componentes ⭐ FÁCIL');
console.log('3. Usa: node migrate-to-tailwind.js [component-path] para ayuda específica');
console.log('4. Marca como completado en el checklist después de cada uno');
console.log('5. Commit frecuente: git commit -m "Migrar [componente] a Tailwind"\n');
