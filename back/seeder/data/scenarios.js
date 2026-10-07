/**
 * 🎬 Learner scenarios — who is enrolled where, how far they got, who bought
 * what, who reviewed what, and how managers' teams are composed.
 *
 * Emails reference users defined in users.js; course titles reference courses
 * in courses.js. The orchestrator resolves them to _ids at seed time.
 */

const SCENARIOS = {
  /**
   * Manager → team member assignments (employee email belongs to manager email).
   * user7@test.com is intentionally left without a manager.
   */
  teams: [
    { manager: 'manager1@test.com', members: ['user1@test.com', 'user2@test.com', 'user3@test.com'] },
    { manager: 'manager2@test.com', members: ['user4@test.com', 'user5@test.com', 'user6@test.com'] }
  ],

  /**
   * Enrollments with progress states.
   * progress: 'completed' (passed everything + final exam), 'midway' (some
   * lessons done), 'just-started' (no lessons), 'deadline-soon' (midway with a
   * deadline in 2 days → triggers the reminder cron logic), 'overdue'
   * (deadline in the past, not completed).
   */
  enrollments: [
    // ── Mohamed (user1) — star learner: finished the free Node course, bought Docker
    { user: 'user1@test.com', course: 'Node.js & Express — API Development Masterclass', state: 'completed' },
    { user: 'user1@test.com', course: 'Docker & Kubernetes — Containerize Everything', state: 'deadline-soon', purchase: true },

    // ── Amira (user2) — midway in the free course, bought ML course
    { user: 'user2@test.com', course: 'Node.js & Express — API Development Masterclass', state: 'midway' },
    { user: 'user2@test.com', course: 'Machine Learning Foundations with Python', state: 'just-started', purchase: true },

    // ── Yassine (user3) — just started, overdue deadline (tests manager overdue views)
    { user: 'user3@test.com', course: 'Node.js & Express — API Development Masterclass', state: 'overdue' },

    // ── Sarra (user4) — completed ML course (data-savvy learner)
    { user: 'user4@test.com', course: 'Machine Learning Foundations with Python', state: 'completed' },

    // ── Karim (user5) — midway in Docker (manager2 team)
    { user: 'user5@test.com', course: 'Docker & Kubernetes — Containerize Everything', state: 'midway' },

    // ── Rania (user6) — enrolled free course only
    { user: 'user6@test.com', course: 'Node.js & Express — API Development Masterclass', state: 'midway' },

    // ── Hatem (user7) — teamless learner, just enrolled
    { user: 'user7@test.com', course: 'Node.js & Express — API Development Masterclass', state: 'just-started' }
  ],

  /**
   * Reviews (only for courses the learner is enrolled in; isApproved varies so
   * the moderation queue has content).
   */
  reviews: [
    { user: 'user1@test.com', course: 'Node.js & Express — API Development Masterclass', rating: 5, comment: 'Excellent course! The JWT chapter finally made authentication click for me. Clear explanations and great pacing.', isApproved: true },
    { user: 'user2@test.com', course: 'Node.js & Express — API Development Masterclass', rating: 4, comment: 'Very solid content. Would love more exercises on transactions, but overall highly recommended.', isApproved: true },
    { user: 'user4@test.com', course: 'Machine Learning Foundations with Python', rating: 5, comment: 'The best intro to ML I have taken. The evaluation metrics lesson is worth the price alone.', isApproved: true },
    { user: 'user5@test.com', course: 'Docker & Kubernetes — Containerize Everything', rating: 3, comment: 'Good Docker section, but the Kubernetes part moves fast. Some YAML examples need updating.', isApproved: false },
    { user: 'user6@test.com', course: 'Node.js & Express — API Development Masterclass', rating: 5, comment: 'Pending approval — great course so far, middleware ordering tips saved me hours!', isApproved: false }
  ],

  /**
   * Purchases — payment records for the paid enrollments above.
   */
  purchases: [
    { user: 'user1@test.com', course: 'Docker & Kubernetes — Containerize Everything', daysAgo: 12 },
    { user: 'user2@test.com', course: 'Machine Learning Foundations with Python', daysAgo: 5 },
    { user: 'user4@test.com', course: 'Machine Learning Foundations with Python', daysAgo: 12 },
    { user: 'user5@test.com', course: 'Docker & Kubernetes — Containerize Everything', daysAgo: 10 }
  ]
};

module.exports = SCENARIOS;
