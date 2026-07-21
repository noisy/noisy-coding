# Mic sensitivity działa nie tak, jak powinno

**Etykieta: PRE-LAUNCH?** (jeśli suwak realnie nie działa — to widoczna wada
w pierwszym kontakcie; wymaga najpierw diagnozy)

## Zgłoszenie (Krzysztof, 2026-07-17, głosowo)
Podczas testów mic sensitivity „nie działał jakoś super najlepiej" — temat
wymaga poświęcenia większej uwagi. Brak na razie dokładniejszej reprodukcji.

## Do zbadania
- Co dokładnie suwak zmienia (próg VAD? gain? oba?) i czy wartość w ogóle
  dociera do daemona / do przeglądarkowego toru audio (tab-mic vs hardware-mic
  mogą mieć osobne ścieżki),
- zachowanie na krańcach skali: czy min/max dają słyszalnie inną czułość,
- interakcja z oscyloskopem na dashboardzie — czy wizualizacja odzwierciedla
  ustawienie (dobre narzędzie do testu manualnego),
- powiązanie z filtrem halucynacji STT ([stt-hallucination-filter]
  (stt-hallucination-filter.md)) — za niska czułość progu = cisza/kaszel
  wchodzi do STT i wraca jako „Thank you" / „There is no sound".

## Kryterium zamknięcia
Test manualny: przy niskiej czułości szept/oddech NIE otwiera nagrywania,
przy wysokiej otwiera; zmiana suwaka daje natychmiastowy, obserwowalny efekt.

## Obserwacje z sesji 2026-07-21 (halucynacje STT na krótkich pyknięciach)
Złapane na żywo: nagranie **0.4 s** przepisane jako „There is no sound" —
agent przez kilka minut debugował nieistniejący problem z audio. Krzysztof:
ta fraza wraca często. Powtarzalny wzorzec halucynacji przy (prawie) pustym
audio, zaobserwowane frazy: „There is no sound", „Thank you", „There's",
samotne „The." doklejane na końcu prawdziwych wypowiedzi.
Tanie mitygacje do rozważenia obok suwaka czułości:
- minimalna długość nagrania (np. <0.8 s → drop bez transkrypcji),
- czarna lista dokładnych fraz-halucynacji przy bardzo krótkim audio,
- oznaczanie takich transkryptów jako podejrzane zamiast dostarczania.
