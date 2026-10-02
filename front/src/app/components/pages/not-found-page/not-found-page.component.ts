import { Component } from '@angular/core';

@Component({
  selector: 'app-not-found-page',
  template: `
    <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center;
                background: linear-gradient(135deg, #f5f7fa, #e8ecf3); font-family: 'Jost', sans-serif;">
      <div style="text-align: center; padding: 40px;">
        <h1 style="font-size: 120px; font-weight: 800; margin: 0;
                   background: linear-gradient(135deg, #667eea, #764ba2);
                   -webkit-background-clip: text; -webkit-text-fill-color: transparent;">404</h1>
        <h2 style="font-weight: 700; color: #2d3748; margin: 10px 0;">Page introuvable</h2>
        <p style="color: #718096; font-size: 15px; margin-bottom: 30px;">
          La page que vous cherchez n'existe pas ou a été déplacée.
        </p>
        <a href="/"
           style="display: inline-block; padding: 13px 32px; border-radius: 10px;
                  background: linear-gradient(135deg, #667eea, #764ba2); color: white;
                  text-decoration: none; font-weight: 600; font-size: 15px;
                  box-shadow: 0 4px 15px rgba(102,126,234,0.4);">
          ← Retour à l'accueil
        </a>
      </div>
    </div>
  `
})
export class NotFoundPageComponent {}
