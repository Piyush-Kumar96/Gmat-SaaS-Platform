import { UserRole, AccountRole } from './models/User';

// Extend Express Request with user property
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        email: string;
        role: UserRole;
        subscriptionPlan: string;
        mockTestsUsed: number;
        mockTestLimit: number;

        // Tenancy (Phase 1). Populated by authMiddleware after migration 001
        // has run. accountId is optional only because the very first request
        // after a fresh deploy (before migration) might land here without it;
        // tenant-scoped routes throw a clear error in that case.
        accountId?: string;
        accountRole: AccountRole;
        legacyAccessEnabled: boolean;
        restrictedToOwnQuestions: boolean;
      };
    }
  }
}

declare module 'pdf-parse' {
  interface PDFData {
    text: string;
    numpages: number;
    numrender: number;
    info: {
      PDFFormatVersion: string;
      IsAcroFormPresent: boolean;
      IsXFAPresent: boolean;
      [key: string]: unknown;
    };
    metadata: unknown;
    version: string;
  }

  function pdfParse(dataBuffer: Buffer, options?: Record<string, unknown>): Promise<PDFData>;
  export = pdfParse;
} 