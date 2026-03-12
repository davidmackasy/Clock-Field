import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ImagePlus, X } from "lucide-react";

export interface PhotoItem {
  dataUrl: string;
  caption: string;
  name: string;
}

interface Props {
  photos: PhotoItem[];
  onChange: (photos: PhotoItem[]) => void;
  maxPhotos?: number;
  maxSizeMB?: number;
  label?: string;
}

export function PhotoUploader({ photos, onChange, maxPhotos = 10, maxSizeMB = 3, label = "Add Photos" }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png"];

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    setError(null);
    const remaining = maxPhotos - photos.length;
    if (remaining <= 0) { setError(`Max ${maxPhotos} photos allowed`); return; }
    const toAdd = Array.from(files).slice(0, remaining);
    const readers: Promise<PhotoItem>[] = toAdd.map(file => new Promise((resolve, reject) => {
      if (!ALLOWED_TYPES.includes(file.type)) {
        reject(new Error(`${file.name}: only JPG and PNG files are allowed`));
        return;
      }
      if (file.size > maxSizeMB * 1024 * 1024) {
        reject(new Error(`${file.name} exceeds ${maxSizeMB}MB limit`));
        return;
      }
      const reader = new FileReader();
      reader.onload = () => resolve({ dataUrl: reader.result as string, caption: "", name: file.name });
      reader.onerror = reject;
      reader.readAsDataURL(file);
    }));
    Promise.allSettled(readers).then(results => {
      const succeeded: PhotoItem[] = [];
      const errors: string[] = [];
      for (const r of results) {
        if (r.status === "fulfilled") succeeded.push(r.value);
        else errors.push(r.reason?.message || "Upload error");
      }
      if (errors.length) setError(errors.join("; "));
      if (succeeded.length) onChange([...photos, ...succeeded]);
    });
    if (inputRef.current) inputRef.current.value = "";
  };

  const remove = (idx: number) => onChange(photos.filter((_, i) => i !== idx));
  const updateCaption = (idx: number, caption: string) => {
    onChange(photos.map((p, i) => i === idx ? { ...p, caption } : p));
  };

  return (
    <div className="space-y-3">
      {photos.length < maxPhotos && (
        <div>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png"
            multiple
            className="hidden"
            onChange={e => handleFiles(e.target.files)}
            data-testid="input-photo-file"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
            className="w-full border-dashed"
            data-testid="button-add-photos"
          >
            <ImagePlus className="w-4 h-4 mr-2" />
            {label} ({photos.length}/{maxPhotos})
          </Button>
        </div>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
      {photos.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {photos.map((photo, idx) => (
            <div key={idx} className="relative group" data-testid={`photo-preview-${idx}`}>
              <img
                src={photo.dataUrl}
                alt={photo.name}
                className="w-full h-20 object-cover rounded-md border"
              />
              <button
                type="button"
                onClick={() => remove(idx)}
                className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                data-testid={`button-remove-photo-${idx}`}
              >
                <X className="w-3 h-3" />
              </button>
              <Input
                placeholder="Caption (optional)"
                value={photo.caption}
                onChange={e => updateCaption(idx, e.target.value)}
                className="mt-1 h-7 text-xs"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
