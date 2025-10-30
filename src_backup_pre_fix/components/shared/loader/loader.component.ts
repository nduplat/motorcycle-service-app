
import { Component, ChangeDetectionStrategy, input } from '@angular/core';

@Component({
  selector: 'app-loader',
  template: `
    <div class="flex flex-col justify-center items-center p-4 space-y-2">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      @if(text()){
        <p class="text-muted-foreground text-sm">{{ text() }}</p>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
})
export class LoaderComponent {
    text = input<string>('');
}