export interface ParsedError {
  title: string;
  description: string;
}

/**
 * Maps raw backend/API errors to safe, user-friendly title + description pairs.
 * Never exposes SQL constraint names, status codes, or internal JSON to users.
 */
export function parseApiError(err: any): ParsedError {
  const raw: string = err?.message || "";

  if (
    raw.toLowerCase().includes("duplicate") ||
    raw.toLowerCase().includes("unique constraint") ||
    raw.toLowerCase().includes("users_email_unique") ||
    raw.toLowerCase().includes("email already") ||
    raw.toLowerCase().includes("already in use") ||
    raw.toLowerCase().includes("already exists")
  ) {
    return {
      title: "Account already exists",
      description:
        "An account with this email already exists. Please sign in instead, or use a different email.",
    };
  }

  if (raw.includes("402") || raw.toLowerCase().includes("plan limit") || raw.toLowerCase().includes("upgrade")) {
    return {
      title: "Plan limit reached",
      description: "You've reached the limit for your current plan. Please upgrade to continue.",
    };
  }

  if (
    raw.includes("401") ||
    raw.toLowerCase().includes("unauthorized") ||
    raw.toLowerCase().includes("not authenticated")
  ) {
    return {
      title: "Session expired",
      description: "Please sign in again to continue.",
    };
  }

  if (
    raw.includes("403") ||
    raw.toLowerCase().includes("forbidden") ||
    raw.toLowerCase().includes("not allowed")
  ) {
    return {
      title: "Access denied",
      description: "You don't have permission to perform this action.",
    };
  }

  if (raw.includes("404") || raw.toLowerCase().includes("not found")) {
    return {
      title: "Not found",
      description: "The requested item could not be found.",
    };
  }

  if (
    raw.includes("400") ||
    raw.toLowerCase().includes("invalid") ||
    raw.toLowerCase().includes("required")
  ) {
    return {
      title: "Invalid input",
      description: "Please check your information and try again.",
    };
  }

  if (
    raw.toLowerCase().includes("network") ||
    raw.toLowerCase().includes("failed to fetch") ||
    raw.toLowerCase().includes("fetch")
  ) {
    return {
      title: "Connection error",
      description: "Unable to reach the server right now. Please try again in a moment.",
    };
  }

  return {
    title: "Something went wrong",
    description: "We couldn't complete your request right now. Please try again.",
  };
}
