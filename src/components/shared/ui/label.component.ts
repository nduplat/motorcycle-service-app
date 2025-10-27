import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'label[app-label]',
  template: `<ng-content></ng-content>`,
  host: {
    '[class]': `'block text-sm font-medium text-foreground'`
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LabelComponent {}
