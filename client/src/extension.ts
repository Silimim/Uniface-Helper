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
        const filePath = uri.fsPath;
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

// Registra il provider di contenuto personalizzato per lo schema di URI "mycontent"
const myContentProvider = new MyContentProvider();
vscode.workspace.registerTextDocumentContentProvider('uni', myContentProvider);

// Crea un URI personalizzato per il documento
vscode.workspace.onDidOpenTextDocument(document => {
    if (path.extname(document.uri.fsPath) === '.xml') {
        const uri = vscode.Uri.parse(`uni://${document.uri.fsPath.replace('xml', 'uni')}`);
        vscode.workspace.openTextDocument(uri).then(document => {
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

	client.start();
}

export function deactivate(): Thenable<void> | undefined {
	if (!client) {
		return undefined;
	}
	return client.stop();
}
