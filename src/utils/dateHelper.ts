/**
 * Helper to safely format date strings into Spanish (es-AR/es-MX)
 * without throwing RangeError: Invalid time value on malformed or empty strings.
 */
export function safeFormatDate(
  dateInput: string | undefined | null,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!dateInput) return "No registrada";
  try {
    const cleanDateStr = String(dateInput).trim();
    if (!cleanDateStr || cleanDateStr === "undefined" || cleanDateStr === "null") {
      return "No registrada";
    }

    let dateObj: Date;
    // If the date string already includes 'T' followed by time (e.g. ISO string), parse it directly.
    if (cleanDateStr.includes("T")) {
      dateObj = new Date(cleanDateStr);
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(cleanDateStr)) {
      // Standard ISO-8601 date-only format (YYYY-MM-DD), parse as local midnight
      dateObj = new Date(cleanDateStr + "T00:00:00");
    } else {
      dateObj = new Date(cleanDateStr);
    }

    if (isNaN(dateObj.getTime())) {
      // If still invalid, try standard Date constructor on original string
      const rawDate = new Date(cleanDateStr);
      if (isNaN(rawDate.getTime())) {
        return cleanDateStr; // Return raw string as fallback
      }
      dateObj = rawDate;
    }

    return dateObj.toLocaleDateString('es-AR', options || {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  } catch (error) {
    console.error("Error formatting date:", error);
    return String(dateInput) || "No registrada";
  }
}
