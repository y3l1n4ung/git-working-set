import * as vscode from 'vscode';
import { TreeItem } from '../treeItem';

export async function openFile(item: TreeItem | { resourceUri: vscode.Uri }) {
    const uri = item.resourceUri;
    if (uri) {
        await vscode.commands.executeCommand('vscode.open', uri);
    }
}

export function revealInOS(item: TreeItem) {
    if (item.resourceUri) {
        vscode.commands.executeCommand('revealFileInOS', item.resourceUri);
    }
}

export function copyPath(item: TreeItem) {
    if (item.resourceUri) {
        vscode.env.clipboard.writeText(item.resourceUri.fsPath);
    }
}

export function copyRelativePath(item: TreeItem) {
    if (item.resourceUri) {
        vscode.env.clipboard.writeText(vscode.workspace.asRelativePath(item.resourceUri));
    }
}
