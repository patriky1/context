import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
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

// ✅ animação mais lenta
const FLIP_DURATION = 650;
const FLIP_STAGGER = 130;

// ✅ chave do storage
const SCORE_KEY = "@adivinhe_a_palavra:score:v1";

function buildEvaluation(guessRaw, answerRaw) {
  const guess = normalize(guessRaw);
  const answer = normalize(answerRaw);

  const g = guess.split("");
  const a = answer.split("");

  const result = Array(WORD_LENGTH).fill("absent");

  // 1) corretas + pool restante
  const remaining = new Map();
  for (let i = 0; i < WORD_LENGTH; i++) {
    if (g[i] === a[i]) {
      result[i] = "correct";
    } else {
      remaining.set(a[i], (remaining.get(a[i]) ?? 0) + 1);
    }
  }

  // 2) presentes (amarelo) respeitando repetidas
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

const GameScreen = () => {
  const items = useMemo(() => {
    const list = wordsData?.items ?? [];
    return Array.isArray(list) ? list : [];
  }, []);

  const inputRef = useRef(null);

  const [current, setCurrent] = useState(null);

  // ✅ Agora cada célula é independente
  const [currentLetters, setCurrentLetters] = useState(
    Array(WORD_LENGTH).fill("")
  );
  const [selectedCol, setSelectedCol] = useState(0);

  // string derivada (para submit e validações)
  const currentGuess = useMemo(() => currentLetters.join(""), [currentLetters]);

  const [attempts, setAttempts] = useState([]); // [{ guessRaw, evaluation }]
  const [message, setMessage] = useState("");
  const [done, setDone] = useState(false);

  // ✅ dica controlada por botão
  const [showHint, setShowHint] = useState(false);

  // ✅ tutorial em modal
  const [showTutorial, setShowTutorial] = useState(false);

  // ✅ pontuação persistida
  const [score, setScore] = useState(0);
  const [scoreLoaded, setScoreLoaded] = useState(false);

  // ===== animação de flip (giro) por célula =====
  const flipsRef = useRef(
    Array.from({ length: MAX_TRIES }, () =>
      Array.from({ length: WORD_LENGTH }, () => new Animated.Value(0))
    )
  );
  const isAnimatingRef = useRef(false);

  // ✅ carrega pontuação ao abrir a tela
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(SCORE_KEY);
        const n = raw != null ? Number(raw) : 0;
        if (alive) setScore(Number.isFinite(n) ? n : 0);
      } catch {
        // se falhar, fica 0
      } finally {
        if (alive) setScoreLoaded(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // ✅ salva pontuação sempre que mudar (após carregar o valor inicial)
  useEffect(() => {
    if (!scoreLoaded) return;
    AsyncStorage.setItem(SCORE_KEY, String(score)).catch(() => {});
  }, [score, scoreLoaded]);

  const pickRandomItem = useCallback(() => {
    if (!items.length) return null;
    const idx = Math.floor(Math.random() * items.length);
    return items[idx];
  }, [items]);

  const resetAnimations = useCallback(() => {
    for (let r = 0; r < MAX_TRIES; r++) {
      for (let c = 0; c < WORD_LENGTH; c++) {
        flipsRef.current[r][c].setValue(0);
      }
    }
    isAnimatingRef.current = false;
  }, []);

  // ✅ resetRound NÃO zera score (score é do "jogo")
  const resetRound = useCallback(() => {
    const next = pickRandomItem();
    setCurrent(next);
    setAttempts([]);
    setCurrentLetters(Array(WORD_LENGTH).fill(""));
    setSelectedCol(0);
    setMessage("");
    setDone(false);
    setShowHint(false);
    resetAnimations();
    Keyboard.dismiss();
  }, [pickRandomItem, resetAnimations]);

  // ✅ reset geral (zera pontuação também)
  const resetAll = useCallback(async () => {
    setScore(0);
    try {
      await AsyncStorage.setItem(SCORE_KEY, "0");
    } catch {}
    resetRound();
  }, [resetRound]);

  useEffect(() => {
    resetRound();
  }, [resetRound]);

  const answerWord = current?.word ?? "";

  const canSubmit =
    !done &&
    currentLetters.every((ch) => normalize(ch).length === 1) &&
    attempts.length < MAX_TRIES &&
    !isAnimatingRef.current;

  const runFlipForRow = (rowIndex) => {
    isAnimatingRef.current = true;

    const anims = flipsRef.current[rowIndex].map((v) =>
      Animated.timing(v, {
        toValue: 1,
        duration: FLIP_DURATION,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      })
    );

    return new Promise((resolve) => {
      Animated.stagger(FLIP_STAGGER, anims).start(() => {
        flipsRef.current[rowIndex].forEach((v) => v.setValue(0));
        isAnimatingRef.current = false;
        resolve();
      });
    });
  };

  const focusInput = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  const setCell = useCallback((index, value) => {
    const letter = (value || "")
      .replace(/[^a-zA-ZÀ-ÿ]/g, "")
      .slice(-1); // garante 1 char

    if (!letter) return;

    setCurrentLetters((prev) => {
      const next = [...prev];
      next[index] = letter;
      return next;
    });

    // avança coluna (ou mantém última)
    setSelectedCol(Math.min(index + 1, WORD_LENGTH - 1));

    // mantém input vazio pra disparar onChange sempre
    requestAnimationFrame(() => inputRef.current?.clear?.());
  }, []);

  const handleBackspace = useCallback(() => {
    setCurrentLetters((prev) => {
      const next = [...prev];

      // se célula atual tem letra, apaga
      if (next[selectedCol]) {
        next[selectedCol] = "";
        return next;
      }

      // se estiver vazia, volta e apaga a anterior
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

    const raw = currentLetters.join("");
    const norm = normalize(raw);

    if (norm.length !== WORD_LENGTH) {
      setMessage(`Digite uma palavra com ${WORD_LENGTH} letras.`);
      return;
    }

    const already = attempts.some((a) => normalize(a.guessRaw) === norm);
    if (already) {
      setMessage(`Você já tentou “${raw}”. Tente uma palavra diferente.`);
      Keyboard.dismiss();
      return;
    }

    const rowIndex = attempts.length;

    // roda a animação de flip ANTES de registrar o resultado visual
    Keyboard.dismiss();
    await runFlipForRow(rowIndex);

    const evaluation = buildEvaluation(raw, answerWord);
    const newAttempts = [...attempts, { guessRaw: raw, evaluation }];
    setAttempts(newAttempts);

    const isWin = norm === normalize(answerWord);

    if (isWin) {
      setDone(true);
      setMessage("Parabéns, você acertou!");

      // ✅ soma 1 ponto por acerto (e será persistido pelo useEffect)
      setScore((s) => s + 1);

      setTimeout(() => {
        resetRound();
      }, 900);
      return;
    }

    const hint = buildLetterHint(raw, answerWord, evaluation);
    setMessage(hint);

    // acabou as tentativas? reinicia automaticamente
    if (newAttempts.length >= MAX_TRIES) {
      setDone(true);
      setMessage(`Fim de jogo! A palavra era ${answerWord.toUpperCase()}.`);
      setTimeout(() => {
        resetRound();
      }, 1100);
      return;
    }

    // limpa linha atual
    setCurrentLetters(Array(WORD_LENGTH).fill(""));
    setSelectedCol(0);
    requestAnimationFrame(() => inputRef.current?.clear?.());
  };

  // ✅ key única por célula (resolve warning)
  const renderCell = (
    row,
    col,
    char,
    status,
    isActive,
    isCurrentRow,
    onPress
  ) => {
    const flipVal = flipsRef.current[row][col];
    const rotateX = flipVal.interpolate({
      inputRange: [0, 1],
      outputRange: ["0deg", "180deg"],
    });

    const animatedStyle = isCurrentRow
      ? { transform: [{ perspective: 800 }, { rotateX }] }
      : null;

    const Wrapper = isCurrentRow ? Pressable : View;

    return (
      <Wrapper key={`cell-${row}-${col}`} onPress={onPress} style={{ flex: 1 }}>
        <Animated.View
          style={[
            styles.cell,
            status === "correct" && styles.cellCorrect,
            status === "present" && styles.cellPresent,
            status === "absent" && styles.cellAbsent,
            isActive && styles.cellActive,
            animatedStyle,
          ]}
        >
          <Text style={styles.cellText}>{(char || "").toUpperCase()}</Text>
        </Animated.View>
      </Wrapper>
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
              renderCell(r, c, g[c] || "", attempt.evaluation[c], false, false)
            )}
          </View>
        );
        continue;
      }

      if (r === attempts.length && !done) {
        rows.push(
          <View key={`row-${r}`} style={styles.row}>
            {Array.from({ length: WORD_LENGTH }).map((_, c) => {
              const isActive = c === selectedCol; // cursor
              return renderCell(
                r,
                c,
                currentLetters[c] || "",
                null,
                isActive,
                true,
                () => {
                  setSelectedCol(c);
                  focusInput();
                }
              );
            })}
          </View>
        );
        continue;
      }

      rows.push(
        <View key={`row-${r}`} style={styles.row}>
          {Array.from({ length: WORD_LENGTH }).map((_, c) =>
            renderCell(r, c, "", null, false, false)
          )}
        </View>
      );
    }

    return rows;
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
          <Text style={styles.title}>CONTEXT</Text>

          {/* ✅ Tutorial + Pontuação (lado a lado, à direita) */}
          <View style={styles.tutorialRow}>
            <Pressable
              onPress={() => setShowTutorial(true)}
              style={({ pressed }) => [
                styles.tutorialBtn,
                pressed && {
                  opacity: 0.9,
                  transform: [{ scale: 0.99 }],
                },
              ]}
            >
              <Text style={styles.tutorialBtnText}>Tutorial</Text>
            </Pressable>

            <View style={styles.scorePill}>
              <Text style={styles.scorePillLabel}>Pontuação</Text>
              <Text style={styles.scorePillValue}>
                {scoreLoaded ? score : "—"}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          {/* ✅ Dica com botão */}
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

          {/* Board: tocar foca o input */}
          <Pressable onPress={focusInput} style={styles.board}>
            {renderBoard()}
          </Pressable>

          {/* Input invisível */}
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
            maxLength={1}
            style={styles.hiddenInput}
          />

          <Pressable
            onPress={handleSubmit}
            disabled={!canSubmit}
            style={({ pressed }) => [
              styles.primaryBtn,
              !canSubmit && { opacity: 0.5 },
              pressed && canSubmit && {
                transform: [{ scale: 0.99 }],
                opacity: 0.95,
              },
            ]}
          >
            <Text style={styles.primaryBtnText}>Verificar</Text>
          </Pressable>

          {!!message && <Text style={styles.message}>{message}</Text>}

          

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

      {/* ✅ Modal do Tutorial */}
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

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0B1220" },

  container: {
    paddingHorizontal: 20,
    paddingTop: 70,
    paddingBottom: 24,
    flexGrow: 1,
  },

  header: { marginBottom: 18 },
  kicker: {
    color: "#93C5FD",
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 6,
    textAlign: "center",
  },
  title: { color: "#F9FAFB", 
    fontSize: 28, 
    fontWeight: "800",
  alignSelf: "center",
 },


  tutorialRow: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  tutorialBtn: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    alignSelf: "flex-start",
  },
  tutorialBtnText: {
    color: "#E5E7EB",
    fontSize: 13,
    fontWeight: "700",
  },

  scorePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  scorePillLabel: {
    color: "rgba(203,213,225,0.85)",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  scorePillValue: {
    color: "#F9FAFB",
    fontSize: 14,
    fontWeight: "900",
  },

  card: {
    backgroundColor: "#111A2E",
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },

  hintRow: { marginBottom: 14 },
  hintHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  hintLabel: { color: "#9CA3AF", fontSize: 12 },
  hintBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  hintBtnText: {
    color: "#E5E7EB",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },

  hintChip: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(147, 197, 253, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(147, 197, 253, 0.25)",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  hintText: { color: "#E5E7EB", fontSize: 14, fontWeight: "600" },

  board: { marginTop: 6, marginBottom: 14 },
  row: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 10,
  },
  cell: {
    flex: 1,
    height: 54,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    backfaceVisibility: "hidden",
  },
  cellActive: {
    borderColor: "rgba(147, 197, 253, 0.70)",
  },
  cellCorrect: {
    backgroundColor: "rgba(16, 185, 129, 0.35)",
    borderColor: "rgba(16, 185, 129, 0.55)",
  },
  cellPresent: {
    backgroundColor: "rgba(245, 158, 11, 0.35)",
    borderColor: "rgba(245, 158, 11, 0.55)",
  },
  cellAbsent: {
    backgroundColor: "rgba(148, 163, 184, 0.14)",
    borderColor: "rgba(148, 163, 184, 0.22)",
  },
  cellText: {
    color: "#F9FAFB",
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: 1,
  },

  hiddenInput: {
    position: "absolute",
    opacity: 0,
    height: 1,
    width: 1,
  },

  primaryBtn: {
    backgroundColor: "#3B82F6",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 10,
  },
  primaryBtnText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },

  message: {
    color: "#E5E7EB",
    fontSize: 16,
    lineHeight: 22,
    marginTop: 6,
    marginBottom: 6,
  },

  note: {
    color: "rgba(203,213,225,0.7)",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
    marginBottom: 12,
  },

  secondaryBtn: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 10,
  },
  secondaryBtnDanger: {
    backgroundColor: "rgba(239, 68, 68, 0.10)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.25)",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  secondaryBtnText: { color: "#E5E7EB", fontSize: 15, fontWeight: "700" },

  footer: {
    color: "rgba(203,213,225,0.7)",
    textAlign: "center",
    marginTop: 12,
    fontSize: 12,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalCard: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "#111A2E",
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  modalTitle: {
    color: "#F9FAFB",
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 12,
  },
  modalText: {
    color: "#E5E7EB",
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 8,
  },
  modalCloseBtn: {
    marginTop: 10,
    backgroundColor: "#3B82F6",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  modalCloseText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
});

export default GameScreen;
