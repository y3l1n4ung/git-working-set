import * as vscode from 'vscode';

/**
 * Partial Git Extension API interface
 */
export interface GitExtension {
    getAPI(version: number): GitAPI;
}

export interface GitAPI {
    repositories: Repository[];
    onDidOpenRepository: vscode.Event<Repository>;
    onDidCloseRepository: vscode.Event<Repository>;
}

export interface Repository {
    rootUri: vscode.Uri;
    state: RepositoryState;
}

export interface RepositoryState {
    workingTreeChanges: Change[];
    indexChanges: Change[];
    onDidChange: vscode.Event<void>;
}

export interface Change {
    readonly uri: vscode.Uri;
    readonly originalUri?: vscode.Uri;
}

export interface TreeNode {
    __uri?: vscode.Uri;
    __isFolder?: boolean;
    [key: string]: TreeNode | vscode.Uri | boolean | undefined;
}
