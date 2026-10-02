import { Component } from '@angular/core';

@Component({
  selector: 'app-contact-page-one',
  templateUrl: './contact-page-one.component.html'
})
export class ContactPageOneComponent {

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
      this.contactError = 'Veuillez remplir tous les champs obligatoires (Nom, Email, Message).';
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