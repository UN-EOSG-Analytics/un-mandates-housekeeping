import {
  AlertTriangle,
  ArrowUp,
  FileQuestion,
  FileText,
  HelpCircle,
  Info,
  X,
  XCircle,
} from "lucide-react";

export type WarningIconType =
  | "alert"
  | "arrow-up"
  | "file"
  | "file-question"
  | "help"
  | "info"
  | "x"
  | "x-circle";

const iconMap: Record<
  WarningIconType,
  React.ComponentType<{ className?: string }>
> = {
  alert: AlertTriangle,
  "arrow-up": ArrowUp,
  file: FileText,
  "file-question": FileQuestion,
  help: HelpCircle,
  info: Info,
  x: X,
  "x-circle": XCircle,
};

export function WarningIcon({
  icon,
  className = "h-3.5 w-3.5",
}: {
  icon: WarningIconType;
  className?: string;
}) {
  const Icon = iconMap[icon];
  return <Icon className={className} />;
}
