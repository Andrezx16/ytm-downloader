import { Tag } from "lucide-react";
import { Page } from "@/components/layout/Page";
import { FolderPicker } from "./FilePicker";
import { FileList } from "./FileList";
import { MetadataForm } from "./MetadataForm";
import { useMetadataFlow, useFolderHistory } from "./hooks";

export function MetadataPage() {
  const {
    step,
    folderPath,
    files,
    selectedIndices,
    currentEntry,
    currentIndex,
    currentMatches,
    currentLoadingProviders,
    currentFields,
    currentLyrics,
    queue,
    isScanning,
    scanError,
    handleScan,
    handleStartQueue,
    handleSelectFile,
    handleSelectAll,
    handleSkip,
    handleWriteAndNext,
    handleBack,
    handleSelectCandidate,
    isSelecting,
    selectError,
    handleSetFields,
    isWriting,
    writeError,
  } = useMetadataFlow();

  const folderHistory = useFolderHistory();

  const handleScanWithHistory = (path: string) => {
    folderHistory.add(path);
    handleScan(path);
  };

  return (
    <Page>
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <Tag className="size-5 text-muted-foreground" aria-hidden="true" />
          <h1 className="text-2xl font-semibold">Metadata</h1>
        </div>

        {/* Step 1: Scan folder */}
        {step === "scan" && (
          <FolderPicker
            onScan={handleScanWithHistory}
            isLoading={isScanning}
            history={folderHistory.history}
            onHistorySelect={(path) => {
              folderHistory.add(path);
              handleScan(path);
            }}
            onHistoryRemove={folderHistory.remove}
            onHistoryClear={folderHistory.clear}
          />
        )}

        {step === "scan" && scanError && (
          <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {scanError.message}
          </div>
        )}

        {/* Step 2a: File list with multi-select */}
        {step === "scan" && files.length > 0 && (
          <FileList
            files={files}
            folderPath={folderPath}
            selectedIndices={selectedIndices}
            onSelectFile={handleSelectFile}
            onSelectAll={handleSelectAll}
            onStartQueue={handleStartQueue}
            onBack={handleBack}
            isLoading={isScanning}
            error={scanError}
          />
        )}

        {/* Step 2b: Processing — current song form */}
        {step === "processing" && currentEntry && (
          <>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="truncate">{currentEntry.file.name}</span>
            </div>
            <MetadataForm
              matches={currentMatches}
              loadingProviders={currentLoadingProviders}
              selectedIndex={currentEntry.selectedIndex}
              lyricsFound={currentLyrics != null && currentLyrics.length > 0}
              fields={currentFields}
              onFieldsChange={handleSetFields}
              onSelectCandidate={handleSelectCandidate}
              onWriteAndNext={handleWriteAndNext}
              onSkip={handleSkip}
              isSelecting={isSelecting}
              selectError={selectError}
              isWriting={isWriting}
              writeError={writeError}
              queueIndex={currentIndex}
              queueTotal={queue.length}
              isCurrentLoading={currentEntry.status === "analyzing"}
            />
          </>
        )}

        {/* Step 3: Done */}
        {step === "done" && (
          <div className="flex flex-col items-center justify-center gap-3 py-16">
            <p className="text-sm text-muted-foreground">
              All songs processed
            </p>
            <button
              onClick={handleBack}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Back to files
            </button>
          </div>
        )}
      </div>
    </Page>
  );
}
