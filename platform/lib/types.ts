import { match } from 'ts-pattern';

interface File {
  name: string;
  path: string;
  isDirectory: boolean;
  content?: string;
  snippets?: Snippet[];
}

interface Snippet {
  file: string;
  start: number;
  end: number;
  entireFile: string;
  content: string;
}

type OperationType = "create" | "modify" | "command";
type Status = "queued" | "in-progress" | "done" | "error" | "idle";

// interface OperationRequest {
//   instructions: string;
//   hideMerge: boolean;
//   isLoading: boolean;
//   status: Status;
//   newContents: string;
//   diff: string;
//   readOnlySnippets: { [key: string]: Snippet };
//   operationType: "create" | "modify" | "command";
//   snippet: Snippet;
//   commandName: string;
// }

interface BaseOperationRequest {
  instructions: string;
  hideMerge: boolean;
  isLoading: boolean;
  status: Status;
}

interface CreateOrModifyOperationRequest extends BaseOperationRequest {
  newContents: string;
  diff: string;
  readOnlySnippets: { [key: string]: Snippet };
  operationType: "create" | "modify";
  snippet: Snippet;
}

interface CommandOperationRequest extends BaseOperationRequest {
  operationType: "command";
  commandName: string;
}

type OperationRequest = CreateOrModifyOperationRequest | CommandOperationRequest;

function operationTypeToString(operationType: OperationType): string {
  return match(operationType)
    .with("create", () => "Create")
    .with("modify", () => "Modify")
    .with("command", () => "Command")
    .exhaustive();
}


const snippetKey = (snippet: Snippet) => {
  return `${snippet.file}:${snippet.start || 0}-${snippet.end || 0}`;
};

interface Message {
  role: "user" | "system" | "assistant";
  content: string;
}

export { snippetKey, operationTypeToString };
export type { File, Snippet, OperationRequest, CreateOrModifyOperationRequest, CommandOperationRequest, Message };