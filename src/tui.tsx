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
import { extractAnnotationData } from "./workflow";

enum AppState {
  SelectDrive,
  SelectAnnotation,
  ViewAnnotation,
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
const LoadingView: React.FC = () => (
  <Box flexDirection="column">
    <Text color="yellow">⏳ Loading annotation data...</Text>
  </Box>
);

// Component for displaying errors
const ErrorView: React.FC<{ error: string }> = ({ error }) => (
  <Box flexDirection="column">
    <Text color="red">Error: {error}</Text>
    <Text color="gray">Press ESC to go back</Text>
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

// Component for table of contents
interface TableOfContentsProps {
  toc: EpubTableOfContents;
}

const TableOfContentsView: React.FC<TableOfContentsProps> = ({ toc }) => (
  <Box flexDirection="column" marginBottom={1}>
    <Text bold color="blue">
      📑 Table of Contents ({toc.length} chapters)
    </Text>
    {toc.slice(0, 5).map((chapter, index) => (
      <Text key={index} color="gray">
        • {chapter.chapter}
      </Text>
    ))}
    {toc.length > 5 && (
      <Text color="gray">... and {toc.length - 5} more chapters</Text>
    )}
  </Box>
);

// Component for annotations list
interface AnnotationsListProps {
  annotations: Annotation[];
}

const AnnotationsList: React.FC<AnnotationsListProps> = ({ annotations }) => {
  const numOfAnnotationsToShow = 3;

  return (
    <Box flexDirection="column">
      <Text bold color="green">
        ✏️ Annotations ({annotations.length})
      </Text>
      {annotations.length === 0 ? (
        <Text color="gray">No annotations found</Text>
      ) : (
        <>
          {annotations
            .slice(0, numOfAnnotationsToShow)
            .map((annotation, index) => (
              <Box key={index} flexDirection="column" marginBottom={1}>
                <Text>{annotation.text}</Text>
                <Text color="gray" wrap="truncate">
                  Location: {annotation.start}
                </Text>
              </Box>
            ))}
          {annotations.length > numOfAnnotationsToShow && (
            <Text color="gray">
              ... and {annotations.length - numOfAnnotationsToShow} more
              annotations
            </Text>
          )}
        </>
      )}
    </Box>
  );
};

// Component for annotation details view
interface AnnotationDetailsProps {
  annotationData: {
    toc: EpubTableOfContents;
    publication: Publication;
    annotations: Annotation[];
  };
}

const AnnotationDetailsView: React.FC<AnnotationDetailsProps> = ({
  annotationData,
}) => (
  <Box flexDirection="column">
    <Text color="gray">Press ESC to go back, 'q' to quit</Text>
    <PublicationInfo publication={annotationData.publication} />

    {annotationData.toc.length > 0 && (
      <TableOfContentsView toc={annotationData.toc} />
    )}

    <AnnotationsList annotations={annotationData.annotations} />
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
  const [error, setError] = useState<string>("");
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
        setAppState(AppState.ViewAnnotation);
      }
    } catch (err) {
      setError(`Failed to extract annotation data: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  useInput((input, key) => {
    if (key.escape) {
      if (appState === AppState.ViewAnnotation) {
        setAppState(AppState.SelectAnnotation);
        setCurrentAnnotationData(null);
      } else if (appState === AppState.SelectAnnotation) {
        setAppState(AppState.SelectDrive);
        setAnnotations([]);
        setSelectedAnnotationIndex(0);
      }
      setError(""); // Clear any errors when going back
      return;
    }

    if (loading) {
      return; // Don't handle input while loading
    }

    if (input === "q") {
      process.exit(0); // Allow quitting with 'q'
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
    return <AnnotationDetailsView annotationData={currentAnnotationData} />;
  }

  return <Text>Loading...</Text>;
};
