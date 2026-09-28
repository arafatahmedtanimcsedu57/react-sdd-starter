---
paths:
  - 'src/**/*Form*.tsx'
  - 'src/features/*/schema.ts'
---

# Forms (React Hook Form + Zod) — code pattern

Rules are in `CLAUDE.md` → State, data fetching & forms.

```tsx
// src/features/<feature>/components/ExampleForm.tsx  (shared form → src/components/)
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const schema = z.object({
  name: z.string().min(1, 'Required'),
  quantity: z.coerce.number().positive('Must be greater than 0'),
})
export type ExampleValues = z.infer<typeof schema>

export interface ExampleFormProps {
  onSubmit: (v: ExampleValues) => void
}

export function ExampleForm({ onSubmit }: ExampleFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ExampleValues>({ resolver: zodResolver(schema) })

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <label htmlFor="name">Name</label>
      <input id="name" {...register('name')} />
      {errors.name && <p role="alert">{errors.name.message}</p>}

      <label htmlFor="quantity">Quantity</label>
      <input id="quantity" inputMode="numeric" {...register('quantity')} />
      {errors.quantity && <p role="alert">{errors.quantity.message}</p>}

      <button type="submit">Save</button>
    </form>
  )
}
```
