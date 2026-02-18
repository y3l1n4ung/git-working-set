import * as vscode from 'vscode';

export const EMPTY_URI = vscode.Uri.parse('git-working-set-empty:/empty');
export const REVIEW_SCHEME = 'git-working-set-review';

/**
 * Provides empty content for new files in diff
 */
export class EmptyContentProvider implements vscode.TextDocumentContentProvider {
    provideTextDocumentContent(): string {
        return '';
    }
}

/**
 * Wraps file content to provide a read-only view for Review Mode
 */
export class ReadOnlyProvider implements vscode.TextDocumentContentProvider {
    constructor(private output: vscode.OutputChannel) {}

    async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
        // Construct a clean file URI from the virtual URI's path
        const fileUri = vscode.Uri.file(uri.fsPath);
        
        try {
            // Attempt to get current editor content (including unsaved changes)
            const doc = await vscode.workspace.openTextDocument(fileUri);
            return doc.getText();
        } catch {
            this.output.appendLine(`ReadOnlyProvider: openTextDocument failed, trying fs.readFile for ${uri.path}`);
            try {
                const bytes = await vscode.workspace.fs.readFile(fileUri);
                return Buffer.from(bytes).toString('utf8');
            } catch (innerErr) {
                this.output.appendLine(`ReadOnlyProvider Error: ${innerErr} for path: ${uri.path}`);
                return ''; 
            }
        }
    }
}
