# TECH_STACK.md

## Programming Languages
| Language | Where | Purpose |
|----------|-------|---------|
| TypeScript | Server + Client | Primary language for both frontend and backend |
| JavaScript | Utility scripts, configs | Build scripts, test scripts, config files |
| SQL | Prisma migrations | Database schema DDL |
| CSS | Tailwind + custom | Styling (compiled from Tailwind + index.css) |

## Backend Frameworks & Libraries
| Library | Version | Purpose |
|---------|---------|---------|
| Express.js | ^4.19.2 | HTTP server framework |
| Socket.IO | ^4.7.5 | WebSocket real-time communication |
| Prisma | ^5.14.0 | ORM for database access |
| jsonwebtoken | ^9.0.2 | JWT token generation and verification |
| bcryptjs | ^2.4.3 | Password hashing (bcrypt) |
| multer | ^1.4.5-lts.1 | File upload handling |
| helmet | ^8.2.0 | HTTP security headers |
| cors | ^2.8.5 | Cross-Origin Resource Sharing |
| cookie-parser | ^1.4.6 | Cookie parsing for HttpOnly refresh tokens |
| express-rate-limit | ^7.2.0 | API rate limiting |
| dotenv | ^16.4.5 | Environment variable loading |
| firebase-admin | ^13.10.0 | Firebase Cloud Messaging for push notifications |

## Frontend Frameworks & Libraries
| Library | Version | Purpose |
|---------|---------|---------|
| React | ^18.3.1 | UI framework |
| React DOM | ^18.3.1 | DOM rendering |
| Axios | ^1.6.8 | HTTP client for API calls |
| Socket.IO Client | ^4.7.5 | WebSocket client |
| Lucide React | ^0.379.0 | Icon library |
| QRCode | ^1.5.4 | QR code generation |
| jsQR | ^1.4.0 | QR code scanning from camera |
| Tailwind CSS | ^3.4.3 | Utility-first CSS framework |
| Vite | ^5.2.11 | Build tool and dev server |

## Mobile / Capacitor
| Library | Version | Purpose |
|---------|---------|---------|
| @capacitor/core | ^8.4.0 | Capacitor runtime |
| @capacitor/android | ^8.4.0 | Android platform |
| @capacitor/app | ^8.1.0 | App lifecycle events (backButton, appStateChange) |
| @capacitor/browser | ^8.0.3 | System browser for downloads |
| @capacitor/push-notifications | ^8.1.1 | Push notification registration |
| @capacitor/share | ^8.0.1 | Native share dialog |

## Build Tools
| Tool | Version | Purpose |
|------|---------|---------|
| Vite | ^5.2.11 | Frontend bundler, dev server, HMR |
| TypeScript | ^5.4.5 (server), ^5.2.2 (client) | Type checking |
| ts-node-dev | ^2.0.0 | Server dev mode with auto-restart |
| PostCSS | ^8.4.3 | CSS processing for Tailwind |
| Autoprefixer | ^10.4.19 | CSS vendor prefixing |

## DevOps
| Tool | Purpose |
|------|---------|
| Docker | Multi-stage builds for server and client |
| Docker Compose | Orchestrates backend + frontend + (implicit) database |
| Nginx | Serves static frontend, reverse proxies API/WebSocket to backend |
| Git | Version control |

## Testing (devDependencies only)
| Tool | Purpose |
|------|---------|
| Playwright | ^1.60.0 — Browser automation testing |
| Various `test-*.cjs` scripts | Manual integration test scripts (socket, WebRTC, upload vulnerability, etc.) |

## Database
| Technology | Purpose |
|------------|---------|
| SQLite | Development database (file-based) |
| PostgreSQL | Production database (configured in .env.example) |
| Prisma | ORM + migration management |
