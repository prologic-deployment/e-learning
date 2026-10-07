import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Component, OnInit, DestroyRef, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CvService } from '../../../services/cv.service';
import { AuthService } from '../../../services/auth.service';

@Component({
    selector: 'app-cv-page',
    templateUrl: './cv-page.component.html',
    styleUrls: ['./cv-page.component.scss'],
})
export class CvPageComponent implements OnInit {
    private destroy = inject(DestroyRef);
    operationError = '';
    pendingDelete = '';
    downloadLoading = false;
    activeTab = 'info';
    cv: any = null;
    loading = true;
    loadError = '';
    saveLoading = false;
    saveSuccess = '';
    saveError = '';

    // Infos personnelles
    cvInfo = {
        nom: '',
        prenom: '',
        email: '',
        telephone: '',
        description: '',
    };
    selectedPhoto: File | null = null;

    // Expérience
    newExperience = {
        titre: '',
        entreprise: '',
        dateDebut: '',
        dateFin: '',
        description: '',
    };
    expLoading = false;

    // Formation
    newFormation = {
        diplome: '',
        etablissement: '',
        dateDebut: '',
        dateFin: '',
    };
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
        { id: 'info', icon: 'bx bx-user', label: 'Infos Personnelles' },
        { id: 'experience', icon: 'bx bx-briefcase', label: 'Expériences' },
        { id: 'formation', icon: 'bx bx-graduation', label: 'Formation' },
        { id: 'competence', icon: 'bx bx-bolt-circle', label: 'Compétences' },
        { id: 'langue', icon: 'bx bx-globe', label: 'Langues' },
        { id: 'hobby', icon: 'bx bx-target-lock', label: "Centres d'intérêt" },
    ];

    constructor(
        private cvService: CvService,
        private authService: AuthService,
        private router: Router,
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
        this.loadError = '';
        this.cvService
            .getMyCV()
            .pipe(takeUntilDestroyed(this.destroy))
            .subscribe({
                next: (data) => {
                    this.cv = data;
                    this.cvInfo = {
                        nom: data.nom || '',
                        prenom: data.prenom || '',
                        email: data.email || '',
                        telephone: data.telephone || '',
                        description: data.description || '',
                    };
                    this.loading = false;
                },
                error: (err) => {
                    this.loading = false;
                    if (err.status !== 404)
                        this.loadError =
                            'Votre CV est indisponible pour le moment. Réessayez.';
                },
            });
    }

    onPhotoSelected(event: any): void {
        this.selectedPhoto = event.target.files[0];
    }

    // ========== SAVE CV INFO ==========
    saveCV(): void {
        if (this.saveLoading) return;
        this.operationError = '';
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

        this.cvService
            .saveCV(formData)
            .pipe(takeUntilDestroyed(this.destroy))
            .subscribe({
                next: () => {
                    this.saveLoading = false;
                    this.saveSuccess = 'CV info saved successfully ! ';
                    this.loadCV();
                },
                error: (err) => {
                    this.saveLoading = false;
                    this.saveError = err.error?.message || 'Error saving CV';
                },
            });
    }

    // ========== EXPERIENCE ==========
    addExperience(): void {
        if (this.expLoading) return;
        this.operationError = '';
        if (
            this.newExperience.dateFin &&
            this.newExperience.dateFin < this.newExperience.dateDebut
        ) {
            this.operationError =
                'La date de fin doit suivre la date de début.';
            return;
        }
        this.expLoading = true;
        this.cvService
            .addExperience(this.newExperience)
            .pipe(takeUntilDestroyed(this.destroy))
            .subscribe({
                next: () => {
                    this.expLoading = false;
                    this.newExperience = {
                        titre: '',
                        entreprise: '',
                        dateDebut: '',
                        dateFin: '',
                        description: '',
                    };
                    this.loadCV();
                },
                error: () => {
                    this.expLoading = false;
                    this.operationError =
                        'Impossible de sauvegarder cette entrée. Réessayez.';
                },
            });
    }

    deleteExperience(id: string): void {
        if (this.pendingDelete) return;
        this.pendingDelete = id;
        this.operationError = '';
        this.cvService
            .deleteExperience(id)
            .pipe(takeUntilDestroyed(this.destroy))
            .subscribe({
                next: () => {
                    this.pendingDelete = '';
                    this.loadCV();
                },
                error: () => {
                    this.pendingDelete = '';
                    this.operationError = 'Cette action a échoué. Réessayez.';
                },
            });
    }

    // ========== FORMATION ==========
    addFormation(): void {
        if (this.formLoading) return;
        this.operationError = '';
        if (
            this.newFormation.dateFin &&
            this.newFormation.dateFin < this.newFormation.dateDebut
        ) {
            this.operationError =
                'La date de fin doit suivre la date de début.';
            return;
        }
        this.formLoading = true;
        this.cvService
            .addFormation(this.newFormation)
            .pipe(takeUntilDestroyed(this.destroy))
            .subscribe({
                next: () => {
                    this.formLoading = false;
                    this.newFormation = {
                        diplome: '',
                        etablissement: '',
                        dateDebut: '',
                        dateFin: '',
                    };
                    this.loadCV();
                },
                error: () => {
                    this.formLoading = false;
                    this.operationError =
                        'Impossible de sauvegarder cette entrée. Réessayez.';
                },
            });
    }

    deleteFormation(id: string): void {
        if (this.pendingDelete) return;
        this.pendingDelete = id;
        this.operationError = '';
        this.cvService
            .deleteFormation(id)
            .pipe(takeUntilDestroyed(this.destroy))
            .subscribe({
                next: () => {
                    this.pendingDelete = '';
                    this.loadCV();
                },
                error: () => {
                    this.pendingDelete = '';
                    this.operationError = 'Cette action a échoué. Réessayez.';
                },
            });
    }

    // ========== COMPETENCE ==========
    addCompetence(): void {
        if (this.compLoading) return;
        this.operationError = '';
        this.compLoading = true;
        this.cvService
            .addCompetence(this.newCompetence)
            .pipe(takeUntilDestroyed(this.destroy))
            .subscribe({
                next: () => {
                    this.compLoading = false;
                    this.newCompetence = { nom: '', niveau: 'Débutant' };
                    this.loadCV();
                },
                error: () => {
                    this.compLoading = false;
                    this.operationError =
                        'Impossible de sauvegarder cette entrée. Réessayez.';
                },
            });
    }

    deleteCompetence(id: string): void {
        if (this.pendingDelete) return;
        this.pendingDelete = id;
        this.operationError = '';
        this.cvService
            .deleteCompetence(id)
            .pipe(takeUntilDestroyed(this.destroy))
            .subscribe({
                next: () => {
                    this.pendingDelete = '';
                    this.loadCV();
                },
                error: () => {
                    this.pendingDelete = '';
                    this.operationError = 'Cette action a échoué. Réessayez.';
                },
            });
    }

    // ========== LANGUE ==========
    addLangue(): void {
        if (this.langLoading) return;
        this.operationError = '';
        this.langLoading = true;
        this.cvService
            .addLangue(this.newLangue)
            .pipe(takeUntilDestroyed(this.destroy))
            .subscribe({
                next: () => {
                    this.langLoading = false;
                    this.newLangue = { langue: '', niveau: 'Débutant' };
                    this.loadCV();
                },
                error: () => {
                    this.langLoading = false;
                    this.operationError =
                        'Impossible de sauvegarder cette entrée. Réessayez.';
                },
            });
    }

    deleteLangue(id: string): void {
        if (this.pendingDelete) return;
        this.pendingDelete = id;
        this.operationError = '';
        this.cvService
            .deleteLangue(id)
            .pipe(takeUntilDestroyed(this.destroy))
            .subscribe({
                next: () => {
                    this.pendingDelete = '';
                    this.loadCV();
                },
                error: () => {
                    this.pendingDelete = '';
                    this.operationError = 'Cette action a échoué. Réessayez.';
                },
            });
    }

    // ========== HOBBY ==========
    addHobby(): void {
        if (this.hobbyLoading) return;
        this.operationError = '';
        this.hobbyLoading = true;
        this.cvService
            .addHobby(this.newHobby)
            .pipe(takeUntilDestroyed(this.destroy))
            .subscribe({
                next: () => {
                    this.hobbyLoading = false;
                    this.newHobby = { nom: '' };
                    this.loadCV();
                },
                error: () => {
                    this.hobbyLoading = false;
                    this.operationError =
                        'Impossible de sauvegarder cette entrée. Réessayez.';
                },
            });
    }

    deleteHobby(id: string): void {
        if (this.pendingDelete) return;
        this.pendingDelete = id;
        this.operationError = '';
        this.cvService
            .deleteHobby(id)
            .pipe(takeUntilDestroyed(this.destroy))
            .subscribe({
                next: () => {
                    this.pendingDelete = '';
                    this.loadCV();
                },
                error: () => {
                    this.pendingDelete = '';
                    this.operationError = 'Cette action a échoué. Réessayez.';
                },
            });
    }

    // ========== DOWNLOAD PDF ==========
    downloadPDF(): void {
        if (this.downloadLoading) return;
        this.downloadLoading = true;
        this.operationError = '';
        this.cvService
            .downloadCV()
            .pipe(takeUntilDestroyed(this.destroy))
            .subscribe({
                next: (blob) => {
                    this.downloadLoading = false;
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `CV_${this.cvInfo.prenom}_${this.cvInfo.nom}.pdf`;
                    a.click();
                    window.URL.revokeObjectURL(url);
                },
                error: () => {
                    this.downloadLoading = false;
                    this.operationError = 'Cette action a échoué. Réessayez.';
                },
            });
    }
}
