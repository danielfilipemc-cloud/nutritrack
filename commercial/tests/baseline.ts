import {migrationBundle} from '../scripts/migration-bundle';
// Historical algorithm contracts run against the audited eight-file baseline.
// foundations.test.ts separately exercises the FULL upgraded schema, including
// every new authorization gate. Never use this bounded bundle for deployment.
export function baselineMigrationBundle(){return migrationBundle({through:'20261013210823_followup_agenda.sql'});}
