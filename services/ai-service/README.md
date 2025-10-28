# AI Service

The AI Service is a Node.js microservice that provides AI-powered content generation capabilities for the OfficeFlow platform. It integrates with Large Language Models (LLMs) to generate personalized content for employee onboarding, role-specific materials, document summaries, and sentiment analysis.

## Features

### Core Capabilities

- **LLM Integration**: OpenAI GPT-4/3.5 integration with error handling and retry logic
- **Template Management**: Handlebars-based prompt templates with variable substitution
- **Content Generation**: Specialized generators for different content types
- **Cost Tracking**: Token usage monitoring and cost estimation
- **Rate Limiting**: Organization-based request and token rate limiting
- **Caching**: Response caching to reduce API costs
- **Node Executor**: Implements the standard NodeExecutor interface for workflow integration

### Content Types Supported

1. **Welcome Messages**: Personalized onboarding messages for new employees
2. **Role-Specific Content**: Department and role-specific onboarding materials
3. **Document Summaries**: AI-powered document summarization
4. **Sentiment Analysis**: Text sentiment and emotion analysis
5. **Custom Content**: Flexible custom prompt processing

## Architecture

```
AI Service
├── LLM Integration Layer
│   ├── OpenAI Client (with retry & error handling)
│   └── Future: Anthropic, Azure OpenAI support
├── Template Management
│   ├── Handlebars template engine
│   ├── Variable validation
│   └── Default templates for common use cases
├── Content Generation
│   ├── Welcome message generator
│   ├── Role-specific content generator
│   ├── Document summarizer
│   └── Sentiment analyzer
├── Monitoring & Cost Control
│   ├── Token usage tracking
│   ├── Cost estimation
│   ├── Rate limiting
│   └── Response caching
└── Node Executor Interface
    ├── Parameter validation
    ├── Error handling
    └── Workflow integration
```

## API Endpoints

### Node Execution

- `POST /execute` - Execute AI node in workflow context
- `GET /schema` - Get node schema definition

### Content Generation

- `POST /content/welcome-message` - Generate welcome messages
- `POST /content/role-specific` - Generate role-specific content
- `POST /content/summarize` - Summarize documents
- `POST /content/sentiment` - Analyze sentiment
- `POST /content/custom` - Custom content generation

### Management

- `GET /health` - Health check
- `GET /templates` - List available templates
- `GET /templates/:id` - Get specific template
- `GET /cost/:orgId` - Get cost summary
- `GET /cost/export/:orgId` - Export cost data

## Configuration

### Environment Variables

```bash
# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_DEFAULT_MODEL=gpt-4
OPENAI_MAX_TOKENS=2000
OPENAI_TEMPERATURE=0.7

# Cost Tracking
AI_COST_TRACKING_ENABLED=true
AI_COST_LOG_LEVEL=basic

# Rate Limiting
AI_RATE_LIMIT_REQUESTS=60
AI_RATE_LIMIT_TOKENS=100000

# Caching
AI_CACHING_ENABLED=true
AI_CACHE_TTL_SECONDS=3600
```

## Usage Examples

### Welcome Message Generation

```typescript
const welcomeRequest = {
  organizationId: 'org-123',
  employee: {
    firstName: 'John',
    lastName: 'Doe',
    role: 'Software Engineer',
    department: 'Engineering',
    startDate: new Date('2024-01-15'),
    manager: 'Jane Smith',
  },
  company: {
    name: 'TechCorp',
    industry: 'Technology',
    culture: 'Innovation-focused',
  },
  options: {
    tone: 'friendly',
    length: 'medium',
    includeTeamIntroduction: true,
  },
};

const result = await contentGenerator.generateWelcomeMessage(
  welcomeRequest.organizationId,
  welcomeRequest.employee,
  welcomeRequest.company,
  welcomeRequest.options
);
```

### Document Summarization

```typescript
const summaryRequest = {
  organizationId: 'org-123',
  document: {
    title: 'Employee Handbook',
    content: '...', // Document content
    type: 'policy',
  },
  options: {
    summaryType: 'executive',
    maxLength: 200,
    includeActionItems: true,
  },
};

const summary = await contentGenerator.summarizeDocument(
  summaryRequest.organizationId,
  summaryRequest.document,
  summaryRequest.options
);
```

### Sentiment Analysis

```typescript
const sentimentRequest = {
  organizationId: 'org-123',
  text: "I'm really excited about starting my new role!",
  options: {
    contextType: 'feedback',
    includeEmotions: true,
    includeRecommendations: true,
  },
};

const analysis = await contentGenerator.analyzeSentiment(
  sentimentRequest.organizationId,
  sentimentRequest.text,
  sentimentRequest.options
);
```

## Template System

The service uses Handlebars templates for consistent content generation:

### Built-in Templates

- `welcome_message` - Employee welcome messages
- `role_specific_content` - Role-specific onboarding materials
- `document_summary` - Document summarization
- `sentiment_analysis` - Sentiment analysis with JSON output

### Custom Helpers

- `{{capitalize text}}` - Capitalize first letter
- `{{formatDate date}}` - Format dates
- `{{join array separator}}` - Join arrays
- `{{ifEquals arg1 arg2}}` - Conditional logic

### Template Variables

Templates support typed variables with validation:

- String, number, boolean, object, array types
- Required/optional validation
- Length, pattern, and enum constraints
- Default values

## Cost Management

### Token Tracking

- Real-time token usage monitoring
- Per-organization cost tracking
- Model-specific pricing calculations
- Historical usage analytics

### Rate Limiting

- Request-per-minute limits
- Token-per-minute limits
- Organization-level enforcement
- Automatic reset windows

### Caching

- Response caching to reduce API calls
- Configurable TTL
- Cache key generation based on request parameters
- Automatic cache cleanup

## Error Handling

### Retry Logic

- Exponential backoff for transient errors
- Maximum retry attempts (3)
- Jitter to prevent thundering herd
- Circuit breaker for persistent failures

### Error Classification

- Retryable errors: Rate limits, timeouts, network issues
- Non-retryable errors: Authentication, validation, quota exceeded
- Proper error propagation to workflow engine

## Monitoring

### Metrics

- Request count and latency
- Token usage and costs
- Error rates and types
- Cache hit/miss ratios

### Logging

- Structured JSON logging
- Request correlation IDs
- Performance metrics
- Error details and stack traces

## Development

### Setup

```bash
cd services/ai-service
npm install
cp .env.example .env
# Configure environment variables
npm run dev
```

### Testing

```bash
npm test
npm run test:watch
```

### Building

```bash
npm run build
npm start
```

## Integration with Workflow Engine

The AI Service implements the standard `NodeExecutor` interface and can be used in workflows:

```json
{
  "nodeId": "ai-welcome-msg",
  "type": "ai_service",
  "params": {
    "aiType": "welcome_message",
    "employee": "{{context.employee}}",
    "company": "{{context.company}}",
    "options": {
      "tone": "friendly",
      "length": "medium"
    }
  }
}
```

## Security Considerations

- API keys stored securely in environment variables
- Request validation and sanitization
- Rate limiting to prevent abuse
- Audit logging for compliance
- No sensitive data in logs or caches

## Future Enhancements

- Support for additional LLM providers (Anthropic Claude, Azure OpenAI)
- Advanced prompt engineering and optimization
- Fine-tuned models for specific use cases
- Multi-language content generation
- Advanced analytics and insights
- Integration with vector databases for RAG capabilities
