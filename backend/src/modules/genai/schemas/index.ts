import {SOLSchema} from './SOL.js';
import {SMLSchema} from './SML.js';
import {OTLSchema} from './OTL.js';
import {NATSchema} from './NAT.js';
import {DESSchema} from './DES.js';

// Re-export individual schemas
export {SOLSchema, SMLSchema, OTLSchema, NATSchema, DESSchema};

// Type definitions for better type safety
export interface QuestionSchema {
  type: string;
  properties: Record<string, any>;
  required: string[];
}

// Combined schemas object for easy access
export const questionSchemas = {
  SOL: SOLSchema,
  SML: SMLSchema,
  OTL: OTLSchema,
  NAT: NATSchema,
  DES: DESSchema,
} as const;
