/**
 * Course categories — the single source of truth for the whole frontend
 * (header menu, catalogue filters, home page, course pages, trainer/admin
 * course forms). Tech-only taxonomy for Prologic Academy.
 *
 * `icon` is a Boxicons class; `color` is the course-thumbnail background
 * (dark tones from the brand palette, white text stays readable).
 */
export interface CourseCategory {
  name: string;
  icon: string;
  color: string;
  description: string;
  subcategories: string[];
}

export const COURSE_CATEGORIES: CourseCategory[] = [
  {
    name: 'Development',
    icon: 'bx bx-code-alt',
    color: '#1E3A8A',
    description: 'Web, mobile & backend',
    subcategories: ['Web Development', 'Mobile Development', 'Backend & APIs', 'Python', 'Java', 'JavaScript / TypeScript']
  },
  {
    name: 'Systems',
    icon: 'bx bx-server',
    color: '#0B0D12',
    description: 'Linux, Windows Server & virtualization',
    subcategories: ['Linux Administration', 'Windows Server', 'Virtualization', 'Scripting & Automation', 'Storage & Backup']
  },
  {
    name: 'Networking',
    icon: 'bx bx-network-chart',
    color: '#1E40AF',
    description: 'TCP/IP, routing, switching & CCNA',
    subcategories: ['Network Fundamentals', 'Cisco CCNA', 'Routing & Switching', 'Wireless Networks', 'Network Automation']
  },
  {
    name: 'DevOps',
    icon: 'bx bx-git-merge',
    color: '#172554',
    description: 'CI/CD, containers & automation',
    subcategories: ['CI/CD', 'Docker', 'Kubernetes', 'Infrastructure as Code', 'Monitoring & Observability']
  },
  {
    name: 'Cloud',
    icon: 'bx bx-cloud',
    color: '#1D4ED8',
    description: 'AWS, Azure & Google Cloud',
    subcategories: ['AWS', 'Microsoft Azure', 'Google Cloud', 'Cloud Architecture', 'Serverless']
  },
  {
    name: 'Cybersecurity',
    icon: 'bx bx-shield-quarter',
    color: '#111827',
    description: 'Defence, hacking & incident response',
    subcategories: ['Security Fundamentals', 'Ethical Hacking', 'SOC & Incident Response', 'Network Security', 'Compliance & Governance']
  },
  {
    name: 'Data & AI',
    icon: 'bx bx-data',
    color: '#233876',
    description: 'Databases, data engineering & ML',
    subcategories: ['Databases & SQL', 'Data Engineering', 'Machine Learning', 'Data Analytics', 'Generative AI']
  }
];

export const CATEGORY_NAMES: string[] = COURSE_CATEGORIES.map(c => c.name);

const FALLBACK: CourseCategory = {
  name: 'Other',
  icon: 'bx bx-book-open',
  color: '#1E3A8A',
  description: '',
  subcategories: []
};

export function findCategory(name: string | null | undefined): CourseCategory {
  return COURSE_CATEGORIES.find(c => c.name === name) || FALLBACK;
}

export function categoryColor(name: string | null | undefined): string {
  return findCategory(name).color;
}

export function categoryIcon(name: string | null | undefined): string {
  return findCategory(name).icon;
}

export function subcategoriesOf(name: string | null | undefined): string[] {
  return findCategory(name).subcategories;
}
