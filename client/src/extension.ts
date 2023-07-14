import * as path from 'path';
import { workspace, ExtensionContext } from 'vscode';
import {
	LanguageClient,
	LanguageClientOptions,
	ServerOptions,
	TransportKind
} from 'vscode-languageclient/node';
import * as vscode from 'vscode';
import * as fs from 'fs';
import { debug } from 'console';

let client: LanguageClient;

class MyContentProvider implements vscode.TextDocumentContentProvider {
    private _onDidChange = new vscode.EventEmitter<vscode.Uri>();

    public provideTextDocumentContent(uri: vscode.Uri): string {
        const filePath = uri.fsPath.replace('.uni', '.xml');
        const fileContent = fs.readFileSync(filePath, 'utf-8');

        const regex = /<trigger>(.*?)<\/trigger>/s;
        const match = regex.exec(fileContent);
        const content = match ? match[1] : '';

        return content;
    }

    get onDidChange(): vscode.Event<vscode.Uri> {
        return this._onDidChange.event;
    }

    public update(uri: vscode.Uri) {
        this._onDidChange.fire(uri);
    }
}

const myContentProvider = new MyContentProvider();
const scheme = 'uni';

// Registra il provider di contenuto personalizzato per lo schema di URI "uni"
vscode.workspace.registerTextDocumentContentProvider(scheme, myContentProvider);

vscode.workspace.onDidOpenTextDocument(document => {
    if (path.extname(document.uri.fsPath) === '.xml') {
        const uniUri = vscode.Uri.parse(`${scheme}:${document.uri.fsPath}.uni`);
        vscode.workspace.openTextDocument(uniUri).then(document => {
            vscode.window.showTextDocument(document);
        });
    }
});

export function activate(context: ExtensionContext) {

	const serverModule = context.asAbsolutePath(
		path.join('server', 'out', 'server.js')
	);

	const serverOptions: ServerOptions = {
		run: { module: serverModule, transport: TransportKind.ipc },
		debug: {
			module: serverModule,
			transport: TransportKind.ipc,
		}
	};

	const clientOptions: LanguageClientOptions = {
		documentSelector: [{ scheme: 'file', language: 'uniface' }],
		synchronize: {
			fileEvents: workspace.createFileSystemWatcher('**/.uni')
		}
	};

	client = new LanguageClient(
		'languageServerUniface',
		'Language Server Uniface',
		serverOptions,
		clientOptions
	);

	context.subscriptions.push(vscode.languages.registerFoldingRangeProvider('language-id', {
        provideFoldingRanges(document: vscode.TextDocument, context: vscode.FoldingContext, token: vscode.CancellationToken): vscode.ProviderResult<vscode.FoldingRange[]> {
            const foldingRanges: vscode.FoldingRange[] = [];

            // Find the start and end markers for each folding range
            const startRegex = /\bentry\b/;
            const endRegex = /\bend\b/;

            for (let i = 0; i < document.lineCount; i++) {
                const line = document.lineAt(i);
                const startMatch = line.text.match(startRegex);
                const endMatch = line.text.match(endRegex);

                if (startMatch) {
                    const startLine = i;
                    let endLine = i;

                    // Find the end of the folding range
                    for (let j = i + 1; j < document.lineCount; j++) {
                        const nextLine = document.lineAt(j);
                        if (endMatch && nextLine.text.match(endRegex)) {
                            endLine = j;
                            break;
                        }
                    }

                    // Add the folding range to the list
                    foldingRanges.push(new vscode.FoldingRange(startLine, endLine));
                }
            }

            return foldingRanges;
        }
    }));

	client.start();
}

export function deactivate(): Thenable<void> | undefined {
	if (!client) {
		return undefined;
	}
	return client.stop();
}
