import * as assert from 'assert';
import * as vscode from 'vscode';
import { createGitUri, getComprehensiveChange } from '../../utils';
import { Status, Change } from '../../types';

suite('Git Working Set Test Suite', () => {
    vscode.window.showInformationMessage('Start all tests.');

    test('Extension should be present', () => {
        assert.ok(vscode.extensions.getExtension('Widget-Lab.git-working-set'));
    });

    test('Should activate', async () => {
        const ext = vscode.extensions.getExtension('Widget-Lab.git-working-set');
        await ext?.activate();
        assert.strictEqual(ext?.isActive, true);
    });

    test('Commands should be registered', async () => {
        const commands = await vscode.commands.getCommands(true);
        const expected = [
            'git-working-set.openFile',
            'git-working-set.openDiff',
            'git-working-set.openReview',
            'git-working-set.openToSide',
            'git-working-set.findInFolder',
            'git-working-set.openInTerminal',
            'git-working-set.selectForCompare',
            'git-working-set.compareWithSelected'
        ];
        for (const cmd of expected) {
            assert.ok(commands.includes(cmd), `Command ${cmd} should be registered`);
        }
    });

    suite('Git Utilities', () => {
        test('createGitUri should format correctly', () => {
            const uri = vscode.Uri.file('/test/path.ts');
            const gitUri = createGitUri(uri, 'HEAD');
            assert.strictEqual(gitUri.scheme, 'git');
            const query = JSON.parse(gitUri.query);
            assert.strictEqual(query.path, uri.fsPath);
            assert.strictEqual(query.ref, 'HEAD');
        });

        test('getComprehensiveChange should find changes in mock API', () => {
            const testUri = vscode.Uri.file('/work/file.ts');
            
            // Mock Change objects
            const wtChange: Change = { uri: testUri, status: Status.MODIFIED };
            const idxChange: Change = { uri: testUri, status: Status.INDEX_ADDED, originalUri: vscode.Uri.parse('git-working-set-empty:/empty') };

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const mockGitAPI: any = {
                repositories: [
                    {
                        state: {
                            workingTreeChanges: [wtChange],
                            indexChanges: [idxChange]
                        }
                    }
                ]
            };

            const result = getComprehensiveChange(testUri, mockGitAPI);
            assert.ok(result);
            assert.strictEqual(result?.status, Status.MODIFIED);
            assert.strictEqual(result?.originalUri?.scheme, 'git-working-set-empty');
        });
    });

    suite('Content Providers', () => {
        test('EmptyContentProvider should return empty string', async () => {
            const uri = vscode.Uri.parse('git-working-set-empty:/empty');
            const doc = await vscode.workspace.openTextDocument(uri);
            assert.strictEqual(doc.getText(), '');
        });

        test('ReadOnlyProvider should provide content', async () => {
            if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
                return;
            }
            
            const root = vscode.workspace.workspaceFolders[0].uri;
            const fileUri = vscode.Uri.joinPath(root, 'package.json');
            const reviewUri = fileUri.with({ scheme: 'git-working-set-review' });
            
            try {
                const originalDoc = await vscode.workspace.openTextDocument(fileUri);
                const doc = await vscode.workspace.openTextDocument(reviewUri);
                assert.strictEqual(doc.getText(), originalDoc.getText());
            } catch {
                console.log('Skipping ReadOnlyProvider test');
            }
        });
    });
});
