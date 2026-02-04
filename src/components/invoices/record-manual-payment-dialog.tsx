"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DollarSign, AlertCircle } from "lucide-react";

const manualPaymentFormSchema = z.object({
  amount: z
    .string()
    .min(1, "Amount is required")
    .refine(
      (val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0,
      "Amount must be greater than 0"
    ),
  payment_method: z.string().min(1, "Payment method is required"),
  payment_date: z.string().min(1, "Payment date is required"),
  payment_reference: z.string().optional(),
  notes: z.string().optional(),
});

type ManualPaymentFormData = z.infer<typeof manualPaymentFormSchema>;

interface RecordManualPaymentDialogProps {
  invoiceId: string;
  balanceDue: number; // in cents
  trigger?: React.ReactNode;
  onSuccess?: () => void;
}

const PAYMENT_METHODS = [
  { value: "check", label: "Check" },
  { value: "cash", label: "Cash" },
  { value: "wire_transfer", label: "Wire Transfer" },
  { value: "ach", label: "ACH Transfer" },
  { value: "money_order", label: "Money Order" },
  { value: "credit_card", label: "Credit Card (Manual)" },
  { value: "other", label: "Other" },
];

export function RecordManualPaymentDialog({
  invoiceId,
  balanceDue,
  trigger,
  onSuccess,
}: RecordManualPaymentDialogProps) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const balanceDueInDollars = balanceDue / 100;

  const form = useForm<ManualPaymentFormData>({
    resolver: zodResolver(manualPaymentFormSchema),
    defaultValues: {
      amount: balanceDueInDollars.toFixed(2),
      payment_method: "",
      payment_date: new Date().toISOString().split("T")[0], // Today's date
      payment_reference: "",
      notes: "",
    },
  });

  const onSubmit = async (data: ManualPaymentFormData) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/invoices/${invoiceId}/payments/manual`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            amount: parseFloat(data.amount),
            payment_method: data.payment_method,
            payment_date: data.payment_date,
            payment_reference: data.payment_reference,
            notes: data.notes,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to record payment");
      }

      // Success
      setOpen(false);
      form.reset();

      // Call success callback
      if (onSuccess) {
        onSuccess();
      }

      // Refresh the page to show updated data
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!isLoading) {
      setOpen(newOpen);
      if (!newOpen) {
        form.reset();
        setError(null);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <DollarSign className="mr-2 h-4 w-4" />
            Record Manual Payment
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>Record Manual Payment</DialogTitle>
          <DialogDescription>
            Record a payment received outside of Stripe (check, cash, wire
            transfer, etc.). Balance due: ${balanceDueInDollars.toFixed(2)}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount *</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        {...field}
                        type="number"
                        step="0.01"
                        min="0.01"
                        max={balanceDueInDollars}
                        placeholder="0.00"
                        className="pl-9"
                        disabled={isLoading}
                      />
                    </div>
                  </FormControl>
                  <FormDescription>
                    Enter the payment amount in dollars
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="payment_method"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Payment Method *</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    disabled={isLoading}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select payment method" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {PAYMENT_METHODS.map((method) => (
                        <SelectItem key={method.value} value={method.value}>
                          {method.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    How was the payment received?
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="payment_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Payment Date *</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="date"
                      max={new Date().toISOString().split("T")[0]}
                      disabled={isLoading}
                    />
                  </FormControl>
                  <FormDescription>
                    When was the payment received?
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="payment_reference"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Payment Reference</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Check number, wire confirmation, etc."
                      disabled={isLoading}
                    />
                  </FormControl>
                  <FormDescription>
                    Check number, wire confirmation, or other reference
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Additional notes about this payment..."
                      rows={3}
                      disabled={isLoading}
                    />
                  </FormControl>
                  <FormDescription>
                    Any additional details about this payment
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Recording..." : "Record Payment"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
