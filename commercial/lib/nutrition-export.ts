/** Offline synthetic snapshot transport. No database, filesystem or network.
 * This producer cannot certify database completeness or authorize disclosure.
 */
import {createHash} from 'node:crypto';
import {parseNutritionCommandV1, type NutritionItemV1, type NutritionCommandV1} from './nutrition-command';
import {validDate} from './validation';

export type NutritionExportScopeV1 = {organizationId: string; clientId: string; from: string; through: string};
export type NutritionVersionV1 = {mealId: string; revision: number; consumedOn: string; mealKind: NutritionCommandV1['mealKind']; status: 'recorded'|'voided'; items: NutritionItemV1[]};
export type NutritionExportPageV1 = {snapshotId: string; index: number; versions: NutritionVersionV1[]};
export type NutritionExportManifestV1 = {
 contractVersion: 1; producer: 'synthetic'; snapshotId: string; capturedAt: string;
 scope: NutritionExportScopeV1; coverage: 'all-versions-in-period'; pageSize: number;
 versionCount: number; itemCount: number; pages: {index: number; count: number; sha256: string}[];
};
export const nutritionExportLimits = {versions: 2000, bytes: 8 * 1024 * 1024, pageSize: 100} as const;
function record(input: unknown, keys: string[]): Record<string, unknown> {
 if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).length !== keys.length || keys.some(key => !Object.hasOwn(input, key))) throw new TypeError('Unexpected snapshot fields');
 return input as Record<string, unknown>;
}
function uuid(input: unknown): string {
 if (typeof input !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(input)) throw new TypeError('Invalid snapshot identity');
 return input.toLowerCase();
}
function scope(input: unknown): NutritionExportScopeV1 {
 const value = record(input, ['organizationId','clientId','from','through']);
 if (typeof value.from !== 'string' || typeof value.through !== 'string' || !validDate(value.from) || !validDate(value.through) || value.from.startsWith('0000-') || value.from > value.through) throw new RangeError('Invalid export period');
 return {organizationId: uuid(value.organizationId), clientId: uuid(value.clientId), from: value.from, through: value.through};
}
function version(input: unknown, range: NutritionExportScopeV1): NutritionVersionV1 {
 const value = record(input, ['mealId','revision','consumedOn','mealKind','status','items']);
 if (value.status !== 'recorded' && value.status !== 'voided') throw new TypeError('Invalid version status');
 const command = parseNutritionCommandV1({contractVersion: 1, requestId: value.mealId, mealId: value.mealId, expectedRevision: value.revision, consumedOn: value.consumedOn, mealKind: value.mealKind, operation: 'save', items: value.items}, range.through);
 if (command.consumedOn < range.from) throw new RangeError('Version outside export period');
 return {mealId: command.mealId!, revision: command.expectedRevision, consumedOn: command.consumedOn, mealKind: command.mealKind, status: value.status, items: command.items};
}
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
function freeze<T>(value: T): T {
 if (value && typeof value === 'object') {for (const child of Object.values(value)) freeze(child); Object.freeze(value);}
 return value;
}
/** Copies and pins the entire already-selected set before returning any pages.
 * Scope is a requested transport boundary, not a database authorization check.
 */
export function createSyntheticNutritionSnapshot(input: {scope: unknown; snapshotId: string; capturedAt: string; versions: readonly unknown[]; pageSize?: number}) {
 const range = scope(input.scope), snapshotId = uuid(input.snapshotId), pageSize = input.pageSize ?? 20;
 if (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > nutritionExportLimits.pageSize || !Array.isArray(input.versions) || input.versions.length > nutritionExportLimits.versions) throw new RangeError('Snapshot exceeds bounds');
 if (typeof input.capturedAt !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(input.capturedAt) || !Number.isFinite(Date.parse(input.capturedAt)) || new Date(input.capturedAt).toISOString() !== input.capturedAt) throw new TypeError('Invalid capture time');
 if (Buffer.byteLength(JSON.stringify(input.versions), 'utf8') > nutritionExportLimits.bytes) throw new RangeError('Snapshot exceeds byte bound');
 const versions = input.versions.map(row => version(row, range)).sort((a,b) => a.mealId < b.mealId ? -1 : a.mealId > b.mealId ? 1 : a.revision - b.revision);
 for (let i = 1; i < versions.length; i++) if (versions[i].mealId === versions[i-1].mealId && versions[i].revision === versions[i-1].revision) throw new TypeError('Duplicate version');
 const pages: NutritionExportPageV1[] = [];
 for (let i = 0; i < versions.length; i += pageSize) pages.push({snapshotId, index: pages.length, versions: versions.slice(i, i + pageSize)});
 const manifest: NutritionExportManifestV1 = {contractVersion: 1, producer: 'synthetic', snapshotId, capturedAt: input.capturedAt, scope: range, coverage: 'all-versions-in-period', pageSize, versionCount: versions.length, itemCount: versions.reduce((n,row) => n + row.items.length, 0), pages: pages.map(page => ({index: page.index, count: page.versions.length, sha256: digest(page)}))};
 return freeze({manifest, pages});
}
/** All-or-error: never release a partly verified collection. The supplied
 * manifest must itself come from the trusted producer; hashes are not signatures.
 */
export function verifySyntheticNutritionSnapshot(expectedScope: unknown, manifestInput: unknown, pageInputs: readonly unknown[]): readonly NutritionVersionV1[] {
 const manifest = record(manifestInput, ['contractVersion','producer','snapshotId','capturedAt','scope','coverage','pageSize','versionCount','itemCount','pages']);
 const expected = scope(expectedScope);
 if (manifest.contractVersion !== 1 || manifest.producer !== 'synthetic' || manifest.coverage !== 'all-versions-in-period' || JSON.stringify(scope(manifest.scope)) !== JSON.stringify(expected) || !Array.isArray(manifest.pages) || !Array.isArray(pageInputs) || manifest.pages.length !== pageInputs.length || pageInputs.length > nutritionExportLimits.versions) throw new TypeError('Snapshot scope or manifest mismatch');
 const versions: unknown[] = [];
 for (let i = 0; i < pageInputs.length; i++) {
  const page = record(pageInputs[i], ['snapshotId','index','versions']);
  const entry = record(manifest.pages[i], ['index','count','sha256']);
  if (page.snapshotId !== manifest.snapshotId || page.index !== i || entry.index !== i || !Array.isArray(page.versions) || page.versions.length !== entry.count || !page.versions.length || page.versions.length > nutritionExportLimits.pageSize || digest(page) !== entry.sha256) throw new TypeError('Missing, reordered or corrupted page');
  versions.push(...page.versions);
  if (versions.length > nutritionExportLimits.versions) throw new RangeError('Snapshot exceeds bounds');
 }
 const rebuilt = createSyntheticNutritionSnapshot({scope: expected, snapshotId: manifest.snapshotId as string, capturedAt: manifest.capturedAt as string, versions, pageSize: manifest.pageSize as number});
 if (JSON.stringify(rebuilt.manifest) !== JSON.stringify({contractVersion: manifest.contractVersion, producer: manifest.producer, snapshotId: manifest.snapshotId, capturedAt: manifest.capturedAt, scope: expected, coverage: manifest.coverage, pageSize: manifest.pageSize, versionCount: manifest.versionCount, itemCount: manifest.itemCount, pages: manifest.pages})) throw new TypeError('Incomplete or noncanonical snapshot');
 return freeze(rebuilt.pages.flatMap(page => page.versions));
}
