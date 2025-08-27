/**
 * Contains all the code for the KTM TUI written with React/Ink
 */
import React, { useState, useEffect } from "react";
import { Box, Text, useInput, Static } from "ink";
import * as fs from "fs";
import * as path from "path";
import {
  findAllAnnotationFiles,
  extractPublication,
  findMatchingEpubFile,
  type KoboDrivePath,
  type AnnotationFilePath,
  type Publication,
  type Annotation,
  type EpubTableOfContents,
  HighlightColor,
} from "./extraction";
import { extractAnnotationData, processAnnotationsWithLLM } from "./workflow";
import type { ProcessedNotes } from "./llm";

// Clear the terminal when the TUI starts
process.stdout.write("\x1b[2J\x1b[0f");

enum AppState {
  SelectDrive,
  SelectAnnotation,
  ViewAnnotation,
  ProcessingNotes,
  ViewProcessedNotes,
}

interface AnnotationWithMetadata {
  file: AnnotationFilePath;
  publication: Publication;
  hasEpub: boolean;
}

const colorMap = {
  [HighlightColor.Yellow]: "yellow",
  [HighlightColor.Blue]: "blue",
  [HighlightColor.Red]: "red",
  [HighlightColor.Green]: "green",
  [HighlightColor.Pink]: "magenta",
} as const;

// Component for displaying loading state
const LoadingView: React.FC<{ message?: string }> = ({
  message = "Loading annotation data...",
}) => (
  <Box flexDirection="column">
    <Text color="yellow">⏳ {message}</Text>
  </Box>
);

// Component for processing notes with LLM
const ProcessingNotesView: React.FC = () => (
  <Box flexDirection="column">
    <Text color="yellow">🤖 Processing notes with AI...</Text>
    <Text color="gray">This may take a few moments...</Text>
  </Box>
);

// Component for displaying processed notes
interface ProcessedNotesViewProps {
  processedNotes: ProcessedNotes;
  publication: Publication;
  successMessage?: string;
}

const ProcessedNotesView: React.FC<ProcessedNotesViewProps> = ({
  processedNotes,
  publication,
  successMessage,
}) => (
  <Box flexDirection="column">
    <Text color="gray">Press ESC to go back, 'q' to quit</Text>
    <PublicationInfo publication={publication} />
    <Text> </Text>
    {successMessage && (
      <>
        <SuccessMessage message={successMessage} />
        <Text> </Text>
      </>
    )}
    <Text bold color="green">
      🤖 AI-Processed Notes:
    </Text>
    <Text> </Text>
    <Box borderStyle="single" borderColor="cyan" padding={1}>
      <Text>{processedNotes.notes}</Text>
    </Box>
  </Box>
);

// Component for displaying errors
const ErrorView: React.FC<{ error: string }> = ({ error }) => (
  <Box flexDirection="column">
    <Text color="red">Error: {error}</Text>
    <Text color="gray">Press ESC to go back</Text>
  </Box>
);

// Component for displaying success messages
const SuccessMessage: React.FC<{ message: string }> = ({ message }) => (
  <Box borderStyle="single" borderColor="green" padding={1}>
    <Text color="green">✅ {message}</Text>
  </Box>
);

// Component for drive selection
interface DriveSelectionProps {
  drives: string[];
  selectedIndex: number;
}

const DriveSelectionView: React.FC<DriveSelectionProps> = ({
  drives,
  selectedIndex,
}) => (
  <Box flexDirection="column">
    <Text bold color="cyan">
      📚 Kobo to Obsidian - Select Kobo Device
    </Text>
    <Text color="gray">Use ↑↓ to navigate, Enter to select, 'q' to quit</Text>
    <Text> </Text>
    {drives.length === 0 ? (
      <Text color="yellow">
        No Kobo devices found. Make sure your Kobo is connected and mounted.
      </Text>
    ) : (
      drives.map((drive, index) => {
        const userDir = path.basename(path.dirname(drive));
        return (
          <Text key={drive} color={index === selectedIndex ? "green" : "white"}>
            {index === selectedIndex ? "▶ " : "  "}
            📱 Kobo eReader ({userDir}) - {drive}
          </Text>
        );
      })
    )}
  </Box>
);

