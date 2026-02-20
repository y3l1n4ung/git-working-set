import * as vscode from 'vscode';
import * as path from 'path';
import { GitAPI, Status } from '../types';
import { TreeItem } from '../treeItem';
import { EMPTY_URI, REVIEW_SCHEME } from '../providers/contentProvider';
import { getComprehensiveChange, createGitUri } from '../utils';

export async function openDiff(
    item: TreeItem | { resourceUri: vscode.Uri },
    gitAPI: GitAPI,
    output: vscode.OutputChannel
) {
    const uri = item.resourceUri;
    if (!uri) return;

    const change = getComprehensiveChange(uri, gitAPI);
    const fileName = path.basename(uri.fsPath);

    if (change) {
        const isAddition = change.status === Status.INDEX_ADDED || 
                           change.status === Status.UNTRACKED ||
                           change.status === Status.ADDED_BY_US ||
                           change.status === Status.ADDED_BY_THEM ||
                           change.status === Status.BOTH_ADDED;

        const isDeletion = change.status === Status.INDEX_DELETED || 
                           change.status === Status.DELETED ||
                           change.status === Status.DELETED_BY_US ||
                           change.status === Status.DELETED_BY_THEM ||
                           change.status === Status.BOTH_DELETED;
        
        const original = isAddition ? EMPTY_URI : createGitUri(uri, 'HEAD');
        const modified = isDeletion ? EMPTY_URI : uri.with({ scheme: REVIEW_SCHEME, query: '', fragment: '' });

        try {
            const title = `[HEAD] ${fileName} - [Review]`;
            await vscode.commands.executeCommand('vscode.diff', original, modified, title, { readOnly: true, preview: true });
        } catch (err) {
            output.appendLine(`vscode.diff failed: ${err}. Attempting git.openChange fallback.`);
            try {
                await vscode.commands.executeCommand('git.openChange', uri);
            } catch (fallbackErr) {
                output.appendLine(`git.openChange fallback failed: ${fallbackErr}`);
                vscode.window.showErrorMessage(`Could not open diff for ${fileName}`);
            }
        }
    } else {
        try {
            await vscode.commands.executeCommand('git.openChange', uri);
        } catch (err) {
            output.appendLine(`git.openChange failed: ${err}`);
        }
    }
}
