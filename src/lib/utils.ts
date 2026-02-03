import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Calculate billable hours (rounds up to nearest hour)
 * For billing purposes, any partial hour is billed as a full hour
 */
export function calculateBillableHours(hours: number): number {
  return Math.ceil(hours)
}

/**
 * Format decimal hours as hours and minutes string
 * e.g., 1.5 -> "1h 30m", 0.25 -> "15m", 2 -> "2h"
 */
export function formatHoursMinutes(decimalHours: number): string {
  const totalMinutes = Math.round(decimalHours * 60)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  if (hours === 0) {
    return `${minutes}m`
  }
  if (minutes === 0) {
    return `${hours}h`
  }
  return `${hours}h ${minutes}m`
}

/**
 * Format decimal hours for display with billable hours
 * e.g., 1.5 hours -> "1h 30m (billed: 2h)"
 */
export function formatTimeWithBillable(decimalHours: number): string {
  const actual = formatHoursMinutes(decimalHours)
  const billable = calculateBillableHours(decimalHours)
  if (billable === decimalHours) {
    return actual
  }
  return `${actual} (billed: ${billable}h)`
}
