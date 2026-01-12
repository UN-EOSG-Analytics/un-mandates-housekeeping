"use client";

import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface EntityComboboxProps {
  value: string;
  onChange: (value: string) => void;
  entities: string[];
  placeholder?: string;
  className?: string;
}

export function EntityCombobox({
  value,
  onChange,
  entities,
  placeholder = "Select entity...",
  className,
}: EntityComboboxProps) {
  const [open, setOpen] = React.useState(false);

  const allEntities = React.useMemo(() => {
    const items = [
      { value: "PPBD", label: "PPBD" },
      ...entities.map((e) => ({ value: e, label: e })),
      { value: "Other", label: "Other" },
    ];
    return items;
  }, [entities]);

  const displayValue = React.useMemo(() => {
    if (!value) return placeholder;
    const found = allEntities.find((entity) => entity.value === value);
    return found?.label || value;
  }, [value, allEntities, placeholder]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between font-normal transition-colors",
            !value && "text-gray-500",
            open && "border-un-blue ring-1 ring-un-blue",
            className,
          )}
        >
          {displayValue}
          <ChevronsUpDown className={cn(
            "ml-2 h-4 w-4 shrink-0 transition-colors",
            open ? "text-un-blue" : "opacity-50"
          )} />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) p-0 border-un-blue/20" align="start">
        <Command>
          <CommandInput 
            placeholder="Search entity..." 
            className="h-9 focus:ring-0 border-b border-un-blue/10"
            value={open ? undefined : displayValue}
          />
          <CommandList>
            <CommandEmpty className="py-6 text-sm text-gray-500">No entity found.</CommandEmpty>
            <CommandGroup>
              {allEntities.map((entity) => (
                <CommandItem
                  key={entity.value}
                  value={entity.value}
                  onSelect={(currentValue) => {
                    onChange(currentValue === value ? "" : currentValue);
                    setOpen(false);
                  }}
                  className="aria-selected:bg-un-blue/5 aria-selected:text-un-blue"
                >
                  {entity.label}
                  <Check
                    className={cn(
                      "ml-auto h-4 w-4 text-un-blue",
                      value === entity.value ? "opacity-100" : "opacity-0",
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
