"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signupAction, type FormState } from "@/app/actions/auth";
import { Zap, Mail, Lock, User, Building2, ArrowRight, Loader2 } from "lucide-react";

export default function SignupPage() {
  const [state, action, pending] = useActionState<FormState, FormData>(
    signupAction,
    undefined
  );

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-[#0a0f1e] py-8">
      {/* Animated background */}
      <div className="absolute inset-0">
        <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 left-1/4 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl animate-pulse delay-700" />
      </div>
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
          backgroundSize: "50px 50px",
        }}
      />

      <div className="relative z-10 w-full max-w-md px-4">
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-teal-600 rounded-xl flex items-center justify-center shadow-lg">
              <Zap size={20} className="text-white" />
            </div>
            <div>
              <p className="text-white font-bold text-xl tracking-wider">WhatsApp System</p>
              <p className="text-emerald-400/70 text-xs">WhatsApp Console Platform</p>
            </div>
          </div>

          <h1 className="text-2xl font-bold text-white mb-1">Create your account</h1>
          <p className="text-slate-400 text-sm mb-8">Start sending WhatsApp messages at scale</p>

          {state?.message && (
            <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-red-400 text-sm">{state.message}</p>
            </div>
          )}

          <form action={action} className="space-y-4">
            {/* Name */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-slate-300 mb-1.5">
                Full name
              </label>
              <div className="relative">
                <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  id="name"
                  name="name"
                  type="text"
                  placeholder="John Doe"
                  className="w-full pl-9 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/40 transition-all"
                />
              </div>
              {state?.errors?.name && (
                <p className="mt-1 text-xs text-red-400">{state.errors.name[0]}</p>
              )}
            </div>

            {/* Business name */}
            <div>
              <label htmlFor="businessName" className="block text-sm font-medium text-slate-300 mb-1.5">
                Business name
              </label>
              <div className="relative">
                <Building2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  id="businessName"
                  name="businessName"
                  type="text"
                  placeholder="Acme Corp"
                  className="w-full pl-9 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/40 transition-all"
                />
              </div>
              {state?.errors?.businessName && (
                <p className="mt-1 text-xs text-red-400">{state.errors.businessName[0]}</p>
              )}
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-1.5">
                Email address
              </label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="you@company.com"
                  className="w-full pl-9 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/40 transition-all"
                />
              </div>
              {state?.errors?.email && (
                <p className="mt-1 text-xs text-red-400">{state.errors.email[0]}</p>
              )}
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="Min. 8 characters"
                  className="w-full pl-9 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/40 transition-all"
                />
              </div>
              {state?.errors?.password && (
                <div className="mt-1">
                  {state.errors.password.map((err) => (
                    <p key={err} className="text-xs text-red-400">• {err}</p>
                  ))}
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={pending}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-semibold rounded-lg transition-all duration-200 shadow-lg shadow-emerald-500/20 disabled:opacity-60 disabled:cursor-not-allowed mt-2"
            >
              {pending ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Creating account...
                </>
              ) : (
                <>
                  Create account
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            Already have an account?{" "}
            <Link href="/login" className="text-emerald-400 hover:text-emerald-300 font-medium transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
