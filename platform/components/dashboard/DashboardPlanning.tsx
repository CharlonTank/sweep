import { useLocalStorage } from "usehooks-ts";
import { Label } from "../ui/label";
import { ReactNode, useEffect, useRef, useState } from "react";
import CodeMirror, {
  EditorView,
  keymap,
  lineNumbers,
} from "@uiw/react-codemirror";
import {
  OperationRequest,
  Snippet,
  operationTypeToString,
} from "../../lib/types";
import { Button } from "../ui/button";
import { indentWithTab } from "@codemirror/commands";
import { indentUnit } from "@codemirror/language";
import { xml } from "@codemirror/lang-xml";
import { vscodeDark } from "@uiw/codemirror-theme-vscode";
import { Switch } from "../ui/switch";
import { getFile } from "../../lib/api.service";
import Markdown from "react-markdown";
import { Mention, MentionsInput, SuggestionDataItem } from "react-mentions";
import { Badge } from "../ui/badge";
import { FaTimes } from "react-icons/fa";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { toast } from "sonner";
import { useRecoilState } from "recoil";
import { OperationRequestsState } from "../../state/fcrAtoms";

const codeStyle = {
  ...vscDarkPlus,
  'code[class*="language-"]': {
    ...vscDarkPlus['code[class*="language-"]'],
    whiteSpace: "pre-wrap",
  },
};

const systemMessagePrompt = `You are a brilliant and meticulous engineer assigned to plan code changes for the following user's concerns. Take into account the current repository's language, frameworks, and dependencies.`;

const userMessagePromptOld = `Here are relevant read-only files:
<read_only_files>
{readOnlyFiles}
</read_only_files>

<user_request>
{userRequest}
</user_request>

# Task:
Analyze the snippets, repo, and user request to break down the requested change and propose a plan to addresses the user's request. Mention all changes required to solve the request.

Provide a plan to solve the issue, following these rules:
* You may only create new files and modify existing files but may not necessarily need both.
* Include the full path (e.g. src/main.py and not just main.py), using the snippets for reference.
* Use natural language instructions on what to modify regarding business logic.
* Be concrete with instructions and do not write "identify x" or "ensure y is done". Instead write "add x" or "change y to z".
* Refer to the user as "you".
You MUST follow the following format with XML tags:

# Contextual Request Analysis:
<contextual_request_analysis>
Concisely outline the minimal plan that solves the user request by referencing the snippets, and names of entities. and any other necessary files/directories.
</contextual_request_analysis>

# Plan:
<plan>
<create file="file_path_1" relevant_files="space-separated list of ALL files relevant for creating file_path_1">
* Concise natural language instructions for creating the new file needed to solve the issue.
* Reference necessary files, imports and entity names.
...
</create>
...

<modify file="file_path_2" start_line="i" end_line="j" relevant_files="space-separated list of ALL files relevant for modifying file_path_2">
* Concise natural language instructions for the modifications needed to solve the issue.
* Reference necessary files, imports and entity names.
...
</modify>
...

</plan>`;

const userMessagePrompt = `Here are relevant read-only files:
<read_only_files>
{readOnlyFiles}
</read_only_files>

Here is the user's request:
<user_request>
{userRequest}
</user_request>

Here is the user's workflow:
<user_workflow>
{userWorkflow}
</user_workflow>

# Task:
Analyze the snippets, repo, and user request to break down the requested change and propose a plan to addresses the user's request. Mention all changes required to solve the request.

Provide a plan to solve the issue, following these rules:
* You may only create new files and modify existing files but may not necessarily need both.
* Include the full path (e.g. src/main.py and not just main.py), using the snippets for reference.
* Use natural language instructions on what to modify regarding business logic.
* Be concrete with instructions and do not write "identify x" or "ensure y is done". Instead write "add x" or "change y to z".
* You may run a terminal command from the list of commands provided in the workflow.
* Refer to the user as "you".

# Plan:
<plan>
<create file="file_path_1" relevant_files="space-separated list of ALL files relevant for creating file_path_1">
* Concise natural language instructions for creating the new file needed to solve the issue.
* Reference necessary files, imports and entity names.
...
</create>
...

<modify file="file_path_2" start_line="i" end_line="j" relevant_files="space-separated list of ALL files relevant for modifying file_path_2">
* Concise natural language instructions for the modifications needed to solve the issue.
* Reference necessary files, imports and entity names.
...
</modify>
...

<command name="command_name">
* Concise natural language instructions for running the command.
...
</command>

</plan>`;

const readOnlyFileFormat = `<read_only_file file="{file}" start_line="{start_line}" end_line="{end_line}">
{contents}
</read_only_file>`;

