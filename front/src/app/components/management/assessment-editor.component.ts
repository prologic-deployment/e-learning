import {Component,Input,Output,EventEmitter,OnChanges,SimpleChanges} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {UiModule} from '../ui/ui.module';
export const blankQuestion=()=>({texte:'',type:'single',options:['','','',''],correctAnswer:-1,correctAnswers:[] as number[],timeLimitSeconds:0,points:1});
export const newAssessment=()=>({questions:Array.from({length:20},blankQuestion),noteMinimale:70,maxAttempts:3});
@Component({selector:'app-assessment-editor',standalone:true,imports:[CommonModule,FormsModule,UiModule],templateUrl:'./assessment-editor.component.html',styleUrls:['./assessment-editor.component.scss']})
export class AssessmentEditorComponent implements OnChanges{
 ngOnChanges(changes:SimpleChanges){if(changes['model']){this.index=0;this.attempted=false;this.validation='';}}
 @Input()model:any=newAssessment();@Input()busy=false;@Input()title='Lesson quiz';@Input()error='';@Output()saveAssessment=new EventEmitter<void>();index=0;attempted=false;validation='';
 get q(){return this.model.questions[Math.min(this.index,this.model.questions.length-1)];}
 issue(q:any){if(!q?.texte?.trim()||q.texte.length>2000)return 'Enter the question text.';if(q.options.length<2||q.options.length>8||q.options.some((o:string)=>!o.trim()||o.length>1000)||new Set(q.options.map((o:string)=>o.trim().toLowerCase())).size!==q.options.length)return 'Enter distinct text for each option.';if(q.type==='multiple'?(q.correctAnswers?.length||0)<2:!Number.isInteger(q.correctAnswer)||q.correctAnswer<0||q.correctAnswer>=q.options.length)return q.type==='multiple'?'Select at least two correct answers.':'Select the correct answer.';if(!Number.isInteger(q.timeLimitSeconds)||(q.timeLimitSeconds!==0&&(q.timeLimitSeconds<10||q.timeLimitSeconds>600)))return 'Use 0 or 10–600 seconds.';if(!Number.isInteger(q.points)||q.points<1||q.points>100)return 'Points must be 1–100.';return '';}
 get complete(){return this.model.questions.filter((q:any)=>!this.issue(q)).length;}
 pick(i:number){if(this.busy)return;this.index=i;this.validation='';}
 selected(i:number){return this.q.type==='multiple'?(this.q.correctAnswers||[]).includes(i):this.q.correctAnswer===i;}
 correct(i:number){if(this.q.type==='multiple'){this.q.correctAnswers=this.selected(i)?this.q.correctAnswers.filter((n:number)=>n!==i):[...(this.q.correctAnswers||[]),i];}else this.q.correctAnswer=i;}
 changeType(){this.q.correctAnswer=-1;this.q.correctAnswers=[];}
 add(){if(this.model.questions.length>=200)return;this.model.questions.push(blankQuestion());this.index=this.model.questions.length-1;}
 removeQuestion(){if(this.model.questions.length<=1)return;this.model.questions.splice(this.index,1);this.index=Math.max(0,this.index-1);}
 removeOption(i:number){if(this.q.options.length<=2)return;this.q.options.splice(i,1);this.q.correctAnswers=(this.q.correctAnswers||[]).filter((n:number)=>n!==i).map((n:number)=>n>i?n-1:n);this.q.correctAnswer=this.q.correctAnswer===i?-1:this.q.correctAnswer>i?this.q.correctAnswer-1:this.q.correctAnswer;}
 trackIndex(i:number){return i;}
 save(){this.attempted=true;this.validation='';if(this.model.questions.length<20||this.model.questions.length>200){this.validation='Use between 20 and 200 complete questions.';return;}const invalid=this.model.questions.findIndex((q:any)=>!!this.issue(q));if(invalid>=0){this.index=invalid;this.validation=`Question ${invalid+1}: ${this.issue(this.q)}`;return;}if(!Number.isInteger(this.model.noteMinimale)||this.model.noteMinimale<1||this.model.noteMinimale>100||!Number.isInteger(this.model.maxAttempts)||this.model.maxAttempts<1||this.model.maxAttempts>20){this.validation='Use a passing score of 1–100 and 1–20 attempts.';return;}if(!this.busy)this.saveAssessment.emit();}
}
