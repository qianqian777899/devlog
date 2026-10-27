import { basename } from 'node:path';
import { stat } from 'node:fs/promises';
import { jsonLines, object, sessionFiles } from '../fs.js';
import { inPeriod } from '../time.js';
import { instruction, scopedProject, summarize, textContent, toolFiles, uniqueActivities } from './shared.js';
export class ClaudeAdapter {
    name = 'claude';
    async read(path, context) {
        try {
            await stat(path);
        }
        catch {
            return [];
        }
        const activities = [], seen = new Set(), tools = new Set();
        for await (const file of sessionFiles(path, context.warn)) {
            let known = false, unknown = 0;
            for await (const row of jsonLines(file, context.warn)) {
                if (['summary', 'system', 'progress', 'file-history-snapshot', 'queue-operation', 'last-prompt', 'custom-title', 'agent-name'].includes(String(row.type))) {
                    known = true;
                    continue;
                }
                if (!['user', 'assistant'].includes(String(row.type)) || !row.message) {
                    unknown++;
                    continue;
                }
                known = true;
                if (!inPeriod(row.timestamp, context.period))
                    continue;
                const project = await scopedProject(row.cwd, context);
                if (!project)
                    continue;
                const sessionId = typeof row.sessionId === 'string' ? row.sessionId : basename(file, '.jsonl');
                if (typeof row.uuid === 'string') {
                    const key = `${sessionId}:${row.uuid}`;
                    if (seen.has(key))
                        continue;
                    seen.add(key);
                }
                const message = object(row.message);
                const text = row.type === 'user' && row.isMeta !== true ? textContent(message.content) : '';
                if (instruction(text))
                    activities.push({ source: this.name, sessionId, timestamp: row.timestamp, project, kind: 'task', summary: summarize(text), files: [] });
                if (row.type !== 'assistant' || !Array.isArray(message.content))
                    continue;
                for (const content of message.content) {
                    const block = object(content);
                    if (block.type !== 'tool_use')
                        continue;
                    if (typeof block.id === 'string') {
                        const key = `${sessionId}:${block.id}`;
                        if (tools.has(key))
                            continue;
                        tools.add(key);
                    }
                    const files = toolFiles(block.name, block.input);
                    if (files.length)
                        activities.push({ source: this.name, sessionId, timestamp: row.timestamp, project, kind: 'file', summary: 'Tool-referenced files', files });
                }
            }
            if (!known)
                context.warn(`Unknown Claude Code session format, skipped: ${file}`);
            else if (unknown)
                context.warn(`Skipped ${unknown} unknown Claude Code record type(s): ${file}`);
        }
        return uniqueActivities(activities);
    }
}
//# sourceMappingURL=claude.js.map