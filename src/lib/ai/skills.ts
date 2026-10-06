import type { SkillCategory } from './types';

/**
 * CampusIQ skill taxonomy.
 *
 * The mock analysis engine (and the offline fallback used whenever an external
 * AI provider is unavailable) matches text against this dictionary. Each entry
 * carries the aliases recruiters actually write, a category, and a `demand`
 * weight used when scoring how much a missing skill matters.
 *
 * Swap in GeminiAIService / OpenAIService and this list still acts as the
 * canonical vocabulary for stored skills.
 */
export interface SkillDefinition {
  name: string;
  category: SkillCategory;
  aliases: string[];
  demand: number; // 1 (niche) – 5 (near-universal)
  learn?: string; // short, actionable improvement advice
}

export const SKILL_TAXONOMY: SkillDefinition[] = [
  // ── Programming languages ─────────────────────────────────
  { name: 'Python', category: 'PROGRAMMING_LANGUAGE', aliases: ['python', 'python3', 'py'], demand: 5, learn: 'Build one end-to-end Python project (CLI or API) and push it to GitHub.' },
  { name: 'Java', category: 'PROGRAMMING_LANGUAGE', aliases: ['java', 'core java', 'java se'], demand: 4, learn: 'Write a small Java application using collections, streams and JUnit tests.' },
  { name: 'JavaScript', category: 'PROGRAMMING_LANGUAGE', aliases: ['javascript', 'js', 'ecmascript', 'es6', 'vanilla js'], demand: 5, learn: 'Ship an interactive JavaScript page — DOM, fetch, and async/await.' },
  { name: 'TypeScript', category: 'PROGRAMMING_LANGUAGE', aliases: ['typescript', 'ts'], demand: 4, learn: 'Convert a small JavaScript project to TypeScript with strict mode.' },
  { name: 'C', category: 'PROGRAMMING_LANGUAGE', aliases: [' c ', 'c language', 'ansi c'], demand: 2, learn: 'Practise pointers, memory layout and file I/O in C.' },
  { name: 'C++', category: 'PROGRAMMING_LANGUAGE', aliases: ['c++', 'cpp', 'c plus plus'], demand: 3, learn: 'Solve 20 DSA problems in C++ using the STL.' },
  { name: 'C#', category: 'PROGRAMMING_LANGUAGE', aliases: ['c#', 'csharp', 'c sharp'], demand: 2, learn: 'Build a small .NET console or web app in C#.' },
  { name: 'SQL', category: 'PROGRAMMING_LANGUAGE', aliases: ['sql', 'pl/sql', 'tsql', 't-sql', 'ansi sql'], demand: 5, learn: 'Practise joins, aggregates, window functions and query optimisation.' },
  { name: 'Go', category: 'PROGRAMMING_LANGUAGE', aliases: ['golang', ' go ', 'go language'], demand: 2, learn: 'Write a small HTTP service in Go with the standard library.' },
  { name: 'Rust', category: 'PROGRAMMING_LANGUAGE', aliases: ['rust', 'rustlang'], demand: 1, learn: 'Complete the Rust book’s first ten chapters and a CLI tool.' },
  { name: 'PHP', category: 'PROGRAMMING_LANGUAGE', aliases: ['php'], demand: 2, learn: 'Build a CRUD app in PHP with prepared statements.' },
  { name: 'R', category: 'PROGRAMMING_LANGUAGE', aliases: ['r language', ' r ', 'rscript'], demand: 1, learn: 'Do one data analysis in R with ggplot2.' },
  { name: 'Kotlin', category: 'PROGRAMMING_LANGUAGE', aliases: ['kotlin'], demand: 1, learn: 'Build a small Android screen in Kotlin with Jetpack Compose.' },
  { name: 'Swift', category: 'PROGRAMMING_LANGUAGE', aliases: ['swift'], demand: 1, learn: 'Build a small iOS app in Swift with SwiftUI.' },
  { name: 'HTML', category: 'PROGRAMMING_LANGUAGE', aliases: ['html', 'html5'], demand: 4, learn: 'Learn semantic HTML5 and accessible form markup.' },
  { name: 'CSS', category: 'PROGRAMMING_LANGUAGE', aliases: ['css', 'css3', 'scss', 'sass', 'less'], demand: 4, learn: 'Practise responsive layouts with flexbox and grid.' },
  { name: 'Bash', category: 'PROGRAMMING_LANGUAGE', aliases: ['bash', 'shell scripting', 'shell script', 'sh', 'zsh'], demand: 2, learn: 'Automate one repetitive task with a bash script.' },

  // ── Frameworks & libraries ────────────────────────────────
  { name: 'React', category: 'FRAMEWORK', aliases: ['react', 'reactjs', 'react.js', 'react js'], demand: 5, learn: 'Build a data-driven React app with hooks and routing.' },
  { name: 'Next.js', category: 'FRAMEWORK', aliases: ['next.js', 'nextjs', 'next js'], demand: 3, learn: 'Build a server-rendered Next.js app with API routes.' },
  { name: 'Angular', category: 'FRAMEWORK', aliases: ['angular', 'angularjs', 'angular 2+'], demand: 2, learn: 'Build a small Angular app with services and RxJS.' },
  { name: 'Vue', category: 'FRAMEWORK', aliases: ['vue', 'vuejs', 'vue.js', 'nuxt'], demand: 2, learn: 'Build a Vue 3 app with the composition API.' },
  { name: 'Node.js', category: 'FRAMEWORK', aliases: ['node.js', 'nodejs', 'node js', 'node'], demand: 5, learn: 'Build a REST API in Node.js with authentication.' },
  { name: 'Express', category: 'FRAMEWORK', aliases: ['express', 'express.js', 'expressjs'], demand: 4, learn: 'Structure an Express API with routers, middleware and validation.' },
  { name: 'FastAPI', category: 'FRAMEWORK', aliases: ['fastapi', 'fast api'], demand: 2, learn: 'Wrap a Python model in a FastAPI service with automatic docs.' },
  { name: 'Django', category: 'FRAMEWORK', aliases: ['django', 'drf', 'django rest framework'], demand: 2, learn: 'Build a Django project with models, admin and a REST API.' },
  { name: 'Flask', category: 'FRAMEWORK', aliases: ['flask'], demand: 2, learn: 'Build a small Flask API and deploy it.' },
  { name: 'Spring Boot', category: 'FRAMEWORK', aliases: ['spring boot', 'springboot', 'spring', 'spring framework'], demand: 3, learn: 'Build a Spring Boot service with JPA and security.' },
  { name: 'Hibernate', category: 'FRAMEWORK', aliases: ['hibernate', 'jpa'], demand: 2, learn: 'Map entities with Hibernate and write JPQL queries.' },
  { name: 'ASP.NET', category: 'FRAMEWORK', aliases: ['asp.net', 'asp net', '.net', 'dotnet', '.net core'], demand: 2, learn: 'Build a .NET Web API with Entity Framework.' },
  { name: 'Laravel', category: 'FRAMEWORK', aliases: ['laravel'], demand: 1, learn: 'Build a Laravel CRUD app with Eloquent.' },
  { name: 'Tailwind CSS', category: 'FRAMEWORK', aliases: ['tailwind', 'tailwindcss', 'tailwind css'], demand: 3, learn: 'Rebuild one page with Tailwind utility classes.' },
  { name: 'Redux', category: 'LIBRARY', aliases: ['redux', 'rtk', 'redux toolkit', 'zustand'], demand: 2, learn: 'Manage cross-page state with Redux Toolkit.' },
  { name: 'Pandas', category: 'LIBRARY', aliases: ['pandas'], demand: 3, learn: 'Clean and analyse a real dataset with pandas.' },
  { name: 'NumPy', category: 'LIBRARY', aliases: ['numpy', 'np'], demand: 3, learn: 'Practise vectorised array computing with NumPy.' },
  { name: 'Scikit-learn', category: 'LIBRARY', aliases: ['scikit-learn', 'sklearn', 'scikit learn'], demand: 3, learn: 'Train, evaluate and persist a scikit-learn model.' },
  { name: 'TensorFlow', category: 'LIBRARY', aliases: ['tensorflow', 'keras', 'tf'], demand: 2, learn: 'Train a small neural network with TensorFlow/Keras.' },
  { name: 'PyTorch', category: 'LIBRARY', aliases: ['pytorch', 'torch'], demand: 2, learn: 'Train a small neural network with PyTorch.' },
  { name: 'OpenCV', category: 'LIBRARY', aliases: ['opencv', 'cv2'], demand: 1, learn: 'Add an image-processing demo with OpenCV.' },
  { name: 'JUnit', category: 'LIBRARY', aliases: ['junit', 'testng'], demand: 2, learn: 'Add unit tests to a Java project with JUnit.' },
  { name: 'Jest', category: 'LIBRARY', aliases: ['jest', 'vitest', 'mocha'], demand: 2, learn: 'Write component and unit tests with Jest or Vitest.' },
  { name: 'Selenium', category: 'LIBRARY', aliases: ['selenium', 'cypress', 'playwright', 'puppeteer'], demand: 1, learn: 'Automate one end-to-end browser test.' },

  // ── Databases ─────────────────────────────────────────────
  { name: 'MySQL', category: 'DATABASE', aliases: ['mysql', 'mariadb'], demand: 4, learn: 'Design a normalised MySQL schema and write tuned queries.' },
  { name: 'PostgreSQL', category: 'DATABASE', aliases: ['postgresql', 'postgres', 'psql'], demand: 4, learn: 'Model relations in PostgreSQL and use indexes deliberately.' },
  { name: 'MongoDB', category: 'DATABASE', aliases: ['mongodb', 'mongo', 'mongoose', 'nosql'], demand: 3, learn: 'Build a MongoDB-backed service with aggregation pipelines.' },
  { name: 'SQLite', category: 'DATABASE', aliases: ['sqlite', 'sqlite3'], demand: 1, learn: 'Use SQLite for local persistence in a small app.' },
  { name: 'Redis', category: 'DATABASE', aliases: ['redis', 'memcached'], demand: 2, learn: 'Add caching or a queue to a project with Redis.' },
  { name: 'Firebase', category: 'DATABASE', aliases: ['firebase', 'firestore', 'supabase'], demand: 2, learn: 'Wire Firebase Auth and Firestore into a small app.' },
  { name: 'Oracle', category: 'DATABASE', aliases: ['oracle db', 'oracle database', 'oracle'], demand: 1, learn: 'Practise Oracle SQL and PL/SQL basics.' },
  { name: 'Elasticsearch', category: 'DATABASE', aliases: ['elasticsearch', 'elastic search', 'opensearch'], demand: 1, learn: 'Index and search a dataset with Elasticsearch.' },

  // ── Cloud & DevOps ────────────────────────────────────────
  { name: 'AWS', category: 'CLOUD', aliases: ['aws', 'amazon web services', 'ec2', 's3', 'lambda', 'rds'], demand: 4, learn: 'Deploy one project to AWS (EC2/S3 or Lambda) and document it.' },
  { name: 'Azure', category: 'CLOUD', aliases: ['azure', 'microsoft azure'], demand: 2, learn: 'Deploy a service to Azure App Service.' },
  { name: 'Google Cloud', category: 'CLOUD', aliases: ['gcp', 'google cloud', 'google cloud platform', 'bigquery'], demand: 2, learn: 'Deploy an app to Google Cloud Run.' },
  { name: 'Docker', category: 'TOOL', aliases: ['docker', 'container', 'containerisation', 'containerization', 'dockerfile'], demand: 4, learn: 'Containerise a project with a multi-stage Dockerfile.' },
  { name: 'Kubernetes', category: 'TOOL', aliases: ['kubernetes', 'k8s', 'helm', 'eks', 'gke'], demand: 2, learn: 'Run a containerised app on a local Kubernetes cluster.' },
  { name: 'CI/CD', category: 'TOOL', aliases: ['ci/cd', 'cicd', 'continuous integration', 'continuous delivery', 'jenkins', 'github actions', 'gitlab ci', 'circleci'], demand: 3, learn: 'Add a GitHub Actions pipeline that tests and deploys your project.' },
  { name: 'Terraform', category: 'TOOL', aliases: ['terraform', 'infrastructure as code', 'iac', 'cloudformation'], demand: 1, learn: 'Describe one small infrastructure stack in Terraform.' },
  { name: 'Linux', category: 'PLATFORM', aliases: ['linux', 'ubuntu', 'unix', 'centos', 'debian'], demand: 3, learn: 'Get comfortable with the Linux shell, permissions and systemd.' },
  { name: 'Nginx', category: 'TOOL', aliases: ['nginx', 'apache', 'reverse proxy'], demand: 1, learn: 'Serve an app behind Nginx with TLS.' },

  // ── Tools & practices ─────────────────────────────────────
  { name: 'Git', category: 'TOOL', aliases: ['git', 'github', 'gitlab', 'bitbucket', 'version control'], demand: 5, learn: 'Use branches, pull requests and conventional commits daily.' },
  { name: 'REST APIs', category: 'DOMAIN', aliases: ['rest', 'rest api', 'restful', 'restful api', 'http api', 'web services'], demand: 5, learn: 'Design a documented REST API with proper status codes.' },
  { name: 'GraphQL', category: 'DOMAIN', aliases: ['graphql', 'apollo'], demand: 1, learn: 'Expose a GraphQL API over an existing data model.' },
  { name: 'Microservices', category: 'DOMAIN', aliases: ['microservices', 'micro services', 'distributed systems'], demand: 2, learn: 'Split one feature into two communicating services.' },
  { name: 'Agile', category: 'SOFT_SKILL', aliases: ['agile', 'scrum', 'kanban', 'jira', 'sprint'], demand: 3, learn: 'Run a personal project in two-week sprints with a board.' },
  { name: 'Testing', category: 'DOMAIN', aliases: ['unit testing', 'test driven development', 'tdd', 'integration testing', 'testing'], demand: 3, learn: 'Add a test suite covering your core business logic.' },
  { name: 'System Design', category: 'DOMAIN', aliases: ['system design', 'hld', 'lld', 'architecture', 'scalability'], demand: 2, learn: 'Write a one-page design doc for a system you have built.' },
  { name: 'Data Structures & Algorithms', category: 'DOMAIN', aliases: ['data structures', 'algorithms', 'dsa', 'problem solving', 'competitive programming'], demand: 4, learn: 'Solve problems on arrays, trees, graphs and DP consistently.' },
  { name: 'OOP', category: 'DOMAIN', aliases: ['oop', 'object oriented', 'object-oriented programming', 'solid principles'], demand: 3, learn: 'Apply SOLID principles in one refactor and describe the result.' },

  // ── Data / AI ─────────────────────────────────────────────
  { name: 'Machine Learning', category: 'DOMAIN', aliases: ['machine learning', 'ml', 'supervised learning', 'unsupervised learning', 'predictive modelling', 'predictive modeling'], demand: 3, learn: 'Complete one ML project end to end: data → model → evaluation.' },
  { name: 'Deep Learning', category: 'DOMAIN', aliases: ['deep learning', 'neural networks', 'cnn', 'rnn', 'transformers'], demand: 2, learn: 'Train and evaluate a small neural network on a public dataset.' },
  { name: 'Data Analysis', category: 'DOMAIN', aliases: ['data analysis', 'data analytics', 'analytics', 'eda', 'exploratory data analysis'], demand: 3, learn: 'Publish an EDA notebook with clear findings.' },
  { name: 'Data Visualization', category: 'DOMAIN', aliases: ['data visualization', 'data visualisation', 'tableau', 'power bi', 'powerbi', 'matplotlib', 'seaborn', 'plotly', 'looker', 'd3'], demand: 3, learn: 'Build a dashboard that answers three specific questions.' },
  { name: 'Statistics', category: 'DOMAIN', aliases: ['statistics', 'probability', 'hypothesis testing', 'a/b testing'], demand: 2, learn: 'Refresh descriptive statistics and hypothesis testing.' },
  { name: 'NLP', category: 'DOMAIN', aliases: ['nlp', 'natural language processing', 'llm', 'large language model', 'genai', 'generative ai', 'prompt engineering', 'langchain'], demand: 2, learn: 'Build a small LLM-powered feature and document its evaluation.' },
  { name: 'Big Data', category: 'DOMAIN', aliases: ['big data', 'hadoop', 'spark', 'pyspark', 'kafka', 'airflow', 'etl'], demand: 1, learn: 'Build an ETL pipeline over a large public dataset.' },
  { name: 'Excel', category: 'TOOL', aliases: ['excel', 'ms excel', 'spreadsheets', 'google sheets', 'vba', 'pivot tables'], demand: 2, learn: 'Automate a report with pivot tables and formulas.' },

  // ── Domain / vertical ─────────────────────────────────────
  { name: 'Cybersecurity', category: 'DOMAIN', aliases: ['cybersecurity', 'cyber security', 'information security', 'network security', 'penetration testing', 'ethical hacking', 'owasp'], demand: 2, learn: 'Study the OWASP Top 10 and secure one of your own apps.' },
  { name: 'Networking', category: 'DOMAIN', aliases: ['computer networks', 'networking', 'tcp/ip', 'tcpip', 'routing', 'switching', 'ccna'], demand: 2, learn: 'Revise the TCP/IP stack and configure a small network lab.' },
  { name: 'Operating Systems', category: 'DOMAIN', aliases: ['operating systems', 'os concepts', 'process scheduling', 'concurrency'], demand: 2, learn: 'Revise processes, threads, scheduling and deadlocks.' },
  { name: 'DBMS', category: 'DOMAIN', aliases: ['dbms', 'database management', 'normalization', 'normalisation', 'transactions', 'indexing'], demand: 3, learn: 'Revise normalisation, transactions and indexing.' },
  { name: 'Cloud Native', category: 'DOMAIN', aliases: ['serverless', 'cloud native', 'paas', 'saas'], demand: 1, learn: 'Deploy a serverless function behind an HTTP trigger.' },
  { name: 'IoT', category: 'DOMAIN', aliases: ['iot', 'internet of things', 'embedded systems', 'arduino', 'raspberry pi'], demand: 1, learn: 'Build a small sensor-to-dashboard IoT demo.' },
  { name: 'Mobile Development', category: 'DOMAIN', aliases: ['android', 'ios', 'mobile development', 'react native', 'flutter'], demand: 2, learn: 'Ship one mobile screen with real data binding.' },

  // ── Soft skills ───────────────────────────────────────────
  { name: 'Communication', category: 'SOFT_SKILL', aliases: ['communication', 'verbal communication', 'written communication', 'presentation skills'], demand: 4, learn: 'Add a short demo video or write-up explaining your project.' },
  { name: 'Teamwork', category: 'SOFT_SKILL', aliases: ['teamwork', 'team player', 'collaboration', 'cross-functional'], demand: 4, learn: 'Describe a team project and your specific contribution.' },
  { name: 'Problem Solving', category: 'SOFT_SKILL', aliases: ['problem solving', 'problem-solving', 'analytical thinking', 'critical thinking'], demand: 4, learn: 'Quantify a problem you solved: before, after, impact.' },
  { name: 'Leadership', category: 'SOFT_SKILL', aliases: ['leadership', 'team lead', 'mentoring', 'mentorship'], demand: 2, learn: 'Mention any club, event or team you have led.' },
  { name: 'Time Management', category: 'SOFT_SKILL', aliases: ['time management', 'prioritisation', 'prioritization', 'deadline'], demand: 2, learn: 'Show how you plan work — milestones, sprints, tracking.' },
  { name: 'Adaptability', category: 'SOFT_SKILL', aliases: ['adaptability', 'flexible', 'fast learner', 'quick learner'], demand: 2, learn: 'Give one example of learning a new tool under deadline.' },

  // ── Certifications ────────────────────────────────────────
  { name: 'AWS Certification', category: 'CERTIFICATION', aliases: ['aws certified', 'aws certification', 'aws solutions architect'], demand: 2, learn: 'Consider an AWS Cloud Practitioner certification.' },
  { name: 'Oracle Certification', category: 'CERTIFICATION', aliases: ['ocp', 'oracle certified', 'ocjp'], demand: 1, learn: 'Consider an Oracle Java or SQL certification.' },
  { name: 'Cisco Certification', category: 'CERTIFICATION', aliases: ['ccna', 'ccnp', 'cisco certified'], demand: 1, learn: 'Consider the CCNA if networking roles interest you.' },
  { name: 'Google Certification', category: 'CERTIFICATION', aliases: ['google cloud certified', 'google data analytics certificate', 'google certification'], demand: 1, learn: 'Consider a Google Cloud or Data Analytics certificate.' },
];

