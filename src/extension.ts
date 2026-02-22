import * as vscode from 'vscode';
import { GitExtension } from './types';
import { WorkingSetProvider } from './providers/treeProvider';
import { EmptyContentProvider, ReadOnlyProvider, REVIEW_SCHEME } from './providers/contentProvider';
import { 
    openFile, openDiff, openReview, revealInOS, copyPath, copyRelativePath,
    openToSide, findInFolder, openInTerminal, selectForCompare, compareWithSelected 
} from './commands';

export async function activate(context: vscode.ExtensionContext) {
    const outputChannel = vscode.window.createOutputChannel('Git Working Set');
    context.subscriptions.push(outputChannel);
    outputChannel.appendLine('Activating Git Working Set extension...');
    
    // Content Providers
    context.subscriptions.push(
        vscode.workspace.registerTextDocumentContentProvider('git-working-set-empty', new EmptyContentProvider()),
        vscode.workspace.registerTextDocumentContentProvider(REVIEW_SCHEME, new ReadOnlyProvider(outputChannel))
    );

    const gitExtension = vscode.extensions.getExtension<GitExtension>('vscode.git');
    if (!gitExtension) {
        vscode.window.showErrorMessage('Git extension not found.');
        return;
    }

    if (!gitExtension.isActive) {
        await gitExtension.activate();
    }

    const gitAPI = gitExtension.exports.getAPI(1);
    
    // Providers
    const treeDataProvider = new WorkingSetProvider(gitAPI, outputChannel);
    context.subscriptions.push(treeDataProvider);
    
    // Views
    const treeView = vscode.window.createTreeView('git-working-set', {
        treeDataProvider: treeDataProvider,
        showCollapseAll: false
    });
    treeDataProvider.view = treeView;
    context.subscriptions.push(treeView);

    // Commands
    context.subscriptions.push(
        vscode.commands.registerCommand('git-working-set.openFile', openFile),
        vscode.commands.registerCommand('git-working-set.openDiff', (item) => openDiff(item, gitAPI, outputChannel)),
        vscode.commands.registerCommand('git-working-set.openReview', () => openReview(gitAPI, outputChannel, treeDataProvider)),
        vscode.commands.registerCommand('git-working-set.refresh', () => treeDataProvider.updateRepositories()),
        
        // Helpers
        vscode.commands.registerCommand('git-working-set.revealInOS', revealInOS),
        vscode.commands.registerCommand('git-working-set.copyPath', copyPath),
        vscode.commands.registerCommand('git-working-set.copyRelativePath', copyRelativePath),
        vscode.commands.registerCommand('git-working-set.openToSide', openToSide),
        vscode.commands.registerCommand('git-working-set.findInFolder', findInFolder),
        vscode.commands.registerCommand('git-working-set.openInTerminal', openInTerminal),
        vscode.commands.registerCommand('git-working-set.selectForCompare', selectForCompare),
        vscode.commands.registerCommand('git-working-set.compareWithSelected', compareWithSelected),
        vscode.commands.registerCommand('git-working-set.focus', () => {
            vscode.commands.executeCommand('workbench.view.extension.git-working-set');
        })
    );
}
