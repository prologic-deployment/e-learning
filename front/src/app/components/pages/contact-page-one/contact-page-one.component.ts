import {Component} from '@angular/core';
@Component({selector:'app-contact-page-one',templateUrl:'./contact-page-one.component.html',styleUrls:['./contact-page-one.component.scss']})
export class ContactPageOneComponent{
 contactForm={name:'',email:'',subject:'',message:''};draftOpened=false;
 get emailDraft(){return 'mailto:prologic@prologic.com.tn?subject='+encodeURIComponent(this.contactForm.subject.trim()||'FormaPath enquiry')+'&body='+encodeURIComponent(this.contactForm.message+'\n\n'+this.contactForm.name+'\n'+this.contactForm.email);}
 openDraft(){this.draftOpened=true;window.location.href=this.emailDraft;}
}
