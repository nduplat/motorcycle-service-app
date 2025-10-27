# Blue Dragon Motors - AI Assistant System

Complete workshop management system with AI-powered assistance for motorcycle service operations.

## 🏗️ Architecture

- **Frontend**: Angular 20.1.0 + Firebase Hosting
- **Backend**: Firebase (Firestore, Auth, Storage)
- **AI Proxy**: Node.js server deployed on Render
- **AI Service**: Groq API integration

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- Firebase CLI
- GitHub account
- Render account (free)

### 1. Clone and Setup
```bash
git clone https://github.com/bluedragonmotors/blue-dragon-motors.git
cd blue-dragon-motors
npm install
```

### 2. Configure Firebase
```bash
firebase login
firebase use --add
# Select your Firebase project: bluedragonmotors-prod
```

### 3. Environment Setup
```bash
# Copy environment files
cp .env.example .env
cp src/environments/environment.ts src/environments/environment.prod.ts

# Edit with your configuration
```

### 4. Deploy Frontend
```bash
npm run build:prod
firebase deploy --only hosting
```

### 5. Deploy AI Proxy Server
```bash
# Create GitHub repo for server
# Push server/ directory to GitHub

# Deploy on Render:
# 1. Connect GitHub repo
# 2. Set root directory to 'server/'
# 3. Use Docker runtime
# 4. Set environment variables
```

## 📁 Project Structure

```
├── src/                    # Angular frontend
├── server/                 # AI proxy server
├── functions/              # Firebase functions
├── scripts/                # Database seeding
├── firebase.json           # Firebase config
└── Dockerfile             # Multi-service container
```

## 🔧 Configuration

### Environment Variables

**Frontend (.env):**
```env
VITE_FIREBASE_API_KEY=AIzaSyC8rF8xYz9QwErT5U6V7W8X9Y0Z1A2B3C4D
VITE_FIREBASE_AUTH_DOMAIN=bluedragonmotors-prod.firebaseapp.com
VITE_AI_PROXY_URL=https://blue-dragon-motors-ai.onrender.com
```

**AI Proxy Server:**
```env
GROQ_API_KEY=sk-groq-1234567890abcdef
ALLOWED_ORIGINS=https://bluedragonmotors-prod.web.app
VALID_API_KEYS=prod-api-key-bdm-2024
PORT=3001
```

## 🚀 Deployment

### Frontend (Firebase Hosting)
```bash
npm run build:prod
firebase deploy --only hosting
```

### AI Proxy (Render)
1. Create GitHub repo with `server/` content
2. Connect to Render
3. Use Docker runtime
4. Set environment variables
5. Deploy

### Database (Firebase)
```bash
firebase deploy --only firestore:rules
firebase deploy --only storage
```

## 🧪 Testing

### Unit Tests
Run component and service unit tests with code coverage:
```bash
# Run all unit tests
npm run test:unit

# Run tests with coverage report
npm run test:coverage

# Run specific test file
npm run test -- --include="**/auth.service.spec.ts"
```

### Integration Tests
Test component interactions and service integrations:
```bash
# Run integration tests
npm run test:integration

# Test Firebase integration
npm run test:firebase

# Test AI proxy integration
npm run test:ai-proxy
```

### End-to-End Tests
Full application testing with Cypress:
```bash
# Run e2e tests in headless mode
npm run test:e2e

# Run e2e tests with browser UI
npm run test:e2e:ui

# Run specific e2e test suite
npm run test:e2e -- --spec="**/auth-flow.cy.ts"
```

### Test Coverage Requirements
- **Unit Tests**: Minimum 80% coverage
- **Integration Tests**: All critical user flows covered
- **E2E Tests**: Core business workflows tested

### Running All Tests
```bash
# Run complete test suite
npm run test:all

# Run tests in CI mode (with coverage thresholds)
npm run test:ci
```

## 🧪 Development

```bash
# Start frontend
npm start

# Start AI proxy (separate terminal)
cd server && npm start

# Run tests
npm test
```

## 📡 API Documentation

### AI Proxy Server Endpoints

#### Health & Monitoring
```http
GET /health
```
Returns server health status.
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "version": "1.0.0"
}
```

#### AI Chat Completions
```http
POST /api/ai/groq/chat
Content-Type: application/json
Authorization: Bearer your-api-key
```
Generate conversational AI responses.
```json
// Request
{
  "messages": [
    {"role": "user", "content": "How do I change motorcycle oil?"}
  ],
  "max_tokens": 500,
  "temperature": 0.7
}

// Response
{
  "response": "To change motorcycle oil: 1. Warm up engine, 2. Drain old oil, 3. Replace filter, 4. Add new oil...",
  "usage": {"tokens": 245}
}
```

#### AI Text Generation
```http
POST /api/ai/groq/generate
Content-Type: application/json
Authorization: Bearer your-api-key
```
Generate structured text content.
```json
// Request
{
  "prompt": "Generate a service checklist for Honda CBR600RR",
  "instructions": "Format as numbered list with safety notes"
}

// Response
{
  "generated_text": "1. Safety check: Ensure bike is on stand...\n2. Oil level verification...",
  "metadata": {"model": "groq-llama2-70b"}
}
```

#### AI Text Analysis
```http
POST /api/ai/groq/analyze
Content-Type: application/json
Authorization: Bearer your-api-key
```
Analyze text for insights and categorization.
```json
// Request
{
  "text": "Customer reports engine knocking sound after oil change",
  "analysis_type": "symptom_analysis"
}

// Response
{
  "analysis": {
    "severity": "high",
    "possible_causes": ["Incorrect oil type", "Air in system", "Filter damage"],
    "recommendations": ["Immediate inspection required"]
  }
}
```

### Firebase Functions Endpoints

#### Scheduled Tasks
```http
POST /api/scheduled/maintenance-reminders
```
Triggers automated maintenance notifications.

#### Triggers
```http
POST /api/triggers/inventory-low-stock
```
Handles low inventory alerts and reordering.

### Authentication Endpoints
All API endpoints require authentication via Firebase Auth tokens or API keys.

### Rate Limiting
- AI endpoints: 100 requests/minute per API key
- Health endpoints: Unlimited
- Admin endpoints: 10 requests/minute

### Error Responses
```json
{
  "error": "Invalid API key",
  "code": "AUTH_001",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

## 🔒 Security

- API key authentication for AI endpoints
- Firebase Authentication for users
- CORS configured for production domains
- Rate limiting and request monitoring

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Commit changes
4. Push to branch
5. Create Pull Request

## 📄 License

MIT License - see LICENSE file for details
