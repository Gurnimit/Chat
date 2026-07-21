# Velvet Chat — Secure & Private Messenger

Velvet Chat is a secure, private-first real-time messaging application designed with a beautiful "Midnight Velvet" dark mode. The application operates as a single-codebase web application with full PWA functionality, and is engineered to package into an Android APK using Capacitor with zero code changes.

---

## 🚀 Setup & Execution Guide

### Option 1: Complete Docker Compose Run (Recommended)
You can start the database, backend Express server, and frontend Nginx server with a single command. The backend files will save uploads under `./server/uploads`, persisting them on the host.

1. From the project root directory, execute:
   ```bash
   docker-compose up --build
   ```
2. The services will boot in order:
   - **PostgreSQL**: Starts first and exposes port `5432`.
   - **Backend**: Generates Prisma models, connects to PG, runs migrations, and starts listening on port `5000`.
   - **Frontend**: Compiles the React application using Vite, copies assets to Nginx, and serves them on port `80`.
3. Open your browser and navigate to: `http://localhost`.

### Option 2: Local Development Run (Vite + Node Server)
If you prefer running the code locally on Windows without Nginx proxying, follow these steps:

#### Step 1: Database Setup
1. Set up a PostgreSQL instance and get the connection string.
2. In `server/`, create a `.env` file:
   ```env
   DATABASE_URL="postgresql://username:password@localhost:5432/chat_db"
   PORT=5000
   ACCESS_TOKEN_SECRET="super_secret_access_key_123"
   REFRESH_TOKEN_SECRET="super_secret_refresh_key_456"
   ```
3. Run database migrations:
   ```bash
   cd server
   npm install
   npx prisma migrate dev --name init
   ```
4. Load mock seed data:
   ```bash
   npm run db:seed
   ```

#### Step 2: Start Backend
```bash
npm run dev
# The backend will start on port 5000
```

#### Step 3: Start Client
1. Open a new terminal in the `client/` directory.
2. Install dependencies:
   ```bash
   cd client
   npm install
   ```
3. Boot development server:
   ```bash
   npm run dev
   # Vite starts on http://localhost:5173 and automatically proxies /api to port 5000
   ```

---

## 📊 Database Seed Accounts

The database is pre-populated with three test accounts when running the seed script or Docker initialization. All accounts use the password: `password123`.

1. **Alice Smith**
   - Username: `alice`
   - Email: `alice@example.com`
2. **Bob Johnson**
   - Username: `bob`
   - Email: `bob@example.com`
3. **Charlie Brown**
   - Username: `charlie`
   - Email: `charlie@example.com`

---

## 📑 API Reference Documentation

### Authentication Endpoint Group (`/api/auth`)

#### 1. Register User
- **Method & Route**: `POST /api/auth/register`
- **Body Payload**:
  ```json
  {
    "email": "user@example.com",
    "username": "username123",
    "password": "securepassword",
    "displayName": "User Name"
  }
  ```
- **Returns**: Code `210 Created`
  ```json
  {
    "message": "User registered successfully",
    "accessToken": "eyJhbGciOi...",
    "refreshToken": "eyJhbGciOi...",
    "user": { "id": "uuid", "email": "...", "username": "...", "profile": { ... } }
  }
  ```

#### 2. User Sign In
- **Method & Route**: `POST /api/auth/login`
- **Body Payload**:
  ```json
  {
    "loginIdentifier": "username123", // Or email
    "password": "securepassword"
  }
  ```
- **Returns**: Code `200 OK` + HTTP Cookie `refreshToken`.

#### 3. Refresh Access Token
- **Method & Route**: `POST /api/auth/refresh`
- **Body Payload**: (Optional fallback for mobile Capacitor)
  ```json
  {
    "refreshToken": "eyJhbGciOi..."
  }
  ```
- **Returns**: Code `200 OK`
  ```json
  {
    "accessToken": "new_access_token_jwt",
    "refreshToken": "new_refresh_token_jwt"
  }
  ```

### Chat & Message Endpoint Group (`/api`)

#### 1. Retrieve Recent Chats
- **Method & Route**: `GET /api/chats`
- **Headers**: `Authorization: Bearer <accessToken>`
- **Returns**: Array of conversations with unread counts and latest message previews.

#### 2. Get Messages History
- **Method & Route**: `GET /api/chats/:chatId/messages?limit=50&cursor=<messageId>`
- **Headers**: `Authorization: Bearer <accessToken>`
- **Returns**: Chronological array of message models.

#### 3. Create Direct Conversation
- **Method & Route**: `POST /api/chats/direct`
- **Body Payload**:
  ```json
  {
    "otherUserId": "uuid-of-other-user"
  }
  ```

#### 4. Search Profiles
- **Method & Route**: `GET /api/users/search?q=query`
- **Returns**: Matches excluding the caller.

---

## 🛠️ Phase-by-Phase Testing Instructions

To verify each feature is performing as expected during testing:

### Phase 1: Authentication Testing
1. Load `http://localhost/` or `http://localhost:5173`.
2. Toggle to "Sign up free". Create a new account with email `test@test.com`, username `tester`, password `password123`.
3. Verify that on submission you are redirected inside the main interface.
4. Refresh the page: verify the application does not ask you to login again (session recovery).
5. Click the avatar on the left header, make a modification to display name or bio, click Save. Check that changes render instantly.

### Phase 2: Sockets & Real-time Delivery
1. Open two browser windows: one in normal mode, one in incognito mode.
2. Sign in as `alice` in Window 1, and `bob` in Window 2.
3. Verify Bob is visible as Online in Alice's sidebar list (green indicator dot).
4. Click on Bob in Alice's panel to open the chat area. Type a message.
5. Watch Bob's incognito window: verify the typing indicator states "typing..." under Alice's header.
6. Press send: verify the message renders instantly in Bob's view.
7. Verify Alice sees a double-tick read indicator (`CheckCheck`) once Bob is focused on the message screen.

### Phase 3: File Uploads & Media
1. While chatting, click the paperclip icon in Alice's footer.
2. Choose an image (under 10MB) or document.
3. Observe the file status box appears stating size and name.
4. Click Send: verify the image is uploaded to server, serves statically, and renders directly inside the chat window.
5. In Bob's window, verify the image is visible. Toggle the right sidebar info panel and check that the attachment is listed in "Shared Attachments".

---

## 📱 Android APK Packaging with Capacitor

To convert this web-app into a native Android app:

1. Build the React client in production mode to compile static files:
   ```bash
   cd client
   npm run build
   ```
2. Initialize Capacitor CLI configuration:
   ```bash
   npx cap init Velvet com.velvet.chat --web-dir=dist
   ```
3. Install the Android plugin wrapper:
   ```bash
   npm install @capacitor/android
   npx cap add android
   ```
4. Sync the web assets into the Android native project folder:
   ```bash
   npx cap sync
   ```
5. Open the project in Android Studio to build the signed APK:
   ```bash
   npx cap open android
   ```
   - In Android Studio, wait for Gradle sync to complete.
   - Go to **Build** > **Build Bundle(s) / APK(s)** > **Build APK(s)**.
   - Install the resulting APK on your device!
