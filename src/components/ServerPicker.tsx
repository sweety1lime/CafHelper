import { getServers } from "../data/loader";

export function ServerPicker({ onPick }: { onPick: (id: string) => void }) {
  const servers = getServers();
  const withData = servers.filter((s) => s.hasData);
  const withoutData = servers.filter((s) => !s.hasData);

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto p-1">
      <div className="mt-2 text-center">
        <h1 className="text-lg font-bold text-neutral-100">Выбери свой сервер</h1>
        <p className="mt-1 text-xs text-neutral-500">
          Законы отличаются на каждом сервере Majestic — подсказки будут именно для твоего.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {withData.map((s) => (
          <button
            key={s.id}
            onClick={() => onPick(s.id)}
            className="rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2.5 text-sm font-semibold text-sky-200 transition hover:bg-sky-500/25"
          >
            {s.name}
          </button>
        ))}
      </div>

      {withoutData.length > 0 && (
        <>
          <div className="text-center text-xs text-neutral-600">База в разработке:</div>
          <div className="grid grid-cols-3 gap-1.5 opacity-50">
            {withoutData.map((s) => (
              <div
                key={s.id}
                className="cursor-not-allowed rounded-md border border-white/10 px-2 py-1.5 text-center text-xs text-neutral-500"
              >
                {s.name}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
