import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CvService } from '../../../services/cv.service';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-cv-page',
  templateUrl: './cv-page.component.html',
  styleUrls: ['./cv-page.component.scss']
})
export class CvPageComponent implements OnInit {

  activeTab = 'info';
  cv: any = null;
  loading = true;
  saveLoading = false;
  saveSuccess = '';
  saveError = '';

  // Infos personnelles
  cvInfo = {
    nom: '',
    prenom: '',
    email: '',
    telephone: '',
    description: ''
  };
  selectedPhoto: File | null = null;

  // Expérience
  newExperience = { titre: '', entreprise: '', dateDebut: '', dateFin: '', description: '' };
  expLoading = false;

  // Formation
  newFormation = { diplome: '', etablissement: '', dateDebut: '', dateFin: '' };
  formLoading = false;

  // Compétence
  newCompetence = { nom: '', niveau: 'Débutant' };
  compLoading = false;

  // Langue
  newLangue = { langue: '', niveau: 'Débutant' };
  langLoading = false;

  // Hobby
  newHobby = { nom: '' };
  hobbyLoading = false;

  cvTabs = [
  { id: 'info', icon: '👤', label: 'Infos Personnelles' },
  { id: 'experience', icon: '💼', label: 'Expériences' },
  { id: 'formation', icon: '🎓', label: 'Formation' },
  { id: 'competence', icon: '⚡', label: 'Compétences' },
  { id: 'langue', icon: '🌍', label: 'Langues' },
  { id: 'hobby', icon: '🎯', label: 'Centres d\'intérêt' }
  ];

  constructor(
    private cvService: CvService,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    if (!this.authService.isLoggedIn()) {
      this.router.navigate(['/profile-authentication']);
      return;
    }
    this.loadCV();
  }

  loadCV(): void {
    this.loading = true;
    this.cvService.getMyCV().subscribe({
      next: (data) => {
        this.cv = data;
        this.cvInfo = {
          nom: data.nom || '',
          prenom: data.prenom || '',
          email: data.email || '',
          telephone: data.telephone || '',
          description: data.description || ''
        };
        this.loading = false;
      },
      error: () => { this.loading = false; }
    });
  }

  onPhotoSelected(event: any): void {
    this.selectedPhoto = event.target.files[0];
  }

  // ========== SAVE CV INFO ==========
  saveCV(): void {
    this.saveLoading = true;
    this.saveError = '';
    this.saveSuccess = '';

    const formData = new FormData();
    formData.append('nom', this.cvInfo.nom);
    formData.append('prenom', this.cvInfo.prenom);
    formData.append('email', this.cvInfo.email);
    formData.append('telephone', this.cvInfo.telephone);
    formData.append('description', this.cvInfo.description);
    if (this.selectedPhoto) {
      formData.append('photo', this.selectedPhoto);
    }

    this.cvService.saveCV(formData).subscribe({
      next: () => {
        this.saveLoading = false;
        this.saveSuccess = 'CV info saved successfully ! ✅';
        this.loadCV();
        setTimeout(() => this.saveSuccess = '', 3000);
      },
      error: (err) => {
        this.saveLoading = false;
        this.saveError = err.error?.message || 'Error saving CV';
      }
    });
  }

  // ========== EXPERIENCE ==========
  addExperience(): void {
    this.expLoading = true;
    this.cvService.addExperience(this.newExperience).subscribe({
      next: () => {
        this.expLoading = false;
        this.newExperience = { titre: '', entreprise: '', dateDebut: '', dateFin: '', description: '' };
        this.loadCV();
      },
      error: () => { this.expLoading = false; }
    });
  }

  deleteExperience(id: string): void {
    this.cvService.deleteExperience(id).subscribe({
      next: () => { this.loadCV(); },
      error: () => {}
    });
  }

  // ========== FORMATION ==========
  addFormation(): void {
    this.formLoading = true;
    this.cvService.addFormation(this.newFormation).subscribe({
      next: () => {
        this.formLoading = false;
        this.newFormation = { diplome: '', etablissement: '', dateDebut: '', dateFin: '' };
        this.loadCV();
      },
      error: () => { this.formLoading = false; }
    });
  }

  deleteFormation(id: string): void {
    this.cvService.deleteFormation(id).subscribe({
      next: () => { this.loadCV(); },
      error: () => {}
    });
  }

  // ========== COMPETENCE ==========
  addCompetence(): void {
    this.compLoading = true;
    this.cvService.addCompetence(this.newCompetence).subscribe({
      next: () => {
        this.compLoading = false;
        this.newCompetence = { nom: '', niveau: 'Débutant' };
        this.loadCV();
      },
      error: () => { this.compLoading = false; }
    });
  }

  deleteCompetence(id: string): void {
    this.cvService.deleteCompetence(id).subscribe({
      next: () => { this.loadCV(); },
      error: () => {}
    });
  }

  // ========== LANGUE ==========
  addLangue(): void {
    this.langLoading = true;
    this.cvService.addLangue(this.newLangue).subscribe({
      next: () => {
        this.langLoading = false;
        this.newLangue = { langue: '', niveau: 'Débutant' };
        this.loadCV();
      },
      error: () => { this.langLoading = false; }
    });
  }

  deleteLangue(id: string): void {
    this.cvService.deleteLangue(id).subscribe({
      next: () => { this.loadCV(); },
      error: () => {}
    });
  }

  // ========== HOBBY ==========
  addHobby(): void {
    this.hobbyLoading = true;
    this.cvService.addHobby(this.newHobby).subscribe({
      next: () => {
        this.hobbyLoading = false;
        this.newHobby = { nom: '' };
        this.loadCV();
      },
      error: () => { this.hobbyLoading = false; }
    });
  }

  deleteHobby(id: string): void {
    this.cvService.deleteHobby(id).subscribe({
      next: () => { this.loadCV(); },
      error: () => {}
    });
  }

  // ========== DOWNLOAD PDF ==========
  downloadPDF(): void {
    this.cvService.downloadCV().subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `CV_${this.cvInfo.prenom}_${this.cvInfo.nom}.pdf`;
        a.click();
        window.URL.revokeObjectURL(url);
      },
      error: () => {}
    });
  }
}
