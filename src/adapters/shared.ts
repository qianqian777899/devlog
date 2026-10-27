import { realpath } from 'node:fs/promises';
import { isAbsolute, resolve } from 'node:path';
import { isWithin, object } from '../fs.js';
import type { AdapterContext, SessionActivity } from '../types.js';

export function textContent(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content.map(part => {
    const item = object(part);
    return ['text', 'input_text'].includes(String(item.type)) && typeof item.text === 'string' ? item.text : '';
  }).filter(Boolean).join('\n');
}
export function summarize(text: string): string {
  return text.replace(/\s+/g, ' ').trim().slice(0, 240);
}
export function instruction(text: string): boolean {
  return !!text.trim() && !/^\s*(?:# AGENTS\.md instructions|<environment_context>|<turn_aborted>|<permissions instructions>|<user_instructions>)/i.test(text);
}
export async function scopedProject(cwd: unknown, context: AdapterContext): Promise<string | undefined> {
  if (typeof cwd !== 'string' || !isAbsolute(cwd)) return;
  let project: string;
  try { project = await realpath(cwd); } catch { project = resolve(cwd); }
  return context.roots.some(root => isWithin(project, root)) ? project : undefined;
}
export function toolFiles(name: unknown, input: unknown): string[] {
  const args = object(input);
  if (typeof name !== 'string') return [];
  if (['Read', 'Edit', 'Write', 'MultiEdit', 'NotebookEdit', 'read_file', 'write_file', 'edit_file'].includes(name)) {
    const file = args.file_path ?? args.path ?? args.notebook_path;
    return typeof file === 'string' ? [file] : [];
  }
  if (name.endsWith('apply_patch')) {
    const patch = typeof input === 'string' ? input : args.patch ?? args.input;
    if (typeof patch !== 'string') return [];
    return [...patch.matchAll(/^\*\*\* (?:Add File|Update File|Delete File|Move to): (.+)\r?$/gm)].map(match => match[1]!.trim());
  }
  return [];
}
export function uniqueActivities(items: SessionActivity[]): SessionActivity[] {
  const seen = new Set<string>();
  return items.filter(item => {
    const key = JSON.stringify([item.source, item.sessionId, item.timestamp, item.kind, item.summary, item.files]);
    if (seen.has(key)) return false;
    seen.add(key); return true;
  }).sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}