// Component for annotation selection
interface AnnotationSelectionProps {
  selectedDrive: string;
  annotations: AnnotationWithMetadata[];
  selectedIndex: number;
}

const AnnotationSelectionView: React.FC<AnnotationSelectionProps> = ({
  selectedDrive,
  annotations,
  selectedIndex,
}) => (
  <Box flexDirection="column">
    <Text bold color="cyan">
      📝 Select Annotation File
    </Text>
    <Text color="gray">Kobo Device: {selectedDrive}</Text>
    <Text color="gray">
      Use ↑↓ to navigate, Enter to select, ESC to go back, 'q' to quit
    </Text>
    <Text> </Text>
    {annotations.length === 0 ? (
      <Text color="yellow">No annotation files found</Text>
    ) : (
      annotations.map((annotation, index) => (
        <Text
          key={annotation.file}
          color={index === selectedIndex ? "green" : "white"}
        >
          {index === selectedIndex ? "▶ " : "  "}
          {annotation.hasEpub ? "📚" : "❌"} {annotation.publication.title}
        </Text>
      ))
    )}
  </Box>
);

// Component for publication info
interface PublicationInfoProps {
  publication: Publication;
}

const PublicationInfo: React.FC<PublicationInfoProps> = ({ publication }) => (
  <Text>
    <Text bold color="yellow">
      📚 {publication.title}
    </Text>
    <Text color="gray"> by </Text>
    <Text color="blue">{publication.creator}</Text>
  </Text>
);

// Component for annotation details view
interface AnnotationDetailsProps {
  annotationData: {
    toc: EpubTableOfContents;
    publication: Publication;
    annotations: Annotation[];
  };
  onCreateNotes?: () => void;
}

const AnnotationDetailsView: React.FC<AnnotationDetailsProps> = ({
  annotationData,
  onCreateNotes,
}) => (
  <Box flexDirection="column" gap={1}>
    <Text color="gray">
      Press ESC to go back, 'c' to create notes, 'q' to quit
    </Text>
    <PublicationInfo publication={annotationData.publication} />
    <Text bold color="blue">
      📑 Table of Contents ({annotationData.toc.length} chapters)
    </Text>
    <Text bold color="green">
      ✏️{"  "}Annotations ({annotationData.annotations.length})
    </Text>
    <Text color="cyan">
      💭 Press 'c' to create Obsidian notes from these annotations
    </Text>
  </Box>
);