const BY_NAME = new Map(SKILL_TAXONOMY.map((s) => [s.name.toLowerCase(), s]));
const BY_ALIAS = new Map<string, SkillDefinition>();
for (const skill of SKILL_TAXONOMY) {
  for (const alias of skill.aliases) BY_ALIAS.set(alias.toLowerCase().trim(), skill);
}

export function lookupSkill(name: string): SkillDefinition | undefined {
  const key = name.toLowerCase().trim();
  return BY_NAME.get(key) ?? BY_ALIAS.get(key);
}

/** Escape a literal for use inside a RegExp. */
export function escapeRegExp(input: string) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Build one combined matcher per skill. Aliases that are already delimited by
 * spaces (e.g. `" c "`) keep that padding so we do not match the letter c
 * inside every word.
 */
export function skillMatcher(skill: SkillDefinition): RegExp {
  const parts = skill.aliases.map((alias) => {
    const trimmed = alias.trim();
    const leadingSpace = alias.startsWith(' ');
    const trailingSpace = alias.endsWith(' ');
    const escaped = escapeRegExp(trimmed).replace(/ /g, '\\s+');
    const left = leadingSpace ? '(?<![a-z0-9])' : '\\b';
    const right = trailingSpace ? '(?![a-z0-9])' : '\\b';
    // `\b` does not work around punctuation such as "c++", so use lookarounds
    // whenever the alias starts or ends with a non-word character.
    const leftBoundary = /^[a-z0-9]/i.test(trimmed) ? left : '(?<![a-z0-9])';
    const rightBoundary = /[a-z0-9]$/i.test(trimmed) ? right : '(?![a-z0-9])';
    return `${leftBoundary}${escaped}${rightBoundary}`;
  });
  return new RegExp(parts.join('|'), 'gi');
}

export const SKILL_CATEGORIES: SkillCategory[] = [
  'PROGRAMMING_LANGUAGE',
  'FRAMEWORK',
  'LIBRARY',
  'TOOL',
  'DATABASE',
  'CLOUD',
  'PLATFORM',
  'DOMAIN',
  'SOFT_SKILL',
  'CERTIFICATION',
];

export const CATEGORY_LABEL: Record<SkillCategory, string> = {
  PROGRAMMING_LANGUAGE: 'Programming languages',
  FRAMEWORK: 'Frameworks',
  LIBRARY: 'Libraries',
  TOOL: 'Tools & DevOps',
  DATABASE: 'Databases',
  CLOUD: 'Cloud platforms',
  PLATFORM: 'Platforms',
  DOMAIN: 'Domain knowledge',
  SOFT_SKILL: 'Soft skills',
  CERTIFICATION: 'Certifications',
};
