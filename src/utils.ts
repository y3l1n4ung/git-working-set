import * as vscode from 'vscode';
import { GitAPI, Change } from './types';

/**
 * Finds the most comprehensive change for a URI (HEAD -> Working Tree)
 */
export function getComprehensiveChange(uri: vscode.Uri, gitAPI: GitAPI): Change | undefined {
    const target = uri.toString();
    const targetLower = target.toLowerCase();

    for (const repo of gitAPI.repositories) {
        const wtChanges = repo.state.workingTreeChanges;
        const idxChanges = repo.state.indexChanges;

        // 1. Try Exact Match (Preferred for Linux/Case-Sensitive)
        let wtChange = wtChanges.find(c => c.uri.toString() === target);
        let idxChange = idxChanges.find(c => c.uri.toString() === target);

        // 2. Fallback to Case-Insensitive (Needed for macOS/Windows)
        if (!wtChange) wtChange = wtChanges.find(c => c.uri.toString().toLowerCase() === targetLower);
        if (!idxChange) idxChange = idxChanges.find(c => c.uri.toString().toLowerCase() === targetLower);

        if (wtChange && idxChange) {
            return {
                uri: wtChange.uri,
                originalUri: idxChange.originalUri,
                status: wtChange.status
            };
        }
        if (wtChange) return wtChange;
        if (idxChange) return idxChange;
    }
    return undefined;
}

/**
 * Helper to create a Git URI for a specific reference (HEAD, Index, etc.)
 */
export function createGitUri(uri: vscode.Uri, ref: string): vscode.Uri {
    return uri.with({
        scheme: 'git',
        query: JSON.stringify({
            path: uri.fsPath,
            ref: ref
        })
    });
}
