// Explicit synthetic practice material. Each definition is [term, distinguishing description].
// Existing lesson-specific questions are retained; course-wide review items fill each paper to 20.
const { validateAssessment } = require('../../src/utils/assessment');
const banks = {
  node: [
    ['V8', 'the JavaScript engine used by Node.js'],
    ['Event loop', 'the mechanism that schedules callbacks around asynchronous I/O'],
    ['CommonJS', 'the module format that uses require and module.exports'],
    ['ES modules', 'the module format that uses import and export'],
    ['package.json', 'the project manifest declaring scripts and dependencies'],
    ['npm', 'the package manager bundled with standard Node.js distributions'],
    ['Express Router', 'the Express object that groups related route handlers'],
    ['req.params', 'the Express property containing named path parameters'],
    ['req.query', 'the Express property containing parsed URL query values'],
    ['express.json()', 'the Express middleware that parses JSON request bodies'],
    ['next()', 'the Express callback used to pass control to the next middleware'],
    ['HTTP 401', 'the HTTP response status for missing or invalid authentication'],
    ['HTTP 403', 'the HTTP response status for authenticated access being forbidden'],
    ['bcrypt', 'the adaptive salted password-hashing algorithm with a cost factor'],
    ['JWT signature', 'the JWT component that detects payload tampering without encrypting it'],
    ['Mongoose schema', 'the Mongoose definition of document fields and validation'],
    ['MongoDB index', 'the database structure that can accelerate a matching query'],
    ['await', 'the JavaScript keyword that suspends an async function until a promise settles'],
    ['Environment variable', 'a process configuration value supplied outside application source'],
    ['Parameterized validation', 'checking incoming values against explicit type and format constraints'],
  ],
  docker: [
    ['Docker image', 'a layered template used to create containers'],
    ['Docker container', 'a running or stopped instance of a Docker image'],
    ['Dockerfile', 'the file of instructions used to build a Docker image'],
    ['FROM', 'the Dockerfile instruction selecting a base image'],
    ['COPY', 'the Dockerfile instruction copying build-context files into an image'],
    ['RUN', 'the Dockerfile instruction executing a command during image build'],
    ['CMD', 'the Dockerfile instruction defining a default container command'],
    ['Docker volume', 'Docker-managed persistent storage outside the container writable layer'],
    ['Bind mount', 'a host filesystem path mounted directly into a container'],
    ['Container registry', 'a service that stores and distributes container images'],
    ['Image tag', 'a human-readable label referencing an image version'],
    ['Image digest', 'a content-addressed identifier for an image'],
    ['Docker Compose', 'the tool that defines multiple local services in a YAML file'],
    ['Kubernetes Pod', 'the smallest deployable Kubernetes unit containing one or more containers'],
    ['Kubernetes Deployment', 'a Kubernetes controller managing replicated Pods and rollouts'],
    ['Kubernetes Service', 'a stable networking abstraction selecting a set of Pods'],
    ['ConfigMap', 'the Kubernetes resource for non-sensitive configuration data'],
    ['Kubernetes Secret', 'the Kubernetes resource for sensitive configuration, requiring appropriate access controls'],
    ['Readiness probe', 'the check that determines whether a container should receive traffic'],
    ['Liveness probe', 'the check that can trigger restart of an unhealthy container'],
  ],
  ml: [
    ['Supervised learning', 'learning a mapping from examples with known target labels'],
    ['Unsupervised learning', 'finding structure in examples without target labels'],
    ['Classification', 'predicting a discrete category'],
    ['Regression', 'predicting a continuous numeric target'],
    ['Training set', 'the dataset portion used to fit model parameters'],
    ['Validation set', 'the dataset portion used to compare model choices during development'],
    ['Test set', 'the held-out dataset used for final unbiased evaluation'],
    ['Overfitting', 'fitting training-specific noise instead of generalizing'],
    ['Underfitting', 'using a model too limited to capture relevant training patterns'],
    ['Cross-validation', 'evaluation across repeated training and validation partitions'],
    ['Precision', 'the fraction of predicted positives that are truly positive'],
    ['Recall', 'the fraction of actual positives detected by the model'],
    ['F1 score', 'the harmonic mean of precision and recall'],
    ['Confusion matrix', 'the table comparing predicted classes with actual classes'],
    ['Feature scaling', 'transforming numeric input dimensions to comparable scales'],
    ['Data leakage', 'using information during training that would not be available at prediction time'],
    ['Regularization', 'adding constraints or penalties to reduce model complexity'],
    ['Gradient descent', 'iteratively updating parameters in the direction of decreasing loss'],
    ['pandas DataFrame', 'the Python tabular data structure with labeled rows and columns'],
    ['Random seed', 'a value controlling a pseudo-random generator for reproducibility'],
  ],
  react: [
    ['Component', 'a reusable React UI unit typically expressed as a function'],
    ['JSX', 'the syntax extension used to describe React elements in JavaScript'],
    ['Props', 'the read-only inputs passed from a parent to a React child'],
    ['State', 'component-managed data that can trigger a re-render when updated'],
    ['useState', 'the React hook that returns a state value and a setter'],
    ['useEffect', 'the React hook used to synchronize with external systems'],
    ['Effect cleanup', 'a returned effect function used to unsubscribe or dispose resources'],
    ['Dependency array', 'the list controlling when a React effect is re-synchronized'],
    ['Controlled input', 'a form field whose current value is supplied by React state'],
    ['onChange', 'the React input event handler used to respond to value edits'],
    ['List key', 'a stable identity used by React when reconciling sibling list elements'],
    ['Fragment', 'a React grouping element that adds no extra DOM wrapper'],
    ['Lifting state up', 'moving shared state into the nearest common ancestor component'],
    ['useContext', 'the hook used to read a React context value'],
    ['useRef', 'the hook providing a mutable reference whose changes do not trigger re-renders'],
    ['useMemo', 'the hook used to cache a calculation result between renders'],
    ['useCallback', 'the hook used to cache a function identity between renders'],
    ['Immutable update', 'creating a new value rather than mutating existing React state'],
    ['Functional state updater', 'a setter callback computing next state from previous state'],
    ['Conditional rendering', 'choosing which React elements to return based on application state'],
  ],
};
// Extra review concepts allow larger papers without cycling the same bank entries.
banks.node.push(['HTTP 429','the status used when a client exceeds a request rate limit'], ['TLS','the protocol protecting data in transit'], ['Object-level authorization','checking permission for the specific requested record'], ['Idempotency','the property that repeating an operation has the same intended effect'], ['Input allowlist','an explicit set of accepted input fields or values']);
banks.docker.push(['Multi-stage build','a build technique separating build tools from the final image'], ['Resource limit','a configured ceiling for container CPU or memory usage'], ['Non-root user','a container identity without root privileges'], ['Rolling update','gradually replacing running workload replicas'], ['Network policy','rules controlling permitted Kubernetes network traffic']);
banks.ml.push(['Class imbalance','unequal representation of target categories'], ['Hyperparameter','a model configuration chosen outside parameter fitting'], ['Baseline model','a simple reference used to judge improvements'], ['Stratified split','a data split preserving approximate class proportions'], ['Concept drift','a change over time in the relationship between inputs and targets']);
banks.react.push(['Error boundary','a React boundary that handles rendering errors in descendants'], ['Reducer','a function computing next state from current state and an action'], ['Strict Mode','a development aid exposing unsafe component behavior'], ['Lazy initialization','deferring initial state computation until initialization'], ['Accessible name','the text identifying a UI control to assistive technology']);
function paper(existing, bank, label, timed, target = 20) {
  const questions = structuredClone(existing.questions);
  for (let i = 0; questions.length < target; i++) {
    if (!bank[i]) throw new Error('Assessment bank is too small for the requested paper.');
    const [term, description] = bank[i];
    const next = bank[(i + 1) % bank.length];
    const multiple = i % 5 === 4;
    const options = multiple ? [
      `${term}: ${description}`, `${term}: ${next[1]}`,
      `${next[0]}: ${next[1]}`, `${next[0]}: ${description}`,
    ] : [term, ...[1, 2, 3].map(offset => bank[(i + offset) % bank.length][0])];
    const shift = i % options.length;
    const rotated = [...options.slice(shift), ...options.slice(0, shift)];
    const answerIndex = original => (original - shift + options.length) % options.length;
    questions.push({
      texte: multiple ? `${label} — Review ${i + 1}: Select the two correctly matched terms.` : `${label} — Review ${i + 1}: Which term describes ${description}?`,
      type: multiple ? 'multiple' : 'single', options: rotated,
      ...(multiple ? {correctAnswers:[answerIndex(0), answerIndex(2)]} : {correctAnswer:answerIndex(0)}),
      points: multiple ? 2 : 1,
      timeLimitSeconds: timed && i === 0 ? 30 : 0,
    });
  }
  return validateAssessment({...existing, questions});
}
function enrichCourse(course) {
  const topic = course.title.startsWith('Node') ? 'node' : course.title.startsWith('Docker') ? 'docker' : course.title.startsWith('Machine') ? 'ml' : 'react';
  const bank = banks[topic];
  return {...course,
    tags: Array.isArray(course.tags) ? course.tags : course.tags.split(',').map(t=>t.trim()),
    category: topic === 'docker' ? 'IT & Software' : topic === 'ml' ? 'Data Science' : 'Development',
    lessons: course.lessons.map((lesson, i) => ({...lesson, quiz:paper(lesson.quiz, bank, lesson.title, i === 0, 20 + (i % 3) * 2)})),
    finalExam: paper(course.finalExam, bank, 'Final course review', false, 25),
  };
}
module.exports = { enrichCourse };
