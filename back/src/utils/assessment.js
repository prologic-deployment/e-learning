const mongoose=require('mongoose');
const questionSchema=new mongoose.Schema({texte:{type:String,required:true},type:{type:String,enum:['single','multiple'],default:'single'},options:[String],correctAnswer:{type:Number,select:false},correctAnswers:{type:[Number],select:false,default:undefined},points:{type:Number,default:1},timeLimitSeconds:{type:Number,default:0}},{_id:false});
function validateAssessment(body){
 const {questions}=body;
 if(!Array.isArray(questions)||questions.length<20||questions.length>200)throw new Error('An assessment needs between 20 and 200 questions.');
 const normalized=questions.map((q,index)=>{
  const fail=message=>{throw new Error(`Question ${index+1}: ${message}`);};
  if(!q||typeof q.texte!=='string'||!q.texte.trim()||q.texte.length>2000)fail('enter a question (up to 2000 characters).');
  if(!Array.isArray(q.options)||q.options.length<2||q.options.length>8||q.options.some(o=>typeof o!=='string'||!o.trim()||o.length>1000)||new Set(q.options.map(o=>o.trim().toLowerCase())).size!==q.options.length)fail('provide 2–8 distinct, non-empty options.');
  const type=q.type||'single';if(!['single','multiple'].includes(type))fail('choose single or multiple response.');
  const inRange=n=>Number.isInteger(n)&&n>=0&&n<q.options.length;
  if(type==='single'&&!inRange(q.correctAnswer))fail('choose one correct answer.');
  if(type==='multiple'&&(!Array.isArray(q.correctAnswers)||q.correctAnswers.length<2||q.correctAnswers.some(n=>!inRange(n))||new Set(q.correctAnswers).size!==q.correctAnswers.length))fail('choose at least two distinct correct answers.');
  const timeLimitSeconds=q.timeLimitSeconds??0;if(!Number.isInteger(timeLimitSeconds)||(timeLimitSeconds!==0&&(timeLimitSeconds<10||timeLimitSeconds>600)))fail('time limit must be 0 (untimed) or 10–600 seconds.');
  const points=q.points??1;if(!Number.isInteger(points)||points<1||points>100)fail('points must be 1–100.');
  return {texte:q.texte.trim(),type,options:q.options.map(o=>o.trim()),...(type==='multiple'?{correctAnswers:q.correctAnswers}:{correctAnswer:q.correctAnswer}),timeLimitSeconds,points};
 });
 const noteMinimale=body.noteMinimale??70,maxAttempts=body.maxAttempts??3;
 if(!Number.isInteger(noteMinimale)||noteMinimale<1||noteMinimale>100)throw new Error('Passing score must be 1–100.');
 if(!Number.isInteger(maxAttempts)||maxAttempts<1||maxAttempts>20)throw new Error('Attempts must be 1–20.');
 return {questions:normalized,noteMinimale,maxAttempts};
}
function gradeSubmission(questions,answers){let correct=0,earned=0,possible=0;questions.forEach((q,index)=>{const points=q.points||1;possible+=points;let right=false;const a=answers?.[index];if(q.type==='multiple'){right=Array.isArray(a)&&a.length===(q.correctAnswers||[]).length&&new Set(a).size===a.length&&a.every(n=>Number.isInteger(n)&&q.correctAnswers.includes(n));}else{right=Number.isInteger(a)&&a===q.correctAnswer&&a>=0&&a<q.options.length;}if(right){correct++;earned+=points;}});return {correct,total:questions.length,score:possible?Math.round(earned/possible*100):0};}
module.exports={questionSchema,validateAssessment,gradeSubmission};
