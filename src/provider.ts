import * as vscode from 'vscode';
import * as path from 'path';
import { GitAPI, Repository, Change, TreeNode } from './types';
import { TreeItem } from './treeItem';

export class WorkingSetProvider implements vscode.TreeDataProvider<TreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<TreeItem | undefined | void> = new vscode.EventEmitter<TreeItem | undefined | void>();
    readonly onDidChangeTreeData: vscode.Event<TreeItem | undefined | void> = this._onDidChangeTreeData.event;

    private repositories: Repository[] = [];
    private disposables: vscode.Disposable[] = [];

    constructor(private gitAPI: GitAPI, private output: vscode.OutputChannel) {
        this.output.appendLine('Initializing Working Set View...');
        this.updateRepositories();
        
        this.disposables.push(gitAPI.onDidOpenRepository(() => {
            this.output.appendLine('Repository opened, updating...');
            this.updateRepositories();
        }));
        this.disposables.push(gitAPI.onDidCloseRepository(() => {
            this.output.appendLine('Repository closed, updating...');
            this.updateRepositories();
        }));
    }

    public updateRepositories() {
        this.output.appendLine('Updating repositories...');
        this.disposables.forEach(d => d.dispose());
        this.disposables = [];
        
        this.repositories = this.gitAPI.repositories;
        this.output.appendLine(`Found ${this.repositories.length} repositories.`);
        
        this.repositories.forEach((repo, index) => {
            this.output.appendLine(`Listening to repository ${index}: ${repo.rootUri.fsPath}`);
            this.disposables.push(repo.state.onDidChange(() => {
                this.output.appendLine(`Changes detected in repository ${index}`);
                this.refresh();
            }));
        });
        
        this.refresh();
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: TreeItem): vscode.TreeItem {
        return element;
    }

    public getAllChanges(): Change[] {
        const allChanges = this.repositories.flatMap(repo => [
            ...repo.state.workingTreeChanges,
            ...repo.state.indexChanges
        ]);
        
        const uniqueChanges: Change[] = [];
        const seenUris = new Set<string>();
        
        for (const change of allChanges) {
            const uriStr = change.uri.toString();
            if (!seenUris.has(uriStr)) {
                seenUris.add(uriStr);
                uniqueChanges.push(change);
            }
        }
        
        return uniqueChanges;
    }

    async getChildren(element?: TreeItem): Promise<TreeItem[]> {
        if (!element) {
            if (this.repositories.length === 0) return [];
            const uniqueUris = this.getAllChanges().map(c => c.uri);
            if (uniqueUris.length === 0) return [];
            return this.buildHierarchy(uniqueUris);
        }
        return element.children || [];
    }

    private buildHierarchy(uris: vscode.Uri[]): TreeItem[] {
        const root: TreeNode = {};
        for (const uri of uris) {
            const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
            if (!workspaceFolder) continue;
            const relativePath = path.relative(workspaceFolder.uri.fsPath, uri.fsPath);
            const parts = relativePath.split(path.sep);
            let current = root;
            let currentPath = workspaceFolder.uri.fsPath;
            for (let i = 0; i < parts.length; i++) {
                const part = parts[i];
                currentPath = path.join(currentPath, part);
                if (!current[part]) {
                    current[part] = {
                        __uri: vscode.Uri.file(currentPath),
                        __isFolder: i < parts.length - 1
                    } as TreeNode;
                }
                current = current[part] as TreeNode;
            }
        }
        return this.mapToTreeItems(root);
    }

    private mapToTreeItems(node: TreeNode): TreeItem[] {
        const items: TreeItem[] = [];
        for (const key in node) {
            if (key === '__uri' || key === '__isFolder') continue;
            const childNode = node[key] as TreeNode;
            const uri = childNode.__uri!;
            const isFolder = childNode.__isFolder!;
            const item = new TreeItem(
                key,
                uri,
                isFolder ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None,
                isFolder
            );
            if (isFolder) {
                item.children = this.mapToTreeItems(childNode);
            } else {
                item.command = {
                    command: 'git-working-set.openDiff',
                    title: 'Open Changes',
                    arguments: [item]
                };
            }
            items.push(item);
        }
        return items.sort((a, b) => {
            if (a.isFolder && !b.isFolder) return -1;
            if (!a.isFolder && b.isFolder) return 1;
            return a.label!.toString().localeCompare(b.label!.toString());
        });
    }

    dispose() {
        this.disposables.forEach(d => d.dispose());
    }
}
