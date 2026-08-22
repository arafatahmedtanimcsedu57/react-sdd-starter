import { z } from 'zod'

export const itemSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
})
export const newItemSchema = itemSchema.omit({ id: true })

export type Item = z.infer<typeof itemSchema>
export type NewItem = z.infer<typeof newItemSchema>
