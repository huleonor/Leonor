/**
 * The phase videos' words in Portuguese (Settings, Language), written by hand like the English ones
 * in reelScripts.ts, phase by phase in the same order: what shows (title, hook, tricks, the hands,
 * captions by bar, the tip), what the voice says (`talk`) and the tips of the steps.
 *
 * Note names are written as letters (E, F#, Bb): the videos show and say them as he reads them
 * (Dó Ré Mi, or letters; lang.ts `NT`). So no sentence here starts with the words "A" or "E" (they
 * would read as notes): "As", "O", "Aqui", "Depois" instead. Same limits as the English (reelShape.ts).
 */
import type { PhaseWords, Talk } from './reelShape';

export type PhasePt = Omit<PhaseWords, 'from' | 'to' | 'talk' | 'steps'> & { talk?: Talk };

const ph = (title: string, hook: string, tricks: string[], L: string, R: string, cues: Record<number, string>, tip: string, talk?: Talk): PhasePt =>
  ({ title, hook, tricks, L, R, cues, tip, talk });

export const SCRIPTS_PT: Record<string, PhasePt[]> = {
  'gymnopedie-1': [
    ph('O início a embalar', 'Dois acordes embalam, depois entra uma melodia lenta', [
      'Esquerda: nota grave no 1, acorde no 2. G, depois D',
      'Direita: a melodia entra no tempo 2, F# depois A',
    ], 'G grave, salta para B D F#. Depois D grave, para A C# F#', 'Pausa no 1, depois F# A. G F# C#. B C# D. Depois A', {
      1: 'Quatro compassos só da esquerda: conta-os',
      5: 'A melodia entra no tempo 2',
      8: 'A, segurado o compasso todo',
      9: 'F#, segurado quatro compassos',
      13: 'A melodia outra vez, as mesmas notas',
    }, 'Nunca à pressa. Conta 1 2 3, devagar e igual.', {
      intro: 'Dois acordes embalam para trás e para a frente, e depois uma melodia lenta flutua por cima. Conta três tempos em cada compasso.',
      L: 'Mão esquerda: um G grave, depois salta para o acorde, B, D, F#. Depois um D grave, e sobe para A, C#, F#.',
      R: 'Mão direita: pausa no tempo um, depois F# e A. Depois G, F#, C#. Nunca tem pressa.',
      both: 'Juntas. Quatro compassos só da mão esquerda, e depois a melodia entra no tempo dois.',
      outro: 'Nunca à pressa. Conta um, dois, três, devagar e igual.',
    }),
    ph('Notas longas', 'O baixo desce enquanto a melodia segura', [
      'Esquerda: cada compasso uma nota grave nova e o acorde',
      'Direita: segura as notas longas o tempo todo',
    ], 'F# grave, B, E, D, A: encontra cada uma antes de tocar', 'C#, depois F#, depois um E grave longo, três compassos', {
      17: 'As duas no tempo 1: F# grave, C# agudo',
      19: 'Segura o E três compassos e continua a contar',
      22: 'Sobe: A, B, C',
      23: 'Depois desce: E, D, B',
    }, 'Conta as notas longas. Aqui são elas a música.', {
      intro: 'Agora o baixo desce, uma nota por compasso, enquanto a melodia segura notas longas por cima.',
      L: 'Mão esquerda: F# grave, depois B, E, D e A. Encontra cada nota grave antes de a tocares.',
      R: 'Mão direita: C#, F#, depois um E longo, segurado três compassos. Continua a contar enquanto soa.',
      both: 'Juntas. As notas longas são a música aqui, por isso dá-lhes o tempo todo.',
      outro: 'Conta as notas longas. Aqui são elas a música.',
    }),
    ph('Um D grave, depois acordes', 'Um D grave segura tudo, depois dois acordes grandes', [
      'Esquerda: o D grave não se mexe, só o acorde em cima',
      'Direita: D agudo e D grave, a uma oitava',
    ], 'D grave em cada compasso, acorde no 2: C E A, C F# A', 'D agudo segurado, D grave no 2, depois sobe E F G', {
      25: 'Três notas D: uma grave à esquerda, duas à direita',
      27: 'Sobe: E, F, G',
      29: 'Tempo 2: acordes nas duas mãos',
      33: 'Passos pequenos: B A B, depois C# D E',
      37: 'Segura F# enquanto D e G tocam por baixo',
      38: 'Um acorde grande: C E A C',
      39: 'Depois D F# A D, segurado',
    }, 'Prepara a forma da mão para os acordes grandes antes de os tocar.', {
      intro: 'Um D grave segura tudo aqui, e a fase termina em dois acordes grandes.',
      L: 'Mão esquerda: o D grave nunca se mexe. Só muda o acorde no tempo dois. C, E, A, depois C, F#, A.',
      R: 'Mão direita: um D agudo segurado, um D grave no tempo dois, e depois sobe, E, F, G.',
      both: 'Juntas. Prepara a mão para os acordes grandes do fim antes de os tocares.',
      outro: 'Prepara a forma da mão para os acordes grandes antes de os tocares.',
    }),
    ph('O início outra vez', 'O começo volta: os mesmos acordes, a mesma melodia', [
      'Esquerda: D depois G, a embalar, como no início',
      'Direita: a mesma melodia, a acabar num F# longo',
    ], 'D grave, para A C# F#. G grave, para B D F#', 'F# A, depois G F# C#, depois B C# D, depois A', {
      40: 'Só a mão esquerda outra vez: conta',
      44: 'A melodia entra no tempo 2',
      48: 'Desce ao F#, segurado quatro compassos',
    }, 'Já conheces esta. Deixa-a flutuar.', {
      intro: 'O começo volta. Os mesmos acordes a embalar, a mesma melodia. Já conheces esta.',
      L: 'Mão esquerda: D grave, para A, C#, F#. G grave, para B, D, F#. A embalar, como no início.',
      R: 'Mão direita: F# e A, depois G, F#, C#, depois B, C#, D, e desce até um F# longo.',
      both: 'Juntas. Deixa-a flutuar, e segura o último F# quatro compassos.',
      outro: 'Já conheces esta. Deixa-a flutuar.',
    }),
    ph('Notas longas, depois o D', 'As fases 2 e 3 outra vez, com um final novo', [
      'Esquerda: o mesmo baixo a andar, depois o D grave',
      'Direita: o E longo, a subida, depois D grave e agudo',
    ], 'B grave, E, D, A, depois o D grave em cada compasso', 'F#, um E grave longo, depois sobe A B C', {
      57: 'As duas no tempo 1: B grave, F# agudo',
      58: 'Segura o E três compassos',
      61: 'Sobe: A, B, C',
      65: 'D grave, depois D agudo',
      71: 'Sobe ao G e segura',
    }, 'Igual a antes, por isso confia nas mãos.', {
      intro: 'As fases dois e três voltam, com um final novo.',
      L: 'Mão esquerda: o mesmo baixo a andar, B, E, D, A, e depois o D grave em cada compasso.',
      R: 'Mão direita: F#, um E grave longo, depois A, B, C, a subir.',
      both: 'Juntas. É igual a antes, por isso confia nas mãos, e segura o G no fim.',
      outro: 'Igual a antes. Confia nas mãos.',
    }),
    ph('O final', 'Passos a descer, depois os dois últimos acordes', [
      'Esquerda: um E grave três vezes, depois A e D',
      'Direita: como o fim da fase 3, com F em vez de F#',
    ], 'E grave, depois A C F. E, depois C E A', 'B C F, depois E D C, depois E D C outra vez', {
      73: 'A direita dá passos, a esquerda embala',
      76: 'Segura o F enquanto D e G tocam',
      77: 'As duas mãos de uma vez: um acorde segurado',
      78: 'O último acorde. Deixa-o soar',
    }, 'Abranda no fim e deixa o último acorde soar.', {
      intro: 'O final. Pequenos passos a descer na mão direita, e depois os dois últimos acordes.',
      L: 'Mão esquerda: um E grave, três vezes, depois A, depois D.',
      R: 'Mão direita: B, C, F, depois E, D, C, duas vezes. É o fim da fase três, com F em vez de F#.',
      both: 'Juntas. Abranda no fim, e deixa o último acorde soar.',
      outro: 'Abranda, e deixa o último acorde soar.',
    }),
  ],

  'fur-elise': [
    ph('A volta famosa', 'E D# E D# E, depois as mãos revezam-se', [
      'Direita: balança entre duas teclas vizinhas, E e D#',
      'Esquerda: só duas formas, A E A e E E G#',
    ], 'A grave, E, A a subir. Depois E, E, G#', 'E D# E D# E, depois B D C, a cair no A', {
      1: 'Começa no último tempo: E, D#',
      3: 'Esquerda sobe A E A, depois a direita sobe C E A',
      4: 'Esquerda sobe E E G#, depois a direita E G# B',
      6: 'A volta outra vez: E D# E B D C',
    }, 'Leve. A mão fica quieta durante a volta.', {
      intro: 'A volta famosa. A mão direita balança entre duas teclas vizinhas, E e D#, e depois as duas mãos revezam-se.',
      L: 'Mão esquerda: só duas formas. A, E, A, a subir. Depois E, E, G#.',
      R: 'Mão direita: E, D#, E, D#, E, depois B, D, C, e cai no A. A mão fica quieta durante a volta.',
      both: 'Juntas. A mão esquerda sobe, e a mão direita sobe para lhe responder.',
      outro: 'Leve. A mão fica quieta durante a volta.',
    }),
    ph('Outra vez, até ao fim', 'A mesma melodia, a acabar no A', [
      'Esquerda: as mesmas duas formas de antes',
      'Direita: o compasso 16 acaba C B, não G# B',
    ], 'A E A, depois E E G#, até ao último A', 'A, a volta, depois C E A e E G# B', {
      9: 'As duas no tempo 1: um A em cada mão',
      10: 'A volta: E D# E B D C',
      16: 'B, depois E C B',
      17: 'As duas acabam juntas no A',
    }, 'Suave no fim. O último A nas duas mãos.', {
      intro: 'A mesma melodia outra vez, e desta vez fecha no A.',
      L: 'Mão esquerda: as mesmas duas formas de antes, até ao último A.',
      R: 'Mão direita: a volta outra vez. Atenção ao compasso 16: acaba C, B, e não G#, B. É isso que fecha.',
      both: 'Juntas. Suave no fim, com um A nas duas mãos.',
      outro: 'Suave no fim. O último A nas duas mãos.',
    }),
  ],

  'interstellar-experience': [
    ph('O padrão', 'Uma forma sobre quatro oitavas: F G A E', [
      'Direita: cima, meio, baixo, meio em cada tempo',
      'Esquerda: uma oitava por compasso, mindinho e polegar',
    ], 'Oitavas F, G, A, E: 5 em baixo, 1 em cima, 4 tempos', 'E C A C, depois E B G B: só a nota de cima muda', {
      1: 'Começa com uma nota: E, quatro vezes',
      2: 'As duas no tempo 1: oitava em baixo, padrão em cima',
      6: 'Acentua o tempo 1. A esquerda cruza para uma nota',
      8: 'Agora com B: E B G B',
      13: 'O padrão desfaz-se numa descida',
    }, 'Encontra a nota de cima e a mão sabe o resto.', {
      intro: 'Este começo todo é feito de uma só forma. A mão direita toca cima, meio, baixo, meio em cada tempo, e a mão esquerda segura uma oitava por compasso: F, G, A, depois E.',
      L: 'A mão esquerda só segura uma oitava: mindinho na nota de baixo, polegar uma oitava acima, os quatro tempos. F, G, A, E.',
      R: 'Agora dois compassos disto, mão direita. Cima, meio, baixo, meio, em cada tempo. Mais à frente passa a E, B, G, B, e só a nota de cima fica no sítio.',
      both: 'As duas mãos juntas, à velocidade real. Põe a oitava no tempo um e deixa o padrão rolar por cima.',
      outro: 'Encontra a nota de cima, e a tua mão já sabe o resto. A tua vez.',
    }),
    ph('A melodia', 'Uma melodia de pequenas escalas sobre acordes', [
      'Direita: sobe A B C D e volta a descer',
      'Esquerda: um acorde partido em cada tempo, F A C A',
    ], 'F A C A, E A C A, D G B G, E G B G', 'A B C D E D C B, depois de cima A G F E', {
      14: 'A, quatro vezes: uma respiração',
      15: 'Agora as duas mãos em cada tempo',
      17: 'Sobe B C D G, depois mais alto',
      19: 'A melodia outra vez, uma oitava acima',
      22: 'Desta vez G#: B C D G#',
    }, 'Cada subida é uma escala. Dedos perto das teclas.', {
      intro: 'Aqui chega a melodia. A mão direita toca pequenas escalas, a subir e a descer, enquanto a mão esquerda parte cada acorde em quatro notas, uma em cada tempo.',
      L: 'Mão esquerda: F, A, C, A. Depois E, A, C, A. Um acorde por compasso, partido na mesma forma de sobe e desce.',
      R: 'Mão direita: A, B, C, D, E, e volta a descer. É só uma escala, por isso mantém os dedos perto das teclas.',
      both: 'Agora juntas. Em cada tempo as duas mãos mexem-se ao mesmo tempo. Depois a melodia volta, uma oitava acima.',
      outro: 'Cada subida é só uma escala. Toca devagar até parecer que estás a andar.',
    }),
    ph('Arpejos a correr', 'O padrão volta sobre arpejos largos', [
      'Esquerda: sobe o acorde e volta, F C F A C',
      'Direita: o primeiro padrão, depois saltos grandes',
    ], 'De F, depois A, G, E: a mesma forma de cada vez', 'E C A C, depois mais largo, com um salto ao E agudo', {
      23: 'A mão esquerda corre por baixo do padrão',
      27: 'As duas mãos abertas: atenção ao salto',
      31: 'Uma oitava acima, a mesma mão esquerda',
      35: 'As mesmas formas, a partir de B',
    }, 'Deixa o pulso levar a mão esquerda. Os saltos podem ser mais lentos.', {
      intro: 'O padrão do início volta, mas agora a mão esquerda corre. Sobe pelo acorde e volta a descer, mais aberta do que antes.',
      L: 'Mão esquerda: F, C, F, A, C, a subir e a descer. A mesma forma começa no F, depois no A, no G, e no E.',
      R: 'A mão direita toca outra vez o primeiro padrão, E, C, A, C, e depois abre-se com um salto ao E agudo.',
      both: 'As duas mãos. Deixa o pulso levar a mão esquerda, e prepara-te para o salto perto do compasso 27.',
      outro: 'Deixa o pulso fazer o trabalho. Os saltos podem ser mais lentos ao início.',
    }),
    ph('A melodia, mais alta', 'A melodia volta, uma oitava acima', [
      'Direita: as mesmas escalas da melodia, mais alto',
      'Esquerda: espera, depois entra com acordes partidos',
    ], 'Uma pausa, um acorde, depois acordes partidos no 41', 'A B C D E D C B, a subir até lá acima', {
      39: 'Só a mão direita durante um compasso',
      41: 'A esquerda entra com acordes partidos',
      46: 'B C D G#, depois desce',
    }, 'As mesmas notas da melodia, só que mais alto.', {
      intro: 'A melodia volta, uma oitava acima. Já conheces estas notas. Só o sítio no teclado é novo.',
      L: 'A mão esquerda espera, toca um acorde, e a partir do compasso 41 volta aos acordes partidos que aprendeste.',
      R: 'Mão direita: as mesmas pequenas escalas, A, B, C, D, E e a descer outra vez, só que mais acima.',
      both: 'Juntas. É a melodia da fase dois, mais acima no teclado.',
      outro: 'As mesmas notas, mais alto. Encontra a primeira e o resto vem atrás.',
    }),
    ph('A subida', 'Colcheias na esquerda, o padrão forte por cima', [
      'Esquerda: colcheias certinhas, depois acordes fortes',
      'Direita: a nota de cima guia, A, depois B, depois C',
    ], 'Uma nota aguda, colcheias graves, depois F, G, A', 'E C A C forte, depois A E C A, B E D B, C E D C', {
      47: 'As colcheias da esquerda empurram para a frente',
      51: 'Agora A em cima: A E C A',
      53: 'B em cima: B E D B',
      55: 'C em cima: C E D C',
      57: 'Dois compassos de três tempos: conta 1 2 3',
    }, 'Colcheias certinhas, como um relógio. Forte, mas sem bater.', {
      intro: 'Esta é a subida. A mão esquerda toca colcheias certinhas, e por cima o padrão fica mais forte enquanto a nota de cima sobe: A, depois B, depois C.',
      L: 'Mão esquerda: colcheias iguais, como um relógio. Depois F, G e A, ainda em colcheias.',
      R: 'Mão direita: A, E, C, A. Depois B, E, D, B. Depois C, E, D, C. A nota de cima mostra o caminho para cima.',
      both: 'As duas mãos, forte mas sem bater. Atenção aos compassos 57 e 58: esses dois só têm três tempos.',
      outro: 'Colcheias certinhas, como um relógio. Forte, mas sem bater.',
    }),
    ph('Acordes grandes', 'Acordes grandes, depois a melodia com força', [
      'Direita: forma cada acorde no ar antes de tocar',
      'Esquerda: os arpejos outra vez, F A G E',
    ], 'Arpejos de F, A, G, E, a mesma forma de cada vez', 'Acordes no 1, entre o 2 e o 3, e no 4', {
      59: 'Acordes em cima, arpejos em baixo',
      61: 'Segura o acorde ligado por cima da barra',
      67: 'A melodia, forte: A B C D E D C B',
      71: 'Os saltos largos voltam',
    }, 'Forte, mas igual. As notas de cima são a melodia.', {
      intro: 'Agora acordes grandes. A mão direita toca acordes cheios no tempo um, entre o dois e o três, e no quatro, enquanto a mão esquerda rola arpejos por baixo.',
      L: 'Mão esquerda: os arpejos outra vez, de F, depois A, depois G, depois E. A mesma forma de cada vez.',
      R: 'Mão direita: forma cada acorde no ar antes de o pousares. As notas de cima são a melodia.',
      both: 'Juntas, com toda a força. No compasso 61, segura o acorde ligado por cima da barra.',
      outro: 'Forte, mas igual. Ouve as notas de cima, são elas que levam a melodia.',
    }),
    ph('O final', 'O padrão uma última vez, depois uma subida ao topo', [
      'Direita: a nota de cima sobe, A, B, C, depois D',
      'Esquerda: um acorde segurado a cada dois compassos',
    ], 'Uma oitava grave de F, depois D G B, E A C, E G B', 'A E C A, B E D B, C G E C, D B G D, depois sobe', {
      75: 'Mais suave: acordes segurados por baixo do padrão',
      77: 'B em cima',
      79: 'C em cima',
      81: 'D em cima, a abrandar',
      82: 'A subida ao topo. Deixa soar',
    }, 'Deixa abrandar. A última subida é só a mão direita.', {
      intro: 'O final. O padrão toca uma última vez, mais suave, com a nota de cima a subir, A, B, C, D, e depois uma corrida até lá acima.',
      L: 'Mão esquerda: um acorde segurado a cada dois compassos. Uma oitava grave de F, depois D, G, B, depois E, A, C.',
      R: 'Mão direita: A, E, C, A. Depois B em cima, depois C, depois D. No fim, uma subida até lá acima.',
      both: 'As duas mãos, agora mais suave. Deixa abrandar no fim, e deixa as últimas notas soar.',
      outro: 'Abranda e deixa soar. A última subida é só a mão direita.',
    }),
  ],
};

