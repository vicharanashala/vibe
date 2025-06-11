import {SOLSchema} from './SOL';
import {SMLSchema} from './SML';
import {OTLSchema} from './OTL';
import {NATSchema} from './NAT';
import {DESSchema} from './DES';

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
