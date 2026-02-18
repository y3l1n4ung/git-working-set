import * as vscode from 'vscode';
import { GitAPI, Change } from './types';

/**
 * Finds the most comprehensive change for a URI (HEAD -> Working Tree)
 */
export function getComprehensiveChange(uri: vscode.Uri, gitAPI: GitAPI): Change | undefined {
    const target = uri.toString().toLowerCase();

    for (const repo of gitAPI.repositories) {
        const wtChange = repo.state.workingTreeChanges.find(c => c.uri.toString().toLowerCase() === target);
        const idxChange = repo.state.indexChanges.find(c => c.uri.toString().toLowerCase() === target);

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
