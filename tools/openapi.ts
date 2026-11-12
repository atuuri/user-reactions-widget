// SPDX-License-Identifier: MIT
// Dev-only helper: loads docs/api/openapi.yaml and validates payloads against its schemas.
// Used by the tests and by the dev mock endpoint. Not part of the published bundle.
//
// Implements only the JSON Schema keywords the contract uses. Any other keyword is
// reported as an error, so a spec change cannot silently go unchecked.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

type Schema = Record<string, any>;

// String form: test environments may replace the global URL class.
const SPEC_PATH = join(dirname(fileURLToPath(import.meta.url)), '../docs/api/openapi.yaml');
export const spec: Schema = parse(readFileSync(SPEC_PATH, 'utf8'));

const KNOWN = new Set([
  '$ref', 'type', 'required', 'properties', 'additionalProperties', 'enum',
  'minimum', 'maximum', 'minLength', 'maxLength', 'maxProperties', 'format', 'description',
]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function resolve(s: Schema): Schema {
  if (!s.$ref) return s;
  return (s.$ref as string).replace(/^#\//, '').split('/').reduce((o: Schema, k) => o[k], spec);
}

function check(schema: Schema, v: unknown, at: string, out: string[]) {
  const s = resolve(schema);
  for (const k of Object.keys(s)) if (!KNOWN.has(k)) out.push(`${at}: unsupported schema keyword "${k}"`);
  const t = s.type;
  if (t == 'object') {
    if (!v || typeof v != 'object' || Array.isArray(v)) return void out.push(`${at}: expected object`);
    const o = v as Record<string, unknown>;
    const keys = Object.keys(o);
    for (const r of s.required ?? []) if (!(r in o)) out.push(`${at}: missing required "${r}"`);
    if (s.maxProperties != null && keys.length > s.maxProperties) out.push(`${at}: more than ${s.maxProperties} properties`);
    for (const k of keys) {
      const p = s.properties?.[k];
      if (p) check(p, o[k], `${at}.${k}`, out);
      else if (s.additionalProperties === false) out.push(`${at}: unexpected property "${k}"`);
      else if (typeof s.additionalProperties == 'object') check(s.additionalProperties, o[k], `${at}.${k}`, out);
    }
  } else if (t == 'string') {
    if (typeof v != 'string') return void out.push(`${at}: expected string`);
    if (s.minLength != null && v.length < s.minLength) out.push(`${at}: shorter than ${s.minLength}`);
    if (s.maxLength != null && v.length > s.maxLength) out.push(`${at}: longer than ${s.maxLength}`);
    if (s.format == 'uuid' && !UUID.test(v)) out.push(`${at}: not a uuid`);
  } else if (t == 'integer') {
    if (!Number.isInteger(v)) return void out.push(`${at}: expected integer`);
    if (s.minimum != null && (v as number) < s.minimum) out.push(`${at}: below ${s.minimum}`);
    if (s.maximum != null && (v as number) > s.maximum) out.push(`${at}: above ${s.maximum}`);
  } else if (t != null) {
    out.push(`${at}: unsupported type "${t}"`);
  }
  if (s.enum && !s.enum.includes(v)) out.push(`${at}: not one of ${s.enum.join(', ')}`);
}

/** Request body content for `POST <path>` (e.g. "/v1/feedback"). */
export function requestBody(path: string): { schema: Schema; examples: Record<string, unknown> } {
  const c = spec.paths[path].post.requestBody.content['application/json'];
  const examples: Record<string, unknown> = {};
  for (const [name, ex] of Object.entries<any>(c.examples ?? {})) examples[name] = ex.value;
  return { schema: c.schema, examples };
}

/** Returns a list of validation errors (empty when valid) for a request body sent to `path`. */
export function validateRequest(path: string, body: unknown): string[] {
  const out: string[] = [];
  check(requestBody(path).schema, body, 'body', out);
  return out;
}
