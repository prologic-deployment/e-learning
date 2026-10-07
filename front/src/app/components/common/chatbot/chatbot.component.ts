import { Component, OnInit, ElementRef, ViewChild } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

interface Message {
  role: string;
  content: string;
  contentHtml?: SafeHtml;
  sources?: { title: string; url: string | null; price: string }[];
  timestamp?: Date;
}

@Component({
  selector: 'app-chatbot',
  templateUrl: './chatbot.component.html',
  styleUrls: ['./chatbot.component.scss']
})
export class ChatbotComponent implements OnInit {

  @ViewChild('chatBody') chatBodyRef!: ElementRef;

  isOpen = false;
  isMinimized = false;
  message = '';
  loading = false;
  apiUrl = environment.apiUrl;

  messages: Message[] = [
    {
      role: 'model',
      content: '👋 Bonjour ! Je suis **EduBot**, votre assistant IA pour la plateforme e-learning.\n\nJe peux vous aider à :\n- 🔍 Trouver le cours idéal\n- 💰 Connaître les prix\n- 🔗 Obtenir les liens directs vers les cours\n- 👨‍🏫 Trouver un formateur\n\nComment puis-je vous aider ? 🎓',
      timestamp: new Date()
    }
  ];

  suggestedQuestions = [
    '📚 Quels cours sont disponibles ?',
    '🆓 Y a-t-il des cours gratuits ?',
    '🐍 Cours Python disponibles ?',
    '💰 Quel est le cours le moins cher ?'
  ];

  constructor(
    private http: HttpClient,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit(): void {
    // Convertir le message de bienvenue
    this.messages[0].contentHtml = this.formatMessage(this.messages[0].content);
  }

  toggleChat(): void {
    this.isOpen = !this.isOpen;
    if (this.isOpen) {
      setTimeout(() => this.scrollToBottom(), 200);
    }
  }

  // ✅ XSS FIX: escape HTML entities BEFORE converting markdown. Model output
  // and RAG content are untrusted — nothing can inject raw HTML anymore.
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  formatMessage(text: string): SafeHtml {
    const safe = this.escapeHtml(text);
    let html = safe
      // Bold
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      // Italic
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      // URLs cliquables (ne matche plus les &quot; échappés)
      .replace(
        /(https?:\/\/[^\s\)]+)/g,
        '<a href="$1" target="_blank" rel="noopener noreferrer" style="color: #457B9D; text-decoration: underline; font-weight: 600;">🔗 $1</a>'
      )
      // Listes avec tirets
      .replace(/^- (.+)$/gm, '<li style="margin: 4px 0;">$1</li>')
      // Wrapper les listes
      .replace(/(<li[^>]*>.*<\/li>)/s, '<ul style="padding-left: 16px; margin: 8px 0;">$1</ul>')
      // Sauts de ligne
      .replace(/\n/g, '<br>');

    return this.sanitizer.bypassSecurityTrustHtml(html);
  }

  sendMessage(text?: string): void {
    const userMessage = (text || this.message).trim();
    if (!userMessage || this.loading) return;
    this.message = '';

    this.messages.push({
      role: 'user',
      content: userMessage,
      contentHtml: this.formatMessage(userMessage),
      timestamp: new Date()
    });

    this.loading = true;

    // Historique sans le message de bienvenue
    const history = this.messages.slice(1, -1).slice(-4).map(m => ({
      role: m.role,
      content: m.content
    }));

    this.http.post(`${this.apiUrl}/chatbot/chat`, {
      message: userMessage,
      history: history
    }).subscribe({
      next: (res: any) => {
        this.loading = false;
        const content = (res.mode === 'catalogue' ? 'IA indisponible — résultats du catalogue en direct.\n\n' : '') + res.message;
        const botMessage: Message = {
          role: 'model',
          content,
          contentHtml: this.formatMessage(content),
          sources: res.sources?.filter((s: any) => s.title && s.url) || [],
          timestamp: new Date()
        };
        this.messages.push(botMessage);
        setTimeout(() => this.scrollToBottom(), 100);
      },
      error: () => {
        this.loading = false;
        const errMsg = '❌ Une erreur est survenue. Veuillez réessayer dans quelques instants.';
        this.messages.push({
          role: 'model',
          content: errMsg,
          contentHtml: this.formatMessage(errMsg),
          timestamp: new Date()
        });
        setTimeout(() => this.scrollToBottom(), 100);
      }
    });

    setTimeout(() => this.scrollToBottom(), 100);
  }

  useSuggestedQuestion(q: string): void {
    // Enlever l'emoji du début
    const clean = q.replace(/^[^\s]+\s/, '');
    this.sendMessage(clean);
  }

  scrollToBottom(): void {
    if (this.chatBodyRef) {
      this.chatBodyRef.nativeElement.scrollTop = this.chatBodyRef.nativeElement.scrollHeight;
    }
    // fallback
    const chatBody = document.getElementById('chatBody');
    if (chatBody) chatBody.scrollTop = chatBody.scrollHeight;
  }

  onKeyPress(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  clearChat(): void {
    this.messages = [this.messages[0]];
  }

  getTime(date?: Date): string {
    if (!date) return '';
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }
}