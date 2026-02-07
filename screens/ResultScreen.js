// ResultScreen.js
import React from 'react';
import { View, Text, Button, StyleSheet } from 'react-native';

// ajuste o caminho conforme onde você salvar o json (se quiser sortear aqui também)
import wordsData from '../assets/words.json';


const ResultScreen = ({ navigation, route }) => {
  const nextWord = route?.params?.nextWord;

  const handleRestartGame = () => {
    navigation.reset({
      index: 0,
      routes: [{ name: 'Context', params: { nextWord } }],
    });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Você Ganhou!</Text>
      <Text style={styles.description}>Parabéns por adivinhar a palavra!</Text>
      <Button title="Jogar novamente" onPress={handleRestartGame} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  description: {
    fontSize: 18,
    marginBottom: 10,
  },
});

export default ResultScreen;
