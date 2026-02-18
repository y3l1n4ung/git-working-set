import * as vscode from 'vscode';
import { GitAPI } from '../types';
import { WorkingSetProvider } from '../providers/treeProvider';

/**
 * Review Mode - Simplified to use native Git view only.
 */
export async function openReview(
    _gitAPI: GitAPI,
    output: vscode.OutputChannel,
    treeDataProvider: WorkingSetProvider
) {
    const allChanges = treeDataProvider.getAllChanges();
    if (allChanges.length === 0) {
        vscode.window.showInformationMessage('No changes to review.');
        return;
    }

    output.appendLine(`openReview: Opening native changes view for ${allChanges.length} files.`);

    try {
        // Native Git Multi-Diff View
        await vscode.commands.executeCommand('git.viewChanges');
    } catch (err) {
        output.appendLine(`openReview: git.viewChanges failed: ${err}`);
        vscode.window.showErrorMessage('Could not open the Review View.');
    }
}
