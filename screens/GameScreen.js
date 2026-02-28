import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Easing,
  ScrollView,
  Modal,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import wordsData from "../assets/words.json";

const normalize = (s) =>
  (s ?? "")
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const WORD_LENGTH = 5;
const MAX_TRIES = 6;
const FLIP_DURATION = 650;
const FLIP_STAGGER = 130;
const SCORE_KEY = "@adivinhe_a_palavra:score:v1";

const THEMES = {
  dark: {
    screenBg: "#0B1220",
    cardBg: "#111A2E",
    borderSoft: "rgba(255,255,255,0.06)",
    borderSofter: "rgba(255,255,255,0.08)",
    borderBtn: "rgba(255,255,255,0.10)",
    text: "#F9FAFB",
    textMuted: "rgba(203,213,225,0.7)",
    textMuted2: "rgba(203,213,225,0.85)",
    chipBg: "rgba(147, 197, 253, 0.12)",
    chipBorder: "rgba(147, 197, 253, 0.25)",
    cellBg: "rgba(255,255,255,0.04)",
    cellBorder: "rgba(255,255,255,0.14)",
    cellActiveBorder: "rgba(147, 197, 253, 0.70)",
    absentBg: "rgba(148, 163, 184, 0.14)",
    absentBorder: "rgba(148, 163, 184, 0.22)",
    correctBg: "rgba(16, 185, 129, 0.35)",
    correctBorder: "rgba(16, 185, 129, 0.55)",
    presentBg: "rgba(245, 158, 11, 0.35)",
    presentBorder: "rgba(245, 158, 11, 0.55)",
    primary: "#3B82F6",
    dangerBg: "rgba(239, 68, 68, 0.10)",
    dangerBorder: "rgba(239, 68, 68, 0.25)",
    pillBg: "rgba(255,255,255,0.06)",
    pillBorder: "rgba(255,255,255,0.12)",
    overlay: "rgba(0,0,0,0.55)",
    kicker: "#93C5FD",
  },
  light: {
    screenBg: "#F8FAFC",
    cardBg: "#FFFFFF",
    borderSoft: "rgba(2,6,23,0.08)",
    borderSofter: "rgba(2,6,23,0.10)",
    borderBtn: "rgba(2,6,23,0.12)",
    text: "#0F172A",
    textMuted: "rgba(15,23,42,0.65)",
    textMuted2: "rgba(15,23,42,0.75)",
    chipBg: "rgba(59, 130, 246, 0.12)",
    chipBorder: "rgba(59, 130, 246, 0.22)",
    cellBg: "rgba(2,6,23,0.04)",
    cellBorder: "rgba(2,6,23,0.14)",
    cellActiveBorder: "rgba(59, 130, 246, 0.55)",
    absentBg: "rgba(100, 116, 139, 0.14)",
    absentBorder: "rgba(100, 116, 139, 0.22)",
    correctBg: "rgba(16, 185, 129, 0.30)",
    correctBorder: "rgba(16, 185, 129, 0.45)",
    presentBg: "rgba(245, 158, 11, 0.30)",
    presentBorder: "rgba(245, 158, 11, 0.45)",
    primary: "#2563EB",
    dangerBg: "rgba(239, 68, 68, 0.10)",
    dangerBorder: "rgba(239, 68, 68, 0.20)",
    pillBg: "rgba(2,6,23,0.04)",
    pillBorder: "rgba(2,6,23,0.10)",
    overlay: "rgba(2,6,23,0.55)",
    kicker: "#2563EB",
  },
};

