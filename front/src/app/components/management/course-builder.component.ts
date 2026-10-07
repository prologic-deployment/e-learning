import {Component,Input,OnInit,DestroyRef,inject,HostListener,ViewChild} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule,NgForm} from '@angular/forms';
import {HttpClient} from '@angular/common/http';
import {ActivatedRoute,Router} from '@angular/router';
import {forkJoin,Observable,Subscription} from 'rxjs';
import {finalize} from 'rxjs/operators';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {UiModule} from '../ui/ui.module';
import {FormFieldComponent} from '../forms/form-field.component';
import {CourseDetailsFormComponent} from './course-details-form.component';
import {AssessmentEditorComponent,newAssessment} from './assessment-editor.component';
import {ToastService} from '../../services/toast.service';
import {environment} from '../../../environments/environment';
@Component({selector:'app-course-builder',standalone:true,imports:[CommonModule,FormsModule,UiModule,FormFieldComponent,CourseDetailsFormComponent,AssessmentEditorComponent],templateUrl:'./course-builder.component.html',styleUrls:['./course-builder.component.scss']})
export class CourseBuilderComponent implements OnInit{
 @ViewChild('lessonForm')lessonForm?:NgForm;
 private loadSubscription?:Subscription;private destroy=inject(DestroyRef);private http=inject(HttpClient);private router=inject(Router);private route=inject(ActivatedRoute);private toast=inject(ToastService);private api=environment.apiUrl;
 loadId='';step=1;steps=['Course details','Lessons','Lesson quizzes','Final exam'];course:any=null;model:any={title:'',description:'',tags:[],price:0,category:''};lessons:any[]=[];loading=false;busy=false;error='';loadError='';selectedLessonId='';lessonId='';lessonModel={title:'',content:''};file:File|null=null;lessonToDelete:any=null;drafts:Record<string,any>={};exam:any=newAssessment();saved='';
 categories=['Development','Business','Finance','IT & Software','Design','Marketing','Data Science'];
 ngOnInit(){this.snapshot();this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroy)).subscribe(params=>{const id=params.get('courseId')||'';if(id!==this.loadId){if(id)this.load(id);else{this.loadSubscription?.unsubscribe();this.loadId='';this.course=null;this.model={title:'',description:'',tags:[],price:0,category:''};this.lessons=[];this.drafts={};this.exam=newAssessment();this.step=1;this.error='';this.loadError='';this.cancelLesson();this.snapshot();}}else{const step=Number(params.get('step'))||1;if(this.allowed(step))this.step=step;}});}
 load(id:string){this.loadSubscription?.unsubscribe();this.loadId=id;this.loading=true;this.loadError='';this.loadSubscription=forkJoin({course:this.http.get<any>(`${this.api}/courses/${id}/full`),lessons:this.http.get<any[]>(`${this.api}/lessons/course/${id}`)}).pipe(takeUntilDestroyed(this.destroy),finalize(()=>this.loading=false)).subscribe({next:data=>{this.course=data.course;this.model={title:data.course.title,description:data.course.description,tags:data.course.tags||[],price:data.course.price,category:data.course.category};this.lessons=data.lessons;this.drafts={};this.lessons.forEach(l=>this.drafts[l._id]=l.quiz?.questions?.length?this.normalized(l.quiz):newAssessment());this.selectedLessonId=this.lessons[0]?._id||'';this.exam=data.course.finalExam?.questions?.length?this.normalized(data.course.finalExam):newAssessment();const requested=Number(this.route.snapshot.queryParamMap.get('step'))||1;this.step=this.allowed(requested)?requested:1;this.snapshot();},error:e=>this.loadError=e.error?.message||'The course could not be loaded. Please retry.'});}
 normalized(a:any){return {...structuredClone(a),questions:a.questions.map((q:any)=>({...structuredClone(q),type:q.type||'single',correctAnswer:q.correctAnswer??-1,correctAnswers:q.correctAnswers||[],timeLimitSeconds:q.timeLimitSeconds||0,points:q.points||1}))};}
 get selectedLesson(){return this.lessons.find(l=>l._id===this.selectedLessonId);}
 get quiz(){return this.drafts[this.selectedLessonId];}
 get readyForExam(){return this.lessons.length>0&&this.lessons.every(l=>l.quiz?.questions?.length>=20&&!l.quiz2?.questions?.length);}
 allowed(step:number){return step===1||(step===2&&!!this.course)||(step===3&&!!this.course&&this.lessons.length>0)||(step===4&&this.readyForExam);}
 go(step:number){if(this.busy||!this.allowed(step))return;this.step=step;this.error='';if(this.course)this.router.navigate([],{relativeTo:this.route,queryParams:{tab:'create',courseId:this.course._id,step},queryParamsHandling:'merge',replaceUrl:true});}
 run<T>(request:Observable<T>,message:string,done:(data:T)=>void){if(this.busy)return;this.busy=true;this.error='';request.pipe(takeUntilDestroyed(this.destroy),finalize(()=>this.busy=false)).subscribe({next:data=>{done(data);this.toast.show(message);},error:e=>{this.error=e.error?.message||'Changes could not be saved. Please retry.';this.toast.show(this.error,'error');}});}
 saveCourse(){const body={...this.model};const request=this.course?this.http.put<any>(`${this.api}/courses/${this.course._id}`,body):this.http.post<any>(`${this.api}/courses`,body);this.run(request,this.course?'Course details saved.':'Course draft created. Add your lessons next.',data=>{this.course={...(this.course||data.course),...body};this.loadId=this.course._id;this.snapshot();this.step=2;this.router.navigate([],{relativeTo:this.route,queryParams:{tab:'create',courseId:this.course._id,step:2},queryParamsHandling:'merge',replaceUrl:true});});}
 saveLesson(){if(!this.lessonModel.title.trim())return;const body=new FormData();body.append('title',this.lessonModel.title.trim());body.append('content',this.lessonModel.content);if(this.file)body.append('contentFile',this.file);const req=this.lessonId?this.http.put<any>(`${this.api}/lessons/${this.lessonId}`,body):this.http.post<any>(`${this.api}/lessons/course/${this.course._id}`,body);this.run(req,this.lessonId?'Lesson updated.':'Lesson added.',data=>{const lesson=data.lesson;if(this.lessonId)this.lessons=this.lessons.map(l=>l._id===this.lessonId?{...l,...lesson}:l);else{this.lessons=[...this.lessons,lesson];this.drafts[lesson._id]=newAssessment();}this.selectedLessonId=lesson._id;this.cancelLesson();this.snapshot();});}
 editLesson(l:any){this.lessonId=l._id;this.lessonModel={title:l.title,content:l.content||''};this.file=null;}
 cancelLesson(){this.lessonId='';this.lessonModel={title:'',content:''};this.file=null;this.lessonForm?.resetForm({title:'',content:''});}
 deleteLesson(){const id=this.lessonToDelete?._id;if(!id)return;this.run(this.http.delete(`${this.api}/lessons/${id}`),'Lesson removed.',()=>{this.lessons=this.lessons.filter(l=>l._id!==id);delete this.drafts[id];this.selectedLessonId=this.lessons[0]?._id||'';if(this.lessonId===id)this.cancelLesson();this.snapshot();});}
 saveQuiz(){const l=this.selectedLesson;const request=l.quiz?.questions?.length?this.http.put(`${this.api}/quiz/lesson/${l._id}`,this.quiz):this.http.post(`${this.api}/quiz/lesson/${l._id}`,this.quiz);this.run(request,'Lesson quiz saved.',()=>{l.quiz=structuredClone(this.quiz);this.snapshot();});}
 removeLegacy(){const lesson=this.selectedLesson;this.run(this.http.delete(`${this.api}/quiz/lesson/${lesson._id}/quiz2/delete`),'Legacy second quiz removed.',()=>{lesson.quiz2={questions:[]};this.snapshot();});}
 saveExam(){this.run(this.http.post(`${this.api}/quiz/final/${this.course._id}`,this.exam),'Final exam saved. The course is ready for review.',()=>{this.course.finalExam=structuredClone(this.exam);this.snapshot();});}
 finish(){this.router.navigate([],{relativeTo:this.route,queryParams:{tab:'courses'}});}
 state(){return JSON.stringify({model:this.model,drafts:this.drafts,exam:this.exam,lesson:this.lessonModel});}snapshot(){this.saved=this.state();}
 @HostListener('window:beforeunload',['$event']) beforeUnload(e:BeforeUnloadEvent){if(this.saved&&this.state()!==this.saved){e.preventDefault();e.returnValue='';}}
}
