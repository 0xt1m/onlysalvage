"use client";
import { useState, useCallback } from "react";
import Image from "next/image";
import { getApiUrl } from "@/lib/apiUrl";

interface UploadFile {
  file: File
  preview: string
  status: "waiting" | "uploading" | "done" | "error"
  progress: number
}

export default function ImageUploader() {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [uploading, setUploading] = useState(false);

  const addFiles = (newFiles: FileList) => {
    const added = Array.from(newFiles)
      .filter((f) => f.type.startsWith("image/"))
      .map((f) => ({
        file: f,
        preview: URL.createObjectURL(f),
        status: "waiting" as const,
        progress: 0,
      }));
    setFiles((prev) => [...prev, ...added]);
  };

  const uploadFile = async (index: number) => {
    setFiles((prev) =>
      prev.map((f, i) => (i === index ? { ...f, status: "uploading" } : f))
    );

    const formData = new FormData();
    formData.append("image", files[index].file);

    // replace with your actual upload endpoint
    await fetch(`${getApiUrl()}/upload`, { method: "POST", body: formData });

    setFiles((prev) =>
      prev.map((f, i) =>
        i === index ? { ...f, status: "done", progress: 100 } : f
      )
    );
  };

  const handleUpload = async () => {
    setUploading(true);
    for (let i = 0; i < files.length; i++) {
      if (files[i].status !== "done") await uploadFile(i);
    }
    setUploading(false);
  };

  return (
    <div>
      <div
        onClick={() => document.getElementById("fileInput")?.click()}
        className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:bg-gray-50 transition"
      >
        <p className="text-gray-500">Click to select photos</p>
        <input
          id="fileInput"
          type="file"
          multiple
          accept="image/*"
          className="hidden"
          onChange={(e) => e.target.files && addFiles(e.target.files)}
        />
      </div>

      {files.length > 0 && (
        <>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3 mt-4">
            {files.map((f, i) => (
              <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-gray-200">
                <Image src={f.preview} alt={`preview ${i}`} fill className="object-cover" />
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-white text-xs font-medium">
                  {f.status === "done" ? "✓" : f.status === "uploading" ? `${f.progress}%` : "waiting"}
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={handleUpload}
            disabled={uploading}
            className="mt-4 px-6 py-2 bg-black text-white rounded-lg disabled:opacity-50"
          >
            {uploading ? "Uploading..." : "Upload all"}
          </button>
        </>
      )}
    </div>
  );
}