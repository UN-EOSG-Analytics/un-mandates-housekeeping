"use client";

import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Lock, Mail } from "lucide-react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function ReviewBlockedDialog({ isOpen, onClose }: Props) {
  const [showDialog, setShowDialog] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Add a slight delay before showing the dialog for a friendlier UX
  useEffect(() => {
    if (isOpen) {
      timerRef.current = setTimeout(() => {
        setShowDialog(true);
      }, 150);
    } else {
      // Reset showDialog when isOpen becomes false
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Sync dialog state with isOpen prop
      setShowDialog(false);
    }
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isOpen]);

  // Handle close
  const handleClose = () => {
    setShowDialog(false);
    onClose();
  };

  return (
    <Dialog open={showDialog} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-left">
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
            <Lock className="h-5 w-5 text-amber-600" />
          </div>
          <DialogTitle>Submission Under Review</DialogTitle>
          <DialogDescription>
            Your changes could not be saved because your submission is already
            under review.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-2 space-y-4">
          <p className="text-sm text-gray-600">
            If you would like to opt-in to the pilot instead of the DOCX
            submission for the remainder of the cycle, please contact us.
          </p>
          <a
            href="mailto:support@eosg.dev?subject=Opt-in%20to%20Mandate%20Housekeeping%20Pilot"
            className="flex w-full items-center justify-center gap-2 rounded-md bg-un-blue px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-un-blue/90"
          >
            <Mail className="h-4 w-4" />
            Send Email to support@eosg.dev
          </a>
          <button
            onClick={handleClose}
            className="w-full rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200"
          >
            Continue Exploring
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
