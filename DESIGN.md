# Gravio Design System

## Farben (oklch — obligatorisch für perzeptuelle Gleichmäßigkeit)

### Light Mode
- Background:   oklch(96% 0.008 75)    /* Warm Sand — #EFEBE4 */
- Primary:      oklch(25% 0.06 240)    /* Navy — #1B2B54 */
- Card:         oklch(99% 0.004 75)    /* Leicht heller als Hintergrund */
- Border:       oklch(88% 0.012 75)    /* Warm, nicht kalt-grau */
- Text primary: oklch(15% 0.01 240)    /* Fast-Schwarz, Navy-getönt */
- Text muted:   oklch(48% 0.012 240)   /* Lesbar bei 7:1 Kontrast */
- Accent:       oklch(52% 0.18 240)    /* Interaktives Blau — Links, Fokus */
- Destructive:  oklch(52% 0.2 25)      /* Gedämpftes Rot */
- Success:      oklch(50% 0.16 150)    /* Gedämpftes Grün */

### Dark Mode
- Background:   oklch(12% 0.01 240)
- Card:         oklch(16% 0.01 240)
- Border:       oklch(25% 0.015 240)
- Text primary: oklch(92% 0.005 75)
- Text muted:   oklch(58% 0.01 240)

## Typografie
- Font Family: Inter (Google Fonts), system-ui Fallback
- Überschriften: Gewicht 600, letter-spacing -0.02em, line-height 1.2
- Body: Gewicht 400, line-height 1.6
- Labels/Meta: Gewicht 500, 14px
- Skala: 12/14/16/18/20/24/30px

## Abstände
- Strikter 8px-Raster
- Alle Abstände via Tailwind: p-2 (8px), p-4 (16px), p-6 (24px), p-8 (32px)
- Keine beliebigen Werte wie p-[23px]

## Rahmenradius
- Kleine Elemente (Badges, Inputs): rounded-md = 6px
- Cards, Panels: rounded-lg = 8px
- Modals, Sheets: rounded-xl = 12px
- Niemals rounded-full auf nicht-kreisförmigen Elementen
- Niemals rounded-2xl oder größer auf Cards

## Animationen
- Hover: 150ms ease
- Seitenübergänge: 150ms fade-in (opacity 0→1)
- Alle Übergänge: cubic-bezier(0.4, 0, 0.2, 1)
- Kein Bounce, kein Spring, keine dramatischen Bewegungen

## Mobile-Spezifika
- Touch Targets: mindestens 56px Höhe
- Kontrastverhältnis: 7:1 minimum (AAA) — Außenlicht-Bedingungen
- Maximal 1 Entscheidung pro Bildschirm
- Labels immer neben Icons sichtbar
- Große Zahleneingaben für Messwerte
- Undo immer verfügbar
