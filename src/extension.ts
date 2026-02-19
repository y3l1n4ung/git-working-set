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
    
    // Views
    context.subscriptions.push(
        vscode.window.registerTreeDataProvider('git-working-set', treeDataProvider)
    );

    // Commands
    context.subscriptions.push(
        vscode.commands.registerCommand('git-working-set.openFile', (item) => openFile(item)),
        vscode.commands.registerCommand('git-working-set.openDiff', (item) => openDiff(item, gitAPI, outputChannel)),
        vscode.commands.registerCommand('git-working-set.openReview', () => openReview(gitAPI, outputChannel, treeDataProvider)),
        vscode.commands.registerCommand('git-working-set.refresh', () => treeDataProvider.updateRepositories()),
        
        // Helpers
        vscode.commands.registerCommand('git-working-set.revealInOS', (item) => revealInOS(item)),
        vscode.commands.registerCommand('git-working-set.copyPath', (item) => copyPath(item)),
        vscode.commands.registerCommand('git-working-set.copyRelativePath', (item) => copyRelativePath(item)),
        vscode.commands.registerCommand('git-working-set.openToSide', (item) => openToSide(item)),
        vscode.commands.registerCommand('git-working-set.findInFolder', (item) => findInFolder(item)),
        vscode.commands.registerCommand('git-working-set.openInTerminal', (item) => openInTerminal(item)),
        vscode.commands.registerCommand('git-working-set.selectForCompare', (item) => selectForCompare(item)),
        vscode.commands.registerCommand('git-working-set.compareWithSelected', (item) => compareWithSelected(item))
    );
}
