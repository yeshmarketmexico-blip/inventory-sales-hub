import { useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DateRange } from '@/hooks/useSheetData';

interface Props {
  dateRange: DateRange;
  onDateRangeChange: (range: DateRange) => void;
}

export function DatePickerRange({ dateRange, onDateRangeChange }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "justify-start text-left font-normal text-xs h-8 border-border bg-secondary",
            !dateRange.from && "text-muted-foreground"
          )}
        >
          <CalendarIcon className="mr-2 h-3 w-3" />
          {dateRange.from ? (
            dateRange.to ? (
              <>
                {format(dateRange.from, "dd MMM", { locale: es })} - {format(dateRange.to, "dd MMM yyyy", { locale: es })}
              </>
            ) : (
              format(dateRange.from, "dd MMM yyyy", { locale: es })
            )
          ) : (
            <span>Seleccionar fechas</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="end">
        <Calendar
          initialFocus
          mode="range"
          defaultMonth={dateRange.from}
          selected={{ from: dateRange.from, to: dateRange.to }}
          onSelect={(range) => {
            onDateRangeChange({ from: range?.from, to: range?.to });
            if (range?.from && range?.to) setOpen(false);
          }}
          numberOfMonths={2}
          className="p-3 pointer-events-auto"
        />
      </PopoverContent>
    </Popover>
  );
}