export const KoboTUI: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.SelectDrive);
  const [drives, setDrives] = useState<string[]>([]);
  const [selectedDriveIndex, setSelectedDriveIndex] = useState(0);
  const [selectedDrive, setSelectedDrive] = useState<string>("");
  const [annotations, setAnnotations] = useState<AnnotationWithMetadata[]>([]);
  const [selectedAnnotationIndex, setSelectedAnnotationIndex] = useState(0);
  const [currentAnnotationData, setCurrentAnnotationData] = useState<{
    toc: EpubTableOfContents;
    publication: Publication;
    annotations: Annotation[];
  } | null>(null);
  const [currentAnnotationFile, setCurrentAnnotationFile] =
    useState<AnnotationFilePath | null>(null);
  const [processedNotes, setProcessedNotes] = useState<ProcessedNotes | null>(
    null
  );
  const [error, setError] = useState<string>("");
  const [successMessage, setSuccessMessage] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);

  // Load drives on mount - specifically look for KOBOeReader mounts
  useEffect(() => {
    try {
      const mediaPath = "/media";
      const koboMounts: string[] = [];

      if (fs.existsSync(mediaPath)) {
        const userDirs = fs.readdirSync(mediaPath);

        for (const userDir of userDirs) {
          const userPath = path.join(mediaPath, userDir);
          try {
            if (fs.statSync(userPath).isDirectory()) {
              // Check if this user has a KOBOeReader mount
              const koboPath = path.join(userPath, "KOBOeReader");
              if (
                fs.existsSync(koboPath) &&
                fs.statSync(koboPath).isDirectory()
              ) {
                koboMounts.push(koboPath);
              }
            }
          } catch {
            // Skip if we can't access this directory
            continue;
          }
        }
      }

      setDrives(koboMounts);

      // Auto-select if there's only one drive
      if (koboMounts.length === 1 && koboMounts[0]) {
        setSelectedDrive(koboMounts[0]);
        setAppState(AppState.SelectAnnotation);
      }
    } catch (err) {
      setError(`Failed to list Kobo drives: ${err}`);
    }
  }, []);

  // Load annotations when drive is selected
  useEffect(() => {
    if (selectedDrive && appState === AppState.SelectAnnotation) {
      try {
        const annotFiles = findAllAnnotationFiles(
          selectedDrive as KoboDrivePath
        );
        const annotationsWithMeta = annotFiles.map((file) => {
          const publication = extractPublication(file);
          const epubFile = findMatchingEpubFile(
            selectedDrive as KoboDrivePath,
            file
          );
          return {
            file,
            publication,
            hasEpub: !!epubFile,
          };
        });
        setAnnotations(annotationsWithMeta);
        setSelectedAnnotationIndex(0);
      } catch (err) {
        setError(`Failed to load annotations: ${err}`);
      }
    }
  }, [selectedDrive, appState]);

  // Async function to load annotation data
  const loadAnnotationData = async (annotation: AnnotationWithMetadata) => {
    setLoading(true);
    setError("");
    try {
      const result = await extractAnnotationData(
        annotation.file,
        selectedDrive as KoboDrivePath
      );
      if (result instanceof Error) {
        setError(result.message);
      } else {
        setCurrentAnnotationData(result);
        setCurrentAnnotationFile(annotation.file);
        setAppState(AppState.ViewAnnotation);
      }
    } catch (err) {
      setError(`Failed to extract annotation data: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  // Function to handle creating notes from annotations
  const handleCreateNotes = async () => {
    if (!currentAnnotationFile) {
      setError("No annotation file selected");
      return;
    }

    // Check if OpenAI API key is set
    if (!process.env.OPENAI_API_KEY) {
      setError(
        "OpenAI API key not found. Please set OPENAI_API_KEY environment variable."
      );
      return;
    }

    setAppState(AppState.ProcessingNotes);
    setError("");

    try {
      const result = await processAnnotationsWithLLM(
        currentAnnotationFile,
        selectedDrive as KoboDrivePath
      );

      if (result instanceof Error) {
        setError(result.message);
        setAppState(AppState.ViewAnnotation);
      } else {
        setProcessedNotes(result);
        autoSaveNotesToFile(result);
        setAppState(AppState.ViewProcessedNotes);
      }
    } catch (err) {
      setError(`Failed to process notes with AI: ${err}`);
      setAppState(AppState.ViewAnnotation);
    }
  };

  // Function to save processed notes to file
  const saveNotesToFile = () => {
    if (!processedNotes || !currentAnnotationData) {
      setError("No processed notes to save");
      setSuccessMessage("");
      return;
    }

    try {
      const fileName = `${currentAnnotationData.publication.title.replace(
        /[^a-zA-Z0-9]/g,
        "_"
      )}_notes.md`;
      const filePath = path.join(process.cwd(), fileName);

      const fileContent = `# ${currentAnnotationData.publication.title}\n\n**Author:** ${currentAnnotationData.publication.creator}\n\n${processedNotes.notes}`;

      fs.writeFileSync(filePath, fileContent, "utf-8");
      setError("");
      setSuccessMessage(`Notes saved to: ${filePath}`);
    } catch (err) {
      setError(`Failed to save notes: ${err}`);
      setSuccessMessage("");
    }
  };

  // Function to automatically save processed notes to file when they are generated
  const autoSaveNotesToFile = (notes: ProcessedNotes) => {
    if (!currentAnnotationData) {
      setError("No annotation data available for saving");
      return;
    }

    try {
      const fileName = `${currentAnnotationData.publication.title.replace(
        /[^a-zA-Z0-9]/g,
        "_"
      )}_notes.md`;
      const filePath = path.join(process.cwd(), fileName);

      fs.writeFileSync(filePath, notes.notes, "utf-8");
      setError("");
      setSuccessMessage(`Notes automatically saved to: ${filePath}`);
    } catch (err) {
      setError(`Failed to save notes: ${err}`);
      setSuccessMessage("");
    }
  };

  useInput((input, key) => {
    if (key.escape) {
      if (appState === AppState.ViewProcessedNotes) {
        setAppState(AppState.ViewAnnotation);
      } else if (appState === AppState.ViewAnnotation) {
        setAppState(AppState.SelectAnnotation);
        setCurrentAnnotationData(null);
        setCurrentAnnotationFile(null);
        setProcessedNotes(null);
      } else if (appState === AppState.SelectAnnotation) {
        setAppState(AppState.SelectDrive);
        setAnnotations([]);
        setSelectedAnnotationIndex(0);
      }
      setError(""); // Clear any errors when going back
      setSuccessMessage(""); // Clear any success messages when going back
      return;
    }

    if (loading || appState === AppState.ProcessingNotes) {
      return; // Don't handle input while loading or processing
    }

    if (input === "q") {
      process.exit(0); // Allow quitting with 'q'
    }

    if (input === "c" && appState === AppState.ViewAnnotation) {
      setSuccessMessage(""); // Clear success message when starting new process
      handleCreateNotes();
      return;
    }

    if (appState === AppState.SelectDrive) {
      if (key.upArrow && selectedDriveIndex > 0) {
        setSelectedDriveIndex(selectedDriveIndex - 1);
      } else if (key.downArrow && selectedDriveIndex < drives.length - 1) {
        setSelectedDriveIndex(selectedDriveIndex + 1);
      } else if (key.return && drives[selectedDriveIndex]) {
        setSelectedDrive(drives[selectedDriveIndex]);
        setAppState(AppState.SelectAnnotation);
      }
    } else if (appState === AppState.SelectAnnotation) {
      if (key.upArrow && selectedAnnotationIndex > 0) {
        setSelectedAnnotationIndex(selectedAnnotationIndex - 1);
      } else if (
        key.downArrow &&
        selectedAnnotationIndex < annotations.length - 1
      ) {
        setSelectedAnnotationIndex(selectedAnnotationIndex + 1);
      } else if (key.return && annotations[selectedAnnotationIndex]) {
        const selectedAnnotation = annotations[selectedAnnotationIndex];
        loadAnnotationData(selectedAnnotation);
      }
    }
  });

  if (loading) {
    return <LoadingView />;
  }

  if (appState === AppState.ProcessingNotes) {
    return <ProcessingNotesView />;
  }

  if (error) {
    return <ErrorView error={error} />;
  }

  if (appState === AppState.SelectDrive) {
    return (
      <DriveSelectionView drives={drives} selectedIndex={selectedDriveIndex} />
    );
  }

  if (appState === AppState.SelectAnnotation) {
    return (
      <AnnotationSelectionView
        selectedDrive={selectedDrive}
        annotations={annotations}
        selectedIndex={selectedAnnotationIndex}
      />
    );
  }

  if (appState === AppState.ViewAnnotation && currentAnnotationData) {
    return (
      <AnnotationDetailsView
        annotationData={currentAnnotationData}
        onCreateNotes={handleCreateNotes}
      />
    );
  }

  if (
    appState === AppState.ViewProcessedNotes &&
    processedNotes &&
    currentAnnotationData
  ) {
    return (
      <ProcessedNotesView
        processedNotes={processedNotes}
        publication={currentAnnotationData.publication}
        successMessage={successMessage}
      />
    );
  }

  return <Text>Loading...</Text>;
};
