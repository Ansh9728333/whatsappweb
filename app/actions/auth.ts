"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createSession, deleteSession } from "@/lib/session";

// ── Zod Schemas ──────────────────────────────────────────────────────────────

const LoginSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email." }).trim(),
  password: z.string().min(1, { message: "Password is required." }),
});

const SignupSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters." }).trim(),
  email: z.string().email({ message: "Please enter a valid email." }).trim(),
  businessName: z
    .string()
    .min(2, { message: "Business name must be at least 2 characters." })
    .trim(),
  password: z
    .string()
    .min(8, { message: "Password must be at least 8 characters." })
    .regex(/[a-zA-Z]/, { message: "Password must contain at least one letter." })
    .regex(/[0-9]/, { message: "Password must contain at least one number." }),
});

export type FormState = {
  errors?: Record<string, string[]>;
  message?: string;
} | undefined;

// ── Login Action ─────────────────────────────────────────────────────────────

export async function loginAction(
  state: FormState,
  formData: FormData
): Promise<FormState> {
  // 1. Validate
  const validated = LoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }

  const { email, password } = validated.data;

  // 2. Find user
  const user = await prisma.user.findUnique({
    where: { email },
    include: { customer: true },
  });

  if (!user || !user.isActive) {
    return { message: "Invalid email or password." };
  }

  // 3. Verify password
  const passwordMatch = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatch) {
    return { message: "Invalid email or password." };
  }

  // 4. Check customer status
  if (user.role === "CUSTOMER" && user.customer?.status === "SUSPENDED") {
    return { message: "Your account has been suspended. Please contact support." };
  }

  // 5. Create session
  await createSession({
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role as "ADMIN" | "CUSTOMER",
    customerId: user.customer?.id,
  });

  // 6. Redirect
  redirect("/dashboard");
}

// ── Signup Action ────────────────────────────────────────────────────────────

export async function signupAction(
  state: FormState,
  formData: FormData
): Promise<FormState> {
  // 1. Validate
  const validated = SignupSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    businessName: formData.get("businessName"),
    password: formData.get("password"),
  });

  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }

  const { name, email, businessName, password } = validated.data;

  // 2. Check for existing user
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    return { errors: { email: ["An account with this email already exists."] } };
  }

  // 3. Hash password
  const passwordHash = await bcrypt.hash(password, 12);

  // 4. Get default plan (Starter)
  const starterPlan = await prisma.plan.findFirst({ where: { name: "Starter" } });

  // 5. Create user + customer
  const user = await prisma.user.create({
    data: {
      email,
      name,
      passwordHash,
      role: "CUSTOMER",
      customer: {
        create: {
          businessName,
          status: "PENDING",
          planId: starterPlan?.id,
        },
      },
    },
    include: { customer: true },
  });

  // 6. Create session
  await createSession({
    userId: user.id,
    email: user.email,
    name: user.name,
    role: "CUSTOMER",
    customerId: user.customer?.id,
  });

  // 7. Redirect
  redirect("/dashboard");
}

// ── Logout Action ─────────────────────────────────────────────────────────────

export async function logoutAction(): Promise<void> {
  await deleteSession();
  redirect("/login");
}
