import { Component } from '@angular/core';

@Component({
  selector: 'app-contact-page-two',
  templateUrl: './contact-page-two.component.html'
})
export class ContactPageTwoComponent {

  contactForm = {
    name: '',
    email: '',
    subject: '',
    phone: '',
    message: ''
  };

  contactLoading = false;
  contactSuccess = '';
  contactError = '';

  sendMessage(): void {
    if (!this.contactForm.name || !this.contactForm.email || !this.contactForm.message) {
      this.contactError = 'Veuillez remplir tous les champs obligatoires.';
      return;
    }
    this.contactLoading = true;
    this.contactError = '';
    this.contactSuccess = '';

    setTimeout(() => {
      this.contactLoading = false;
      this.contactSuccess = 'Votre message a été envoyé ! Nous vous répondrons sous 24h.';
      this.contactForm = { name: '', email: '', subject: '', phone: '', message: '' };
      setTimeout(() => this.contactSuccess = '', 5000);
    }, 1500);
  }
}