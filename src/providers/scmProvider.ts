import * as vscode from 'vscode';
import * as path from 'path';
import { Change } from '../types';

export class WorkingSetSCM {
    private scm: vscode.SourceControl;
    private group: vscode.SourceControlResourceGroup;

    constructor(_context: vscode.ExtensionContext, private output: vscode.OutputChannel) {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri;
        this.scm = vscode.scm.createSourceControl('git-working-set-scm', 'Git Working Set', workspaceRoot);
        this.group = this.scm.createResourceGroup('workingSet', 'Working Set Changes');
        
        this.scm.inputBox.placeholder = 'Working Set Review';
        this.scm.quickDiffProvider = {
            provideOriginalResource: () => undefined
        };

        _context.subscriptions.push(this.scm);
    }

    public updateChanges(changes: Change[]) {
        this.output.appendLine(`Updating SCM with ${changes.length} changes`);
        this.group.resourceStates = changes.map(change => ({
            resourceUri: change.uri,
            command: {
                command: 'git-working-set.openFile',
                title: 'Open File',
                arguments: [{ resourceUri: change.uri }]
            },
            decorations: {
                tooltip: `Working Set: ${path.basename(change.uri.fsPath)}`
            }
        }));
    }
}
