import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-card',
  template: `
    <div class="bg-card text-card-foreground rounded-xl border border-border shadow-sm">
      <ng-content select="app-card-header"></ng-content>
      <ng-content select="app-card-content"></ng-content>
      <ng-content select="app-card-footer"></ng-content>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CardComponent {}

@Component({
  selector: 'app-card-header',
  template: `<div class="p-6 flex flex-col space-y-1.5"><ng-content></ng-content></div>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CardHeaderComponent {}

@Component({
  selector: 'app-card-title',
  template: `<h3 class="text-2xl font-semibold leading-none tracking-tight"><ng-content></ng-content></h3>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CardTitleComponent {}

@Component({
  selector: 'app-card-description',
  template: `<p class="text-sm text-muted-foreground"><ng-content></ng-content></p>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CardDescriptionComponent {}

@Component({
  selector: 'app-card-content',
  template: `<div class="p-6 pt-0"><ng-content></ng-content></div>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CardContentComponent {}

@Component({
  selector: 'app-card-footer',
  template: `<div class="flex items-center p-6 pt-0"><ng-content></ng-content></div>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CardFooterComponent {}

export const CARD_COMPONENTS = [
  CardComponent,
  CardHeaderComponent,
  CardTitleComponent,
  CardDescriptionComponent,
  CardContentComponent,
  CardFooterComponent
] as const;
