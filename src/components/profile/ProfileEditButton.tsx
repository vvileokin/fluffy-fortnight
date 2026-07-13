"use client";

import * as React from "react";
import { Pencil, Check, Upload } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";

const inputCls =
  "h-11 w-full rounded-lg border border-border bg-surface-2 px-3 text-sm text-ink placeholder:text-ink-subtle " +
  "transition-colors focus:border-accent focus:outline-none";

export function ProfileEditButton({ handle }: { handle: string }) {
  const [open, setOpen] = React.useState(false);
  const [nick, setNick] = React.useState(handle);
  const [saved, setSaved] = React.useState(false);

  function save() {
    setSaved(true);
    window.setTimeout(() => {
      setSaved(false);
      setOpen(false);
    }, 900);
  }

  return (
    <>
      <Button variant="outline" size="md" onClick={() => setOpen(true)}>
        <Pencil className="size-4" />
        Редагувати
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Редагувати профіль"
        footer={
          <>
            <Button variant="ghost" size="md" onClick={() => setOpen(false)}>
              Скасувати
            </Button>
            <Button size="md" onClick={save} className="min-w-28">
              {saved ? (
                <>
                  <Check className="size-4" strokeWidth={3} /> Збережено
                </>
              ) : (
                "Зберегти"
              )}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Avatar name={nick || handle} size="lg" ring />
            <button className="flex items-center gap-2 rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm font-semibold text-ink-muted transition-colors hover:bg-surface-3 hover:text-ink">
              <Upload className="size-4" />
              Змінити аватар
            </button>
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

          <p className="text-xs leading-relaxed text-ink-subtle">
            Способи входу можна керувати у розділі профілю нижче.
          </p>
        </div>
      </Modal>
    </>
  );
}