const requestPattern =
  /<create file="(?<cFile>.*?)" relevant_files="(?<relevant_files>.*?)">(?<cInstructions>[\s\S]*?)($|<\/create>)|<modify file="(?<mFile>.*?)" start_line="(?<startLine>.*?)" end_line="(?<endLine>.*?)" relevant_files="(.*?)">(?<mInstructions>[\s\S]*?)($|<\/modify>)|<command name="(?<cmdName>.*?)">/gs;

const DashboardPlanning = ({
  repoName,
  files,
  setLoadingMessage,
  setCurrentTab,
}: {
  repoName: string;
  files: { label: string; name: string }[];
  setLoadingMessage: React.Dispatch<React.SetStateAction<string>>;
  setCurrentTab: React.Dispatch<React.SetStateAction<"planning" | "coding">>;
}) => {
  const [instructions = "", setInstructions] = useLocalStorage(
    "globalInstructions",
    "" as string
  );
  const [workflow = "", setWorkflow] = useLocalStorage(
    "globalWorkflow",
    "" as string
  );
  const [snippets = {}, setSnippets] = useLocalStorage(
    "globalSnippets",
    {} as { [key: string]: Snippet }
  );
  const [rawResponse = "", setRawResponse] = useLocalStorage(
    "planningRawResponse",
    "" as string
  );
  const [currentOperationRequests = [], setCurrentFileChangeRequests] =
    useLocalStorage("globalFileChangeRequests", [] as OperationRequest[]);
  const [debugLogToggle = false, setDebugLogToggle] = useState<boolean>(false);
  const [isLoading = false, setIsLoading] = useState<boolean>(false);
  const [_, setOperationRequests] = useRecoilState(OperationRequestsState);

  const instructionsRef = useRef<HTMLTextAreaElement>(null);
  const thoughtsRef = useRef<HTMLDivElement>(null);
  const planRef = useRef<HTMLDivElement>(null);

  const extensions = [
    xml(),
    EditorView.lineWrapping,
    keymap.of([indentWithTab]),
    indentUnit.of("    "),
  ];

  useEffect(() => {
    if (instructionsRef.current) {
      instructionsRef.current.focus();
    }
  }, []);

  const generatePlan = async () => {
    setIsLoading(true);
    setLoadingMessage("Queued...");
    try {
      setCurrentFileChangeRequests([]);
      const response = await fetch("/api/openai/edit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userMessage: userMessagePrompt
            .replace("{userRequest}", instructions)
            .replace(
              "{readOnlyFiles}",
              Object.keys(snippets)
                .map((filePath) =>
                  readOnlyFileFormat
                    .replace("{file}", snippets[filePath].file)
                    .replace(
                      "{start_line}",
                      snippets[filePath].start.toString()
                    )
                    .replace("{end_line}", snippets[filePath].end.toString())
                    .replace("{contents}", snippets[filePath].content)
                )
                .join("\n")
            ),
          systemMessagePrompt,
        }),
      });
      setLoadingMessage("Planning...");
      const reader = response.body?.getReader();
      const decoder = new TextDecoder("utf-8");
      let rawText = "";
      while (true) {
        const { done, value } = await reader?.read()!;
        if (done) {
          break;
        }
        const text = decoder.decode(value);
        rawText += text;
        setRawResponse(rawText);
        if (thoughtsRef.current) {
          thoughtsRef.current.scrollTop = thoughtsRef.current.scrollHeight || 0;
        }
        const requestPatterns =
          /<create file="(?<cFile>.*?)" relevant_files="(?<relevant_files>.*?)">(?<cInstructions>[\s\S]*?)($|<\/create>)|<modify file="(?<mFile>.*?)" start_line="(?<startLine>.*?)" end_line="(?<endLine>.*?)" relevant_files="(.*?)">(?<mInstructions>[\s\S]*?)($|<\/modify>)|<command name="(?<cmdName>.*?)">/gs;
        const requestMatches = rawText.matchAll(requestPatterns);
        var operationRequests: OperationRequest[] = [];
        for (const match of requestMatches) {
          if (match.groups?.cmdName) {
            operationRequests.push({
              operationType: "command",
              instructions: instructions.trim(),
              isLoading: false,
              status: "idle",
            } as OperationRequest);
            console.log("Received command:", match.groups.cmdName);
          } else {
            const file: string =
              match.groups?.cFile || match.groups?.mFile || "";
            const relevantFiles: string = match.groups?.relevant_files || "";
            const instructions: string =
              match.groups?.cInstructions || match.groups?.mInstructions || "";
            const operationType: "create" | "modify" = match.groups
              ?.cInstructions
              ? "create"
              : "modify";
            const contents: string =
              (await getFile(repoName, file)).contents || "";
            const startLine: string | undefined = match.groups?.startLine;
            const start: number =
              startLine === undefined ? 0 : parseInt(startLine);
            const endLine: string | undefined = match.groups?.endLine;
            const end: number = Math.max(
              endLine === undefined
                ? contents.split("\n").length
                : parseInt(endLine),
              start + 10
            );
            operationRequests.push({
              snippet: {
                start,
                end,
                file: file,
                entireFile: contents,
                content: contents.split("\n").slice(start, end).join("\n"),
              },
              newContents: contents,
              operationType: operationType,
              hideMerge: true,
              instructions: instructions.trim(),
              isLoading: false,
              readOnlySnippets: {},
              status: "idle",
            } as OperationRequest);
          }
        }
        setCurrentFileChangeRequests(operationRequests);
        if (planRef.current) {
          const delta = 50; // Define a delta for the inequality check
          if (
            Math.abs(
              planRef.current.scrollHeight -
                planRef.current.scrollTop -
                planRef.current.clientHeight
            ) < delta
          ) {
            planRef.current.scrollTop = planRef.current.scrollHeight || 0;
          }
        }
      }
    } catch (e) {
      console.error(e);
      toast.error("An error occurred while generating the plan.");
    } finally {
      setIsLoading(false);
      setLoadingMessage("");
    }
  };

  const setUserSuggestion = (
    suggestion: SuggestionDataItem,
    search: string,
    highlightedDisplay: ReactNode,
    index: number,
    focused: boolean
  ) => {
    const maxLength = 50;
    const suggestedFileName =
      suggestion.display!.length < maxLength
        ? suggestion.display
        : "..." +
          suggestion.display!.slice(
            suggestion.display!.length - maxLength,
            suggestion.display!.length
          );
    if (index > 10) {
      return null;
    }
    return (
      <div
        className={`user ${focused ? "bg-zinc-800" : "bg-zinc-900"} p-2 text-sm hover:text-white`}
      >
        {suggestedFileName}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-row justify-between items-center mb-2">
        <Label className="mr-2">Instructions</Label>
        {/* <Button variant="secondary">
          Search
        </Button> */}
      </div>
      <MentionsInput
        className="min-h-[100px] w-full rounded-md border border-input bg-background MentionsInput mb-2"
        placeholder="Describe the changes you want to make here."
        value={instructions}
        onKeyDown={(e: any) => {
          if (e.key === "Enter" && e.ctrlKey) {
            e.preventDefault();
            generatePlan();
          }
        }}
        onChange={(e: any) => setInstructions(e.target.value)}
        onBlur={(e: any) => setInstructions(e.target.value)}
        inputRef={instructionsRef}
        autoFocus
      >
        <Mention
          trigger="@"
          data={files.map((file) => ({ id: file.label, display: file.label }))}
          renderSuggestion={setUserSuggestion}
          onAdd={async (currentValue) => {
            const contents = (await getFile(repoName, currentValue.toString()))
              .contents;
            const newSnippet = {
              file: currentValue,
              start: 0,
              end: contents.split("\n").length,
              entireFile: contents,
              content: contents,
            } as Snippet;
            setSnippets((newSnippets) => {
              return {
                ...newSnippets,
                [currentValue]: newSnippet,
              };
            });
          }}
          appendSpaceOnAdd={true}
        />
      </MentionsInput>
      <div hidden={Object.keys(snippets).length === 0} className="mb-4">
        {Object.keys(snippets).map((snippetFile: string, index: number) => (
          <Badge
            variant="secondary"
            key={index}
            className="bg-zinc-800 text-zinc-300 mr-1"
          >
            {snippetFile.split("/")[snippetFile.split("/").length - 1]}
            <FaTimes
              key={String(index) + "-remove"}
              className="bg-zinc-800 cursor-pointer ml-1"
              onClick={() => {
                setSnippets((snippets: { [key: string]: Snippet }) => {
                  const { [snippetFile]: _, ...newSnippets } = snippets;
                  return newSnippets;
                });
              }}
            />
          </Badge>
        ))}
      </div>
      {Object.keys(snippets).length === 0 && (
        <div className="text-xs px-2 text-zinc-400">
          No files added yet. Type @ to add a file.
        </div>
      )}
      <div className="flex flex-row justify-between items-center mb-2">
        <Label className="mr-2">Workflow</Label>
      </div>
      <textarea
        className="min-h-[100px] w-full rounded-md border border-input bg-background mb-2"
        placeholder="Describe the workflow here."
        value={workflow}
        onKeyDown={(e: any) => {
          if (e.key === "Enter" && e.ctrlKey) {
            e.preventDefault();
            generatePlan();
          }
        }}
        onChange={(e: any) => setWorkflow(e.target.value)}
        onBlur={(e: any) => setWorkflow(e.target.value)}
      />
      <div className="text-right mb-2">
        <Button
          className="mb-2 mt-2"
          variant="secondary"
          onClick={generatePlan}
          disabled={
            isLoading ||
            instructions === "" ||
            Object.keys(snippets).length === 0
          }
        >
          Generate Plan
        </Button>
      </div>
      <div className="flex flex-row mb-2 items-center">
        <Label className="mb-0">Sweep&apos;s Plan</Label>
        <div className="grow"></div>
        <Label className="text-zinc-400 mb-0">Debug mode</Label>
        <Switch
          className="ml-2"
          checked={debugLogToggle}
          onClick={() => setDebugLogToggle((debugLogToggle) => !debugLogToggle)}
        >
          Debug mode
        </Switch>
      </div>
      <div className="overflow-y-auto" ref={planRef}>
        {debugLogToggle ? (
          <CodeMirror
            value={rawResponse}
            extensions={extensions}
            theme={vscodeDark}
            style={{ overflow: "auto" }}
            placeholder="Empty file"
            className="ph-no-capture"
          />
        ) : (
          <>
            {currentOperationRequests.map((operationRequest, index) => {
              if (operationRequest.operationType === "command") {
                return (
                  <div className="rounded border p-3 mb-2" key={index}>
                    <div className="flex flex-row justify-between mb-2 p-2">
                      <div className="font-mono">
                        <span>Command: </span>
                        <span className="text-zinc-400">
                          {operationRequest.commandName}
                        </span>
                      </div>
                      <span className="font-mono text-zinc-400">Command</span>
                    </div>
                    <Markdown
                      className="react-markdown mb-2"
                      components={{
                        code(props) {
                          const { children, className, node, ...rest } = props;
                          const match = /language-(\w+)/.exec(className || "");
                          return match ? (
                            // @ts-ignore
                            <SyntaxHighlighter
                              {...rest}
                              PreTag="div"
                              language={match[1]}
                              style={codeStyle}
                            >
                              {String(children).replace(/\n$/, "")}
                            </SyntaxHighlighter>
                          ) : (
                            <code {...rest} className={className}>
                              {children}
                            </code>
                          );
                        },
                      }}
                    >
                      {operationRequest.instructions}
                    </Markdown>
                  </div>
                );
              } else {
                // Handle file creation and modification as before
                const filePath = operationRequest.snippet.file;
                var path = filePath.split("/");
                const fileName = path.pop();
                if (path.length > 2) {
                  path = path.slice(0, 1).concat(["..."]);
                }
                return (
                  <div className="rounded border p-3 mb-2" key={index}>
                    <div className="flex flex-row justify-between mb-2 p-2">
                      <div className="font-mono">
                        <span className="text-zinc-400">{path.join("/")}/</span>
                        <span>{fileName}</span>
                        {operationRequest.operationType === "modify" && (
                          <span className="text-zinc-400">
                            :{operationRequest.snippet.start}-
                            {operationRequest.snippet.end}
                          </span>
                        )}
                      </div>
                      <span className="font-mono text-zinc-400">
                        {operationTypeToString(operationRequest.operationType)}
                      </span>
                    </div>
                    <Markdown
                      className="react-markdown mb-2"
                      components={{
                        code(props) {
                          const { children, className, node, ...rest } = props;
                          const match = /language-(\w+)/.exec(className || "");
                          return match ? (
                            // @ts-ignore
                            <SyntaxHighlighter
                              {...rest}
                              PreTag="div"
                              language={match[1]}
                              style={codeStyle}
                            >
                              {String(children).replace(/\n$/, "")}
                            </SyntaxHighlighter>
                          ) : (
                            <code {...rest} className={className}>
                              {children}
                            </code>
                          );
                        },
                      }}
                    >
                      {operationRequest.instructions}
                    </Markdown>
                    {operationRequest.operationType === "modify" && (
                      <>
                        <Label>Snippet Preview</Label>
                        <CodeMirror
                          value={operationRequest.snippet.content}
                          extensions={[
                            ...extensions,
                            lineNumbers({
                              formatNumber: (num: number) => {
                                return (
                                  num + operationRequest.snippet.start
                                ).toString();
                              },
                            }),
                          ]}
                          theme={vscodeDark}
                          style={{ overflow: "auto" }}
                          placeholder={"No plan generated yet."}
                          className="ph-no-capture"
                          maxHeight="150px"
                        />
                      </>
                    )}
                  </div>
                );
              }
            })}
            {currentOperationRequests.length === 0 && (
              <div className="text-zinc-500">No plan generated yet.</div>
            )}
          </>
        )}
      </div>
      <div className="grow"></div>
      <div className="text-right">
        <Button
          variant="secondary"
          className="bg-blue-800 hover:bg-blue-900 mt-4"
          onClick={async (e) => {
            setOperationRequests((prev: OperationRequest[]) => {
              return [...prev, ...currentOperationRequests];
            });
            setCurrentTab("coding");
          }}
          disabled={isLoading}
        >
          Accept Plan
        </Button>
      </div>
    </div>
  );
};

export default DashboardPlanning;
