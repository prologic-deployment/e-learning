/**
 * 🌱 DATABASE SEEDER — injects consistent, realistic test data.
 *
 * Usage (from back/):
 *   npm run seed              # full seed, keeps existing data (upsert-style)
 *   npm run seed -- --fresh   # WIPE all collections first, then seed
 *   npm run seed -- --users   # users + teams only (fast, for auth testing)
 *
 * ⚠️ Refuses to run when NODE_ENV=production.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const config = require('../src/config/env');

const User = require('../src/models/User');
const Course = require('../src/models/Course');
const Lesson = require('../src/models/Lesson');
const Enrollment = require('../src/models/Enrollment');
const Purchase = require('../src/models/Purchase');
const Review = require('../src/models/Review');
const Certificate = require('../src/models/Certificate');
const Notification = require('../src/models/Notification');
const Cart = require('../src/models/Cart');
const Badge = require('../src/models/Badge');
const CV = require('../src/models/CV');
const { initBadges } = require('../src/services/badge.service');

const USERS = require('./data/users');
const COURSES = require('./data/courses');
const SCENARIOS = require('./data/scenarios');

const args = process.argv.slice(2);
const FRESH = args.includes('--fresh');
const USERS_ONLY = args.includes('--users');

const COLORS = {
  reset: '\x1b[0m', green: '\x1b[32m', red: '\x1b[31m',
  yellow: '\x1b[33m', cyan: '\x1b[36m', dim: '\x1b[2m'
};
const log = (c, m) => console.log(`${c}${m}${COLORS.reset}`);
const step = (m) => log(COLORS.cyan, `  ↳ ${m}`);
const count = (name, n) => log(COLORS.green, `  ✅ ${name}: ${n}`);

// ── helpers ──────────────────────────────────────────────────────────────────

const daysAgo = (n) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);
const daysFromNow = (n) => new Date(Date.now() + n * 24 * 60 * 60 * 1000);

async function connect() {
  await mongoose.connect(process.env.MONGO_URI);
  log(COLORS.dim, `📦 Connected to MongoDB: ${mongoose.connection.name}`);
}

async function wipe() {
  log(COLORS.yellow, '🧹 Wiping collections (--fresh)...');
  const collections = [User, Course, Lesson, Enrollment, Purchase, Review, Certificate, Notification, Cart, CV];
  for (const Model of collections) {
    const r = await Model.deleteMany({});
    step(`${Model.modelName}: ${r.deletedCount} removed`);
  }
  // Badges are re-created right after by initBadges()
  await Badge.deleteMany({});
}

// ── seeders ──────────────────────────────────────────────────────────────────

async function seedUsers() {
  log(COLORS.cyan, '\n👥 Seeding users...');

  const all = [USERS.admin, ...USERS.managers, ...USERS.trainers, ...USERS.learners];
  await User.create(all);
  count('users', all.length);

  // Manager → team assignments
  for (const team of SCENARIOS.teams) {
    const manager = await User.findOne({ email: team.manager });
    for (const memberEmail of team.members) {
      await User.updateOne({ email: memberEmail }, { manager: manager._id });
    }
    step(`team of ${team.manager}: ${team.members.length} members`);
  }

  return all.length;
}

async function seedCourses() {
  log(COLORS.cyan, '\n📚 Seeding courses, lessons, quizzes...');

  for (const def of COURSES) {
    const trainer = await User.findOne({ email: def.trainerEmail });
    if (!trainer) throw new Error(`Trainer not found: ${def.trainerEmail}`);

    // 1. Create the course first (lessons reference it)
    const course = await Course.create({
      title: def.title,
      description: def.description,
      category: def.category,
      tags: def.tags.split(',').map(t => t.trim()),
      price: def.price,
      isApproved: def.isApproved,
      trainer: trainer._id,
      lessons: [],
      finalExam: {
        questions: def.finalExam.questions,
        noteMinimale: def.finalExam.noteMinimale || 70,
        maxAttempts: def.finalExam.maxAttempts || 3
      }
    });

    // 2. Create lessons with quizzes/answers embedded
    const lessonDocs = [];
    for (const l of def.lessons) {
      const lesson = await Lesson.create({
        course: course._id,
        title: l.title,
        content: l.content,
        contentType: l.contentType || 'pdf',
        isFree: l.isFree || false,
        order: l.order,
        quiz: l.quiz
          ? {
              questions: l.quiz.questions,
              noteMinimale: l.quiz.noteMinimale || 70,
              maxAttempts: l.quiz.maxAttempts || 3
            }
          : { questions: [], noteMinimale: 70, maxAttempts: 3 }
      });
      lessonDocs.push(lesson);
    }

    // 3. Wire lessons into the course
    course.lessons = lessonDocs.map(l => l._id);
    await course.save();

    step(`"${def.title}" — ${lessonDocs.length} lessons, price=${def.price}, approved=${def.isApproved}`);
  }

  const n = await Course.countDocuments();
  count('courses', n);
  count('lessons', await Lesson.countDocuments());
  return n;
}

const STATE_COMPLETION = {
  completed: { lessonsRatio: 1, passExam: true },
  midway: { lessonsRatio: 0.6, passExam: false },
  'just-started': { lessonsRatio: 0, passExam: false },
  'deadline-soon': { lessonsRatio: 0.5, passExam: false },
  overdue: { lessonsRatio: 0.3, passExam: false }
};

async function seedEnrollmentsAndActivity() {
  if (USERS_ONLY) return;

  log(COLORS.cyan, '\n🎬 Seeding enrollments, quiz results, purchases, reviews...');

  for (const scenario of SCENARIOS.enrollments) {
    const user = await User.findOne({ email: scenario.user });
    const course = await Course.findOne({ title: scenario.course });
    if (!user || !course) throw new Error(`Scenario ref not found: ${scenario.user} / ${scenario.course}`);

    const cfg = STATE_COMPLETION[scenario.state] || STATE_COMPLETION['just-started'];
    const lessons = await Lesson.find({ course: course._id }).sort({ order: 1 });
    const completedCount = Math.floor(lessons.length * cfg.lessonsRatio);
    const completedLessons = lessons.slice(0, completedCount);

    // ✅ Purchase first when required (enrollment controller logic expects it)
    if (scenario.purchase) {
      await Purchase.create({
        user: user._id,
        course: course._id,
        amount: course.price,
        paymentMethod: 'card',
        paymentStatus: 'paid',
        paymentProvider: 'simulated',
        paymentReference: `SIM-SEED-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        createdAt: daysAgo(10)
      });
    }

    // Quiz results for completed lessons
    const quizResults = [];
    const quizAttemptCounts = [];
    for (const lesson of completedLessons) {
      if (!lesson.quiz?.questions?.length) continue;
      const score = 100;
      quizResults.push({
        lesson: lesson._id,
        score,
        passed: true,
        attempts: 1,
        completedAt: daysAgo(3)
      });
      quizAttemptCounts.push({ lesson: lesson._id, quizKey: 'quiz', count: 1 });
    }

    const enrollment = await Enrollment.create({
      user: user._id,
      course: course._id,
      lessonsCompleted: completedLessons.map(l => l._id),
      quizResults,
      quizAttemptCounts,
      progress: Math.round((completedCount / Math.max(1, lessons.length)) * 100),
      completed: false,
      createdAt: daysAgo(8)
    });

    // Final exam + completion for 'completed' state
    if (cfg.passExam) {
      const total = course.finalExam?.questions?.length || 0;
      enrollment.finalExamResult = {
        score: 85,
        passed: true,
        attempts: 1,
        completedAt: daysAgo(2)
      };
      enrollment.finalExamAttempts = 1;
      enrollment.completed = true;
      enrollment.progress = 100;
      await enrollment.save();

      // ✅ Certificate with HMAC verification code (matches production logic)
      const crypto = require('crypto');
      const serial = `CERT-${new Date().getFullYear()}-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
      const name = `${user.firstname} ${user.lastname}`;
      const verificationCode = crypto
        .createHmac('sha256', process.env.JWT_SECRET || config.jwtSecret)
        .update(`${serial}|${name}|${course.title}`)
        .digest('hex')
        .substring(0, 16)
        .toUpperCase();

      await Certificate.create({
        user: user._id,
        course: course._id,
        trainer: course.trainer,
        date: daysAgo(2),
        certificateUrl: null, // PDF generated on demand in this flow
        serial,
        verificationCode,
        isValid: true
      });
    }

    // Deadlines
    if (scenario.state === 'deadline-soon') {
      enrollment.deadline = daysFromNow(2);
      enrollment.reminderSent = false;
      await enrollment.save();
    } else if (scenario.state === 'overdue') {
      enrollment.deadline = daysAgo(2);
      await enrollment.save();
    }

    step(`${user.email} → "${course.title}" [${scenario.state}]`);
  }

  // Reviews
  for (const r of SCENARIOS.reviews) {
    const user = await User.findOne({ email: r.user });
    const course = await Course.findOne({ title: r.course });
    if (!user || !course) continue;
    await Review.create({
      user: user._id,
      course: course._id,
      rating: r.rating,
      comment: r.comment,
      isApproved: r.isApproved,
      createdAt: daysAgo(4)
    });
  }
  count('reviews', SCENARIOS.reviews.length);
  count('purchases', await Purchase.countDocuments());
  count('certificates', await Certificate.countDocuments());
  count('enrollments', await Enrollment.countDocuments());
}

async function seedNotifications() {
  if (USERS_ONLY) return;
  log(COLORS.cyan, '\n🔔 Seeding notifications...');

  const learners = await User.find({ role: 'user' }).limit(4);
  const course = await Course.findOne({ isApproved: true });

  const samples = [
    { type: 'NEW_COURSE', title: 'Nouveau cours disponible ! 🎓', message: `Le cours "${course?.title}" est maintenant disponible.` },
    { type: 'DEADLINE_REMINDER', title: '⏰ Rappel : 2 jour(s) restant(s)', message: 'Il vous reste 2 jours pour terminer le cours.' },
    { type: 'BADGE_EARNED', title: 'Félicitations ! Badge obtenu 🏅', message: 'Vous avez obtenu le badge "First Step 🎯".' }
  ];

  let n = 0;
  for (const user of learners) {
    for (const s of samples) {
      await Notification.create({
        user: user._id,
        type: s.type,
        title: s.title,
        message: s.message,
        data: course ? { courseId: course._id } : {},
        isRead: n % 2 === 0,
        createdAt: daysAgo(n % 5)
      });
      n++;
    }
  }
  count('notifications', n);
}

async function seedCVs() {
  if (USERS_ONLY) return;
  log(COLORS.cyan, '\n📄 Seeding CVs (feeds the recommender)...');

  const cvData = [
    {
      email: 'user1@test.com',
      description: 'Junior developer transitioning to full-stack. Strong JavaScript fundamentals, looking to master backend architecture.',
      competences: [
        { nom: 'JavaScript', niveau: 'Intermédiaire' },
        { nom: 'Node.js', niveau: 'Débutant' },
        { nom: 'HTML/CSS', niveau: 'Avancé' }
      ],
      experiences: [{ titre: 'Web Developer Intern', entreprise: 'TechCorp', dateDebut: daysAgo(400), description: 'Built landing pages and internal tools.' }]
    },
    {
      email: 'user2@test.com',
      description: 'Backend engineer focused on API design. Wants to strengthen system design and data skills.',
      competences: [
        { nom: 'Node.js', niveau: 'Avancé' },
        { nom: 'MongoDB', niveau: 'Intermédiaire' },
        { nom: 'Docker', niveau: 'Débutant' }
      ],
      experiences: [{ titre: 'Backend Developer', entreprise: 'DataSoft', dateDebut: daysAgo(700), description: 'Maintained production APIs serving 50k users.' }]
    },
    {
      email: 'user4@test.com',
      description: 'PhD candidate in AI. Comfortable with Python and statistics, seeking applied ML engineering skills.',
      competences: [
        { nom: 'Python', niveau: 'Expert' },
        { nom: 'Machine Learning', niveau: 'Avancé' },
        { nom: 'pandas', niveau: 'Avancé' }
      ],
      experiences: [{ titre: 'Research Assistant', entreprise: 'University Lab', dateDebut: daysAgo(900), description: 'Published work on NLP models.' }]
    }
  ];

  for (const c of cvData) {
    const user = await User.findOne({ email: c.email });
    if (!user) continue;
    await CV.create({
      user: user._id,
      nom: user.lastname,
      prenom: user.firstname,
      email: c.email, // encrypted automatically by the schema setter
      telephone: user.phone,
      description: c.description,
      competences: c.competences,
      experiences: c.experiences,
      formations: [],
      certifications: [],
      langues: [{ langue: 'Français', niveau: 'Natif' }, { langue: 'Anglais', niveau: 'Avancé' }],
      hobbies: [{ nom: 'Open source contribution' }]
    });
  }
  count('CVs', await CV.countDocuments());
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n' + '═'.repeat(60));
  log(COLORS.cyan, '🌱 E-LEARNING DATABASE SEEDER');
  console.log('═'.repeat(60));

  if (config.isProd) {
    log(COLORS.red, '\n🚫 REFUSING to seed: NODE_ENV=production.');
    process.exit(1);
  }

  if (FRESH) log(COLORS.yellow, 'Mode: FRESH (all collections wiped first)');
  if (USERS_ONLY) log(COLORS.yellow, 'Mode: USERS ONLY (auth testing)');

  try {
    await connect();

    if (FRESH) await wipe();

    log(COLORS.yellow, '\n🏅 Initializing badges...');
    await initBadges();
    count('badges', await Badge.countDocuments());

    await seedUsers();

    if (!USERS_ONLY) {
      await seedCourses();
      await seedEnrollmentsAndActivity();
      await seedNotifications();
      await seedCVs();
    }

    console.log('\n' + '═'.repeat(60));
    log(COLORS.green, '✅ SEED COMPLETE\n');
    log(COLORS.dim, 'Test accounts (password shown after each email):');
    log(COLORS.dim, '  admin@test.com        Admin123     → full admin');
    log(COLORS.dim, '  manager1@test.com     Manager123   → team of 3 learners');
    log(COLORS.dim, '  manager2@test.com     Manager123   → team of 3 learners');
    log(COLORS.dim, '  trainer1@test.com     Trainer123   → Node + React courses');
    log(COLORS.dim, '  trainer2@test.com     Trainer123   → Docker course (paid)');
    log(COLORS.dim, '  trainer3@test.com     Trainer123   → ML course (paid)');
    log(COLORS.dim, '  user1@test.com        User1234     → completed course + certificate');
    log(COLORS.dim, '  user3@test.com        User1234     → overdue deadline (manager alert)');
    log(COLORS.dim, '  user7@test.com        User1234     → teamless learner');
    console.log('═'.repeat(60) + '\n');
  } catch (error) {
    log(COLORS.red, `\n❌ Seed failed: ${error.message}`);
    console.error(error);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
  }
}

main();
