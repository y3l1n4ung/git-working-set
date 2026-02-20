import * as vscode from 'vscode';
import * as path from 'path';
import { GitAPI, Repository, Change, TreeNode } from '../types';
import { TreeItem } from '../treeItem';

export class WorkingSetProvider implements vscode.TreeDataProvider<TreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<TreeItem | undefined | void> = new vscode.EventEmitter<TreeItem | undefined | void>();
    readonly onDidChangeTreeData: vscode.Event<TreeItem | undefined | void> = this._onDidChangeTreeData.event;

    public repositories: Repository[] = [];
    private repoDisposables: vscode.Disposable[] = [];
    private lifeCycleDisposables: vscode.Disposable[] = [];
    private _view: vscode.TreeView<TreeItem> | undefined;
    private refreshTimer: NodeJS.Timeout | undefined;
    private isDisposed = false;

    // Cache for diff stats per repository
    private diffStatsCache: Map<string, { additions: number, deletions: number }> = new Map();

    constructor(private gitAPI: GitAPI, private output: vscode.OutputChannel) {
        this.output.appendLine('Initializing Working Set View...');
        
        // Listen for new repositories
        this.lifeCycleDisposables.push(gitAPI.onDidOpenRepository(() => {
            this.output.appendLine('Repository opened event, updating...');
            this.updateRepositories();
        }));
        this.lifeCycleDisposables.push(gitAPI.onDidCloseRepository(() => {
            this.output.appendLine('Repository closed event, updating...');
            this.updateRepositories();
        }));

        // Initial load
        if (gitAPI.repositories.length > 0) {
            this.updateRepositories();
        }
    }

    public set view(view: vscode.TreeView<TreeItem>) {
        this._view = view;
    }

    public updateRepositories() {
        if (this.isDisposed) return;
        this.output.appendLine('Updating repositories and listeners...');
        
        this.repoDisposables.forEach(d => d.dispose());
        this.repoDisposables = [];
        this.diffStatsCache.clear();
        
        this.repositories = this.gitAPI.repositories;
        this.output.appendLine(`Found ${this.repositories.length} repositories.`);
        
        this.repositories.forEach((repo, index) => {
            this.output.appendLine(`Listening to repository ${index}: ${repo.rootUri.fsPath}`);
            this.repoDisposables.push(repo.state.onDidChange(() => {
                this.diffStatsCache.delete(repo.rootUri.toString());
                this.refresh(index);
            }));
        });
        
        this.refresh();
    }

    refresh(repoIndex?: number): void {
        if (this.isDisposed) return;

        if (this.refreshTimer) {
            clearTimeout(this.refreshTimer);
        }
        this.refreshTimer = setTimeout(async () => {
            if (this.isDisposed) return;

            if (repoIndex !== undefined) {
                this.output.appendLine(`Processing debounced changes for repository ${repoIndex}`);
            }
            this._onDidChangeTreeData.fire(undefined);
            await this.updateTitle();
            this.refreshTimer = undefined;
        }, 300);
    }

    private async updateTitle() {
        if (!this._view || this.isDisposed) return;

        let totalAdditions = 0;
        let totalDeletions = 0;

        for (const repo of this.repositories) {
            const repoUriStr = repo.rootUri.toString();
            let stats = this.diffStatsCache.get(repoUriStr);

            if (!stats) {
                try {
                    const diff = await repo.diff();
                    const lines = diff.split('\n');
                    let additions = 0;
                    let deletions = 0;
                    for (const line of lines) {
                        if (line.startsWith('+') && !line.startsWith('+++')) additions++;
                        if (line.startsWith('-') && !line.startsWith('---')) deletions++;
                    }
                    stats = { additions, deletions };
                    this.diffStatsCache.set(repoUriStr, stats);
                } catch {
                    stats = { additions: 0, deletions: 0 };
                }
            }
            totalAdditions += stats.additions;
            totalDeletions += stats.deletions;
        }

        const allChanges = this.getAllChanges();
        this._view.badge = {
            value: allChanges.length,
            tooltip: `${allChanges.length} files changed in working set`
        };

        let statsText = '';
        if (totalAdditions > 0 || totalDeletions > 0) {
            statsText = ` (+${totalAdditions} -${totalDeletions})`;
        }
        
        this._view.title = `Working Set${statsText}`;
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
        const root: Record<string, TreeNode> = {};
        for (const uri of uris) {
            const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
            if (!workspaceFolder) continue;

            const folderKey = workspaceFolder.name;
            if (!root[folderKey]) {
                root[folderKey] = {
                    __uri: workspaceFolder.uri,
                    __isFolder: true,
                    children: {}
                };
            }

            const relativePath = path.relative(workspaceFolder.uri.fsPath, uri.fsPath);
            const parts = relativePath.split(path.sep);
            let current = root[folderKey];
            let currentPath = workspaceFolder.uri.fsPath;

            for (let i = 0; i < parts.length; i++) {
                const part = parts[i];
                if (!part) continue;
                currentPath = path.join(currentPath, part);
                
                if (!current.children) {
                    current.children = {};
                }

                if (!current.children[part]) {
                    current.children[part] = {
                        __uri: vscode.Uri.file(currentPath),
                        __isFolder: i < parts.length - 1,
                        children: {}
                    };
                }
                current = current.children[part];
            }
        }
        return this.mapToTreeItems(root);
    }

    private mapToTreeItems(nodes: Record<string, TreeNode>): TreeItem[] {
        const items: TreeItem[] = [];
        for (const key in nodes) {
            const node = nodes[key];
            const item = new TreeItem(
                key,
                node.__uri,
                node.__isFolder ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None,
                node.__isFolder
            );
            if (node.__isFolder && node.children) {
                item.children = this.mapToTreeItems(node.children);
            } else {
                item.command = {
                    command: 'git-working-set.openFile',
                    title: 'Open File',
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
        this.isDisposed = true;
        if (this.refreshTimer) {
            clearTimeout(this.refreshTimer);
            this.refreshTimer = undefined;
        }
        this.lifeCycleDisposables.forEach(d => d.dispose());
        this.repoDisposables.forEach(d => d.dispose());
        this.diffStatsCache.clear();
    }
}
