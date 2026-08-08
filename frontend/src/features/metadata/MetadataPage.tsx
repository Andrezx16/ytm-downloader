import { useCallback, useRef } from "react";
import { Tag } from "lucide-react";
import { Page } from "@/components/layout/Page";
import { FolderPicker } from "./FilePicker";
import { FileList } from "./FileList";
import { MetadataForm } from "./MetadataForm";
import { useMetadataFlow, useFolderHistory } from "./hooks";
import { parseM3u } from "@/api/pipeline";

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
    currentFileLyrics,
    queue,
    isScanning,
    scanError,
    handleScan,
    handleStartQueue,
    handleSelectFile,
    handleSelectAll,
    handleDeselectAll,
    handleSkip,
    handleWriteAndNext,
    handleBack,
    handleSelectCandidate,
    handleSelectNone,
    handleRescan,
    handleEnrichDeezer,
    isEnrichingDeezer,
    isSelecting,
    selectError,
    handleSetFields,
    isWriting,
    writeError,
    m3uOrder,
    m3uName,
    handleSelectM3u,
    handleClearM3u,
  } = useMetadataFlow();

  const m3uInputRef = useRef<HTMLInputElement>(null);

  const handleM3uFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      const entries = parseM3u(text);
      handleSelectM3u(file.name, entries);
    };
    reader.readAsText(file);
    e.target.value = "";
  }, [handleSelectM3u]);


  const handleRemoveFileLyrics = useCallback(() => {
    handleSetFields({ ...currentFields, lyrics: "" });
    // Clear fileLyrics on the current entry directly
    if (currentEntry) {
      currentEntry.fileLyrics = null;
    }
  }, [handleSetFields, currentFields, currentEntry]);

  const folderHistory = useFolderHistory("metadata");

  const handleScanWithHistory = (path: string) => {
    folderHistory.add(path);
    handleScan(path);
  };

  return (
    <Page className="h-full flex flex-col overflow-hidden">
      <div className="flex flex-col gap-6 flex-1 min-h-0 overflow-hidden">
        <div className="shrink-0 flex items-center gap-3">
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
          <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
            <input
              ref={m3uInputRef}
              type="file"
              accept=".m3u,.m3u8"
              className="hidden"
              onChange={handleM3uFile}
            />
            <FileList
              files={files}
              folderPath={folderPath}
              selectedIndices={selectedIndices}
              onSelectFile={handleSelectFile}
              onSelectAll={handleSelectAll}
              onDeselectAll={handleDeselectAll}
              onStartQueue={handleStartQueue}
              onBack={handleBack}
              isLoading={isScanning}
              error={scanError}
              m3uOrder={m3uOrder}
              m3uName={m3uName}
              onSelectM3u={() => m3uInputRef.current?.click()}
              onClearM3u={handleClearM3u}
            />
          </div>
        )}

        {/* Step 2b: Processing — current song form */}
        {step === "processing" && currentEntry && (
          <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground shrink-0">
              <span className="truncate">{currentEntry.file.name}</span>
            </div>
            <MetadataForm
              matches={currentMatches}
              loadingProviders={currentLoadingProviders}
              selectedIndex={currentEntry.selectedIndex}
              lyricsFound={currentLyrics != null && currentLyrics.length > 0}
              fileLyrics={currentFileLyrics}
              onRemoveFileLyrics={handleRemoveFileLyrics}
              fields={currentFields}
              onFieldsChange={handleSetFields}
              onSelectCandidate={handleSelectCandidate}
              onSelectNone={handleSelectNone}
              onRescan={handleRescan}
              isManualEdit={currentEntry.manualEdit}
              onWriteAndNext={handleWriteAndNext}
              onSkip={handleSkip}
              isSelecting={isSelecting}
              selectError={selectError}
              isWriting={isWriting}
              writeError={writeError}
              queueIndex={currentIndex}
              queueTotal={queue.length}
              isCurrentLoading={currentEntry.status === "analyzing"}
              onEnrichDeezer={
                currentEntry.selectedIndex != null && currentEntry.selectedIndex >= 0
                  ? handleEnrichDeezer
                  : undefined
              }
              isEnrichingDeezer={isEnrichingDeezer}
            />
          </div>
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
