import * as vscode from 'vscode';

export class TreeItem extends vscode.TreeItem {
    children?: TreeItem[];
    constructor(
        public readonly label: string,
        public readonly resourceUri: vscode.Uri,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly isFolder: boolean
    ) {
        super(label, collapsibleState);
        this.resourceUri = resourceUri;
        this.contextValue = isFolder ? 'folder' : 'file';
    }
}
