import * as vscode from 'vscode';
import * as path from 'path';
import { GitAPI, Status } from '../types';
import { TreeItem } from '../treeItem';
import { WorkingSetProvider } from '../providers/treeProvider';
import { getComprehensiveChange } from '../utils';

export async function revert(
    item: TreeItem | { resourceUri: vscode.Uri },
    gitAPI: GitAPI,
    output: vscode.OutputChannel,
    treeDataProvider: WorkingSetProvider
) {
    const uri = item.resourceUri;
    if (!uri) return;

    // Find change to check status
    const change = getComprehensiveChange(uri, gitAPI);

    if (!change) {
        output.appendLine(`Revert: No Git status found for ${uri.fsPath}`);
        return;
    }

    const isUntracked = change.status === Status.UNTRACKED;
    const action = isUntracked ? 'Clean' : 'Discard';
    
    const confirm = await vscode.window.showWarningMessage(
        `Are you sure you want to ${action.toLowerCase()} changes in ${path.basename(uri.fsPath)}?`,
        { modal: true },
        action
    );

    if (confirm === action) {
        output.appendLine(`Executing ${action} for: ${uri.fsPath}`);
        try {
            const repo = gitAPI.repositories.find(r => 
                vscode.workspace.getWorkspaceFolder(uri)?.uri.toString() === r.rootUri.toString()
            ) || gitAPI.repositories[0];

            if (isUntracked) {
                await repo.clean([uri.fsPath]);
            } else {
                await repo.checkout('HEAD', [uri.fsPath]);
            }
            
            output.appendLine(`  - ${action} successful via direct API.`);
            
            // Forces refresh
            setTimeout(() => treeDataProvider.updateRepositories(), 500);

        } catch (err) {
            output.appendLine(`${action} failed: ${err}`);
            // Fallback to generic commands
            try {
                const cmd = isUntracked ? 'git.clean' : 'git.checkout';
                await vscode.commands.executeCommand(cmd, uri);
                treeDataProvider.updateRepositories();
            } catch {
                vscode.window.showErrorMessage(`${action} failed. Check Git output.`);
            }
        }
    }
}
