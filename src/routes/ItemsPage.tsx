import { useGetItemsQuery } from '../features/items/api'
import { ItemForm } from '../features/items/components/ItemForm'
import { useUiStore } from '../stores/useUiStore'

export function ItemsPage() {
  const { data: items = [], isLoading, isError } = useGetItemsQuery()
  const showForm = useUiStore((s) => s.showForm)
  const toggleForm = useUiStore((s) => s.toggleForm)

  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="text-xl font-semibold">Items</h1>

      {isLoading && <p>Loading…</p>}
      {isError && <p role="alert">Could not load items.</p>}
      {!isLoading && !isError && items.length === 0 && <p>No items yet.</p>}
      {items.length > 0 && (
        <ul className="my-4 space-y-1">
          {items.map((item) => (
            <li key={item.id}>{item.name}</li>
          ))}
        </ul>
      )}

      <button type="button" onClick={toggleForm}>
        {showForm ? 'Close' : 'Add item'}
      </button>

      {showForm && <ItemForm />}
    </main>
  )
}
