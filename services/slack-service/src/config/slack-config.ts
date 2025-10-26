import { SlackServiceConfig } from '../types/slack-types';

export const getSlackConfig = (): SlackServiceConfig => {
  // Validate required environment variables
  const requiredVars = [
    'SLACK_BOT_TOKEN',
    'SLACK_SIGNING_SECRET',
    'SLACK_CLIENT_ID',
    'SLACK_CLIENT_SECRET',
  ];

  const missing = requiredVars.filter(varName => !process.env[varName]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  return {
    port: parseInt(process.env.PORT || '3005'),
    slack: {
      botToken: process.env.SLACK_BOT_TOKEN!,
      signingSecret: process.env.SLACK_SIGNING_SECRET!,
      clientId: process.env.SLACK_CLIENT_ID!,
      clientSecret: process.env.SLACK_CLIENT_SECRET!,
      redirectUri: process.env.SLACK_REDIRECT_URI || 'http://localhost:3005/auth/slack/callback',
      appToken: process.env.SLACK_APP_TOKEN,
    },
    rateLimiting: {
      requestsPerMinute: parseInt(process.env.RATE_LIMIT_REQUESTS_PER_MINUTE || '60'),
      burstSize: parseInt(process.env.RATE_LIMIT_BURST_SIZE || '10'),
    },
  };
};