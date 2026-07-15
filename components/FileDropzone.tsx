"use client";

import { useRef, useState } from "react";
import { UploadCloud, FileSpreadsheet, X } from "lucide-react";

interface Props {
  file: File | null;
  onFileSelected: (file: File | null) => void;
  accept?: string;
}

export default function FileDropzone({ file, onFileSelected, accept = ".xlsx,.xls,.csv,.pdf" }: Props) {
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
      <div className="flex items-center justify-between rounded-xl border border-[#D9E2EC] bg-[#F8FAFC] px-5 py-4">
        <div className="flex items-center gap-3">
          <FileSpreadsheet className="w-6 h-6 text-[#0B1F3A]" />
          <div>
            <p className="text-sm font-medium text-[#0F172A]">{file.name}</p>
            <p className="text-xs text-[#64748B]">{(file.size / 1024).toFixed(0)} KB</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onFileSelected(null)}
          className="p-1.5 rounded-lg hover:bg-[#E8EDF4] transition-colors duration-150"
        >
          <X className="w-4 h-4 text-[#64748B]" />
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
      className={`cursor-pointer rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors duration-150 ${
        dragOver ? "border-[#0B1F3A] bg-[#F8FAFC]" : "border-[#D9E2EC] hover:border-[#0B1F3A]/40"
      }`}
    >
      <UploadCloud className="w-10 h-10 mx-auto mb-3 text-[#64748B]" />
      <p className="font-medium mb-1 text-[#0F172A]">اسحب وأفلت ملف Excel أو CSV أو PDF هنا، أو انقر للتصفح</p>
      <p className="text-xs text-[#64748B]">يدعم ملفات .xlsx و .xls و .csv و .pdf النصية</p>
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
