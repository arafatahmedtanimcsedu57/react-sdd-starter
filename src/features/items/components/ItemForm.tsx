import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { newItemSchema, type NewItem } from '../schema'
import { useAddItemMutation } from '../../../services/api'

export function ItemForm() {
  const [addItem, { isLoading }] = useAddItemMutation()
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<NewItem>({ resolver: zodResolver(newItemSchema) })

  async function onSubmit(values: NewItem) {
    await addItem(values).unwrap()
    reset()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="mt-4 space-y-2">
      <label htmlFor="name">Name</label>
      <input id="name" className="border p-1" {...register('name')} />
      {errors.name && <p role="alert">{errors.name.message}</p>}
      <button type="submit" disabled={isLoading}>
        Save
      </button>
    </form>
  )
}
