# Auth Service

JWT-based authentication service for the OfficeFlow platform providing secure user authentication, session management, and multi-factor authentication.

## Features

- **JWT Authentication**: Secure token-based authentication with access and refresh tokens
- **Session Management**: Redis-backed session management with configurable timeouts
- **Multi-Factor Authentication**: TOTP-based MFA with backup codes and recovery options
- **Password Security**: Bcrypt hashing with strength validation and history tracking
- **Rate Limiting**: Configurable rate limiting for login attempts and API calls
- **Account Security**: Account lockout, failed login tracking, and security monitoring

## Implementation Status

This implementation includes complete TypeScript code with mock dependencies for demonstration purposes. In a production environment, the mock dependencies in `src/utils/mock-dependencies.ts` should be replaced with actual npm packages:

- `winston` for logging
- `bcrypt` for password hashing
- `jsonwebtoken` for JWT tokens
- `speakeasy` for TOTP MFA
- `qrcode` for QR code generation
- `joi` for request validation
- `express-rate-limit` and `express-slow-down` for rate limiting

## API Endpoints

### Authentication

- `POST /auth/login` - User login with optional MFA
- `POST /auth/refresh` - Refresh access token
- `POST /auth/logout` - Logout from current session
- `POST /auth/logout-all` - Logout from all sessions
- `POST /auth/change-password` - Change user password

### Multi-Factor Authentication

- `POST /auth/mfa/setup` - Setup MFA for user
- `POST /auth/mfa/verify` - Verify MFA setup
- `POST /auth/mfa/disable` - Disable MFA for user

### Health Check

- `GET /health` - Service health check

## Configuration

Environment variables:

```bash
# Service Configuration
NODE_ENV=development
PORT=3001

# Database
DATABASE_URL=postgresql://username:password@localhost:5432/officeflow
DATABASE_SSL=false
DATABASE_MAX_CONNECTIONS=20

# Redis
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=
REDIS_DB=0

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d

# Password Security
BCRYPT_ROUNDS=12
PASSWORD_MIN_LENGTH=8

# MFA Configuration
MFA_ISSUER=OfficeFlow
MFA_WINDOW=2

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
LOGIN_RATE_LIMIT_WINDOW_MS=900000
LOGIN_RATE_LIMIT_MAX_ATTEMPTS=5

# Session Configuration
SESSION_TIMEOUT_MINUTES=30
MAX_CONCURRENT_SESSIONS=5

# Security
CORS_ORIGIN=http://localhost:3000
TRUST_PROXY=false

# Logging
LOG_LEVEL=info
LOG_FORMAT=json
```

## Database Schema

The service requires the following database tables:

- `users` - User accounts (from main schema)
- `user_sessions` - Active user sessions
- `password_reset_tokens` - Password reset tokens
- `user_mfa_secrets` - MFA secrets and backup codes
- `login_attempts` - Login attempt tracking
- `password_history` - Password history for reuse prevention

Run the migration file `migrations/006_auth_service_tables.sql` to create the required tables.

## Usage

### Starting the Service

```bash
# Development
npm run dev

# Production
npm run build
npm start
```

### Using the Auth Middleware

```typescript
import { createAuthMiddleware } from '@officeflow/auth-service';

const authMiddleware = createAuthMiddleware(db, redis, logger);

// Require authentication
app.use('/api/protected', authMiddleware.authenticate);

// Require specific roles
app.use('/api/admin', authMiddleware.authenticate, authMiddleware.authorize(['admin']));

// Optional authentication
app.use('/api/public', authMiddleware.optionalAuthenticate);
```

### Login Flow

1. **Basic Login**:
   ```json
   POST /auth/login
   {
     "email": "user@example.com",
     "password": "password123"
   }
   ```

2. **MFA Required**:
   ```json
   POST /auth/login
   {
     "email": "user@example.com",
     "password": "password123",
     "mfaToken": "123456"
   }
   ```

3. **Response**:
   ```json
   {
     "accessToken": "eyJhbGciOiJIUzI1NiIs...",
     "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
     "user": {
       "userId": "uuid",
       "email": "user@example.com",
       "role": "user",
       "mfaEnabled": true
     },
     "expiresIn": 86400
   }
   ```

### MFA Setup Flow

1. **Initiate Setup**:
   ```json
   POST /auth/mfa/setup
   {
     "password": "current-password"
   }
   ```

2. **Response with QR Code**:
   ```json
   {
     "secret": "JBSWY3DPEHPK3PXP",
     "qrCode": "data:image/png;base64,...",
     "backupCodes": ["ABCD1234", "EFGH5678", ...]
   }
   ```

3. **Verify Setup**:
   ```json
   POST /auth/mfa/verify
   {
     "token": "123456"
   }
   ```

## Security Features

### Password Requirements

- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character
- Cannot be a common password
- Cannot reuse last 12 passwords

### Rate Limiting

- General API: 100 requests per 15 minutes
- Login attempts: 5 attempts per 15 minutes per IP/email
- Account lockout: 30 minutes after 5 failed attempts

### Session Security

- Configurable session timeout (default: 30 minutes)
- Maximum concurrent sessions per user (default: 5)
- Automatic cleanup of expired sessions
- Session invalidation on password change

### MFA Security

- TOTP-based with 30-second windows
- Backup codes for account recovery
- Required for admin and manager roles
- Secure secret storage (encrypted)

## Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

## Monitoring

The service provides structured logging and health checks:

- Health endpoint: `GET /health`
- Structured JSON logging
- Request correlation IDs
- Performance metrics
- Security event logging

## Development

### Project Structure

```
src/
├── api/                 # API routes
├── config/             # Configuration
├── middleware/         # Express middleware
├── repositories/       # Data access layer
├── services/          # Business logic
├── types/             # TypeScript types
└── __tests__/         # Test files
```

### Adding New Features

1. Add types to `types/auth-types.ts`
2. Implement business logic in `services/`
3. Add API routes in `api/`
4. Add tests in `__tests__/`
5. Update documentation

## Deployment

The service is containerized and can be deployed using Docker:

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3001
CMD ["npm", "start"]
```

## Security Considerations

- Always use HTTPS in production
- Set strong JWT secrets
- Configure proper CORS origins
- Use Redis AUTH in production
- Enable database SSL
- Monitor for suspicious login patterns
- Regularly rotate JWT secrets
- Implement proper logging and alerting