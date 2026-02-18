import React, {
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
} from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
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
    } else {
      remaining.set(a[i], (remaining.get(a[i]) ?? 0) + 1);
    }
  }
  for (let i = 0; i < WORD_LENGTH; i++) {
    if (result[i] === "correct") continue;
    const ch = g[i];
    const count = remaining.get(ch) ?? 0;
    if (count > 0) {
      result[i] = "present";
      remaining.set(ch, count - 1);
    }
  }
  return result;
}

function buildLetterHint(guessRaw, answerRaw, evaluation) {
  const answer = normalize(answerRaw);
  const guess = normalize(guessRaw);
  const lastIdx = Math.max(0, Math.min(WORD_LENGTH - 1, guess.length - 1));
  const letter = (guess[lastIdx] || "").toUpperCase();
  if (!letter) return "";
  const status = evaluation[lastIdx];
  if (status === "correct") {
    return `A letra ${letter} faz parte da palavra e está na posição correta.`;
  }
  if (status === "present") {
    return `A letra ${letter} faz parte da palavra mas em outra posição.`;
  }
  const exists = answer.includes(normalize(letter));
  if (exists) {
    return `A letra ${letter} faz parte da palavra mas em outra posição.`;
  }
  return `A letra ${letter} não faz parte da palavra.`;
}