const createStyles = (t) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.screenBg },
    container: {
      paddingHorizontal: 20,
      paddingTop: 35,
      paddingBottom: 18,
      flexGrow: 1,
    },
    header: { marginBottom: 10 },
    titleRow: {
      flexDirection: "row",
      alignSelf: "center",
      alignItems: "center",
    },
    titleChar: {
      fontSize: 28,
      fontWeight: "800",
      letterSpacing: 1,
    },
    kicker: {
      color: t.kicker,
      fontSize: 12,
      letterSpacing: 1.2,
      textTransform: "uppercase",
      marginBottom: 15,
      textAlign: "center",
    },
    tutorialRow: {
      marginTop: 10,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
    },
    rightHeaderGroup: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    pillBtn: {
      backgroundColor: t.pillBg,
      borderWidth: 1,
      borderColor: t.pillBorder,
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: 999,
      alignSelf: "flex-start",
    },
    pillBtnText: {
      color: t.text,
      fontSize: 13,
      fontWeight: "800",
      letterSpacing: 0.6,
      textTransform: "uppercase",
    },
    scorePill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: t.pillBg,
      borderWidth: 1,
      borderColor: t.pillBorder,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 999,
    },
    scorePillLabel: {
      color: t.textMuted2,
      fontSize: 12,
      fontWeight: "800",
      letterSpacing: 0.6,
      textTransform: "uppercase",
    },
    scorePillValue: {
      color: t.text,
      fontSize: 14,
      fontWeight: "900",
    },
    modePill: {
      alignSelf: "center",
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 999,
      backgroundColor: t.pillBg,
      borderWidth: 1,
      borderColor: t.pillBorder,
    },
    modePillText: {
      color: t.textMuted2,
      fontSize: 13,
      fontWeight: "900",
      letterSpacing: 0.6,
      textTransform: "uppercase",
    },
    card: {
      backgroundColor: t.cardBg,
      borderRadius: 18,
      padding: 8,
      borderWidth: 1,
      borderColor: t.borderSoft,
      shadowColor: "#000",
      shadowOpacity: Platform.OS === "android" ? 0.12 : 0.18,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 8 },
      elevation: 80,
      marginBottom: 16,
    },
    hintRow: { marginBottom: 0 },
    hintHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    hintBtn: {
      paddingVertical: 8,
      paddingHorizontal: 10,
      borderRadius: 999,
      backgroundColor: t.pillBg,
      borderWidth: 1,
      borderColor: t.borderBtn,
    },
    hintBtnText: {
      color: t.text,
      fontSize: 12,
      fontWeight: "800",
      letterSpacing: 0.6,
      textTransform: "uppercase",
    },
    hintChip: {
      alignSelf: "flex-start",
      backgroundColor: t.chipBg,
      borderWidth: 1,
      borderColor: t.chipBorder,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 999,
      marginTop: 10,
    },
    hintText: { color: t.text, fontSize: 14, fontWeight: "600" },

    boardsWrap: { marginTop: 10, marginBottom: 8, gap: 10 },
    boardShell: {
      borderWidth: 1,
      borderColor: t.borderSoft,
      borderRadius: 12,
      padding: 4,
      backgroundColor: "transparent",
    },
    boardLabelRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 2,
    },
    boardLabel: {
      color: t.textMuted2,
      fontSize: 10,
      fontWeight: "900",
      letterSpacing: 0.6,
      textTransform: "uppercase",
    },
    boardSolved: {
      color: t.kicker,
      fontSize: 12,
      fontWeight: "900",
    },
    board: { marginTop: 2, marginBottom: 2 },
    row: { flexDirection: "row", gap: 6, marginBottom: 6 },
    cell: {
      flex: 1,
      height: 34,
      borderRadius: 7,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: t.cellBg,
      borderWidth: 1,
      borderColor: t.cellBorder,
      backfaceVisibility: "hidden",
    },
    cellActive: {
      borderColor: t.primary,
      borderWidth: 0,
      shadowColor: t.primary,
      shadowOpacity: 10,
      shadowRadius: 1,
      shadowOffset: { width: 0, height: 0 },
      elevation: 1,
    },
    cellCorrect: { backgroundColor: t.correctBg, borderColor: t.correctBorder },
    cellPresent: { backgroundColor: t.presentBg, borderColor: t.presentBorder },
    cellAbsent: { backgroundColor: t.absentBg, borderColor: t.absentBorder },
    cellText: {
      color: t.text,
      fontSize: 16,
      fontWeight: "800",
      letterSpacing: 1,
    },

    errorMessage: {
      color: "#ef4444",
      fontSize: 14,
      fontWeight: "700",
      marginBottom: 6,
      textAlign: "center",
    },
    feedbackMessage: {
      color: t.textMuted2,
      fontSize: 13,
      fontWeight: "700",
      marginBottom: 6,
      textAlign: "center",
    },

    primaryBtn: {
      backgroundColor: t.primary,
      paddingVertical: 12,
      borderRadius: 12,
      alignItems: "center",
      marginBottom: 10,
    },
    primaryBtnText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },

    note: {
      color: t.textMuted,
      fontSize: 12,
      lineHeight: 18,
      marginTop: 6,
      marginBottom: 8,
    },
    secondaryBtn: {
      backgroundColor: t.pillBg,
      borderWidth: 1,
      borderColor: t.borderBtn,
      paddingVertical: 12,
      borderRadius: 12,
      alignItems: "center",
      marginBottom: 10,
    },
    secondaryBtnDanger: {
      backgroundColor: t.dangerBg,
      borderWidth: 1,
      borderColor: t.dangerBorder,
      paddingVertical: 12,
      borderRadius: 12,
      alignItems: "center",
    },
    secondaryBtnText: { color: t.text, fontSize: 15, fontWeight: "700" },

    keyboardDock: {
      backgroundColor: t.cardBg,
      borderTopWidth: 1,
      borderTopColor: t.borderSoft,
      paddingHorizontal: 14,
      paddingTop: 10,
      paddingBottom: Platform.OS === "ios" ? 16 : 12,
    },
    keyboardWrap: {
      gap: 10,
      marginBottom:30
    },
    keyboardRow: {
      flexDirection: "row",
      gap: 8,
      justifyContent: "center",
    },
    key: {
      flex: 1,
      minHeight: 48,
      borderRadius: 8,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      backgroundColor: t.cellBg,
      borderColor: t.cellBorder,
    },
    keyBackspace: {
      flex: 1.35,
    },
    keyPressed: {
      transform: [{ scale: 0.99 }],
      opacity: 0.92,
    },
    keyText: {
      color: t.text,
      fontSize: 16,
      fontWeight: "900",
      letterSpacing: 0.6,
    },

    modalOverlay: {
      flex: 1,
      backgroundColor: t.overlay,
      justifyContent: "center",
      alignItems: "center",
      padding: 20,
    },
    modalCard: {
      width: "100%",
      maxWidth: 360,
      backgroundColor: t.cardBg,
      borderRadius: 18,
      padding: 18,
      borderWidth: 1,
      borderColor: t.borderSofter,
    },
    modalTitle: {
      color: t.text,
      fontSize: 20,
      fontWeight: "800",
      marginBottom: 12,
    },
    modalText: {
      color: t.text,
      fontSize: 14,
      lineHeight: 22,
      marginBottom: 8,
    },
    modalCloseBtn: {
      marginTop: 10,
      backgroundColor: t.primary,
      paddingVertical: 12,
      borderRadius: 12,
      alignItems: "center",
    },
    modalCloseText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  });

