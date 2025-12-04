import { component$, useSignal, $, QwikKeyboardEvent, QwikChangeEvent, useVisibleTask$ } from '@builder.io/qwik';
import {
  HiRocketLaunchOutline,
  HiClipboardDocumentOutline,
  HiQrCodeOutline,
  HiCheckOutline,
  HiTrashOutline,
} from '@qwikest/icons/heroicons';
import { Link, globalAction$, server$, useLocation } from '@builder.io/qwik-city';
import { LuLoader } from '@qwikest/icons/lucide';
import { copyToClipboard, normalizeUrl } from '../../utils';
import { getFavicon, getLinkFromKey } from './utils';
import { QR_CODE_DIALOG_ID, QrCodeDialog } from './qr-code-dialog/qr-code-dialog';
import { LinkPlaceholder } from './link-placeholder/link-placeholder';
import { useToaster } from '../toaster/toaster';
import { compressToEncodedURIComponent } from 'lz-string';

const MAX_NUMBER_OF_LINKS = 3;

export interface TempLink {
  url: string;
  key: string;
  favicon?: string;
}

const getLinksFromLocalStorage = (): TempLink[] => {
  const linksStr = localStorage.getItem('links');
  return linksStr ? JSON.parse(linksStr) : [];
};

const saveLinksToLocalStorage = (links: TempLink[]) => {
  localStorage.setItem('links', JSON.stringify(links));
};

const useTempLink = globalAction$(async ({ url }, { fail }) => {
  const response: Response = await fetch(`${process.env.API_DOMAIN}/api/v1/shortener`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url,
      temporary: true,
      expirationTime: new Date().getTime() + 30 * 60 * 1000, // 30 minutes
    }),
  });

  const data: { url: string; key: string; message?: string[] } = await response.json();

  if (response.status !== 201) {
    return fail(500, {
      message: data?.message || 'There was an error creating your link. Please try again.',
    });
  }

  return {
    url,
    key: data.key,
  };
});

// Use server$ to run code on the server to avoid CORS issues
const getFaviconFromServer = server$(async (url: string) => {
  return getFavicon(url);
});

