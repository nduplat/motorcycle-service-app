import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ChatbotComponent } from '../../shared/chatbot.component';

@Component({
  selector: 'app-offers-page',
  imports: [ChatbotComponent],
  templateUrl: './offers-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OffersPageComponent {
  onOfferApplied(offer: any) {
    console.log('Offer applied via chatbot:', offer);
    // Handle offer application
  }
}
