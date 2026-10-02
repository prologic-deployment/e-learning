/**
 * 👥 User seed data — admin, managers, trainers, and learners.
 * Passwords are plain here; the seeder lets Mongoose hash them via the
 * `pre("save")` hook on the User model.
 *
 * ⚠️ TEST CREDENTIALS ONLY — never use these passwords in production.
 */

const USERS = {
  admin: {
    firstname: 'Super',
    lastname: 'Admin',
    email: 'admin@test.com',
    dateOfBirth: new Date('1988-03-15'),
    password: 'Admin123',
    role: ['admin'],
    phone: '+21610000001',
    address: 'Tunis, Tunisia',
    isActive: true
  },

  managers: [
    {
      firstname: 'Ahmed',
      lastname: 'Manager',
      email: 'manager1@test.com',
      dateOfBirth: new Date('1985-05-10'),
      password: 'Manager123',
      role: ['manager'],
      phone: '+21620000001',
      address: 'Sousse, Tunisia',
      isActive: true
    },
    {
      firstname: 'Sami',
      lastname: 'Ben Salah',
      email: 'manager2@test.com',
      dateOfBirth: new Date('1982-11-20'),
      password: 'Manager123',
      role: ['manager'],
      phone: '+21620000002',
      address: 'Monastir, Tunisia',
      isActive: true
    }
  ],

  trainers: [
    {
      firstname: 'Nadia',
      lastname: 'Trainer',
      email: 'trainer1@test.com',
      dateOfBirth: new Date('1990-03-12'),
      password: 'Trainer123',
      role: ['trainer'],
      phone: '+21630000001',
      address: 'Nabeul, Tunisia',
      trainerProfile: {
        biographie: 'Senior Full-Stack developer, 8 years of experience building MERN applications for startups and enterprises.',
        specialite: 'MERN Stack',
        experienceTotal: 8,
        disponibilite: true
      },
      isActive: true
    },
    {
      firstname: 'Youssef',
      lastname: 'Mansouri',
      email: 'trainer2@test.com',
      dateOfBirth: new Date('1989-08-22'),
      password: 'Trainer123',
      role: ['trainer'],
      phone: '+21630000002',
      address: 'Sfax, Tunisia',
      trainerProfile: {
        biographie: 'Cloud & DevOps engineer. AWS certified, specializes in Docker, Kubernetes and CI/CD pipelines.',
        specialite: 'Cloud / DevOps',
        experienceTotal: 6,
        disponibilite: true
      },
      isActive: true
    },
    {
      firstname: 'Ines',
      lastname: 'Karoui',
      email: 'trainer3@test.com',
      dateOfBirth: new Date('1992-01-05'),
      password: 'Trainer123',
      role: ['trainer'],
      phone: '+21630000003',
      address: 'Tunis, Tunisia',
      trainerProfile: {
        biographie: 'Data scientist with a background in applied statistics. Loves teaching ML from first principles.',
        specialite: 'Data Science / ML',
        experienceTotal: 5,
        disponibilite: true
      },
      isActive: true
    }
  ],

  learners: [
    {
      firstname: 'Mohamed',
      lastname: 'Ben Ali',
      email: 'user1@test.com',
      dateOfBirth: new Date('1998-01-15'),
      password: 'User1234',
      role: ['user'],
      phone: '+21640000001',
      address: 'Tunis, Tunisia',
      isActive: true,
      apprenantProfile: {
        niveauEducation: 'Bac+3',
        domaineEtude: 'Computer Science',
        objectifApprentissage: 'Become a Full Stack Developer'
      }
    },
    {
      firstname: 'Amira',
      lastname: 'Trabelsi',
      email: 'user2@test.com',
      dateOfBirth: new Date('1999-04-20'),
      password: 'User1234',
      role: ['user'],
      phone: '+21640000002',
      address: 'Sousse, Tunisia',
      isActive: true,
      apprenantProfile: {
        niveauEducation: 'Bac+5',
        domaineEtude: 'Software Engineering',
        objectifApprentissage: 'Learn Node.js and system design'
      }
    },
    {
      firstname: 'Yassine',
      lastname: 'Gharbi',
      email: 'user3@test.com',
      dateOfBirth: new Date('2000-07-10'),
      password: 'User1234',
      role: ['user'],
      phone: '+21640000003',
      address: 'Sfax, Tunisia',
      isActive: true,
      apprenantProfile: {
        niveauEducation: 'Bac+2',
        domaineEtude: 'Networks',
        objectifApprentissage: 'Master backend development'
      }
    },
    {
      firstname: 'Sarra',
      lastname: 'Jlassi',
      email: 'user4@test.com',
      dateOfBirth: new Date('1997-09-28'),
      password: 'User1234',
      role: ['user'],
      phone: '+21640000004',
      address: 'Nabeul, Tunisia',
      isActive: true,
      apprenantProfile: {
        niveauEducation: 'Doctorat',
        domaineEtude: 'Artificial Intelligence',
        objectifApprentissage: 'Learn machine learning in depth'
      }
    },
    {
      firstname: 'Karim',
      lastname: 'Haddad',
      email: 'user5@test.com',
      dateOfBirth: new Date('1996-12-03'),
      password: 'User1234',
      role: ['user'],
      phone: '+21640000005',
      address: 'Bizerte, Tunisia',
      isActive: true,
      apprenantProfile: {
        niveauEducation: 'Bac',
        domaineEtude: 'Information Technology',
        objectifApprentissage: 'Web development career switch'
      }
    },
    {
      firstname: 'Rania',
      lastname: 'Mejri',
      email: 'user6@test.com',
      dateOfBirth: new Date('2001-02-18'),
      password: 'User1234',
      role: ['user'],
      phone: '+21640000006',
      address: 'Ariana, Tunisia',
      isActive: true,
      apprenantProfile: {
        niveauEducation: 'Bac+3',
        domaineEtude: 'Business Intelligence',
        objectifApprentissage: 'Data analysis and dashboards'
      }
    }
    // Note: user7 is teamless on purpose (to test "not in your team" manager rules)
    ,
    {
      firstname: 'Hatem',
      lastname: 'Sassi',
      email: 'user7@test.com',
      dateOfBirth: new Date('1994-06-30'),
      password: 'User1234',
      role: ['user'],
      phone: '+21640000007',
      address: 'Gabes, Tunisia',
      isActive: true,
      apprenantProfile: {
        niveauEducation: 'Bac+5',
        domaineEtude: 'Electrical Engineering',
        objectifApprentissage: 'Explore DevOps practices'
      }
    }
  ]
};

module.exports = USERS;
