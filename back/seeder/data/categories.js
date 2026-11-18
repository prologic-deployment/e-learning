/**
 * 🗂️ Course categories & sub-categories — PRODUCTION reference data.
 *
 * Seeded in every environment (`npm run seed:prod`, and as the first step
 * of `npm run seed:test`). Upserted by name, so re-running updates icons,
 * colours, descriptions and sub-category lists without duplicating.
 *
 * Keep the frontend fallback list (front/src/app/shared/categories.ts) in
 * sync — it is only used when the API cannot be reached.
 */

const CATEGORIES = [
  {
    name: 'Development',
    slug: 'development',
    icon: 'bx bx-code-alt',
    color: '#1E3A8A',
    description: 'Web, mobile & backend',
    subcategories: ['Web Development', 'Mobile Development', 'Backend & APIs', 'Python', 'Java', 'JavaScript / TypeScript']
  },
  {
    name: 'Systems',
    slug: 'systems',
    icon: 'bx bx-server',
    color: '#0B0D12',
    description: 'Linux, Windows Server & virtualization',
    subcategories: ['Linux Administration', 'Windows Server', 'Virtualization', 'Scripting & Automation', 'Storage & Backup']
  },
  {
    name: 'Networking',
    slug: 'networking',
    icon: 'bx bx-network-chart',
    color: '#1E40AF',
    description: 'TCP/IP, routing, switching & CCNA',
    subcategories: ['Network Fundamentals', 'Cisco CCNA', 'Routing & Switching', 'Wireless Networks', 'Network Automation']
  },
  {
    name: 'DevOps',
    slug: 'devops',
    icon: 'bx bx-git-merge',
    color: '#172554',
    description: 'CI/CD, containers & automation',
    subcategories: ['CI/CD', 'Docker', 'Kubernetes', 'Infrastructure as Code', 'Monitoring & Observability']
  },
  {
    name: 'Cloud',
    slug: 'cloud',
    icon: 'bx bx-cloud',
    color: '#1D4ED8',
    description: 'AWS, Azure & Google Cloud',
    subcategories: ['AWS', 'Microsoft Azure', 'Google Cloud', 'Cloud Architecture', 'Serverless']
  },
  {
    name: 'Cybersecurity',
    slug: 'cybersecurity',
    icon: 'bx bx-shield-quarter',
    color: '#111827',
    description: 'Defence, hacking & incident response',
    subcategories: ['Security Fundamentals', 'Ethical Hacking', 'SOC & Incident Response', 'Network Security', 'Compliance & Governance']
  },
  {
    name: 'Data & AI',
    slug: 'data-ai',
    icon: 'bx bx-data',
    color: '#233876',
    description: 'Databases, data engineering & ML',
    subcategories: ['Databases & SQL', 'Data Engineering', 'Machine Learning', 'Data Analytics', 'Generative AI']
  }
].map((c, i) => ({ ...c, order: i + 1, isActive: true }));

module.exports = CATEGORIES;
