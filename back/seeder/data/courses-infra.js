/**
 * 🖥️ Infrastructure & security courses — Systems, Networking, Cybersecurity.
 * Same structure as courses.js (lessons with quizzes + final exam).
 */

const INFRA_COURSES = [
  {
    title: 'Linux System Administration Essentials',
    description:
      'Administer Linux servers with confidence: the filesystem hierarchy, users and permissions, packages, services with systemd, logs, and shell scripting to automate routine tasks. Hands-on with Ubuntu Server and RHEL-family distributions.',
    category: 'Systems',
    subCategory: 'Linux Administration',
    tags: 'linux,bash,systemd,sysadmin,ubuntu',
    price: 79,
    isApproved: true,
    trainerEmail: 'trainer2@test.com',
    lessons: [
      {
        title: 'The Linux Filesystem & Shell',
        content:
          'We tour the filesystem hierarchy (/etc, /var, /home, /usr), navigate with the shell, and use pipes and redirection. You will learn why "everything is a file" and how to find your way around any server.',
        contentType: 'pdf',
        isFree: true,
        order: 1,
        quiz: {
          noteMinimale: 70,
          maxAttempts: 3,
          questions: [
            {
              texte: 'Which directory holds system-wide configuration files?',
              options: ['/etc', '/var', '/home', '/bin'],
              correctAnswer: 0
            },
            {
              texte: 'What does the | (pipe) operator do?',
              options: ['Runs commands in parallel', 'Sends one command output to another command input', 'Writes output to a file', 'Runs a command as root'],
              correctAnswer: 1
            }
          ]
        }
      },
      {
        title: 'Users, Groups & Permissions',
        content:
          'Create users and groups, read and change permissions with chmod and chown, and grant limited admin rights with sudo. We cover the rwx model, numeric modes and the special bits.',
        contentType: 'pdf',
        isFree: false,
        order: 2,
        quiz: {
          noteMinimale: 70,
          maxAttempts: 3,
          questions: [
            {
              texte: 'chmod 640 gives the group which rights?',
              options: ['Read and write', 'Read only', 'Execute only', 'No rights'],
              correctAnswer: 1
            },
            {
              texte: 'Which file defines who may use sudo?',
              options: ['/etc/passwd', '/etc/sudoers', '/etc/shadow', '/etc/hosts'],
              correctAnswer: 1
            }
          ]
        }
      },
      {
        title: 'Services with systemd & Logs',
        content:
          'Start, stop and enable services with systemctl, write a simple unit file, and investigate problems with journalctl. We finish with log rotation and basic monitoring.',
        contentType: 'pdf',
        isFree: false,
        order: 3,
        quiz: {
          noteMinimale: 70,
          maxAttempts: 3,
          questions: [
            {
              texte: 'Which command makes a service start at boot?',
              options: ['systemctl start', 'systemctl enable', 'systemctl reload', 'service boot'],
              correctAnswer: 1
            },
            {
              texte: 'Which tool reads the systemd journal?',
              options: ['dmesg', 'journalctl', 'tail', 'logrotate'],
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
          texte: 'Where are user password hashes stored?',
          options: ['/etc/passwd', '/etc/shadow', '/etc/group', '/root/.passwords'],
          correctAnswer: 1
        },
        {
          texte: 'What does "systemctl status nginx" show?',
          options: ['The nginx config', 'The service state and recent logs', 'Open ports', 'Installed packages'],
          correctAnswer: 1
        },
        {
          texte: 'Least privilege means…',
          options: ['Everyone uses root', 'Give only the rights a task needs', 'Disable all users', 'Use one shared account'],
          correctAnswer: 1
        }
      ]
    }
  },

  {
    title: 'Networking Fundamentals & CCNA Prep',
    description:
      'Understand how networks really work: the OSI and TCP/IP models, IPv4 addressing and subnetting, switching, routing and VLANs. Prepares you for the Cisco CCNA with practical labs on real topologies.',
    category: 'Networking',
    subCategory: 'Cisco CCNA',
    tags: 'networking,ccna,tcp-ip,subnetting,cisco',
    price: 119,
    isApproved: true,
    trainerEmail: 'trainer2@test.com',
    lessons: [
      {
        title: 'OSI & TCP/IP Models',
        content:
          'We map the seven OSI layers to the four TCP/IP layers and follow a packet from a browser to a server. You will learn which devices and protocols live at which layer.',
        contentType: 'pdf',
        isFree: true,
        order: 1,
        quiz: {
          noteMinimale: 70,
          maxAttempts: 3,
          questions: [
            {
              texte: 'At which OSI layer do routers operate?',
              options: ['Layer 2 — Data link', 'Layer 3 — Network', 'Layer 4 — Transport', 'Layer 7 — Application'],
              correctAnswer: 1
            },
            {
              texte: 'TCP provides…',
              options: ['Unreliable datagrams', 'Reliable, ordered delivery', 'IP addressing', 'Physical signalling'],
              correctAnswer: 1
            }
          ]
        }
      },
      {
        title: 'IPv4 Addressing & Subnetting',
        content:
          'Binary, masks and CIDR notation. We subnet networks by hand, calculate usable hosts, and plan an addressing scheme for a small company.',
        contentType: 'pdf',
        isFree: false,
        order: 2,
        quiz: {
          noteMinimale: 70,
          maxAttempts: 3,
          questions: [
            {
              texte: 'How many usable hosts does a /24 network have?',
              options: ['256', '254', '255', '252'],
              correctAnswer: 1
            },
            {
              texte: 'The mask 255.255.255.192 is written in CIDR as…',
              options: ['/24', '/25', '/26', '/27'],
              correctAnswer: 2
            }
          ]
        }
      },
      {
        title: 'Switching, VLANs & Routing',
        content:
          'How switches learn MAC addresses, why we segment with VLANs, and how routers move traffic between networks with static and dynamic (OSPF) routes.',
        contentType: 'pdf',
        isFree: false,
        order: 3,
        quiz: {
          noteMinimale: 70,
          maxAttempts: 3,
          questions: [
            {
              texte: 'A VLAN is used to…',
              options: ['Increase cable length', 'Split one switch into separate broadcast domains', 'Encrypt traffic', 'Assign IP addresses'],
              correctAnswer: 1
            },
            {
              texte: 'OSPF is a…',
              options: ['Link-state routing protocol', 'Distance-vector protocol', 'Switching protocol', 'DNS protocol'],
              correctAnswer: 0
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
          texte: 'Which protocol resolves an IP address to a MAC address?',
          options: ['DNS', 'ARP', 'DHCP', 'ICMP'],
          correctAnswer: 1
        },
        {
          texte: '192.168.1.130/26 belongs to which subnet?',
          options: ['192.168.1.0', '192.168.1.64', '192.168.1.128', '192.168.1.192'],
          correctAnswer: 2
        },
        {
          texte: 'Which device separates broadcast domains by default?',
          options: ['Hub', 'Switch', 'Router', 'Repeater'],
          correctAnswer: 2
        }
      ]
    }
  },

  {
    title: 'Cybersecurity Fundamentals for IT Teams',
    description:
      'Core security skills every IT professional needs: the threat landscape, secure configuration, identity and access management, network defences, and how to respond when an incident happens. Practical, vendor-neutral and aligned with common certifications.',
    category: 'Cybersecurity',
    subCategory: 'Security Fundamentals',
    tags: 'security,cybersecurity,iam,firewall,incident-response',
    price: 0,
    isApproved: true,
    trainerEmail: 'trainer1@test.com',
    lessons: [
      {
        title: 'Threats, Risks & the CIA Triad',
        content:
          'Confidentiality, integrity and availability; common attack types (phishing, malware, ransomware); and how to assess risk as likelihood × impact.',
        contentType: 'pdf',
        isFree: true,
        order: 1,
        quiz: {
          noteMinimale: 70,
          maxAttempts: 3,
          questions: [
            {
              texte: 'Ransomware mainly attacks which part of the CIA triad?',
              options: ['Confidentiality only', 'Availability', 'None', 'Integrity of DNS'],
              correctAnswer: 1
            },
            {
              texte: 'Risk is usually estimated as…',
              options: ['Cost × time', 'Likelihood × impact', 'Users × servers', 'Threats − controls'],
              correctAnswer: 1
            }
          ]
        }
      },
      {
        title: 'Identity, Passwords & MFA',
        content:
          'Authentication vs authorization, strong password policies, multi-factor authentication, and role-based access control applied to real systems.',
        contentType: 'pdf',
        isFree: false,
        order: 2,
        quiz: {
          noteMinimale: 70,
          maxAttempts: 3,
          questions: [
            {
              texte: 'MFA combines…',
              options: ['Two passwords', 'Factors of different types (know / have / are)', 'Two usernames', 'A password and a username'],
              correctAnswer: 1
            },
            {
              texte: 'Authorization answers the question…',
              options: ['Who are you?', 'What are you allowed to do?', 'Where are you?', 'When did you log in?'],
              correctAnswer: 1
            }
          ]
        }
      },
      {
        title: 'Network Defences & Incident Response',
        content:
          'Firewalls, segmentation and least-privilege network design, then the incident response lifecycle: prepare, detect, contain, eradicate, recover and learn.',
        contentType: 'pdf',
        isFree: false,
        order: 3,
        quiz: {
          noteMinimale: 70,
          maxAttempts: 3,
          questions: [
            {
              texte: 'The first step after detecting an active intrusion is usually to…',
              options: ['Delete all logs', 'Contain the affected systems', 'Reinstall everything immediately', 'Ignore it'],
              correctAnswer: 1
            },
            {
              texte: 'A firewall default policy should ideally be…',
              options: ['Allow all', 'Deny all, then allow what is needed', 'Log nothing', 'Random'],
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
          texte: 'Phishing is primarily a…',
          options: ['Hardware fault', 'Social engineering attack', 'Network protocol', 'Backup strategy'],
          correctAnswer: 1
        },
        {
          texte: 'Least privilege means…',
          options: ['Admin rights for everyone', 'Only the access a role requires', 'No passwords', 'Shared accounts'],
          correctAnswer: 1
        },
        {
          texte: 'Why keep offline backups?',
          options: ['They are faster', 'Ransomware cannot encrypt them', 'They need no testing', 'They replace MFA'],
          correctAnswer: 1
        }
      ]
    }
  }
];

module.exports = INFRA_COURSES;
