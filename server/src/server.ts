import {
	createConnection,
	TextDocuments,
	Diagnostic,
	DiagnosticSeverity,
	ProposedFeatures,
	InitializeParams,
	DidChangeConfigurationNotification,
	CompletionItem,
	CompletionItemKind,
	TextDocumentPositionParams,
	TextDocumentSyncKind,
	InitializeResult
} from 'vscode-languageserver/node';
import { Declaration, DeclarationParams, DeclarationRequest, Definition, DefinitionParams, Disposable, Hover, HoverParams, MarkupContent, MarkupKind, TypeDefinitionParams } from 'vscode-languageserver';
import {
	TextDocument
} from 'vscode-languageserver-textdocument';

const connection = createConnection(ProposedFeatures.all);

const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;
let hasDiagnosticRelatedInformationCapability = false;

connection.onInitialize((params: InitializeParams) => {
	const capabilities = params.capabilities;

	hasConfigurationCapability = !!(
		capabilities.workspace && !!capabilities.workspace.configuration
	);
	hasWorkspaceFolderCapability = !!(
		capabilities.workspace && !!capabilities.workspace.workspaceFolders
	);
	hasDiagnosticRelatedInformationCapability = !!(
		capabilities.textDocument &&
		capabilities.textDocument.publishDiagnostics &&
		capabilities.textDocument.publishDiagnostics.relatedInformation
	);

	const result: InitializeResult = {
		capabilities: {
			textDocumentSync: TextDocumentSyncKind.Incremental,
			completionProvider: {
				resolveProvider: true
			},
			hoverProvider : true,
			declarationProvider : {
				documentSelector: [{ scheme: 'file', language: 'uniface' }],
			},
			typeDefinitionProvider : {
				documentSelector: [{ scheme: 'file', language: 'uniface' }],
			},
			definitionProvider : true,
		}
	};
	if (hasWorkspaceFolderCapability) {
		result.capabilities.workspace = {
			workspaceFolders: {
				supported: true
			}
		};
	}
	return result;
});

connection.onInitialized(() => {
	if (hasConfigurationCapability) {
		connection.client.register(DidChangeConfigurationNotification.type, undefined);
	}
	if (hasWorkspaceFolderCapability) {
		connection.workspace.onDidChangeWorkspaceFolders(_event => {
			connection.console.log('Workspace folder change event received.');
		});
	}
});

interface ExampleSettings {
	maxNumberOfProblems: number;
}

const defaultSettings: ExampleSettings = { maxNumberOfProblems: 1000 };
let globalSettings: ExampleSettings = defaultSettings;

const documentSettings: Map<string, Thenable<ExampleSettings>> = new Map();

connection.onDidChangeConfiguration(change => {
	if (hasConfigurationCapability) {
		documentSettings.clear();
	} else {
		globalSettings = <ExampleSettings>(
			(change.settings.languageServerUniface || defaultSettings)
		);
	}

	documents.all().forEach(validateTextDocument);
});

function getDocumentSettings(resource: string): Thenable<ExampleSettings> {
	if (!hasConfigurationCapability) {
		return Promise.resolve(globalSettings);
	}
	let result = documentSettings.get(resource);
	if (!result) {
		result = connection.workspace.getConfiguration({
			scopeUri: resource,
			section: 'languageServerUniface'
		});
		documentSettings.set(resource, result);
	}
	return result;
}

documents.onDidClose(e => {
	documentSettings.delete(e.document.uri);
});

documents.onDidChangeContent(change => {
	validateTextDocument(change.document);
});

async function validateTextDocument(textDocument: TextDocument): Promise<void> {
	const settings = await getDocumentSettings(textDocument.uri);

	const text = textDocument.getText();
	const pattern = /%%[^%\s]*%%(?![%])/g;
	let m: RegExpExecArray | null;

	let problems = 0;
	const diagnostics: Diagnostic[] = [];
	while ((m = pattern.exec(text)) && problems < settings.maxNumberOfProblems) {
		problems++;
		const diagnostic: Diagnostic = {
			severity: DiagnosticSeverity.Error,
			range: {
				start: textDocument.positionAt(m.index),
				end: textDocument.positionAt(m.index + m[0].length)
			},
			message: `${m[0]} has a wrong number of ending %. Must be 3 or 0.`,
			source: 'Uniface Helper'
		};
		diagnostics.push(diagnostic);
	}

	connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}

connection.onDidChangeWatchedFiles(_change => {
	connection.console.log('We received an file change event');
});


/*
	Questa roba sotto non funziona:
	- onTypeDefinition ti porta alla linea 0 colonna 0
		Come fare per far funzionare onTypeDefinition?

	- onHover come faccio ad avere il contenuto del file?

	mi sto deprimendo

*/


connection.onTypeDefinition((params: TypeDefinitionParams) => {
	return {
		uri: params.textDocument.uri,
		range: {
			start: { line: 0, character: 0 },
			end: { line: 0, character: 0 }
		}
	};
});

connection.onDefinition((params: DefinitionParams) => {
	return {
		uri: params.textDocument.uri,
		range: {
			start: { line: 0, character: 0 },
			end: { line: 0, character: 0 }
		}
	};
});

connection.onHover((data: HoverParams) => {
    const content: MarkupContent = {
		kind: MarkupKind.Markdown,
		value: `**Uniface Helper**`,
	};
	
    return {
        contents: content,
    };
});

connection.onDeclaration((data: DeclarationParams): Declaration | null => {
	return {
		uri: data.textDocument.uri,
		range: {
			start: data.position,
			end: data.position,
		},
	};
});

connection.onCompletion(
	(_textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
		return [
			{
				label: 'TypeScript',
				kind: CompletionItemKind.Text,
				data: 1
			},
			{
				label: 'JavaScript',
				kind: CompletionItemKind.Text,
				data: 2
			}
		];
	}
);

connection.onCompletionResolve(
	(item: CompletionItem): CompletionItem => {
		if (item.data === 1) {
			item.detail = 'TypeScript details';
			item.documentation = 'TypeScript documentation';
		} else if (item.data === 2) {
			item.detail = 'JavaScript details';
			item.documentation = 'JavaScript documentation';
		}
		return item;
	}
);

documents.listen(connection);

connection.listen();
