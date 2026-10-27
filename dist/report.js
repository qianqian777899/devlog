import { basename } from 'node:path';
import { localDate } from './time.js';
export function md(value) {
    return value.replace(/[\r\n\t]+/g, ' ').replace(/[\\`*_{}[\]()<>!|#~]/g, '\\$&');
}
function quantity(count, singular, plural = singular + 's') { return `${count} ${count === 1 ? singular : plural}`; }
export function renderReport(data, language, template) {
    const zh = language === 'zh';
    const titles = { daily: zh ? '工作日报' : 'Daily work report', weekly: zh ? '工作周报' : 'Weekly work report', okr: zh ? 'OKR 进展记录' : 'OKR progress log' };
    const start = localDate(data.period.since), end = localDate(new Date(data.period.until.getTime() - 1));
    const out = [`# ${titles[template]}`, '', `${zh ? '日期' : 'Dates'}: ${start}${start === end ? '' : ` — ${end}`}`, `${zh ? '时区' : 'Timezone'}: ${md(Intl.DateTimeFormat().resolvedOptions().timeZone)}`, ''];
    const repositories = new Set(data.commits.map(c => c.repository));
    const tasks = data.activities.filter(a => a.kind === 'task');
    const sessionCount = new Set(data.activities.map(a => `${a.source}:${a.sessionId}`)).size;
    const additions = data.commits.reduce((sum, c) => sum + c.additions, 0), deletions = data.commits.reduce((sum, c) => sum + c.deletions, 0);
    out.push(`## ${zh ? '工作概览' : 'Overview'}`, '', zh
        ? `- Git：${repositories.size} 个仓库，${data.commits.length} 次提交，新增 ${additions} 行，删除 ${deletions} 行。`
        : `- Git: ${quantity(repositories.size, 'repository', 'repositories')}, ${quantity(data.commits.length, 'commit')}, +${additions}/-${deletions} lines.`, zh ? `- AI 协作：${sessionCount} 个会话，${tasks.length} 条任务请求。` : `- AI collaboration: ${quantity(sessionCount, 'session')}, ${quantity(tasks.length, 'task request')}.`, '');
    if (template === 'okr')
        out.push(`## ${zh ? '目标与关键结果（待填写）' : 'Objectives and key results (fill in)'}`, '', zh ? '- O：待填写；KR：待填写。以下记录仅作为进展证据，不自动推断达成率。' : '- O: to fill in; KR: to fill in. Evidence below does not imply a completion rate.', '');
    out.push(`## ${zh ? '已提交的改动' : 'Committed changes'}`, '');
    if (!data.commits.length)
        out.push(zh ? '- 此时段未找到符合作者筛选条件的提交。' : '- No matching commits in this period.', '');
    for (const repository of [...repositories].sort()) {
        out.push(`### ${md(basename(repository))}`, '', `> ${md(repository)}`, '');
        for (const c of data.commits.filter(c => c.repository === repository)) {
            out.push(`- ${md(c.message)} (${c.hash.slice(0, 7)}; +${c.additions}/-${c.deletions}; ${zh ? `${c.files.length} 个文件` : quantity(c.files.length, 'file')}${c.binaryFiles ? `; ${c.binaryFiles} ${zh ? '个二进制文件' : 'binary files'}` : ''})`);
            if (c.files.length)
                out.push(`  - ${zh ? '文件' : 'Files'}: ${c.files.map(md).join(', ')}`);
        }
        out.push('');
    }
    out.push(`## ${zh ? 'AI 协作记录（任务请求，待核实结果）' : 'AI collaboration (requests; verify outcomes)'}`, '');
    if (!data.activities.length)
        out.push(zh ? '- 此时段未找到扫描目录内的会话记录。' : '- No in-scope session activity found.', '');
    const projects = [...new Set(data.activities.map(a => a.project))].sort();
    for (const project of projects) {
        out.push(`### ${md(basename(project))}`, '', `> ${md(project)}`, '');
        for (const task of tasks.filter(a => a.project === project))
            out.push(`- [${task.source}] ${md(task.summary)}`);
        for (const source of ['codex', 'claude']) {
            const files = [...new Set(data.activities.filter(a => a.project === project && a.source === source).flatMap(a => a.files))].sort();
            if (files.length)
                out.push(`- [${source}] ${zh ? '工具涉及文件（含读取及尝试修改）' : 'Tool-referenced files (reads and attempted edits included)'}: ${files.map(md).join(', ')}`);
        }
        out.push('');
    }
    out.push(`## ${zh ? '阻碍与下一步（待补充）' : 'Blockers and next steps (fill in)'}`, '', zh ? '- 请补充实际阻碍、结果验证和下一步安排。' : '- Add actual blockers, verified outcomes and next steps.', '', `> ${zh ? '本报告由本地记录生成。提交不等于上线，会话请求不等于完成；未自动推断业务收益、测试通过或交付状态。' : 'Generated from local evidence. Commits do not imply deployment; requests do not imply completion. Business impact, passing tests and delivery are not inferred.'}`, '');
    if (data.warnings.length)
        out.push(`## ${zh ? '采集提示' : 'Collection warnings'}`, '', ...[...new Set(data.warnings)].map(w => `- ${md(w)}`), '');
    return out.join('\n');
}
//# sourceMappingURL=report.js.map