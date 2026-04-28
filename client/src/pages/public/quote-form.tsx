import { useState, useEffect } from "react";
import { useRoute } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, CheckCircle2, AlertCircle, ChevronRight, ChevronLeft, ClipboardList } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FormConfig, FormStep, FormField } from "@shared/schema";

type FormData = { id: string; name: string; config: FormConfig; companyName: string; companyLogo: string | null; brandColor: string | null };

function FormInput({ field, value, onChange, error }: {
  field: FormField;
  value: any;
  onChange: (v: any) => void;
  error?: string;
}) {
  const base = cn(
    "w-full rounded-xl border px-4 py-3 text-sm bg-white transition-all outline-none",
    "focus:ring-2 focus:ring-offset-0 placeholder-gray-400 text-gray-900",
    error
      ? "border-red-300 focus:border-red-400 focus:ring-red-100"
      : "border-gray-200 focus:border-indigo-300 focus:ring-indigo-100"
  );

  if (field.type === "select") {
    return (
      <select className={cn(base, "cursor-pointer")} value={value ?? ""} onChange={e => onChange(e.target.value)}>
        <option value="">Select an option…</option>
        {(field.options ?? []).map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    );
  }

  if (field.type === "textarea") {
    return (
      <textarea
        className={cn(base, "resize-none min-h-[100px]")}
        placeholder={field.placeholder}
        value={value ?? ""}
        onChange={e => onChange(e.target.value)}
        rows={4}
      />
    );
  }

  if (field.type === "checkbox") {
    return (
      <label className="flex items-start gap-3 cursor-pointer group">
        <div className={cn(
          "w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all",
          value ? "border-indigo-500 bg-indigo-500" : "border-gray-300 group-hover:border-indigo-400"
        )}>
          {value && <svg viewBox="0 0 10 8" className="w-3 h-3 fill-white"><path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>}
        </div>
        <input type="checkbox" checked={!!value} onChange={e => onChange(e.target.checked)} className="sr-only" />
        <span className="text-sm text-gray-600 leading-5">{field.label}</span>
      </label>
    );
  }

  return (
    <input
      type={field.type}
      className={base}
      placeholder={field.placeholder}
      value={value ?? ""}
      onChange={e => onChange(e.target.value)}
    />
  );
}

function StepForm({ step, values, errors, onChange }: {
  step: FormStep;
  values: Record<string, any>;
  errors: Record<string, string>;
  onChange: (id: string, value: any) => void;
}) {
  const enabledFields = step.fields.filter(f => f.enabled);
  const rows: FormField[][] = [];
  let i = 0;
  while (i < enabledFields.length) {
    const f = enabledFields[i];
    if (f.column === "half" && enabledFields[i + 1]?.column === "half") {
      rows.push([f, enabledFields[i + 1]]);
      i += 2;
    } else {
      rows.push([f]);
      i++;
    }
  }

  return (
    <div className="space-y-4">
      {rows.map((row, ri) => (
        <div key={ri} className={cn("flex gap-3", row.length === 2 ? "flex-row" : "flex-col")}>
          {row.map(field => (
            <div key={field.id} className="flex-1 flex flex-col gap-1.5">
              {field.type !== "checkbox" && (
                <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
                  {field.label}
                  {field.required && <span className="text-red-500 text-xs">*</span>}
                </label>
              )}
              <FormInput
                field={field}
                value={values[field.id]}
                onChange={v => onChange(field.id, v)}
                error={errors[field.id]}
              />
              {errors[field.id] && (
                <p className="text-xs text-red-500 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> {errors[field.id]}
                </p>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export default function PublicQuoteForm() {
  const [, params] = useRoute("/form/:companyId/:slug");
  const companyId = params?.companyId ?? "";
  const slug = params?.slug ?? "";

  const [currentStep, setCurrentStep] = useState(0);
  const [formValues, setFormValues] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  const { data: formData, isLoading, error: loadError } = useQuery<FormData>({
    queryKey: ["/api/public/forms", companyId, slug],
    queryFn: () => fetch(`/api/public/forms/${companyId}/${slug}`).then(r => {
      if (!r.ok) throw new Error("Form not found");
      return r.json();
    }),
    retry: false,
  });

  const submitMutation = useMutation({
    mutationFn: () => fetch(`/api/public/forms/${companyId}/${slug}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formValues),
    }).then(r => r.json()),
    onSuccess: () => setSubmitted(true),
  });

  const brandColor = formData?.brandColor || "#6366f1";

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
          <p className="text-sm text-gray-500">Loading form…</p>
        </div>
      </div>
    );
  }

  if (loadError || !formData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-gray-400" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Form Not Found</h2>
          <p className="text-gray-500 text-sm">This form may have been removed or deactivated.</p>
        </div>
      </div>
    );
  }

  const enabledSteps = formData.config.steps.filter(s => s.enabled);
  const step = enabledSteps[currentStep];
  const isLastStep = currentStep === enabledSteps.length - 1;

  const validateStep = () => {
    const newErrors: Record<string, string> = {};
    step.fields.filter(f => f.enabled && f.required).forEach(f => {
      const v = formValues[f.id];
      if (!v || (typeof v === "string" && !v.trim())) {
        newErrors[f.id] = `${f.label} is required`;
      }
    });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (!validateStep()) return;
    setErrors({});
    if (isLastStep) {
      submitMutation.mutate();
    } else {
      setCurrentStep(prev => prev + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleBack = () => {
    setErrors({});
    setCurrentStep(prev => prev - 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleReset = () => {
    setSubmitted(false);
    setCurrentStep(0);
    setFormValues({});
    setErrors({});
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex flex-col">
        <header className="pt-10 pb-6 text-center px-4">
          {formData.companyLogo ? (
            <img src={formData.companyLogo} alt={formData.companyName} className="h-12 w-auto mx-auto mb-3 object-contain" />
          ) : (
            <div className="w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center" style={{ background: brandColor }}>
              <ClipboardList className="w-6 h-6 text-white" />
            </div>
          )}
          <h1 className="text-base font-semibold text-gray-900">{formData.companyName}</h1>
        </header>

        <main className="flex-1 flex items-center justify-center px-4 pb-16">
          <div className="w-full max-w-md text-center">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
              style={{ background: `${brandColor}15` }}
            >
              <CheckCircle2 className="w-10 h-10" style={{ color: brandColor }} />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">Request Submitted!</h2>
            <p className="text-gray-500 mb-8 leading-relaxed">
              Thank you for reaching out. We've received your request and will be in touch shortly.
            </p>
            <button
              onClick={handleReset}
              className="px-6 py-3 rounded-xl text-sm font-medium text-white transition-opacity hover:opacity-90"
              style={{ background: brandColor }}
              data-testid="button-submit-another"
            >
              Submit Another Request
            </button>
          </div>
        </main>

        <footer className="py-5 text-center">
          <p className="text-xs text-gray-400">Powered by <span className="font-medium">Clockfield</span></p>
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex flex-col">
      {/* Header */}
      <header className="pt-8 pb-4 text-center px-4">
        {formData.companyLogo ? (
          <img src={formData.companyLogo} alt={formData.companyName} className="h-12 w-auto mx-auto mb-3 object-contain" />
        ) : (
          <div className="w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center" style={{ background: brandColor }}>
            <ClipboardList className="w-6 h-6 text-white" />
          </div>
        )}
        <h1 className="text-base font-semibold text-gray-900">{formData.companyName}</h1>
        <p className="text-sm text-gray-500 mt-0.5">{formData.name}</p>

        {/* Divider */}
        <div className="mt-4 h-px bg-gray-100 max-w-md mx-auto" />
      </header>

      {/* Progress bar */}
      <div className="px-4 py-3 max-w-lg mx-auto w-full">
        <div className="flex gap-1.5 mb-2">
          {enabledSteps.map((s, idx) => (
            <div
              key={s.id}
              className="flex-1 h-1.5 rounded-full transition-all duration-500"
              style={{
                background: idx < currentStep
                  ? brandColor
                  : idx === currentStep
                  ? brandColor
                  : "#e5e7eb",
                opacity: idx < currentStep ? 0.5 : 1,
              }}
            />
          ))}
        </div>
        <p className="text-[11px] text-gray-400 text-right">
          Step {currentStep + 1} of {enabledSteps.length}
        </p>
      </div>

      {/* Main form card */}
      <main className="flex-1 px-4 pb-6">
        <div className="max-w-lg mx-auto w-full">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-gray-900">{step.title}</h2>
            </div>

            <StepForm
              step={step}
              values={formValues}
              errors={errors}
              onChange={(id, value) => {
                setFormValues(prev => ({ ...prev, [id]: value }));
                if (errors[id]) setErrors(prev => { const e = { ...prev }; delete e[id]; return e; });
              }}
            />

            {/* Navigation */}
            <div className={cn("flex gap-3 mt-8", currentStep > 0 ? "justify-between" : "justify-end")}>
              {currentStep > 0 && (
                <button
                  data-testid="button-form-back"
                  onClick={handleBack}
                  className="flex items-center gap-2 px-5 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" /> Back
                </button>
              )}
              <button
                data-testid={isLastStep ? "button-form-submit" : "button-form-next"}
                onClick={handleNext}
                disabled={submitMutation.isPending}
                className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50 min-w-[140px] justify-center"
                style={{ background: brandColor }}
              >
                {submitMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : isLastStep ? (
                  <>Submit Request <ChevronRight className="w-4 h-4" /></>
                ) : (
                  <>Next <ChevronRight className="w-4 h-4" /></>
                )}
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-5 text-center">
        <p className="text-xs text-gray-400">Powered by <span className="font-medium">Clockfield</span></p>
      </footer>
    </div>
  );
}
