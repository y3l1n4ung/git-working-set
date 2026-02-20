import * as vscode from 'vscode';
import { TreeItem } from '../treeItem';

export async function openFile(item: TreeItem | { resourceUri: vscode.Uri }) {
    const uri = item.resourceUri;
    if (uri) {
        return vscode.commands.executeCommand('vscode.open', uri);
    }
}

export function revealInOS(item: TreeItem) {
    if (item.resourceUri) {
        return vscode.commands.executeCommand('revealFileInOS', item.resourceUri);
    }
}

export function copyPath(item: TreeItem) {
    if (item.resourceUri) {
        return vscode.env.clipboard.writeText(item.resourceUri.fsPath);
    }
}

export function copyRelativePath(item: TreeItem) {
    if (item.resourceUri) {
        return vscode.env.clipboard.writeText(vscode.workspace.asRelativePath(item.resourceUri));
    }
}

export async function openToSide(item: TreeItem) {
    if (item.resourceUri) {
        return vscode.commands.executeCommand('vscode.open', item.resourceUri, {
            viewColumn: vscode.ViewColumn.Beside,
            preserveFocus: false
        });
    }
}

export function findInFolder(item: TreeItem) {
    if (item.resourceUri && item.isFolder) {
        return vscode.commands.executeCommand('filesExplorer.findInFolder', item.resourceUri);
    }
}

export function openInTerminal(item: TreeItem) {
    if (item.resourceUri && item.isFolder) {
        return vscode.commands.executeCommand('openInTerminal', item.resourceUri);
    }
}

export function selectForCompare(item: TreeItem) {
    if (item.resourceUri) {
        return vscode.commands.executeCommand('selectForCompare', item.resourceUri);
    }
}

export function compareWithSelected(item: TreeItem) {
    if (item.resourceUri) {
        return vscode.commands.executeCommand('compareFiles', item.resourceUri);
    }
}