const TITLE_COLORS = ["#22C55E", "#3B82F6", "#F59E0B", "#EF4444", "#A855F7", "#06B6D4", "#F97316"];

function buildEvaluation(guessRaw, answerRaw) {
  const guess = normalize(guessRaw);
  const answer = normalize(answerRaw);
  const g = guess.split("");
  const a = answer.split("");
  const result = Array(WORD_LENGTH).fill("absent");
  const remaining = new Map();

  for (let i = 0; i < WORD_LENGTH; i++) {
    if (g[i] === a[i]) {
      result[i] = "correct";
      g[i] = null;
    } else {
      remaining.set(a[i], (remaining.get(a[i]) ?? 0) + 1);
    }
  }

  for (let i = 0; i < WORD_LENGTH; i++) {
    if (result[i] === "correct") continue;
    const ch = g[i];
    if (ch === null) continue;
    const count = remaining.get(ch) ?? 0;
    if (count > 0) {
      result[i] = "present";
      remaining.set(ch, count - 1);
    }
  }
  return result;
}

function buildLetterHint(guessRaw, answerRaw, evaluation) {
  const guess = normalize(guessRaw);
  const lastIdx = Math.max(0, Math.min(WORD_LENGTH - 1, guess.length - 1));
  const letter = (guess[lastIdx] || "").toUpperCase();
  if (!letter) return "";
  const status = evaluation[lastIdx];
  if (status === "correct") return `A letra ${letter} faz parte da palavra e está na posição correta.`;
  if (status === "present") return `A letra ${letter} faz parte da palavra mas em outra posição.`;
  return `A letra ${letter} não faz parte da palavra.`;
}

const KEYBOARD_ROWS = [
  ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
  ["Z", "X", "C", "V", "B", "N", "M", "BACKSPACE"],
];

