import { useGetItemsQuery } from './services/api'
import { ItemForm } from './features/items/components/ItemForm'
import { useUiStore } from './stores/useUiStore'

export function App() {
  const { data: items = [], isLoading } = useGetItemsQuery()
  const showForm = useUiStore((s) => s.showForm)
  const toggleForm = useUiStore((s) => s.toggleForm)

  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="text-xl font-semibold">Items</h1>

      {isLoading ? (
        <p>Loading…</p>
      ) : (
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
