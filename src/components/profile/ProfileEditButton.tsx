"use client";

import * as React from "react";
import { Pencil, Check, Upload, Loader2 } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";

const inputCls =
  "h-11 w-full rounded-lg border border-border bg-surface-2 px-3 text-sm text-ink placeholder:text-ink-subtle " +
  "transition-colors focus:border-accent focus:outline-none";

export function ProfileEditButton({
  handle,
  avatarUrl,
}: {
  handle: string;
  avatarUrl?: string | null;
}) {
  const router = useRouter();
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [open, setOpen] = React.useState(false);
  const [nick, setNick] = React.useState(handle);
  const [file, setFile] = React.useState<File | null>(null);
  const [preview, setPreview] = React.useState<string | null>(avatarUrl ?? null);
  const [busy, setBusy] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreview((prev) => {
      if (prev && prev.startsWith("blob:")) URL.revokeObjectURL(prev);
      return URL.createObjectURL(f);
    });
    setError(null);
  }

  async function save() {
    setBusy(true);
    setError(null);
    const fd = new FormData();
    fd.append("handle", nick);
    if (file) fd.append("file", file);
    const res = await fetch("/api/profile", { method: "POST", body: fd });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok && j.ok) {
      setSaved(true);
      router.refresh();
      window.setTimeout(() => {
        setSaved(false);
        setOpen(false);
      }, 900);
    } else {
      setError(j.error || "Не вдалося зберегти");
    }
  }

  return (
    <>
      <Button variant="outline" size="md" onClick={() => setOpen(true)}>
        <Pencil className="size-4" />
        Редагувати
      </Button>

      <Modal
        open={open}
        onClose={() => (busy ? undefined : setOpen(false))}
        title="Редагувати профіль"
        footer={
          <>
            <Button variant="ghost" size="md" onClick={() => setOpen(false)} disabled={busy}>
              Скасувати
            </Button>
            <Button size="md" onClick={save} disabled={busy} className="min-w-28">
              {saved ? (
                <>
                  <Check className="size-4" strokeWidth={3} /> Збережено
                </>
              ) : busy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                "Зберегти"
              )}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Avatar name={nick || handle} src={preview} size="lg" ring />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-2 rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm font-semibold text-ink-muted transition-colors hover:bg-surface-3 hover:text-ink"
            >
              <Upload className="size-4" />
              Змінити аватар
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={pickFile}
            />
          </div>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-ink-muted">
              Нікнейм
            </span>
            <input
              value={nick}
              onChange={(e) => setNick(e.target.value)}
              className={inputCls}
              maxLength={24}
              placeholder="Твій нік"
            />
          </label>

          {error && <p className="text-xs font-medium text-danger">{error}</p>}

          <p className="text-xs leading-relaxed text-ink-subtle">
            Фото до 5MB. Способи входу можна керувати у розділі профілю нижче.
          </p>
        </div>
      </Modal>
    </>
  );
}
