
import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-footer',
  templateUrl: './footer.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  styles: [':host { contain: layout; }'],
})
export class FooterComponent {
  currentYear = new Date().getFullYear();
}