export const TemporaryLinks = component$(() => {
  const location = useLocation();
  const toaster = useToaster();
  const links = useSignal<TempLink[]>([]);
  const input = useSignal('');
  const isInputDisabled = useSignal(false);
  const isEphemeralNoteMode = useSignal(false);
  const secretNote = useSignal('');
  const interactedLink = useSignal<TempLink | null>(null);
  const copiedLinkKey = useSignal<string>('');
  const newLinkLoading = useSignal(false);

  useVisibleTask$(() => {
    links.value = getLinksFromLocalStorage();
    isInputDisabled.value = links.value.length >= MAX_NUMBER_OF_LINKS;

    if (location.url.searchParams.get('mode') === 'note') {
      isEphemeralNoteMode.value = true;
    }
  });

  const createTempLink = useTempLink();

  const compressNote = $((text: string) => {
    return compressToEncodedURIComponent(text);
  });

  const deleteLink = $(async (idx: number) => {
    const newLinks = links.value.filter((_, index) => index !== idx);
    links.value = [...newLinks];
    localStorage.setItem('links', JSON.stringify(newLinks));
    isInputDisabled.value = links.value.length >= MAX_NUMBER_OF_LINKS;
  });

  const addLink = $(async () => {
    if (input.value.trim() === '' || links.value.length >= 3) {
      return;
    }

    newLinkLoading.value = true;

    const normalizedUrl = normalizeUrl(input.value);

    const { value } = await createTempLink.submit({ url: normalizedUrl });

    if (value.failed) {
      toaster.add({
        title: 'Error',
        description: value?.message as string | 'Oops! Something went wrong. Please try again.',
        type: 'error',
      });
      newLinkLoading.value = false;
      return;
    }

    const favicon = await getFaviconFromServer(normalizedUrl);

    links.value = [...links.value, { url: normalizedUrl, key: value.key!, favicon }];
    input.value = ''; // Clear input after adding a link

    if (links.value.length >= MAX_NUMBER_OF_LINKS) {
      isInputDisabled.value = true;
    }

    newLinkLoading.value = false;
    toaster.add({
      title: 'Success',
      description: 'Your link has been shortened!',
      type: 'info',
    });
    saveLinksToLocalStorage(links.value);
  });

  const handleInputKeyPress = $(async (ev: QwikKeyboardEvent<HTMLElement>) => {
    if (ev.key === 'Enter') {
      ev?.preventDefault();
      await addLink();
    }
  });

  const handleSecretNoteInput = $(async (e: QwikChangeEvent<HTMLTextAreaElement>) => {
    const value = (e.target as HTMLTextAreaElement).value;
    secretNote.value = value;

    if (!value) {
      input.value = '';
      return;
    }

    const compressed = await compressNote(value);
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    input.value = `${origin}/note#${compressed}`;
  });

  return (
    <>
      <QrCodeDialog link={{ key: interactedLink.value?.key }} />
      <div class="mx-auto w-full max-w-md px-2.5 sm:px-0 mb-8">
        <div class="mb-3 flex justify-center gap-2">
          <button
            type="button"
            class={`flex-1 rounded-full px-3 py-1 text-sm font-medium border ${
              !isEphemeralNoteMode.value
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-base-100 text-gray-700 dark:bg-slate-800 dark:text-gray-200 border-base-200'
            }`}
            onClick$={() => (isEphemeralNoteMode.value = false)}
          >
            Shorten URL
          </button>
          <button
            type="button"
            class={`flex-1 rounded-full px-3 py-1 text-sm font-medium border ${
              isEphemeralNoteMode.value
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-base-100 text-gray-700 dark:bg-slate-800 dark:text-gray-200 border-base-200'
            }`}
            onClick$={() => (isEphemeralNoteMode.value = true)}
          >
            Ephemeral Note
          </button>
        </div>

        {isEphemeralNoteMode.value && (
          <div class="mb-3">
            <textarea
              class="w-full rounded-md border border-base-200 bg-base-100 p-2.5 text-sm focus:outline-none dark:bg-slate-800"
              rows={4}
              placeholder="Type your secret note here..."
              value={secretNote.value}
              onInput$={handleSecretNoteInput}
            />
          </div>
        )}

        <div
          class={`flex w-full items-center dark:bg-slate-800 rounded-md shadow-lg bg-base-100 border border-base-200 p-2 ${
            createTempLink.value?.message ? 'border border-red-500' : ''
          } ${isInputDisabled.value && !isEphemeralNoteMode.value ? 'bg-gray-200 cursor-not-allowed border-none' : ''}`}
        >
          <input
            class="w-full p-2.5 text-sm focus:outline-none dark:bg-slate-800"
            type="text"
            placeholder="Shorten your link"
            value={input.value}
            onInput$={(e) => (input.value = (e.target as HTMLInputElement).value)}
            onKeyPress$={handleInputKeyPress}
            readOnly={isEphemeralNoteMode.value}
            disabled={isInputDisabled.value && !isEphemeralNoteMode.value}
          />
          <button
            class={`rounded-full p-2.5 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 focus:outline-none focus:ring focus:border-gray-300 ml-2 ${
              isInputDisabled.value ? 'cursor-not-allowed' : ''
            }`}
            onClick$={addLink}
            disabled={isInputDisabled.value}
            title={isInputDisabled.value ? "You can't create more than 5 links. Open a free account to create more." : ''}
          >
            {newLinkLoading.value ? <LuLoader class="h-5 w-5 animate-spin" /> : <HiRocketLaunchOutline class="h-5 w-5" />}
          </button>
        </div>
        <div class="mt-2 grid gap-2">
          {links?.value.map((link, index) => {
            const hrefLink = getLinkFromKey(link?.key);

            return (
              <li
                class="flex max-w-md animate-fade items-center justify-between rounded-md bg-base-100 dark:bg-slate-800 p-3 shadow-lg border border-base-200"
                key={index}
              >
                <div class="flex items-center space-x-3">
                  <img
                    alt={link?.url}
                    loading="lazy"
                    width="20"
                    height="20"
                    decoding="async"
                    data-nimg="1"
                    class="pointer-events-none h-10 w-10 rounded-full blur-0"
                    src={link?.favicon}
                  />
                  <div class="text-left">
                    <a class="font-semibold" href={hrefLink} target="_blank" rel="noreferrer">
                      {process.env.DOMAIN}/{link?.key}
                    </a>
                    <p class="text-sm text-gray-400 line-clamp-1 text-left">
                      {link?.url.length > 30 ? `${link?.url.substring(0, 30)}...` : link?.url}
                    </p>
                  </div>
                </div>
                <div class="flex items-center">
                  <button
                    class="rounded-full p-1.5 text-gray-500 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-slate-700 focus:outline-none focus:ring focus:border-blue-300 bg-gray-200 dark:bg-gray-600 mr-2 pb-0"
                    onClick$={async () => {
                      copyToClipboard(normalizeUrl(hrefLink));
                      copiedLinkKey.value = link.key;
                      setTimeout(() => (copiedLinkKey.value = ''), 2000); // Reset icon after 2 seconds (adjust timing as needed)
                    }}
                  >
                    <span class="sr-only">Copy</span>
                    <label class="swap swap-rotate">
                      <HiClipboardDocumentOutline class={`${copiedLinkKey.value === link.key ? 'swap-on' : 'swap-off'} h-5 w-5`} />
                      <HiCheckOutline class={`${copiedLinkKey.value === link.key ? 'swap-off' : 'swap-on'} h-5 w-5`} />
                    </label>
                  </button>
                  <button
                    class="rounded-full p-1.5 text-gray-500 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-slate-700 focus:outline-none focus:ring focus:border-blue-300 bg-gray-200 dark:bg-gray-600 mr-2"
                    onClick$={() => {
                      interactedLink.value = link;
                      (document.getElementById(QR_CODE_DIALOG_ID) as any).showModal();
                    }}
                  >
                    <HiQrCodeOutline class="h-5 w-5" />
                  </button>
                  <button
                    class="rounded-full p-1.5 text-gray-500 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-slate-700 focus:outline-none focus:ring focus:border-blue-300 bg-gray-200 dark:bg-gray-600"
                    onClick$={async () => {
                      deleteLink(index);
                    }}
                  >
                    <span class="sr-only">Delete</span>
                    <HiTrashOutline class="h-5 w-5" />
                  </button>
                </div>
              </li>
            );
          })}
          {[...Array(MAX_NUMBER_OF_LINKS - links.value.length)].map((_, index) => (
            <LinkPlaceholder key={index} opacity={Math.max(1 - (index * 20) / 100, 0.2)} />
          ))}
          <div class={`block w-full dark:bg-slate-800 rounded-md shadow-lg border border-base-200 p-3 text-left`}>
            <div class="text-sm">
              <p class="dark:text-gray-400">These links will automatically be deleted after 30 minutes.</p>
              <p class="dark:text-gray-400">
                Open a{' '}
                <Link href="/register" class="text-blue-600">
                  free account
                </Link>{' '}
                to keep them longer.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
});
