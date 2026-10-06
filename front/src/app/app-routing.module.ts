import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AboutUsPageComponent } from './components/pages/about-us-page/about-us-page.component';
import { CartPageComponent } from './components/pages/cart-page/cart-page.component';
import { CategoriesCoursesPageComponent } from './components/pages/categories-courses-page/categories-courses-page.component';
import { CategoriesPageOneComponent } from './components/pages/categories-page-one/categories-page-one.component';
import { CategoriesPageTwoComponent } from './components/pages/categories-page-two/categories-page-two.component';
import { ContactPageOneComponent } from './components/pages/contact-page-one/contact-page-one.component';
import { ContactPageTwoComponent } from './components/pages/contact-page-two/contact-page-two.component';
import { CoursesBasicGridPageComponent } from './components/pages/courses-basic-grid-page/courses-basic-grid-page.component';
import { CoursesLeftSidebarPageComponent } from './components/pages/courses-left-sidebar-page/courses-left-sidebar-page.component';
import { CoursesListSidebarPageComponent } from './components/pages/courses-list-sidebar-page/courses-list-sidebar-page.component';
import { CoursesModernGridPageComponent } from './components/pages/courses-modern-grid-page/courses-modern-grid-page.component';
import { CoursesRightSidebarPageComponent } from './components/pages/courses-right-sidebar-page/courses-right-sidebar-page.component';
import { CoursesWideGridPageComponent } from './components/pages/courses-wide-grid-page/courses-wide-grid-page.component';
import { ElearningSchoolDemoComponent } from './components/pages/elearning-school-demo/elearning-school-demo.component';
import { ForgotPasswordComponent } from './components/pages/forgot-password-page/forgot-password-page.component';
import { FreeCoursesSinglePageComponent } from './components/pages/free-courses-single-page/free-courses-single-page.component';
import { PaidCoursesSinglePageComponent } from './components/pages/paid-courses-single-page/paid-courses-single-page.component';
import { ProfileAuthenticationPageComponent } from './components/pages/profile-authentication-page/profile-authentication-page.component';
import { AuthGuard } from './guards/auth.guard';
import { RoleGuard } from './guards/role.guard';
import { StaffRedirectGuard } from './guards/staff-redirect.guard';
import { CvPageComponent } from './components/pages/cv-page/cv-page.component';
import { CourseViewerComponent } from './components/pages/course-viewer/course-viewer.component';
import { ResetPasswordComponent } from './components/pages/reset-password/reset-password.component';
import { AdminDashboardComponent } from './components/pages/dashboard/admin-dashboard/admin-dashboard.component';
import { ManagerDashboardComponent } from './components/pages/dashboard/manager-dashboard/manager-dashboard.component';
import { TrainerDashboardComponent } from './components/pages/dashboard/trainer-dashboard/trainer-dashboard.component';
import { UserDashboardComponent } from './components/pages/dashboard/user-dashboard/user-dashboard.component';
import { RecommendationsComponent } from './components/pages/recommendations/recommendations.component';
import { NotFoundPageComponent } from './components/pages/not-found-page/not-found-page.component';

const routes: Routes = [

  // ✅ Page d'accueil — staff redirigé vers dashboard
  { path: '', pathMatch: 'full', redirectTo: 'profile-authentication' },
  { path: 'welcome', component: ElearningSchoolDemoComponent, canActivate: [StaffRedirectGuard] },

  // ✅ Cours — staff bloqué
  { path: 'courses-grid', component: CoursesBasicGridPageComponent, canActivate: [StaffRedirectGuard] },
  { path: 'courses-grid-2', component: CoursesModernGridPageComponent, canActivate: [StaffRedirectGuard] },
  { path: 'courses-wide-grid', component: CoursesWideGridPageComponent, canActivate: [StaffRedirectGuard] },
  { path: 'courses-left-sidebar', component: CoursesLeftSidebarPageComponent, canActivate: [StaffRedirectGuard] },
  { path: 'courses-right-sidebar', component: CoursesRightSidebarPageComponent, canActivate: [StaffRedirectGuard] },
  { path: 'courses-list', component: CoursesListSidebarPageComponent, canActivate: [StaffRedirectGuard] },
  { path: 'courses-details/:id', component: PaidCoursesSinglePageComponent, canActivate: [StaffRedirectGuard] },
  { path: 'courses-details', component: FreeCoursesSinglePageComponent, canActivate: [StaffRedirectGuard] },
  { path: 'courses-details-2', component: PaidCoursesSinglePageComponent, canActivate: [StaffRedirectGuard] },

  // ✅ Autres pages — staff bloqué
  { path: 'categories', component: CategoriesPageOneComponent, canActivate: [StaffRedirectGuard] },
  { path: 'categories-2', component: CategoriesPageTwoComponent, canActivate: [StaffRedirectGuard] },
  { path: 'courses-category', component: CategoriesCoursesPageComponent, canActivate: [StaffRedirectGuard] },
  { path: 'about-us', component: AboutUsPageComponent, canActivate: [StaffRedirectGuard] },
  { path: 'contact', component: ContactPageOneComponent, canActivate: [StaffRedirectGuard] },
  { path: 'contact-2', component: ContactPageTwoComponent, canActivate: [StaffRedirectGuard] },
  { path: 'recommendations', component: RecommendationsComponent, canActivate: [StaffRedirectGuard] },

  // ✅ Pages privées user — staff bloqué
  { path: 'cart', component: CartPageComponent, canActivate: [AuthGuard, StaffRedirectGuard] },
  { path: 'cv', component: CvPageComponent, canActivate: [AuthGuard, StaffRedirectGuard] },
  { path: 'course/:id', component: CourseViewerComponent, canActivate: [AuthGuard, StaffRedirectGuard] },

  // ✅ Auth — sans restriction (tout le monde peut accéder)
  { path: 'profile-authentication', component: ProfileAuthenticationPageComponent },
  { path: 'forgot-password', component: ForgotPasswordComponent },
  { path: 'reset-password/:token', component: ResetPasswordComponent },

  // ✅ Dashboards — connexion + rôle requis
  {
    path: 'dashboard',
    component: UserDashboardComponent,
    canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['user'] }
  },
  {
    path: 'admin-dashboard',
    component: AdminDashboardComponent,
    canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['admin'] }
  },
  {
    path: 'manager-dashboard',
    component: ManagerDashboardComponent,
    canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['manager'] }
  },
  {
    path: 'trainer-dashboard',
    component: TrainerDashboardComponent,
    canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['trainer'] }
  },

  // ✅ 404 — unknown URLs no longer render a blank page
  { path: '**', component: NotFoundPageComponent }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }