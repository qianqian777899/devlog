import { basename } from 'node:path';
import { stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { jsonLines, object, sessionFiles } from '../fs.js';
import { inPeriod } from '../time.js';
import { instruction, scopedProject, summarize, textContent, toolFiles, uniqueActivities } from './shared.js';
import type { AdapterContext, SessionActivity, SessionAdapter } from '../types.js';

export class CodexAdapter implements SessionAdapter {
  readonly name = 'codex' as const;
  async read(path: string, context: AdapterContext): Promise<SessionActivity[]> {
    try { await stat(path); } catch { return []; }
    const activities: SessionActivity[] = [];
    for await (const file of sessionFiles(path, context.warn)) {
      let cwd: unknown, sessionId = basename(file, '.jsonl'), known = false, unknown = 0;
      const counterparts = new Map<string, {time: number; channel: string}[]>();
      for await (const row of jsonLines(file, context.warn)) {
        const payload = object(row.payload);
        if (row.type === 'session_meta') {
          known = true; cwd = payload.cwd;
          if (typeof payload.id === 'string') sessionId = payload.id;
          continue;
        }
        if (row.type === 'turn_context') { known = true; if (payload.cwd) cwd = payload.cwd; continue; }
        if (!['event_msg', 'response_item'].includes(String(row.type))) { unknown++; continue; }
        known = true;
        if (!inPeriod(row.timestamp, context.period)) continue;
        const project = await scopedProject(cwd, context);
        if (!project) continue;
        let text = '', files: string[] = [];
        if (row.type === 'event_msg' && payload.type === 'user_message' && typeof payload.message === 'string') text = payload.message;
        if (row.type === 'response_item' && payload.type === 'message' && payload.role === 'user') text = textContent(payload.content);
        if (row.type === 'response_item' && ['function_call', 'custom_tool_call'].includes(String(payload.type))) {
          let args: unknown = payload.input ?? payload.arguments;
          if (typeof args === 'string' && payload.type === 'function_call') {
            try { args = JSON.parse(args) as unknown; } catch { /* apply_patch may be a raw string */ }
          }
          files = toolFiles(payload.name, args);
        }
        if (instruction(text)) {
          // Codex often records the same turn in both event_msg and response_item.
          // Pair only across channels, preserving repeated user requests.
          const key = createHash('sha256').update(text).digest('hex');
          const time = Date.parse(row.timestamp);
          const candidates = counterparts.get(key) ?? [];
          const index = candidates.findIndex(item => item.channel !== row.type && Math.abs(item.time - time) <= 5000);
          if (index >= 0) { candidates.splice(index, 1); counterparts.set(key, candidates); }
          else {
            candidates.push({time, channel: String(row.type)}); counterparts.set(key, candidates);
            activities.push({source: this.name, sessionId, timestamp: row.timestamp, project, kind: 'task', summary: summarize(text), files: []});
          }
        }
        if (files.length) activities.push({source: this.name, sessionId, timestamp: row.timestamp, project, kind: 'file', summary: 'Tool-referenced files', files: [...new Set(files)]});
      }
      if (!known) context.warn(`Unknown Codex session format, skipped: ${file}`);
      else if (unknown) context.warn(`Skipped ${unknown} unknown Codex record type(s): ${file}`);
    }
    return uniqueActivities(activities);
  }
}
