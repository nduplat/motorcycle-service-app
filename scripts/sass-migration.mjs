const fs = require('fs');
const path = require('path');

// Archivos que necesitan el import (según los errores)
const filesToFix = [
  'src/styles/utilities/_animations.scss',
  'src/components/admin/admin-dashboard.component.scss',
  'src/components/public/client-flow/motorcycle-selection.component.scss',
  'src/components/admin/schedules/time-blocks-manager.component.scss',
  'src/components/public/client-flow/client-flow-container.component.scss',
  'src/components/public/queue-status/queue-status.component.scss',
  'src/components/admin/schedules/employee-schedule-manager.component.scss',
  'src/components/shared/motorcycle-registration.component.scss',
  'src/components/admin/schedules/schedule-calendar.component.scss',
  'src/components/shared/queue-join.component.scss',
  'src/components/shared/service-selection.component.scss',
  'src/components/admin/capacity-dashboard/capacity-dashboard.component.scss',
  'src/components/employee/queue-management.component.scss',
  'src/components/admin/admin-layout.component.scss',
  'src/components/public/client-flow/wait-ticket.component.scss',
  'src/components/admin/capacity-dashboard/capacity-heatmap.component.scss',
  'src/components/admin/code-validation.component.scss',
  'src/components/shared/wait-ticket.component.scss',
  'src/components/shared/chatbot.component.scss',
  'src/components/admin/capacity-dashboard/bottleneck-analyzer.component.scss'
];

// Función para calcular la ruta relativa correcta
function getRelativePath(fromFile, toFile) {
  const fromDir = path.dirname(fromFile);
  let relativePath = path.relative(fromDir, toFile);
  
  // Convertir barras invertidas a barras normales (Windows)
  relativePath = relativePath.replace(/\\/g, '/');
  
  // Remover la extensión .scss
  relativePath = relativePath.replace(/\.scss$/, '');
  
  // Asegurarse de que empiece con ./
  if (!relativePath.startsWith('.')) {
    relativePath = './' + relativePath;
  }
  
  return relativePath;
}

// Función para agregar el import si no existe
function addImportIfMissing(filePath) {
  try {
    // Leer el contenido del archivo
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Verificar si ya tiene el import
    if (content.includes('@use') && content.includes('constants')) {
      console.log(`✓ ${filePath} - Ya tiene el import`);
      return;
    }
    
    // Calcular la ruta relativa
    const constantsPath = getRelativePath(filePath, 'src/styles/constants');
    const importStatement = `@use '${constantsPath}' as constants;\n\n`;
    
    // Agregar el import al inicio del archivo
    content = importStatement + content;
    
    // Escribir el archivo
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✓ ${filePath} - Import agregado`);
    
  } catch (error) {
    console.error(`✗ ${filePath} - Error: ${error.message}`);
  }
}

// Crear el archivo de constantes si no existe
function createConstantsFile() {
  const constantsPath = 'src/styles/_constants.scss';
  
  if (fs.existsSync(constantsPath)) {
    console.log(`✓ ${constantsPath} ya existe\n`);
    return;
  }
  
  const constantsContent = `// Spacing
$spacing-xs: 0.25rem;
$spacing-sm: 0.5rem;
$spacing-md: 1rem;
$spacing-lg: 1.5rem;
$spacing-xl: 2rem;
$spacing-2xl: 3rem;
$spacing-3xl: 4rem;

// Border radius
$border-radius-sm: 0.25rem;
$border-radius-md: 0.5rem;
$border-radius-lg: 1rem;
$border-radius-xl: 1.5rem;

// Border width
$border-width-thin: 1px;
$border-width-medium: 2px;
$border-width-thick: 3px;

// Transitions
$transition-fast: 0.15s;
$transition-normal: 0.3s;
$transition-slow: 0.5s;
`;

  // Crear directorio si no existe
  const dir = path.dirname(constantsPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  fs.writeFileSync(constantsPath, constantsContent, 'utf8');
  console.log(`✓ ${constantsPath} creado\n`);
}

// Crear archivo de mixins si no existe (para fix-between y respond-to)
function createMixinsFile() {
  const mixinsPath = 'src/styles/_mixins.scss';
  
  if (fs.existsSync(mixinsPath)) {
    console.log(`✓ ${mixinsPath} ya existe\n`);
    return;
  }
  
  const mixinsContent = `// Flexbox mixins
@mixin flex-center {
  display: flex;
  justify-content: center;
  align-items: center;
}

@mixin flex-between {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

@mixin flex-column {
  display: flex;
  flex-direction: column;
}

// Responsive breakpoints
$breakpoints: (
  xs: 0,
  sm: 576px,
  md: 768px,
  lg: 992px,
  xl: 1200px,
  xxl: 1400px
);

@mixin respond-to($breakpoint) {
  @if map-has-key($breakpoints, $breakpoint) {
    @media (min-width: map-get($breakpoints, $breakpoint)) {
      @content;
    }
  } @else {
    @warn "Breakpoint '#{$breakpoint}' no está definido";
  }
}
`;

  const dir = path.dirname(mixinsPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  fs.writeFileSync(mixinsPath, mixinsContent, 'utf8');
  console.log(`✓ ${mixinsPath} creado\n`);
}

// Ejecutar el script
console.log('=== Iniciando corrección de imports SCSS ===\n');

createConstantsFile();
createMixinsFile();

console.log('=== Agregando imports a archivos ===\n');
filesToFix.forEach(addImportIfMissing);

console.log('\n=== Proceso completado ===');
console.log('\nAhora ejecuta: npm run dev');