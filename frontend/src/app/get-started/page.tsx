"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Building2,
  Check,
  CheckCircle2,
  ChevronRight,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { api, ApiError, setToken } from "@/lib/api";

export default function GetStartedPage() {
  const [isMounted, setIsMounted] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    communityName: "",
    unitCount: "",
    role: "manager",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [countryCode, setCountryCode] = useState("+91");
  const [loadingStep, setLoadingStep] = useState(0);

  useEffect(() => {
    setIsMounted(true);
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const planParam = params.get("plan");
      if (planParam === "portfolio") {
        setFormData((prev) => ({ ...prev, role: "other" }));
      }
    }
  }, []);

  const getCleanPhone = (phoneStr: string) => {
    let clean = phoneStr.trim().replace(/[-+ ]/g, "");
    if (clean.startsWith("91") && clean.length === 12) {
      clean = clean.substring(2);
    } else if (clean.startsWith("0") && clean.length === 11) {
      clean = clean.substring(1);
    }
    return clean;
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) newErrors.name = "Full name is required";
    
    const cleanPhone = getCleanPhone(formData.phone);
    if (!formData.phone.trim()) {
      newErrors.phone = "Phone number is required";
    } else if (countryCode === "+91") {
      if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
        newErrors.phone = "Please enter a valid 10-digit Indian phone number";
      }
    } else {
      if (!/^\d{7,15}$/.test(cleanPhone)) {
        newErrors.phone = "Please enter a valid phone number (7 to 15 digits)";
      }
    }
    if (!formData.email.trim()) {
      newErrors.email = "Email address is required";
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "Please enter a valid email address";
    }
    if (!formData.communityName.trim()) {
      newErrors.communityName = "Apartment or community name is required";
    }
    return newErrors;
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => {
        const copy = { ...prev };
        delete copy[name];
        return copy;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    const newErrors = validate();
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      const cleanPhone = getCleanPhone(formData.phone);
      const fullPhone = `${countryCode}${cleanPhone}`;
      const result = await api<{ accessToken: string | null; user: any | null }>("/leads", {
        method: "POST",
        body: JSON.stringify({
          name: formData.name,
          phone: fullPhone,
          email: formData.email.trim(),
          communityName: formData.communityName,
          unitCount: formData.unitCount ? parseInt(formData.unitCount) : null,
          role: formData.role,
        }),
      });

      setSubmitted(true);

      if (result.accessToken) {
        // Increment the loading steps every 750ms
        const interval = setInterval(() => {
          setLoadingStep((prev) => prev + 1);
        }, 750);

        // Auto login and redirect after 3 seconds of showing the provisioning screen
        setTimeout(() => {
          clearInterval(interval);
          setToken(result.accessToken!);
          window.location.assign("/dashboard");
        }, 3000);
      }

    } catch (err) {
      if (err instanceof ApiError) {
        setServerError(err.message);
      } else {
        setServerError("Something went wrong. Please try again.");
      }
      setIsSubmitting(false);
    }
  };

  if (!isMounted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-slate-400 font-semibold animate-pulse">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900 font-sans antialiased overflow-x-hidden">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <Link href="/home" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white shadow-brand-glow">
              <Building2 className="h-4.5 w-4.5" />
            </span>
            <span className="text-sm font-bold tracking-tight text-slate-900">
              NivaasOS
            </span>
          </Link>
          <Link
            href="/presentation"
            className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Pitch
          </Link>
        </div>
      </header>

      {/* Main content grid */}
      <main className="flex-1 flex items-center justify-center p-6 md:p-12">
        <div className="mx-auto grid max-w-5xl grid-cols-1 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-lg md:grid-cols-12">
          
          {/* Brand highlights section */}
          <div className="bg-brand-900 p-8 text-white md:col-span-5 flex flex-col justify-between space-y-8 relative overflow-hidden">
            {/* ambient glow overlay */}
            <div
              aria-hidden
              className="pointer-events-none absolute -left-40 -top-40 h-80 w-80 rounded-full bg-brand-500/20 blur-3xl"
            />
            
            <div className="space-y-6 relative z-10">
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-800 px-3 py-1 text-xs font-semibold text-brand-200">
                <Sparkles className="h-3.5 w-3.5 animate-pulse" /> Launching In India
              </span>
              <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">
                Empowering Your Apartment Association
              </h2>
              <p className="text-sm text-brand-200 leading-relaxed">
                NivaasOS replaces Excel, papers, and WhatsApp disputes with a transparent digital portal that owners, tenants, and elders trust.
              </p>
            </div>

            <div className="space-y-4 relative z-10">
              <div className="flex gap-3.5 items-start">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-800 text-brand-300 mt-0.5 shrink-0">
                  <Check className="h-3.5 w-3.5" />
                </span>
                <span className="text-xs text-brand-100 font-medium">
                  <strong>10-minute setup</strong>: Add emails, units, and go live.
                </span>
              </div>
              <div className="flex gap-3.5 items-start">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-800 text-brand-300 mt-0.5 shrink-0">
                  <Check className="h-3.5 w-3.5" />
                </span>
                <span className="text-xs text-brand-100 font-medium">
                  <strong>Total Dues Control</strong>: Automated monthly maintenance bills and late fees.
                </span>
              </div>
              <div className="flex gap-3.5 items-start">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-800 text-brand-300 mt-0.5 shrink-0">
                  <Check className="h-3.5 w-3.5" />
                </span>
                <span className="text-xs text-brand-100 font-medium">
                  <strong>Transparent Expenses</strong>: Receipt attachments visible to every resident.
                </span>
              </div>
            </div>

            <div className="text-[10px] text-brand-300 flex items-center gap-1 border-t border-brand-800 pt-4 relative z-10">
              <ShieldCheck className="h-3.5 w-3.5" /> Secure Google Sign-In Whitelist
            </div>
          </div>

          {/* Lead capture form / success state */}
          <div className="p-8 md:col-span-7 flex flex-col justify-center">
            <AnimatePresence mode="wait">
              {!submitted ? (
                <motion.div
                  key="form"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-6"
                >
                  <div>
                    <h3 className="text-xl font-bold text-slate-800">
                      Get Started with NivaasOS
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      Enter your details below. We'll reach out to schedule a demo and set up your sandbox portal.
                    </p>
                  </div>

                  {serverError && (
                    <div className="rounded-xl bg-red-50 p-3 text-xs font-medium text-red-700 border border-red-100">
                      {serverError}
                    </div>
                  )}

                  <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Full Name */}
                    <div>
                      <label className="text-xs font-bold text-slate-500 block mb-1">
                        Full Name *
                      </label>
                      <input
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        className={`w-full rounded-xl border p-2.5 text-sm transition-all focus:ring-1 focus:ring-brand-500 ${
                          errors.name ? "border-red-400 bg-red-50/10" : "border-slate-200"
                        }`}
                        placeholder="e.g., Aditya Rao"
                      />
                      {errors.name && (
                        <span className="text-[10px] text-red-500 mt-1 block font-medium">
                          {errors.name}
                        </span>
                      )}
                    </div>

                    {/* Contact details */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Email */}
                      <div>
                        <label className="text-xs font-bold text-slate-500 block mb-1">
                          Email Address *
                        </label>
                        <input
                          type="email"
                          name="email"
                          value={formData.email}
                          onChange={handleChange}
                          className={`w-full rounded-xl border p-2.5 text-sm transition-all focus:ring-1 focus:ring-brand-500 ${
                            errors.email ? "border-red-400 bg-red-50/10" : "border-slate-200"
                          }`}
                          placeholder="e.g., aditya.rao@gmail.com"
                        />
                        <span className="text-[10px] text-slate-400 mt-1 block leading-tight">
                          Note: Please use a Google/Gmail account if you want to log back in later via Google sign-in.
                        </span>
                        {errors.email && (
                          <span className="text-[10px] text-red-500 mt-1 block font-medium">
                            {errors.email}
                          </span>
                        )}
                      </div>

                      {/* Phone */}
                      <div>
                        <label className="text-xs font-bold text-slate-500 block mb-1">
                          Phone Number *
                        </label>
                        <div className="flex gap-2">
                          <select
                            name="countryCode"
                            value={countryCode}
                            onChange={(e) => setCountryCode(e.target.value)}
                            className="rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-sm transition-all focus:ring-1 focus:ring-brand-500 w-24 shrink-0"
                          >
                            <option value="+91">🇮🇳 +91</option>
                            <option value="+1">🇺🇸 +1</option>
                            <option value="+44">🇬🇧 +44</option>
                            <option value="+971">🇦🇪 +971</option>
                            <option value="+65">🇸🇬 +65</option>
                            <option value="+61">🇦🇺 +61</option>
                          </select>
                          <input
                            type="tel"
                            name="phone"
                            value={formData.phone}
                            onChange={handleChange}
                            className={`flex-1 rounded-xl border p-2.5 text-sm transition-all focus:ring-1 focus:ring-brand-500 ${
                              errors.phone ? "border-red-400 bg-red-50/10" : "border-slate-200"
                            }`}
                            placeholder="Mobile number"
                          />
                        </div>
                        {errors.phone && (
                          <span className="text-[10px] text-red-500 mt-1 block font-medium">
                            {errors.phone}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Community Info */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {/* Society Name */}
                      <div className="sm:col-span-2">
                        <label className="text-xs font-bold text-slate-500 block mb-1">
                          Society / Enclave Name *
                        </label>
                        <input
                          type="text"
                          name="communityName"
                          value={formData.communityName}
                          onChange={handleChange}
                          className={`w-full rounded-xl border p-2.5 text-sm transition-all focus:ring-1 focus:ring-brand-500 ${
                            errors.communityName ? "border-red-400 bg-red-50/10" : "border-slate-200"
                          }`}
                          placeholder="e.g., Greenwood Heights"
                        />
                        {errors.communityName && (
                          <span className="text-[10px] text-red-500 mt-1 block font-medium">
                            {errors.communityName}
                          </span>
                        )}
                      </div>

                      {/* Unit Count */}
                      <div>
                        <label className="text-xs font-bold text-slate-500 block mb-1">
                          No. of Flats
                        </label>
                        <input
                          type="number"
                          name="unitCount"
                          value={formData.unitCount}
                          onChange={handleChange}
                          className="w-full rounded-xl border border-slate-200 p-2.5 text-sm transition-all focus:ring-1 focus:ring-brand-500"
                          placeholder="e.g., 12"
                          min="1"
                        />
                      </div>
                    </div>

                    {/* Role Dropdown */}
                    <div>
                      <label className="text-xs font-bold text-slate-500 block mb-1">
                        Your Role in the Association
                      </label>
                      <select
                        name="role"
                        value={formData.role}
                        onChange={handleChange}
                        className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-sm transition-all focus:ring-1 focus:ring-brand-500"
                      >
                        <option value="manager">Property Manager / Estate Executive</option>
                        <option value="president">RWA President / Chairman</option>
                        <option value="treasurer">RWA Treasurer / Joint Secretary</option>
                        <option value="owner">Apartment Owner / Committee Member</option>
                        <option value="other">Other / Builder</option>
                      </select>
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-brand-600 py-3 text-sm font-bold text-white shadow-brand-glow hover:bg-brand-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSubmitting ? "Submitting request..." : "Get Started Now"}
                      {!isSubmitting && <ChevronRight className="h-4 w-4" />}
                    </button>
                  </form>
                </motion.div>
              ) : (
                formData.role === "other" ? (
                  <motion.div
                    key="success-custom"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center space-y-6 py-6 max-w-md mx-auto"
                  >
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 mx-auto">
                      <CheckCircle2 className="h-10 w-10 text-emerald-600" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-xl font-bold text-slate-800">
                        Request Submitted!
                      </h3>
                      <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                        Thank you for your interest in NivaasOS, <strong>{formData.name}</strong>.
                      </p>
                      <p className="text-xs text-slate-600 mt-3 leading-relaxed">
                        We have recorded your custom query for <strong>{formData.communityName}</strong>. A product consultant will contact you at <strong>{formData.phone}</strong> or <strong>{formData.email}</strong> within 24 hours to schedule a custom console walkthrough.
                      </p>
                    </div>
                    <div className="pt-4">
                      <Link
                        href="/presentation"
                        className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 transition-colors"
                      >
                        Return to Presentation
                      </Link>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="success-sandbox"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center space-y-6 py-6 max-w-md mx-auto"
                  >
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-indigo-100 text-brand-600 animate-bounce mx-auto">
                      <Building2 className="h-9 w-9 text-brand-600" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-xl font-bold text-slate-800">
                        Provisioning Sandbox...
                      </h3>
                      <p className="text-xs text-slate-500">
                        ⚠️ Please stay on this page. Do not close or refresh this window.
                      </p>
                    </div>
                    
                    {/* Progress checklist */}
                    <div className="space-y-3.5 text-left max-w-sm mx-auto bg-slate-50 border border-slate-100 rounded-2xl p-5 shadow-inner">
                      {[
                        "Initializing secure sandbox database...",
                        `Creating ${formData.unitCount || 10} apartments & mock residents...`,
                        "Generating June invoices & ledger entries...",
                        "Seeding active work orders & governance polls...",
                      ].map((step, idx) => {
                        const isCompleted = loadingStep > idx;
                        const isActive = loadingStep === idx;
                        return (
                          <div key={idx} className="flex items-center gap-3 transition-all duration-300">
                            {isCompleted ? (
                              <motion.div
                                initial={{ scale: 0.8, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600"
                              >
                                <Check className="h-3.5 w-3.5" />
                              </motion.div>
                            ) : isActive ? (
                              <div className="flex h-5 w-5 shrink-0 items-center justify-center">
                                <div className="h-4 w-4 rounded-full border-2 border-brand-600 border-t-transparent animate-spin" />
                              </div>
                            ) : (
                              <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-slate-200" />
                            )}
                            <span className={`text-xs font-semibold ${
                              isCompleted ? "text-slate-400 line-through" : isActive ? "text-brand-700 font-bold" : "text-slate-500"
                            }`}>
                              {step}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Progress bar */}
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200">
                      <motion.div
                        className="bg-brand-600 h-full"
                        initial={{ width: "0%" }}
                        animate={{ width: "100%" }}
                        transition={{ duration: 3, ease: "easeInOut" }}
                      />
                    </div>
                    
                    <p className="text-[10px] text-slate-400">
                      Setting active roles and logging you in. Handing you the keys to your custom portal!
                    </p>
                  </motion.div>
                )
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>
    </div>
  );
}
