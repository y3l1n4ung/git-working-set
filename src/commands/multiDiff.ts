import * as vscode from 'vscode';
import * as path from 'path';
import { GitAPI, Status } from '../types';
import { WorkingSetProvider } from '../providers/treeProvider';
import { EMPTY_URI, REVIEW_SCHEME } from '../providers/contentProvider';
import { getComprehensiveChange, createGitUri } from '../utils';

/**
 * Final Senior Dev Refactor.
 * Uses the most stable 'vscode.changes' signature with verbose logging.
 * Removed unsupported openMultiDiff.
 */
export async function openReview(
    gitAPI: GitAPI,
    output: vscode.OutputChannel,
    treeDataProvider: WorkingSetProvider
) {
    const allChanges = treeDataProvider.getAllChanges();
    if (allChanges.length === 0) {
        output.appendLine('openReview: No changes to review.');
        vscode.window.showInformationMessage('No changes to review.');
        return;
    }

    output.appendLine(`openReview: [Audit] Starting review for ${allChanges.length} files.`);
    const title = 'Working Set Review';

    // 1. Prepare Resources with minimal property set
    const resources = allChanges.map(c => {
        const fullChange = getComprehensiveChange(c.uri, gitAPI) || c;
        const isAdd = fullChange.status === Status.UNTRACKED || fullChange.status === Status.INDEX_ADDED;
        const isDel = fullChange.status === Status.DELETED || fullChange.status === Status.INDEX_DELETED;

        // Use standard URI objects
        const original = isAdd ? EMPTY_URI : createGitUri(c.uri, 'HEAD');
        const modified = isDel ? EMPTY_URI : c.uri.with({ scheme: REVIEW_SCHEME, query: '', fragment: '' });

        return {
            original,
            modified,
            label: path.basename(c.uri.fsPath)
        };
    });

    /**
     * ATTEMPT 1: vscode.changes (Positional)
     * This is the most compatible way to trigger the "Changes" view.
     */
    try {
        output.appendLine(`openReview: Attempting vscode.changes(title, resources)`);
        // We pass the raw array of objects as the second argument.
        await vscode.commands.executeCommand('vscode.changes', title, resources);
        output.appendLine('openReview: vscode.changes execution command sent.');
        return;
    } catch (err) {
        output.appendLine(`openReview: vscode.changes failed: ${err}`);
    }

    /**
     * ATTEMPT 2: git.viewChanges (with Context)
     * If native view gets stuck, it might need the repository URI.
     */
    try {
        output.appendLine('openReview: Attempting git.viewChanges with repository context...');
        const repo = gitAPI.repositories[0];
        if (repo) {
            await vscode.commands.executeCommand('git.viewChanges', repo.rootUri);
            output.appendLine('openReview: git.viewChanges sent with rootUri.');
        } else {
            await vscode.commands.executeCommand('git.viewChanges');
            output.appendLine('openReview: git.viewChanges sent (no context).');
        }
        return;
    } catch (err) {
        output.appendLine(`openReview: git.viewChanges fallback failed: ${err}`);
    }

    output.appendLine('openReview: All review methods failed.');
    vscode.window.showErrorMessage('Unified Review is not supported in this environment.');
}
