import { component$, useSignal, useVisibleTask$ } from '@builder.io/qwik';
import { DocumentHead, Link } from '@builder.io/qwik-city';
import { decompressFromEncodedURIComponent } from 'lz-string';

export default component$(() => {
  const note = useSignal<string | null>(null);
  const isBroken = useSignal(false);

  useVisibleTask$(() => {
    try {
      const hash = window.location.hash || '';
      const encoded = hash.startsWith('#') ? hash.slice(1) : hash;

      if (!encoded) {
        isBroken.value = true;
        return;
      }

      const decoded = decompressFromEncodedURIComponent(encoded);
      if (decoded === null) {
        isBroken.value = true;
      } else {
        note.value = decoded;
      }
    } catch {
      isBroken.value = true;
    }
  });

  return (
    <div class="px-4 py-10">
      <div class="max-w-lg mx-auto w-full bg-base-100 dark:bg-slate-800 rounded-xl shadow-lg border border-base-200 p-6 text-center">
        <h1 class="text-2xl font-semibold mb-4 text-gray-800 dark:text-gray-100">Ephemeral Note</h1>
        <p class="text-sm text-gray-500 dark:text-gray-400 mb-6">
          This note was shared with you as an ephemeral, compressed link.
        </p>

        <div class="mb-4 text-left">
          <div class="rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/70 px-4 py-3">
            {isBroken.value ? (
              <p class="text-red-500 dark:text-red-400">
                This note appears to be broken or invalid.
              </p>
            ) : note.value ? (
              <p class="whitespace-pre-wrap break-words text-gray-800 dark:text-gray-100">{note.value}</p>
            ) : (
              <p class="text-gray-500 dark:text-gray-400">Loading your note...</p>
            )}
          </div>
        </div>

        <Link
          href="/?mode=note"
          class="inline-flex justify-center items-center gap-x-2 rounded-md bg-gradient-to-tl from-blue-600 to-violet-600 px-4 py-2 text-sm font-medium text-white hover:from-violet-600 hover:to-blue-600 focus:outline-none focus:ring-1 focus:ring-gray-600"
        >
          Reply
        </Link>
      </div>
    </div>
  );
});

export const head: DocumentHead = {
  title: 'Secret Note | Reduced.to',
  meta: [
    {
      name: 'description',
      content: 'View a secret note shared with you via Reduced.to.',
    },
  ],
};
