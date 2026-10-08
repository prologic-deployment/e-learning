const {test}=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
process.env.NODE_ENV='test';
process.env.SEED_ALLOW_WRITE='true';
process.env.JWT_SECRET=crypto.randomBytes(48).toString('hex');
process.env.ENCRYPTION_KEY=crypto.randomBytes(32).toString('hex');
process.env.TOTP_ENCRYPTION_KEY=crypto.randomBytes(32).toString('base64');
const mongoose=require('mongoose');
const bcrypt=require('bcrypt');
const {MongoMemoryServer}=require('mongodb-memory-server');
const {seedDatabase,preflight,assertWritable,models}=require('../seeder/seed');
const {validateAssessment,gradeSubmission}=require('../src/utils/assessment');
const {calculateProgress}=require('../src/utils/learningProgress');
const factor=require('../src/services/totp.service');
const express=require('express'),request=require('supertest');

test('Seeder follows current models, preserves account security and cleans ephemeral/legacy records',{timeout:180000},async t=>{
 const mongo=await MongoMemoryServer.create();
 await mongoose.connect(mongo.getUri('seed_contract_test'));
 try{
  await Promise.all(Object.values(models).map(Model=>Model.init()));
  await t.test('validates complete fixture plan and refuses unsafe writes',async()=>{
   assert.deepEqual(preflight(),{users:13,courses:5,lessons:13,assessments:18});
   for(const environment of ['production','preprod','staging']){process.env.NODE_ENV=environment;assert.throws(()=>assertWritable({},'seed_contract_test'),/disabled/);}
   process.env.NODE_ENV='test';process.env.SEED_ALLOW_WRITE='false';assert.throws(()=>assertWritable({},'seed_contract_test'),/SEED_ALLOW_WRITE/);process.env.SEED_ALLOW_WRITE='true';
   await assert.rejects(seedDatabase({fresh:true,confirmDb:'wrong_database'}),/exact connected database/);
   assert.equal(await models.User.countDocuments(),0);
  });
  const summary=await seedDatabase();
  await t.test('creates the current fixture graph with valid embedded assessments',async()=>{
   for(const [name,count] of Object.entries({User:13,Course:5,Lesson:13,Enrollment:9,Purchase:4,Review:5,Certificate:2,Notification:10,CV:3,Cart:1,Badge:13,AssessmentAttempt:0,AuthChallenge:0,Quiz:0,Question:0,QuizResult:0,FinalExam:0}))assert.equal(summary[name],count,name);
   const courses=await models.Course.find().select('+finalExam.questions.correctAnswer +finalExam.questions.correctAnswers');
   for(const course of courses){
    assert.equal(course.isPaid,course.price>0);assert.ok(Array.isArray(course.tags));validateAssessment(course.finalExam);
    const lessons=await models.Lesson.find({course:course._id}).select('+quiz.questions.correctAnswer +quiz.questions.correctAnswers');
    assert.equal(course.lessons.length,lessons.length);
    for(const lesson of lessons){
     const paper=validateAssessment(lesson.quiz);assert.ok(paper.questions.length>=20);if(!course.title.startsWith('API Security'))assert.ok(paper.questions.some(q=>q.type==='multiple'));
     assert.equal(new Set(paper.questions.map(q=>q.texte)).size,paper.questions.length);assert.equal(lesson.quiz2.questions.length,0);
     assert.equal(gradeSubmission(paper.questions,paper.questions.map(q=>q.type==='multiple'?q.correctAnswers:q.correctAnswer)).score,100);
    }
    assert.equal(course.finalExam.questions.length,25);
    if(!course.title.startsWith('API Security'))assert.ok(lessons.some(l=>l.quiz.questions.some(q=>q.timeLimitSeconds>0)));
    const publicCourse=await models.Course.findById(course._id);assert.ok(!JSON.stringify(publicCourse).includes('correctAnswer'));
   }
   for(const enrollment of await models.Enrollment.find()){
    const course=await models.Course.findById(enrollment.course);
    const lessons=await models.Lesson.find({course:course._id});
    const expected=calculateProgress(lessons,enrollment.lessonsCompleted,enrollment.finalExamResult.passed,!!course.finalExam.questions.length);
    assert.equal(enrollment.progress,expected.progress);assert.equal(enrollment.completed,expected.completed);
    if(course.price>0)assert.ok(await models.Purchase.exists({user:enrollment.user,course:course._id,paymentStatus:'paid',amount:course.price}));
    const purchase=await models.Purchase.findOne({user:enrollment.user,course:course._id,paymentStatus:'paid'});
    if(purchase)assert.ok(purchase.createdAt<=enrollment.createdAt);
    assert.ok(course.createdAt<=enrollment.createdAt);
    assert.ok(course.enrolledUsers.some(id=>id.equals(enrollment.user)));
    for(const result of enrollment.quizResults)assert.equal(result.score,100);
   }
   for(const certificate of await models.Certificate.find().populate('user').populate('course')){
    const expected=crypto.createHmac('sha256',process.env.JWT_SECRET).update(`${certificate.serial}|${certificate.user.firstname} ${certificate.user.lastname}|${certificate.course.title}`).digest('hex').substring(0,16).toUpperCase();
    assert.ok(certificate.verificationCode===expected);
    assert.ok(await models.Enrollment.exists({user:certificate.user._id,course:certificate.course._id,completed:true,'finalExamResult.passed':true}));
   }
   const cv=await models.CV.findOne();assert.ok(cv.email.endsWith('@test.com'));assert.ok((await models.CV.collection.findOne({_id:cv._id})).email!==cv.email);
  });
  await t.test('admin approval validates complete seeded papers, role access and hidden answer keys',async()=>{
   const notifications=require('../src/services/notification.service');let notices=0;
   // Isolate external email delivery; the route, authorization, validators and database are real.
   const notify=notifications.notifyNewCourse;notifications.notifyNewCourse=async()=>{notices++;};
   try {
    const app=express();app.use(express.json());app.use('/api/auth',require('../src/routes/auth.routes'));app.use('/api/courses',require('../src/routes/course.routes'));
    const token=async(email,password)=>(await request(app).post('/api/auth/login').send({email,password}).expect(200)).body.token;
    const admin=await token('admin@test.com','Admin123'),trainer=await token('trainer3@test.com','Trainer123'),learner=await token('user1@test.com','User1234');
    const course=await models.Course.findOne({title:'API Security — Authentication and Access Control'}).select('+finalExam.questions.correctAnswer +finalExam.questions.correctAnswers');
    const lesson=await models.Lesson.findOne({course:course._id}).select('+quiz.questions.correctAnswer +quiz.questions.correctAnswers');
    const endpoint='/api/courses/'+course.id+'/approve';
    const approve=(jwt=admin)=>request(app).put(endpoint).auth(jwt,{type:'bearer'}).send({});
    await request(app).put(endpoint).send({}).expect(401);await approve(trainer).expect(403);await approve(learner).expect(403);
    assert.equal((await models.Course.findById(course.id)).isApproved,false);
    await models.Course.collection.updateOne({_id:course._id},{$set:{price:-1}});
    assert.match((await approve().expect(400)).body.message,/Course details/);
    await models.Course.collection.updateOne({_id:course._id},{$set:{price:course.price}});
    await models.Lesson.collection.updateOne({_id:lesson._id},{$set:{'quiz.questions.0.correctAnswer':99}});
    assert.match((await approve().expect(400)).body.message,/Lesson 1/);
    await models.Lesson.collection.updateOne({_id:lesson._id},{$set:{quiz:lesson.quiz.toObject()}});
    await models.Course.collection.updateOne({_id:course._id},{$set:{'finalExam.questions':course.finalExam.questions.slice(0,19)}});
    assert.match((await approve().expect(400)).body.message,/Final exam/);
    await models.Course.collection.updateOne({_id:course._id},{$set:{finalExam:course.finalExam.toObject(),isArchived:true}});
    assert.match((await approve().expect(400)).body.message,/Restore/);
    await models.Course.collection.updateOne({_id:course._id},{$set:{isArchived:false,lessons:[]}});
    assert.match((await approve().expect(400)).body.message,/references/);
    await models.Course.collection.updateOne({_id:course._id},{$set:{lessons:course.lessons}});
    await models.Lesson.collection.updateOne({_id:lesson._id},{$set:{'quiz2.questions':[lesson.quiz.questions[0].toObject()]}});
    assert.match((await approve().expect(400)).body.message,/second quiz/);
    await models.Lesson.collection.updateOne({_id:lesson._id},{$set:{'quiz2.questions':[]}});
    assert.equal((await models.Course.findById(course.id)).isApproved,false);assert.equal(notices,0);
    const result=await approve().expect(200);assert.equal(result.body.course.isApproved,true);assert.equal(JSON.stringify(result.body).includes('correctAnswer'),false);assert.equal(notices,1);
    await approve().expect(200);assert.equal(notices,1,'repeated approval must not re-notify');
    const publicList=await request(app).get('/api/courses').expect(200);assert.ok(JSON.stringify(publicList.body).includes(course.title));assert.equal(JSON.stringify(publicList.body).includes('correctAnswer'),false);
   } finally {notifications.notifyNewCourse=notify;}
  });
  await t.test('seeded admin can configure a real authenticator',async()=>{
   const app=express();app.use(express.json());app.use('/auth',require('../src/routes/auth.routes'));
   const login=await request(app).post('/auth/login').send({email:'admin@test.com',password:'Admin123'}).expect(200);
   const setup=await request(app).post('/auth/two-factor/setup').auth(login.body.token,{type:'bearer'}).send({currentPassword:'Admin123'}).expect(200);
   const enabled=await request(app).post('/auth/two-factor/confirm').auth(login.body.token,{type:'bearer'}).send({setupToken:setup.body.setupToken,code:factor.totp(setup.body.secret).generate()}).expect(200);
   assert.equal(enabled.body.recoveryCodes.length,10);
   const challenge=await request(app).post('/auth/login').send({email:'admin@test.com',password:'Admin123'}).expect(200);
   assert.equal(challenge.body.requiresTwoFactor,true);assert.equal(challenge.body.token,undefined);
  });
  await t.test('reruns preserve passwords, enabled 2FA, sessions and existing progress',async()=>{
   const admin=await models.User.collection.findOne({email:'admin@test.com'});
   const changed=await bcrypt.hash('ChangedFixture123!',10);
   await models.User.updateOne({_id:admin._id},{$set:{password:changed,tokenVersion:7}});
   const before=await models.User.collection.findOne({_id:admin._id});
   const enrollment=await models.Enrollment.findOne();const beforeEnrollment=enrollment.toObject();
   const counts={};for(const Model of Object.values(models))counts[Model.modelName]=await Model.countDocuments();
   assert.deepEqual(await seedDatabase(),counts);
   assert.equal((await models.Course.findOne({title:'API Security — Authentication and Access Control'})).isApproved,true,'reruns preserve admin approval');
   const after=await models.User.collection.findOne({_id:admin._id});
   assert.ok(after.password===before.password);assert.equal(after.tokenVersion,7);assert.ok(JSON.stringify(after.twoFactor)===JSON.stringify(before.twoFactor));
   assert.deepEqual((await models.Enrollment.findById(enrollment._id)).toObject(),beforeEnrollment);
   assert.equal((await models.User.findById(admin._id).select('+twoFactor')).twoFactor.enabled,true);
  });
  await t.test('legacy incomplete papers are preserved, not silently published or padded in the database',async()=>{
   const course=await models.Course.collection.findOne({isApproved:true});
   await models.Course.collection.updateOne({_id:course._id},{$set:{'finalExam.questions':course.finalExam.questions.slice(0,2)}});
   await assert.rejects(seedDatabase(),/existing fixture course is incomplete/);
   const unchanged=await models.Course.collection.findOne({_id:course._id});assert.equal(unchanged.finalExam.questions.length,2);
   const review=await seedDatabase({reviewOnly:true});assert.equal(review.reviewCoursesCreated,0);assert.equal(review.reviewCoursesPreserved,2);
   assert.equal((await models.Course.collection.findOne({_id:course._id})).finalExam.questions.length,2);
   await assert.rejects(seedDatabase({reviewOnly:true,fresh:true,confirmDb:'seed_contract_test'}),/cannot be combined/);

   await models.Course.collection.updateOne({_id:course._id},{$set:{finalExam:course.finalExam}});
  });
  await t.test('confirmed fresh cleans all model collections, then recreates accounts with 2FA off',async()=>{
   // Raw legacy placeholders exercise cleanup without relying on obsolete required schemas.
   for(const name of ['AssessmentAttempt','Quiz','Question','QuizResult','FinalExam'])await models[name].collection.insertOne({legacyFixture:true});
   await mongoose.connection.collection('unrelated_collection').insertOne({preserve:true});
   const result=await seedDatabase({fresh:true,confirmDb:'seed_contract_test',usersOnly:true});assert.equal(result.users,13);
   for(const name of ['AuthChallenge','AssessmentAttempt','Quiz','Question','QuizResult','FinalExam','Course','Lesson','Enrollment'])assert.equal(await models[name].countDocuments(),0,name);
   assert.equal(await mongoose.connection.collection('unrelated_collection').countDocuments(),1);
   for(const user of await models.User.find().select('+password +twoFactor')){assert.equal(user.twoFactor.enabled,false);assert.ok(await bcrypt.compare(user.role.includes('admin')?'Admin123':user.role.includes('manager')?'Manager123':user.role.includes('trainer')?'Trainer123':'User1234',user.password));}
   const review=await seedDatabase({reviewOnly:true});assert.equal(review.reviewCoursesCreated,2);assert.equal(review.reviewCoursesPreserved,0);
   assert.equal(await models.Course.countDocuments({isApproved:false}),2);assert.equal(await models.Lesson.countDocuments(),3);assert.equal(await models.Enrollment.countDocuments(),0);
   const rerun=await seedDatabase({reviewOnly:true});assert.equal(rerun.reviewCoursesCreated,0);assert.equal(rerun.reviewCoursesPreserved,2);

  });
 }finally{await mongoose.disconnect();await mongo.stop();}
});
