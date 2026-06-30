"use client";

import { useRef, useState } from "react";
import { UploadCloud, FileSpreadsheet, X } from "lucide-react";

interface Props {
  file: File | null;
  onFileSelected: (file: File | null) => void;
  accept?: string;
}

export default function FileDropzone({ file, onFileSelected, accept = ".xlsx,.xls" }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) onFileSelected(dropped);
  }

  if (file) {
    return (
      <div className="flex items-center justify-between bg-fp-green/5 border border-fp-green/20 rounded-xl px-5 py-4">
        <div className="flex items-center gap-3">
          <FileSpreadsheet className="w-6 h-6 text-fp-green" />
          <div>
            <p className="text-sm font-medium">{file.name}</p>
            <p className="text-xs text-fp-slate">{(file.size / 1024).toFixed(0)} KB</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onFileSelected(null)}
          className="p-1.5 rounded-full hover:bg-black/5"
        >
          <X className="w-4 h-4 text-fp-slate" />
        </button>
      </div>
    );
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={`cursor-pointer rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors ${
        dragOver ? "border-fp-green bg-fp-green/5" : "border-black/15 hover:border-fp-green/40"
      }`}
    >
      <UploadCloud className="w-10 h-10 mx-auto mb-3 text-fp-slate" />
      <p className="font-medium mb-1">اسحب وأفلت ملف Excel هنا، أو انقر للتصفح</p>
      <p className="text-xs text-fp-slate">يدعم ملفات .xlsx و .xls</p>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFileSelected(f);
        }}
      />
    </div>
  );
}
