/** Explicit non-production fixtures. Normal runs insert missing records, never reset users. */
require('dotenv').config({path:require('node:path').join(__dirname,'../.env'),quiet:true});
const mongoose = require('mongoose');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const config = require('../src/config/env');
const {validateAssessment, gradeSubmission} = require('../src/utils/assessment');
const {calculateProgress} = require('../src/utils/learningProgress');
const USERS = require('./data/users');
const COURSES = require('./data/courses');
const SCENARIOS = require('./data/scenarios');
const CVS = require('./data/cvs');
// Includes session challenges, timed attempts and legacy collections in explicit fresh cleanup.
const models = Object.fromEntries(fs.readdirSync(path.join(__dirname,'../src/models'))
  .filter(name=>name.endsWith('.js')).map(name=>[name.slice(0,-3),require('../src/models/'+name)]));
const {User,Course,Lesson,Enrollment,Purchase,Certificate,Review,Notification,Cart,CV,Badge} = models;
const userDefinitions = [USERS.admin,...USERS.managers,...USERS.trainers,...USERS.learners];
const daysAgo = n => new Date(Date.now()-n*86400000);
const answerKeys = questions => questions.map(q=>q.type==='multiple'?q.correctAnswers:q.correctAnswer);

function preflight() {
  const users = new Map(userDefinitions.map(u=>[u.email,u]));
  const courses = new Map(COURSES.map(c=>[c.title,c]));
  if(users.size!==userDefinitions.length || courses.size!==COURSES.length)throw new Error('Duplicate fixture identifiers.');
  for(const user of userDefinitions){const error=new User(user).validateSync();if(error)throw new Error('User fixture validation failed.');}
  for(const course of COURSES){
    if(!users.get(course.trainerEmail)?.role.includes('trainer'))throw new Error('Fixture course must have a trainer.');
    validateAssessment(course.finalExam);
    const trainer=new mongoose.Types.ObjectId();
    const doc=new Course({...course,trainer,lessons:[]});if(doc.validateSync())throw new Error('Course fixture validation failed.');
    for(const lesson of course.lessons){
      validateAssessment(lesson.quiz);
      if(new Lesson({...lesson,course:doc._id}).validateSync())throw new Error('Lesson fixture validation failed.');
      if(lesson.quiz2?.questions?.length)throw new Error('Only one quiz per lesson is supported.');
    }
  }
  for(const item of [...SCENARIOS.enrollments,...SCENARIOS.reviews]){
    if(!users.get(item.user)?.role.includes('user') || !courses.has(item.course))throw new Error('Invalid activity fixture reference.');
    if(!courses.get(item.course).isApproved)throw new Error('Activity fixtures require a published course.');
  }
  for(const cv of CVS){
    const user=users.get(cv.email);
    if(!user || new CV({...cv,user:new mongoose.Types.ObjectId(),nom:user.lastname,prenom:user.firstname}).validateSync())throw new Error('Invalid CV fixture.');
  }
  for(const team of SCENARIOS.teams){
    if(!users.get(team.manager)?.role.includes('manager') || team.members.some(email=>!users.get(email)?.role.includes('user')))throw new Error('Invalid team fixture.');
  }
  return {users:users.size,courses:courses.size,lessons:COURSES.reduce((sum,c)=>sum+c.lessons.length,0),assessments:COURSES.reduce((sum,c)=>sum+c.lessons.length+1,0)};
}
function assertWritable(options, databaseName) {
  if(!['development','test'].includes(process.env.NODE_ENV || 'development'))throw new Error('Seeding is disabled outside development/test, including production and staging.');
  if(process.env.SEED_ALLOW_WRITE!=='true')throw new Error('Set SEED_ALLOW_WRITE=true explicitly for a disposable development/test database.');
  if(!databaseName || ['admin','config','local'].includes(databaseName))throw new Error('Use an explicit application database name.');
  if(!process.env.JWT_SECRET || !process.env.ENCRYPTION_KEY || process.env.JWT_SECRET!==config.jwtSecret || process.env.ENCRYPTION_KEY!==config.encryptionKey)throw new Error('Persistent JWT_SECRET and ENCRYPTION_KEY are required; seeds contain encrypted fields and signed certificate metadata.');
  if(options.fresh && options.confirmDb!==databaseName)throw new Error('--fresh requires --confirm-db with the exact connected database name.');
}
async function ensure(Model, filter, values) {
  const existing=await Model.findOne(filter);
  return existing || Model.create({...filter,...values});
}
async function award(userId, condition) {
  const badge=await Badge.findOne({condition});if(!badge)throw new Error('Badge definition missing.');
  await User.updateOne({_id:userId,'badges.badge':{$ne:badge._id}},{$push:{badges:{badge:badge._id,earnedAt:daysAgo(2)}}});
}
async function seedDatabase(options={}) {
  preflight();assertWritable(options,mongoose.connection.name);
  if(options.fresh)for(const Model of Object.values(models))await Model.deleteMany({});
  // Fail if badge definitions cannot be initialized; do not swallow setup errors.
  await require('../src/services/badge.service').initBadges();
  const badgeDefinitions=require('../src/services/badge.service').BADGE_DEFINITIONS;
  if(await Badge.countDocuments({condition:{$in:badgeDefinitions.map(b=>b.condition)}})!==badgeDefinitions.length)throw new Error('Built-in badge definitions could not be initialized.');
  const users=new Map(),createdUsers=new Set();
  for(const definition of userDefinitions){
    let user=await User.findOne({email:definition.email});
    if(!user){user=await User.create({...definition,createdAt:daysAgo(90)});createdUsers.add(definition.email);}
    users.set(definition.email,user);
  }
  for(const team of SCENARIOS.teams)for(const email of team.members){
    if(createdUsers.has(email))await User.updateOne({_id:users.get(email)._id},{$set:{manager:users.get(team.manager)._id}});
  }
  if(options.usersOnly)return {users:users.size};
  const courses=new Map();
  for(const definition of COURSES){
    const trainer=users.get(definition.trainerEmail)._id;
    let course=await Course.findOne({title:definition.title,trainer}).select('+isArchived +finalExam.questions.correctAnswer +finalExam.questions.correctAnswers');
    if(!course){
      course=await Course.create({title:definition.title,description:definition.description,tags:definition.tags,
        category:definition.category,price:definition.price,isPaid:definition.price>0,trainer,
        isApproved:false,createdAt:daysAgo(30),finalExam:definition.finalExam});
      const lessons=[];
      for(const lesson of definition.lessons)lessons.push(await Lesson.create({...lesson,course:course._id,createdAt:daysAgo(25)}));
      course.lessons=lessons.map(l=>l._id);
      course.isApproved=definition.isApproved;
      await course.save();
    }
    try {
      validateAssessment(course.finalExam);
      const existingLessons=await Lesson.find({course:course._id}).select('+quiz.questions.correctAnswer +quiz.questions.correctAnswers');
      if(!existingLessons.length || existingLessons.some(l=>l.quiz2?.questions?.length))throw new Error('Incomplete course.');
      for(const lesson of existingLessons)validateAssessment(lesson.quiz);
      if(definition.isApproved && (!course.isApproved || course.isArchived))throw new Error('Course is unavailable.');
    } catch {
      throw new Error('An existing fixture course is incomplete, archived, or unpublished. It was preserved. Edit it through authoring or use --fresh only on a disposable database.');
    }
    courses.set(definition.title,course);
  }
  for(const scenario of SCENARIOS.enrollments){
    const user=users.get(scenario.user),course=courses.get(scenario.course);
    const filter={user:user._id,course:course._id};
    const purchaseScenario=SCENARIOS.purchases.find(p=>p.user===scenario.user && p.course===scenario.course);
    const purchaseAge=purchaseScenario?.daysAgo || 10;
    // Every paid enrollment, including completed/midway scenarios, needs a paid purchase.
    if(course.price>0)await ensure(Purchase,{...filter,paymentStatus:'paid'},{createdAt:daysAgo(purchaseAge),amount:course.price,paymentProvider:'simulated',paymentMethod:'card',paymentReference:`SEED-${user.id}-${course.id}`});
    let enrollment=await Enrollment.findOne(filter);
    if(!enrollment){
      const lessons=await Lesson.find({course:course._id}).select('+quiz.questions.correctAnswer +quiz.questions.correctAnswers').sort({order:1});
      const ratio={completed:1,midway:0.6,'just-started':0,'deadline-soon':0.5,overdue:0.3}[scenario.state];
      if(ratio===undefined)throw new Error('Unknown enrollment fixture state.');
      const completed=lessons.slice(0,Math.floor(lessons.length*ratio));
      const passed=scenario.state==='completed';
      const progress=calculateProgress(lessons,completed.map(l=>l._id),passed,!!course.finalExam?.questions?.length);
      const grade=paper=>gradeSubmission(paper.questions,answerKeys(paper.questions));
      const values={...filter,lessonsCompleted:completed.map(l=>l._id),progress:progress.progress,completed:progress.completed,
        currentLesson:Math.min(completed.length,Math.max(0,lessons.length-1)),
        quizResults:completed.map(l=>({lesson:l._id,score:grade(l.quiz).score,passed:true,attempts:1,completedAt:daysAgo(3)})),
        quizAttemptCounts:completed.map(l=>({lesson:l._id,quizKey:'quiz',count:1})),
        createdAt:daysAgo(Math.min(8,purchaseAge-1))};
      if(passed){values.finalExamResult={score:grade(course.finalExam).score,passed:true,attempts:1,completedAt:daysAgo(2)};values.finalExamAttempts=1;}
      if(scenario.state==='deadline-soon')values.deadline=daysAgo(-2);
      if(scenario.state==='overdue')values.deadline=daysAgo(2);
      enrollment=await Enrollment.create(values);
    }
    await Course.updateOne({_id:course._id},{$addToSet:{enrolledUsers:user._id}});
    await award(user._id,'first_course');
    if(enrollment.completed && enrollment.finalExamResult.passed){
      const serial=`CERT-SEED-${user.id}-${course.id}`;
      const verificationCode=crypto.createHmac('sha256',config.jwtSecret).update(`${serial}|${user.firstname} ${user.lastname}|${course.title}`).digest('hex').substring(0,16).toUpperCase();
      await ensure(Certificate,filter,{trainer:course.trainer,date:daysAgo(2),serial,verificationCode,isValid:true});
      await award(user._id,'first_completed');await award(user._id,'first_certificate');
    }
  }
  for(const review of SCENARIOS.reviews){
    const user=users.get(review.user),course=courses.get(review.course);
    await ensure(Review,{user:user._id,course:course._id},{rating:review.rating,comment:review.comment,isApproved:review.isApproved});
  }
  const course=courses.get(COURSES[0].title);
  const badge=await Badge.findOne({condition:'first_course'});
  for(const definition of USERS.learners.slice(0,4)){
    const user=users.get(definition.email);
    const samples=[
      {type:'NEW_COURSE',title:'New course available',message:`Explore ${course.title}.`,data:{courseId:course._id}},
      {type:'BADGE_EARNED',title:'First course badge earned',message:'You enrolled in your first course.',data:{badgeId:badge._id}},
    ];
    for(const sample of samples)await ensure(Notification,{user:user._id,type:sample.type,title:sample.title},sample);
  }
  // Deadline notifications correspond to actual fixture deadlines, not every learner.
  for(const scenario of SCENARIOS.enrollments.filter(s=>['deadline-soon','overdue'].includes(s.state))){
    const user=users.get(scenario.user),c=courses.get(scenario.course);
    await ensure(Notification,{user:user._id,type:'DEADLINE_REMINDER','data.courseId':c._id},
      {title:scenario.state==='overdue'?'Course deadline missed':'Course deadline approaching',message:`Review your deadline for ${c.title}.`,data:{courseId:c._id}});
  }
  for(const definition of CVS){
    const user=users.get(definition.email);
    await ensure(CV,{user:user._id},{nom:user.lastname,prenom:user.firstname,email:definition.email,telephone:user.phone,
      description:definition.description,competences:definition.competences,experiences:definition.experiences,
      langues:[{langue:'Français',niveau:'Natif'},{langue:'Anglais',niveau:'Avancé'}],hobbies:[{nom:'Open source contribution'}]});
  }
  const cartCourse=courses.get(COURSES.find(c=>c.price>0).title);
  await ensure(Cart,{user:users.get('user7@test.com')._id},{items:[{course:cartCourse._id,price:cartCourse.price}],totalPrice:cartCourse.price});
  const summary={};for(const Model of Object.values(models))summary[Model.modelName]=await Model.countDocuments({});
  return summary;
}
async function main() {
  const args=process.argv.slice(2),options={fresh:args.includes('--fresh'),usersOnly:args.includes('--users')};
  for(let i=0;i<args.length;i++){
    if(args[i]==='--confirm-db'){options.confirmDb=args[++i];if(!options.confirmDb)throw new Error('--confirm-db requires a database name.');}
    else if(!['--fresh','--users','--dry-run'].includes(args[i]))throw new Error('Unknown seeder option.');
  }
  const plan=preflight();
  if(args.includes('--dry-run')){console.log('Dry run: fixtures validated; no database connection or writes.',plan);return;}
  if(!process.env.MONGO_URI)throw new Error('MONGO_URI must explicitly name a disposable database.');
  const databaseName=decodeURIComponent(new URL(process.env.MONGO_URI).pathname.slice(1));
  assertWritable(options,databaseName);
  try{
    await mongoose.connect(process.env.MONGO_URI,{serverSelectionTimeoutMS:5000});
    console.log('Seed complete:',await seedDatabase(options));
    console.log('Synthetic non-production fixtures only. Existing passwords and 2FA were not reset. No passwords or secrets are printed.');
  }finally{await mongoose.disconnect();}
}
if(require.main===module)main().catch(error=>{
  // Driver errors may contain credentials/PII. Log only controlled errors, never documents or URIs.
  if(error.name==='Error' && !/mongodb(?:\+srv)?:\/\//.test(error.message))console.error(error.message);
  else console.error('Seeding failed. Check connectivity, fixture validation and database indexes. No documents or credentials are logged.');
  process.exitCode=1;
});
module.exports={seedDatabase,preflight,assertWritable,models};
