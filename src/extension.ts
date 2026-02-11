import * as vscode from 'vscode';
import * as path from 'path';
import { GitExtension, Change } from './types';
import { TreeItem } from './treeItem';
import { WorkingSetProvider } from './provider';

let outputChannel: vscode.OutputChannel;

export async function activate(context: vscode.ExtensionContext) {
    outputChannel = vscode.window.createOutputChannel('Git Working Set');
    outputChannel.appendLine('Activating Git Working Set extension...');
    
    const gitExtension = vscode.extensions.getExtension<GitExtension>('vscode.git');
    if (!gitExtension) {
        outputChannel.appendLine('Error: Git extension not found.');
        vscode.window.showErrorMessage('Git extension not found.');
        return;
    }

    if (!gitExtension.isActive) {
        outputChannel.appendLine('Activating Git extension...');
        await gitExtension.activate();
    }

    const gitAPI = gitExtension.exports.getAPI(1);
    outputChannel.appendLine('Git API obtained.');
    
    const treeDataProvider = new WorkingSetProvider(gitAPI, outputChannel);
    
    // Initial check and retry if no repositories found
    if (gitAPI.repositories.length === 0) {
        outputChannel.appendLine('No repositories found immediately. Waiting for discovery...');
        const checkInterval = setInterval(() => {
            if (gitAPI.repositories.length > 0) {
                outputChannel.appendLine(`Discovered ${gitAPI.repositories.length} repositories.`);
                treeDataProvider.updateRepositories();
                clearInterval(checkInterval);
            }
        }, 1000);
        
        // Stop checking after 10 seconds to avoid infinite loop
        setTimeout(() => clearInterval(checkInterval), 10000);
    }
    
    context.subscriptions.push(
        vscode.window.registerTreeDataProvider('git-working-set', treeDataProvider)
    );

    /**
     * Helper to create a Git URI for a specific reference (HEAD, Index, etc.)
     */
    function createGitUri(uri: vscode.Uri, ref: string): vscode.Uri {
        return uri.with({
            scheme: 'git',
            query: JSON.stringify({
                path: uri.fsPath,
                ref: ref
            })
        });
    }

    /**
     * Finds the most comprehensive change for a URI (HEAD -> Working Tree)
     */
    function getComprehensiveChange(uri: vscode.Uri): Change | undefined {
        outputChannel.appendLine(`Searching for comprehensive change: ${uri.fsPath}`);
        for (const repo of gitAPI.repositories) {
            const wtChange = repo.state.workingTreeChanges.find(c => c.uri.toString() === uri.toString());
            const idxChange = repo.state.indexChanges.find(c => c.uri.toString() === uri.toString());

            if (wtChange && idxChange) {
                outputChannel.appendLine(`  - Found partially staged change. Base: HEAD`);
                return {
                    uri: wtChange.uri,
                    originalUri: idxChange.originalUri // idxChange.originalUri points to HEAD
                };
            }
            if (wtChange) {
                outputChannel.appendLine(`  - Found working tree change. Base: Index/HEAD`);
                return wtChange;
            }
            if (idxChange) {
                outputChannel.appendLine(`  - Found index change. Base: HEAD`);
                return idxChange;
            }
        }
        outputChannel.appendLine(`  - No specific change found in Git state.`);
        return undefined;
    }

    /**
     * Shared logic to open diffs in the best available format
     */
    async function openReview(changes: Change[], label: string = 'Working Set Review') {
        if (changes.length === 0) {
            vscode.window.showInformationMessage('No changes to review.');
            return;
        }

        outputChannel.appendLine(`Attempting to open review for ${changes.length} file(s)`);
        const allCommands = await vscode.commands.getCommands(true);

        // For a SINGLE file, vscode.diff is the most reliable way to get high-quality side-by-side
        if (changes.length === 1) {
            const change = changes[0];
            let original = change.originalUri;
            
            if (!original) {
                // Try to create a dummy "empty" URI for untracked files left side
                original = createGitUri(change.uri, 'HEAD');
            }

            outputChannel.appendLine(`Opening side-by-side diff for: ${change.uri.fsPath}`);
            try {
                await vscode.commands.executeCommand('vscode.diff', original, change.uri, `${path.basename(change.uri.fsPath)} (Review Mode)`);
                return;
            } catch (err) {
                outputChannel.appendLine(`vscode.diff failed: ${err}. Falling back to git.openChange.`);
                await vscode.commands.executeCommand('git.openChange', change.uri);
                return;
            }
        }

        // For MULTIPLE files, attempt the native Multi-Diff experience
        outputChannel.appendLine(`Multi-file processing...`);
        
        // Preference 1: git.viewChanges (Native Git Multi-Diff)
        if (allCommands.includes('git.viewChanges')) {
            outputChannel.appendLine('Using native command: git.viewChanges');
            await vscode.commands.executeCommand('git.viewChanges');
            return;
        }

        // Preference 2: vscode.changes
        if (allCommands.includes('vscode.changes')) {
            outputChannel.appendLine('Using command: vscode.changes');
            try {
                const resources = changes.map(c => ({
                    original: c.originalUri || createGitUri(c.uri, 'HEAD'),
                    modified: c.uri,
                    label: path.basename(c.uri.fsPath)
                }));
                await vscode.commands.executeCommand('vscode.changes', {
                    title: label,
                    resources
                });
                return;
            } catch (err) {
                outputChannel.appendLine(`vscode.changes failed: ${err}`);
            }
        }

        // Preference 3: vscode.openMultiDiff (1.88+)
        if (allCommands.includes('vscode.openMultiDiff')) {
            outputChannel.appendLine('Using command: vscode.openMultiDiff');
            try {
                const resources = changes.map(c => ({
                    original: c.originalUri || createGitUri(c.uri, 'HEAD'),
                    modified: c.uri
                }));
                await vscode.commands.executeCommand('vscode.openMultiDiff', { resources, label });
                return;
            } catch (err) {
                outputChannel.appendLine(`vscode.openMultiDiff failed: ${err}`);
            }
        }

        // Final fallback: standard multi-tab
        if (allCommands.includes('git.openAllChanges')) {
            outputChannel.appendLine('Using fallback: git.openAllChanges');
            await vscode.commands.executeCommand('git.openAllChanges');
            return;
        }

        vscode.window.showErrorMessage('Review Mode is not fully supported in this build.');
    }

    context.subscriptions.push(
        vscode.commands.registerCommand('git-working-set.openFile', (item: TreeItem) => {
            const uri = item.resourceUri;
            if (uri) {
                vscode.commands.executeCommand('vscode.open', uri);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('git-working-set.revealInOS', (item: TreeItem) => {
            const uri = item.resourceUri;
            if (uri) {
                vscode.commands.executeCommand('revealFileInOS', uri);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('git-working-set.copyPath', (item: TreeItem) => {
            const uri = item.resourceUri;
            if (uri) {
                vscode.env.clipboard.writeText(uri.fsPath);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('git-working-set.copyRelativePath', (item: TreeItem) => {
            const uri = item.resourceUri;
            if (uri) {
                const relativePath = vscode.workspace.asRelativePath(uri);
                vscode.env.clipboard.writeText(relativePath);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('git-working-set.openDiff', async (item: TreeItem) => {
            outputChannel.appendLine(`Command git-working-set.openDiff triggered for: ${item.resourceUri?.fsPath}`);
            const uri = item.resourceUri;
            if (!uri) return;

            const change = getComprehensiveChange(uri);
            if (change) {
                await openReview([change]);
            } else {
                outputChannel.appendLine(`No Git change found for URI, falling back to git.openChange`);
                await vscode.commands.executeCommand('git.openChange', uri);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('git-working-set.openReview', async () => {
            outputChannel.appendLine(`Command git-working-set.openReview triggered`);
            const allChanges = treeDataProvider.getAllChanges();
            const comprehensiveChanges = allChanges.map(c => getComprehensiveChange(c.uri) || c);
            await openReview(comprehensiveChanges);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('git-working-set.refresh', () => {
            treeDataProvider.updateRepositories();
        })
    );
}