const createStyles = (t) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.screenBg },
    container: {
      paddingHorizontal: 20,
      paddingTop: 70,
      paddingBottom: 24,
      flexGrow: 1,
    },
    header: { marginBottom: 18 },
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
      marginBottom: 25,
    },
    hintRow: { marginBottom: 0 },
    hintHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-end",
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
    },
    hintText: { color: t.text, fontSize: 14, fontWeight: "600" },
    board: { marginTop: 6, marginBottom: 14 },
    row: { flexDirection: "row", gap: 10, marginBottom: 10 },
    cell: {
      flex: 1,
      height: 54,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: t.cellBg,
      borderWidth: 1,
      borderColor: t.cellBorder,
      backfaceVisibility: "hidden",
    },
    cellActive: { borderColor: t.cellActiveBorder },
    cellCorrect: { backgroundColor: t.correctBg, borderColor: t.correctBorder },
    cellPresent: { backgroundColor: t.presentBg, borderColor: t.presentBorder },
    cellAbsent: { backgroundColor: t.absentBg, borderColor: t.absentBorder },
    cellText: {
      color: t.text,
      fontSize: 20,
      fontWeight: "800",
      letterSpacing: 1,
    },
    hiddenInput: { position: "absolute", opacity: 0, height: 1, width: 1 },
    primaryBtn: {
      backgroundColor: t.primary,
      paddingVertical: 12,
      borderRadius: 12,
      alignItems: "center",
      marginBottom: 10,
    },
    primaryBtnText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
    message: {
      color: t.text,
      fontSize: 16,
      lineHeight: 22,
      marginTop: 6,
      marginBottom: 6,
      textAlign: "center",
    },
    errorMessage: {
      color: "#ef4444",
      fontSize: 15,
      fontWeight: "600",
      marginTop: 6,
      marginBottom: 6,
      textAlign: "center",
    },
    note: {
      color: t.textMuted,
      fontSize: 12,
      lineHeight: 18,
      marginTop: 4,
      marginBottom: 12,
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
    footer: {
      color: t.textMuted,
      textAlign: "center",
      marginTop: 12,
      fontSize: 12,
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

const TITLE_COLORS = [
  "#22C55E",
  "#3B82F6",
  "#F59E0B",
  "#EF4444",
  "#A855F7",
  "#06B6D4",
  "#F97316",
];

const GameScreen = () => {
  const items = useMemo(() => {
    const list = wordsData?.items ?? [];
    return Array.isArray(list) ? list : [];
  }, []);

  const wordSet = useMemo(() => {
    const set = new Set();
    items.forEach((item) => {
      if (item?.word) set.add(normalize(item.word));
    });
    return set;
  }, [items]);

  const [theme, setTheme] = useState("dark");
  const t = THEMES[theme] ?? THEMES.dark;
  const styles = useMemo(() => createStyles(t), [t]);

  const inputRef = useRef(null);
  const [current, setCurrent] = useState(null);
  const [currentLetters, setCurrentLetters] = useState(Array(WORD_LENGTH).fill(""));
  const [selectedCol, setSelectedCol] = useState(0);
  const [attempts, setAttempts] = useState([]);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [done, setDone] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [score, setScore] = useState(0);
  const [scoreLoaded, setScoreLoaded] = useState(false);

  const flipsRef = useRef(
    Array.from({ length: MAX_TRIES }, () =>
      Array.from({ length: WORD_LENGTH }, () => new Animated.Value(0)),
    ),
  );
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const invalidBorderAnim = useRef(new Animated.Value(0)).current;
  const isAnimatingRef = useRef(false);

  // ====================== FOCUS ANDROID ======================
  const focusInput = useCallback(() => {
    const input = inputRef.current;
    if (!input) return;

    if (Platform.OS === "android") {
      input.blur();
      setTimeout(() => input.focus(), 30);
    } else {
      input.focus();
    }
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(SCORE_KEY);
        const n = raw != null ? Number(raw) : 0;
        if (alive) setScore(Number.isFinite(n) ? n : 0);
      } catch {}
      finally {
        if (alive) setScoreLoaded(true);
      }
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!scoreLoaded) return;
    AsyncStorage.setItem(SCORE_KEY, String(score)).catch(() => {});
  }, [score, scoreLoaded]);

  const pickRandomItem = useCallback(() => {
    if (!items.length) return null;
    return items[Math.floor(Math.random() * items.length)];
  }, [items]);

  const resetAnimations = useCallback(() => {
    for (let r = 0; r < MAX_TRIES; r++) {
      for (let c = 0; c < WORD_LENGTH; c++) {
        flipsRef.current[r][c].setValue(0);
      }
    }
    shakeAnim.setValue(0);
    invalidBorderAnim.setValue(0);
    isAnimatingRef.current = false;
  }, [shakeAnim, invalidBorderAnim]);

  const resetRound = useCallback(() => {
    const next = pickRandomItem();
    setCurrent(next);
    setAttempts([]);
    setCurrentLetters(Array(WORD_LENGTH).fill(""));
    setSelectedCol(0);
    setMessage("");
    setErrorMessage("");
    setDone(false);
    setShowHint(false);
    resetAnimations();
    Keyboard.dismiss();
  }, [pickRandomItem, resetAnimations]);

  const resetAll = useCallback(async () => {
    setScore(0);
    try { await AsyncStorage.setItem(SCORE_KEY, "0"); } catch {}
    resetRound();
  }, [resetRound]);

  useEffect(() => { resetRound(); }, [resetRound]);

  const answerWord = current?.word ?? "";
  const guessRaw = currentLetters.join("");
  const guessNorm = normalize(guessRaw);
  const isFullWord = guessNorm.length === WORD_LENGTH;
  const isKnownWord = isFullWord && wordSet.has(guessNorm);
  const canSubmit = !done && isKnownWord && attempts.length < MAX_TRIES && !isAnimatingRef.current;

  const triggerErrorAnimation = () => {
    isAnimatingRef.current = true;
    setErrorMessage("Palavra não reconhecida • Digite uma palavra válida");

    shakeAnim.setValue(0);
    invalidBorderAnim.setValue(0);

    Animated.sequence([
      Animated.timing(invalidBorderAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: false,
      }),
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 8, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
      ]),
      Animated.timing(invalidBorderAnim, {
        toValue: 0,
        duration: 300,
        delay: 400,
        useNativeDriver: false,
      }),
    ]).start(() => {
      isAnimatingRef.current = false;
      setErrorMessage("");
      focusInput();
    });
  };

  const runFlipForRow = (rowIndex) => {
    isAnimatingRef.current = true;
    const anims = flipsRef.current[rowIndex].map((v) =>
      Animated.timing(v, {
        toValue: 1,
        duration: FLIP_DURATION,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    );
    return new Promise((resolve) => {
      Animated.stagger(FLIP_STAGGER, anims).start(() => {
        flipsRef.current[rowIndex].forEach((v) => v.setValue(0));
        isAnimatingRef.current = false;
        resolve();
      });
    });
  };

  const setCell = useCallback((index, value) => {
    const letter = (value || "").replace(/[^a-zA-ZÀ-ÿ]/g, "").slice(-1);
    if (!letter) return;
    setCurrentLetters((prev) => {
      const next = [...prev];
      next[index] = letter;
      return next;
    });
    setSelectedCol(Math.min(index + 1, WORD_LENGTH - 1));
    requestAnimationFrame(() => inputRef.current?.clear?.());
  }, []);

  const handleBackspace = useCallback(() => {
    setCurrentLetters((prev) => {
      const next = [...prev];
      if (next[selectedCol]) {
        next[selectedCol] = "";
        return next;
      }
      const back = Math.max(0, selectedCol - 1);
      next[back] = "";
      setSelectedCol(back);
      return next;
    });
    requestAnimationFrame(() => inputRef.current?.clear?.());
  }, [selectedCol]);

  const handleSubmit = async () => {
    if (!answerWord) {
      setMessage("Nenhuma palavra disponível no arquivo JSON.");
      return;
    }
    if (!isKnownWord) {
      triggerErrorAnimation();
      return;
    }

    const raw = guessRaw;
    const norm = guessNorm;
    const already = attempts.some((a) => normalize(a.guessRaw) === norm);
    if (already) {
      setMessage(`Você já tentou “${raw}”. Tente uma palavra diferente.`);
      Keyboard.dismiss();
      return;
    }

    const rowIndex = attempts.length;
    Keyboard.dismiss();
    await runFlipForRow(rowIndex);

    const evaluation = buildEvaluation(raw, answerWord);
    const newAttempts = [...attempts, { guessRaw: raw, evaluation }];
    setAttempts(newAttempts);

    const isWin = norm === normalize(answerWord);
    if (isWin) {
      setDone(true);
      setMessage("Parabéns, você acertou!");
      setScore((s) => s + 1);
      setTimeout(() => resetRound(), 900);
      return;
    }

    const hint = buildLetterHint(raw, answerWord, evaluation);
    setMessage(hint);

    if (newAttempts.length >= MAX_TRIES) {
      setDone(true);
      setMessage(`Fim de jogo! A palavra era ${answerWord.toUpperCase()}.`);
      setTimeout(() => resetRound(), 1100);
      return;
    }

    setCurrentLetters(Array(WORD_LENGTH).fill(""));
    setSelectedCol(0);
    requestAnimationFrame(() => inputRef.current?.clear?.());
    setTimeout(focusInput, 750); 
  };

  const shakeTranslateX = shakeAnim.interpolate({
    inputRange: [-10, 0, 10],
    outputRange: [-12, 0, 12],
  });

  const errorBorderColor = invalidBorderAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [t.cellBorder, "#ef4444"],
  });

  const renderCell = (
    row,
    col,
    char,
    status,
    isActive,
    isCurrentRow,
  ) => {
    const flipVal = flipsRef.current[row][col];
    const rotateX = flipVal.interpolate({
      inputRange: [0, 1],
      outputRange: ["0deg", "180deg"],
    });
    const flipStyle = {
      transform: [{ perspective: 800 }, { rotateX }],
    };
    const shakeStyle = {
      transform: [{ translateX: shakeTranslateX }],
    };
    const currentRowBorderStyle = isCurrentRow
      ? { borderColor: isKnownWord || !isFullWord ? t.cellActiveBorder : errorBorderColor }
      : {};

    return (
      <Pressable
        key={`cell-${row}-${col}`}
        onPress={() => {
          if (isCurrentRow) {
            setSelectedCol(col);
            setTimeout(focusInput, 30);
          }
        }}
        style={{ flex: 1 }}
        disabled={!isCurrentRow}
      >
        <Animated.View
          style={[
            styles.cell,
            status === "correct" && styles.cellCorrect,
            status === "present" && styles.cellPresent,
            status === "absent" && styles.cellAbsent,
            isActive && styles.cellActive,
            currentRowBorderStyle,
            isCurrentRow && flipStyle,
          ]}
        >
          <Animated.View
            style={[
              { flex: 1, justifyContent: "center", alignItems: "center" },
              isCurrentRow && shakeStyle,
            ]}
          >
            <Text style={styles.cellText}>{(char || "").toUpperCase()}</Text>
          </Animated.View>
        </Animated.View>
      </Pressable>
    );
  };

  const renderBoard = () => {
    const rows = [];
    for (let r = 0; r < MAX_TRIES; r++) {
      const attempt = attempts[r];
      if (attempt) {
        const g = (attempt.guessRaw || "").split("");
        rows.push(
          <View key={`row-${r}`} style={styles.row}>
            {Array.from({ length: WORD_LENGTH }).map((_, c) =>
              renderCell(r, c, g[c] || "", attempt.evaluation[c], false, false),
            )}
          </View>,
        );
        continue;
      }
      if (r === attempts.length && !done) {
        rows.push(
          <View key={`row-${r}`} style={styles.row}>
            {Array.from({ length: WORD_LENGTH }).map((_, c) => {
              const isActive = c === selectedCol;
              return renderCell(
                r,
                c,
                currentLetters[c] || "",
                null,
                isActive,
                true,
              );
            })}
          </View>,
        );
        continue;
      }
      rows.push(
        <View key={`row-${r}`} style={styles.row}>
          {Array.from({ length: WORD_LENGTH }).map((_, c) =>
            renderCell(r, c, "", null, false, false),
          )}
        </View>,
      );
    }
    return rows;
  };

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  }, []);

  const renderColoredTitle = () => {
    const text = "CONTEXT";
    return (
      <View style={styles.titleRow}>
        {text.split("").map((ch, idx) => (
          <Text
            key={`title-${idx}-${ch}`}
            style={[
              styles.titleChar,
              { color: TITLE_COLORS[idx % TITLE_COLORS.length] },
            ]}
          >
            {ch}
          </Text>
        ))}
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          {renderColoredTitle()}
          <View style={styles.tutorialRow}>
            <View style={styles.rightHeaderGroup}>
              <Pressable
                onPress={() => setShowTutorial(true)}
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
              <Text style={styles.scorePillValue}>
                {scoreLoaded ? score : "—"}
              </Text>
            </View>
            <Pressable
              onPress={toggleTheme}
              style={({ pressed }) => [
                styles.pillBtn,
                pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] },
              ]}
            >
              <Text style={styles.pillBtnText}>
                {theme === "dark" ? "☀️" : "🌙"}
              </Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.hintRow}>
            <View style={styles.hintHeader}>
              <Pressable
                onPress={() => setShowHint((v) => !v)}
                style={({ pressed }) => [
                  styles.hintBtn,
                  pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] },
                ]}
              >
                <Text style={styles.hintBtnText}>
                  {showHint ? "Ocultar dica" : "Mostrar dica"}
                </Text>
              </Pressable>
            </View>
            {showHint && (
              <View style={styles.hintChip}>
                <Text style={styles.hintText}>
                  {current?.hint ? current.hint : "Carregando..."}
                </Text>
              </View>
            )}
          </View>

          <Pressable onPress={focusInput} style={styles.board}>
            {renderBoard()}
          </Pressable>

          <TextInput
            ref={inputRef}
            value={""}
            onChangeText={(t) => setCell(selectedCol, t)}
            onKeyPress={({ nativeEvent }) => {
              if (nativeEvent.key === "Backspace") handleBackspace();
            }}
            autoCapitalize="characters"
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={handleSubmit}
            blurOnSubmit={false}
            maxLength={1}
            style={styles.hiddenInput}
          />

          <Pressable
            onPress={handleSubmit}
            disabled={!canSubmit}
            style={({ pressed }) => [
              styles.primaryBtn,
              !canSubmit && { opacity: 0.5 },
              pressed &&
                canSubmit && { transform: [{ scale: 0.99 }], opacity: 0.95 },
            ]}
          >
            <Text style={styles.primaryBtnText}>Verificar</Text>
          </Pressable>

          {errorMessage ? (
            <Text style={styles.errorMessage}>{errorMessage}</Text>
          ) : message ? (
            <Text style={styles.message}>{message}</Text>
          ) : null}

          <Pressable
            onPress={resetRound}
            style={({ pressed }) => [
              styles.secondaryBtn,
              pressed && { opacity: 0.9 },
            ]}
          >
            <Text style={styles.secondaryBtnText}>Reiniciar rodada</Text>
          </Pressable>

          <Pressable
            onPress={resetAll}
            style={({ pressed }) => [
              styles.secondaryBtnDanger,
              pressed && { opacity: 0.9 },
            ]}
          >
            <Text style={styles.secondaryBtnText}>Zerar pontuação</Text>
          </Pressable>
        </View>

        <Text style={styles.footer}>
          {items.length
            ? `${items.length} palavras no banco`
            : "Sem palavras no banco"}
        </Text>
        <Text style={styles.kicker}>By: @Patrikybrito_Dev</Text>
      </ScrollView>

      <Modal
        visible={showTutorial}
        transparent
        animationType="fade"
        onRequestClose={() => setShowTutorial(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Tutorial</Text>
            <Text style={styles.modalText}>
              Digite uma palavra de 5 letras.
            </Text>
            <Text style={styles.modalText}>
              🟢 Verde = letra correta na posição correta.
            </Text>
            <Text style={styles.modalText}>
              🟡 Amarelo = letra existe, mas em outra posição.
            </Text>
            <Text style={styles.modalText}>
              ⚪ Cinza = letra não existe na palavra.
            </Text>
            <Text style={styles.note}>
              Os acentos são preenchidos automaticamente, e não são considerados
              nas dicas.
            </Text>
            <Pressable
              onPress={() => setShowTutorial(false)}
              style={({ pressed }) => [
                styles.modalCloseBtn,
                pressed && { opacity: 0.9 },
              ]}
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