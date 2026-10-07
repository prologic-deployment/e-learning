const daysAgo = n => new Date(Date.now() - n * 86400000);
module.exports = [
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
