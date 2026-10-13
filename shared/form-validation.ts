import type { FormConfig, FormField } from "./schema";
export function fieldVisible(field: FormField, values: Record<string, unknown>) {
  const property = String(values.propertyType ?? "").toLowerCase();
  if (field.visibilityRule === "residential_only" && property !== "residential") return false;
  if (field.visibilityRule === "commercial_only" && property !== "commercial") return false;
  return !field.showWhenField || !field.showWhenValues || field.showWhenValues.includes(String(values[field.showWhenField] ?? ""));
}
export function validateForm(config: FormConfig, values: Record<string, unknown>) {
  const errors: Record<string, string> = {};
  for (const step of config.steps.filter(s => s.enabled)) for (const f of step.fields.filter(f => f.enabled && fieldVisible(f, values))) {
    const v = values[f.id];
    const empty = v === undefined || v === null || (typeof v === "string" && !v.trim());
    if (f.required && (empty || (f.type === "checkbox" && v !== true))) errors[f.id] = `${f.label} is required`;
    else if (!empty && f.type === "checkbox" && typeof v !== "boolean") errors[f.id] = `Choose ${f.label}`;
    else if (!empty && f.type !== "checkbox" && typeof v !== "string" && typeof v !== "number") errors[f.id] = `Enter a valid ${f.label}`;
    else if (!empty && f.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v))) errors[f.id] = "Enter a valid email address";
    else if (!empty && f.type === "number" && !Number.isFinite(Number(v))) errors[f.id] = `Enter a valid ${f.label}`;
    else if (!empty && f.type === "select" && !f.options?.includes(String(v))) errors[f.id] = `Select a valid ${f.label}`;
    else if (!empty && f.type === "date" && (!/^\d{4}-\d{2}-\d{2}$/.test(String(v)) || (Number.isNaN(Date.parse(String(v))) || new Date(String(v)).toISOString().slice(0,10) !== v))) errors[f.id] = `Enter a valid ${f.label}`;
  }
  return errors;
}
export function formName(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 && value.trim().length <= 120 ? value.trim() : null;
}

export function validFormConfig(value: unknown): value is FormConfig {
  const c = value as FormConfig;
  if (!c || !Array.isArray(c.steps) || c.steps.length > 30 || !c.steps.some(s => s.enabled)) return false;
  const ids = new Set<string>();
  return c.steps.every(s => s && typeof s.id === "string" && typeof s.title === "string" && typeof s.enabled === "boolean" && Array.isArray(s.fields) && s.fields.length <= 100 && s.fields.every(f => {
    if (!f || typeof f.id !== "string" || !f.id || ["__proto__", "constructor", "prototype"].includes(f.id) || ids.has(f.id)) return false;
    ids.add(f.id);
    return typeof f.label === "string" && ["text", "email", "tel", "number", "select", "textarea", "checkbox", "date"].includes(f.type) && typeof f.enabled === "boolean" && typeof f.required === "boolean" && (!f.options || Array.isArray(f.options) && f.options.every(o => typeof o === "string"));
  }));
}
