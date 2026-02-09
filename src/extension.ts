import * as vscode from 'vscode';
import * as path from 'path';

/**
 * Partial Git Extension API interface
 */
interface GitExtension {
    getAPI(version: number): GitAPI;
}

interface GitAPI {
    repositories: Repository[];
    onDidOpenRepository: vscode.Event<Repository>;
    onDidCloseRepository: vscode.Event<Repository>;
}

interface Repository {
    rootUri: vscode.Uri;
    state: RepositoryState;
}

interface RepositoryState {
    workingTreeChanges: Change[];
    indexChanges: Change[];
    onDidChange: vscode.Event<void>;
}

interface Change {
    uri: vscode.Uri;
}

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

    context.subscriptions.push(
        vscode.commands.registerCommand('git-working-set.openFile', (resource: vscode.Uri) => {
            vscode.window.showTextDocument(resource);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('git-working-set.refresh', () => {
            treeDataProvider.updateRepositories();
        })
    );
}

interface TreeNode {
    __uri?: vscode.Uri;
    __isFolder?: boolean;
    [key: string]: TreeNode | vscode.Uri | boolean | undefined;
}

class WorkingSetProvider implements vscode.TreeDataProvider<TreeItem> {
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

    async getChildren(element?: TreeItem): Promise<TreeItem[]> {
        if (!element) {
            // Root level: Show repositories if multiple, or merged files if single
            if (this.repositories.length === 0) {
                return [];
            }
            
            // Build the tree for all repositories
            const allChanges = this.repositories.flatMap(repo => [
                ...repo.state.workingTreeChanges,
                ...repo.state.indexChanges
            ]);
            
            // Remove duplicates (e.g. file in both working tree and index)
            const uniqueUris = Array.from(new Set(allChanges.map(c => c.uri.toString())))
                .map(uriStr => vscode.Uri.parse(uriStr));

            if (uniqueUris.length === 0) {
                return [];
            }

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
                    command: 'vscode.open',
                    title: 'Open File',
                    arguments: [uri]
                };
            }

            items.push(item);
        }

        // Sort: Folders first, then alphabetically
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

class TreeItem extends vscode.TreeItem {
    children?: TreeItem[];

    constructor(
        public readonly label: string,
        public readonly resourceUri: vscode.Uri,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly isFolder: boolean
    ) {
        super(label, collapsibleState);
        
        this.resourceUri = resourceUri;
        if (!isFolder) {
            this.contextValue = 'file';
        } else {
            this.contextValue = 'folder';
        }
    }
}
