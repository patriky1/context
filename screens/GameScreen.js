// GameScreen.js
import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  FlatList,
} from "react-native";

import wordsData from "../assets/words.json";

const normalize = (s) =>
  (s ?? "")
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const GameScreen = () => {
  const items = useMemo(() => {
    const list = wordsData?.items ?? [];
    return Array.isArray(list) ? list : [];
  }, []);

  const [guess, setGuess] = useState("");
  const [feedback, setFeedback] = useState("");
  const [current, setCurrent] = useState(null);
  const [guesses, setGuesses] = useState([]); // { raw, norm }

  const pickRandomItem = useCallback(() => {
    if (!items.length) return null;
    const idx = Math.floor(Math.random() * items.length);
    return items[idx];
  }, [items]);

  const resetRound = useCallback(
    (item) => {
      setCurrent(item ?? pickRandomItem());
      setGuess("");
      setFeedback("");
      setGuesses([]);
      Keyboard.dismiss();
    },
    [pickRandomItem]
  );

  useEffect(() => {
    resetRound(pickRandomItem());
  }, [resetRound, pickRandomItem]);

  const getFeedback = (guessValue) => {
    if (!current?.word) return "Nenhuma palavra disponível no arquivo JSON.";

    const g = normalize(guessValue);
    const w = normalize(current.word);

    if (g.length === 0) return "Digite uma tentativa.";
    if (g === w) return "Parabéns, você acertou!";

    const tags = Array.isArray(current.tags) ? current.tags : [];
    const hit = tags.some((t) => {
      const tag = normalize(t);
      return tag && (g.includes(tag) || tag.includes(g));
    });

    if (hit) return "Você está perto! Use a dica e tente outra palavra relacionada.";
    return "Ainda não. Use a dica e tente algo relacionado.";
  };

  const handleSubmit = () => {
    const raw = (guess ?? "").trim();
    const norm = normalize(raw);

    if (!current?.word) {
      setFeedback("Nenhuma palavra disponível no arquivo JSON.");
      return;
    }

    if (!norm) {
      setFeedback("Digite uma tentativa.");
      return;
    }

    const alreadyTried = guesses.some((g) => g.norm === norm);
    if (alreadyTried) {
      setFeedback(`Você já tentou “${raw}”. Tente uma palavra diferente.`);
      Keyboard.dismiss();
      return;
    }

    setGuesses((prev) => [{ raw, norm }, ...prev]);
    setFeedback(getFeedback(raw));
    Keyboard.dismiss();
  };

  const handleNextWord = () => {
    resetRound(); 
  };

  const feedbackMeta = (() => {
    if (!feedback) return null;
    if (feedback === "Parabéns, você acertou!") return { tone: "success", icon: "✅" };
    if (feedback.includes("perto")) return { tone: "warning", icon: "⚠️" };
    if (feedback.includes("já tentou")) return { tone: "neutral", icon: "ℹ️" };
    if (feedback.includes("Digite")) return { tone: "neutral", icon: "ℹ️" };
    return { tone: "danger", icon: "❌" };
  })();

  const canGoNext = feedback === "Parabéns, você acertou!";

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.kicker}>Context</Text>
          <Text style={styles.title}>Adivinhe a Palavra</Text>
          <Text style={styles.subtitle}>
            Digite uma palavra relacionada à dica abaixo. As tentativas ficam registradas
            para você não repetir.
          </Text>
        </View>

        <View style={styles.card}>
          <View style={styles.hintRow}>
            <Text style={styles.hintLabel}>Dica</Text>
            <View style={styles.hintChip}>
              <Text style={styles.hintText}>
                {current?.hint ? current.hint : "Carregando..."}
              </Text>
            </View>
          </View>

          <Text style={styles.inputLabel}>Sua tentativa</Text>
          <TextInput
            style={styles.input}
            value={guess}
            onChangeText={setGuess}
            placeholder="Ex.: animal, cor, objeto..."
            placeholderTextColor="#9CA3AF"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={handleSubmit}
          />

          <Pressable
            onPress={handleSubmit}
            style={({ pressed }) => [
              styles.primaryBtn,
              pressed && { transform: [{ scale: 0.99 }], opacity: 0.95 },
            ]}
          >
            <Text style={styles.primaryBtnText}>Verificar</Text>
          </Pressable>

          {feedback ? (
            <View
              style={[
                styles.feedbackBox,
                feedbackMeta?.tone === "success" && styles.fbSuccess,
                feedbackMeta?.tone === "warning" && styles.fbWarning,
                feedbackMeta?.tone === "danger" && styles.fbDanger,
                feedbackMeta?.tone === "neutral" && styles.fbNeutral,
              ]}
            >
              <Text style={styles.feedbackIcon}>{feedbackMeta?.icon}</Text>
              <Text style={styles.feedbackText}>{feedback}</Text>
            </View>
          ) : (
            <Text style={styles.helper}>Dica: pressione “Enter” para verificar.</Text>
          )}

          <Pressable
            onPress={handleNextWord}
            disabled={!canGoNext}
            style={({ pressed }) => [
              styles.secondaryBtn,
              !canGoNext && styles.secondaryBtnDisabled,
              pressed && canGoNext && { opacity: 0.9 },
            ]}
          >
            <Text style={[styles.secondaryBtnText, !canGoNext && { opacity: 0.6 }]}>
              Próxima palavra
            </Text>
          </Pressable>
        </View>

        <View style={styles.triedSection}>
          <View style={styles.triedHeader}>
            <Text style={styles.triedLabel}>Palavras já tentadas</Text>
            <Text style={styles.triedCount}>{guesses.length}</Text>
          </View>

          <View style={styles.triedBox}>
            <FlatList
              data={guesses}
              keyExtractor={(item, index) => `${item.norm}-${index}`}
              renderItem={({ item }) => (
                <View style={styles.triedRow}>
                  <Text style={styles.triedRowText}>{item.raw}</Text>
                </View>
              )}
              nestedScrollEnabled={true}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              removeClippedSubviews={true}
              showsVerticalScrollIndicator={true}
              scrollEventThrottle={16}
              contentContainerStyle={styles.triedBoxContent}
              ListEmptyComponent={
                <Text style={styles.triedEmpty}>Nenhuma tentativa ainda.</Text>
              }
            />
          </View>
        </View>

        <Text style={styles.footer}>
          {items.length ? `${items.length} palavras no banco` : "Sem palavras no banco"}
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0B1220" },
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 70,
    paddingBottom: 18,
  },

  header: { marginBottom: 18 },
  kicker: {
    color: "#93C5FD",
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  title: { color: "#F9FAFB", fontSize: 28, fontWeight: "800" },
  subtitle: { color: "#CBD5E1", fontSize: 14, marginTop: 8, lineHeight: 20 },

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
  hintLabel: { color: "#9CA3AF", fontSize: 12, marginBottom: 8 },
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

  inputLabel: { color: "#9CA3AF", fontSize: 12, marginBottom: 8 },
  input: {
    backgroundColor: "#0B1220",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#F9FAFB",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    marginBottom: 12,
    fontSize: 16,
  },

  primaryBtn: {
    backgroundColor: "#3B82F6",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 12,
  },
  primaryBtnText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },

  secondaryBtn: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  secondaryBtnDisabled: { opacity: 0.45 },
  secondaryBtnText: { color: "#E5E7EB", fontSize: 15, fontWeight: "700" },

  helper: { color: "#94A3B8", fontSize: 12, marginTop: 6, lineHeight: 18 },

  feedbackBox: {
    marginTop: 2,
    marginBottom: 12,
    borderRadius: 14,
    padding: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    borderWidth: 1,
  },
  feedbackIcon: { fontSize: 16, marginTop: 1 },
  feedbackText: { flex: 1, color: "#E5E7EB", fontSize: 14, lineHeight: 20 },

  fbSuccess: {
    backgroundColor: "rgba(34,197,94,0.10)",
    borderColor: "rgba(34,197,94,0.25)",
  },
  fbWarning: {
    backgroundColor: "rgba(245,158,11,0.10)",
    borderColor: "rgba(245,158,11,0.25)",
  },
  fbDanger: {
    backgroundColor: "rgba(239,68,68,0.10)",
    borderColor: "rgba(239,68,68,0.25)",
  },
  fbNeutral: {
    backgroundColor: "rgba(148,163,184,0.10)",
    borderColor: "rgba(148,163,184,0.22)",
  },

  triedSection: {
    flex: 1,
    marginTop: 14,
  },
  triedHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  triedLabel: { color: "#9CA3AF", fontSize: 12 },
  triedCount: {
    color: "#E5E7EB",
    fontSize: 12,
    fontWeight: "800",
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  triedBox: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    padding: 10,
    overflow: "hidden",
  },
  triedBoxContent: {
    paddingBottom: 12,
  },
  triedRow: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    marginBottom: 8,
  },
  triedRowText: {
    color: "#E5E7EB",
    fontSize: 14,
    fontWeight: "600",
  },
  triedEmpty: { color: "#94A3B8", fontSize: 12 },

  footer: {
    color: "rgba(203,213,225,0.7)",
    textAlign: "center",
    marginTop: 12,
    fontSize: 12,
  },
});

export default GameScreen;
