# Sentry Error Monitoring Setup Guide

## Overview

This guide helps you set up Sentry for production error monitoring in ClassTrack.

## Installation

```bash
npm install @sentry/nextjs --save
```

## Initialization

```bash
npx @sentry/wizard@latest -i nextjs
```

This wizard will:
1. Create `sentry.client.config.ts`
2. Create `sentry.server.config.ts`  
3. Create `sentry.edge.config.ts`
4. Update `next.config.js`
5. Create `.sentryclirc` (add to `.gitignore`)

## Environment Variables

Add to `.env.local`:
```bash
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
SENTRY_ORG=your-org-name
SENTRY_PROJECT=classtrack

# Optional: Don't upload source maps in development
SENTRY_UPLOAD_DRY_RUN=true
```

Add to production environment:
```bash
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
SENTRY_AUTH_TOKEN=your-auth-token
```

## Sentry Dashboard

1. Sign up at [sentry.io](https://sentry.io)
2. Create new project → Select "Next.js"
3. Copy your DSN from project settings
4. Configure alerts and notifications

## Testing Sentry

Add a test error button (remove after verification):
```tsx
<button onClick={() => { throw new Error("Sentry test error"); }}>
  Test Error Monitoring
</button>
```

## Best Practices

- Set up release tracking with Git commits
- Configure source maps upload for better stack traces
- Set up performance monitoring
- Configure issue assignment rules
- Set up Slack/email notifications

## Monitoring Dashboard

Once configured, you can:
- Track errors in real-time
- See user impact metrics
- Debug with full stack traces
- Monitor performance issues
- Get alerts on critical errors

## Production Checklist

- [ ] Sentry project created
- [ ] DSN configured in environment
- [ ] Auth token for source maps
- [ ] Alerts configured
- [ ] Team notifications set up
- [ ] Test error verified in dashboard
