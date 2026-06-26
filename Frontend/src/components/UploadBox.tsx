import { useRef, useState } from "react";

type UploadBoxProps = {
  file: File | null;
  disabled?: boolean;
  onSelectFile: (file: File) => void;
};

export function UploadBox({ file, disabled, onSelectFile }: UploadBoxProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragActive(false);

    const droppedFile = event.dataTransfer.files?.[0];
    if (droppedFile) {
      onSelectFile(droppedFile);
    }
  };

  return (
    <div
      className={`upload-box ${dragActive ? "upload-box-active" : ""}`}
      onDragEnter={(event) => {
        event.preventDefault();
        setDragActive(true);
      }}
      onDragLeave={(event) => {
        event.preventDefault();
        setDragActive(false);
      }}
      onDragOver={(event) => event.preventDefault()}
      onDrop={handleDrop}
    >
      <input
        ref={inputRef}
        hidden
        accept=".csv,text/csv"
        type="file"
        onChange={(event) => {
          const selectedFile = event.target.files?.[0];
          if (selectedFile) {
            onSelectFile(selectedFile);
          }
        }}
      />
      <button
        type="button"
        className="upload-drop-prompt"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
      >
        <span className="upload-drop-icon" aria-hidden="true">⇧</span>
        <span>
          <strong>Drag & drop CSV file here</strong>
          <small>or click to browse</small>
        </span>
      </button>
      <div className={`upload-selected-file ${file ? "upload-selected-file-ready" : ""}`}>
        <span className="upload-file-icon" aria-hidden="true">▤</span>
        <span className="upload-file-copy">
          <strong>{file ? file.name : "No file selected yet"}</strong>
          <small>
            {file
              ? `${formatFileSize(file.size)} · CSV ready`
              : "Drag and drop a CSV file or click the upload area to choose one."}
          </small>
        </span>
      </div>
    </div>
  );
}

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
