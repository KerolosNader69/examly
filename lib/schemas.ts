import { z } from 'zod';

export const signupSchema = z
  .object({
    name: z.string().trim().min(2, 'Full name is required'),
    email: z.email('Enter a valid email address'),
    dob: z
      .string()
      .min(1, 'Date of birth is required')
      .refine((value) => {
        const birthDate = new Date(value);
        if (Number.isNaN(birthDate.getTime()) || birthDate > new Date()) return false;
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const isBeforeBirthday =
          today.getMonth() < birthDate.getMonth() ||
          (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate());
        if (isBeforeBirthday) age -= 1;
        return age >= 13;
      }, 'You must be at least 13 years old'),
    gender: z.enum(['Female', 'Male', 'Other'], { message: 'Please select a gender' }),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Include an uppercase letter (A-Z)')
      .regex(/[a-z]/, 'Include a lowercase letter (a-z)')
      .regex(/[0-9]/, 'Include a number (0-9)')
      .regex(/[^A-Za-z0-9]/, 'Include a special character (!@#$...)'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
    role: z.enum(['teacher', 'student'], { message: 'Please choose a role' }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const loginSchema = z.object({
  email: z.email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const forgotPasswordSchema = z.object({
  email: z.email('Enter a valid email address'),
});

export const questionSchema = z.object({
  text: z.string().trim().min(1, 'Question text is required'),
  keywords: z.array(z.string().trim()).optional(),
  timeLimit: z.number().int().min(30, 'Time limit must be at least 30s').max(180, 'Time limit must be at most 180s'),
});

export const examSchema = z.object({
  title: z.string().trim().min(1, 'Exam title is required'),
  subject: z.string().trim().min(1, 'Subject is required'),
  description: z.string().optional(),
  questions: z.array(questionSchema).min(1, 'Add at least one question'),
});

export function zodErrors(error: z.ZodError): Record<string, string> {
  const flat: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.join('.') : 'form';
    if (!flat[key]) flat[key] = issue.message;
  }
  return flat;
}

export type SignupData = z.infer<typeof signupSchema>;
export type LoginData = z.infer<typeof loginSchema>;
export type ExamData = z.infer<typeof examSchema>;
