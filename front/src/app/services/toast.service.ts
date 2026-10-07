import {Injectable,signal,inject,NgZone} from '@angular/core';
export type ToastKind='success'|'error'|'info';
export interface ToastMessage{id:number;kind:ToastKind;title:string;message:string;}
@Injectable({providedIn:'root'})
export class ToastService{
 private readonly zone=inject(NgZone);
 readonly messages=signal<ToastMessage[]>([]);private sequence=0;private timers=new Map<number,ReturnType<typeof setTimeout>>();
 show(message:string,kind:ToastKind='success',title=kind==='error'?'Something needs attention':kind==='info'?'Notification':'Changes saved'):void{
  if(!NgZone.isInAngularZone()){this.zone.run(()=>this.show(message,kind,title));return;}
  if(!message?.trim())return;message=message.replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu,'').trim();
  title=title.replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu,'').trim();
  if(this.messages().some(t=>t.message===message&&t.kind===kind))return;
  if(this.messages().length>=4)this.dismiss(this.messages()[0].id);
  const id=++this.sequence;this.messages.update(items=>[...items,{id,kind,title,message}]);this.resume(id);
 }
 dismiss(id:number):void{if(!NgZone.isInAngularZone()){this.zone.run(()=>this.dismiss(id));return;}this.pause(id);this.messages.update(items=>items.filter(t=>t.id!==id));}
 pause(id:number){clearTimeout(this.timers.get(id));this.timers.delete(id);}
 resume(id:number){this.pause(id);this.timers.set(id,setTimeout(()=>this.dismiss(id),7000));}
}
