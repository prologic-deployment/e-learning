const Attempt=require('../models/AssessmentAttempt'),Lesson=require('../models/Lesson'),Course=require('../models/Course'),Enrollment=require('../models/Enrollment');
const publicState=a=>{const q=a.paper.questions[a.index];return {attemptId:a._id,index:a.index,total:a.paper.questions.length,serverTime:Date.now(),deadline:q?.timeLimitSeconds?new Date(a.questionStartedAt).getTime()+q.timeLimitSeconds*1000:null,question:q?{texte:q.texte,type:q.type||'single',options:q.options,points:q.points,timeLimitSeconds:q.timeLimitSeconds}:null,result:a.result||null};};
async function finish(req,res,a){
 const locked=await Attempt.findOneAndUpdate({_id:a._id,active:true,status:'ready',index:a.paper.questions.length},{$set:{status:'grading'}},{returnDocument:'after'}).select('+paper');
 if(!locked)return res.status(409).json({message:'This attempt is already being processed. Resume it in a moment.'});
 req.body={answers:locked.answers};req.assessmentAttempt={...locked.paper,attemptsUsed:locked.attemptsUsed,startedAt:locked.createdAt};req.params={...req.params,...(locked.kind==='lesson'?{lessonId:String(locked.target)}:{courseId:String(locked.target)})};
 const grade=locked.kind==='lesson'?require('./quiz.controller').submitLessonQuiz:require('./quiz.controller').submitFinalExam;
 let code=200,result;await grade(req,{status(n){code=n;return this;},json(value){result=value;return this;}});
 if(code!==200){await Attempt.updateOne({_id:a._id},{$set:{status:'ready'}});return res.status(code).json(result);}
 await Attempt.updateOne({_id:a._id},{$set:{active:false,status:'finished',result}});res.json({attemptId:a._id,result});
}
exports.start=async(req,res)=>{try{
 await Attempt.init();
 const kind=req.params.kind,target=req.params.targetId;if(!['lesson','final'].includes(kind))return res.status(400).json({message:'Invalid assessment type.'});
 let course,paper;if(kind==='lesson'){const lesson=await Lesson.findById(target).select('+quiz.questions.correctAnswer +quiz.questions.correctAnswers');if(!lesson?.quiz?.questions?.length)return res.status(404).json({message:'Quiz not found.'});course=await Course.findById(lesson.course);paper=lesson.quiz.toObject();}else{course=await Course.findById(target).select('+finalExam.questions.correctAnswer +finalExam.questions.correctAnswers');paper=course?.finalExam?.toObject();}
 if(!course||!paper?.questions?.length)return res.status(404).json({message:'Assessment not found.'});
 const enrollment=await Enrollment.findOne({user:req.user._id,course:course._id});if(!enrollment)return res.status(403).json({message:'Enroll in this course before starting.'});
 if(kind==='final'){const lessons=await Lesson.find({course:course._id});const completed=new Set(enrollment.lessonsCompleted.map(String));if(!lessons.length||lessons.some(l=>(l.quiz?.questions?.length||l.quiz2?.questions?.length)&&!completed.has(String(l._id))))return res.status(403).json({message:'Complete all lesson quizzes before taking the final exam.'});}
 let existing=await Attempt.findOne({user:req.user._id,target,kind,active:true}).select('+paper');if(existing && existing.status!=='ready' && Date.now()-new Date(existing.updatedAt).getTime()>120000){if(existing.status==='preparing'){await Attempt.deleteOne({_id:existing._id,status:'preparing'});existing=null;}else{existing=await Attempt.findOneAndUpdate({_id:existing._id,status:'grading'},{$set:{status:'ready'}},{returnDocument:'after'}).select('+paper');}}
 if(existing){if(existing.status!=='ready')return res.status(409).json({message:'Attempt is being prepared or graded. Try again shortly.'});if(existing.index===existing.paper.questions.length)return finish(req,res,existing);return res.json(publicState(existing));}
 let a;try{a=await Attempt.create({user:req.user._id,course:course._id,target,kind,paper});}catch(e){if(e.code===11000)return res.status(409).json({message:'An attempt was already started. Resume it.'});throw e;}
 let reserved;const max=paper.maxAttempts||3;
 if(kind==='final'){reserved=await Enrollment.findOneAndUpdate({_id:enrollment._id,finalExamAttempts:{$lt:max}},{$inc:{finalExamAttempts:1}},{returnDocument:'after'});a.attemptsUsed=reserved?.finalExamAttempts;}else{
  await Enrollment.updateOne({_id:enrollment._id,quizAttemptCounts:{$not:{$elemMatch:{lesson:target,quizKey:'quiz'}}}},{$push:{quizAttemptCounts:{lesson:target,quizKey:'quiz',count:0}}});
  reserved=await Enrollment.findOneAndUpdate({_id:enrollment._id,quizAttemptCounts:{$elemMatch:{lesson:target,quizKey:'quiz',count:{$lt:max}}}},{$inc:{'quizAttemptCounts.$.count':1}},{returnDocument:'after'});a.attemptsUsed=reserved?.quizAttemptCounts.find(x=>String(x.lesson)===target&&x.quizKey==='quiz')?.count;
 }
 if(!reserved){await Attempt.deleteOne({_id:a._id});return res.status(429).json({message:'Maximum assessment attempts reached.'});}
 a.status='ready';a.questionStartedAt=new Date();await a.save();res.status(201).json(publicState(a));
}catch(e){res.status(500).json({message:'Unable to start the assessment.'});}};
exports.answer=async(req,res)=>{try{
 const a=await Attempt.findOne({_id:req.params.attemptId,user:req.user._id}).select('+paper');if(!a)return res.status(404).json({message:'Attempt not found.'});if(!a.active)return res.json({attemptId:a._id,result:a.result});if(a.status!=='ready')return res.status(409).json({message:'An answer is already being saved.'});
 if(a.index===a.paper.questions.length)return finish(req,res,a);
 if(req.body.index!==a.index)return res.status(409).json({message:'This question was already answered. Resume your attempt.'});
 const q=a.paper.questions[a.index],value=req.body.answer;const valid=n=>Number.isInteger(n)&&n>=0&&n<q.options.length;
 if(value!==null && !(q.type==='multiple'?Array.isArray(value)&&value.every(valid)&&new Set(value).size===value.length:valid(value)))return res.status(400).json({message:'Choose valid answer options.'});
 const expired=q.timeLimitSeconds>0 && Date.now()>new Date(a.questionStartedAt).getTime()+q.timeLimitSeconds*1000;
 const updated=await Attempt.findOneAndUpdate({_id:a._id,active:true,status:'ready',index:a.index},{$set:{['answers.'+a.index]:expired?null:value,questionStartedAt:new Date()},$inc:{index:1}},{returnDocument:'after'}).select('+paper');
 if(!updated)return res.status(409).json({message:'This question was already answered. Resume your attempt.'});
 if(updated.index===updated.paper.questions.length)return finish(req,res,updated);res.json({...publicState(updated),previousExpired:expired});
}catch(e){res.status(500).json({message:'Unable to save this answer. Resume your attempt.'});}};
