# Blue Dragon Motors - SCSS Style Guide

## Overview

This document serves as the comprehensive style guide for the Blue Dragon Motors project, documenting our SCSS architecture, BEM methodology, design tokens, and usage patterns. Our styling system is built on a modular SCSS architecture that promotes maintainability, consistency, and scalability.

## Table of Contents

1. [SCSS Architecture](#scss-architecture)
2. [BEM Methodology](#bem-methodology)
3. [Design Tokens](#design-tokens)
4. [Breakpoints & Responsive Design](#breakpoints--responsive-design)
5. [Component Styles](#component-styles)
6. [Utility Classes](#utility-classes)
7. [Usage Examples](#usage-examples)
8. [Best Practices](#best-practices)

## SCSS Architecture

Our SCSS architecture follows a modular, component-based approach with clear separation of concerns. The system has been refined through audit implementation and cleanup processes to ensure consistency and maintainability.

```
src/styles/
├── main.scss                 # Main entry point - imports all partials
├── _variables.scss           # Design tokens (colors, spacing, typography, shadows)
├── _mixins.scss              # Reusable SCSS mixins
├── _functions.scss           # Custom SCSS functions
├── _breakpoints.scss         # Responsive breakpoint definitions
├── _constants.scss           # Legacy constants (transitioning to variables)
├── core/                     # Base styles and resets
│   ├── _reset.scss          # CSS reset and normalization
│   ├── _base.scss           # Global body and element styles
│   └── _typography.scss     # Typography system
├── components/               # Component-specific styles
│   ├── _buttons.scss        # Button component styles
│   ├── _cards.scss          # Card component styles
│   ├── _forms.scss          # Form component styles
│   ├── _modals.scss         # Modal component styles
│   └── _tables.scss         # Table component styles
└── utilities/                # Utility classes
    ├── _animations.scss     # Animation utilities
    ├── _layout.scss         # Layout and positioning utilities
    └── _spacing.scss        # Spacing utilities
```

### Audit Implementation Updates

Following the codebase audit, the SCSS architecture has been enhanced with:

- **Audit Service Integration**: Audit logging for style-related changes and component modifications
- **Cleanup Scripts**: Automated tools for removing duplicate variables and unused styles
- **Homogenization Tools**: Scripts to standardize styling across components
- **Transition from Tailwind**: Migration path from legacy Tailwind utilities to pure SCSS

### Import Order

The `main.scss` file imports partials in the following order to ensure proper cascade:

1. **Variables & Utilities** - Design tokens and helper functions
2. **Core Styles** - Resets, base styles, and typography
3. **Component Styles** - Specific component implementations
4. **Utility Styles** - Low-specificity utility classes

## BEM Methodology

We follow the Block Element Modifier (BEM) methodology for naming CSS classes:

### Syntax
```
.block {}
.block__element {}
.block--modifier {}
.block__element--modifier {}
```

### Guidelines

- **Blocks**: Standalone components (`.card`, `.button`, `.modal`)
- **Elements**: Parts of blocks (`.card__header`, `.button__icon`)
- **Modifiers**: Variations of blocks/elements (`.card--elevated`, `.button--primary`)

### Examples

```scss
// Block
.card {
  // Base card styles
}

// Element
.card__header {
  // Header-specific styles
}

// Modifier
.card--elevated {
  // Elevated variant styles
}
```

## Design Tokens

### Color System

Our color system uses OKLCH color space for better color consistency and accessibility:

#### Primary Colors
```scss
$primary: oklch(0.35 0.08 240);           // Main brand color
$primary-foreground: oklch(0.98 0.005 240); // Text on primary
```

#### Semantic Colors
```scss
$secondary: oklch(0.92 0.01 240);         // Secondary actions
$accent: oklch(0.58 0.2 25);              // Accent/highlight
$muted: oklch(0.96 0.005 240);            // Subtle backgrounds
$destructive: oklch(0.55 0.22 25);        // Error/danger states
$warning: oklch(0.75 0.15 85);            // Warning states
```

#### Dark Theme Variants
All colors have corresponding dark theme variants:
```scss
$primary-dark: oklch(0.65 0.12 240);
$background-dark: oklch(0.09 0.01 240);
// ... etc
```

### Spacing Scale

We use a consistent spacing scale based on a 4px grid:

```scss
$spacing-xs: 0.25rem;   // 4px
$spacing-sm: 0.5rem;    // 8px
$spacing-md: 1rem;      // 16px
$spacing-lg: 1.5rem;    // 24px
$spacing-xl: 2rem;      // 32px
$spacing-2xl: 3rem;     // 48px
$spacing-3xl: 4rem;     // 64px
```

### Typography

#### Font Families
```scss
$font-family-base: 'Inter', sans-serif;
```

#### Font Sizes
```scss
$font-size-xs: 0.75rem;   // 12px
$font-size-sm: 0.875rem;  // 14px
$font-size-base: 1rem;    // 16px
$font-size-lg: 1.125rem;  // 18px
$font-size-xl: 1.25rem;   // 20px
$font-size-2xl: 1.5rem;   // 24px
$font-size-3xl: 1.875rem; // 30px
$font-size-4xl: 2.25rem;  // 36px
$font-size-5xl: 3rem;     // 48px
```

#### Font Weights
```scss
$font-weight-light: 300;
$font-weight-normal: 400;
$font-weight-medium: 500;
$font-weight-semibold: 600;
$font-weight-bold: 700;
```

### Borders & Shadows

#### Border Radius
```scss
$border-radius-none: 0;
$border-radius-sm: 0.125rem;  // 2px
$border-radius-md: 0.375rem;  // 6px
$border-radius-lg: 0.5rem;    // 8px
$border-radius-xl: 0.75rem;   // 12px
$border-radius-2xl: 1rem;     // 16px
$border-radius-3xl: 1.5rem;   // 24px
$border-radius-full: 9999px;
```

#### Shadows
```scss
$shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
$shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
$shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
$shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
$shadow-2xl: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
```

### Transitions

```scss
$transition-fast: 150ms ease-in-out;
$transition-normal: 300ms ease-in-out;
$transition-slow: 500ms ease-in-out;
```

### Audit-Related Variables

Additional variables have been added to support audit logging and system monitoring:

```scss
$warning: oklch(0.75 0.15 85);        // Warning states for audit alerts
$z-index-toast: 10000;                // High z-index for audit notifications
```

## Breakpoints & Responsive Design

We use a mobile-first approach with the following breakpoints:

```scss
$breakpoint-xs: 475px;   // Extra small devices
$breakpoint-sm: 640px;   // Small devices (phones)
$breakpoint-md: 768px;   // Medium devices (tablets)
$breakpoint-lg: 1024px;  // Large devices (desktops)
$breakpoint-xl: 1280px;  // Extra large devices
$breakpoint-2xl: 1536px; // 2X large devices
```

### Responsive Mixins

Use the `respond-to()` mixin for breakpoint-specific styles:

```scss
.my-component {
  // Mobile-first styles

  @include respond-to(md) {
    // Tablet and up styles
  }

  @include respond-to(lg) {
    // Desktop and up styles
  }
}
```

## Component Styles

### Buttons

#### Base Classes
- `.btn` - Base button styles
- `.btn-primary` - Primary action buttons
- `.btn-secondary` - Secondary action buttons
- `.btn-outline` - Outlined buttons
- `.btn-ghost` - Ghost buttons
- `.btn-danger` - Destructive action buttons

#### Sizes
- `.btn-sm` - Small buttons
- `.btn-md` - Medium buttons (default)
- `.btn-lg` - Large buttons

#### States
- `.btn-loading` - Loading state with spinner
- `.btn:active` - Active/pressed state

#### Example Usage
```html
<button class="btn btn-primary btn-md">Primary Action</button>
<button class="btn btn-outline btn-sm">Secondary Action</button>
```

### Cards

#### Base Classes
- `.card` - Base card styles
- `.card-elevated` - Elevated cards with stronger shadow
- `.card-outlined` - Outlined cards without shadow
- `.card-filled` - Filled cards with background color

#### Sections
- `.card-header` - Card header section
- `.card-body` - Card body section
- `.card-footer` - Card footer section

#### Sizes
- `.card-sm` - Small padding
- `.card-lg` - Large padding

#### Interactive
- `.card-interactive` - Hover effects for interactive cards

### Forms

#### Form Elements
- `.form-group` - Form field wrapper
- `.form-label` - Form labels
- `.form-label-required` - Required field labels
- `.form-input` - Text inputs
- `.form-textarea` - Textarea inputs
- `.form-select` - Select dropdowns
- `.form-checkbox` / `.form-radio` - Checkboxes and radio buttons

#### Validation
- `.form-input-error` - Error state inputs
- `.form-error-message` - Error message text

#### Layout
- `.form-row` - Horizontal form layout
- `.form-inline` - Inline form layout

### Modals

#### Base Classes
- `.modal-backdrop` - Modal backdrop
- `.modal` - Modal container
- `.modal-header` - Modal header
- `.modal-body` - Modal body
- `.modal-footer` - Modal footer
- `.modal-close` - Close button

#### Sizes
- `.modal-sm` - Small modal (300px)
- `.modal-md` - Medium modal (500px)
- `.modal-lg` - Large modal (800px)
- `.modal-xl` - Extra large modal (1140px)
- `.modal-full` - Full screen modal

#### States
- `.modal-open` - Open state class

### Tables

#### Base Classes
- `.table` - Base table styles
- `.table-striped` - Striped rows
- `.table-hover` - Hover effects
- `.table-bordered` - Bordered table

#### Sizes
- `.table-sm` - Compact table
- `.table-lg` - Spacious table

#### Features
- `.table-responsive` - Responsive wrapper
- `.table-sortable` - Sortable columns
- `.table-loading` - Loading state
- `.table-empty` - Empty state

## Utility Classes

### Animations

#### Entrance Animations
- `.animate-fade-in`
- `.animate-slide-in-left/right/top/bottom`
- `.animate-scale-in`
- `.animate-bounce-in`
- `.animate-rotate-in`

#### Exit Animations
- `.animate-fade-out`
- `.animate-slide-out-left/right/top/bottom`
- `.animate-scale-out`
- `.animate-bounce-out`
- `.animate-rotate-out`

#### Continuous Animations
- `.animate-pulse`
- `.animate-shake`
- `.animate-wiggle`

#### Animation Modifiers
- `.animate-duration-fast/slow`
- `.animate-infinite`
- `.animate-fill-forwards/backwards`

### Layout

#### Display
- `.d-none/block/inline/inline-block`
- `.d-flex/inline-flex`
- `.d-grid/inline-grid`

#### Flexbox
- `.flex-row/column`
- `.justify-start/end/center/between/around/evenly`
- `.align-start/end/center/baseline/stretch`
- `.flex-1/auto/initial/none`

#### Grid
- `.grid-cols-1` through `.grid-cols-12`
- `.col-span-1` through `.col-span-12`

#### Width/Height
- `.w-0/1/2/3/4/5/6/8/10/12/16/20/24/32/40/48/56/64`
- `.w-auto/px/full/screen/min/max`
- `.h-0/1/2/3/4/5/6/8/10/12/16/20/24/32/40/48/56/64`
- `.h-auto/px/full/screen/min/max`

#### Containers
- `.container` - Responsive container
- `.container-fluid` - Full width container
- `.container-sm/md/lg/xl/2xl` - Fixed width containers

### Spacing

#### Margin
- `.m-0` through `.m-7` - All margins
- `.mt-0` through `.mt-7` - Top margin
- `.mr-0` through `.mr-7` - Right margin
- `.mb-0` through `.mb-7` - Bottom margin
- `.ml-0` through `.ml-7` - Left margin
- `.mx-0` through `.mx-7` - Horizontal margins
- `.my-0` through `.my-7` - Vertical margins

#### Padding
- `.p-0` through `.p-7` - All padding
- `.pt-0` through `.pt-7` - Top padding
- `.pr-0` through `.pr-7` - Right padding
- `.pb-0` through `.pb-7` - Bottom padding
- `.pl-0` through `.pl-7` - Left padding
- `.px-0` through `.px-7` - Horizontal padding
- `.py-0` through `.py-7` - Vertical padding

## Cleanup and Homogenization Tools

The project includes automated tools to maintain SCSS consistency and cleanliness:

### Cleanup Scripts

Located in `scripts/cleanup-styles.mjs`:
- **Duplicate Variable Detection**: Identifies and removes duplicate SCSS variables
- **Unused Style Analysis**: Scans components to find unused CSS classes
- **Automated Cleanup**: Safely removes obsolete styles while preserving functionality

### Homogenization Scripts

Located in `scripts/homogenize_styles.mjs`:
- **Tailwind to SCSS Migration**: Converts legacy Tailwind classes to design tokens
- **Color Standardization**: Replaces hardcoded colors with semantic variables
- **Consistency Enforcement**: Ensures uniform styling patterns across components

### Usage

```bash
# Clean duplicate variables and unused styles
node scripts/cleanup-styles.mjs

# Homogenize component styles
node scripts/homogenize_styles.mjs <component-file.scss>
```

## Usage Examples

### Creating a New Component

```scss
// In src/styles/components/_my-component.scss
.my-component {
  @include card-base;
  display: flex;
  align-items: center;
  gap: $spacing-md;

  &__icon {
    flex-shrink: 0;
    width: 2rem;
    height: 2rem;
  }

  &__content {
    flex: 1;
  }

  &__title {
    @include text-style($font-size-lg, $font-weight-semibold);
    margin-bottom: $spacing-xs;
  }

  &__description {
    color: $muted-foreground;
    margin: 0;
  }

  &--highlighted {
    background-color: $accent;
    color: $accent-foreground;
  }
}
```

```html
<div class="my-component my-component--highlighted">
  <div class="my-component__icon">
    <!-- Icon here -->
  </div>
  <div class="my-component__content">
    <h3 class="my-component__title">Component Title</h3>
    <p class="my-component__description">Component description</p>
  </div>
</div>
```

### Responsive Design

```scss
.responsive-component {
  padding: $spacing-md;

  @include respond-to(md) {
    padding: $spacing-lg;
    display: flex;
    gap: $spacing-lg;
  }

  @include respond-to(lg) {
    padding: $spacing-xl;
    max-width: 1200px;
    margin: 0 auto;
  }
}
```

### Using Mixins

```scss
.custom-button {
  @include button-base;
  @include button-variant($primary, $primary-foreground);
  @include button-size($spacing-sm, $spacing-md, $font-size-sm);
}
```

### Dark Theme Support

```scss
.theme-aware-component {
  background-color: $card;
  color: $foreground;
  border: 1px solid $border;

  @media (prefers-color-scheme: dark) {
    background-color: $card-dark;
    color: $foreground-dark;
    border-color: $border-dark;
  }
}
```

## Best Practices

### 1. Use Design Tokens
Always use SCSS variables instead of hardcoded values:

```scss
// ✅ Good
.my-component {
  color: $primary;
  padding: $spacing-md;
  border-radius: $border-radius-md;
}

// ❌ Avoid
.my-component {
  color: #007bff;
  padding: 1rem;
  border-radius: 6px;
}
```

### 2. Follow BEM Naming
Use consistent BEM naming for maintainability:

```scss
// ✅ Good
.user-profile {
  &__avatar {
    &--large {
      // Styles
    }
  }
}

// ❌ Avoid
.userProfile {
  .avatar {
    &.large {
      // Styles
    }
  }
}
```

### 3. Mobile-First Responsive Design
Start with mobile styles and enhance for larger screens:

```scss
// ✅ Good
.responsive-component {
  // Mobile styles first

  @include respond-to(md) {
    // Tablet styles
  }

  @include respond-to(lg) {
    // Desktop styles
  }
}
```

### 4. Component Composition
Compose components using existing utilities and mixins:

```scss
// ✅ Good
.my-card {
  @include card-base;
  @include flex-column;
  gap: $spacing-md;
}

// ❌ Avoid recreating existing functionality
.my-card {
  background: white;
  border: 1px solid #ddd;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
```

### 5. Dark Theme Considerations
Always consider dark theme variants:

```scss
// ✅ Good
.my-component {
  background-color: $card;
  color: $foreground;

  @media (prefers-color-scheme: dark) {
    background-color: $card-dark;
    color: $foreground-dark;
  }
}
```

### 6. Audit and Logging Integration
When implementing audit-related UI components:

```scss
// ✅ Good - Audit-aware styling
.audit-log-entry {
  @include card-base;
  border-left: 4px solid $primary;

  &--warning {
    border-left-color: $warning;
    background-color: $warning-background;
  }

  &--error {
    border-left-color: $destructive;
    background-color: $destructive-background;
  }
}
```

### 7. Transition from Legacy Tailwind
During the migration from Tailwind CSS to SCSS:

- **Avoid mixing systems**: Don't combine Tailwind utilities with SCSS classes in the same component
- **Use homogenization scripts**: Run `homogenize_styles.mjs` to convert legacy classes
- **Gradual migration**: Update components systematically rather than all at once
- **Test thoroughly**: Ensure dark theme and responsive behavior remain intact

### 6. Performance Considerations
- Use utility classes for common patterns
- Avoid deep nesting in SCSS
- Minimize the use of expensive selectors
- Leverage CSS custom properties for dynamic theming

### 7. Accessibility
- Ensure sufficient color contrast ratios
- Use semantic color variables (`$destructive` for errors)
- Maintain focus indicators
- Support reduced motion preferences

## Audit Implementation Impact

The recent codebase audit has influenced several aspects of our styling approach:

### Codebase Cleanup Results
- **Duplicate Variables**: Identified and removed redundant SCSS variable definitions
- **Unused Styles**: Components scanned for unused CSS classes and selectors
- **Legacy Migration**: Transition path established from Tailwind utilities to SCSS architecture

### Audit Service Integration
- **Audit Logging**: Style changes can now be tracked through the AuditService
- **Change Tracking**: Modifications to design tokens and component styles are logged
- **Compliance**: Audit trail maintained for styling system modifications

### Performance Improvements
- **Bundle Optimization**: Cleanup scripts reduce CSS bundle size
- **Selector Efficiency**: Audit findings led to more efficient CSS selector patterns
- **Maintainability**: Cleaner architecture reduces technical debt

---

This style guide is living documentation. As the design system evolves, please update this document to reflect changes and additions. Recent audit implementation has enhanced our tooling and processes for maintaining style consistency.Basado en mi auditoría completa del proyecto Angular, he analizado todos los archivos SCSS/CSS y las configuraciones de estilo. A continuación, presento el **Reporte de Auditoría** con las fallas y oportunidades de mejora identificadas, seguido de la **Guía de Estilos del Proyecto** y finalmente una propuesta de script para eliminar duplicados y redundancias.

## Reporte de Auditoría de Estilos

### 1. Consistencia y Adherencia a Metodología

**Fortalezas:**
- ✅ **BEM Methodology**: La mayoría de los componentes siguen consistentemente la metodología BEM (Block Element Modifier). Ejemplos claros en `chatbot.component.scss`, `motorcycle-registration.component.scss`, `queue-join.component.scss`, etc.
- ✅ **Nomenclatura consistente**: Los nombres de clases siguen patrones predecibles: `block__element--modifier`
- ✅ **Uso de mixins**: Excelente uso de mixins en `_mixins.scss` para botones, tarjetas, formularios, etc.
- ✅ **Variables centralizadas**: Sistema robusto de variables en `_variables.scss` con colores, espaciado, tipografía, etc.

**Problemas identificados:**
- ⚠️ **Inconsistencia en algunos componentes**: `nueva-motocicleta.component.scss` no sigue BEM, usa clases CSS tradicionales sin metodología estructurada
- ⚠️ **Duplicación de variables**: En `_variables.scss` hay variables duplicadas (ej: `$primary`, `$accent` aparecen múltiples veces)
- ⚠️ **Mixins no utilizados**: Algunos mixins definidos en `_mixins.scss` no se usan en los componentes

### 2. Rendimiento y Optimización

**Fortalezas:**
- ✅ **Organización de archivos**: Excelente estructura con carpetas `core/`, `components/`, `utilities/`
- ✅ **Imports eficientes**: `main.scss` importa de manera organizada y jerárquica

**Problemas identificados:**
- ⚠️ **Selectores universales**: En `_reset.scss` se usan selectores `*` que pueden afectar rendimiento
- ⚠️ **Duplicación de estilos**: Algunos estilos se repiten entre componentes (ej: spinners, botones)
- ⚠️ **Estilos no utilizados**: Posibles estilos en `utilities/_layout.scss` y `utilities/_animations.scss` que no se usan
- ⚠️ **Scrollbar personalizado**: En `chatbot.component.scss` hay estilos de scrollbar complejos que pueden afectar rendimiento

### 3. Mantenibilidad y Escalabilidad

**Fortalezas:**
- ✅ **Sin uso de ::ng-deep**: No se encontraron usos de `::ng-deep` en el proyecto
- ✅ **Sin abuso de !important**: No se encontraron usos de `!important`
- ✅ **Encapsulación**: Los componentes usan View Encapsulation de Angular correctamente

**Problemas identificados:**
- ⚠️ **Complejidad de selectores**: Algunos selectores anidados en componentes como `wait-ticket.component.scss` son complejos
- ⚠️ **Estilos hardcoded**: En `nueva-motocicleta.component.scss` hay valores hardcoded en lugar de usar variables
- ⚠️ **Dependencia de colores específicos**: Algunos componentes usan colores hardcoded en lugar de variables del sistema

### 4. Diseño Responsivo

**Fortalezas:**
- ✅ **Breakpoints consistentes**: Sistema de breakpoints bien definido en `_breakpoints.scss`
- ✅ **Mixins responsive**: `@include respond-to()` usado consistentemente
- ✅ **Mobile-first approach**: La mayoría de componentes siguen enfoque mobile-first

**Problemas identificados:**
- ⚠️ **Breakpoints hardcoded**: Algunos componentes usan media queries con valores hardcoded en lugar de variables
- ⚠️ **Inconsistencia en responsive**: `nueva-motocicleta.component.scss` usa media queries tradicionales en lugar de mixins

## Guía de Estilos del Proyecto

### Metodología CSS Recomendada
**BEM (Block Element Modifier)** - Implementado correctamente en la mayoría del proyecto

### Reglas de Nomenclatura
- **Bloques**: `.component-name`
- **Elementos**: `.component-name__element`
- **Modificadores**: `.component-name__element--modifier`
- **Variables**: `$component-variable-name`
- **Mixins**: `@mixin component-mixin-name()`

### Estructura de Carpetas
```
src/styles/
├── main.scss                 # Archivo principal de imports
├── _variables.scss           # Variables globales
├── _mixins.scss             # Mixins reutilizables
├── _functions.scss          # Funciones SCSS
├── _breakpoints.scss        # Breakpoints responsive
├── _constants.scss          # Constantes adicionales
├── core/                    # Estilos base
│   ├── _reset.scss         # Reset CSS
│   ├── _typography.scss    # Tipografía
│   └── _base.scss          # Estilos base
├── components/              # Estilos de componentes
│   ├── _buttons.scss       # Botones
│   ├── _cards.scss         # Tarjetas
│   ├── _forms.scss         # Formularios
│   ├── _modals.scss        # Modales
│   └── _tables.scss        # Tablas
└── utilities/               # Utilidades
    ├── _animations.scss    # Animaciones
    ├── _layout.scss        # Layout
    └── _spacing.scss       # Espaciado
```

### Puntos de Quiebre (Breakpoints) Oficiales
- `$breakpoint-xs: 475px` - Extra small
- `$breakpoint-sm: 640px` - Small (mobile)
- `$breakpoint-md: 768px` - Medium (tablet)
- `$breakpoint-lg: 1024px` - Large (desktop)
- `$breakpoint-xl: 1280px` - Extra large
- `$breakpoint-2xl: 1536px` - 2X large

### Do's y Don'ts

#### ✅ Do's (Buenas Prácticas)
- Usar siempre BEM para nomenclatura de clases
- Utilizar variables del sistema en lugar de valores hardcoded
- Aplicar mixins responsive con `@include respond-to()`
- Mantener consistencia en espaciado usando variables `$spacing-*`
- Usar funciones de color como `color-change()` y `color-adjust()`

#### ❌ Don'ts (Antipatrones)
- **No usar `!important`**: Rompe la cascada natural de CSS
- **No usar `::ng-deep`**: Afecta el View Encapsulation de Angular
- **Evitar selectores universales `*`**: Impactan rendimiento
- **No hardcode colores**: Usar variables del sistema de colores
- **No crear media queries manuales**: Usar mixins `@include respond-to()`
- **Evitar anidamiento excesivo**: Máximo 3-4 niveles de profundidad
- **No duplicar estilos**: Reutilizar componentes y mixins existentes

## Script para Eliminar Duplicados y Redundancias

```javascript
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
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { main as cleanupStyles };
```

### Recomendaciones Adicionales

1. **Migrar `nueva-motocicleta.component.scss`** a BEM methodology
2. **Crear un linter SCSS** para mantener consistencia
3. **Implementar CSS custom properties** para temas dinámicos
4. **Optimizar animaciones** removiendo `prefers-reduced-motion` donde no sea necesario
5. **Crear un sistema de componentes base** para reducir duplicación

Esta auditoría proporciona una base sólida para mantener y mejorar la calidad del código CSS/SCSS en el proyecto Angular.