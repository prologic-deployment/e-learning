import {Component,DestroyRef,inject,AfterViewInit,ElementRef} from '@angular/core';
import {CommonModule,ViewportScroller} from '@angular/common';
import {RouterModule,Router,NavigationEnd} from '@angular/router';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {UiModule} from '../../ui/ui.module';
import {BrandComponent} from '../../brand/brand.component';
import {LanguageSwitcherComponent} from '../language-switcher/language-switcher.component';
import {TranslationModule,TranslationService} from '../../../i18n/translation.module';
import {ThemeService} from '../../../services/theme.service';
import {AuthService} from '../../../services/auth.service';
@Component({selector:'app-public-header',standalone:true,imports:[CommonModule,RouterModule,UiModule,BrandComponent,LanguageSwitcherComponent,TranslationModule],templateUrl:'./public-header.component.html',styleUrls:['./public-header.component.scss']})
export class PublicHeaderComponent implements AfterViewInit{
 menuOpen=false;private destroy=inject(DestroyRef);
 constructor(public theme:ThemeService,public auth:AuthService,public i18n:TranslationService,private router:Router,private host:ElementRef,private scroller:ViewportScroller){router.events.pipe(takeUntilDestroyed(this.destroy)).subscribe(e=>{if(e instanceof NavigationEnd)this.menuOpen=false;});}
 get workspace(){const role=this.auth.getRole();return ['admin','trainer','manager'].includes(role)?`/${role}-dashboard`:'/dashboard';}
 ngAfterViewInit(){this.scroller.setOffset(()=>[0,this.host.nativeElement.offsetHeight+16]);}
}
