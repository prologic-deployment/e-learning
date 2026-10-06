import { Component } from '@angular/core';

@Component({
  selector: 'app-not-found-page',
  template: `
    <div class="route-enter"
      style="min-height: 100vh; display: flex; align-items: center; justify-content: center;
        background: radial-gradient(120% 120% at 50% 0%, #F1FAEE 0%, #EAF3F5 60%, #dfeaef 100%);
        font-family: 'Jost', sans-serif;">
      <div style="text-align: center; padding: 40px; max-width: 520px;">
        <img src="assets/img/logo.png" alt="E-Learning"
          style="height: 48px; width: auto; margin-bottom: 26px;">

        <div class="anim-pop" style="margin-bottom: 4px;">
          <svg width="190" height="150" viewBox="0 0 190 150" fill="none"
            xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <circle cx="95" cy="72" r="60" fill="#EAF3F5" />
            <path d="M55 102 C 74 62, 116 62, 135 102"
              stroke="#A8DADC" stroke-width="6" stroke-linecap="round"
              stroke-dasharray="2 12" fill="none" />
            <circle cx="95" cy="64" r="22" fill="#1D3557" />
            <circle cx="95" cy="64" r="10" fill="#F1FAEE" />
            <rect x="126" y="90" width="42" height="13" rx="6" fill="#457B9D" />
            <rect x="135" y="108" width="24" height="11" rx="5" fill="#A8DADC" />
            <circle cx="158" cy="42" r="6" fill="#E63946" />
          </svg>
        </div>

        <h1 style="font-size: 110px; font-weight: 800; margin: 0; line-height: 1;
          background: var(--gradient-brand); -webkit-background-clip: text;
          -webkit-text-fill-color: transparent; background-clip: text;">
          404
        </h1>
        <h2 style="font-weight: 700; color: #1D3557; margin: 6px 0 10px; font-size: 26px;">
          Page introuvable
        </h2>
        <p style="color: #5C7184; font-size: 15px; margin-bottom: 28px; line-height: 1.6;">
          La page que vous cherchez n'existe pas ou a été déplacée.
        </p>

        <a href="/" class="app-btn app-btn--primary"
          style="display: inline-flex; padding: 13px 30px;">
          <i class='bx bx-home'></i> Retour à l'accueil
        </a>
      </div>
    </div>
  `
})
export class NotFoundPageComponent {}