/** The steps' tips in Portuguese (STEP_TIPS in reelScripts.ts), same keys. */
export const STEP_TIPS_PT: Record<string, Record<string, string>> = {
  'interstellar-experience': {
    B3: 'Mantém o padrão igual enquanto a oitava muda por baixo.',
    R5: 'Deixa o dedo de cima onde está. Os dedos de baixo descem.',
    B5: 'Primeiro a oitava, depois deixa o padrão rolar.',
    B7: 'O mesmo sentir: a oitava no tempo um, o padrão por cima.',
    J9: 'Olha para a tecla nova um tempo antes, depois mexe.',
    R9: 'Aqui a mão sobe um pouco. Guia com a nota de cima.',
    B9: 'Ouve as notas de cima. São elas a melodia.',
    R11: 'É aqui que a mão mais se mexe. Olha para o sítio seguinte.',
    B11: 'Devagar está bem. As duas mãos a cair juntas.',
    R16: 'Pulso direito e dedos perto das teclas.',
    B16: 'Deixa a mão esquerda marcar o tempo enquanto a direita canta.',
    R18: 'A mesma forma, um pouco mais alto. Tenta não olhar para as mãos.',
    B18: 'Conta quatro em cada compasso, em voz alta se ajudar.',
    R20: 'Atenção ao sustenido. Uma tecla preta muda a cor.',
    B20: 'Dá peso ao primeiro tempo de cada compasso.',
    B25: 'A mesma onda na mão esquerda. Suave, não forte.',
    R27: 'Formas maiores agora. Abre a mão antes de tocar.',
    B27: 'Se parecer apertado, toca a mão esquerda mais baixo.',
    R29: 'Em cima sobe. Prepara-te cedo para abrir a mão.',
    B29: 'Mantém o tempo certo durante a abertura.',
    J31: 'Este é o grande salto da peça. Sem pressa.',
    R31: 'Aí vem o salto. Olha primeiro para a tecla aguda.',
    B31: 'Abranda para o salto, depois apanha o tempo outra vez.',
    B33: 'Já conheces esta. Toca-a um pouco mais à vontade.',
    R35: 'Um acorde novo. Sente a forma antes de carregar.',
    B35: 'Mantém a mão esquerda a rolar por baixo do acorde novo.',
    R37: 'A última forma nova desta fase. Devagar.',
    B37: 'Acaba a fase calmo e suave.',
    B41: 'As mesmas mãos da fase dois, só que mais acima.',
    R45: 'Atenção ao sustenido outra vez, a mesma tecla preta de antes.',
    B45: 'Deixa esta parte respirar antes da subida.',
    J47: 'Mão esquerda solta para o salto.',
    B49: 'Colcheias iguais enquanto a mão direita fica mais forte.',
    L51: 'Uma nota, outra e outra vez. Salta-a leve, a partir do pulso.',
    R51: 'Uma forma mais aberta. Estica o mindinho, não o braço.',
    B51: 'Mais forte agora, mas igual.',
    B53: 'Deixa a subida crescer, compasso a compasso.',
    J57: 'Move a mão de uma vez, não dedo a dedo.',
    L57: 'Estes dois compassos só têm três tempos. Conta um, dois, três.',
    R57: 'Aqui são três tempos. Não esperes por um quarto.',
    B57: 'Conta três, e depois chegam os acordes grandes.',
    B61: 'Segura o acorde ligado por cima da barra.',
    R63: 'Forma o acorde no ar, depois pousa-o.',
    B63: 'A mão esquerda continua a rolar por baixo dos acordes.',
    R65: 'Só um dedo se mexe. O resto do acorde fica.',
    B65: 'Toca a nota de cima um pouco mais forte que as outras.',
    R67: 'Aqui a melodia corre. Dedos leves.',
    B67: 'Corrida leve e mão esquerda firme.',
    B69: 'Igual a antes. Aproveita.',
    L73: 'Um baixo novo. Encontra-o antes de o compasso começar.',
    R73: 'O padrão do início está de volta. A tua mão já o sabe.',
    B73: 'Baixa o som no fim da fase.',
    B77: 'Mais suave agora. Deixa cada acorde soar.',
    B79: 'Abranda um pouco. O fim está perto.',
    J81: 'Deixa a mão cair na tecla grave, sem pressa.',
    R81: 'A última subida vai até lá acima. Leve e igual.',
    B81: 'Deixa a última nota soar até desaparecer.',
  },
};
