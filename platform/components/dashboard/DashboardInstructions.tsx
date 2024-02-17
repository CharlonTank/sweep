import React, { memo, forwardRef, Ref } from "react";
import { OperationRequest } from "../../lib/types";
import ModifyOrCreate from "./sections/ModifyOrCreate";
import FCRList from "./sections/FCRList";
import { Button } from "../ui/button";
import CreationPanel from "./sections/CreationPanel";
import { useRecoilState } from "recoil";
import { OperationRequestsState } from "../../state/fcrAtoms";

const DashboardInstructions = forwardRef(function DashboardInstructions(
  {
    filePath,
    repoName,
    files,
    directories,
    currentFileChangeRequestIndex,
    setCurrentFileChangeRequestIndex,
    getFileChanges,
    isRunningRef,
    syncAllFiles,
    setCurrentTab,
  }: {
    filePath: string;
    repoName: string;
    files: { label: string; name: string }[];
    directories: { label: string; name: string }[];
    currentFileChangeRequestIndex: number;
    setCurrentFileChangeRequestIndex: React.Dispatch<
      React.SetStateAction<number>
    >;
    getFileChanges: (
      fileChangeRequest: OperationRequest,
      index: number
    ) => Promise<void>;
    isRunningRef: React.MutableRefObject<boolean>;
    syncAllFiles: () => Promise<void>;
    /* getAllFileChanges: () => Promise<void>; */
    setCurrentTab: React.Dispatch<React.SetStateAction<"planning" | "coding">>;
  },
  ref: Ref<HTMLDivElement>
) {
  const [fileChangeRequests, setFileChangeRequests] = useRecoilState(
    OperationRequestsState
  );
  return (
    <div
      className="grow mb-4 h-full min-h-0 rounded-md p-4 overflow-auto border"
      ref={ref}
    >
      <ModifyOrCreate
        filePath={filePath}
        repoName={repoName}
        files={files}
        directories={directories}
        syncAllFiles={syncAllFiles}
      />
      <FCRList
        repoName={repoName}
        files={files}
        currentFileChangeRequestIndex={currentFileChangeRequestIndex}
        setCurrentFileChangeRequestIndex={setCurrentFileChangeRequestIndex}
        getFileChanges={getFileChanges}
        isRunningRef={isRunningRef}
      />
      <CreationPanel
        filePath={filePath}
        repoName={repoName}
        files={files}
        directories={directories}
        setCurrentTab={setCurrentTab}
      />
      {/* {fileChangeRequests.length === 0 ? (
        <div className="p-2 text-zinc-300">
          No File Change Requests added yet.
        </div>
      ) : (
        <div className="text-right mt-2">
          <Button
            variant={"secondary"}
            className="bg-blue-800 hover:bg-blue-900"
            onClick={() => getAllFileChanges()}
          >
            Run all
          </Button>
        </div>
      )} */}
    </div>
  );
});
export default memo(DashboardInstructions);