const getKeyStyleByStatus = (t, status) => {
  if (status === "correct") return { backgroundColor: t.correctBg, borderColor: t.correctBorder };
  if (status === "present") return { backgroundColor: t.presentBg, borderColor: t.presentBorder };
  if (status === "absent") return { backgroundColor: t.cellBg, borderColor: t.absentBorder, opacity: 0.6 };
  return { backgroundColor: t.cellBg, borderColor: t.cellBorder };
};

const WordleKeyboard = ({ t, styles, statuses, onKey, onBackspace, disabled }) => {
  return (
    <View style={styles.keyboardWrap}>
      {KEYBOARD_ROWS.map((row, rowIndex) => (
        <View key={`kb-row-${rowIndex}`} style={styles.keyboardRow}>
          {row.map((k) => {
            const st = k === "BACKSPACE" ? "unused" : statuses[k] ?? "unused";
            const isKeyDisabled = disabled;
            const label = k === "BACKSPACE" ? "⌫" : k;

            return (
              <Pressable
                key={`kb-key-${k}`}
                onPress={() => {
                  if (isKeyDisabled) return;
                  if (k === "BACKSPACE") onBackspace?.();
                  else onKey?.(k);
                }}
                disabled={isKeyDisabled}
                style={({ pressed }) => [
                  styles.key,
                  k === "BACKSPACE" && styles.keyBackspace,
                  getKeyStyleByStatus(t, st),
                  pressed && !isKeyDisabled ? styles.keyPressed : null,
                ]}
                accessibilityRole="button"
                accessibilityLabel={k === "BACKSPACE" ? "Apagar" : `Letra ${k}`}
              >
                <Text style={styles.keyText}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
};

const GameScreen = () => {
  const items = useMemo(() => wordsData?.items ?? [], []);
  const wordSet = useMemo(() => new Set(items.map((item) => normalize(item.word))), [items]);

  const [theme, setTheme] = useState("dark");
  const t = THEMES[theme] ?? THEMES.dark;
  const styles = useMemo(() => createStyles(t), [t]);

  const [boardCount, setBoardCount] = useState(1);
  const [boards, setBoards] = useState([]);
  const [guesses, setGuesses] = useState([]);
  const [guessLetters, setGuessLetters] = useState(Array(WORD_LENGTH).fill(""));
  const [selectedIndex, setSelectedIndex] = useState(0);

  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [errorFeedback, setErrorFeedback] = useState("");
  const [isGameOver, setIsGameOver] = useState(false);
  const [showWordHint, setShowWordHint] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);

  const [playerScore, setPlayerScore] = useState(0);
  const [scoreReady, setScoreReady] = useState(false);

  const flipAnimations = useRef(
    Array.from({ length: MAX_TRIES }, () =>
      Array.from({ length: WORD_LENGTH }, () => new Animated.Value(0)),
    ),
  ).current;

  const shakeAnimation = useRef(new Animated.Value(0)).current;
  const errorBorderAnimation = useRef(new Animated.Value(0)).current;
  const isAnimating = useRef(false);

  useEffect(() => {
    let isMounted = true;
    const loadScore = async () => {
      try {
        const storedScore = await AsyncStorage.getItem(SCORE_KEY);
        const scoreValue = storedScore ? Number(storedScore) : 0;
        if (isMounted) setPlayerScore(Number.isFinite(scoreValue) ? scoreValue : 0);
      } catch {}
      if (isMounted) setScoreReady(true);
    };
    loadScore();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!scoreReady) return;
    AsyncStorage.setItem(SCORE_KEY, String(playerScore)).catch(() => {});
  }, [playerScore, scoreReady]);

  const resetAnimationStates = useCallback(() => {
    flipAnimations.forEach((row) => row.forEach((anim) => anim.setValue(0)));
    shakeAnimation.setValue(0);
    errorBorderAnimation.setValue(0);
    isAnimating.current = false;
  }, [flipAnimations, shakeAnimation, errorBorderAnimation]);

  const pickRandomWords = useCallback(
    (count) => {
      if (!items.length) return [];
      const picked = [];
      const used = new Set();
      let guard = 0;

      while (picked.length < count && guard < 2000) {
        const candidate = items[Math.floor(Math.random() * items.length)];
        const key = normalize(candidate?.word);
        if (!key) {
          guard++;
          continue;
        }
        if (used.has(key)) {
          guard++;
          continue;
        }
        used.add(key);
        picked.push(candidate);
        guard++;
      }

      while (picked.length < count) {
        picked.push(items[Math.floor(Math.random() * items.length)]);
      }

      return picked;
    },
    [items],
  );

  const modeName = useMemo(() => {
    if (boardCount === 1) return "Termo";
    if (boardCount === 2) return "Dueto";
    return "Quarteto";
  }, [boardCount]);

  const startStage = useCallback(
    (count) => {
      const words = pickRandomWords(count);

      console.log(
        `🎲 Modo ${count === 1 ? "TERMO" : count === 2 ? "DUETO" : "QUARTETO"} - Palavras:`,
        words.map((w) => (w?.word ?? "").toUpperCase()).join(" • "),
      );

      setBoardCount(count);
      setBoards(words.map((w) => ({ word: w?.word ?? "", hint: w?.hint ?? "", solved: false })));
      setGuesses([]);
      setGuessLetters(Array(WORD_LENGTH).fill(""));
      setSelectedIndex(0);
      setFeedbackMessage("");
      setErrorFeedback("");
      setIsGameOver(false);
      setShowWordHint(false);
      resetAnimationStates();
    },
    [pickRandomWords, resetAnimationStates],
  );

  const restartCurrentStage = useCallback(() => {
    startStage(boardCount);
  }, [startStage, boardCount]);

  const advanceStageAfterWin = useCallback(() => {
    if (boardCount === 1) startStage(2);
    else if (boardCount === 2) startStage(4);
    else startStage(1);
  }, [boardCount, startStage]);

  const resetGameScore = useCallback(async () => {
    setPlayerScore(0);
    try {
      await AsyncStorage.setItem(SCORE_KEY, "0");
    } catch {}
    startStage(1);
  }, [startStage]);

  useEffect(() => {
    startStage(1);
  }, [startStage]);

  const currentGuess = guessLetters.join("");
  const normalizedGuess = normalize(currentGuess);
  const isGuessComplete = normalizedGuess.length === WORD_LENGTH;
  const isValidWord = isGuessComplete && wordSet.has(normalizedGuess);

  const canAttemptSubmit =
    !isGameOver && isValidWord && guesses.length < MAX_TRIES && !isAnimating.current;

  const letterStatuses = useMemo(() => {
    const rank = { unused: 0, absent: 1, present: 2, correct: 3 };
    const acc = {};

    for (const g of guesses) {
      const letters = (normalize(g.guessRaw) || "").toUpperCase().split("");
      const evals = Array.isArray(g.evaluations) ? g.evaluations : [];
      for (const ev of evals) {
        if (!ev) continue;
        for (let i = 0; i < Math.min(WORD_LENGTH, letters.length); i++) {
          const ch = letters[i];
          const st = ev[i];
          if (!ch) continue;
          const prev = acc[ch] ?? "unused";
          if (rank[st] > rank[prev]) acc[ch] = st;
        }
      }
    }
    return acc;
  }, [guesses]);

  const animateError = () => {
    isAnimating.current = true;
    setErrorFeedback("Palavra não reconhecida • Digite uma palavra válida");

    shakeAnimation.setValue(0);
    errorBorderAnimation.setValue(0);

    Animated.sequence([
      Animated.timing(errorBorderAnimation, { toValue: 1, duration: 200, useNativeDriver: false }),
      Animated.sequence([
        Animated.timing(shakeAnimation, { toValue: 10, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnimation, { toValue: -10, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnimation, { toValue: 8, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnimation, { toValue: -8, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnimation, { toValue: 0, duration: 60, useNativeDriver: true }),
      ]),
      Animated.timing(errorBorderAnimation, {
        toValue: 0,
        duration: 300,
        delay: 400,
        useNativeDriver: false,
      }),
    ]).start(() => {
      isAnimating.current = false;
      setErrorFeedback("");
    });
  };

  const animateFlipRow = (rowIndex) => {
    isAnimating.current = true;
    const rowAnims = flipAnimations[rowIndex].map((animVal) =>
      Animated.timing(animVal, {
        toValue: 1,
        duration: FLIP_DURATION,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    );

    return new Promise((resolve) => {
      Animated.stagger(FLIP_STAGGER, rowAnims).start(() => {
        flipAnimations[rowIndex].forEach((animVal) => animVal.setValue(0));
        isAnimating.current = false;
        resolve();
      });
    });
  };

  const updateLetterAtIndex = useCallback((index, letter) => {
    const L = (letter || "").replace(/[^a-zA-ZÀ-ÿ]/gi, "").slice(-1).toUpperCase();
    if (!L) return;

    setGuessLetters((prev) => {
      const updated = [...prev];
      updated[index] = L;
      return updated;
    });

    setSelectedIndex(Math.min(index + 1, WORD_LENGTH - 1));
  }, []);

  const handleKeyPress = useCallback(
    (letter) => {
      if (isGameOver || isAnimating.current) return;
      updateLetterAtIndex(selectedIndex, letter);
    },
    [isGameOver, selectedIndex, updateLetterAtIndex],
  );

  const processBackspace = useCallback(() => {
    if (isGameOver || isAnimating.current) return;

    setGuessLetters((prev) => {
      const updated = [...prev];
      if (updated[selectedIndex]) {
        updated[selectedIndex] = "";
      } else {
        const prevIndex = Math.max(0, selectedIndex - 1);
        updated[prevIndex] = "";
        setSelectedIndex(prevIndex);
      }
      return updated;
    });
  }, [isGameOver, selectedIndex]);

  const submitGuess = async () => {
    if (!boards.length || boards.some((b) => !b.word)) {
      setFeedbackMessage("Nenhuma palavra disponível no arquivo JSON.");
      return;
    }
    if (!isValidWord) {
      animateError();
      return;
    }

    const guessString = currentGuess;
    const normGuess = normalizedGuess;

    const isDuplicate = guesses.some((prevGuess) => normalize(prevGuess.guessRaw) === normGuess);
    if (isDuplicate) {
      setFeedbackMessage(`Você já tentou “${guessString.toUpperCase()}”. Tente uma palavra diferente.`);
      return;
    }

    const currentRow = guesses.length;
    await animateFlipRow(currentRow);

    let solvedNow = 0;
    const newBoards = boards.map((b) => {
      if (b.solved) return b;
      const ok = normGuess === normalize(b.word);
      if (ok) solvedNow++;
      return { ...b, solved: ok ? true : b.solved };
    });

    const evaluations = boards.map((b) => {
      if (b.solved) return null;
      return buildEvaluation(guessString, b.word);
    });

    const updatedGuesses = [...guesses, { guessRaw: guessString, evaluations }];
    setGuesses(updatedGuesses);
    setBoards(newBoards);

    if (solvedNow > 0) {
      setPlayerScore((prev) => prev + solvedNow);
    } else {
      const idx = newBoards.findIndex((b) => !b.solved);
      const hintIdx = idx === -1 ? 0 : idx;
      const ev = evaluations[hintIdx];
      if (ev) setFeedbackMessage(`Tabuleiro ${hintIdx + 1}: ${buildLetterHint(guessString, boards[hintIdx].word, ev)}`);
      else setFeedbackMessage("");
    }

    const allSolved = newBoards.every((b) => b.solved);

    if (allSolved) {
      setIsGameOver(true);
      setFeedbackMessage(
        boardCount === 1
          ? "Parabéns! Agora você desbloqueou o Dueto 😄"
          : boardCount === 2
            ? "Dueto completo! Agora vem o Quarteto 🔥"
            : "Quarteto completo! Bora outro? 🚀",
      );

      setTimeout(() => {
        advanceStageAfterWin();
      }, 900);
      return;
    }

    if (updatedGuesses.length >= MAX_TRIES) {
      setIsGameOver(true);
      const missing = newBoards
        .map((b, i) => (!b.solved ? `#${i + 1}: ${String(b.word).toUpperCase()}` : null))
        .filter(Boolean)
        .join(" • ");

      setFeedbackMessage(`Fim de jogo! Palavras: ${missing}`);
      setTimeout(() => {
        restartCurrentStage();
      }, 1200);
      return;
    }

    setGuessLetters(Array(WORD_LENGTH).fill(""));
    setSelectedIndex(0);
  };

  const shakeX = shakeAnimation.interpolate({
    inputRange: [-10, 0, 10],
    outputRange: [-12, 0, 12],
  });

  const errorBorder = errorBorderAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [t.cellBorder, "#ef4444"],
  });

  const renderGameCell = (rowIndex, colIndex, letter, cellStatus, isFocused, isActiveRow) => {
    const flipValue = flipAnimations[rowIndex][colIndex];
    const rotation = flipValue.interpolate({
      inputRange: [0, 1],
      outputRange: ["0deg", "180deg"],
    });

    const flipTransform = { transform: [{ perspective: 800 }, { rotateX: rotation }] };
    const shakeTransform = { transform: [{ translateX: shakeX }] };

    const borderStyle = isActiveRow
      ? { borderColor: isValidWord || !isGuessComplete ? t.cellActiveBorder : errorBorder }
      : {};

    return (
      <Pressable
        key={`cell-${rowIndex}-${colIndex}`}
        onPress={() => {
          if (isActiveRow) setSelectedIndex(colIndex);
        }}
        style={{ flex: 1 }}
        disabled={!isActiveRow || isAnimating.current}
      >
        <Animated.View
          style={[
            styles.cell,
            cellStatus === "correct" && styles.cellCorrect,
            cellStatus === "present" && styles.cellPresent,
            cellStatus === "absent" && styles.cellAbsent,
            isFocused && styles.cellActive,
            borderStyle,
            isActiveRow && flipTransform,
          ]}
        >
          <Animated.View
            style={[
              { flex: 1, justifyContent: "center", alignItems: "center" },
              isActiveRow && shakeTransform,
            ]}
          >
            <Text style={styles.cellText}>{(letter || "").toUpperCase()}</Text>
          </Animated.View>
        </Animated.View>
      </Pressable>
    );
  };

  const renderBoard = (boardIndex) => {
    const board = boards[boardIndex];
    const boardRows = [];

    for (let row = 0; row < MAX_TRIES; row++) {
      const past = guesses[row];
      if (past) {
        const ev = past.evaluations?.[boardIndex] ?? null;

        if (ev) {
          const letters = past.guessRaw.split("");
          boardRows.push(
            <View key={`b${boardIndex}-row-${row}`} style={styles.row}>
              {letters.map((letter, col) => renderGameCell(row, col, letter, ev[col], false, false))}
            </View>,
          );
        } else {
          boardRows.push(
            <View key={`b${boardIndex}-row-${row}`} style={styles.row}>
              {Array(WORD_LENGTH)
                .fill("")
                .map((_, col) => renderGameCell(row, col, "", null, false, false))}
            </View>,
          );
        }
        continue;
      }

      const isActiveRow = row === guesses.length && !isGameOver && !board?.solved;

      if (isActiveRow) {
        boardRows.push(
          <View key={`b${boardIndex}-row-${row}`} style={styles.row}>
            {guessLetters.map((letter, col) => {
              const isFocused = col === selectedIndex;
              return renderGameCell(row, col, letter, null, isFocused, true);
            })}
          </View>,
        );
        continue;
      }

      boardRows.push(
        <View key={`b${boardIndex}-row-${row}`} style={styles.row}>
          {Array(WORD_LENGTH)
            .fill("")
            .map((_, col) => renderGameCell(row, col, "", null, false, false))}
        </View>,
      );
    }

    return (
      <View style={styles.boardShell}>
        <View style={styles.boardLabelRow}>
          <Text style={styles.boardLabel}>{`Tabuleiro ${boardIndex + 1}`}</Text>
          {board?.solved ? <Text style={styles.boardSolved}>✅</Text> : null}
        </View>
        <View style={styles.board}>{boardRows}</View>
      </View>
    );
  };

  const switchTheme = useCallback(() => {
    setTheme((current) => (current === "dark" ? "light" : "dark"));
  }, []);

  const renderTitle = () => {
    const titleText = "CONTEXT";
    return (
      <View style={styles.titleRow}>
        {titleText.split("").map((char, index) => (
          <Text
            key={`title-char-${index}`}
            style={[styles.titleChar, { color: TITLE_COLORS[index % TITLE_COLORS.length] }]}
          >
            {char}
          </Text>
        ))}
      </View>
    );
  };

  const boardsContainerStyle = useMemo(() => [styles.boardsWrap], [styles]);
  const boardItemStyle = useMemo(() => ({ width: "100%" }), []);

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={{ flex: 1 }}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            {renderTitle()}
            <View style={styles.tutorialRow}>
              <View style={styles.rightHeaderGroup}>
                <Pressable
                  onPress={() => setShowInstructions(true)}
                  style={({ pressed }) => [
                    styles.pillBtn,
                    pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] },
                  ]}
                >
                  <Text style={styles.pillBtnText}>Tutorial</Text>
                </Pressable>
              </View>

              <View style={styles.scorePill}>
                <Text style={styles.scorePillLabel}>Pontuação</Text>
                <Text style={styles.scorePillValue}>{scoreReady ? playerScore : "—"}</Text>
              </View>

              <Pressable
                onPress={switchTheme}
                style={({ pressed }) => [
                  styles.pillBtn,
                  pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] },
                ]}
              >
                <Text style={styles.pillBtnText}>{theme === "dark" ? "☀️" : "🌙"}</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.hintRow}>
              <View style={styles.hintHeader}>
                <Pressable
                  onPress={() => setShowWordHint((prev) => !prev)}
                  style={({ pressed }) => [
                    styles.hintBtn,
                    pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] },
                  ]}
                >
                  <Text style={styles.hintBtnText}>
                    {showWordHint ? "Ocultar dicas" : "Mostrar dicas"}
                  </Text>
                </Pressable>

                <View style={styles.modePill}>
                  <Text style={styles.modePillText}>{modeName}</Text>
                </View>
              </View>

              {showWordHint ? (
                <View style={{ marginTop: 6 }}>
                  {boards.map((b, i) => (
                    <View key={`hint-${i}`} style={styles.hintChip}>
                      <Text style={styles.hintText}>
                        {`#${i + 1}${b.solved ? " ✅" : ""}: ${b.hint || "Carregando..."}`}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>

            <View style={boardsContainerStyle}>
              {boards.map((_, i) => (
                <View key={`board-${i}`} style={boardItemStyle}>
                  {renderBoard(i)}
                </View>
              ))}
            </View>

            <Pressable
              onPress={restartCurrentStage}
              style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.9 }]}
            >
              <Text style={styles.secondaryBtnText}>Reiniciar rodada</Text>
            </Pressable>

            <Pressable
              onPress={resetGameScore}
              style={({ pressed }) => [styles.secondaryBtnDanger, pressed && { opacity: 0.9 }]}
            >
              <Text style={styles.secondaryBtnText}>Zerar pontuação</Text>
            </Pressable>

            <Text style={styles.note}>
              Os acentos são preenchidos automaticamente, e não são considerados nas dicas.
            </Text>
          </View>

          <Text style={styles.kicker}>By: @Patrikybrito_Dev</Text>
        </ScrollView>

        <View style={styles.keyboardDock}>
          {errorFeedback ? <Text style={styles.errorMessage}>{errorFeedback}</Text> : null}
          {feedbackMessage ? <Text style={styles.feedbackMessage}>{feedbackMessage}</Text> : null}

          <Pressable
            onPress={submitGuess}
            disabled={!canAttemptSubmit}
            style={({ pressed }) => [
              styles.primaryBtn,
              !canAttemptSubmit && { opacity: 0.5 },
              pressed && canAttemptSubmit && { transform: [{ scale: 0.99 }], opacity: 0.95 },
            ]}
          >
            <Text style={styles.primaryBtnText}>Verificar</Text>
          </Pressable>

          <WordleKeyboard
            t={t}
            styles={styles}
            statuses={letterStatuses}
            onKey={handleKeyPress}
            onBackspace={processBackspace}
            disabled={isGameOver || isAnimating.current}
          />
        </View>
      </View>

      <Modal
        visible={showInstructions}
        transparent
        animationType="fade"
        onRequestClose={() => setShowInstructions(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Tutorial</Text>
            <Text style={styles.modalText}>Digite uma palavra de 5 letras.</Text>
            <Text style={styles.modalText}>🟢 Verde = letra correta na posição correta.</Text>
            <Text style={styles.modalText}>🟡 Amarelo = letra existe, mas em outra posição.</Text>
            <Text style={styles.modalText}>⚪ Cinza = letra não existe na palavra.</Text>
            <Text style={styles.note}>
              Os acentos são preenchidos automaticamente, e não são considerados nas dicas.
            </Text>
            <Pressable
              onPress={() => setShowInstructions(false)}
              style={({ pressed }) => [styles.modalCloseBtn, pressed && { opacity: 0.9 }]}
            >
              <Text style={styles.modalCloseText}>Fechar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
};

export default GameScreen;