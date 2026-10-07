/**
 * 📚 Course seed data — courses with lessons, quizzes (answers included,
 * as trainers would submit them) and a final exam.
 *
 * Structure consumed by ../seed.js which creates Lesson docs, wires them into
 * the Course, and embeds the final exam.
 */

const COURSES = [
  {
    title: 'Node.js & Express — API Development Masterclass',
    description:
      'Build production-grade REST APIs with Node.js and Express. Covers routing, middleware, authentication with JWT, error handling, MongoDB with Mongoose, testing and deployment. By the end you will have built and secured a complete API.',
    category: 'Web Development',
    tags: 'nodejs,express,api,mongodb,backend',
    price: 0,
    isApproved: true,
    trainerEmail: 'trainer1@test.com',
    lessons: [
      {
        title: 'Introduction to Node.js',
        content:
          'Node.js is a JavaScript runtime built on Chrome V8. In this lesson we cover the event loop, non-blocking I/O, and why Node excels at I/O-heavy workloads. We install Node, run our first script, and explore the module system (CommonJS and ESM).',
        contentType: 'pdf',
        isFree: true,
        order: 1,
        quiz: {
          noteMinimale: 70,
          maxAttempts: 3,
          questions: [
            {
              texte: 'What runtime is Node.js built on?',
              options: ['V8 from Chrome', 'SpiderMonkey', 'JavaScriptCore', 'Chakra'],
              correctAnswer: 0
            },
            {
              texte: 'Node.js is particularly well suited for…',
              options: ['CPU-heavy computation', 'I/O-heavy workloads', 'Desktop GUI apps', 'Kernel drivers'],
              correctAnswer: 1
            }
          ]
        }
      },
      {
        title: 'Express Fundamentals & Routing',
        content:
          'Express is a minimal web framework. We create an app, define routes with parameters, and organize features with routers. We also cover middleware ordering — the single most common source of bugs.',
        contentType: 'pdf',
        isFree: false,
        order: 2,
        quiz: {
          noteMinimale: 70,
          maxAttempts: 3,
          questions: [
            {
              texte: 'Middleware executes in which order?',
              options: ['Reverse of definition', 'Definition order', 'Random', 'By route priority'],
              correctAnswer: 1
            },
            {
              texte: 'Which object holds request parameters in Express?',
              options: ['req.params', 'req.query', 'req.body', 'req.args'],
              correctAnswer: 0
            },
            {
              texte: 'What does express.json() do?',
              options: ['Serves static files', 'Parses JSON request bodies', 'Enables CORS', 'Compresses responses'],
              correctAnswer: 1
            }
          ]
        }
      },
      {
        title: 'Authentication with JWT',
        content:
          'We implement register/login with bcrypt password hashing, sign JWT access tokens, protect routes with an auth middleware, and discuss token storage strategies and refresh token rotation.',
        contentType: 'pdf',
        isFree: false,
        order: 3,
        quiz: {
          noteMinimale: 70,
          maxAttempts: 3,
          questions: [
            {
              texte: 'Why hash passwords with bcrypt instead of SHA-256?',
              options: ['It is faster', 'It is slower by design (salted, cost factor)', 'SHA-256 is deprecated', 'No reason'],
              correctAnswer: 1
            },
            {
              texte: 'A JWT signature guarantees…',
              options: ['The payload is encrypted', 'The payload was not modified', 'The user is admin', 'The token cannot be stolen'],
              correctAnswer: 1
            }
          ]
        }
      },
      {
        title: 'MongoDB & Mongoose Modeling',
        content:
          'Schemas, models, validation, indexes and relationships (embedding vs referencing). We design an e-commerce data model and practice queries, aggregation and transactions.',
        contentType: 'pdf',
        isFree: false,
        order: 4,
        quiz: {
          noteMinimale: 70,
          maxAttempts: 3,
          questions: [
            {
              texte: 'A Mongoose schema defines…',
              options: ['Database indexes only', 'Document structure, validation and defaults', 'The SQL tables', 'Connection string'],
              correctAnswer: 1
            },
            {
              texte: 'Which method starts a transaction session?',
              options: ['mongoose.transaction()', 'session.startTransaction()', 'db.begin()', 'mongoose.start()'],
              correctAnswer: 1
            }
          ]
        }
      }
    ],
    finalExam: {
      noteMinimale: 70,
      maxAttempts: 3,
      questions: [
        {
          texte: 'What is the main benefit of the event loop?',
          options: ['Automatic scaling', 'Concurrency for I/O without threads', 'Faster CPU math', 'Memory safety'],
          correctAnswer: 1
        },
        {
          texte: 'JWT should be signed with…',
          options: ['A public key', 'A shared secret or private key', 'The user password', 'Nothing'],
          correctAnswer: 1
        },
        {
          texte: 'Best practice for storing user passwords is…',
          options: ['AES encryption', 'bcrypt with per-user salt', 'Base64', 'Plaintext'],
          correctAnswer: 1
        }
      ]
    }
  },

  {
    title: 'Docker & Kubernetes — Containerize Everything',
    description:
      'From zero to production containers. Learn Docker images, layers, volumes and networking, then orchestrate with Kubernetes: pods, deployments, services, ingress, secrets and horizontal scaling. Includes a full CI/CD pipeline example.',
    category: 'Cloud / DevOps',
    tags: 'docker,kubernetes,devops,cloud,ci-cd',
    price: 149,
    isApproved: true,
    trainerEmail: 'trainer2@test.com',
    lessons: [
      {
        title: 'Docker Images & Containers',
        content:
          'Containers package an app with its dependencies. We write Dockerfiles, understand layers and caching, and run multi-container stacks with docker-compose. Best practices: small base images, .dockerignore, non-root users.',
        contentType: 'pdf',
        isFree: true,
        order: 1,
        quiz: {
          noteMinimale: 70,
          maxAttempts: 3,
          questions: [
            {
              texte: 'A Docker image is…',
              options: ['A running process', 'An immutable template of layers', 'A VM snapshot', 'A volume'],
              correctAnswer: 1
            },
            {
              texte: 'Why order Dockerfile commands from least to most frequently changing?',
              options: ['Style', 'To maximize layer cache hits', 'Required by Docker', 'It does not matter'],
              correctAnswer: 1
            }
          ]
        }
      },
      {
        title: 'Kubernetes Pods & Deployments',
        content:
          'Kubernetes schedules containers across a cluster. We define pods, replica sets and deployments with probes, resource requests/limits and rolling updates.',
        contentType: 'pdf',
        isFree: false,
        order: 2,
        quiz: {
          noteMinimale: 70,
          maxAttempts: 3,
          questions: [
            {
              texte: 'What is the smallest deployable unit in Kubernetes?',
              options: ['Container', 'Pod', 'Node', 'Service'],
              correctAnswer: 1
            },
            {
              texte: 'A Deployment ensures…',
              options: ['Network routing', 'Desired replica count and rollout strategy', 'Persistent storage', 'DNS names'],
              correctAnswer: 1
            }
          ]
        }
      },
      {
        title: 'CI/CD Pipeline for Containers',
        content:
          'We build a pipeline: lint, test, build the image, scan vulnerabilities, push to a registry, and deploy with kubectl apply. Includes rollback strategies and environment promotion.',
        contentType: 'pdf',
        isFree: false,
        order: 3,
        quiz: {
          noteMinimale: 70,
          maxAttempts: 3,
          questions: [
            {
              texte: 'Container image scanning should happen…',
              options: ['In production', 'In the pipeline before push', 'Never', 'Only for databases'],
              correctAnswer: 1
            }
          ]
        }
      }
    ],
    finalExam: {
      noteMinimale: 70,
      maxAttempts: 3,
      questions: [
        {
          texte: 'Kubernetes Services provide…',
          options: ['Stable networking for a set of pods', 'CPU limits', 'Image builds', 'Logging'],
          correctAnswer: 0
        },
        {
          texte: 'docker-compose is mainly used for…',
          options: ['Production orchestration', 'Local multi-container development', 'Image scanning', 'Secret management'],
          correctAnswer: 1
        }
      ]
    }
  },

  {
    title: 'Machine Learning Foundations with Python',
    description:
      'A practical introduction to machine learning. Data preparation, linear and logistic regression, decision trees, model evaluation and cross-validation, all in Python with scikit-learn. Ends with a complete end-to-end project.',
    category: 'Data Science',
    tags: 'python,machine-learning,scikit-learn,data-science',
    price: 99,
    isApproved: true,
    trainerEmail: 'trainer3@test.com',
    lessons: [
      {
        title: 'Data Preparation & Exploration',
        content:
          'Garbage in, garbage out. We load datasets with pandas, handle missing values and outliers, encode categorical features and scale numeric ones. We also visualize distributions to guide modeling choices.',
        contentType: 'pdf',
        isFree: true,
        order: 1,
        quiz: {
          noteMinimale: 70,
          maxAttempts: 3,
          questions: [
            {
              texte: 'Why scale features before gradient descent?',
              options: ['To make data positive', 'So features contribute comparably and convergence is faster', 'To remove outliers', 'It is not useful'],
              correctAnswer: 1
            },
            {
              texte: 'One-hot encoding is used for…',
              options: ['Numeric features', 'Categorical features without ordinality', 'Missing values', 'Time series'],
              correctAnswer: 1
            }
          ]
        }
      },
      {
        title: 'Regression & Classification Models',
        content:
          'Linear regression from the least-squares perspective, logistic regression for classification, then trees and ensembles. We train with scikit-learn and interpret coefficients and feature importance.',
        contentType: 'pdf',
        isFree: false,
        order: 2,
        quiz: {
          noteMinimale: 70,
          maxAttempts: 3,
          questions: [
            {
              texte: 'Logistic regression outputs…',
              options: ['A continuous unbounded value', 'A probability via the sigmoid', 'A cluster label', 'A distance'],
              correctAnswer: 1
            },
            {
              texte: 'Overfitting means…',
              options: ['The model is too simple', 'Low train error but poor generalization', 'High bias', 'Data leakage only'],
              correctAnswer: 1
            }
          ]
        }
      },
      {
        title: 'Model Evaluation & Cross-Validation',
        content:
          'Accuracy is not enough. Confusion matrix, precision/recall, F1, ROC-AUC, and k-fold cross-validation. We discuss class imbalance and the right metric for each business problem.',
        contentType: 'pdf',
        isFree: false,
        order: 3,
        quiz: {
          noteMinimale: 70,
          maxAttempts: 3,
          questions: [
            {
              texte: 'High precision means…',
              options: ['Few false positives', 'Few false negatives', 'High recall', 'Many true negatives'],
              correctAnswer: 0
            },
            {
              texte: 'K-fold cross-validation helps to…',
              options: ['Speed up training', 'Get a more reliable estimate of generalization', 'Increase model size', 'Remove outliers'],
              correctAnswer: 1
            }
          ]
        }
      }
    ],
    finalExam: {
      noteMinimale: 70,
      maxAttempts: 3,
      questions: [
        {
          texte: 'Which metric suits an imbalanced fraud dataset best?',
          options: ['Accuracy', 'Precision-recall AUC', 'Mean squared error', 'R²'],
          correctAnswer: 1
        },
        {
          texte: 'Data leakage happens when…',
          options: ['Test information influences training', 'Data is too large', 'Features are numeric', 'Cross-validation is used'],
          correctAnswer: 0
        }
      ]
    }
  },

  {
    title: 'React Fundamentals — Components, Hooks & State',
    description:
      'Modern React from the ground up: functional components, props, useState/useEffect, custom hooks, forms, lists, and thinking in components. Includes a mini-project building a course catalog UI. Pending admin approval — used to test the approval workflow.',
    category: 'Web Development',
    tags: 'react,javascript,frontend,hooks',
    price: 0,
    isApproved: false,
    trainerEmail: 'trainer1@test.com',
    lessons: [
      {
        title: 'Thinking in Components',
        content:
          'Components are functions that return UI. We break a mockup into a component tree, pass data down with props, and lift state up when siblings need to share it.',
        contentType: 'pdf',
        isFree: true,
        order: 1,
        quiz: {
          noteMinimale: 70,
          maxAttempts: 3,
          questions: [
            {
              texte: 'Props are…',
              options: ['Mutable component state', 'Read-only inputs passed from parent', 'Global variables', 'DOM events'],
              correctAnswer: 1
            }
          ]
        }
      },
      {
        title: 'Hooks: useState & useEffect',
        content:
          'Hooks let function components own state and side effects. We cover the dependency array, cleanup functions, and common pitfalls like stale closures.',
        contentType: 'pdf',
        isFree: false,
        order: 2,
        quiz: {
          noteMinimale: 70,
          maxAttempts: 3,
          questions: [
            {
              texte: 'useEffect with [] runs…',
              options: ['On every render', 'Once after mount', 'Never', 'On unmount only'],
              correctAnswer: 1
            }
          ]
        }
      }
    ],
    finalExam: {
      noteMinimale: 70,
      maxAttempts: 3,
      questions: [
        {
          texte: 'Keys in lists help React…',
          options: ['Style items', 'Identify items across renders', 'Sort arrays', 'Fetch data'],
          correctAnswer: 1
        }
      ]
    }
  }
];

module.exports = COURSES.map(require('./assessment-bank').enrichCourse);
