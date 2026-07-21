# DEPENDENCIES.md

## Server Dependencies

### Production
| Package | Version | Purpose |
|---------|---------|---------|
| @prisma/client | ^5.14.0 | Database ORM client |
| bcryptjs | ^2.4.3 | Password hashing |
| cookie-parser | ^1.4.6 | Cookie parsing middleware |
| cors | ^2.8.5 | CORS middleware |
| dotenv | ^16.4.5 | Environment variable loading |
| express | ^4.19.2 | HTTP framework |
| express-rate-limit | ^7.2.0 | Rate limiting |
| firebase-admin | ^13.10.0 | Firebase Cloud Messaging |
| helmet | ^8.2.0 | Security headers |
| jsonwebtoken | ^9.0.2 | JWT handling |
| multer | ^1.4.5-lts.1 | File upload handling |
| socket.io | ^4.7.5 | WebSocket server |

### Dev
| Package | Version | Purpose |
|---------|---------|---------|
| @types/bcryptjs | ^2.4.6 | Type definitions |
| @types/cookie-parser | ^1.4.7 | Type definitions |
| @types/cors | ^2.8.17 | Type definitions |
| @types/express | ^4.17.21 | Type definitions |
| @types/jsonwebtoken | ^9.0.6 | Type definitions |
| @types/multer | ^1.4.11 | Type definitions |
| @types/node | ^20.12.12 | Type definitions |
| prisma | ^5.14.0 | Prisma CLI |
| ts-node-dev | ^2.0.0 | Dev server with hot reload |
| typescript | ^5.4.5 | TypeScript compiler |

## Client Dependencies

### Production
| Package | Version | Purpose |
|---------|---------|---------|
| @capacitor/android | ^8.4.0 | Android platform |
| @capacitor/app | ^8.1.0 | App lifecycle |
| @capacitor/browser | ^8.0.3 | System browser |
| @capacitor/core | ^8.4.0 | Capacitor runtime |
| @capacitor/push-notifications | ^8.1.1 | Push notifications |
| @capacitor/share | ^8.0.1 | Native share |
| @types/qrcode | ^1.5.6 | QR code types |
| axios | ^1.6.8 | HTTP client |
| jsqr | ^1.4.0 | QR code scanning |
| lucide-react | ^0.379.0 | Icons |
| qrcode | ^1.5.4 | QR code generation |
| react | ^18.3.1 | UI framework |
| react-dom | ^18.3.1 | DOM rendering |
| socket.io-client | ^4.7.5 | WebSocket client |

### Dev
| Package | Version | Purpose |
|---------|---------|---------|
| @capacitor/cli | ^8.4.0 | Capacitor CLI |
| @types/react | ^18.3.3 | React types |
| @types/react-dom | ^18.3.0 | React DOM types |
| @vitejs/plugin-react | ^4.2.1 | Vite React plugin |
| autoprefixer | ^10.4.19 | CSS vendor prefixes |
| playwright | ^1.60.0 | Browser testing |
| postcss | ^8.4.3 | CSS processing |
| tailwindcss | ^3.4.3 | Utility CSS |
| typescript | ^5.2.2 | TypeScript compiler |
| vite | ^5.2.11 | Build tool |

## Notable Absences
- No state management library (Redux, Zustand, MobX)
- No form library (React Hook Form, Formik)
- No unit testing framework (Jest, Vitest, React Testing Library)
- No ESLint config file (referenced in package.json scripts but no config found)
- No Prettier configuration
- No CI/CD configuration files
