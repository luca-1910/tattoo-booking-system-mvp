/* eslint-disable @next/next/no-img-element */
"use client";

import { useRef, useState, useCallback } from "react";
import Cropper from "react-easy-crop";
import type { Area } from "react-easy-crop";
import { Upload, Pencil, X, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "./ui/button";
import { supabaseBrowser } from "@/lib/supabaseBrowserClient";

// ── Canvas crop helper ────────────────────────────────────────────────────────

function getCroppedBlob(imageSrc: string, pixelCrop: Area): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = pixelCrop.width;
      canvas.height = pixelCrop.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("Canvas context unavailable")); return; }
      ctx.drawImage(
        image,
        pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height,
        0, 0, pixelCrop.width, pixelCrop.height,
      );
      canvas.toBlob(
        (blob) => blob ? resolve(blob) : reject(new Error("toBlob failed")),
        "image/jpeg",
        0.92,
      );
    };
    image.onerror = reject;
    image.src = imageSrc;
  });
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface ImageUploaderProps {
  value: string;
  onChange: (url: string) => void;
  /** Path prefix inside the bucket, e.g. "hero/artist-abc" */
  storagePath: string;
  /** Crop aspect ratio — 16/7 for hero, 1 for square portfolio */
  aspectRatio?: number;
  /** Tailwind classes for the preview container */
  previewClassName?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ImageUploader({
  value,
  onChange,
  storagePath,
  aspectRatio = 1,
  previewClassName = "h-40",
}: ImageUploaderProps) {
  const supabase = supabaseBrowser();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [srcForCrop, setSrcForCrop] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const openPicker = () => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setRotation(0);
    fileInputRef.current?.click();
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setSrcForCrop(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const onCropComplete = useCallback((_: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels);
  }, []);

  const handleUpload = async () => {
    if (!srcForCrop || !croppedAreaPixels) return;
    setUploading(true);
    setUploadError(null);
    try {
      const blob = await getCroppedBlob(srcForCrop, croppedAreaPixels);
      const path = `${storagePath}/${Date.now()}.jpg`;
      const { error } = await supabase.storage
        .from("artist-uploads")
        .upload(path, blob, { contentType: "image/jpeg", upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("artist-uploads").getPublicUrl(path);
      onChange(data.publicUrl);
      setSrcForCrop(null);
    } catch (e: unknown) {
      setUploadError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const dismiss = () => {
    setSrcForCrop(null);
    setUploadError(null);
  };

  return (
    <>
      {/* ── Preview tile ── */}
      <div
        className={`relative bg-[#0a0a0a] border border-[rgba(255,255,255,0.1)] rounded-lg overflow-hidden ${previewClassName}`}
      >
        {value ? (
          <img src={value} alt="Preview" className="w-full h-full object-cover" />
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-[#a0a0a0] min-h-[100px]">
            <Upload className="w-6 h-6" />
            <span className="text-xs">No image</span>
          </div>
        )}

        {/* Hover overlay */}
        <button
          type="button"
          onClick={openPicker}
          className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 hover:opacity-100 transition-opacity gap-2 text-white text-sm font-medium"
        >
          <Pencil className="w-4 h-4" />
          {value ? "Change image" : "Upload image"}
        </button>
      </div>

      {/* Upload / Remove buttons below preview */}
      <div className="flex gap-2 mt-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={openPicker}
          className="border-[rgba(255,255,255,0.15)] text-[#a0a0a0] hover:text-[#e5e5e5]"
        >
          <Upload className="w-3.5 h-3.5 mr-1.5" />
          {value ? "Replace" : "Upload"}
        </Button>
        {value && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onChange("")}
            className="border-[rgba(255,255,255,0.15)] text-red-400 hover:text-red-300 hover:border-red-400/40"
          >
            <X className="w-3.5 h-3.5 mr-1.5" />
            Remove
          </Button>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onFileChange}
      />

      {/* ── Crop modal ── */}
      {srcForCrop && (
        <div className="fixed inset-0 z-[100] bg-black/90 flex flex-col items-center justify-center gap-5 p-4">
          <p className="text-white font-medium">Crop & position your image</p>

          {/* Crop area */}
          <div className="relative w-full max-w-2xl rounded-lg overflow-hidden" style={{ height: "55vh" }}>
            <Cropper
              image={srcForCrop}
              crop={crop}
              zoom={zoom}
              rotation={rotation}
              aspect={aspectRatio}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          </div>

          {/* Controls */}
          <div className="flex flex-col gap-3 w-full max-w-sm">
            {/* Zoom */}
            <div className="flex items-center gap-3">
              <ZoomOut className="w-4 h-4 text-[#a0a0a0] shrink-0" />
              <input
                type="range"
                min={1}
                max={3}
                step={0.01}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="flex-1 accent-[#a32020]"
              />
              <ZoomIn className="w-4 h-4 text-[#a0a0a0] shrink-0" />
            </div>

            {/* Rotation */}
            <div className="flex items-center gap-3">
              <span className="text-[#a0a0a0] text-xs w-16 shrink-0">Rotate {rotation}°</span>
              <input
                type="range"
                min={-180}
                max={180}
                step={1}
                value={rotation}
                onChange={(e) => setRotation(Number(e.target.value))}
                className="flex-1 accent-[#a32020]"
              />
            </div>
          </div>

          {uploadError && (
            <p className="text-red-400 text-sm">{uploadError}</p>
          )}

          <div className="flex gap-3">
            <Button
              onClick={handleUpload}
              disabled={uploading}
              className="bg-[#a32020] hover:bg-[#8a1b1b] text-white px-6"
            >
              {uploading ? "Uploading…" : "Apply & Upload"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={dismiss}
              className="border-[rgba(255,255,255,0.2)] text-[#e5e5e5] hover:bg-white/10"
            >
              <X className="w-4 h-4 mr-1" /> Cancel
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
