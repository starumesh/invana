import { forwardRef, useEffect, useState, type InputHTMLAttributes } from "react";
import { Input } from "@/components/ui/Field";
import { formatTime12, parseTimeText } from "@/lib/time12";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> & {
  /** 24h "HH:mm" or "" */
  value: string;
  onChange: (hhmm: string) => void;
  /** Called with a message when the typed text can't be read as a time. */
  onValidityMessage?: (message: string | null) => void;
};

/**
 * Plain text time field ("07:30 PM"). Never opens a native picker; accepts common typed
 * forms and normalizes on blur.
 */
export const TimeInput = forwardRef<HTMLInputElement, Props>(function TimeInput({ value, onChange, onValidityMessage, onBlur, ...props }, ref) {
  const [text, setText] = useState(formatTime12(value));
  useEffect(() => {
    setText((prev) => (parseTimeText(prev) === value ? prev : formatTime12(value)));
  }, [value]);

  return (
    <Input
      {...props}
      ref={ref}
      type="text"
      inputMode="text"
      autoComplete="off"
      placeholder={props.placeholder ?? "07:30 PM"}
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        const parsed = parseTimeText(e.target.value);
        if (parsed) {
          onValidityMessage?.(null);
          if (parsed !== value) onChange(parsed);
        }
      }}
      onBlur={(e) => {
        const parsed = parseTimeText(text);
        if (parsed) {
          setText(formatTime12(parsed));
          onValidityMessage?.(null);
        } else if (text.trim()) {
          onValidityMessage?.("Enter a time like 07:30 PM.");
        } else {
          onChange("");
        }
        onBlur?.(e);
      }}
    />
  );
});
