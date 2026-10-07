import { FormFieldComponent } from "./components/forms/form-field.component";
import { CourseDetailsFormComponent } from './components/management/course-details-form.component';
import { RecordTableComponent } from './components/management/record-table.component';
import { OperationsOverviewComponent } from './components/analytics/operations-overview.component';
import { AssessmentPlayerComponent } from './components/assessments/assessment-player.component';
import { LearningUiModule } from './components/learning/learning-ui.module';
import { WorkspaceShellComponent } from './components/layout/workspace-shell.component';
import { UiModule } from './components/ui/ui.module';

import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { NgxScrollTopModule } from 'ngx-scrolltop';
import { CarouselModule } from 'ngx-owl-carousel-o';
import { MdbTabsModule } from 'mdb-angular-ui-kit/tabs';
import { MdbModalModule } from 'mdb-angular-ui-kit/modal';
import { BrowserModule } from '@angular/platform-browser';
import { MdbCollapseModule } from 'mdb-angular-ui-kit/collapse';
import { MdbAccordionModule } from 'mdb-angular-ui-kit/accordion';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { ElearningSchoolDemoComponent } from './components/pages/elearning-school-demo/elearning-school-demo.component';
import { FooterComponent } from './components/common/footer/footer.component';
import { EsdBannerComponent } from './components/pages/elearning-school-demo/esd-banner/esd-banner.component';
import { FeedbackComponent } from './components/common/feedback/feedback.component';
import { CategoriesComponent } from './components/common/categories/categories.component';
import { CoursesComponent } from './components/common/courses/courses.component';
import { NavbarComponent } from './components/common/navbar/navbar.component';
import { AboutComponent } from './components/common/about/about.component';
import { AboutUsPageComponent } from './components/pages/about-us-page/about-us-page.component';
import { ProfileAuthenticationPageComponent } from './components/pages/profile-authentication-page/profile-authentication-page.component';
import { ForgotPasswordComponent } from './components/pages/forgot-password-page/forgot-password-page.component';
import { CartPageComponent } from './components/pages/cart-page/cart-page.component';
import { ProductDetailsPageComponent } from './components/pages/product-details-page/product-details-page.component';
import { CoursesBasicGridPageComponent } from './components/pages/courses-basic-grid-page/courses-basic-grid-page.component';
import { CoursesModernGridPageComponent } from './components/pages/courses-modern-grid-page/courses-modern-grid-page.component';
import { CoursesWideGridPageComponent } from './components/pages/courses-wide-grid-page/courses-wide-grid-page.component';
import { CoursesLeftSidebarPageComponent } from './components/pages/courses-left-sidebar-page/courses-left-sidebar-page.component';
import { CoursesRightSidebarPageComponent } from './components/pages/courses-right-sidebar-page/courses-right-sidebar-page.component';
import { CoursesListSidebarPageComponent } from './components/pages/courses-list-sidebar-page/courses-list-sidebar-page.component';
import { CoursesSidebarComponent } from './components/common/courses-sidebar/courses-sidebar.component';
import { CategoriesPageOneComponent } from './components/pages/categories-page-one/categories-page-one.component';
import { CategoriesPageTwoComponent } from './components/pages/categories-page-two/categories-page-two.component';
import { CategoriesCoursesPageComponent } from './components/pages/categories-courses-page/categories-courses-page.component';
import { CoursesStartedComponent } from './components/pages/categories-courses-page/courses-started/courses-started.component';
import { LearnCategoriesComponent } from './components/pages/categories-courses-page/learn-categories/learn-categories.component';
import { DevelopmentCoursesComponent } from './components/pages/categories-courses-page/development-courses/development-courses.component';
import { FreeCoursesSinglePageComponent } from './components/pages/free-courses-single-page/free-courses-single-page.component';
import { PaidCoursesSinglePageComponent } from './components/pages/paid-courses-single-page/paid-courses-single-page.component';
import { RelatedCoursesComponent } from './components/common/related-courses/related-courses.component';
import { AuthInterceptor } from './interceptors/auth.interceptor';
import { HttpClientModule, HTTP_INTERCEPTORS } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { AdminDashboardComponent } from './components/pages/dashboard/admin-dashboard/admin-dashboard.component';
import { ManagerDashboardComponent } from './components/pages/dashboard/manager-dashboard/manager-dashboard.component';
import { TrainerDashboardComponent } from './components/pages/dashboard/trainer-dashboard/trainer-dashboard.component';
import { UserDashboardComponent } from './components/pages/dashboard/user-dashboard/user-dashboard.component';
import { CvPageComponent } from './components/pages/cv-page/cv-page.component';
import { CourseViewerComponent } from './components/pages/course-viewer/course-viewer.component';
import { ResetPasswordComponent } from './components/pages/reset-password/reset-password.component';
import { NgModule, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { RoleGuard } from './guards/role.guard';
import { ChatbotComponent } from './components/common/chatbot/chatbot.component';
import { RecommendationsComponent } from './components/pages/recommendations/recommendations.component';
import { SocketService } from './services/socket.service';
import { ContactPageOneComponent } from './components/pages/contact-page-one/contact-page-one.component';
import { ContactPageTwoComponent } from './components/pages/contact-page-two/contact-page-two.component';
import { NotFoundPageComponent } from './components/pages/not-found-page/not-found-page.component';



@NgModule({
    declarations: [
        AppComponent,
        ElearningSchoolDemoComponent,
        FooterComponent,
        EsdBannerComponent,
        FeedbackComponent,
        CategoriesComponent,
        CoursesComponent,
        NavbarComponent,
        AboutComponent,
        AboutUsPageComponent,
        ProfileAuthenticationPageComponent,
        ForgotPasswordComponent,
        CartPageComponent,
        ProductDetailsPageComponent,
        CoursesBasicGridPageComponent,
        CoursesModernGridPageComponent,
        CoursesWideGridPageComponent,
        CoursesLeftSidebarPageComponent,
        CoursesRightSidebarPageComponent,
        CoursesListSidebarPageComponent,
        CoursesSidebarComponent,
        CategoriesPageOneComponent,
        CategoriesPageTwoComponent,
        CategoriesCoursesPageComponent,
        CoursesStartedComponent,
        LearnCategoriesComponent,
        DevelopmentCoursesComponent,
        FreeCoursesSinglePageComponent,
        PaidCoursesSinglePageComponent,
        RelatedCoursesComponent,
        AdminDashboardComponent,
        ManagerDashboardComponent,
        TrainerDashboardComponent,
        CvPageComponent,
        CourseViewerComponent,
        ResetPasswordComponent,
        UserDashboardComponent,
        ChatbotComponent,
        RecommendationsComponent,
        ContactPageOneComponent,
        ContactPageTwoComponent,
        NotFoundPageComponent
    ],
    imports: [
        UiModule,
        FormFieldComponent,
        CourseDetailsFormComponent,
        RecordTableComponent,
        OperationsOverviewComponent,
        AssessmentPlayerComponent,
        LearningUiModule,
        WorkspaceShellComponent,
        CommonModule,
        FormsModule,
        RouterModule,
        MdbTabsModule,
        BrowserModule,
        MdbModalModule,
        CarouselModule,
        AppRoutingModule,
        MdbCollapseModule,
        MdbAccordionModule,
        NgxScrollTopModule,
        BrowserAnimationsModule,
        FormsModule,     
        RouterModule,  
        HttpClientModule 
    ],
    providers: [
        RoleGuard,
        SocketService,
        {
            provide: HTTP_INTERCEPTORS,
            useClass: AuthInterceptor,
            multi: true
        }
    ],
     schemas: [CUSTOM_ELEMENTS_SCHEMA], 
    bootstrap: [AppComponent]
})
export class AppModule { }