"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
function activate(context) {
    const gitExtension = vscode.extensions.getExtension('vscode.git')?.exports;
    if (!gitExtension) {
        vscode.window.showErrorMessage('Git extension not found.');
        return;
    }
    const gitAPI = gitExtension.getAPI(1);
    const treeDataProvider = new WorkingSetProvider(gitAPI);
    context.subscriptions.push(vscode.window.registerTreeDataProvider('git-working-set', treeDataProvider));
    context.subscriptions.push(vscode.commands.registerCommand('git-working-set.openFile', (resource) => {
        vscode.window.showTextDocument(resource);
    }));
}
class WorkingSetProvider {
    constructor(gitAPI) {
        this.gitAPI = gitAPI;
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this.repositories = [];
        this.disposables = [];
        this.updateRepositories();
        this.disposables.push(gitAPI.onDidOpenRepository(() => this.updateRepositories()));
        this.disposables.push(gitAPI.onDidCloseRepository(() => this.updateRepositories()));
    }
    updateRepositories() {
        this.disposables.forEach(d => d.dispose());
        this.disposables = [];
        this.repositories = this.gitAPI.repositories;
        this.repositories.forEach(repo => {
            this.disposables.push(repo.state.onDidChange(() => this.refresh()));
        });
        this.refresh();
    }
    refresh() {
        this._onDidChangeTreeData.fire();
    }
    getTreeItem(element) {
        return element;
    }
    async getChildren(element) {
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
    buildHierarchy(uris) {
        const root = {};
        for (const uri of uris) {
            const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
            if (!workspaceFolder)
                continue;
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
                    };
                }
                current = current[part];
            }
        }
        return this.mapToTreeItems(root);
    }
    mapToTreeItems(node) {
        const items = [];
        for (const key in node) {
            if (key === '__uri' || key === '__isFolder')
                continue;
            const childNode = node[key];
            const uri = childNode.__uri;
            const isFolder = childNode.__isFolder;
            const item = new TreeItem(key, uri, isFolder ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None, isFolder);
            if (isFolder) {
                item.children = this.mapToTreeItems(childNode);
            }
            else {
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
            if (a.isFolder && !b.isFolder)
                return -1;
            if (!a.isFolder && b.isFolder)
                return 1;
            return a.label.toString().localeCompare(b.label.toString());
        });
    }
    dispose() {
        this.disposables.forEach(d => d.dispose());
    }
}
class TreeItem extends vscode.TreeItem {
    constructor(label, resourceUri, collapsibleState, isFolder) {
        super(label, collapsibleState);
        this.label = label;
        this.resourceUri = resourceUri;
        this.collapsibleState = collapsibleState;
        this.isFolder = isFolder;
        this.resourceUri = resourceUri;
        if (!isFolder) {
            this.contextValue = 'file';
        }
        else {
            this.contextValue = 'folder';
        }
    }
}
//# sourceMappingURL=extension.js.map