"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Locale, PAGE_METADATA, translateText } from "@/lib/i18n";

const STORAGE_KEY = "financial-pulse-locale";
const COOKIE_KEY = "fp_locale";
const TRANSLATABLE_ATTRIBUTES = ["placeholder", "title", "aria-label", "alt"] as const;

interface LanguageContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  toggleLocale: () => void;
  t: (value: string) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

type TranslationState = {
  source: string;
  applied: string;
};

function shouldIgnore(node: Node): boolean {
  const element = node.nodeType === Node.ELEMENT_NODE
    ? (node as Element)
    : node.parentElement;

  if (!element) return false;
  if (element.closest("[data-no-translate]")) return true;
  return Boolean(element.closest("script, style, noscript, code, pre"));
}

export default function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("ar");
  const textState = useRef(new WeakMap<Text, TranslationState>());
  const attributeState = useRef(
    new WeakMap<Element, Map<string, TranslationState>>()
  );

  const applyTextNode = useCallback((node: Text, targetLocale: Locale) => {
    if (shouldIgnore(node)) return;

    const current = node.nodeValue ?? "";
    if (!current.trim()) return;

    let state = textState.current.get(node);
    if (!state) {
      state = { source: current, applied: current };
      textState.current.set(node, state);
    } else if (current !== state.applied) {
      // React may reuse a text node after a state update. Treat the new value
      // as the fresh Arabic source before translating it again.
      state.source = current;
    }

    const next = targetLocale === "ar"
      ? state.source
      : translateText(state.source, "en");

    state.applied = next;
    if (current !== next) node.nodeValue = next;
  }, []);

  const applyElementAttributes = useCallback(
    (element: Element, targetLocale: Locale) => {
      if (shouldIgnore(element)) return;

      let states = attributeState.current.get(element);
      if (!states) {
        states = new Map();
        attributeState.current.set(element, states);
      }

      for (const attribute of TRANSLATABLE_ATTRIBUTES) {
        if (!element.hasAttribute(attribute)) continue;
        const current = element.getAttribute(attribute) ?? "";
        let state = states.get(attribute);

        if (!state) {
          state = { source: current, applied: current };
          states.set(attribute, state);
        } else if (current !== state.applied) {
          state.source = current;
        }

        const next = targetLocale === "ar"
          ? state.source
          : translateText(state.source, "en");
        state.applied = next;
        if (current !== next) element.setAttribute(attribute, next);
      }
    },
    []
  );

  const translateSubtree = useCallback(
    (root: Node, targetLocale: Locale) => {
      if (root.nodeType === Node.TEXT_NODE) {
        applyTextNode(root as Text, targetLocale);
        return;
      }

      if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) {
        return;
      }

      if (root.nodeType === Node.ELEMENT_NODE) {
        applyElementAttributes(root as Element, targetLocale);
        if (shouldIgnore(root)) return;
      }

      const walker = document.createTreeWalker(
        root,
        NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT
      );

      let node = walker.nextNode();
      while (node) {
        if (node.nodeType === Node.TEXT_NODE) {
          applyTextNode(node as Text, targetLocale);
        } else {
          applyElementAttributes(node as Element, targetLocale);
        }
        node = walker.nextNode();
      }
    },
    [applyElementAttributes, applyTextNode]
  );

  const applyLocale = useCallback(
    (targetLocale: Locale) => {
      const html = document.documentElement;
      html.lang = targetLocale;
      html.dir = targetLocale === "ar" ? "rtl" : "ltr";
      html.dataset.locale = targetLocale;

      document.title = PAGE_METADATA[targetLocale].title;
      const metaDescription = document.querySelector<HTMLMetaElement>(
        'meta[name="description"]'
      );
      if (metaDescription) {
        metaDescription.content = PAGE_METADATA[targetLocale].description;
      }

      translateSubtree(document.body, targetLocale);
    },
    [translateSubtree]
  );

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    const initialLocale: Locale = stored === "en" ? "en" : "ar";
    setLocaleState(initialLocale);
    applyLocale(initialLocale);
  }, [applyLocale]);

  useEffect(() => {
    applyLocale(locale);

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "characterData") {
          applyTextNode(mutation.target as Text, locale);
          continue;
        }

        if (mutation.type === "attributes") {
          applyElementAttributes(mutation.target as Element, locale);
          continue;
        }

        mutation.addedNodes.forEach((node) => translateSubtree(node, locale));
      }
    });

    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: [...TRANSLATABLE_ATTRIBUTES],
    });

    return () => observer.disconnect();
  }, [applyElementAttributes, applyLocale, applyTextNode, locale, translateSubtree]);

  const setLocale = useCallback(
    (nextLocale: Locale) => {
      window.localStorage.setItem(STORAGE_KEY, nextLocale);
      document.cookie = `${COOKIE_KEY}=${nextLocale}; Path=/; Max-Age=31536000; SameSite=Lax`;
      setLocaleState(nextLocale);
      applyLocale(nextLocale);
    },
    [applyLocale]
  );

  const toggleLocale = useCallback(() => {
    setLocale(locale === "ar" ? "en" : "ar");
  }, [locale, setLocale]);

  const value = useMemo<LanguageContextValue>(
    () => ({
      locale,
      setLocale,
      toggleLocale,
      t: (text: string) => translateText(text, locale),
    }),
    [locale, setLocale, toggleLocale]
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used inside LanguageProvider");
  }
  return context;
}
