import * as vscode from 'vscode';

/**
 * Partial Git Extension API interface
 */
export interface GitExtension {
    getAPI(version: number): GitAPI;
}

export interface GitAPI {
    repositories: Repository[];
    getRepository(uri: vscode.Uri): Repository | null;
    onDidOpenRepository: vscode.Event<Repository>;
    onDidCloseRepository: vscode.Event<Repository>;
}

export interface Repository {
    readonly rootUri: vscode.Uri;
    readonly state: RepositoryState;
    // Direct API methods
    add(paths: string[]): Promise<void>;
    clean(paths: string[]): Promise<void>;
    checkout(treeish: string, paths: string[]): Promise<void>;
    revert(paths: string[]): Promise<void>;
    reset(treeish: string, paths: string[]): Promise<void>;
    diff(cached?: boolean): Promise<string>;
}

export interface RepositoryState {
    workingTreeChanges: Change[];
    indexChanges: Change[];
    onDidChange: vscode.Event<void>;
}

export interface Change {
    readonly uri: vscode.Uri;
    readonly originalUri?: vscode.Uri;
    readonly status: Status;
}

export enum Status {
    INDEX_MODIFIED = 0,
    INDEX_ADDED = 1,
    INDEX_DELETED = 2,
    INDEX_RENAMED = 3,
    INDEX_COPIED = 4,

    MODIFIED = 5,
    DELETED = 6,
    UNTRACKED = 7,
    IGNORED = 8,

    ADDED_BY_US = 9,
    ADDED_BY_THEM = 10,
    DELETED_BY_US = 11,
    DELETED_BY_THEM = 12,
    BOTH_ADDED = 13,
    BOTH_DELETED = 14,
    BOTH_MODIFIED = 15
}

export interface TreeNode {
    __uri: vscode.Uri;
    __isFolder: boolean;
    children?: Record<string, TreeNode>;
}
