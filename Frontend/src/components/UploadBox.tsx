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
      <div>
        <p className="eyebrow">Upload CSV</p>
        <h3>Drag a network traffic CSV here or select one from your device.</h3>
        <p className="upload-copy">
          Use the template if you need the expected column format.
        </p>
      </div>
      <div className="upload-actions">
        <button
          type="button"
          className="primary-button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
        >
          Choose file
        </button>
        <span>{file ? file.name : "No file selected yet"}</span>
      </div>
    </div>
  );
}
