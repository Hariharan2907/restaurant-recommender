import { Text } from "react-native";
import { Button } from "./Button";
import { Sheet } from "./Sheet";
import { Notice } from "./Feedback";
import { colors, type } from "@/lib/theme";
export function ConfirmDialog({
  visible,
  title,
  description,
  onClose,
  onConfirm,
  busy,
  error,
  confirmLabel = "Delete permanently",
  busyLabel = "Removing…",
  cancelLabel = "Keep it",
}: {
  visible: boolean;
  title: string;
  description: string;
  onClose: () => void;
  onConfirm: () => void;
  busy: boolean;
  error?: string | null;
  confirmLabel?: string;
  busyLabel?: string;
  cancelLabel?: string;
}) {
  return (
    <Sheet
      visible={visible}
      title={title}
      onClose={() => {
        if (!busy) onClose();
      }}
      footer={
        <>
          <Button
            label={busy ? busyLabel : confirmLabel}
            loading={busy}
            onPress={onConfirm}
          />
          <Button
            label={cancelLabel}
            variant="secondary"
            disabled={busy}
            onPress={onClose}
          />
        </>
      }
    >
      <Text style={{ ...type.body, color: colors.textMuted }}>
        {description}
      </Text>
      {error && <Notice error>{error}</Notice>}
    </Sheet>
  );
}
