import administrationRouter from '@/app/_administrations/router';
import usersRouter from '@/app/_auth/router';
import customFiltersRouter from '@/app/_custom-filters/router';
import documentsRouter from '@/app/_documents/router';
import moneybirdRouter from '@/app/_moneybird/router';
import notificationsRouter from '@/app/_notifications/router';
import onboardingRouter from '@/app/_onboarding/router';
import organizationRouter from '@/app/_organizations/router';
import processingRulesRouter_ from '@/app/_processing-rules_/router';
import systemMessagesRouter from '@/app/_system-messages/router';
import transactionsRouter from '@/app/_transactions/router';

import policiesRouter from './app/_policies/router';
import teamInvitesRouter from './app/_team-invites/router';
import { createTRPCRouter } from './lib/trpc/trpc';

export const appRouter = createTRPCRouter({
  onboarding: onboardingRouter,
  users: usersRouter,
  organizations: organizationRouter,
  administrations: administrationRouter,
  moneybird: moneybirdRouter,
  documents: documentsRouter,
  transactions: transactionsRouter,
  systemMessages: systemMessagesRouter,
  processingRules_: processingRulesRouter_,
  notifications: notificationsRouter,
  policies: policiesRouter,
  customFilters: customFiltersRouter,
  teamInvites: teamInvitesRouter,
});

export type AppRouter = typeof appRouter;
