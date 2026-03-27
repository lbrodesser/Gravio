# Gravio — Claude Code Projektregeln

## Projekt
Gravio ist eine PWA für Tiefbau-Aufmaß und Baustellen-Dokumentation.

## Nutzerkontext
- Primärer Nutzer: Tiefbau Vorarbeiter / Bauleiter
- Umgebung: Außenbaustelle, helle Sonne, schmutzige / behandschuhte Hände
- Gerät: Smartphone, Einhandbedienung
- Emotionaler Zustand: unter Zeitdruck, gestresst
- Erfolgsmetrik: Komplette Baustellen-Skizze in unter 3 Minuten

## Tech Stack
- Next.js 15 (App Router) + TypeScript strict
- Tailwind CSS v4
- shadcn/ui + Radix Primitives
- @supabase/ssr + @supabase/supabase-js
- TanStack Query v5
- React Hook Form + Zod
- Lucide React (Icons — keine Mischung mit anderen Icon-Bibliotheken)
- Sonner (Toasts)
- cmdk (Command Palette — nur Desktop)
- pnpm

## Absolute Code-Regeln
- TypeScript strict — niemals `any` verwenden
- Alle Funktions-Return-Typen annotieren
- Zod-Validierung auf ALLEN Inputs, Client UND Server
- RLS auf jeder Supabase-Tabelle — keine Ausnahmen, niemals
- Server Components standardmäßig — `use client` nur wenn nötig
- Server Actions für alle Mutationen
- Kein `console.log` Fehler-Handling — zentralen ErrorHandler verwenden
- Loading States: Skeleton Screens passend zur Content-Form, niemals Spinner
- Empty States: hilfreiche Nachricht + primäre Aktion, nie nur "Keine Daten"
- Touch Targets: mindestens 56px auf allen mobilen interaktiven Elementen
- Labels immer sichtbar — niemals Icon-Only-Navigation auf Mobile
- pnpm only — niemals npm oder yarn
- Alle Benutzer-sichtbaren Strings auf Deutsch

## Befehle
- pnpm dev
- pnpm build
- pnpm lint
- pnpm tsc --noEmit

## Vor jedem Commit
1. pnpm tsc --noEmit (null Fehler)
2. pnpm lint (null Warnungen)
3. pnpm build (erfolgreich)
4. Visueller Check Light + Dark Mode

## Offene Fragen (blockieren nicht)
1. "Passwort vergessen" Flow — noch nicht implementiert
2. Nutzer-Rollen (Admin vs. Feldarbeiter) — Datenmodell vorbereiten, noch nicht durchsetzen
3. Offline/PWA Manifest — nach den Kernfeatures hinzufügen
